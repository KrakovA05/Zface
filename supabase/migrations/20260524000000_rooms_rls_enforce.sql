-- RLS enforcement for room-level access and night room anonymity.
-- Before this migration, the room access check existed only on the client
-- (RoomsScreen.js line 154). A malicious user could bypass it via direct API.

-- Policy 1: Users can only insert messages into the room matching their level.
-- Admins, global (chat), and night room are exempt.
-- Anon night-room messages have no sender_id — they pass auth.uid() check by being exempt.
CREATE POLICY "room_level_match_insert"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    -- Global chat: no level restriction
    level = 'global'
    -- Night room: always open (anonymity enforced by policy 2)
    OR level = 'night'
    -- Level-matched rooms: user's level must match
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid()
        AND (level = messages.level OR is_admin = TRUE)
    )
  );

-- Policy 2: Night room messages must not carry sender_id.
-- Prevents a user from linking their identity to a night-room message via direct API.
CREATE POLICY "night_room_no_sender_id"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    level <> 'night' OR sender_id IS NULL
  );
