import { query } from '@/lib/db';
import { route, json, readBody, oneOf, intId, HttpError } from '@/lib/api';
import { logEvent } from '@/lib/mongo';

// Change slot status. The database trigger refuses Maintenance while upcoming bookings exist.
export const PATCH = route(
  async (req, { user, params }) => {
    const id = intId(params.id, 'Slot');
    const body = await readBody(req);
    const status = oneOf(body.status, 'Status', ['Available', 'Maintenance']);

    const { rows } = await query(
      `UPDATE parking_slots SET status = $1 WHERE slot_id = $2 RETURNING *`,
      [status, id]
    );
    if (!rows[0]) throw new HttpError(404, 'Slot not found');
    logEvent('admin.slot_status', { user_id: user.user_id, slot_id: id, meta: { status } });
    return json({ slot: rows[0] });
  },
  { roles: ['Admin'] }
);

export const DELETE = route(
  async (req, { user, params }) => {
    const id = intId(params.id, 'Slot');
    const { rowCount } = await query(`DELETE FROM parking_slots WHERE slot_id = $1`, [id]);
    if (!rowCount) throw new HttpError(404, 'Slot not found');
    logEvent('admin.slot_deleted', { user_id: user.user_id, slot_id: id });
    return json({ ok: true });
  },
  { roles: ['Admin'] }
);
