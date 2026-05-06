import { supabase } from '../supabase';
import { store } from '../store';

export function logEvent(name, properties = {}) {
  try {
    supabase.from('events').insert({
      user_id: store.userId || null,
      event_name: name,
      properties,
    }).then();
  } catch {}
}

export function createNavigationListener(navigationRef) {
  let currentRoute = null;
  return () => {
    const route = navigationRef.current?.getCurrentRoute();
    if (!route || route.name === currentRoute) return;
    currentRoute = route.name;
    logEvent('screen_view', { screen: route.name });
  };
}
