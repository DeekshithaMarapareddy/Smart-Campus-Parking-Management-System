'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { api, useLoad, fmtDate, fmtTime, money } from '@/lib/client';
import { Alert, Badge, PageHead, Progress, Spinner, Stat } from '@/components/ui';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading } = useLoad(() => api('/api/dashboard'));

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  const { me, upcoming, zones, admin } = data;

  return (
    <>
      <PageHead title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Here is what is happening with your parking today.">
        <Link href="/book" className="btn">Book a slot</Link>
      </PageHead>

      <div className="grid cols-4 mb">
        <Stat label="Upcoming bookings" value={me.upcoming_bookings} sub={`${me.completed_bookings} completed so far`} />
        <Stat label="Registered vehicles" value={me.vehicles} />
        <Stat label="Total paid" value={money(me.total_spent)} sub={me.amount_due > 0 ? `${money(me.amount_due)} still unpaid` : 'Nothing due'} />
        <Stat label="Open complaints" value={me.open_complaints} />
      </div>

      {admin && (
        <>
          <h2>Campus overview (admin)</h2>
          <div className="grid cols-4 mb">
            <Stat label="Registered users" value={admin.users} />
            <Stat label="Bookings today" value={admin.bookings_today} />
            <Stat label="Revenue today" value={money(admin.revenue_today)} />
            <Stat label="Unresolved complaints" value={admin.open_complaints} sub={<Link href="/complaints">Review</Link>} />
          </div>
        </>
      )}

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head">
            <h2>Your next bookings</h2>
            <Link href="/bookings" className="small">View all</Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="empty">
              No upcoming bookings. <Link href="/book">Book a slot</Link>
            </div>
          ) : (
            upcoming.map((b) => (
              <div className="list-item" key={b.booking_id}>
                <div>
                  <b>{b.zone_name}</b> · Slot {b.slot_number}
                  <div className="small muted">
                    {fmtDate(b.booking_date)}, {fmtTime(b.start_time)} – {fmtTime(b.end_time)} · {b.reg_number}
                  </div>
                </div>
                <Badge>{b.payment_status === 'Paid' ? 'Paid' : 'Pending'}</Badge>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Live zone occupancy</h2>
            <span className="small muted">right now</span>
          </div>
          {zones.map((z) => {
            const usable = z.total_slots - z.maintenance_slots;
            const inactive = z.status !== 'Active';
            return (
              <div key={z.zone_id} style={{ marginBottom: 14 }}>
                <div className="row tight" style={{ justifyContent: 'space-between', display: 'flex' }}>
                  <span>
                    <b>{z.zone_name}</b> <span className="muted small">{z.location}</span>
                  </span>
                  {inactive ? <Badge>{z.status}</Badge> : <span className="small">{z.occupied_now}/{usable} taken</span>}
                </div>
                {!inactive && <Progress value={z.occupied_now} max={usable} />}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
