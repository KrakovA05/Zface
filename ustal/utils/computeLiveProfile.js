import { supabase } from '../supabase';

const DIMENSION_WEIGHTS = {
  anxiety: 0.20, stress: 0.20, apathy: 0.15, loneliness: 0.15,
  burnout: 0.10, self_esteem: 0.10, social_anxiety: 0.05, attachment: 0.05,
};

function norm(value, min, max) {
  if (max === min) return 0;
  return Math.round(Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)));
}

export async function computeLiveProfile(uid) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekStartIso = weekStart.toISOString();
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const [
    { data: psychResults },
    { count: msgCount },
    { data: dmData },
    { data: nightMsgData },
    { count: checkinCount },
    { data: checkinScoreData },
    { count: helpsCount },
  ] = await Promise.all([
    supabase.from('psych_test_results')
      .select('dimension, normalized_score, created_at')
      .eq('user_id', uid).gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false }),
    supabase.from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', uid).gte('created_at', weekStartIso),
    supabase.from('direct_messages')
      .select('conversation_id')
      .eq('sender_id', uid).gte('created_at', weekStartIso),
    supabase.from('messages')
      .select('created_at')
      .eq('sender_id', uid).gte('created_at', weekStartIso),
    supabase.from('mood_checkins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid).gte('checkin_date', weekStartStr),
    supabase.from('mood_checkins')
      .select('score')
      .eq('user_id', uid).gte('checkin_date', weekStartStr)
      .order('checkin_date', { ascending: true }),
    supabase.from('user_helps')
      .select('*', { count: 'exact', head: true })
      .eq('helped_id', uid).gte('created_at', weekStartIso),
  ]);

  const testScores = {};
  for (const r of psychResults ?? []) {
    if (!testScores[r.dimension]) testScores[r.dimension] = r.normalized_score;
  }

  const uniqueConvs = new Set((dmData ?? []).map(d => d.conversation_id)).size;
  const nightCount = (nightMsgData ?? []).filter(m => {
    const h = new Date(m.created_at).getHours();
    return h >= 0 && h < 5;
  }).length;
  const checkinScores = (checkinScoreData ?? []).map(c => c.score);
  const checkinTrend = checkinScores.length >= 2
    ? checkinScores[checkinScores.length - 1] - checkinScores[0]
    : 0;

  const behavioralScores = {
    anxiety:        norm(nightCount, 0, 10),
    stress:         norm(Math.max(0, 7 - (checkinCount ?? 0)), 0, 7),
    loneliness:     norm(Math.max(0, 5 - uniqueConvs), 0, 5),
    apathy:         norm(Math.max(0, 7 - Math.min(7, msgCount ?? 0)), 0, 7),
    self_esteem:    Math.max(0, 100 - norm(helpsCount ?? 0, 0, 5)),
    burnout:        checkinTrend < -2 ? 70 : checkinTrend < 0 ? 40 : 20,
    social_anxiety: norm(Math.max(0, 10 - (msgCount ?? 0)), 0, 10),
    attachment:     testScores['attachment'] ?? 50,
  };

  const dimensionScores = {};
  for (const dim of Object.keys(DIMENSION_WEIGHTS)) {
    const hasTest = testScores[dim] !== undefined;
    const testScore = testScores[dim] ?? behavioralScores[dim] ?? 50;
    const behavScore = behavioralScores[dim] ?? testScore;
    dimensionScores[dim] = Math.round(
      hasTest ? testScore * 0.6 + behavScore * 0.4 : behavScore
    );
  }

  let composite = 0;
  for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    composite += (dimensionScores[dim] ?? 50) * weight;
  }
  composite = Math.round(composite);

  const dominant = Object.entries(dimensionScores)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'stress';

  return {
    anxiety_score:        dimensionScores.anxiety,
    stress_score:         dimensionScores.stress,
    apathy_score:         dimensionScores.apathy,
    loneliness_score:     dimensionScores.loneliness,
    burnout_score:        dimensionScores.burnout,
    self_esteem_score:    dimensionScores.self_esteem,
    social_anxiety_score: dimensionScores.social_anxiety,
    attachment_score:     dimensionScores.attachment,
    composite_score:      composite,
    dominant_dimension:   dominant,
    week_start:           weekStartStr,
  };
}
