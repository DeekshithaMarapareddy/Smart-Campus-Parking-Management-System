'use client';

import { useState } from 'react';
import { api, useLoad } from '@/lib/client';
import { Alert, Badge, PageHead, Spinner } from '@/components/ui';

const EMPTY = { reg_number: '', vehicle_type: 'Car', model: '', color: '' };

export default function VehiclesPage() {
  const { data, error, loading, reload } = useLoad(() => api('/api/vehicles'));
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setMsg({ type: 'error', text: '' });
    try {
      await api('/api/vehicles', { method: 'POST', body: form });
      setForm(EMPTY);
      setMsg({ type: 'success', text: 'Vehicle added.' });
      reload();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(v) {
    try {
      await api(`/api/vehicles/${v.vehicle_id}`, { method: 'PATCH', body: { status: v.status === 'Active' ? 'Inactive' : 'Active' } });
      reload();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function remove(v) {
    if (!confirm(`Remove ${v.reg_number}?`)) return;
    try {
      const res = await api(`/api/vehicles/${v.vehicle_id}`, { method: 'DELETE' });
      setMsg({ type: 'info', text: res.message });
      reload();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  return (
    <>
      <PageHead title="My vehicles" subtitle="Register the vehicles you want to park on campus." />
      <Alert type={msg.type}>{msg.text}</Alert>

      <div className="grid cols-2" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', alignItems: 'start' }}>
        <form className="card" onSubmit={add}>
          <h2>Add a vehicle</h2>
          <div className="field">
            <label>Registration number</label>
            <input value={form.reg_number} onChange={set('reg_number')} placeholder="KA01AB1234" required />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={form.vehicle_type} onChange={set('vehicle_type')}>
              <option>Car</option>
              <option>Bike</option>
              <option>EV</option>
            </select>
          </div>
          <div className="row">
            <div className="field">
              <label>Model</label>
              <input value={form.model} onChange={set('model')} />
            </div>
            <div className="field">
              <label>Color</label>
              <input value={form.color} onChange={set('color')} />
            </div>
          </div>
          <button className="btn block" disabled={busy}>Add vehicle</button>
        </form>

        <div className="card flush">
          {loading ? (
            <Spinner />
          ) : error ? (
            <Alert>{error}</Alert>
          ) : data.vehicles.length === 0 ? (
            <div className="empty">You have not added a vehicle yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Registration</th><th>Type</th><th>Model</th><th>Bookings</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {data.vehicles.map((v) => (
                    <tr key={v.vehicle_id}>
                      <td><b>{v.reg_number}</b></td>
                      <td>{v.vehicle_type}</td>
                      <td>{[v.model, v.color].filter(Boolean).join(' · ') || '—'}</td>
                      <td>{v.bookings}</td>
                      <td><Badge>{v.status}</Badge></td>
                      <td className="right nowrap">
                        <button className="btn secondary sm" onClick={() => toggle(v)}>
                          {v.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>{' '}
                        <button className="btn danger sm" onClick={() => remove(v)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
