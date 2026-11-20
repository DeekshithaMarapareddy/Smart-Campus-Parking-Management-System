import { query } from '@/lib/db';
import { route, json, readBody, text, oneOf, intId, HttpError } from '@/lib/api';
import { logEvent } from '@/lib/mongo';

const ZONE_STATUSES = ['Active', 'Inactive', 'Maintenance'];

export const PATCH = route(
  async (req, { user, params }) => {
    const id = intId(params.id, 'Zone');
    const { rows: found } = await query(`SELECT * FROM parking_zones WHERE zone_id = $1`, [id]);
    const cur = found[0];
    if (!cur) throw new HttpError(404, 'Zone not found');
    const body = await readBody(req);

    const name = body.zone_name !== undefined ? text(body.zone_name, 'Zone name', { min: 2, max: 100 }) : cur.zone_name;
    const location = body.location !== undefined ? text(body.location, 'Location', { max: 150, optional: true }) : cur.location;
    const description = body.description !== undefined ? text(body.description, 'Description', { max: 500, optional: true }) : cur.description;
    const status = body.status !== undefined ? oneOf(body.status, 'Status', ZONE_STATUSES) : cur.status;

    const { rows } = await query(
      `UPDATE parking_zones SET zone_name = $1, location = $2, description = $3, status = $4
       WHERE zone_id = $5 RETURNING *`,
      [name, location, description, status, id]
    );
    logEvent('admin.zone_updated', { user_id: user.user_id, meta: { zone_id: id, status } });
    return json({ zone: rows[0] });
  },
  { roles: ['Admin'] }
);

// Fails (and tells the admin to deactivate instead) when slots in the zone have bookings
export const DELETE = route(
  async (req, { user, params }) => {
    const id = intId(params.id, 'Zone');
    const { rowCount } = await query(`DELETE FROM parking_zones WHERE zone_id = $1`, [id]);
    if (!rowCount) throw new HttpError(404, 'Zone not found');
    logEvent('admin.zone_deleted', { user_id: user.user_id, meta: { zone_id: id } });
    return json({ ok: true });
  },
  { roles: ['Admin'] }
);
