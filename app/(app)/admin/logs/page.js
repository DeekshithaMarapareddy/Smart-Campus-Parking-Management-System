'use client';

import { useState } from 'react';
import { api, useLoad, fmtDateTime } from '@/lib/client';
import { Alert, Badge, PageHead, Spinner } from '@/components/ui';

export default function AdminLogsPage() {
  const [type, setType] = useState('');
  const logsQ = useLoad(() => api(`/api/admin/logs${type ? `?type=${encodeURIComponent(type)}` : ''}`), [type]);
  const slotsQ = useLoad(() => api('/api/slots'));
  const [sim, setSim] = useState({ slot_id: '', occupied: true });
  const [msg, setMsg] = useState({ type: 'error', text: '' });

  async function simulate(e) {
    e.preventDefault();
    setMsg({ type: 'error', text: '' });
    try {
      await api('/api/admin/sensor', {
        method: 'POST',
        body: { slot_id: Number(sim.slot_id || slotsQ.data.slots[0].slot_id), occupied: sim.occupied },
      });
      setMsg({ type: 'success', text: 'Sensor reading stored in MongoDB.' });
      logsQ.reload();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  if (logsQ.loading && !logsQ.data) return <Spinner />;
  const d = logsQ.data;

  return (
    <>
      <PageHead title="Activity & sensor logs" subtitle="Flexible event data stored in MongoDB." />

      {logsQ.error && <Alert>{logsQ.error}</Alert>}
      {d && !d.available && (
        <Alert type="info">
          MongoDB is not reachable, so there are no logs to show. Start MongoDB (see README), then run <span className="code">npm run db:setup</span> once
          to load sample logs. The rest of the system works without it.
        </Alert>
      )}

      {d?.available && (
        <>
          <Alert type={msg.type}>{msg.text}</Alert>

          <div className="grid cols-2 mb">
            <div className="card">
              <h2>Events in the last 7 days</h2>
              {d.eventCounts.length === 0 ? <div className="empty">No events yet.</div> : (
                <div className="row tight" style={{ flexWrap: 'wrap' }}>
                  {d.eventCounts.map((c) => (
                    <button key={c.event_type} className={`btn sm ${type === c.event_type ? '' : 'secondary'}`} onClick={() => setType(type === c.event_type ? '' : c.event_type)}>
                      {c.event_type} · {c.count}
                    </button>
                  ))}
                </div>
              )}
              <div className="small muted mt">Click a type to filter the event list. Built with a MongoDB aggregation pipeline.</div>
            </div>

            <div className="card">
              <h2>Sensor occupancy by zone</h2>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Zone</th><th>Sensors</th><th>Occupied</th><th>Low battery</th></tr></thead>
                  <tbody>
                    {d.sensorByZone.map((z) => (
                      <tr key={z.zone_id}><td>Zone {z.zone_id}</td><td>{z.sensors}</td><td>{z.occupied}</td><td>{z.low_battery}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form className="row mt" onSubmit={simulate} style={{ alignItems: 'flex-end' }}>
                <div className="field">
                  <label>Simulate a sensor</label>
                  <select value={sim.slot_id} onChange={(e) => setSim({ ...sim, slot_id: e.target.value })}>
                    {(slotsQ.data?.slots || []).map((s) => <option key={s.slot_id} value={s.slot_id}>{s.zone_name} · {s.slot_number}</option>)}
                  </select>
                </div>
                <div className="field" style={{ flex: '0 0 auto' }}>
                  <select value={sim.occupied ? '1' : '0'} onChange={(e) => setSim({ ...sim, occupied: e.target.value === '1' })}>
                    <option value="1">Occupied</option>
                    <option value="0">Vacated</option>
                  </select>
                </div>
                <div className="field" style={{ flex: '0 0 auto' }}><button className="btn">Send</button></div>
              </form>
            </div>
          </div>

          <div className="grid cols-2">
            <div className="card flush">
              <div style={{ padding: '18px 18px 0' }}><h2>Latest events {type && <Badge color="blue">{type}</Badge>}</h2></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Time</th><th>Event</th><th>Details</th></tr></thead>
                  <tbody>
                    {d.events.map((e) => (
                      <tr key={e._id}>
                        <td className="nowrap small">{fmtDateTime(e.ts)}</td>
                        <td><span className="code">{e.event_type}</span></td>
                        <td className="small muted">
                          {[e.user_id && `user ${e.user_id}`, e.booking_id && `booking ${e.booking_id}`, e.slot_id && `slot ${e.slot_id}`].filter(Boolean).join(' · ')}
                        </td>
                      </tr>
                    ))}
                    {d.events.length === 0 && <tr><td colSpan={3} className="empty">No events.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card flush">
              <div style={{ padding: '18px 18px 0' }}><h2>Latest sensor readings</h2></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Time</th><th>Sensor</th><th>State</th><th>Battery</th></tr></thead>
                  <tbody>
                    {d.recentSensors.map((s) => (
                      <tr key={s._id}>
                        <td className="nowrap small">{fmtDateTime(s.ts)}</td>
                        <td><span className="code">{s.sensor_id}</span></td>
                        <td>{s.occupied ? <Badge color="red">Occupied</Badge> : <Badge color="green">Free</Badge>}</td>
                        <td>{s.battery_pct}%</td>
                      </tr>
                    ))}
                    {d.recentSensors.length === 0 && <tr><td colSpan={4} className="empty">No readings.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
