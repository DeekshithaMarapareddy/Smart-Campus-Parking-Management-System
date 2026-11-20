import { query } from '@/lib/db';
import { route, json, readBody, intId, oneOf, PAYMENT_METHODS } from '@/lib/api';
import { logEvent } from '@/lib/mongo';

export const POST = route(async (req, { user, params }) => {
  const id = intId(params.id, 'Booking');
  const body = await readBody(req);
  const method = oneOf(body.payment_method || 'UPI', 'Payment method', PAYMENT_METHODS);

  const { rows: paid } = await query(`SELECT fn_pay_booking($1, $2, $3) AS txn`, [id, user.user_id, method]);
  const { rows } = await query(`SELECT * FROM v_booking_details WHERE booking_id = $1`, [id]);
  logEvent('payment.paid', { booking_id: id, user_id: user.user_id, meta: { method } });
  return json({ booking: rows[0], transactionId: paid[0].txn });
});
