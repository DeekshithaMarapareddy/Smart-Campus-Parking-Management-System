import { query } from '@/lib/db';
import { route, json, readBody, intId, oneOf, HttpError, COMPLAINT_STATUSES } from '@/lib/api';
import { logEvent } from '@/lib/mongo';

// Admin: change the status of a complaint (the trigger sets resolved_at)
export const PATCH = route(
  async (req, { user, params }) => {
    const id = intId(params.id, 'Complaint');
    const body = await readBody(req);
    const status = oneOf(body.status, 'Status', COMPLAINT_STATUSES);

    const { rows } = await query(
      `UPDATE complaints SET status = $1 WHERE complaint_id = $2 RETURNING *`,
      [status, id]
    );
    if (!rows[0]) throw new HttpError(404, 'Complaint not found');
    logEvent('complaint.updated', { user_id: user.user_id, meta: { complaint_id: id, status } });
    return json({ complaint: rows[0] });
  },
  { roles: ['Admin'] }
);
