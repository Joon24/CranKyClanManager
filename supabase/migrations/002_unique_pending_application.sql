-- 동일 사용자의 pending 신청은 1건만 허용
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_one_pending_per_user
  ON applications (discord_user_id)
  WHERE status = 'pending';
