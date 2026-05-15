-- Системный пользователь @один для генерации контента лентой

-- Сначала создать запись в auth.users (без пароля, никогда не логинится)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  role, aud, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'system@odin.app',
  '',
  now(),
  'authenticated',
  'authenticated',
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  false
) ON CONFLICT (id) DO NOTHING;

-- Затем создать профиль в public.users
INSERT INTO users (user_id, username, email, level, avatar_url, status, labels, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '@один',
  'system@odin.app',
  'green',
  null,
  'Я здесь каждый день',
  ARRAY[]::text[],
  now()
) ON CONFLICT (user_id) DO NOTHING;
