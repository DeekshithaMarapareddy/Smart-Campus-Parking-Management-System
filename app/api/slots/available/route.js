import { query } from '@/lib/db';
import { route, json, dateStr, timeStr, oneOf, intId, VEHICLE_TYPES, HttpError } from '@/lib/api';

// Free slots for a date and time window
//   GET /api/slots/available?date=2026-11-10&start=09:00&end=11:00&type=Bike&zone=1
export const GET = route(async (req) => {
  const sp = req.nextUrl.searchParams;
  const date = dateStr(sp.get('date'), 'Date');
  const start = timeStr(sp.get('start'), 'Start time');
  const end = timeStr(sp.get('end'), 'End time');
  if (end <= start) throw new HttpError(400, 'End time must be after the start time');
  const type = oneOf(sp.get('type') || undefined, 'Slot type', VEHICLE_TYPES, { optional: true });
  const zone = sp.get('zone') ? intId(sp.get('zone'), 'Zone') : null;

  const { rows } = await query(
    `SELECT s.slot_id, s.slot_number, s.slot_type, s.floor_no,
            z.zone_id, z.zone_name, z.location,
            fn_calculate_fee(s.slot_id, $2::time, $3::time) AS fee
     FROM parking_slots s
     JOIN parking_zones z ON z.zone_id = s.zone_id
     WHERE fn_is_slot_available(s.slot_id, $1::date, $2::time, $3::time)
       AND ($4::text IS NULL OR s.slot_type = $4)
       AND ($5::int  IS NULL OR s.zone_id   = $5)
     ORDER BY z.zone_name, s.slot_number`,
    [date, start, end, type, zone]
  );
  return json({ slots: rows });
});
