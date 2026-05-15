-- Сессии чата с @один (для памяти между сессиями)
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  summary TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- История сообщений чата
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  session_id UUID REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Флаг доступа к чату (для будущей монетизации, сейчас всем true)
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_chat_enabled BOOLEAN DEFAULT true;

-- Индексы для быстрой загрузки истории
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user ON ai_chat_sessions(user_id, started_at DESC);

-- RLS: каждый видит только свои данные
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own sessions" ON ai_chat_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users see own messages" ON ai_chat_messages
  FOR ALL USING (auth.uid() = user_id);
