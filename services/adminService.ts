import Constants from 'expo-constants';
import { getSupabaseClient } from '@/template/core';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || (Constants.expoConfig?.extra as any)?.supabaseUrl || '';
const SUPABASE_ANON =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || (Constants.expoConfig?.extra as any)?.supabaseAnonKey || '';

/** Is the signed-in user an admin? Reads their own (and only their own) row. */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  return !error && !!data;
}

/**
 * Call the `admin` Edge Function authenticated as the CURRENT USER (not the anon
 * key) so the function can verify admin status server-side. Plain fetch (we avoid
 * functions.invoke on the New Architecture).
 */
async function callAdmin<T>(action: string, payload?: unknown): Promise<{ data: T | null; error: string | null }> {
  if (!SUPABASE_URL) return { data: null, error: 'Supabase is not configured.' };
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { data: null, error: 'You must be signed in.' };

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, payload }),
    });
    let json: any = null;
    try { json = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok) return { data: null, error: json?.error || `Request failed (${res.status})` };
    if (json?.error) return { data: null, error: String(json.error) };
    return { data: (json?.data ?? json ?? null) as T, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function adminListDisputes() {
  return callAdmin<any[]>('list_disputes');
}

export async function adminResolveDispute(id: string, outcome: 'release_to_contractor' | 'refund_customer', note: string) {
  return callAdmin<{ ok: boolean }>('resolve_dispute', { id, outcome, note });
}

export async function adminListReviews() {
  return callAdmin<any[]>('list_reviews');
}

export async function adminModerateReview(id: string, status: 'published' | 'removed') {
  return callAdmin<{ ok: boolean }>('moderate_review', { id, status });
}
