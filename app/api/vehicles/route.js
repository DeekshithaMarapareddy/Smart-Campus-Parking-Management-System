import { query } from '@/lib/db';
import { route, json, readBody, text, oneOf, VEHICLE_TYPES } from '@/lib/api';
import { logEvent } from '@/lib/mongo';

export const GET = route(async (req, { user }) => {
  const all = req.nextUrl.searchParams.get('all') === '1' && user.role === 'Admin';
  const { rows } = await query(
    `SELECT v.vehicle_id, v.user_id, u.name AS owner_name, v.reg_number, v.vehicle_type,
            v.model, v.color, v.status, v.created_at,
            (SELECT COUNT(*) FROM bookings b WHERE b.vehicle_id = v.vehicle_id)::INT AS bookings
     FROM vehicles v
     LEFT JOIN users u ON u.user_id = v.user_id
     WHERE ($1::boolean OR v.user_id = $2)
     ORDER BY v.status, v.vehicle_id`,
    [all, user.user_id]
  );
  return json({ vehicles: rows });
});

export const POST = route(async (req, { user }) => {
  const body = await readBody(req);
  const reg = text(body.reg_number, 'Registration number', { min: 4, max: 20 })
    .toUpperCase()
    .replace(/[\s-]+/g, '');
  const type = oneOf(body.vehicle_type, 'Vehicle type', VEHICLE_TYPES);
  const model = text(body.model, 'Model', { max: 60, optional: true });
  const color = text(body.color, 'Color', { max: 30, optional: true });

  const { rows } = await query(
    `INSERT INTO vehicles (user_id, reg_number, vehicle_type, model, color)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [user.user_id, reg, type, model, color]
  );
  logEvent('vehicle.registered', { user_id: user.user_id, vehicle_id: rows[0].vehicle_id });
  return json({ vehicle: rows[0] }, 201);
});
