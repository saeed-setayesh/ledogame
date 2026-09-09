-- GameInvite: carry the game mode and a real FK to Game so invites can be
-- read/cleaned up alongside their lobby. Written idempotently because this
-- repo's migration history is applied out of order on fresh databases.

ALTER TABLE "GameInvite"
  ADD COLUMN IF NOT EXISTS "gameMode" "GameMode" NOT NULL DEFAULT 'CLASSIC';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'GameInvite_gameId_fkey'
      AND table_name = 'GameInvite'
  ) THEN
    ALTER TABLE "GameInvite"
      ADD CONSTRAINT "GameInvite_gameId_fkey"
      FOREIGN KEY ("gameId") REFERENCES "Game"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
