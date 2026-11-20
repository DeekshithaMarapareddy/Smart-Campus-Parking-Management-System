import { query } from '@/lib/db';
import { route, json, readBody, intId, text, oneOf, HttpError, COMPLAINT_CATEGORIES } from '@/lib/api';
import { logEvent } from '@/lib/mongo';

export const GET = route(async (req, { user }) => {
  const all = req.nextUrl.searchParams.get('all') === '1' && user.role === 'Admin';
  const { rows } = await query(
    `SELECT c.complaint_id, c.category, c.description, c.status, c.created_at, c.resolved_at,
            c.booking_id, u.user_id, u.name AS user_name, u.email AS user_email,
            s.slot_id, s.slot_number, z.zone_name
     FROM complaints c
     JOIN users u          ON u.user_id = c.user_id
     JOIN parking_slots s  ON s.slot_id = c.slot_id
     JOIN parking_zones z  ON z.zone_id = s.zone_id
     WHERE ($1::boolean OR c.user_id = $2)
     ORDER BY (c.status IN ('Open', 'In Progress')) DESC, c.created_at DESC`,
    [all, user.user_id]
  );
  return json({ complaints: rows });
});

export const POST = route(async (req, { user }) => {
  const body = await readBody(req);
  const slotId = intId(body.slot_id, 'Slot');
  const category = oneOf(body.category, 'Category', COMPLAINT_CATEGORIES);
  const description = text(body.description, 'Description', { min: 10, max: 1000 });

  let bookingId = null;
  if (body.booking_id) {
    bookingId = intId(body.booking_id, 'Booking');
    const { rows } = await query(`SELECT user_id FROM bookings WHERE booking_id = $1`, [bookingId]);
    if (!rows[0] || rows[0].user_id !== user.user_id) throw new HttpError(400, 'That booking is not yours');
  }

  const { rows } = await query(
    `INSERT INTO complaints (user_id, slot_id, booking_id, category, description)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [user.user_id, slotId, bookingId, category, description]
  );
  logEvent('complaint.raised', { user_id: user.user_id, slot_id: slotId, meta: { category } });
  return json({ complaint: rows[0] }, 201);
});
