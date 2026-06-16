-- 블랙리스트 관리 필드
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS blacklist_reason TEXT,
  ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blacklisted_by TEXT;

CREATE INDEX IF NOT EXISTS idx_users_status_blocked ON users(status) WHERE status = 'blocked';
