import { supabase } from '../supabase';
import { store } from '../store';

export function initCrashReporting() {
  if (typeof ErrorUtils === 'undefined' || typeof ErrorUtils.getGlobalHandler !== 'function') return;

  const prev = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      supabase.from('crash_logs').insert({
        user_id: store.userId || null,
        message: error?.message || String(error),
        stack: error?.stack || null,
        is_fatal: !!isFatal,
      }).then();
    } catch {}
    prev?.(error, isFatal);
  });
}
