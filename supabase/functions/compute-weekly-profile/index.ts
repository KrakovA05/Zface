import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DIMENSION_WEIGHTS: Record<string, number> = {
  anxiety:        0.20,
  stress:         0.20,
  apathy:         0.15,
  loneliness:     0.15,
  burnout:        0.10,
  self_esteem:    0.10,
  social_anxiety: 0.05,
  attachment:     0.05,
};

function scoreToLevel(score: number): string {
  if (score <= 33) return 'green';
  if (score <= 66) return 'yellow';
  return 'red';
}

function norm(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.round(Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)));
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekStartIso = weekStart.toISOString();

  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('user_id');
  if (usersErr) return new Response(JSON.stringify({ error: usersErr.message }), { status: 500 });

  let processed = 0;

  for (const user of users ?? []) {
    const uid = user.user_id;

    // Тестовые баллы (последние за каждое измерение за 30 дней)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: testResults } = await supabase
      .from('psych_test_results')
      .select('dimension, normalized_score, created_at')
      .eq('user_id', uid)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false });

    const testScores: Record<string, number> = {};
    for (const r of testResults ?? []) {
      if (!testScores[r.dimension]) testScores[r.dimension] = r.normalized_score;
    }

    // Поведенческие метрики за эту неделю
    const { count: msgCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', uid)
      .gte('created_at', weekStartIso);

    const { data: dmData } = await supabase
      .from('direct_messages')
      .select('conversation_id')
      .eq('sender_id', uid)
      .gte('created_at', weekStartIso);
    const uniqueConvs = new Set((dmData ?? []).map((d: any) => d.conversation_id)).size;

    const { data: nightMsgs } = await supabase
      .from('messages')
      .select('created_at')
      .eq('sender_id', uid)
      .gte('created_at', weekStartIso);
    const nightCount = (nightMsgs ?? []).filter((m: any) => {
      const h = new Date(m.created_at).getHours();
      return h >= 0 && h < 5;
    }).length;

    const { count: checkinCount } = await supabase
      .from('mood_checkins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .gte('checkin_date', weekStartStr);

    const { data: checkinData } = await supabase
      .from('mood_checkins')
      .select('score')
      .eq('user_id', uid)
      .gte('checkin_date', weekStartStr)
      .order('checkin_date', { ascending: true });
    const checkinScores = (checkinData ?? []).map((c: any) => c.score);
    const checkinTrend = checkinScores.length >= 2
      ? checkinScores[checkinScores.length - 1] - checkinScores[0]
      : 0;

    const { count: helpsCount } = await supabase
      .from('user_helps')
      .select('*', { count: 'exact', head: true })
      .eq('helped_id', uid)
      .gte('created_at', weekStartIso);

    // Поведенческие скоры → 0-100
    const behavioralScores: Record<string, number> = {
      anxiety:        norm(nightCount, 0, 10),
      stress:         norm(Math.max(0, 7 - (checkinCount ?? 0)), 0, 7),
      loneliness:     norm(Math.max(0, 5 - uniqueConvs), 0, 5),
      apathy:         norm(Math.max(0, 7 - Math.min(7, msgCount ?? 0)), 0, 7),
      self_esteem:    Math.max(0, 100 - norm(helpsCount ?? 0, 0, 5)),
      burnout:        checkinTrend < -2 ? 70 : checkinTrend < 0 ? 40 : 20,
      social_anxiety: norm(Math.max(0, 10 - (msgCount ?? 0)), 0, 10),
      attachment:     testScores['attachment'] ?? 50,
    };

    // Итоговый балл по каждому измерению (60% тест + 40% поведение)
    const dimensionScores: Record<string, number> = {};
    for (const dim of Object.keys(DIMENSION_WEIGHTS)) {
      const hasTest = testScores[dim] !== undefined;
      const testScore = testScores[dim] ?? behavioralScores[dim] ?? 50;
      const behavScore = behavioralScores[dim] ?? testScore;
      dimensionScores[dim] = Math.round(hasTest ? testScore * 0.6 + behavScore * 0.4 : behavScore);
    }

    // Композитный скор
    let composite = 0;
    for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
      composite += (dimensionScores[dim] ?? 50) * weight;
    }
    composite = Math.round(composite);

    const dominant = Object.entries(dimensionScores)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'stress';

    const level = scoreToLevel(composite);

    await supabase.from('user_metrics').upsert({
      user_id: uid,
      week_start: weekStartStr,
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
      level,
    }, { onConflict: 'user_id,week_start' });

    await supabase.from('users').update({ level }).eq('user_id', uid);

    processed++;
  }

  return new Response(JSON.stringify({ processed, weekStart: weekStartStr }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
