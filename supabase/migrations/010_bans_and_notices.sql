-- Бан пользователей
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;

-- Уведомления о модерации (удалённые сообщения)
CREATE TABLE IF NOT EXISTS moderation_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'message_deleted',
  message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mod_notices_user_unread
  ON moderation_notices(user_id, read_at) WHERE read_at IS NULL;

ALTER TABLE moderation_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_notices" ON moderation_notices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_update_own_notices" ON moderation_notices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admin_insert_notices" ON moderation_notices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND is_admin = true)
);

-- RLS: admin может удалять любые сообщения в чате
CREATE POLICY "delete_message" ON messages FOR DELETE USING (
  auth.uid() = sender_id OR
  EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND is_admin = true)
);

-- RLS: admin может удалять любые комментарии к постам
CREATE POLICY "delete_comment" ON post_comments FOR DELETE USING (
  auth.uid() = author_id OR
  EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND is_admin = true)
);

-- RLS: admin может обновлять любого пользователя (для бана)
CREATE POLICY "update_own_profile" ON users FOR UPDATE USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND is_admin = true)
);
