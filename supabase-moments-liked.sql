-- ==========================================
-- MOMENTS — persistent "liked" flag
-- Adds a like that survives reloads in the photo gallery (StoriesViewer).
-- Either partner of the couple can toggle the like, not only the author.
-- ==========================================

ALTER TABLE moments ADD COLUMN IF NOT EXISTS liked BOOLEAN NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "update_moments" ON moments;
CREATE POLICY "update_moments" ON moments
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = moments.user_id AND p.partner_id = auth.uid()
    )
  );
