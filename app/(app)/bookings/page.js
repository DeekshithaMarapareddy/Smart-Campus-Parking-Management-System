'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { api, useLoad, fmtDate, fmtTime, money } from '@/lib/client';
import { Alert, Badge, PageHead, Spinner } from '@/components/ui';

export default function BookingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('upcoming');
  const [everyone, setEveryone] = useState(false);
  const { data, error, loading, reload } = useLoad(
    () => api(`/api/bookings${everyone ? '?all=1' : ''}`),
    [everyone]
  );
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const [payMethod, setPayMethod] = useState({});
  const [busyId, setBusyId] = useState(null);

  async function act(id, fn, okText) {
    setBusyId(id);
    setMsg({ type: 'error', text: '' });
    try {
      const res = await fn();
      setMsg({ type: 'success', text: okText(res) });
      await reload();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusyId(null);
    }
  }

  const pay = (b) =>
    act(b.booking_id, () => api(`/api/bookings/${b.booking_id}/pay`, { method: 'POST', body: { payment_method: payMethod[b.booking_id] || 'UPI' } }),
      (r) => `Payment received. Reference ${r.transactionId}.`);

  const cancel = (b) => {
    if (!confirm(`Cancel booking #${b.booking_id}?${b.payment_status === 'Paid' ? ' Your payment will be refunded.' : ''}`)) return;
    act(b.booking_id, () => api(`/api/bookings/${b.booking_id}/cancel`, { method: 'POST' }),
      () => 'Booking cancelled.');
  };

  const all = data?.bookings || [];
  const rows = all.filter((b) => (tab === 'upcoming' ? b.status === 'Booked' : b.status !== 'Booked'));
  const mine = (b) => b.user_id === user.user_id;

  return (
    <>
      <PageHead title={everyone ? 'All bookings' : 'My bookings'} subtitle="Upcoming reservations and your parking history.">
        {user.role === 'Admin' && (
          <label className="check" style={{ marginBottom: 0 }}>
            <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} />
            Show everyone&apos;s bookings
          </label>
        )}
        <Link href="/book" className="btn">New booking</Link>
      </PageHead>

      <Alert type={msg.type}>{msg.text}</Alert>

      <div className="tabs">
        <button className={`tab ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
          Upcoming ({all.filter((b) => b.status === 'Booked').length})
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          History ({all.filter((b) => b.status !== 'Booked').length})
        </button>
      </div>

      <div className="card flush">
        {loading ? (
          <Spinner />
        ) : error ? (
          <Alert>{error}</Alert>
        ) : rows.length === 0 ? (
          <div className="empty">{tab === 'upcoming' ? 'No upcoming bookings.' : 'No past bookings yet.'}</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  {everyone && <th>User</th>}
                  <th>When</th>
                  <th>Where</th>
                  <th>Vehicle</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.booking_id}>
                    <td className="muted">{b.booking_id}</td>
                    {everyone && <td>{b.user_name}<div className="small muted">{b.user_role}</div></td>}
                    <td>
                      {fmtDate(b.booking_date)}
                      <div className="small muted">{fmtTime(b.start_time)} – {fmtTime(b.end_time)}</div>
                    </td>
                    <td>
                      {b.zone_name}
                      <div className="small muted">Slot {b.slot_number} ({b.slot_type})</div>
                    </td>
                    <td>{b.reg_number}</td>
                    <td>
                      {money(b.amount)}
                      <div><Badge>{b.payment_status || 'Pending'}</Badge></div>
                    </td>
                    <td><Badge>{b.status}</Badge></td>
                    <td className="right nowrap">
                      {b.status !== 'Cancelled' && b.payment_status === 'Pending' && mine(b) && (
                        <>
                          <select
                            value={payMethod[b.booking_id] || 'UPI'}
                            onChange={(e) => setPayMethod({ ...payMethod, [b.booking_id]: e.target.value })}
                          >
                            <option>UPI</option><option>Card</option><option>Wallet</option><option>Cash</option>
                          </select>{' '}
                          <button className="btn sm" disabled={busyId === b.booking_id} onClick={() => pay(b)}>Pay</button>{' '}
                        </>
                      )}
                      {b.status === 'Booked' && (mine(b) || user.role === 'Admin') && (
                        <button className="btn danger sm" disabled={busyId === b.booking_id} onClick={() => cancel(b)}>Cancel</button>
                      )}
                      {mine(b) && (
                        <>{' '}
                          <Link className="btn secondary sm" href={`/complaints?slot=${b.slot_id}&booking=${b.booking_id}`}>Report issue</Link>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
