import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type WebhookPayload = {
  type: 'INSERT';
  table: 'post_comments';
  schema: 'public';
  record: {
    id: string;
    post_id: string;
    author_id: string;
    author_username: string;
    author_level: string;
    text: string;
    created_at: string;
  };
  old_record: null;
};

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `Ты — голос приложения !один. Отвечаешь на комментарии людей, которым бывает плохо.
Правила: без советов, без "всё будет хорошо", без эмодзи, без восклицательных знаков, без терапевтического языка.
Максимум 1-2 предложения. Только русский язык. Реагируй честно, как живой человек рядом — не как психолог.
Отвечай ТОЛЬКО текстом ответа, без кавычек и пояснений.`;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}

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
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim();
}

Deno.serve(async (req) => {
  // Проверка webhook secret
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  if (!webhookSecret) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const incoming = req.headers.get('x-webhook-secret') || req.headers.get('authorization');
  if (incoming !== webhookSecret && incoming !== `Bearer ${webhookSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const payload: WebhookPayload = await req.json();
    const { record } = payload;

    if (!record) {
      return new Response(JSON.stringify({ ok: false, error: 'no record' }), { status: 400 });
    }

    // Не отвечать на свои комментарии
    if (record.author_id === SYSTEM_USER_ID) {
      return new Response(JSON.stringify({ ok: true, skipped: 'own comment' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Проверить что пост написан @один
    const { data: post } = await supabase
      .from('feed_posts')
      .select('author_id, text')
      .eq('id', record.post_id)
      .single();

    if (!post || post.author_id !== SYSTEM_USER_ID) {
      return new Response(JSON.stringify({ ok: true, skipped: 'not system post' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 65% вероятность пропустить
    if (Math.random() > 0.35) {
      return new Response(JSON.stringify({ ok: true, skipped: 'probability' }), {
        headers: { 'Content-Type': 'application/json' },
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

    const safePost = post.text.slice(0, 500).replace(/[`"']/g, '');
    const safeComment = record.text.slice(0, 300).replace(/[`"']/g, '');
    const prompt = `Пост: ${safePost}\nКомментарий пользователя: ${safeComment}\nНапиши короткий ответ. Не советуй, не успокаивай. Реагируй честно, как живой человек рядом. Если не знаешь что сказать — задай один вопрос.`;

    const replyText = await callGemini(prompt, apiKey);

    // Небольшая задержка для естественности (в пределах таймаута Edge Function)
    const delayMs = randomBetween(10_000, 30_000);
    await sleep(delayMs);

    // Вставить ответ
    const { error: insertError } = await supabase.from('post_comments').insert({
      post_id: record.post_id,
      author_id: SYSTEM_USER_ID,
      author_username: '@один',
      author_level: 'green',
      text: replyText.slice(0, 500),
    });

    if (insertError) {
      console.error('Insert error:', insertError.message);
      return new Response(JSON.stringify({ ok: false, error: insertError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Пуш-уведомление автору комментария
    try {
      const { data: user } = await supabase
        .from('users')
        .select('push_token')
        .eq('user_id', record.author_id)
        .single();

      if (user?.push_token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.push_token,
            title: '@один',
            body: 'ответил на твой комментарий',
            data: { postId: record.post_id },
          }),
        });
      }
    } catch (pushErr) {
      console.error('Push error (non-fatal):', pushErr);
    }

    return new Response(JSON.stringify({ ok: true, replied: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ai-comment-reply error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
