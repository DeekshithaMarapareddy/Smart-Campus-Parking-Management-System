import { query } from '@/lib/db';
import { route, json } from '@/lib/api';

// Zones with live occupancy, for every logged-in user
export const GET = route(async () => {
  const { rows } = await query(
    `SELECT z.zone_id, z.zone_name, z.location, z.description, z.status,
            COUNT(o.slot_id)::INT                                               AS total_slots,
            COUNT(o.slot_id) FILTER (WHERE o.slot_status = 'Maintenance')::INT  AS maintenance_slots,
            COUNT(o.slot_id) FILTER (WHERE o.occupied_now)::INT                 AS occupied_now
     FROM parking_zones z
     LEFT JOIN v_slot_overview o ON o.zone_id = z.zone_id
     GROUP BY z.zone_id
     ORDER BY z.zone_id`
  );
  return json({ zones: rows });
});
