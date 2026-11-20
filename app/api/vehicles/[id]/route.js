import { query } from '@/lib/db';
import { route, json, readBody, text, oneOf, intId, HttpError } from '@/lib/api';

async function ownedVehicle(id, user) {
  const { rows } = await query(`SELECT * FROM vehicles WHERE vehicle_id = $1`, [id]);
  const v = rows[0];
  if (!v) throw new HttpError(404, 'Vehicle not found');
  if (v.user_id !== user.user_id && user.role !== 'Admin') throw new HttpError(403, 'That is not your vehicle');
  return v;
}

export const PATCH = route(async (req, { user, params }) => {
  const id = intId(params.id, 'Vehicle');
  const current = await ownedVehicle(id, user);
  const body = await readBody(req);

  const model = body.model !== undefined ? text(body.model, 'Model', { max: 60, optional: true }) : current.model;
  const color = body.color !== undefined ? text(body.color, 'Color', { max: 30, optional: true }) : current.color;
  const status = body.status !== undefined ? oneOf(body.status, 'Status', ['Active', 'Inactive']) : current.status;

  const { rows } = await query(
    `UPDATE vehicles SET model = $1, color = $2, status = $3 WHERE vehicle_id = $4 RETURNING *`,
    [model, color, status, id]
  );
  return json({ vehicle: rows[0] });
});

// Vehicles that already have bookings are kept (set to Inactive) so history stays intact.
export const DELETE = route(async (req, { user, params }) => {
  const id = intId(params.id, 'Vehicle');
  await ownedVehicle(id, user);
  const { rows } = await query(`SELECT COUNT(*)::INT AS n FROM bookings WHERE vehicle_id = $1`, [id]);
  if (rows[0].n > 0) {
    await query(`UPDATE vehicles SET status = 'Inactive' WHERE vehicle_id = $1`, [id]);
    return json({ result: 'deactivated', message: 'This vehicle has booking history, so it was set to Inactive instead of deleted.' });
  }
  await query(`DELETE FROM vehicles WHERE vehicle_id = $1`, [id]);
  return json({ result: 'deleted', message: 'Vehicle deleted.' });
});
