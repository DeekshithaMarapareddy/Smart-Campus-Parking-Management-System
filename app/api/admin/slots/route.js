import { query } from '@/lib/db';
import { route, json, readBody, text, oneOf, intId, VEHICLE_TYPES } from '@/lib/api';
import { logEvent } from '@/lib/mongo';

export const POST = route(
  async (req, { user }) => {
    const body = await readBody(req);
    const zoneId = intId(body.zone_id, 'Zone');
    const number = text(body.slot_number, 'Slot number', { max: 10 }).toUpperCase();
    const type = oneOf(body.slot_type, 'Slot type', VEHICLE_TYPES);
    const floor = Number.isInteger(Number(body.floor_no)) ? Number(body.floor_no) : 0;

    const { rows } = await query(
      `INSERT INTO parking_slots (zone_id, slot_number, slot_type, floor_no)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [zoneId, number, type, floor]
    );
    logEvent('admin.slot_created', { user_id: user.user_id, slot_id: rows[0].slot_id });
    return json({ slot: rows[0] }, 201);
  },
  { roles: ['Admin'] }
);
