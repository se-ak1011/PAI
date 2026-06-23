import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { useContext } from 'react';
import { withTimeout } from '@/utils/asyncTimeout';
import { deferUntilAfterFirstPaint, getDeferredSupabaseClient, type DeferredSupabaseClient } from '@/utils/deferredSupabase';

export interface PrivateJob {
  id: string;
  contractor_id: string;
  title: string;
  customer: string;
  description: string;
  status: string;
  total: number;
  labour: number;
  materials: number;
  vat: number;
  materials_items: { name: string; qty: number; price: number; unit?: string; got?: boolean }[];
  receipts: string[];
  progress_photos?: string[];
  invoiced_at: string | null;
  paid_at: string | null;
  created_at: string;
  source_job_post_id: string | null;
  // Hourly jobs
  job_type: 'fixed' | 'hourly';
  hourly_rate: number | null;
  estimated_hours: number | null;
  actual_hours: number | null;
}

export interface JobPost {
  id: string;
  client_id: string;
  client_name?: string;
  client_avatar?: string;
  title: string;
  description: string;
  trade: string;
  status: string;
  budget: number;
  city: string;
  postcode_area: string;
  photo_url?: string | null;
  ai_scope: string | null;
  ai_materials: string[] | null;
  applications?: number;
  created_at: string;
}

interface JobsContextType {
  privateJobs: PrivateJob[];
  jobPosts: JobPost[];
  loading: boolean;
  addPrivateJob: (job: Omit<PrivateJob, 'id' | 'created_at'>) => Promise<void>;
  updatePrivateJob: (id: string, data: Partial<PrivateJob>) => Promise<void>;
  deletePrivateJob: (id: string) => Promise<void>;
  addJobPost: (post: Omit<JobPost, 'id' | 'created_at' | 'applications'>) => Promise<void>;
  refreshJobs: () => Promise<void>;
  refreshJobPosts: () => Promise<void>;
}

export const JobsContext = createContext<JobsContextType | undefined>(undefined);

const JOBS_SYNC_TIMEOUT_MS = 8000;

export function JobsProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext);
  const [privateJobs, setPrivateJobs] = useState<PrivateJob[]>([]);
  const [jobPosts, setJobPosts] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(false);

  const [supabase, setSupabase] = useState<DeferredSupabaseClient | null>(null);
  const user = auth?.user ?? null;

  useEffect(() => {
    if (!user) return;

    let canceled = false;
    const cancelDeferredStartup = deferUntilAfterFirstPaint(() => {
      if (canceled) return;
      getDeferredSupabaseClient()
        .then((client) => {
          if (!canceled) {
            setSupabase(client);
          }
        })
        .catch((error) => {
          console.warn('[JobsContext] Supabase client unavailable; skipping background sync:', error);
        });
    });

    return () => {
      canceled = true;
      cancelDeferredStartup();
    };
  }, [user?.id]);

  // Always define hooks unconditionally; guard the bodies for the null-supabase case.
  const refreshJobs = useCallback(async () => {
    if (!supabase) return;
    if (!user || (user.account_type !== 'contractor' && user.account_type !== 'both')) return;
    const { data, error } = await withTimeout(
      supabase
        .from('private_jobs')
        .select('*')
        .eq('contractor_id', user.id)
        .order('created_at', { ascending: false }),
      JOBS_SYNC_TIMEOUT_MS,
      `[JobsContext] Timed out syncing private jobs after ${JOBS_SYNC_TIMEOUT_MS}ms`
    );
    if (!error && data) {
      setPrivateJobs(data.map(j => ({
        ...j,
        materials_items: j.materials_items || [],
        receipts: j.receipts || [],
        progress_photos: j.progress_photos || [],
        job_type: j.job_type ?? 'fixed',
        hourly_rate: j.hourly_rate ?? null,
        estimated_hours: j.estimated_hours ?? null,
        actual_hours: j.actual_hours ?? null,
      })));
    }
  }, [supabase, user?.id]);

  const refreshJobPosts = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await withTimeout(
      supabase
        .from('job_posts')
        .select(`
          *,
          user_profiles!job_posts_client_id_fkey(username, avatar_url),
          job_applications(id)
        `)
        .order('created_at', { ascending: false }),
      JOBS_SYNC_TIMEOUT_MS,
      `[JobsContext] Timed out syncing marketplace jobs after ${JOBS_SYNC_TIMEOUT_MS}ms`
    );
    if (!error && data) {
      setJobPosts(data.map((p: any) => ({
        id: p.id,
        client_id: p.client_id,
        client_name: p.user_profiles?.username || 'Unknown',
        client_avatar: p.user_profiles?.avatar_url || null,
        title: p.title,
        description: p.description || '',
        trade: p.trade,
        status: p.status,
        budget: p.budget,
        city: p.city || '',
        postcode_area: p.postcode_area || '',
        photo_url: p.photo_url || null,
        ai_scope: p.ai_scope || null,
        ai_materials: p.ai_materials || null,
        applications: p.job_applications?.length || 0,
        created_at: p.created_at,
      })));
    }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    if (!user) {
      setPrivateJobs([]);
      return;
    }
    setLoading(true);
    Promise.allSettled([refreshJobs(), refreshJobPosts()])
      .then((results) => {
        results.forEach((result) => {
          if (result.status === 'rejected') {
            console.warn('[JobsContext] Startup sync failed:', result.reason);
          }
        });
      })
      .finally(() => setLoading(false));
  }, [supabase, user?.id]);

  // Conditional render for when Supabase is unavailable — placed after all hooks.
  if (!supabase) {
    return (
      <JobsContext.Provider value={{
        privateJobs: [],
        jobPosts: [],
        loading: false,
        addPrivateJob: async () => {},
        updatePrivateJob: async () => {},
        deletePrivateJob: async () => {},
        addJobPost: async () => {},
        refreshJobs: async () => {},
        refreshJobPosts: async () => {},
      }}>
        {children}
      </JobsContext.Provider>
    );
  }

  const addPrivateJob = async (job: Omit<PrivateJob, 'id' | 'created_at'>) => {
    if (!user) throw new Error('You must be signed in to save a job.');
    const { data, error } = await supabase
      .from('private_jobs')
      .insert({ ...job, contractor_id: user.id })
      .select()
      .single();
    // Surface the real DB error instead of silently faking success. A swallowed
    // error here is what let "Invoice Created" show while nothing was saved.
    if (error) {
      console.warn('[JobsContext] addPrivateJob failed:', error.message);
      throw new Error(error.message);
    }
    if (data) {
      setPrivateJobs(prev => [{ ...data, materials_items: data.materials_items || [], receipts: data.receipts || [], progress_photos: data.progress_photos || [], job_type: data.job_type ?? 'fixed', hourly_rate: data.hourly_rate ?? null, estimated_hours: data.estimated_hours ?? null, actual_hours: data.actual_hours ?? null }, ...prev]);
    }
  };

  const updatePrivateJob = async (id: string, updates: Partial<PrivateJob>) => {
    const { error } = await supabase.from('private_jobs').update(updates).eq('id', id);
    if (error) {
      console.warn('[JobsContext] updatePrivateJob failed:', error.message);
      throw new Error(error.message);
    }
    setPrivateJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
  };

  const deletePrivateJob = async (id: string) => {
    const { error } = await supabase.from('private_jobs').delete().eq('id', id);
    if (!error) {
      setPrivateJobs(prev => prev.filter(j => j.id !== id));
    }
  };

  const addJobPost = async (post: Omit<JobPost, 'id' | 'created_at' | 'applications'>) => {
    if (!user) throw new Error('You must be signed in to post a job.');
    const { data, error } = await supabase
      .from('job_posts')
      .insert({ ...post, client_id: user.id })
      .select()
      .single();
    if (error) {
      console.warn('[JobsContext] addJobPost failed:', error.message);
      throw new Error(error.message);
    }
    if (data) {
      setJobPosts(prev => [{
        ...data,
        client_name: user.display_name,
        client_avatar: user.avatar_url,
        applications: 0,
        ai_materials: data.ai_materials || null,
      }, ...prev]);
    }
  };

  return (
    <JobsContext.Provider value={{
      privateJobs,
      jobPosts,
      loading,
      addPrivateJob,
      updatePrivateJob,
      deletePrivateJob,
      addJobPost,
      refreshJobs,
      refreshJobPosts,
    }}>
      {children}
    </JobsContext.Provider>
  );
}
