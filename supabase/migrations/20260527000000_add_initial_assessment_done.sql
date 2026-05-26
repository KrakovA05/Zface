ALTER TABLE users
  ADD COLUMN IF NOT EXISTS initial_assessment_done BOOLEAN DEFAULT FALSE;

UPDATE users
SET initial_assessment_done = TRUE
WHERE level IS NOT NULL;
