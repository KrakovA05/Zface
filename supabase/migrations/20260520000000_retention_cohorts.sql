-- Таблица когорт retention
CREATE TABLE IF NOT EXISTS retention_cohorts (
  cohort_week   DATE NOT NULL,
  week_offset   INT  NOT NULL,
  cohort_size   INT  NOT NULL DEFAULT 0,
  retained      INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (cohort_week, week_offset)
);

ALTER TABLE retention_cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY admins_read_cohorts ON retention_cohorts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_admin = TRUE)
  );

-- Функция пересчёта когорт
CREATE OR REPLACE FUNCTION compute_retention_cohorts()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  offsets INT[] := ARRAY[0, 1, 2, 4, 8];
  off INT;
BEGIN
  FOREACH off IN ARRAY offsets LOOP
    INSERT INTO retention_cohorts (cohort_week, week_offset, cohort_size, retained)
    SELECT
      date_trunc('week', u.created_at)::date AS cohort_week,
      off AS week_offset,
      COUNT(DISTINCT u.user_id) AS cohort_size,
      COUNT(DISTINCT CASE
        WHEN off = 0 THEN u.user_id
        WHEN u.last_seen >= date_trunc('week', u.created_at) + (off || ' weeks')::interval
         AND u.last_seen <  date_trunc('week', u.created_at) + ((off + 1) || ' weeks')::interval
        THEN u.user_id
        ELSE NULL
      END) AS retained
    FROM users u
    GROUP BY 1
    ON CONFLICT (cohort_week, week_offset) DO UPDATE
      SET cohort_size = EXCLUDED.cohort_size,
          retained    = EXCLUDED.retained;
  END LOOP;
END;
$$;

-- Запуск каждый понедельник в 04:00
SELECT cron.schedule(
  'weekly-retention-cohorts',
  '0 4 * * 1',
  $$ SELECT compute_retention_cohorts(); $$
);
