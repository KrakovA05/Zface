-- SECURITY DEFINER функции для привилегированных admin-операций.
-- Клиент вызывает их через supabase.rpc() — прямые UPDATE is_admin/banned_until
-- через REST API больше не нужны и могут быть закрыты политиками RLS.

-- Переключение admin-флага: только вызывающий admin может изменить другому.
CREATE OR REPLACE FUNCTION admin_toggle_admin(
  p_target_user_id UUID,
  p_new_val        BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE user_id = auth.uid() AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Access denied: caller is not an admin';
  END IF;

  UPDATE public.users
  SET is_admin = p_new_val
  WHERE user_id = p_target_user_id;
END;
$$;

-- Применение бана: только admin.
CREATE OR REPLACE FUNCTION admin_apply_ban(
  p_target_user_id UUID,
  p_banned_until   TIMESTAMPTZ,
  p_reason         TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE user_id = auth.uid() AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Access denied: caller is not an admin';
  END IF;

  UPDATE public.users
  SET banned_until = p_banned_until,
      ban_reason   = p_reason
  WHERE user_id = p_target_user_id;
END;
$$;

-- Доступ на вызов разрешён всем залогиненным (функция сама проверяет is_admin внутри).
GRANT EXECUTE ON FUNCTION admin_toggle_admin(UUID, BOOLEAN)      TO authenticated;
GRANT EXECUTE ON FUNCTION admin_apply_ban(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
