'use client';

import { useState } from 'react';
import { api, useLoad, fmtDate, fmtTime, money, todayISO } from '@/lib/client';
import { Alert, BarChart, PageHead, Spinner, Stat } from '@/components/ui';

export default function AdminReportsPage() {
  const [from, setFrom] = useState(todayISO(-13));
  const [to, setTo] = useState(todayISO());
  const { data, error, loading } = useLoad(() => api(`/api/admin/reports?from=${from}&to=${to}`), [from, to]);

  const preset = (days) => {
    setFrom(todayISO(-(days - 1)));
    setTo(todayISO());
  };

  return (
    <>
      <PageHead title="Reports" subtitle="Analytics built from SQL views, stored functions and window functions.">
        <div>
          <label>From</label>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label>To</label>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn secondary" onClick={() => preset(7)}>7 days</button>
        <button className="btn secondary" onClick={() => preset(14)}>14 days</button>
        <button className="btn secondary" onClick={() => preset(30)}>30 days</button>
      </PageHead>

      {error && <Alert>{error}</Alert>}
      {loading && !data ? <Spinner /> : data && (
        <>
          <div className="grid cols-4 mb">
            <Stat label="Bookings" value={data.summary.bookings} sub={`${data.summary.cancelled} cancelled (${data.summary.cancellation_rate ?? 0}%)`} />
            <Stat label="Revenue collected" value={money(data.summary.revenue)} />
            <Stat label="Unpaid" value={money(data.summary.unpaid)} sub="pending payments" />
            <Stat label="Refunded" value={money(data.summary.refunded)} />
          </div>

          <div className="grid cols-2 mb">
            <div className="card">
              <h2>Revenue per day</h2>
              {data.revenueByDay.length === 0 ? <div className="empty">No payments in this range.</div> : (
                <BarChart
                  items={data.revenueByDay.map((r) => ({ label: r.day.slice(8) + '/' + r.day.slice(5, 7), value: r.revenue }))}
                  format={(v) => v}
                />
              )}
              {data.revenueByDay.length > 0 && (
                <div className="small muted">
                  Running total: {money(data.revenueByDay[data.revenueByDay.length - 1].running_total)}
                </div>
              )}
            </div>
            <div className="card">
              <h2>Peak hours</h2>
              <BarChart
                items={data.peakHours.map((p) => ({ label: String(p.hour), value: p.bookings }))}
              />
              <div className="small muted">Number of bookings active in each hour of the day (24h clock).</div>
            </div>
          </div>

          <div className="card mb">
            <h2>Zone utilization</h2>
            <div className="small muted mb">Booked hours as a share of slots × days × 16 operating hours.</div>
            {data.utilization.map((u) => (
              <div className="hbar-row" key={u.zone_id}>
                <div>{u.zone_name}</div>
                <div className="progress"><span style={{ width: `${Math.min(100, u.utilization_pct)}%` }} /></div>
                <div className="right small"><b>{u.utilization_pct}%</b><div className="muted">{u.total_bookings} bookings</div></div>
              </div>
            ))}
          </div>

          <div className="grid cols-2 mb">
            <div className="card flush">
              <div style={{ padding: '18px 18px 0' }}><h2>Revenue by payment method</h2></div>
              <table>
                <thead><tr><th>Method</th><th>Payments</th><th>Revenue</th><th>Share</th></tr></thead>
                <tbody>
                  {data.revenueByMethod.map((m) => (
                    <tr key={m.method}><td>{m.method}</td><td>{m.payments}</td><td>{money(m.revenue)}</td><td>{m.share_pct}%</td></tr>
                  ))}
                  {data.revenueByMethod.length === 0 && <tr><td colSpan={4} className="empty">No payments.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="card flush">
              <div style={{ padding: '18px 18px 0' }}><h2>Demand by slot type</h2></div>
              <table>
                <thead><tr><th>Type</th><th>Slots</th><th>Bookings</th></tr></thead>
                <tbody>
                  {data.slotTypeDemand.map((t) => (
                    <tr key={t.type}><td>{t.type}</td><td>{t.slots}</td><td>{t.bookings}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid cols-2 mb">
            <div className="card flush">
              <div style={{ padding: '18px 18px 0' }}><h2>Most active users (all time)</h2></div>
              <table>
                <thead><tr><th>Rank</th><th>User</th><th>Bookings</th><th>Spent</th></tr></thead>
                <tbody>
                  {data.topUsers.map((u) => (
                    <tr key={u.name}><td>{u.rank}</td><td>{u.name} <span className="muted small">{u.role}</span></td><td>{u.total_bookings}</td><td>{money(u.total_spent)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card flush">
              <div style={{ padding: '18px 18px 0' }}><h2>Busiest slot per zone</h2></div>
              <table>
                <thead><tr><th>Zone</th><th>Slot</th><th>Bookings</th></tr></thead>
                <tbody>
                  {data.topSlots.map((s) => (
                    <tr key={s.zone_name}><td>{s.zone_name}</td><td>{s.slot_number}</td><td>{s.bookings}</td></tr>
                  ))}
                  {data.topSlots.length === 0 && <tr><td colSpan={3} className="empty">No bookings in this range.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card flush">
            <div style={{ padding: '18px 18px 0' }}><h2>Complaints by category</h2></div>
            <table>
              <thead><tr><th>Category</th><th>Total</th><th>Unresolved</th><th>Avg. hours to resolve</th></tr></thead>
              <tbody>
                {data.complaintsByCategory.map((c) => (
                  <tr key={c.category}>
                    <td>{c.category}</td><td>{c.total}</td><td>{c.unresolved}</td><td>{c.avg_hours_to_resolve ?? '—'}</td>
                  </tr>
                ))}
                {data.complaintsByCategory.length === 0 && <tr><td colSpan={4} className="empty">No complaints.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
