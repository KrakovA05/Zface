import { supabase } from '../supabase';
import { WEEKLY_TEST_ROTATION } from './psychTests';

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

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const mondayOffset = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - mondayOffset);
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
      .filter(r => r.created_at && new Date(r.created_at) >= startOfWeek)
      .map(r => r.test_id)
  );

  // Уже прошёл тест сегодня — не показываем ничего до завтра
  const passedToday = (results || []).some(r => r.created_at && new Date(r.created_at) >= today);
  if (passedToday) return null;

  // Профильные — если ни разу не проходил (приоритет выше всего)
  const { data: allResults } = await supabase
    .from('psych_test_results')
    .select('test_id')
    .eq('user_id', userId)
    .in('test_id', ['ecr_short', 'mini_spin']);

  const passedEver = new Set((allResults || []).map(r => r.test_id));
  for (const tid of ['ecr_short', 'mini_spin']) {
    if (!passedEver.has(tid)) return tid;
  }

  // Ежемесячные — в любой день месяца если ещё не сданы
  for (const tid of ['olbi_short', 'rosenberg']) {
    if (!passedThisMonth.has(tid)) return tid;
  }

  // Предпочтительный тест по current_focus — если не проходил на этой неделе
  const preferredTest = currentFocus ? FOCUS_TEST_MAP[currentFocus] : null;
  if (preferredTest && !passedThisWeek.has(preferredTest)) {
    const isMonthly = ['olbi_short', 'rosenberg'].includes(preferredTest);
    if (!isMonthly || !passedThisMonth.has(preferredTest)) {
      return preferredTest;
    }
  }

  // Стандартная ротация по давности — следующий непройденный дольше всего
  const { data: allWeekly } = await supabase
    .from('psych_test_results')
    .select('test_id, created_at')
    .eq('user_id', userId)
    .in('test_id', WEEKLY_TEST_ROTATION)
    .order('created_at', { ascending: false });

  const lastPassed = {};
  for (const r of allWeekly || []) {
    if (!lastPassed[r.test_id] && r.created_at) lastPassed[r.test_id] = new Date(r.created_at);
  }

  const sorted = [...WEEKLY_TEST_ROTATION]
    .filter(tid => !passedThisWeek.has(tid))
    .sort((a, b) => {
      const ta = lastPassed[a] || new Date(0);
      const tb = lastPassed[b] || new Date(0);
      return ta - tb;
    });
  return sorted[0] || null;
}
