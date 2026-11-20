'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, useLoad, fmtDate, fmtTime, money, todayISO } from '@/lib/client';
import { Alert, PageHead, Spinner } from '@/components/ui';

const hour = (h) => `${String(h).padStart(2, '0')}:00`;
const START_HOURS = Array.from({ length: 16 }, (_, i) => 6 + i); // 06:00 .. 21:00
const END_HOURS = Array.from({ length: 16 }, (_, i) => 7 + i); // 07:00 .. 22:00

export default function BookPage() {
  const vehiclesQ = useLoad(() => api('/api/vehicles'));
  const zonesQ = useLoad(() => api('/api/zones'));

  const [vehicleId, setVehicleId] = useState('');
  const [date, setDate] = useState(todayISO(1));
  const [start, setStart] = useState(hour(9));
  const [end, setEnd] = useState(hour(11));
  const [zone, setZone] = useState('');

  const [slots, setSlots] = useState(null); // null = not searched yet
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [method, setMethod] = useState('UPI');
  const [payNow, setPayNow] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const vehicles = (vehiclesQ.data?.vehicles || []).filter((v) => v.status === 'Active');
  const vehicle = vehicles.find((v) => String(v.vehicle_id) === String(vehicleId));

  useEffect(() => {
    if (!vehicleId && vehicles.length) setVehicleId(String(vehicles[0].vehicle_id));
  }, [vehicles, vehicleId]);

  // a new search invalidates the old result
  useEffect(() => {
    setSlots(null);
    setSelected(null);
  }, [vehicleId, date, start, end, zone]);

  async function search(e) {
    e.preventDefault();
    setError('');
    setDone(null);
    if (end <= start) return setError('End time must be after the start time.');
    setSearching(true);
    try {
      const qs = new URLSearchParams({ date, start, end, type: vehicle.vehicle_type });
      if (zone) qs.set('zone', zone);
      const data = await api(`/api/slots/available?${qs}`);
      setSlots(data.slots);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function confirm() {
    setError('');
    setBooking(true);
    try {
      const res = await api('/api/bookings', {
        method: 'POST',
        body: { vehicle_id: Number(vehicleId), slot_id: selected.slot_id, date, start, end, pay_now: payNow, payment_method: method },
      });
      setDone({ ...res, slot: selected });
      setSlots(null);
      setSelected(null);
    } catch (err) {
      setError(err.message);
      // the slot may have just been taken, so refresh the list
      setSlots(null);
      setSelected(null);
    } finally {
      setBooking(false);
    }
  }

  if (vehiclesQ.loading || zonesQ.loading) return <Spinner />;

  if (vehicles.length === 0) {
    return (
      <>
        <PageHead title="Book a parking slot" />
        <div className="card">
          <p>You need an active vehicle before you can book a slot.</p>
          <Link href="/vehicles" className="btn">Add a vehicle</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead title="Book a parking slot" subtitle="Pick your vehicle and time, then choose from the free slots." />

      {done && (
        <Alert type="success">
          Booked! {done.booking.zone_name}, slot {done.booking.slot_number} on {fmtDate(done.booking.booking_date)},{' '}
          {fmtTime(done.booking.start_time)} – {fmtTime(done.booking.end_time)}.{' '}
          {done.transactionId ? `Paid ${money(done.booking.amount)} (ref ${done.transactionId}).` : `Fee ${money(done.booking.amount)} is still to be paid.`}{' '}
          <Link href="/bookings">View my bookings</Link>
        </Alert>
      )}
      <Alert>{error}</Alert>

      <form className="card mb" onSubmit={search}>
        <div className="row">
          <div className="field">
            <label>Vehicle</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              {vehicles.map((v) => (
                <option key={v.vehicle_id} value={v.vehicle_id}>{v.reg_number} ({v.vehicle_type})</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>From</label>
            <select value={start} onChange={(e) => setStart(e.target.value)}>
              {START_HOURS.map((h) => <option key={h} value={hour(h)}>{fmtTime(hour(h))}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Until</label>
            <select value={end} onChange={(e) => setEnd(e.target.value)}>
              {END_HOURS.map((h) => <option key={h} value={hour(h)}>{fmtTime(hour(h))}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Zone</label>
            <select value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">Any zone</option>
              {zonesQ.data.zones.filter((z) => z.status === 'Active').map((z) => (
                <option key={z.zone_id} value={z.zone_id}>{z.zone_name}</option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn" disabled={searching}>{searching ? 'Searching…' : 'Find free slots'}</button>
        <span className="small muted" style={{ marginLeft: 12 }}>
          Only {vehicle?.vehicle_type} slots are shown for this vehicle. Parking is open 6 AM – 10 PM.
        </span>
      </form>

      {slots && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', alignItems: 'start' }}>
          <div className="card">
            <div className="card-head">
              <h2>{slots.length} free slot{slots.length === 1 ? '' : 's'}</h2>
            </div>
            {slots.length === 0 ? (
              <div className="empty">Nothing is free for that time. Try another time or zone.</div>
            ) : (
              <div className="grid auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
                {slots.map((s) => (
                  <button
                    type="button"
                    key={s.slot_id}
                    className={`slot-card ${selected?.slot_id === s.slot_id ? 'selected' : ''}`}
                    onClick={() => setSelected(s)}
                  >
                    <div className="num">{s.slot_number}</div>
                    <div className="small">{s.zone_name}</div>
                    <div className="small muted">{s.location}</div>
                    <div style={{ marginTop: 6 }}><b>{money(s.fee)}</b></div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2>Confirm</h2>
            {!selected ? (
              <p className="muted">Choose a slot to continue.</p>
            ) : (
              <>
                <p>
                  <b>{selected.zone_name}</b>, slot <b>{selected.slot_number}</b>
                  <br />
                  {fmtDate(date)}, {fmtTime(start)} – {fmtTime(end)}
                  <br />
                  Vehicle {vehicle.reg_number}
                </p>
                <p style={{ fontSize: '1.3rem', fontWeight: 750 }}>{money(selected.fee)}</p>
                <div className="field">
                  <label>Payment method</label>
                  <select value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option>UPI</option>
                    <option>Card</option>
                    <option>Wallet</option>
                    <option>Cash</option>
                  </select>
                </div>
                <label className="check field">
                  <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} />
                  Pay now (otherwise pay later from My bookings)
                </label>
                <button className="btn block" onClick={confirm} disabled={booking}>
                  {booking ? 'Booking…' : payNow ? `Book and pay ${money(selected.fee)}` : 'Book slot'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
