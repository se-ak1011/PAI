import { getSupabaseClient } from '@/template/core';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface AIQuoteResult {
  scope: string;
  materials: { name: string; qty: number; unit: string; estimatedPrice: number }[];
  labourEstimate: { days: number; dayRateFrom: number; totalFrom: number };
  totalEstimate: { materialsTotal: number; labourTotal: number; grandTotal: number };
  notes: string;
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
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.functions.invoke('ai-quote', {
    body: params,
  });

  if (error) {
    let errorMessage = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const statusCode = error.context?.status ?? 500;
        const textContent = await error.context?.text();
        errorMessage = `[Code: ${statusCode}] ${textContent || error.message || 'Unknown error'}`;
      } catch {
        errorMessage = error.message || 'Failed to read response';
      }
    }
    return { data: null, error: errorMessage };
  }

  return { data: data?.data || null, error: null };
}
