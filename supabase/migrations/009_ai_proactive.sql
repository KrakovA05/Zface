-- Таблица для проактивных сообщений от @одного
CREATE TABLE IF NOT EXISTS ai_proactive_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('scheduled', 'triggered')),
  trigger_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  push_sent BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ai_proactive_user_unread
  ON ai_proactive_messages (user_id, read_at)
  WHERE read_at IS NULL;

ALTER TABLE ai_proactive_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_proactive"
  ON ai_proactive_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_proactive"
  ON ai_proactive_messages FOR UPDATE
  USING (auth.uid() = user_id);

-- Триггеры для вызова ai-proactive Edge Function
-- при новом тесте (смена уровня на red) и высоких психометрических баллах

CREATE OR REPLACE TRIGGER ai_proactive_level_change
  AFTER INSERT ON test_results
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://yincycmdsdluueqsxtwn.supabase.co/functions/v1/ai-proactive',
    'POST',
    '{"Content-Type":"application/json","x-trigger-type":"webhook","x-webhook-secret":"38b5c541d40ab2248a843720fe444edd9272c568ebd66b1b"}',
    '{}',
    '5000'
  );

CREATE OR REPLACE TRIGGER ai_proactive_psych_result
  AFTER INSERT ON psych_test_results
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://yincycmdsdluueqsxtwn.supabase.co/functions/v1/ai-proactive',
    'POST',
    '{"Content-Type":"application/json","x-trigger-type":"webhook","x-webhook-secret":"38b5c541d40ab2248a843720fe444edd9272c568ebd66b1b"}',
    '{}',
    '5000'
  );
