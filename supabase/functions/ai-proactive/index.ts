import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 120,
      temperature: 0.9,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function sendPush(token: string, text: string, messageId: string) {
  if (!token) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title: '@один',
      body: text,
      sound: 'default',
      data: { screen: 'AiChat', proactiveMessageId: messageId },
    }),
  }).catch(() => {});
}

interface UserRow {
  user_id: string;
  level: string;
  push_token: string | null;
  current_focus: string | null;
}

interface MetricsRow {
  dominant_dimension: string | null;
  anxiety_score: number | null;
  burnout_score: number | null;
}

async function buildContext(userId: string, level: string): Promise<string> {
  const [{ data: metrics }, { data: moods }] = await Promise.all([
    supabase.from('user_metrics')
      .select('dominant_dimension, anxiety_score, burnout_score')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('mood_checkins')
      .select('score')
      .eq('user_id', userId)
      .order('checkin_date', { ascending: false })
      .limit(7),
  ]);

  const VALID_DIMENSIONS = new Set(['anxiety', 'stress', 'apathy', 'loneliness', 'burnout', 'self_esteem', 'social_anxiety', 'attachment']);

  const m = metrics as MetricsRow | null;
  const parts: string[] = [`уровень ${level}`];

  if (m?.dominant_dimension && VALID_DIMENSIONS.has(m.dominant_dimension)) {
    parts.push(`доминирует ${m.dominant_dimension}`);
  }
  if (m?.burnout_score != null && m.burnout_score > 65) parts.push(`выгорание ${m.burnout_score}/100`);
  if (m?.anxiety_score != null && m.anxiety_score > 65) parts.push(`тревога ${m.anxiety_score}/100`);

  if (moods && moods.length >= 3) {
    const scores = (moods as { score: number }[]).map(x => x.score);
    const trend = scores[0] < scores[scores.length - 1] - 1 ? 'настроение падает' : 'настроение стабильно';
    parts.push(trend);
  }

  return parts.join(', ');
}

async function generateMessage(context: string, triggerReason: string): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const triggerHints: Record<string, string> = {
    level_red: 'Пользователь только что получил уровень red — ему сейчас очень плохо.',
    high_anxiety: 'Тест показал высокую тревогу.',
    high_burnout: 'Тест показал сильное выгорание.',
    scheduled: '',
  };

  const prompt = `Ты — @один, голос приложения !один для людей которым бывает плохо.
Напиши ОДНО короткое сообщение (1-2 предложения) пользователю. Это сообщение придёт ему как уведомление.
Правила: без советов, без "всё будет хорошо", без "ты не один", без эмодзи, без восклицательных знаков.
Говори как живой человек который просто решил написать — не как психолог и не как бот.
${triggerHints[triggerReason] || ''}
Контекст пользователя: ${context}
Ответь ТОЛЬКО текстом сообщения, без кавычек и пояснений.`;

  return callGroq(prompt, apiKey);
}

async function hasSentRecently(userId: string, type: 'scheduled' | 'triggered'): Promise<boolean> {
  const hours = type === 'scheduled' ? 48 : 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('ai_proactive_messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', type)
    .gte('created_at', since);
  return (count ?? 0) > 0;
}

async function sendProactiveMessage(
  user: UserRow,
  type: 'scheduled' | 'triggered',
  triggerReason: string,
) {
  if (await hasSentRecently(user.user_id, type)) return;

  const context = await buildContext(user.user_id, user.level);
  const text = await generateMessage(context, triggerReason);

  const { data: inserted } = await supabase
    .from('ai_proactive_messages')
    .insert({
      user_id: user.user_id,
      text,
      type,
      trigger_reason: triggerReason,
      push_sent: !!user.push_token,
    })
    .select('id')
    .single();

  if (user.push_token && inserted?.id) {
    await sendPush(user.push_token, text, inserted.id);
    await supabase.from('ai_proactive_messages')
      .update({ push_sent: true })
      .eq('id', inserted.id);
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, x-trigger-type, x-webhook-secret' } });
  }

  // Проверка авторизации
  const cronSecret = Deno.env.get('CRON_SECRET');
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  const triggerType = req.headers.get('x-trigger-type');
  const authHeader = req.headers.get('Authorization') || req.headers.get('x-webhook-secret') || '';

  if (triggerType === 'cron') {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
  } else if (triggerType === 'webhook') {
    if (!webhookSecret || authHeader !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
  } else {
    return new Response(JSON.stringify({ error: 'Missing x-trigger-type header' }), { status: 400, headers: corsHeaders });
  }

  try {
    if (triggerType === 'cron') {
      // Плановый режим: берём активных пользователей без недавних сообщений
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: users } = await supabase
        .from('users')
        .select('user_id, level, push_token, current_focus')
        .gte('last_seen', sevenDaysAgo)
        .not('push_token', 'is', null)
        .limit(50);

      let sent = 0;
      for (const user of (users as UserRow[]) || []) {
        try {
          await sendProactiveMessage(user, 'scheduled', 'scheduled');
          sent++;
        } catch (e) {
          console.error(`Error for user ${user.user_id}:`, e);
        }
      }

      return new Response(JSON.stringify({ ok: true, sent }), { headers: corsHeaders });

    } else {
      // Webhook режим: реагируем на конкретное событие
      const payload = await req.json();
      const record = payload?.record;
      const oldRecord = payload?.old_record;

      if (!record?.user_id) {
        return new Response(JSON.stringify({ ok: true, skip: 'no user_id' }), { headers: corsHeaders });
      }

      const userId = record.user_id;

      // Определяем триггер
      let triggerReason: string | null = null;

      if (record.level === 'red' && oldRecord?.level && oldRecord.level !== 'red') {
        // test_results: уровень сменился на red
        triggerReason = 'level_red';
      } else if (record.normalized_score != null && record.test_id != null) {
        // psych_test_results: высокий балл
        if (record.normalized_score > 70 && record.test_id === 'gad7') {
          triggerReason = 'high_anxiety';
        } else if (record.normalized_score > 70 && record.test_id === 'olbi_short') {
          triggerReason = 'high_burnout';
        }
      }

      if (!triggerReason) {
        return new Response(JSON.stringify({ ok: true, skip: 'no trigger condition met' }), { headers: corsHeaders });
      }

      const { data: user } = await supabase
        .from('users')
        .select('user_id, level, push_token, current_focus')
        .eq('user_id', userId)
        .maybeSingle();

      if (!user || !user.push_token) {
        return new Response(JSON.stringify({ ok: true, skip: 'no push token' }), { headers: corsHeaders });
      }

      await sendProactiveMessage(user as UserRow, 'triggered', triggerReason);
      return new Response(JSON.stringify({ ok: true, triggered: triggerReason }), { headers: corsHeaders });
    }
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
