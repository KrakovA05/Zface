import { supabase } from '../supabase';
import { WEEKLY_TEST_ROTATION } from './psychTests';

// Маппинг current_focus → предпочтительный тест
const FOCUS_TEST_MAP = {
  anxiety:     'gad7',
  loneliness:  'ucla3',
  burnout:     'olbi_short',
  self_esteem: 'rosenberg',
  stress:      'pss4',
  apathy:      'aes_short',
};

// Возвращает testId следующего теста для пользователя или null если ничего не нужно
export async function getNextTestId(userId) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - mondayOffset);
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Получить current_focus пользователя
  const { data: userData } = await supabase
    .from('users')
    .select('current_focus')
    .eq('user_id', userId)
    .maybeSingle();
  const currentFocus = userData?.current_focus;

  const { data: results } = await supabase
    .from('psych_test_results')
    .select('test_id, created_at')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())
    .order('created_at', { ascending: false });

  const passedThisMonth = new Set((results || []).map(r => r.test_id));
  const passedThisWeek = new Set(
    (results || [])
      .filter(r => new Date(r.created_at) >= startOfWeek)
      .map(r => r.test_id)
  );

  // Профильные — если ни разу не проходил (приоритет выше ежемесячных)
  const { data: allResults } = await supabase
    .from('psych_test_results')
    .select('test_id')
    .eq('user_id', userId)
    .in('test_id', ['ecr_short', 'mini_spin']);

  const passedEver = new Set((allResults || []).map(r => r.test_id));
  for (const tid of ['ecr_short', 'mini_spin']) {
    if (!passedEver.has(tid)) return tid;
  }

  // Ежемесячные — в первые 3 дня месяца
  if (now.getDate() <= 3) {
    for (const tid of ['olbi_short', 'rosenberg']) {
      if (!passedThisMonth.has(tid)) return tid;
    }
  }

  // Еженедельные — один тест в неделю по ротации с учётом current_focus
  if (passedThisWeek.size < 1) {
    const { data: allWeekly } = await supabase
      .from('psych_test_results')
      .select('test_id, created_at')
      .eq('user_id', userId)
      .in('test_id', WEEKLY_TEST_ROTATION)
      .order('created_at', { ascending: false });

    const lastPassed = {};
    for (const r of allWeekly || []) {
      if (!lastPassed[r.test_id]) lastPassed[r.test_id] = new Date(r.created_at);
    }

    // Если есть preferred тест по фокусу и он ещё не пройден на этой неделе
    const preferredTest = currentFocus ? FOCUS_TEST_MAP[currentFocus] : null;
    if (preferredTest && WEEKLY_TEST_ROTATION.includes(preferredTest) && !passedThisWeek.has(preferredTest)) {
      return preferredTest;
    }

    // Иначе — стандартная ротация по давности
    const sorted = [...WEEKLY_TEST_ROTATION].sort((a, b) => {
      const ta = lastPassed[a] || new Date(0);
      const tb = lastPassed[b] || new Date(0);
      return ta - tb;
    });
    return sorted[0];
  }

  return null;
}
