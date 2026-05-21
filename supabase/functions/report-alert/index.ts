type WebhookPayload = {
  type: 'INSERT';
  table: 'reports';
  schema: 'public';
  record: {
    id: string;
    reporter_id: string;
    reported_user_id: string;
    reason: string;
    created_at: string;
  };
  old_record: null;
};

Deno.serve(async (req) => {
  // Проверка webhook secret
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  if (webhookSecret) {
    const incoming = req.headers.get('x-webhook-secret') || req.headers.get('authorization');
    if (incoming !== webhookSecret && incoming !== `Bearer ${webhookSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  try {
    const payload: WebhookPayload = await req.json();
    const { record } = payload;

    if (!record) {
      return new Response(JSON.stringify({ ok: false, error: 'no record' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('RESEND_API_KEY not set');
      return new Response(JSON.stringify({ ok: false, error: 'no api key' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: [Deno.env.get('ALERT_EMAIL') ?? 'support@notalone-support.ru'],
        subject: `[!один] Новая жалоба: ${record.reason}`,
        html: `
          <h2>Новая жалоба в приложении</h2>
          <p><strong>ID записи:</strong> ${record.id}</p>
          <p><strong>Жалобщик (user_id):</strong> ${record.reporter_id}</p>
          <p><strong>На пользователя (user_id):</strong> ${record.reported_user_id}</p>
          <p><strong>Причина:</strong> ${record.reason}</p>
          <p><strong>Время:</strong> ${record.created_at}</p>
        `,
      }),
    });

    const data = await res.json();
    console.log('Resend response:', res.status, JSON.stringify(data));

    return new Response(JSON.stringify({ ok: res.ok, status: res.status }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('report-alert error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
