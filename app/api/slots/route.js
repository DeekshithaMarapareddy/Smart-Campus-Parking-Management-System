import { query } from '@/lib/db';
import { route, json } from '@/lib/api';

// All slots with their zone and live status (uses the v_slot_overview view)
export const GET = route(async () => {
  const { rows } = await query(
    `SELECT * FROM v_slot_overview ORDER BY zone_id, slot_type, slot_number`
  );
  return json({ slots: rows });
});
