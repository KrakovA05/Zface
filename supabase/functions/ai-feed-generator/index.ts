import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `Ты — голос приложения !один. Пишешь короткие искренние посты для людей, которым бывает плохо.
Правила: без советов, без "всё будет хорошо", без эмодзи, без восклицательных знаков, без терапевтического языка.
Максимум 2-3 предложения. Только русский язык. Говори как живой человек, не как психолог.
Отвечай ТОЛЬКО валидным JSON-массивом без markdown-блоков.`;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }],
      }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

function parseJson(raw: string): { text: string; type: string }[] {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

async function generatePostsForLevel(
  level: string,
  apiKey: string,
): Promise<{ text: string; level: string }[]> {
  const prompts: Record<string, string> = {
    red: `Напиши 3 коротких поста для людей, которым сейчас очень плохо (уровень red).
2 поста — валидация чувств (без советов, без позитива). 1 пост — открытый вопрос для обсуждения.
Формат: JSON-массив [{"text": "...", "type": "validation"}, {"text": "...", "type": "validation"}, {"text": "...", "type": "question"}]`,

    yellow: `Напиши 3 коротких поста для людей, которым тяжеловато (уровень yellow).
1-2 поста — мягкая валидация. 1-2 поста — вопрос с мягким приглашением ответить.
Формат: JSON-массив из 3 объектов [{"text": "...", "type": "validation"}, ...]`,

    green: `Напиши 3 коротких поста для людей с уровнем green (относительно норм, но бывает непросто).
1-2 поста — прямой вопрос к диалогу. 1 пост — незаконченная фраза ("Сегодня мне легче, потому что...").
Формат: JSON-массив из 3 объектов [{"text": "...", "type": "question"}, {"text": "...", "type": "phrase"}, ...]`,
  };

  const raw = await callGemini(prompts[level], apiKey);
  const items = parseJson(raw);
  return items
    .filter((i) => i.text && i.text.length > 5)
    .slice(0, 3)
    .map((i) => ({ text: i.text.slice(0, 500), level }));
}

async function generateCrossLevelPosts(
  apiKey: string,
): Promise<{ text: string; level: string }[]> {
  const prompt = `Напиши 2 коротких поста, которые одинаково откликнутся людям разного состояния — от "норм" до "очень плохо".
Без совета, без позитива, честно. Вопрос или мысль.
Формат: JSON-массив [{"text": "...", "type": "question"}, {"text": "...", "type": "question"}]`;

  const raw = await callGemini(prompt, apiKey);
  const items = parseJson(raw);
  return items
    .filter((i) => i.text && i.text.length > 5)
    .slice(0, 2)
    .map((i) => ({ text: i.text.slice(0, 500), level: 'all' }));
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret) {
    const auth = req.headers.get('Authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set');
    return new Response(JSON.stringify({ ok: false, error: 'GEMINI_API_KEY not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Пропустить если уже генерировали сегодня
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('feed_posts')
    .select('id')
    .eq('author_id', SYSTEM_USER_ID)
    .gte('created_at', since)
    .limit(1);

  if (existing && existing.length > 0) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: 'already generated today' }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const redPosts = await generatePostsForLevel('red', apiKey);
    const yellowPosts = await generatePostsForLevel('yellow', apiKey);
    const greenPosts = await generatePostsForLevel('green', apiKey);
    const crossPosts = await generateCrossLevelPosts(apiKey);

    const allPosts = [...redPosts, ...yellowPosts, ...greenPosts, ...crossPosts];
    const rows = allPosts.map((p) => ({
      author_id: SYSTEM_USER_ID,
      author_username: '@один',
      author_level: p.level === 'all' ? 'green' : p.level,
      text: p.text,
      target_levels: p.level === 'all' ? ['green', 'yellow', 'red'] : [p.level],
      likes: 0,
      media_url: null,
    }));

    const { error } = await supabase.from('feed_posts').insert(rows);
    if (error) {
      console.error('Insert error:', error.message);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ai-feed-generator error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
