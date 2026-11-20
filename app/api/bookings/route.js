import { query, withTransaction } from '@/lib/db';
import {
  route, json, readBody, intId, dateStr, timeStr, oneOf, HttpError, PAYMENT_METHODS,
} from '@/lib/api';
import { logEvent } from '@/lib/mongo';

export const GET = route(async (req, { user }) => {
  // bring statuses up to date first (stored function)
  await query('SELECT fn_complete_expired_bookings()');

  const sp = req.nextUrl.searchParams;
  const all = sp.get('all') === '1' && user.role === 'Admin';
  const status = sp.get('status');

  const { rows } = await query(
    `SELECT * FROM v_booking_details
     WHERE ($1::boolean OR user_id = $2)
       AND ($3::text IS NULL OR status = $3)
     ORDER BY (status = 'Booked') DESC,
              CASE WHEN status = 'Booked' THEN booking_date END ASC,
              CASE WHEN status = 'Booked' THEN start_time END ASC,
              booking_date DESC, start_time DESC
     LIMIT 300`,
    [all, user.user_id, status || null]
  );
  return json({ bookings: rows });
});

/**
 * Create a booking. Everything happens in ONE transaction:
 *   1. lock the slot row, validate (triggers) and insert the booking
 *   2. insert the pending payment
 *   3. optionally pay straight away
 * If any step fails nothing is saved.
 */
export const POST = route(async (req, { user }) => {
  const body = await readBody(req);
  const vehicleId = intId(body.vehicle_id, 'Vehicle');
  const slotId = intId(body.slot_id, 'Slot');
  const date = dateStr(body.date, 'Date');
  const start = timeStr(body.start, 'Start time');
  const end = timeStr(body.end, 'End time');
  if (end <= start) throw new HttpError(400, 'End time must be after the start time');
  const method = oneOf(body.payment_method || 'UPI', 'Payment method', PAYMENT_METHODS);
  const payNow = body.pay_now === true;

  const result = await withTransaction(async (client) => {
    const created = await client.query(
      `SELECT fn_create_booking($1, $2, $3, $4::date, $5::time, $6::time, $7) AS booking_id`,
      [user.user_id, vehicleId, slotId, date, start, end, method]
    );
    const bookingId = created.rows[0].booking_id;

    let transactionId = null;
    if (payNow) {
      const paid = await client.query(`SELECT fn_pay_booking($1, $2, $3) AS txn`, [bookingId, user.user_id, method]);
      transactionId = paid.rows[0].txn;
    }
    const { rows } = await client.query(`SELECT * FROM v_booking_details WHERE booking_id = $1`, [bookingId]);
    return { booking: rows[0], transactionId };
  });

  logEvent('booking.created', {
    booking_id: result.booking.booking_id,
    user_id: user.user_id,
    slot_id: slotId,
    meta: { date, start, end, paid: payNow },
  });
  if (result.transactionId) {
    logEvent('payment.paid', { booking_id: result.booking.booking_id, user_id: user.user_id, meta: { method } });
  }
  return json(result, 201);
});
