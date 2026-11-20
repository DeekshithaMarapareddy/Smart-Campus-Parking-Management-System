import { query } from '@/lib/db';
import { route, json, dateStr, HttpError } from '@/lib/api';

/**
 * Analytical reports. Each block below is one SQL query; the same queries
 * are listed with explanations in database/queries.sql.
 *   GET /api/admin/reports?from=2026-11-01&to=2026-11-07   (default: last 14 days)
 */
export const GET = route(
  async (req) => {
    const sp = req.nextUrl.searchParams;
    let from = sp.get('from');
    let to = sp.get('to');
    if (!from || !to) {
      const { rows } = await query(`SELECT (CURRENT_DATE - 13)::text AS f, CURRENT_DATE::text AS t`);
      from = from || rows[0].f;
      to = to || rows[0].t;
    }
    dateStr(from, 'From date');
    dateStr(to, 'To date');
    if (to < from) throw new HttpError(400, 'The end date must not be before the start date');

    await query('SELECT fn_complete_expired_bookings()');
    const range = [from, to];

    const [summary, utilization, revenueByDay, revenueByMethod, peakHours, topUsers, topSlots, slotTypeDemand, complaintsByCategory] =
      await Promise.all([
        // 1. headline numbers (subqueries + FILTER)
        query(
          `SELECT
             COUNT(*) FILTER (WHERE b.status <> 'Cancelled')::INT AS bookings,
             COUNT(*) FILTER (WHERE b.status = 'Cancelled')::INT  AS cancelled,
             ROUND(100.0 * COUNT(*) FILTER (WHERE b.status = 'Cancelled') / NULLIF(COUNT(*), 0), 1) AS cancellation_rate,
             COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'Paid'), 0)    AS revenue,
             COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'Pending' AND b.status <> 'Cancelled'), 0) AS unpaid,
             COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'Refunded'), 0) AS refunded
           FROM bookings b
           LEFT JOIN payments p ON p.booking_id = b.booking_id
           WHERE b.booking_date BETWEEN $1::date AND $2::date`,
          range
        ),
        // 2. zone utilization (stored function: joins + aggregation)
        query(`SELECT * FROM fn_zone_utilization($1::date, $2::date)`, range),
        // 3. revenue per day with a running total (view + window function)
        query(
          `SELECT pay_date AS day,
                  SUM(revenue) AS revenue,
                  SUM(SUM(revenue)) OVER (ORDER BY pay_date) AS running_total
           FROM v_daily_revenue
           WHERE pay_date BETWEEN $1::date AND $2::date
           GROUP BY pay_date
           ORDER BY pay_date`,
          range
        ),
        // 4. revenue per payment method (with each method's share of the total)
        query(
          `SELECT payment_method AS method,
                  SUM(payments)::INT AS payments,
                  SUM(revenue) AS revenue,
                  ROUND(100.0 * SUM(revenue) / NULLIF(SUM(SUM(revenue)) OVER (), 0), 1) AS share_pct
           FROM v_daily_revenue
           WHERE pay_date BETWEEN $1::date AND $2::date
           GROUP BY payment_method
           ORDER BY revenue DESC`,
          range
        ),
        // 5. peak hours (generate_series + LEFT JOIN so empty hours show as 0)
        query(
          `SELECT h AS hour, COUNT(b.booking_id)::INT AS bookings
           FROM generate_series(6, 21) AS h
           LEFT JOIN bookings b
                  ON b.status <> 'Cancelled'
                 AND b.booking_date BETWEEN $1::date AND $2::date
                 AND b.start_time < make_time(h + 1, 0, 0)
                 AND b.end_time   > make_time(h, 0, 0)
           GROUP BY h
           ORDER BY h`,
          range
        ),
        // 6. most active users, ranked (view + RANK window function) - all time
        query(
          `SELECT RANK() OVER (ORDER BY total_bookings DESC, total_spent DESC)::INT AS rank,
                  name, role, total_bookings, total_spent
           FROM v_user_activity
           WHERE total_bookings > 0
           ORDER BY rank, name
           LIMIT 5`
        ),
        // 7. busiest slot in each zone (ROW_NUMBER partitioned by zone)
        query(
          `SELECT zone_name, slot_number, bookings
           FROM (
             SELECT z.zone_id, z.zone_name, s.slot_number,
                    COUNT(b.booking_id)::INT AS bookings,
                    ROW_NUMBER() OVER (PARTITION BY z.zone_id ORDER BY COUNT(b.booking_id) DESC, s.slot_id) AS rn
             FROM parking_zones z
             JOIN parking_slots s ON s.zone_id = z.zone_id
             LEFT JOIN bookings b ON b.slot_id = s.slot_id
                                 AND b.status <> 'Cancelled'
                                 AND b.booking_date BETWEEN $1::date AND $2::date
             GROUP BY z.zone_id, z.zone_name, s.slot_id, s.slot_number
           ) ranked
           WHERE rn = 1 AND bookings > 0
           ORDER BY zone_id`,
          range
        ),
        // 8. demand by slot type
        query(
          `SELECT s.slot_type AS type, COUNT(b.booking_id)::INT AS bookings,
                  COUNT(DISTINCT s.slot_id)::INT AS slots
           FROM parking_slots s
           LEFT JOIN bookings b ON b.slot_id = s.slot_id
                               AND b.status <> 'Cancelled'
                               AND b.booking_date BETWEEN $1::date AND $2::date
           GROUP BY s.slot_type
           ORDER BY bookings DESC`,
          range
        ),
        // 9. complaints by category and status (conditional aggregation)
        query(
          `SELECT category,
                  COUNT(*)::INT AS total,
                  COUNT(*) FILTER (WHERE status IN ('Open', 'In Progress'))::INT AS unresolved,
                  ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
                        FILTER (WHERE resolved_at IS NOT NULL)::NUMERIC, 1) AS avg_hours_to_resolve
           FROM complaints
           GROUP BY category
           ORDER BY total DESC`
        ),
      ]);

    return json({
      range: { from, to },
      summary: summary.rows[0],
      utilization: utilization.rows,
      revenueByDay: revenueByDay.rows,
      revenueByMethod: revenueByMethod.rows,
      peakHours: peakHours.rows,
      topUsers: topUsers.rows,
      topSlots: topSlots.rows,
      slotTypeDemand: slotTypeDemand.rows,
      complaintsByCategory: complaintsByCategory.rows,
    });
  },
  { roles: ['Admin'] }
);
