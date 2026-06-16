-- CranKy Clan Manager - Initial Schema

CREATE TYPE user_status AS ENUM ('pending', 'approved', 'rejected', 'blocked', 'left', 'kicked');
CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected', 'on_hold', 'blocked');
CREATE TYPE api_check_status AS ENUM ('pending', 'success', 'failed', 'not_found');
CREATE TYPE suspicion_level AS ENUM ('normal', 'caution', 'review');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL UNIQUE,
  discord_username TEXT NOT NULL,
  sudden_nickname TEXT,
  ouid TEXT,
  age INTEGER,
  position TEXT CHECK (position IN ('S', 'R', 'M')),
  server_nickname TEXT,
  role TEXT DEFAULT 'member',
  status user_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL,
  sudden_nickname TEXT NOT NULL,
  age INTEGER NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('S', 'R', 'M')),
  main_time TEXT NOT NULL,
  previous_clan TEXT,
  join_source TEXT NOT NULL,
  api_check_status api_check_status NOT NULL DEFAULT 'pending',
  admin_memo TEXT,
  status application_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_discord_user_id ON applications(discord_user_id);
CREATE INDEX idx_applications_created_at ON applications(created_at DESC);

CREATE TABLE match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  ouid TEXT NOT NULL,
  kd NUMERIC(6, 2),
  win_rate NUMERIC(5, 2),
  rank_name TEXT,
  tier_name TEXT,
  recent_matches JSONB DEFAULT '[]'::jsonb,
  suspicion_score INTEGER DEFAULT 0,
  suspicion_level suspicion_level DEFAULT 'normal',
  last_checked_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_match_stats_user_id ON match_stats(user_id);
CREATE INDEX idx_match_stats_ouid ON match_stats(ouid);

CREATE TABLE warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  warning_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  point INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_warnings_user_id ON warnings(user_id);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
