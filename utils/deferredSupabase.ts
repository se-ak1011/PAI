import type { SupabaseClient } from '@supabase/supabase-js';

export type DeferredSupabaseClient = SupabaseClient;

// Defer work to just after the first paint. We intentionally DON'T use
// InteractionManager.runAfterInteractions here: on the New Architecture it can be
// delayed (sometimes indefinitely) by ongoing animations, which stalled startup
// (client + auth never initialised → endless loading screen). A short timeout
// runs after the initial render without blocking paint.
export function deferUntilAfterFirstPaint(task: () => void) {
  const timeoutId = setTimeout(task, 1);
  return () => clearTimeout(timeoutId);
}

export async function getDeferredSupabaseClient(): Promise<SupabaseClient> {
  const { getSupabaseClient } = await import('@/template/core');
  return getSupabaseClient();
}
