-- Таблица лога модераторских действий
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  target_id   UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('ban','unban','warning','level_change','delete')),
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_actions_admin_only" ON public.admin_actions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND is_admin = true)
  );

-- Колонка type для moderation_notices
ALTER TABLE public.moderation_notices
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'deletion'
    CHECK (type IN ('deletion', 'warning'));

-- RPC для удаления чужого аккаунта (только admin)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  DELETE FROM public.users WHERE user_id = target_id;
  DELETE FROM auth.users WHERE id = target_id;
END;
$$;
