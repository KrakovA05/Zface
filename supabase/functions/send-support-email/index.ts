function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' },
    });
  }

  try {
    const body = await req.json();
    const category = escapeHtml(String(body.category ?? '').slice(0, 100));
    const subject  = escapeHtml(String(body.subject  ?? '').slice(0, 200));
    const message  = escapeHtml(String(body.message  ?? '').slice(0, 2000));
    const username = escapeHtml(String(body.username  ?? 'unknown').slice(0, 100));

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('RESEND_API_KEY not set');
      return new Response(JSON.stringify({ ok: false, error: 'no api key' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: [Deno.env.get('ALERT_EMAIL') ?? 'support@notalone-support.ru'],
        subject: `[поддержка] ${body.category ?? ''}: ${body.subject ?? ''}`.slice(0, 150),
        html: `
          <h2>Обращение в поддержку</h2>
          <p><strong>Пользователь:</strong> ${username}</p>
          <p><strong>Категория:</strong> ${category}</p>
          <p><strong>Тема:</strong> ${subject}</p>
          <hr/>
          <p>${message.replace(/\n/g, '<br/>')}</p>
        `,
      }),
    });

    const data = await res.json();
    console.log('Resend response:', res.status, JSON.stringify(data));

    return new Response(JSON.stringify({ ok: res.ok }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-support-email error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
