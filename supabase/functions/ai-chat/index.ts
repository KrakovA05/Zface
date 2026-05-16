import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `Ты — @один, голос приложения для людей, которым бывает плохо.
Ты не психолог, но ты умный, тёплый собеседник. Ты умеешь слушать и умеешь говорить честно.
Принципы:
- Отвечай на то, что тебя спрашивают. Просят совет — дай. Хотят просто поговорить — говори.
- Без клише ("всё будет хорошо", "держись", "ты не один") — только живые слова
- Без эмодзи и восклицательных знаков
- Максимум 4-5 предложений
- Только русский язык
- Говори от первого лица, тепло, без лишних слов
- Если человеку очень плохо — будь рядом, но и скажи честно что думаешь`;

const CRISIS_WORDS = [
  'суицид', 'не хочу жить', 'хочу умереть', 'покончить',
  'конец жизни', 'убить себя', 'убью себя',
  'нет смысла жить', 'незачем жить',
];

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
    const groqKey = Deno.env.get('GROQ_API_KEY')!;

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

        const groqRes = await fetch(GROQ_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: 'user', content: `Сделай краткое саммари этого разговора (2-3 предложения) для контекста следующей беседы. Только факты о состоянии и темах, без оценок:\n\n${transcript}` },
            ],
            max_tokens: 200,
            temperature: 0.5,
          }),
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          const summary = data.choices[0].message.content.trim();
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

    // Строим историю для Groq (messages array)
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (previousSummary) {
      messages.push({ role: 'system', content: `Предыдущий разговор: ${previousSummary}` });
    }

    messages.push({ role: 'system', content: `Состояние пользователя: уровень ${userLevel}` });

    for (const m of history) {
      messages.push({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      });
    }

    messages.push({ role: 'user', content: message });

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.85,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq ${groqRes.status}: ${errText.slice(0, 200)}`);
    }

    const groqData = await groqRes.json();
    const reply = groqData.choices?.[0]?.message?.content?.trim() || 'не удалось получить ответ';

    // Сохраняем ответ @один
    if (session_id) {
      await supabase.from('ai_chat_messages').insert({
        user_id: userId,
        session_id,
        role: 'assistant',
        text: reply,
      });
    }

    const isCrisis = detectCrisis(message);

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
