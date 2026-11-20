import { query } from '@/lib/db';
import { route, json, readBody, text, oneOf } from '@/lib/api';
import { logEvent } from '@/lib/mongo';

const ZONE_STATUSES = ['Active', 'Inactive', 'Maintenance'];

export const POST = route(
  async (req, { user }) => {
    const body = await readBody(req);
    const name = text(body.zone_name, 'Zone name', { min: 2, max: 100 });
    const location = text(body.location, 'Location', { max: 150, optional: true });
    const description = text(body.description, 'Description', { max: 500, optional: true });
    const status = oneOf(body.status || 'Active', 'Status', ZONE_STATUSES);

    const { rows } = await query(
      `INSERT INTO parking_zones (zone_name, location, description, status)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, location, description, status]
    );
    logEvent('admin.zone_created', { user_id: user.user_id, meta: { zone_id: rows[0].zone_id } });
    return json({ zone: rows[0] }, 201);
  },
  { roles: ['Admin'] }
);
