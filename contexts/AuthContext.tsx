import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { getSupabaseClient } from '@/template';
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
  completeOnboarding: (data: Partial<UserProfile>) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);

  const supabase = getSupabaseClient();

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
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
  };

  useEffect(() => {
    let canceled = false;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (canceled) return;

        setSession(session);
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          if (canceled) return;
          setUser(profile);
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
        const profile = await fetchProfile(session.user.id);
        setUser(profile);
      } else {
        setUser(null);
      }
    });

    return () => {
      canceled = true;
      subscription.unsubscribe();
    };
  }, []);

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

  const completeOnboarding = async (data: Partial<UserProfile>) => {
    if (!user) return;
    setOperationLoading(true);

    // Ensure account_type is valid — never allow null
    const accountType: UserRole = data.account_type || user.account_type || 'contractor';

    const updateData: Record<string, unknown> = {
      onboarding_complete: true,
      account_type: accountType,
    };
    if (data.display_name) updateData.username = data.display_name;
    if (data.business_name) updateData.business_name = data.business_name;
    if (data.city) updateData.city = data.city;
    if (data.postcode_area) updateData.postcode_area = data.postcode_area;
    if (data.bio) updateData.bio = data.bio;
    if (data.trades) updateData.trades = data.trades;
    if (data.hourly_rate_from !== undefined) updateData.hourly_rate_from = data.hourly_rate_from;
    if (data.tax_rate) updateData.tax_rate = data.tax_rate;

    // Set trial for contractor/both accounts
    if (accountType === 'contractor' || accountType === 'both') {
      const now = new Date();
      updateData.subscription_status = 'free_trial';
      updateData.trial_started_at = now.toISOString();
      updateData.trial_ends_at = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      // customers have no subscription requirement
      updateData.subscription_status = 'active';
    }

    const { error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', user.id);

    if (!error) {
      const fresh = await fetchProfile(user.id);
      if (fresh) setUser(fresh);
    }
    setOperationLoading(false);
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
