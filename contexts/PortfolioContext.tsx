import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { PrivateJob } from '@/contexts/JobsContext';
import { withTimeout } from '@/utils/asyncTimeout';
import { deferUntilAfterFirstPaint, getDeferredSupabaseClient, type DeferredSupabaseClient } from '@/utils/deferredSupabase';

export type PortfolioProjectSource = 'completed_job' | 'photo_library';

export interface PortfolioPhotoRef {
  path: string;
  source_job_id?: string | null;
  sort_order: number;
}

export interface PortfolioProject {
  id: string;
  contractor_id: string;
  source: PortfolioProjectSource;
  source_job_id?: string | null;
  title: string;
  trade?: string | null;
  location?: string | null;
  description?: string | null;
  photos: PortfolioPhotoRef[];
  cover_photo_path?: string | null;
  verified: boolean;
  published: boolean;
  created_at: string;
}

interface PortfolioContextType {
  projects: PortfolioProject[];
  loading: boolean;
  createProjectFromCompletedJob: (job: PrivateJob, options?: Partial<Pick<PortfolioProject, 'trade' | 'location' | 'description'>>) => Promise<PortfolioProject | null>;
  addManualProject: (project: Omit<PortfolioProject, 'id' | 'contractor_id' | 'created_at' | 'verified' | 'source' | 'source_job_id'>) => Promise<PortfolioProject | null>;
  updateProject: (id: string, updates: Partial<PortfolioProject>) => Promise<void>;
  refreshProjects: () => Promise<void>;
}

export const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

const PORTFOLIO_SYNC_TIMEOUT_MS = 8000;

function generateProjectDescription(job: PrivateJob, photoCount: number): string {
  const scope = job.description ? ` The scope included ${job.description.trim()}` : '';
  const value = job.total ? ` with a completed project value of £${job.total.toLocaleString()}` : '';
  return `A professionally completed ${job.title.toLowerCase()} project for ${job.customer || 'a PAI customer'}${value}.${scope} The selected ${photoCount === 1 ? 'photo shows' : 'photos show'} the workmanship, finish, and attention to detail delivered from start to completion.`;
}

function mapProject(row: any): PortfolioProject {
  return {
    ...row,
    source: row.source ?? (row.verified ? 'completed_job' : 'photo_library'),
    photos: row.photos || [],
    verified: Boolean(row.verified),
    published: Boolean(row.published),
  };
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;
  const [supabase, setSupabase] = useState<DeferredSupabaseClient | null>(null);
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let canceled = false;
    const cancel = deferUntilAfterFirstPaint(() => {
      getDeferredSupabaseClient()
        .then(client => { if (!canceled) setSupabase(client); })
        .catch(error => console.warn('[PortfolioContext] Supabase unavailable:', error));
    });
    return () => { canceled = true; cancel(); };
  }, [user?.id]);

  const refreshProjects = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const { data, error } = await withTimeout(
      supabase.from('portfolio_projects').select('*').eq('contractor_id', user.id).order('created_at', { ascending: false }),
      PORTFOLIO_SYNC_TIMEOUT_MS,
      `[PortfolioContext] Timed out syncing portfolio projects after ${PORTFOLIO_SYNC_TIMEOUT_MS}ms`,
    );
    if (!error && data) setProjects(data.map(mapProject));
    setLoading(false);
  }, [supabase, user?.id]);

  useEffect(() => { refreshProjects(); }, [refreshProjects]);

  const createProjectFromCompletedJob: PortfolioContextType['createProjectFromCompletedJob'] = async (job, options = {}) => {
    if (!supabase || !user || (job.progress_photos ?? []).length === 0) return null;
    const photos = (job.progress_photos ?? []).map((path, sort_order) => ({ path, source_job_id: job.id, sort_order }));
    const payload = {
      contractor_id: user.id,
      source: 'completed_job' as const,
      source_job_id: job.id,
      title: job.title,
      trade: options.trade ?? user.trades?.[0] ?? null,
      location: options.location ?? user.city ?? null,
      description: options.description ?? generateProjectDescription(job, photos.length),
      photos,
      cover_photo_path: photos[0]?.path ?? null,
      verified: true,
      published: false,
    };
    const { data, error } = await supabase.from('portfolio_projects').insert(payload).select().single();
    if (error || !data) return null;
    const project = mapProject(data);
    setProjects(prev => [project, ...prev]);
    return project;
  };

  const addManualProject: PortfolioContextType['addManualProject'] = async (project) => {
    if (!supabase || !user) return null;
    const payload = { ...project, contractor_id: user.id, source: 'photo_library' as const, source_job_id: null, verified: false };
    const { data, error } = await supabase.from('portfolio_projects').insert(payload).select().single();
    if (error || !data) return null;
    const created = mapProject(data);
    setProjects(prev => [created, ...prev]);
    return created;
  };

  const updateProject = async (id: string, updates: Partial<PortfolioProject>) => {
    if (!supabase) return;
    const { error } = await supabase.from('portfolio_projects').update(updates).eq('id', id);
    if (!error) setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  return <PortfolioContext.Provider value={{ projects, loading, createProjectFromCompletedJob, addManualProject, updateProject, refreshProjects }}>{children}</PortfolioContext.Provider>;
}
