import { query } from '@/lib/db';
import { route, json, readBody, oneOf, intId, HttpError } from '@/lib/api';
import { logEvent } from '@/lib/mongo';

export const PATCH = route(
  async (req, { user, params }) => {
    const id = intId(params.id, 'User');
    const body = await readBody(req);
    if (id === user.user_id) throw new HttpError(400, 'You cannot change your own role or status');

    const { rows: found } = await query(`SELECT role, status FROM users WHERE user_id = $1`, [id]);
    if (!found[0]) throw new HttpError(404, 'User not found');
    const status = body.status !== undefined ? oneOf(body.status, 'Status', ['Active', 'Inactive', 'Blocked']) : found[0].status;
    const role = body.role !== undefined ? oneOf(body.role, 'Role', ['Admin', 'Staff', 'Student']) : found[0].role;

    const { rows } = await query(
      `UPDATE users SET status = $1, role = $2 WHERE user_id = $3
       RETURNING user_id, name, email, role, status`,
      [status, role, id]
    );
    logEvent('admin.user_updated', { user_id: user.user_id, meta: { target: id, status, role } });
    return json({ user: rows[0] });
  },
  { roles: ['Admin'] }
);
