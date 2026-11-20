-- =====================================================================
--  SCPMS - example queries for demonstration / viva
--  Run after "npm run db:setup":
--      psql "$DATABASE_URL" -f database/queries.sql
--  (the app uses these same ideas in app/api/admin/reports/route.js)
-- =====================================================================

-- 1. JOIN (5 tables): full booking details through the view
SELECT booking_id, user_name, reg_number, zone_name, slot_number, booking_date, start_time, end_time, status, amount, payment_status
FROM v_booking_details
ORDER BY booking_date DESC, start_time DESC
LIMIT 10;

-- 2. AGGREGATION + GROUP BY + HAVING: zones with more than 10 non-cancelled bookings
SELECT z.zone_name, COUNT(b.booking_id) AS bookings
FROM parking_zones z
JOIN parking_slots s ON s.zone_id = z.zone_id
JOIN bookings b      ON b.slot_id = s.slot_id AND b.status <> 'Cancelled'
GROUP BY z.zone_name
HAVING COUNT(b.booking_id) > 10
ORDER BY bookings DESC;

-- 3. STORED FUNCTION: utilization per zone for the last 14 days
SELECT * FROM fn_zone_utilization(CURRENT_DATE - 13, CURRENT_DATE);

-- 4. STORED FUNCTION: parking fee and slot availability check
SELECT fn_calculate_fee(1, '09:00', '12:30') AS fee_for_3_5_hours_car_slot;
SELECT fn_is_slot_available(1, CURRENT_DATE + 1, '09:00', '10:00') AS is_free;

-- 5. WINDOW FUNCTION: revenue per day with a running total
SELECT pay_date, SUM(revenue) AS revenue,
       SUM(SUM(revenue)) OVER (ORDER BY pay_date) AS running_total
FROM v_daily_revenue
GROUP BY pay_date
ORDER BY pay_date;

-- 6. WINDOW FUNCTION: RANK users by bookings
SELECT RANK() OVER (ORDER BY total_bookings DESC, total_spent DESC) AS rank, name, role, total_bookings, total_spent
FROM v_user_activity
WHERE total_bookings > 0;

-- 7. WINDOW FUNCTION: busiest slot in every zone (ROW_NUMBER + PARTITION BY)
SELECT zone_name, slot_number, bookings
FROM (
  SELECT z.zone_id, z.zone_name, s.slot_number, COUNT(b.booking_id) AS bookings,
         ROW_NUMBER() OVER (PARTITION BY z.zone_id ORDER BY COUNT(b.booking_id) DESC, s.slot_id) AS rn
  FROM parking_zones z
  JOIN parking_slots s ON s.zone_id = z.zone_id
  LEFT JOIN bookings b ON b.slot_id = s.slot_id AND b.status <> 'Cancelled'
  GROUP BY z.zone_id, z.zone_name, s.slot_id, s.slot_number
) ranked
WHERE rn = 1 AND bookings > 0;

-- 8. SUBQUERY: users who have never made a booking
SELECT name, email FROM users u
WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.user_id = u.user_id);

-- 9. SUBQUERY: vehicles booked more often than the average vehicle
SELECT v.reg_number, COUNT(*) AS bookings
FROM vehicles v JOIN bookings b ON b.vehicle_id = v.vehicle_id
GROUP BY v.vehicle_id, v.reg_number
HAVING COUNT(*) > (SELECT AVG(c) FROM (SELECT COUNT(*) c FROM bookings GROUP BY vehicle_id) t);

-- 10. LEFT JOIN + generate_series: bookings per hour of day (hours with none show 0)
SELECT h AS hour, COUNT(b.booking_id) AS bookings
FROM generate_series(6, 21) AS h
LEFT JOIN bookings b ON b.status <> 'Cancelled'
                    AND b.start_time < make_time(h + 1, 0, 0)
                    AND b.end_time   > make_time(h, 0, 0)
GROUP BY h ORDER BY h;

-- 11. CONDITIONAL AGGREGATION: payments by status
SELECT COUNT(*) FILTER (WHERE status = 'Paid')      AS paid,
       COUNT(*) FILTER (WHERE status = 'Pending')   AS pending,
       COUNT(*) FILTER (WHERE status = 'Refunded')  AS refunded,
       SUM(amount) FILTER (WHERE status = 'Paid')   AS revenue
FROM payments;

-- 12. VIEW: live slot status
SELECT zone_name, slot_number, slot_type, occupied_now, bookings_today FROM v_slot_overview ORDER BY zone_id, slot_number LIMIT 15;

-- 13. TRIGGER OUTPUT: audit trail written automatically on every booking status change
SELECT * FROM booking_audit ORDER BY audit_id DESC LIMIT 10;

-- 14. INDEX USAGE: shows the planner using idx_bookings_slot_date for the availability check
EXPLAIN SELECT * FROM bookings WHERE slot_id = 1 AND booking_date = CURRENT_DATE + 1;

-- 15. TRANSACTION + TRIGGER demo: the second insert fails (slot already booked),
--     so the whole transaction is rolled back and no half-created booking remains.
-- BEGIN;
--   SELECT fn_create_booking(4, 4, 7, CURRENT_DATE + 4, '10:00', '12:00');
--   SELECT fn_create_booking(5, 5, 7, CURRENT_DATE + 4, '11:00', '13:00');   -- ERROR: Slot B-01 is already booked
-- ROLLBACK;

-- ---------------------------------------------------------------------
-- MongoDB (run in mongosh):  use scpms_logs
--   db.parking_events.find().sort({ts:-1}).limit(5)
--   db.parking_events.aggregate([{$group:{_id:"$event_type",count:{$sum:1}}},{$sort:{count:-1}}])
--   db.sensor_logs.aggregate([{$sort:{ts:-1}},{$group:{_id:"$slot_id",occupied:{$first:"$occupied"}}},
--                             {$group:{_id:"$occupied",slots:{$sum:1}}}])
-- ---------------------------------------------------------------------
