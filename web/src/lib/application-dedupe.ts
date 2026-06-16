interface ApplicationRow {
  id: string;
  discord_user_id: string;
  status: string;
  created_at: string;
}

/** 동일 Discord 유저의 pending/on_hold 중복 신청은 최신 1건만 표시 */
export function dedupeApplications<T extends ApplicationRow>(apps: T[]): T[] {
  const approvedUsers = new Set(
    apps.filter((a) => a.status === 'approved').map((a) => a.discord_user_id)
  );
  const latestByUser = new Map<string, T>();
  const rest: T[] = [];

  const sorted = [...apps].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  for (const app of sorted) {
    if (app.status === 'pending' || app.status === 'on_hold') {
      // 이미 승인된 유저의 남은 pending은 표시하지 않음 (중복 신청 잔여)
      if (approvedUsers.has(app.discord_user_id)) continue;
      if (!latestByUser.has(app.discord_user_id)) {
        latestByUser.set(app.discord_user_id, app);
      }
      continue;
    }
    rest.push(app);
  }

  return [...latestByUser.values(), ...rest].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
