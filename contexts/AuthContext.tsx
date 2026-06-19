import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { InteractionManager } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withTimeout } from '@/utils/asyncTimeout';
import type { Session } from '@supabase/supabase-js';

export type UserRole = 'contractor' | 'customer' | 'both';
export type SubscriptionStatus = 'free_trial' | 'active' | 'past_due' | 'cancelled';

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  display_name?: string;
  account_type: UserRole;
  business_name?: string;
  bio?: string;
  trades?: string[];
  hourly_rate_from?: number;
  hourly_rate?: number;
  city?: string;
  postcode_area?: string;
  avatar_url?: string;
  tax_rate?: number;
  available?: boolean;
  onboarding_complete?: boolean;
  preferred_shop?: string;
  flexible_pricing?: boolean;
  customer_profile_complete?: boolean;
  // Subscription
  subscription_status?: SubscriptionStatus;
  trial_ends_at?: string | null;
  trial_started_at?: string | null;
  stripe_customer_id?: string | null;
  // Saved marketplace preferences
  saved_trades?: string[];
  saved_postcode_areas?: string[];
  // Portfolio
  portfolio_images?: string[];
  website?: string;
  social_links?: Record<string, string>;
  // Availability
  availability_days?: string[];
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  operationLoading: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, name: string, accountType: UserRole) => Promise<{ error: string | null }>;
  signInWithGoogle: (role?: UserRole) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<{ error: string | null }>;
  completeOnboarding: (data: Partial<UserProfile>) => Promise<{ error: string | null }>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STARTUP_TIMEOUT_MS = 6000;
const PROFILE_SYNC_TIMEOUT_MS = 6000;

function deferUntilAfterFirstPaint(task: () => void | Promise<void>) {
  const timeoutId = setTimeout(() => {
    InteractionManager.runAfterInteractions(task);
  }, 0);

  return () => clearTimeout(timeoutId);
}

function profileFromSession(session: Session): UserProfile {
  const metadata = session.user.user_metadata ?? {};
  const accountType = (metadata.account_type as UserRole) ?? 'contractor';

  return {
    id: session.user.id,
    email: session.user.email ?? '',
    username: metadata.username,
    display_name: metadata.username || session.user.email?.split('@')[0],
    account_type: accountType,
    trades: [],
    tax_rate: 30,
    available: true,
    onboarding_complete: false,
    flexible_pricing: false,
    customer_profile_complete: false,
    subscription_status: 'free_trial',
    trial_ends_at: null,
    trial_started_at: null,
    saved_trades: [],
    saved_postcode_areas: [],
    portfolio_images: [],
    social_links: {},
    availability_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [supabaseUnavailable, setSupabaseUnavailable] = useState(false);

  useEffect(() => {
    let canceled = false;

    const cancelDeferredStartup = deferUntilAfterFirstPaint(async () => {
      if (canceled) return;

      try {
        const { getSupabaseClient } = await import('@/template/core');
        if (canceled) return;
        const client = getSupabaseClient();
        if (!canceled) {
          setSupabase(client);
        }
      } catch (error) {
        console.warn('[AuthContext] Supabase client unavailable during background startup:', error);
        if (!canceled) {
          setSupabaseUnavailable(true);
          setLoading(false);
        }
      }
    });

    return () => {
      canceled = true;
      cancelDeferredStartup();
    };
  }, []);

  // Always define fetchProfile as a hook so it is called unconditionally on every render.
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    if (!supabase) return null;
    const { data, error } = await withTimeout(
      supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single(),
      PROFILE_SYNC_TIMEOUT_MS,
      `[AuthContext] Timed out loading user profile after ${PROFILE_SYNC_TIMEOUT_MS}ms`
    );
    if (error || !data) return null;

    const accountType = (data.account_type as UserRole) ?? 'contractor';

    return {
      id: data.id,
      email: data.email,
      username: data.username,
      display_name: data.username || data.email?.split('@')[0],
      account_type: accountType,
      business_name: data.business_name,
      bio: data.bio,
      trades: data.trades || [],
      hourly_rate_from: data.hourly_rate_from,
      hourly_rate: data.hourly_rate,
      city: data.city,
      postcode_area: data.postcode_area,
      avatar_url: data.avatar_url,
      tax_rate: data.tax_rate ?? 30,
      available: data.available ?? true,
      onboarding_complete: data.onboarding_complete ?? false,
      preferred_shop: data.preferred_shop,
      flexible_pricing: data.flexible_pricing ?? false,
      customer_profile_complete: data.customer_profile_complete ?? false,
      subscription_status: (data.subscription_status as SubscriptionStatus) ?? 'free_trial',
      trial_ends_at: data.trial_ends_at ?? null,
      trial_started_at: data.trial_started_at ?? null,
      stripe_customer_id: data.stripe_customer_id ?? null,
      saved_trades: data.saved_trades || [],
      saved_postcode_areas: data.saved_postcode_areas || [],
      portfolio_images: data.portfolio_images || [],
      website: data.website,
      social_links: data.social_links || {},
      availability_days: data.availability_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    };
  }, [supabase]);

  // Always call useEffect unconditionally; guard the body for the null-supabase case.
  useEffect(() => {
    if (!supabase) {
      return;
    }

    let canceled = false;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_STARTUP_TIMEOUT_MS,
          `[AuthContext] Timed out restoring auth session after ${AUTH_STARTUP_TIMEOUT_MS}ms`
        );
        if (canceled) return;

        setSession(session);
        if (session?.user) {
          const profile = await fetchProfile(session.user.id).catch((error) => {
            console.warn('[AuthContext] Failed to sync profile during startup:', error);
            return null;
          });
          if (canceled) return;
          setUser(profile ?? profileFromSession(session));
        }
      } catch (error) {
        console.warn('[AuthContext] Failed to initialize session:', error);
        setSession(null);
        setUser(null);
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        const profile = await fetchProfile(session.user.id).catch((error) => {
          console.warn('[AuthContext] Failed to sync profile after auth state change:', error);
          return null;
        });
        setUser(profile ?? profileFromSession(session));
      } else {
        setUser(null);
      }
    });

    return () => {
      canceled = true;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  // Conditional render while Supabase startup has been deferred, or when configuration is unavailable — placed after all hooks.
  if (!supabase) {
    const unavailable = async () => ({ error: supabaseUnavailable
      ? 'Supabase is not configured. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
      : 'Authentication is still starting. Please try again in a moment.' });

    return (
      <AuthContext.Provider value={{
        user: null,
        session: null,
        loading: !supabaseUnavailable,
        operationLoading: false,
        isAuthenticated: false,
        isOnboarded: false,
        login: unavailable,
        signup: unavailable,
        signInWithGoogle: unavailable,
        logout: async () => {},
        deleteAccount: unavailable,
        completeOnboarding: unavailable,
        updateProfile: async () => {},
        refreshProfile: async () => {},
      }}>
        {children}
      </AuthContext.Provider>
    );
  }

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    setOperationLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setOperationLoading(false);
    if (error) return { error: error.message };
    return { error: null };
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    accountType: UserRole = 'contractor'
  ): Promise<{ error: string | null }> => {
    setOperationLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: name,
          account_type: accountType,
        },
      },
    });
    setOperationLoading(false);
    if (error) return { error: error.message };
    if (data.user) {
      setUser({
        id: data.user.id,
        email,
        display_name: name,
        account_type: accountType,
        onboarding_complete: false,
        subscription_status: 'free_trial',
        trial_ends_at: null,
      });
      if (data.session) setSession(data.session);
    }
    return { error: null };
  };

  const signInWithGoogle = async (role: UserRole = 'contractor'): Promise<{ error: string | null }> => {
    setOperationLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: undefined,
          queryParams: { prompt: 'select_account' },
        },
      });
      setOperationLoading(false);
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      setOperationLoading(false);
      return { error: err?.message || 'Google sign-in failed' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const deleteAccount = async (): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' };
    setOperationLoading(true);
    try {
      // Call the edge function or use service-role delete — fall back to a DB RPC
      // We use the anon client to call a self-delete RPC that runs with SECURITY DEFINER
      const { error: rpcError } = await supabase.rpc('delete_own_account');
      if (rpcError) {
        setOperationLoading(false);
        return { error: rpcError.message };
      }
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setOperationLoading(false);
      return { error: null };
    } catch (err: any) {
      setOperationLoading(false);
      return { error: err?.message || 'Failed to delete account' };
    }
  };

  const completeOnboarding = async (data: Partial<UserProfile>): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' };
    setOperationLoading(true);

    // Ensure account_type is valid — never allow null
    const accountType: UserRole = data.account_type || user.account_type || 'contractor';

    // id and email are included so the row is fully seeded when the handle_new_user
    // trigger hasn't yet run (e.g. first deploy). email mirrors the auth identity and
    // is safe to include here — onboarding always runs as the same authenticated user.
    const upsertData: Record<string, unknown> = {
      id: user.id,
      email: user.email,
      onboarding_complete: true,
      account_type: accountType,
    };
    if (data.display_name) upsertData.username = data.display_name;
    if (data.business_name) upsertData.business_name = data.business_name;
    if (data.city) upsertData.city = data.city;
    if (data.postcode_area) upsertData.postcode_area = data.postcode_area;
    if (data.bio) upsertData.bio = data.bio;
    if (data.trades) upsertData.trades = data.trades;
    if (data.hourly_rate_from !== undefined) upsertData.hourly_rate_from = data.hourly_rate_from;
    if (data.tax_rate) upsertData.tax_rate = data.tax_rate;

    // Set trial for contractor/both accounts
    if (accountType === 'contractor' || accountType === 'both') {
      const now = new Date();
      upsertData.subscription_status = 'free_trial';
      upsertData.trial_started_at = now.toISOString();
      upsertData.trial_ends_at = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      // customers have no subscription requirement
      upsertData.subscription_status = 'active';
    }

    const { error } = await supabase
      .from('user_profiles')
      .upsert(upsertData);

    if (error) {
      setOperationLoading(false);
      return { error: error.message };
    }

    const fresh = await fetchProfile(user.id);
    if (fresh) setUser(fresh);
    setOperationLoading(false);
    return { error: null };
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const updateData: Record<string, unknown> = {};
    if (data.display_name !== undefined) updateData.username = data.display_name;
    if (data.business_name !== undefined) updateData.business_name = data.business_name;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.postcode_area !== undefined) updateData.postcode_area = data.postcode_area;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.trades !== undefined) updateData.trades = data.trades;
    if (data.hourly_rate_from !== undefined) updateData.hourly_rate_from = data.hourly_rate_from;
    if (data.hourly_rate !== undefined) updateData.hourly_rate = data.hourly_rate;
    if (data.tax_rate !== undefined) updateData.tax_rate = data.tax_rate;
    if (data.available !== undefined) updateData.available = data.available;
    if (data.preferred_shop !== undefined) updateData.preferred_shop = data.preferred_shop;
    if (data.flexible_pricing !== undefined) updateData.flexible_pricing = data.flexible_pricing;
    if (data.customer_profile_complete !== undefined) updateData.customer_profile_complete = data.customer_profile_complete;
    if (data.saved_trades !== undefined) updateData.saved_trades = data.saved_trades;
    if (data.saved_postcode_areas !== undefined) updateData.saved_postcode_areas = data.saved_postcode_areas;
    if (data.portfolio_images !== undefined) updateData.portfolio_images = data.portfolio_images;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.social_links !== undefined) updateData.social_links = data.social_links;
    if (data.availability_days !== undefined) updateData.availability_days = data.availability_days;

    await supabase.from('user_profiles').update(updateData).eq('id', user.id);
    setUser(prev => prev ? { ...prev, ...data } : null);
  };

  const refreshProfile = async () => {
    if (!user) return;
    const fresh = await fetchProfile(user.id);
    if (fresh) setUser(fresh);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      operationLoading,
      isAuthenticated: !!user && !!session,
      isOnboarded: user?.onboarding_complete ?? false,
      login,
      signup,
      signInWithGoogle,
      logout,
      deleteAccount,
      completeOnboarding,
      updateProfile,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Subscription helpers ───────────────────────────────────
export function isContractorTrialActive(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.account_type === 'customer') return false;
  if (user.subscription_status === 'active') return false;
  if (!user.trial_ends_at) return true; // no end date = still in grace
  return new Date(user.trial_ends_at) > new Date();
}

export function getTrialDaysLeft(user: UserProfile | null): number {
  if (!user?.trial_ends_at) return 14;
  const diff = Math.ceil((new Date(user.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function isSubscriptionActive(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.account_type === 'customer') return true; // customers always free
  return user.subscription_status === 'active' || isContractorTrialActive(user);
}
