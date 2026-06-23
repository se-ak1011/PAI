import Constants from 'expo-constants';

export interface AIQuoteResult {
  scope: string;
  materials: { name: string; qty: number; unit: string; estimatedPrice: number }[];
  labourEstimate: { days: number; dayRateFrom: number; totalFrom: number };
  totalEstimate: { materialsTotal: number; labourTotal: number; grandTotal: number };
  notes: string;
}

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || (Constants.expoConfig?.extra as any)?.supabaseUrl || '';
const SUPABASE_ANON =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || (Constants.expoConfig?.extra as any)?.supabaseAnonKey || '';

/**
 * Call a Supabase Edge Function with a plain fetch (anon key auth). We avoid
 * supabase.functions.invoke here: on the New Architecture that path crashed
 * (native TurboModule interop SIGSEGV). A direct fetch is simpler and robust.
 */
export async function callEdgeFunction<T>(name: string, body: unknown): Promise<{ data: T | null; error: string | null }> {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return { data: null, error: 'Supabase is not configured.' };
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify(body),
    });
    let json: any = null;
    try { json = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok) return { data: null, error: json?.error || `Request failed (${res.status})` };
    if (json?.error) return { data: null, error: String(json.error) };
    return { data: (json?.data ?? null) as T, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function generateAIQuote(params: {
  jobTitle: string;
  jobDescription: string;
  trade?: string;
  budget?: number;
  city?: string;
  dayRate?: number;
  hourlyRate?: number;
  preferredShop?: string;
  flexiblePricing?: boolean;
}): Promise<{ data: AIQuoteResult | null; error: string | null }> {
  return callEdgeFunction<AIQuoteResult>('ai-quote', params);
}
