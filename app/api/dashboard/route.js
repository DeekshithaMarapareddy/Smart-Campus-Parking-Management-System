import { query } from '@/lib/db';
import { route, json } from '@/lib/api';

export const GET = route(async (req, { user }) => {
  await query('SELECT fn_complete_expired_bookings()');

  const [mine, upcoming, zones] = await Promise.all([
    query(
      `SELECT
         (SELECT COUNT(*) FROM bookings WHERE user_id = $1 AND status = 'Booked')::INT    AS upcoming_bookings,
         (SELECT COUNT(*) FROM bookings WHERE user_id = $1 AND status = 'Completed')::INT AS completed_bookings,
         (SELECT COUNT(*) FROM vehicles WHERE user_id = $1 AND status = 'Active')::INT    AS vehicles,
         (SELECT COUNT(*) FROM complaints WHERE user_id = $1 AND status IN ('Open','In Progress'))::INT AS open_complaints,
         (SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN bookings b ON b.booking_id = p.booking_id
           WHERE b.user_id = $1 AND p.status = 'Paid') AS total_spent,
         (SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN bookings b ON b.booking_id = p.booking_id
           WHERE b.user_id = $1 AND p.status = 'Pending' AND b.status <> 'Cancelled') AS amount_due`,
      [user.user_id]
    ),
    query(
      `SELECT * FROM v_booking_details
       WHERE user_id = $1 AND status = 'Booked'
       ORDER BY booking_date, start_time LIMIT 4`,
      [user.user_id]
    ),
    query(
      `SELECT z.zone_id, z.zone_name, z.location, z.status,
              COUNT(o.slot_id)::INT AS total_slots,
              COUNT(o.slot_id) FILTER (WHERE o.slot_status = 'Maintenance')::INT AS maintenance_slots,
              COUNT(o.slot_id) FILTER (WHERE o.occupied_now)::INT AS occupied_now
       FROM parking_zones z
       LEFT JOIN v_slot_overview o ON o.zone_id = z.zone_id
       GROUP BY z.zone_id
       ORDER BY z.zone_id`
    ),
  ]);

  let admin = null;
  if (user.role === 'Admin') {
    const { rows } = await query(
      `SELECT
         (SELECT COUNT(*) FROM users)::INT                                            AS users,
         (SELECT COUNT(*) FROM bookings WHERE booking_date = CURRENT_DATE AND status <> 'Cancelled')::INT AS bookings_today,
         (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'Paid' AND payment_time::DATE = CURRENT_DATE) AS revenue_today,
         (SELECT COUNT(*) FROM complaints WHERE status IN ('Open','In Progress'))::INT AS open_complaints`
    );
    admin = rows[0];
  }

  return json({ me: mine.rows[0], upcoming: upcoming.rows, zones: zones.rows, admin });
});
