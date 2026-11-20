import { query } from '@/lib/db';
import { route, json } from '@/lib/api';

export const GET = route(async (req, { user }) => {
  const { rows } = await query(
    `SELECT department, designation FROM staff WHERE user_id = $1 ORDER BY staff_id LIMIT 1`,
    [user.user_id]
  );
  return json({ user: { ...user, ...(rows[0] || {}) } });
});
