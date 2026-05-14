-- Результаты психологических тестов
CREATE TABLE IF NOT EXISTS psych_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  test_id TEXT NOT NULL,
  dimension TEXT NOT NULL,
  raw_score INT NOT NULL,
  normalized_score INT NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE psych_test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own psych results"
  ON psych_test_results FOR ALL
  USING (auth.uid() = user_id);

-- Еженедельные снапшоты метрик
CREATE TABLE IF NOT EXISTS user_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  anxiety_score INT DEFAULT 0,
  stress_score INT DEFAULT 0,
  apathy_score INT DEFAULT 0,
  loneliness_score INT DEFAULT 0,
  burnout_score INT DEFAULT 0,
  self_esteem_score INT DEFAULT 0,
  social_anxiety_score INT DEFAULT 0,
  attachment_score INT DEFAULT 0,
  composite_score INT NOT NULL DEFAULT 0,
  dominant_dimension TEXT,
  level TEXT NOT NULL DEFAULT 'green',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE user_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own metrics"
  ON user_metrics FOR ALL
  USING (auth.uid() = user_id);

-- База материалов
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('video', 'article')),
  url TEXT NOT NULL,
  topic TEXT NOT NULL,
  dimension_weights JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resources readable by all authenticated"
  ON resources FOR SELECT
  USING (auth.role() = 'authenticated');
