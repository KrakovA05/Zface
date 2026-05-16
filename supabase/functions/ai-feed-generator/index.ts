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

async function generateResourcePosts(
  apiKey: string,
): Promise<{ text: string; level: string; link_url: string; link_title: string }[]> {
  const { data: articles } = await supabase
    .from('resources')
    .select('title, url, topic')
    .eq('type', 'article')
    .limit(50);

  if (!articles || articles.length === 0) return [];

  // случайные 2 статьи
  const shuffled = articles.sort(() => Math.random() - 0.5).slice(0, 2);

  const results: { text: string; level: string; link_url: string; link_title: string }[] = [];
  for (const article of shuffled) {
    const prompt = `Напиши 1-2 предложения — почему эта статья может быть полезна кому-то, кому сейчас непросто. Не пересказывай, не советуй. Просто честно, как живой человек. Только текст, без кавычек.
Статья: "${article.title}", тема: "${article.topic}"`;
    const intro = await callGemini(prompt, apiKey);
    results.push({
      text: intro.trim().slice(0, 300),
      level: 'all',
      link_url: article.url,
      link_title: article.title,
    });
  }
  return results;
}

async function detectWorseningGroup(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 4);

  const { data: results } = await supabase
    .from('test_results')
    .select('user_id, level, created_at')
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true });

  if (!results || results.length === 0) return false;

  const byUser: Record<string, { level: string; created_at: string }[]> = {};
  for (const r of results) {
    if (!byUser[r.user_id]) byUser[r.user_id] = [];
    byUser[r.user_id].push(r);
  }

  const levelOrder: Record<string, number> = { green: 2, yellow: 1, red: 0 };
  let worseningCount = 0;

  for (const uid of Object.keys(byUser)) {
    const userResults = byUser[uid].sort(
      (a: { created_at: string }, b: { created_at: string }) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    if (userResults.length < 3) continue;

    const last3 = userResults.slice(-3);
    const scores = last3.map((r: { level: string }) => levelOrder[r.level] ?? 1);
    if (scores[0] > scores[1] && scores[1] >= scores[2]) worseningCount++;
  }

  return worseningCount >= 3;
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

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set');
    return new Response(JSON.stringify({ ok: false, error: 'GEMINI_API_KEY not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Детекция паттернов ухудшения
  const hasWorseningGroup = await detectWorseningGroup(supabase);
  if (hasWorseningGroup) {
    const supportPrompt = `Напиши 1 очень короткий пост (1-2 предложения) для людей, у которых несколько дней подряд ухудшается состояние.
Тон: тепло, без советов, без позитива. Признание что это тяжело — и всё.
Формат: JSON-объект {"text": "..."}`;

    try {
      const raw = await callGemini(supportPrompt, apiKey);
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.text) {
        await supabase.from('feed_posts').insert({
          author_id: SYSTEM_USER_ID,
          author_username: '@один',
          author_level: 'red',
          text: parsed.text,
          target_levels: ['red', 'yellow'],
          likes: 0,
          link_url: null,
          link_title: null,
        });
      }
    } catch {
      // не критично
    }
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
    const resourcePosts = await generateResourcePosts(apiKey);

    type PostInput = { text: string; level: string; link_url?: string; link_title?: string };
    const allPosts: PostInput[] = [...redPosts, ...yellowPosts, ...greenPosts, ...crossPosts, ...resourcePosts];
    const rows = allPosts.map((p) => ({
      author_id: SYSTEM_USER_ID,
      author_username: '@один',
      author_level: p.level === 'all' ? 'green' : p.level,
      text: p.text,
      target_levels: p.level === 'all' ? ['green', 'yellow', 'red'] : [p.level],
      likes: 0,
      media_url: null,
      link_url: p.link_url ?? null,
      link_title: p.link_title ?? null,
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
