import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RSS_SOURCES = [
  'https://meduza.io/rss/all',
  'https://nplus1.ru/rss',
];

function parseRSS(xml: string): { title: string; link: string; description: string }[] {
  const items: { title: string; link: string; description: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const chunk = match[1];
    const title = chunk.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() || '';
    const link = chunk.match(/<link>(.*?)<\/link>/s)?.[1]?.trim() || '';
    const desc = chunk.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/s)?.[1]?.trim() || '';
    if (title && link) items.push({ title, link, description: desc });
  }
  return items.slice(0, 12);
}

function detectDimensions(title: string, desc: string): { topic: string; weights: Record<string, number> } {
  const t = (title + ' ' + desc).toLowerCase();

  const raw: Record<string, number> = {
    anxiety: 0, stress: 0, apathy: 0, loneliness: 0,
    burnout: 0, self_esteem: 0, social_anxiety: 0, attachment: 0,
  };

  if (/тревог|паник|страх|беспокой|фоби/.test(t)) raw.anxiety += 0.8;
  if (/стресс|напряжен|перегруз|кортизол/.test(t)) raw.stress += 0.8;
  if (/депресс|апати|уныни|ничего не хоч|не могу встать/.test(t)) raw.apathy += 0.8;
  if (/одиноч|изоляц|отверж/.test(t)) raw.loneliness += 0.8;
  if (/выгор|истощен|эмоциональн.*усталост/.test(t)) raw.burnout += 0.8;
  if (/самооценк|самозван|неуверен|самосостр/.test(t)) raw.self_esteem += 0.8;
  if (/социальн.*тревог|стесни|чужое мнен|социофоб/.test(t)) raw.social_anxiety += 0.8;
  if (/привязанн|расстав|партнер|отношени|зависимость/.test(t)) raw.attachment += 0.8;

  const sorted = Object.entries(raw).sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] < 0.3) return { topic: 'general', weights: { stress: 0.5, anxiety: 0.5 } };

  const weights: Record<string, number> = {};
  for (const [dim, score] of sorted) {
    if (score >= 0.3) weights[dim] = score;
  }

  const topicMap: Record<string, string> = {
    anxiety: 'anxiety', stress: 'stress', apathy: 'depression',
    loneliness: 'loneliness', burnout: 'burnout', self_esteem: 'self_esteem',
    social_anxiety: 'social_anxiety', attachment: 'attachment',
  };

  return { topic: topicMap[sorted[0][0]] || 'general', weights };
}

function isPsychologyRelated(title: string, desc: string): boolean {
  const t = (title + ' ' + desc).toLowerCase();
  return /тревог|стресс|депресс|выгор|психолог|эмоц|апати|одиноч|самооценк|привязанн|паник|страх|настроен|ментальн|психическ/.test(t);
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

  let totalAdded = 0;
  const errors: string[] = [];

  for (const rssUrl of RSS_SOURCES) {
    try {
      const res = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OdinBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) { errors.push(`${rssUrl}: HTTP ${res.status}`); continue; }

      const xml = await res.text();
      const items = parseRSS(xml);

      for (const item of items) {
        if (!isPsychologyRelated(item.title, item.description)) continue;

        const { data: existing } = await supabase
          .from('resources').select('id').eq('url', item.link).limit(1);
        if (existing && existing.length > 0) continue;

        const { topic, weights } = detectDimensions(item.title, item.description);

        const { error } = await supabase.from('resources').insert({
          title: item.title.slice(0, 200),
          type: 'article',
          url: item.link,
          topic,
          dimension_weights: weights,
        });
        if (!error) totalAdded++;
      }
    } catch (err) {
      errors.push(`${rssUrl}: ${String(err)}`);
    }
  }

  return new Response(JSON.stringify({ ok: true, added: totalAdded, errors }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
