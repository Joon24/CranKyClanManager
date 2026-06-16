-- 클랜원 / 용병 구분
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS member_type TEXT NOT NULL DEFAULT 'member'
  CHECK (member_type IN ('member', 'mercenary'));

CREATE INDEX IF NOT EXISTS idx_users_member_type ON users(member_type);

-- 기존 용병 신청 데이터 백필
UPDATE users u
SET member_type = 'mercenary'
WHERE member_type = 'member'
  AND EXISTS (
    SELECT 1 FROM applications a
    WHERE a.discord_user_id = u.discord_user_id
      AND a.join_source = '용병 신청'
      AND a.status = 'approved'
  );
