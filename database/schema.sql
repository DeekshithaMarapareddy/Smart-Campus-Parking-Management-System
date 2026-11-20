-- =====================================================================
--  Smart Campus Parking Management System (SCPMS)
--  PostgreSQL schema: tables, constraints, indexes, triggers,
--  stored functions and views.
--
--  WARNING: this file starts by dropping and recreating the "public"
--  schema, so running it wipes the SCPMS data. Use on a dev database.
-- =====================================================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- ---------------------------------------------------------------------
-- 1. TABLES  (follows the ER diagram)
-- ---------------------------------------------------------------------

CREATE TABLE users (
    user_id     SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) NOT NULL UNIQUE,
    phone       VARCHAR(20),
    password    VARCHAR(255) NOT NULL,                 -- bcrypt hash
    role        VARCHAR(10)  NOT NULL DEFAULT 'Student'
                CHECK (role IN ('Admin', 'Staff', 'Student')),
    status      VARCHAR(10)  NOT NULL DEFAULT 'Active'
                CHECK (status IN ('Active', 'Inactive', 'Blocked')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_users_email CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

-- USERS 1 --< STAFF  (MANAGED_BY)
CREATE TABLE staff (
    staff_id     SERIAL PRIMARY KEY,
    user_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    department   VARCHAR(100) NOT NULL,
    designation  VARCHAR(100) NOT NULL
);

-- USERS 1 --< VEHICLES  (OWNS VEHICLE). user_id is an optional attribute in the ER diagram.
CREATE TABLE vehicles (
    vehicle_id    SERIAL PRIMARY KEY,
    user_id       INT REFERENCES users(user_id) ON DELETE SET NULL,
    reg_number    VARCHAR(20) NOT NULL UNIQUE,
    vehicle_type  VARCHAR(10) NOT NULL CHECK (vehicle_type IN ('Car', 'Bike', 'EV')),
    model         VARCHAR(60),
    color         VARCHAR(30),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    status        VARCHAR(10) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive'))
);

CREATE TABLE parking_zones (
    zone_id      SERIAL PRIMARY KEY,
    zone_name    VARCHAR(100) NOT NULL UNIQUE,
    location     VARCHAR(150),
    description  TEXT,
    status       VARCHAR(12) NOT NULL DEFAULT 'Active'
                 CHECK (status IN ('Active', 'Inactive', 'Maintenance'))
);

-- PARKING_ZONES 1 --< PARKING_SLOTS  (HAS)
CREATE TABLE parking_slots (
    slot_id      SERIAL PRIMARY KEY,
    zone_id      INT NOT NULL REFERENCES parking_zones(zone_id) ON DELETE CASCADE,
    slot_number  VARCHAR(10) NOT NULL,
    slot_type    VARCHAR(10) NOT NULL CHECK (slot_type IN ('Car', 'Bike', 'EV')),
    floor_no     INT NOT NULL DEFAULT 0,
    status       VARCHAR(12) NOT NULL DEFAULT 'Available'
                 CHECK (status IN ('Available', 'Maintenance')),
    UNIQUE (zone_id, slot_number)
);

-- USERS / VEHICLES / PARKING_SLOTS 1 --< BOOKINGS
CREATE TABLE bookings (
    booking_id    SERIAL PRIMARY KEY,
    user_id       INT  NOT NULL REFERENCES users(user_id),
    vehicle_id    INT  NOT NULL REFERENCES vehicles(vehicle_id),
    slot_id       INT  NOT NULL REFERENCES parking_slots(slot_id),
    booking_date  DATE NOT NULL,
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    status        VARCHAR(10) NOT NULL DEFAULT 'Booked'
                  CHECK (status IN ('Booked', 'Completed', 'Cancelled')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_booking_time CHECK (end_time > start_time)
);

-- BOOKINGS 1 --< PAYMENTS  (HAS)
CREATE TABLE payments (
    payment_id      SERIAL PRIMARY KEY,
    booking_id      INT NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    amount          NUMERIC(8, 2) NOT NULL CHECK (amount >= 0),
    payment_method  VARCHAR(10) NOT NULL DEFAULT 'UPI'
                    CHECK (payment_method IN ('UPI', 'Card', 'Cash', 'Wallet')),
    payment_time    TIMESTAMPTZ,                       -- set when the payment is made
    transaction_id  VARCHAR(40) UNIQUE,
    status          VARCHAR(10) NOT NULL DEFAULT 'Pending'
                    CHECK (status IN ('Pending', 'Paid', 'Failed', 'Refunded', 'Cancelled'))
);

-- BOOKINGS 1 --< COMPLAINTS  (RAISES). booking_id is optional.
CREATE TABLE complaints (
    complaint_id  SERIAL PRIMARY KEY,
    user_id       INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    slot_id       INT NOT NULL REFERENCES parking_slots(slot_id) ON DELETE CASCADE,
    booking_id    INT REFERENCES bookings(booking_id) ON DELETE SET NULL,
    category      VARCHAR(30) NOT NULL
                  CHECK (category IN ('Slot Occupied', 'Wrong Billing', 'Damaged Slot', 'Safety', 'Other')),
    description   TEXT NOT NULL,
    status        VARCHAR(12) NOT NULL DEFAULT 'Open'
                  CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMPTZ
);

-- Extra table (not in the ER diagram): written by a trigger to keep a
-- history of every booking status change.
CREATE TABLE booking_audit (
    audit_id    SERIAL PRIMARY KEY,
    booking_id  INT NOT NULL,
    old_status  VARCHAR(10),
    new_status  VARCHAR(10) NOT NULL,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------

CREATE INDEX idx_vehicles_user          ON vehicles (user_id);
CREATE INDEX idx_slots_zone_type        ON parking_slots (zone_id, slot_type);
CREATE INDEX idx_bookings_slot_date     ON bookings (slot_id, booking_date);          -- availability / overlap check
CREATE INDEX idx_bookings_vehicle_date  ON bookings (vehicle_id, booking_date);
CREATE INDEX idx_bookings_user          ON bookings (user_id, booking_date DESC);
CREATE INDEX idx_bookings_active        ON bookings (booking_date, start_time)
                                        WHERE status = 'Booked';                      -- partial index
CREATE INDEX idx_payments_booking       ON payments (booking_id);
CREATE INDEX idx_payments_paid_time     ON payments (payment_time) WHERE status = 'Paid';
CREATE INDEX idx_complaints_status      ON complaints (status);
CREATE INDEX idx_complaints_user        ON complaints (user_id);
CREATE INDEX idx_audit_booking          ON booking_audit (booking_id);

-- ---------------------------------------------------------------------
-- 3. STORED FUNCTIONS
-- ---------------------------------------------------------------------

-- Parking fee: hourly rate by slot type, rounded up to the next full hour.
CREATE OR REPLACE FUNCTION fn_calculate_fee(p_slot_id INT, p_start TIME, p_end TIME)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_type  TEXT;
    v_rate  NUMERIC;
    v_hours NUMERIC;
BEGIN
    SELECT slot_type INTO v_type FROM parking_slots WHERE slot_id = p_slot_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Slot % does not exist', p_slot_id;
    END IF;

    v_rate  := CASE v_type WHEN 'Car' THEN 20 WHEN 'Bike' THEN 10 WHEN 'EV' THEN 30 END;
    v_hours := CEIL(EXTRACT(EPOCH FROM (p_end - p_start))::NUMERIC / 3600);
    RETURN v_rate * v_hours;
END;
$$;

-- Is a slot free (and usable) for the given window?
CREATE OR REPLACE FUNCTION fn_is_slot_available(p_slot_id INT, p_date DATE, p_start TIME, p_end TIME)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
               SELECT 1
               FROM parking_slots s
               JOIN parking_zones z ON z.zone_id = s.zone_id
               WHERE s.slot_id = p_slot_id
                 AND s.status = 'Available'
                 AND z.status = 'Active')
       AND NOT EXISTS (
               SELECT 1
               FROM bookings b
               WHERE b.slot_id = p_slot_id
                 AND b.booking_date = p_date
                 AND b.status = 'Booked'
                 AND b.start_time < p_end
                 AND b.end_time   > p_start);
$$;

-- Create a booking and its pending payment atomically.
-- The slot row is locked first so two people cannot grab the same slot
-- at the same moment (the validation trigger then sees the committed row).
CREATE OR REPLACE FUNCTION fn_create_booking(
    p_user_id INT, p_vehicle_id INT, p_slot_id INT,
    p_date DATE, p_start TIME, p_end TIME,
    p_method VARCHAR DEFAULT 'UPI')
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    v_booking_id INT;
    v_fee        NUMERIC;
BEGIN
    PERFORM 1 FROM parking_slots WHERE slot_id = p_slot_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Slot % does not exist', p_slot_id;
    END IF;

    INSERT INTO bookings (user_id, vehicle_id, slot_id, booking_date, start_time, end_time)
    VALUES (p_user_id, p_vehicle_id, p_slot_id, p_date, p_start, p_end)
    RETURNING booking_id INTO v_booking_id;

    v_fee := fn_calculate_fee(p_slot_id, p_start, p_end);

    INSERT INTO payments (booking_id, amount, payment_method, status)
    VALUES (v_booking_id, v_fee, p_method, 'Pending');

    RETURN v_booking_id;
END;
$$;

-- Pay the pending payment of a booking.
CREATE OR REPLACE FUNCTION fn_pay_booking(p_booking_id INT, p_user_id INT, p_method VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql AS $$
DECLARE
    v_booking  bookings%ROWTYPE;
    v_payment  INT;
    v_txn      VARCHAR;
BEGIN
    SELECT * INTO v_booking FROM bookings WHERE booking_id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;
    IF v_booking.user_id <> p_user_id THEN
        RAISE EXCEPTION 'You can only pay for your own bookings';
    END IF;
    IF v_booking.status = 'Cancelled' THEN
        RAISE EXCEPTION 'This booking was cancelled';
    END IF;

    SELECT payment_id INTO v_payment
    FROM payments
    WHERE booking_id = p_booking_id AND status = 'Pending'
    ORDER BY payment_id DESC LIMIT 1;
    IF v_payment IS NULL THEN
        RAISE EXCEPTION 'There is no pending payment for this booking';
    END IF;

    v_txn := 'TXN' || upper(substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 12));

    UPDATE payments
    SET status = 'Paid', payment_method = p_method, payment_time = now(), transaction_id = v_txn
    WHERE payment_id = v_payment;

    RETURN v_txn;
END;
$$;

-- Cancel a booking (owner or admin). A started booking can only be cancelled by an admin.
CREATE OR REPLACE FUNCTION fn_cancel_booking(p_booking_id INT, p_user_id INT, p_is_admin BOOLEAN DEFAULT FALSE)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_booking bookings%ROWTYPE;
BEGIN
    SELECT * INTO v_booking FROM bookings WHERE booking_id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;
    IF v_booking.user_id <> p_user_id AND NOT p_is_admin THEN
        RAISE EXCEPTION 'You can only cancel your own bookings';
    END IF;
    IF v_booking.status <> 'Booked' THEN
        RAISE EXCEPTION 'Only active bookings can be cancelled (this one is %)', v_booking.status;
    END IF;
    IF NOT p_is_admin AND (v_booking.booking_date + v_booking.start_time) <= LOCALTIMESTAMP THEN
        RAISE EXCEPTION 'A booking that has already started cannot be cancelled';
    END IF;

    UPDATE bookings SET status = 'Cancelled' WHERE booking_id = p_booking_id;
    -- the trigger trg_booking_cancel_payments handles the payment side
END;
$$;

-- Mark every booking whose end time has passed as Completed.
CREATE OR REPLACE FUNCTION fn_complete_expired_bookings()
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE bookings
    SET status = 'Completed'
    WHERE status = 'Booked'
      AND (booking_date + end_time) < LOCALTIMESTAMP;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Utilization per zone for a date range.
-- Utilization % = booked hours / (slots x days x 16 operating hours).
CREATE OR REPLACE FUNCTION fn_zone_utilization(p_from DATE, p_to DATE)
RETURNS TABLE (
    zone_id        INT,
    zone_name      TEXT,
    total_slots    INT,
    total_bookings INT,
    hours_booked   NUMERIC,
    utilization_pct NUMERIC
)
LANGUAGE sql STABLE AS $$
    SELECT z.zone_id,
           z.zone_name::TEXT,
           COUNT(DISTINCT s.slot_id)::INT,
           COUNT(b.booking_id)::INT,
           COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (b.end_time - b.start_time))::NUMERIC / 3600), 1), 0),
           CASE WHEN COUNT(DISTINCT s.slot_id) = 0 THEN 0
                ELSE ROUND(100 * COALESCE(SUM(EXTRACT(EPOCH FROM (b.end_time - b.start_time))::NUMERIC / 3600), 0)
                          / (COUNT(DISTINCT s.slot_id) * (p_to - p_from + 1) * 16), 1)
           END
    FROM parking_zones z
    LEFT JOIN parking_slots s ON s.zone_id = z.zone_id
    LEFT JOIN bookings b      ON b.slot_id = s.slot_id
                             AND b.status <> 'Cancelled'
                             AND b.booking_date BETWEEN p_from AND p_to
    GROUP BY z.zone_id, z.zone_name
    ORDER BY z.zone_id;
$$;

-- ---------------------------------------------------------------------
-- 4. TRIGGERS
-- ---------------------------------------------------------------------

-- 4.1 Validate every new / changed active booking (business rules + double-booking guard)
CREATE OR REPLACE FUNCTION trg_fn_validate_booking()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_user_status  TEXT;
    v_veh          vehicles%ROWTYPE;
    v_slot         parking_slots%ROWTYPE;
    v_zone_status  TEXT;
BEGIN
    IF NEW.status <> 'Booked' THEN
        RETURN NEW;                              -- only active bookings are validated
    END IF;

    SELECT status INTO v_user_status FROM users WHERE user_id = NEW.user_id;
    IF v_user_status IS DISTINCT FROM 'Active' THEN
        RAISE EXCEPTION 'Your account is not active, so you cannot book a slot';
    END IF;

    SELECT * INTO v_veh FROM vehicles WHERE vehicle_id = NEW.vehicle_id;
    IF NOT FOUND OR v_veh.user_id IS DISTINCT FROM NEW.user_id THEN
        RAISE EXCEPTION 'This vehicle is not registered to you';
    END IF;
    IF v_veh.status <> 'Active' THEN
        RAISE EXCEPTION 'Vehicle % is inactive', v_veh.reg_number;
    END IF;

    SELECT * INTO v_slot FROM parking_slots WHERE slot_id = NEW.slot_id;
    SELECT status INTO v_zone_status FROM parking_zones WHERE zone_id = v_slot.zone_id;
    IF v_slot.status <> 'Available' OR v_zone_status <> 'Active' THEN
        RAISE EXCEPTION 'Slot % is not open for booking right now', v_slot.slot_number;
    END IF;
    IF v_slot.slot_type <> v_veh.vehicle_type THEN
        RAISE EXCEPTION 'Slot % is a % slot, but your vehicle is a %',
                        v_slot.slot_number, v_slot.slot_type, v_veh.vehicle_type;
    END IF;

    IF NEW.start_time < TIME '06:00' OR NEW.end_time > TIME '22:00' THEN
        RAISE EXCEPTION 'Parking is open from 06:00 to 22:00 only';
    END IF;

    IF TG_OP = 'INSERT' AND (NEW.booking_date + NEW.end_time) <= LOCALTIMESTAMP THEN
        RAISE EXCEPTION 'You cannot book a time that has already passed';
    END IF;

    IF EXISTS (SELECT 1 FROM bookings b
               WHERE b.slot_id = NEW.slot_id
                 AND b.booking_id <> NEW.booking_id
                 AND b.booking_date = NEW.booking_date
                 AND b.status = 'Booked'
                 AND b.start_time < NEW.end_time
                 AND b.end_time   > NEW.start_time) THEN
        RAISE EXCEPTION 'Slot % is already booked for that time', v_slot.slot_number;
    END IF;

    IF EXISTS (SELECT 1 FROM bookings b
               WHERE b.vehicle_id = NEW.vehicle_id
                 AND b.booking_id <> NEW.booking_id
                 AND b.booking_date = NEW.booking_date
                 AND b.status = 'Booked'
                 AND b.start_time < NEW.end_time
                 AND b.end_time   > NEW.start_time) THEN
        RAISE EXCEPTION 'Vehicle % already has a booking that overlaps this time', v_veh.reg_number;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_validate
BEFORE INSERT OR UPDATE OF user_id, vehicle_id, slot_id, booking_date, start_time, end_time, status
ON bookings
FOR EACH ROW EXECUTE FUNCTION trg_fn_validate_booking();

-- 4.2 Audit trail of booking status changes
CREATE OR REPLACE FUNCTION trg_fn_booking_audit()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO booking_audit (booking_id, old_status, new_status)
        VALUES (NEW.booking_id, NULL, NEW.status);
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO booking_audit (booking_id, old_status, new_status)
        VALUES (NEW.booking_id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_audit
AFTER INSERT OR UPDATE OF status ON bookings
FOR EACH ROW EXECUTE FUNCTION trg_fn_booking_audit();

-- 4.3 When a booking is cancelled: refund paid payments, cancel pending ones
CREATE OR REPLACE FUNCTION trg_fn_booking_cancel_payments()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'Cancelled' AND OLD.status = 'Booked' THEN
        UPDATE payments
        SET status = CASE status WHEN 'Paid' THEN 'Refunded' ELSE 'Cancelled' END
        WHERE booking_id = NEW.booking_id
          AND status IN ('Paid', 'Pending');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_cancel_payments
AFTER UPDATE OF status ON bookings
FOR EACH ROW EXECUTE FUNCTION trg_fn_booking_cancel_payments();

-- 4.4 Complaint resolved_at is maintained automatically
CREATE OR REPLACE FUNCTION trg_fn_complaint_resolved_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IN ('Resolved', 'Closed') THEN
        IF OLD.status NOT IN ('Resolved', 'Closed') THEN
            NEW.resolved_at := now();
        END IF;
    ELSE
        NEW.resolved_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_complaint_resolved_at
BEFORE UPDATE OF status ON complaints
FOR EACH ROW EXECUTE FUNCTION trg_fn_complaint_resolved_at();

-- 4.5 A slot with upcoming bookings cannot be moved to Maintenance
CREATE OR REPLACE FUNCTION trg_fn_slot_maintenance_guard()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_upcoming INT;
BEGIN
    IF NEW.status = 'Maintenance' AND OLD.status <> 'Maintenance' THEN
        SELECT COUNT(*) INTO v_upcoming
        FROM bookings
        WHERE slot_id = NEW.slot_id
          AND status = 'Booked'
          AND (booking_date + end_time) > LOCALTIMESTAMP;
        IF v_upcoming > 0 THEN
            RAISE EXCEPTION 'Slot % has % upcoming booking(s). Cancel them before starting maintenance',
                            NEW.slot_number, v_upcoming;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_slot_maintenance_guard
BEFORE UPDATE OF status ON parking_slots
FOR EACH ROW EXECUTE FUNCTION trg_fn_slot_maintenance_guard();

-- ---------------------------------------------------------------------
-- 5. VIEWS
-- ---------------------------------------------------------------------

-- Everything about a booking in one row (5-table join + latest payment)
CREATE OR REPLACE VIEW v_booking_details AS
SELECT b.booking_id, b.booking_date, b.start_time, b.end_time, b.status, b.created_at,
       u.user_id, u.name AS user_name, u.email AS user_email, u.role AS user_role,
       v.vehicle_id, v.reg_number, v.vehicle_type, v.model AS vehicle_model,
       s.slot_id, s.slot_number, s.slot_type, s.floor_no,
       z.zone_id, z.zone_name,
       p.payment_id, p.amount, p.payment_method, p.status AS payment_status,
       p.transaction_id, p.payment_time
FROM bookings b
JOIN users u          ON u.user_id    = b.user_id
JOIN vehicles v       ON v.vehicle_id = b.vehicle_id
JOIN parking_slots s  ON s.slot_id    = b.slot_id
JOIN parking_zones z  ON z.zone_id    = s.zone_id
LEFT JOIN LATERAL (
    SELECT * FROM payments pp WHERE pp.booking_id = b.booking_id ORDER BY pp.payment_id DESC LIMIT 1
) p ON TRUE;

-- Live status of every slot
CREATE OR REPLACE VIEW v_slot_overview AS
SELECT s.slot_id, s.slot_number, s.slot_type, s.floor_no, s.status AS slot_status,
       z.zone_id, z.zone_name, z.status AS zone_status,
       EXISTS (SELECT 1 FROM bookings b
               WHERE b.slot_id = s.slot_id AND b.status = 'Booked'
                 AND b.booking_date = CURRENT_DATE
                 AND LOCALTIME >= b.start_time AND LOCALTIME < b.end_time) AS occupied_now,
       (SELECT COUNT(*) FROM bookings b
        WHERE b.slot_id = s.slot_id AND b.status = 'Booked'
          AND b.booking_date = CURRENT_DATE)::INT AS bookings_today
FROM parking_slots s
JOIN parking_zones z ON z.zone_id = s.zone_id;

-- Revenue per day and payment method (paid payments only)
CREATE OR REPLACE VIEW v_daily_revenue AS
SELECT payment_time::DATE AS pay_date,
       payment_method,
       COUNT(*)::INT      AS payments,
       SUM(amount)        AS revenue
FROM payments
WHERE status = 'Paid'
GROUP BY payment_time::DATE, payment_method;

-- Per-user activity summary (correlated subqueries avoid row multiplication across joins)
CREATE OR REPLACE VIEW v_user_activity AS
SELECT u.user_id, u.name, u.email, u.role, u.status,
       (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.user_id)::INT AS total_bookings,
       (SELECT COUNT(*) FROM bookings b
        WHERE b.user_id = u.user_id AND b.status = 'Cancelled')::INT      AS cancelled_bookings,
       COALESCE((SELECT SUM(p.amount) FROM payments p
                 JOIN bookings b ON b.booking_id = p.booking_id
                 WHERE b.user_id = u.user_id AND p.status = 'Paid'), 0)   AS total_spent,
       (SELECT COUNT(*) FROM complaints c WHERE c.user_id = u.user_id)::INT AS complaints_raised
FROM users u;
