-- pg_cron расписание для ai-feed-generator: 09:00 UTC ежедневно
-- Функция задеплоена с verify_jwt=false, Authorization не требуется

-- Убрать старое расписание если существует (идемпотентность)
SELECT cron.unschedule('ai-feed-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-feed-daily');

-- Зарегистрировать расписание
SELECT cron.schedule(
  'ai-feed-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yincycmdsdluueqsxtwn.supabase.co/functions/v1/ai-feed-generator',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Проверить результат:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'ai-feed-daily';
