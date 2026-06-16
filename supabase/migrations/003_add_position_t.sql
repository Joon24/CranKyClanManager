-- 포지션 T(특총) 추가
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_position_check;
ALTER TABLE users ADD CONSTRAINT users_position_check CHECK (position IN ('S', 'R', 'M', 'T'));

ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_position_check;
ALTER TABLE applications ADD CONSTRAINT applications_position_check CHECK (position IN ('S', 'R', 'M', 'T'));
