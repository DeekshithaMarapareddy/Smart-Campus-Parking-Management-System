import { query } from '@/lib/db';
import { route, json, intId } from '@/lib/api';
import { logEvent } from '@/lib/mongo';

export const POST = route(async (req, { user, params }) => {
  const id = intId(params.id, 'Booking');
  await query(`SELECT fn_cancel_booking($1, $2, $3)`, [id, user.user_id, user.role === 'Admin']);
  const { rows } = await query(`SELECT * FROM v_booking_details WHERE booking_id = $1`, [id]);
  logEvent('booking.cancelled', { booking_id: id, user_id: user.user_id, slot_id: rows[0]?.slot_id });
  return json({ booking: rows[0] });
});
