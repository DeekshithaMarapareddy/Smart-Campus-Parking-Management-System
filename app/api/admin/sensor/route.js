import { query } from '@/lib/db';
import { route, json, readBody, intId, HttpError } from '@/lib/api';
import { getMongoDb } from '@/lib/mongo';

/**
 * Simulates an IoT sensor sending a reading for a slot, so the MongoDB
 * sensor log can be demonstrated without hardware.
 *   POST { slot_id: 3, occupied: true }
 */
export const POST = route(
  async (req) => {
    const body = await readBody(req);
    const slotId = intId(body.slot_id, 'Slot');
    const occupied = body.occupied === true;

    const { rows } = await query(`SELECT slot_id, zone_id FROM parking_slots WHERE slot_id = $1`, [slotId]);
    if (!rows[0]) throw new HttpError(404, 'Slot not found');

    const db = await getMongoDb();
    if (!db) throw new HttpError(503, 'MongoDB is not reachable right now');

    const reading = {
      sensor_id: `SNS-${String(slotId).padStart(3, '0')}`,
      slot_id: slotId,
      zone_id: rows[0].zone_id,
      occupied,
      battery_pct: 60 + Math.floor(Math.random() * 40),
      signal_dbm: -90 + Math.floor(Math.random() * 40),
      ts: new Date(),
      source: 'simulator',
    };
    await db.collection('sensor_logs').insertOne(reading);
    await db.collection('parking_events').insertOne({
      event_type: occupied ? 'sensor.occupied' : 'sensor.vacated',
      slot_id: slotId,
      ts: reading.ts,
      meta: { sensor_id: reading.sensor_id },
    });
    return json({ ok: true, reading: { ...reading, _id: undefined } }, 201);
  },
  { roles: ['Admin'] }
);
