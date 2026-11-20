/**
 * Demo data for SCPMS. Used by scripts/setup-db.js.
 * Every demo user except the admin has the password  Password@123
 * The admin password is  Admin@123
 */
const bcrypt = require('bcryptjs');

// small deterministic random generator so every setup gives the same data
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hh = (h) => `${String(h).padStart(2, '0')}:00`;

const USERS = [
  { name: 'Campus Admin', email: 'admin@scpms.edu', phone: '9800000001', role: 'Admin', pw: 'Admin@123', dept: 'Administration', desig: 'Parking Administrator' },
  { name: 'Dr. Ravi Kumar', email: 'ravi.kumar@scpms.edu', phone: '9800000002', role: 'Staff', dept: 'Computer Science', desig: 'Professor' },
  { name: 'Meena Iyer', email: 'meena.iyer@scpms.edu', phone: '9800000003', role: 'Staff', dept: 'Accounts Office', desig: 'Office Superintendent' },
  { name: 'Ananya Sharma', email: 'ananya@scpms.edu', phone: '9800000004', role: 'Student' },
  { name: 'Rahul Verma', email: 'rahul@scpms.edu', phone: '9800000005', role: 'Student' },
  { name: 'Priya Nair', email: 'priya@scpms.edu', phone: '9800000006', role: 'Student' },
  { name: 'Arjun Reddy', email: 'arjun@scpms.edu', phone: '9800000007', role: 'Student' },
  { name: 'Sneha Patel', email: 'sneha@scpms.edu', phone: '9800000008', role: 'Student' },
  { name: 'Karthik Rao', email: 'karthik@scpms.edu', phone: '9800000009', role: 'Student' },
];

const VEHICLES = [
  ['admin@scpms.edu', 'KA01AD0001', 'Car', 'Toyota Innova', 'Silver'],
  ['ravi.kumar@scpms.edu', 'KA01MN4521', 'Car', 'Honda City', 'White'],
  ['meena.iyer@scpms.edu', 'KA02PQ8812', 'Car', 'Maruti Swift', 'Red'],
  ['ananya@scpms.edu', 'KA05HJ2345', 'Bike', 'Honda Activa', 'Grey'],
  ['rahul@scpms.edu', 'KA03KL9087', 'Bike', 'Royal Enfield Classic', 'Black'],
  ['priya@scpms.edu', 'KA51EV7788', 'EV', 'Tata Nexon EV', 'Blue'],
  ['arjun@scpms.edu', 'KA04TV5566', 'Bike', 'TVS Apache', 'Red'],
  ['arjun@scpms.edu', 'KA04HI1020', 'Car', 'Hyundai i20', 'Orange'],
  ['sneha@scpms.edu', 'KA09SU3344', 'Bike', 'Suzuki Access', 'White'],
  ['karthik@scpms.edu', 'KA06BL7001', 'Car', 'Maruti Baleno', 'Blue'],
];

const ZONES = [
  { name: 'Main Academic Block', location: 'North Gate', description: 'Closest parking to lecture halls and labs.', status: 'Active', car: 6, bike: 4, ev: 0 },
  { name: 'Central Library', location: 'Library Road', description: 'Parking beside the central library.', status: 'Active', car: 5, bike: 4, ev: 0 },
  { name: 'Hostel Complex', location: 'East Campus', description: 'Mostly two-wheeler parking for hostel residents.', status: 'Active', car: 3, bike: 8, ev: 0 },
  { name: 'Sports Complex', location: 'South Campus', description: 'Stadium and gymnasium parking.', status: 'Active', car: 4, bike: 4, ev: 0 },
  { name: 'EV Charging Hub', location: 'Innovation Park', description: 'Electric vehicle parking with chargers.', status: 'Active', car: 0, bike: 0, ev: 6 },
  { name: 'Old Auditorium Lot', location: 'West Gate', description: 'Closed for resurfacing.', status: 'Inactive', car: 2, bike: 0, ev: 0 },
];

const PAY_METHODS = ['UPI', 'UPI', 'UPI', 'Card', 'Wallet', 'Cash'];

const txn = () => 'TXN' + Math.random().toString(16).slice(2, 14).toUpperCase().padEnd(12, '0');

async function seedPostgres(pg) {
  const rng = mulberry32(2026);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  // ---- users + staff ---------------------------------------------------
  const defaultHash = await bcrypt.hash('Password@123', 10);
  const adminHash = await bcrypt.hash('Admin@123', 10);
  const userId = {};
  for (const u of USERS) {
    const { rows } = await pg.query(
      `INSERT INTO users (name, email, phone, password, role) VALUES ($1,$2,$3,$4,$5) RETURNING user_id`,
      [u.name, u.email, u.phone, u.pw ? adminHash : defaultHash, u.role]
    );
    userId[u.email] = rows[0].user_id;
    if (u.role !== 'Student') {
      await pg.query(`INSERT INTO staff (user_id, department, designation) VALUES ($1,$2,$3)`, [
        rows[0].user_id, u.dept, u.desig,
      ]);
    }
  }

  // ---- vehicles --------------------------------------------------------
  const vehicleId = {};
  for (const [email, reg, type, model, color] of VEHICLES) {
    const { rows } = await pg.query(
      `INSERT INTO vehicles (user_id, reg_number, vehicle_type, model, color) VALUES ($1,$2,$3,$4,$5) RETURNING vehicle_id`,
      [userId[email], reg, type, model, color]
    );
    vehicleId[reg] = rows[0].vehicle_id;
  }

  // ---- zones + slots ---------------------------------------------------
  const slotId = {};
  for (const z of ZONES) {
    const { rows } = await pg.query(
      `INSERT INTO parking_zones (zone_name, location, description, status) VALUES ($1,$2,$3,$4) RETURNING zone_id`,
      [z.name, z.location, z.description, z.status]
    );
    const zid = rows[0].zone_id;
    const make = async (prefix, type, count) => {
      for (let i = 1; i <= count; i++) {
        const num = `${prefix}-${String(i).padStart(2, '0')}`;
        const r = await pg.query(
          `INSERT INTO parking_slots (zone_id, slot_number, slot_type, floor_no) VALUES ($1,$2,$3,$4) RETURNING slot_id`,
          [zid, num, type, 0]
        );
        slotId[`${z.name}|${num}`] = r.rows[0].slot_id;
      }
    };
    await make('C', 'Car', z.car);
    await make('B', 'Bike', z.bike);
    await make('E', 'EV', z.ev);
  }

  // ---- past bookings (completed / cancelled) over the last 14 days -----
  const { rows: allVehicles } = await pg.query(
    `SELECT v.vehicle_id, v.user_id, v.vehicle_type
     FROM vehicles v JOIN users u ON u.user_id = v.user_id
     WHERE u.role <> 'Admin'`
  );
  const { rows: openSlots } = await pg.query(
    `SELECT s.slot_id, s.slot_type
     FROM parking_slots s JOIN parking_zones z ON z.zone_id = s.zone_id
     WHERE z.status = 'Active' AND s.status = 'Available'`
  );

  const busy = new Map(); // "slot|day" or "veh|day" -> [[start,end], ...]
  const overlaps = (key, s, e) => (busy.get(key) || []).some(([a, b]) => a < e && b > s);
  const mark = (key, s, e) => busy.set(key, [...(busy.get(key) || []), [s, e]]);

  for (let off = -14; off <= -1; off++) {
    for (const v of allVehicles) {
      if (rng() > 0.55) continue;
      const start = 7 + Math.floor(rng() * 10);
      const end = start + 1 + Math.floor(rng() * 4);
      if (overlaps(`veh${v.vehicle_id}|${off}`, start, end)) continue;
      const candidates = openSlots.filter((s) => s.slot_type === v.vehicle_type);
      const slot = candidates.find((s) => !overlaps(`slot${s.slot_id}|${off}`, start, end)) &&
        (() => {
          const free = candidates.filter((s) => !overlaps(`slot${s.slot_id}|${off}`, start, end));
          return pick(free);
        })();
      if (!slot) continue;
      mark(`veh${v.vehicle_id}|${off}`, start, end);
      mark(`slot${slot.slot_id}|${off}`, start, end);

      const cancelled = rng() < 0.08;
      const { rows } = await pg.query(
        `INSERT INTO bookings (user_id, vehicle_id, slot_id, booking_date, start_time, end_time, status, created_at)
         VALUES ($1,$2,$3, CURRENT_DATE + $4::int, $5::time, $6::time, $7,
                 (CURRENT_DATE + $4::int + $5::time) - interval '1 day')
         RETURNING booking_id`,
        [v.user_id, v.vehicle_id, slot.slot_id, off, hh(start), hh(end), cancelled ? 'Cancelled' : 'Completed']
      );
      const bookingId = rows[0].booking_id;
      const paid = rng() < 0.9;
      let payStatus;
      if (cancelled) payStatus = paid && rng() < 0.5 ? 'Refunded' : 'Cancelled';
      else payStatus = paid ? 'Paid' : 'Pending';
      const hasTxn = payStatus === 'Paid' || payStatus === 'Refunded';

      await pg.query(
        `INSERT INTO payments (booking_id, amount, payment_method, payment_time, transaction_id, status)
         VALUES ($1, fn_calculate_fee($2, $3::time, $4::time), $5,
                 CASE WHEN $6::boolean THEN (CURRENT_DATE + $7::int + $3::time) - interval '2 hours' END,
                 CASE WHEN $6::boolean THEN $8 END, $9)`,
        [bookingId, slot.slot_id, hh(start), hh(end), pick(PAY_METHODS), hasTxn, off, txn(), payStatus]
      );
    }
  }

  // ---- upcoming bookings (through the stored functions) ----------------
  const upcoming = [
    ['KA05HJ2345', 'Main Academic Block', 'B-01', 1, '09:00', '13:00', 'UPI'],
    ['KA03KL9087', 'Central Library', 'B-02', 1, '10:00', '12:00', 'Card'],
    ['KA51EV7788', 'EV Charging Hub', 'E-01', 1, '08:00', '14:00', 'Wallet'],
    ['KA01MN4521', 'Main Academic Block', 'C-01', 1, '09:00', '17:00', 'UPI'],
    ['KA06BL7001', 'Central Library', 'C-02', 2, '11:00', '15:00', null],
    ['KA09SU3344', 'Hostel Complex', 'B-03', 2, '07:00', '09:00', 'Cash'],
    ['KA04HI1020', 'Sports Complex', 'C-01', 3, '16:00', '19:00', null],
  ];
  const ownerOf = Object.fromEntries(VEHICLES.map(([email, reg]) => [reg, userId[email]]));
  for (const [reg, zone, num, off, start, end, method] of upcoming) {
    const { rows } = await pg.query(
      `SELECT fn_create_booking($1, $2, $3, CURRENT_DATE + $4::int, $5::time, $6::time, $7) AS id`,
      [ownerOf[reg], vehicleId[reg], slotId[`${zone}|${num}`], off, start, end, method || 'UPI']
    );
    if (method) {
      await pg.query(`SELECT fn_pay_booking($1, $2, $3)`, [rows[0].id, ownerOf[reg], method]);
    }
  }

  // ---- complaints ------------------------------------------------------
  const complaints = [
    ['ananya@scpms.edu', 'Main Academic Block', 'B-02', 'Slot Occupied', 'Another bike was parked in my reserved slot when I arrived.', 'Resolved', 6],
    ['rahul@scpms.edu', 'Central Library', 'B-01', 'Damaged Slot', 'The slot marking is faded and the wheel stopper is broken.', 'In Progress', 3],
    ['karthik@scpms.edu', 'Central Library', 'C-03', 'Wrong Billing', 'I was charged for 4 hours but parked for only 2.', 'Open', 2],
    ['priya@scpms.edu', 'EV Charging Hub', 'E-03', 'Damaged Slot', 'The charger at this slot is not working.', 'Open', 1],
    ['sneha@scpms.edu', 'Hostel Complex', 'B-05', 'Safety', 'The light above this parking row has been off for a week.', 'In Progress', 4],
    ['ravi.kumar@scpms.edu', 'Main Academic Block', 'C-04', 'Other', 'Please add a covered parking option near the north gate.', 'Closed', 9],
  ];
  for (const [email, zone, num, category, description, status, daysAgo] of complaints) {
    const { rows } = await pg.query(
      `INSERT INTO complaints (user_id, slot_id, category, description, created_at)
       VALUES ($1,$2,$3,$4, now() - ($5 || ' days')::interval) RETURNING complaint_id`,
      [userId[email], slotId[`${zone}|${num}`], category, description, String(daysAgo)]
    );
    if (status !== 'Open') {
      await pg.query(`UPDATE complaints SET status = $1 WHERE complaint_id = $2`, [status, rows[0].complaint_id]);
    }
  }

  // bring statuses up to date for everything that already ended today
  await pg.query('SELECT fn_complete_expired_bookings()');
}

async function seedMongo(db, pg) {
  const events = db.collection('parking_events');
  const sensors = db.collection('sensor_logs');
  await events.deleteMany({});
  await sensors.deleteMany({});

  await events.createIndex({ ts: -1 });
  await events.createIndex({ event_type: 1, ts: -1 });
  await events.createIndex({ slot_id: 1, ts: -1 });
  await sensors.createIndex({ slot_id: 1, ts: -1 });
  await sensors.createIndex({ ts: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // keep sensor data 30 days

  // booking events rebuilt from the relational data
  const { rows: bookings } = await pg.query(
    `SELECT booking_id, user_id, slot_id, status, created_at,
            (booking_date + end_time) AS end_ts
     FROM bookings`
  );
  const eventDocs = [];
  for (const b of bookings) {
    eventDocs.push({ event_type: 'booking.created', booking_id: b.booking_id, user_id: b.user_id, slot_id: b.slot_id, ts: b.created_at, meta: { source: 'seed' } });
    if (b.status === 'Cancelled') {
      eventDocs.push({ event_type: 'booking.cancelled', booking_id: b.booking_id, user_id: b.user_id, slot_id: b.slot_id, ts: new Date(b.created_at.getTime() + 3600 * 1000), meta: { source: 'seed' } });
    } else if (b.status === 'Completed') {
      eventDocs.push({ event_type: 'booking.completed', booking_id: b.booking_id, user_id: b.user_id, slot_id: b.slot_id, ts: b.end_ts, meta: { source: 'seed' } });
    }
  }
  if (eventDocs.length) await events.insertMany(eventDocs);

  // simulated IoT sensor readings: every 2 hours for the last 24 hours
  const rng = mulberry32(99);
  const { rows: slots } = await pg.query(
    `SELECT s.slot_id, s.zone_id FROM parking_slots s
     JOIN parking_zones z ON z.zone_id = s.zone_id WHERE z.status = 'Active'`
  );
  const now = Date.now();
  const readings = [];
  for (const s of slots) {
    for (let h = 24; h >= 0; h -= 2) {
      readings.push({
        sensor_id: `SNS-${String(s.slot_id).padStart(3, '0')}`,
        slot_id: s.slot_id,
        zone_id: s.zone_id,
        occupied: rng() < 0.45,
        battery_pct: 60 + Math.floor(rng() * 40),
        signal_dbm: -90 + Math.floor(rng() * 40),
        ts: new Date(now - h * 3600 * 1000),
        source: 'seed',
      });
    }
  }
  if (readings.length) await sensors.insertMany(readings);
}

module.exports = { seedPostgres, seedMongo };
