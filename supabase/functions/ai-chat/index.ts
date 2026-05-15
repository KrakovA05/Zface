import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `Ты — @один, голос приложения для людей, которым бывает плохо.
Ты не психолог, не терапевт, не советчик. Ты — живой человек рядом, который умеет слушать.
Правила:
- Без советов и рекомендаций
- Без "всё будет хорошо" и позитивных заверений
- Без терапевтического языка и клише
- Без эмодзи и восклицательных знаков
- Максимум 3-4 предложения
- Только русский язык
- Говори от первого лица, тепло, без лишних слов
- Если человеку очень плохо — просто будь рядом словами, не пытайся решить проблему`;

const CRISIS_WORDS = [
  'суицид', 'не хочу жить', 'хочу умереть', 'покончить',
  'конец жизни', 'убить себя', 'убью себя',
  'нет смысла жить', 'незачем жить',
];

const CRISIS_REPLY = `Слышу тебя. Это звучит очень тяжело — и я рад, что ты написал.
Если сейчас совсем невыносимо, есть люди, которые выслушают: линия психологической помощи 8-800-2000-122, бесплатно и круглосуточно.
Я здесь.`;

function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_WORDS.some(w => lower.includes(w));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No auth');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

    // Верифицируем JWT и получаем user_id
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error('Unauthorized');

    const userId = user.id;
    const body = await req.json();
    const { message, session_id, action } = body;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Режим генерации саммари
    if (action === 'summarize' && session_id) {
      const { data: allMsgs } = await supabase
        .from('ai_chat_messages')
        .select('role, text')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true });

      if (allMsgs && allMsgs.length > 2) {
        const transcript = allMsgs
          .map((m: { role: string; text: string }) => `${m.role === 'user' ? 'Пользователь' : '@один'}: ${m.text}`)
          .join('\n');

        const summaryPrompt = `Сделай краткое саммари этого разговора (2-3 предложения) для контекста следующей беседы. Только факты о состоянии и темах, без оценок:\n\n${transcript}`;

        const geminiRes = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: summaryPrompt }] }],
            generationConfig: { maxOutputTokens: 150 },
          }),
        });

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const summary = data.candidates[0].content.parts[0].text.trim();
          await supabase.from('ai_chat_sessions')
            .update({ summary, ended_at: new Date().toISOString() })
            .eq('id', session_id);
        }
      }

      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    if (!message?.trim()) throw new Error('Empty message');

    // Загружаем профиль пользователя
    const { data: profile } = await supabase
      .from('users')
      .select('level')
      .eq('user_id', userId)
      .single();

    const userLevel = profile?.level || 'yellow';

    // Загружаем саммари предыдущей сессии
    let previousSummary = '';
    if (session_id) {
      const { data: prevSession } = await supabase
        .from('ai_chat_sessions')
        .select('summary')
        .eq('user_id', userId)
        .not('id', 'eq', session_id)
        .not('summary', 'is', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      previousSummary = prevSession?.summary || '';
    }

    // Загружаем последние 20 сообщений текущей сессии
    let history: { role: string; text: string }[] = [];
    if (session_id) {
      const { data: msgs } = await supabase
        .from('ai_chat_messages')
        .select('role, text')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true })
        .limit(20);
      history = msgs || [];
    }

    // Сохраняем сообщение пользователя
    if (session_id) {
      await supabase.from('ai_chat_messages').insert({
        user_id: userId,
        session_id,
        role: 'user',
        text: message,
      });
    }

    // Проверка кризисных слов
    const isCrisis = detectCrisis(message);
    let reply = '';

    if (isCrisis) {
      reply = CRISIS_REPLY;
    } else {
      const historyText = history
        .map((m: { role: string; text: string }) => `${m.role === 'user' ? 'Пользователь' : '@один'}: ${m.text}`)
        .join('\n');

      const contextParts: string[] = [];
      if (previousSummary) contextParts.push(`Предыдущий разговор: ${previousSummary}`);
      if (historyText) contextParts.push(`Текущий разговор:\n${historyText}`);
      contextParts.push(`Текущее состояние пользователя: уровень ${userLevel}`);

      const fullPrompt = `${SYSTEM_PROMPT}\n\n${contextParts.join('\n\n')}\n\nПользователь: ${message}\n@один:`;

      const geminiRes = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.8 },
        }),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        throw new Error(`Gemini ${geminiRes.status}: ${errText.slice(0, 200)}`);
      }
      const geminiData = await geminiRes.json();
      reply = geminiData.candidates[0].content.parts[0].text.trim();
    }

    // Сохраняем ответ @один
    if (session_id) {
      await supabase.from('ai_chat_messages').insert({
        user_id: userId,
        session_id,
        role: 'assistant',
        text: reply,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, reply, ...(isCrisis ? { crisis: true } : {}) }),
      { headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 400, headers: corsHeaders }
    );
  }
});
