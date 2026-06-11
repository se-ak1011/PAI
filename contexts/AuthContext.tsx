import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { getSupabaseClient } from '@/template';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

export type UserRole = 'contractor' | 'customer' | 'both';

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
  city?: string;
  postcode_area?: string;
  avatar_url?: string;
  tax_rate?: number;
  available?: boolean;
  onboarding_complete?: boolean;
  preferred_shop?: string;
  hourly_rate?: number;
  flexible_pricing?: boolean;
  customer_profile_complete?: boolean;
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
    return {
      id: data.id,
      email: data.email,
      username: data.username,
      display_name: data.username || data.email?.split('@')[0],
      account_type: (data.account_type as UserRole) ?? 'contractor',
      business_name: data.business_name,
      bio: data.bio,
      trades: data.trades || [],
      hourly_rate_from: data.hourly_rate_from,
      city: data.city,
      postcode_area: data.postcode_area,
      avatar_url: data.avatar_url,
      tax_rate: data.tax_rate ?? 30,
      available: data.available ?? true,
      onboarding_complete: data.onboarding_complete ?? false,
      preferred_shop: data.preferred_shop,
      hourly_rate: data.hourly_rate,
      flexible_pricing: data.flexible_pricing ?? false,
      customer_profile_complete: data.customer_profile_complete ?? false,
    };
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setUser(profile);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setUser(profile);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
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
    // Set a temporary profile so onboarding can read account_type
    if (data.user) {
      setUser({
        id: data.user.id,
        email,
        display_name: name,
        account_type: accountType,
        onboarding_complete: false,
      });
    }
    return { error: null };
  };

  const signInWithGoogle = async (role: UserRole = 'contractor'): Promise<{ error: string | null }> => {
    setOperationLoading(true);
    // Store intended role so the auth state change handler can apply it after OAuth redirect
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: undefined,
          queryParams: {
            // Pass role as a hint; onboarding will confirm it
            prompt: 'select_account',
          },
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

  const completeOnboarding = async (data: Partial<UserProfile>) => {
    if (!user) return;
    setOperationLoading(true);
    const updateData: Record<string, unknown> = {
      onboarding_complete: true,
      account_type: data.account_type || user.account_type,
    };
    if (data.display_name) updateData.username = data.display_name;
    if (data.business_name) updateData.business_name = data.business_name;
    if (data.city) updateData.city = data.city;
    if (data.postcode_area) updateData.postcode_area = data.postcode_area;
    if (data.bio) updateData.bio = data.bio;
    if (data.trades) updateData.trades = data.trades;
    if (data.hourly_rate_from !== undefined) updateData.hourly_rate_from = data.hourly_rate_from;
    if (data.tax_rate) updateData.tax_rate = data.tax_rate;

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
    if (data.display_name) updateData.username = data.display_name;
    if (data.business_name !== undefined) updateData.business_name = data.business_name;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.postcode_area !== undefined) updateData.postcode_area = data.postcode_area;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.trades !== undefined) updateData.trades = data.trades;
    if (data.hourly_rate_from !== undefined) updateData.hourly_rate_from = data.hourly_rate_from;
    if (data.tax_rate !== undefined) updateData.tax_rate = data.tax_rate;
    if (data.available !== undefined) updateData.available = data.available;
    if (data.preferred_shop !== undefined) updateData.preferred_shop = data.preferred_shop;
    if (data.hourly_rate !== undefined) updateData.hourly_rate = data.hourly_rate;
    if (data.flexible_pricing !== undefined) updateData.flexible_pricing = data.flexible_pricing;
    if (data.customer_profile_complete !== undefined) updateData.customer_profile_complete = data.customer_profile_complete;

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
      completeOnboarding,
      updateProfile,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
