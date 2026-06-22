import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from '@/template/core';

const BUCKET = 'receipts';
const SIGNED_URL_TTL = 60 * 60;

export type ExpenseSplit = 'business' | 'personal' | 'mixed';
export type ExpenseCategory =
  | 'materials' | 'tools' | 'ppe' | 'parking' | 'fuel' | 'clothing' | 'subcontractor' | 'other';

export interface Expense {
  id: string;
  user_id: string;
  job_id: string | null;
  vendor: string | null;
  amount: number;
  category: ExpenseCategory | null;
  split: ExpenseSplit;
  business_pct: number | null;
  confidence: number | null;
  needs_review: boolean;
  receipt_path: string | null;
  note: string | null;
  spent_on: string | null;
  created_at: string;
}

/** AI suggestion shape returned by the (future) ai-receipt Edge Function. */
export interface ReceiptSuggestion {
  vendor?: string;
  amount?: number;
  category?: ExpenseCategory;
  split?: ExpenseSplit;
  business_pct?: number;
  confidence?: number;
  needs_review?: boolean;
  spent_on?: string;
}

/** Deductible portion of an expense (business=full, mixed=pct, personal=0). */
export function deductibleAmount(e: Pick<Expense, 'amount' | 'split' | 'business_pct'>): number {
  if (e.split === 'business') return e.amount;
  if (e.split === 'mixed') return e.amount * ((e.business_pct ?? 50) / 100);
  return 0;
}

/** Pick a receipt image (camera/library), upload to the private receipts bucket. */
export async function pickReceiptImage(
  userId: string,
  source: 'camera' | 'library',
): Promise<{ path: string | null; base64: string | null; error: string | null; cancelled?: boolean }> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { path: null, base64: null, error: 'Camera permission is needed.' };
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { path: null, base64: null, error: 'Photo library permission is needed.' };
  }

  const result = await (source === 'camera'
    ? ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, base64: true })
    : ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true }));

  if (result.canceled || !result.assets?.[0]) return { path: null, base64: null, error: null, cancelled: true };
  const asset = result.assets[0];
  if (!asset.base64) return { path: null, base64: null, error: 'Could not read the image.' };

  const isPng = (asset.mimeType || '').includes('png');
  const ext = isPng ? 'png' : 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, decode(asset.base64), {
    contentType: isPng ? 'image/png' : 'image/jpeg',
    upsert: false,
  });
  if (error) return { path: null, base64: asset.base64, error: error.message };
  return { path, base64: asset.base64, error: null };
}

/**
 * Ask the ai-receipt Edge Function to read a receipt image and suggest fields.
 * No-ops gracefully until the function is deployed (see ROADMAP.md AI steps).
 */
export async function analyzeReceipt(imageBase64: string): Promise<{ data: ReceiptSuggestion | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('ai-receipt', { body: { imageBase64 } });
  if (error) return { data: null, error: error.message };
  if (data?.error) return { data: null, error: String(data.error) };
  return { data: (data?.data ?? null) as ReceiptSuggestion | null, error: null };
}

export async function listExpenses(userId: string): Promise<Expense[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Expense[];
}

export async function addExpense(
  expense: Omit<Expense, 'id' | 'created_at'>,
): Promise<{ data: Expense | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('expenses').insert(expense).select().single();
  if (error) return { data: null, error: error.message };
  return { data: data as Expense, error: null };
}

export async function deleteExpense(id: string, receiptPath?: string | null): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (receiptPath) await supabase.storage.from(BUCKET).remove([receiptPath]);
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  return !error;
}

export async function getReceiptUrl(path: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data) return null;
  return data.signedUrl;
}
