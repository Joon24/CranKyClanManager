-- 용병이 아닌 클랜원의 member_type 복구 (용병 신청 기록이 없는 경우)
UPDATE users u
SET member_type = 'member'
WHERE u.member_type = 'mercenary'
  AND NOT EXISTS (
    SELECT 1 FROM applications a
    WHERE a.discord_user_id = u.discord_user_id
      AND a.join_source = '용병 신청'
      AND a.status = 'approved'
  );
