import { InteractionManager } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';

export type DeferredSupabaseClient = SupabaseClient;

export function deferUntilAfterFirstPaint(task: () => void) {
  const timeoutId = setTimeout(() => {
    InteractionManager.runAfterInteractions(task);
  }, 0);

  return () => clearTimeout(timeoutId);
}

export async function getDeferredSupabaseClient(): Promise<SupabaseClient> {
  const { getSupabaseClient } = await import('@/template/core');
  return getSupabaseClient();
}
