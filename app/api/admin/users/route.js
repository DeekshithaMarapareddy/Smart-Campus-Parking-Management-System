import { query } from '@/lib/db';
import { route, json } from '@/lib/api';

// Users with their activity summary (v_user_activity view) and staff details
export const GET = route(
  async () => {
    const { rows } = await query(
      `SELECT a.*, st.department, st.designation, u.created_at
       FROM v_user_activity a
       JOIN users u ON u.user_id = a.user_id
       LEFT JOIN LATERAL (
         SELECT department, designation FROM staff s WHERE s.user_id = a.user_id ORDER BY staff_id LIMIT 1
       ) st ON TRUE
       ORDER BY a.user_id`
    );
    return json({ users: rows });
  },
  { roles: ['Admin'] }
);
