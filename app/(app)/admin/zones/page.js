'use client';

import { useState } from 'react';
import { api, useLoad } from '@/lib/client';
import { Alert, Badge, PageHead, Progress, Spinner } from '@/components/ui';

const ZONE_STATUSES = ['Active', 'Inactive', 'Maintenance'];

export default function AdminZonesPage() {
  const zonesQ = useLoad(() => api('/api/zones'));
  const slotsQ = useLoad(() => api('/api/slots'));
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const [open, setOpen] = useState(null); // zone_id whose slots are shown
  const [zoneForm, setZoneForm] = useState({ zone_name: '', location: '', description: '' });
  const [slotForm, setSlotForm] = useState({ slot_number: '', slot_type: 'Car', floor_no: 0 });

  const reloadAll = () => {
    zonesQ.reload();
    slotsQ.reload();
  };

  async function run(fn, okText) {
    setMsg({ type: 'error', text: '' });
    try {
      await fn();
      if (okText) setMsg({ type: 'success', text: okText });
      reloadAll();
      return true;
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
      return false;
    }
  }

  const addZone = async (e) => {
    e.preventDefault();
    if (await run(() => api('/api/admin/zones', { method: 'POST', body: zoneForm }), 'Zone added.')) {
      setZoneForm({ zone_name: '', location: '', description: '' });
    }
  };

  const setZoneStatus = (z, status) =>
    run(() => api(`/api/admin/zones/${z.zone_id}`, { method: 'PATCH', body: { status } }));

  const deleteZone = (z) => {
    if (!confirm(`Delete zone "${z.zone_name}" and all of its slots?`)) return;
    run(() => api(`/api/admin/zones/${z.zone_id}`, { method: 'DELETE' }), 'Zone deleted.');
  };

  const addSlot = async (e, zoneId) => {
    e.preventDefault();
    if (await run(() => api('/api/admin/slots', { method: 'POST', body: { ...slotForm, zone_id: zoneId } }), 'Slot added.')) {
      setSlotForm({ ...slotForm, slot_number: '' });
    }
  };

  const setSlotStatus = (s, status) =>
    run(() => api(`/api/admin/slots/${s.slot_id}`, { method: 'PATCH', body: { status } }));

  const deleteSlot = (s) => {
    if (!confirm(`Delete slot ${s.slot_number}?`)) return;
    run(() => api(`/api/admin/slots/${s.slot_id}`, { method: 'DELETE' }), 'Slot deleted.');
  };

  if (zonesQ.loading || slotsQ.loading) return <Spinner />;
  const zones = zonesQ.data?.zones || [];
  const slots = slotsQ.data?.slots || [];

  return (
    <>
      <PageHead title="Zones & slots" subtitle="Manage the parking infrastructure." />
      <Alert type={msg.type}>{msg.text}</Alert>

      <form className="card mb" onSubmit={addZone}>
        <h2>Add a zone</h2>
        <div className="row">
          <div className="field">
            <label>Name</label>
            <input value={zoneForm.zone_name} onChange={(e) => setZoneForm({ ...zoneForm, zone_name: e.target.value })} required />
          </div>
          <div className="field">
            <label>Location</label>
            <input value={zoneForm.location} onChange={(e) => setZoneForm({ ...zoneForm, location: e.target.value })} />
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label>Description</label>
            <input value={zoneForm.description} onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })} />
          </div>
        </div>
        <button className="btn">Add zone</button>
      </form>

      {zones.map((z) => {
        const zoneSlots = slots.filter((s) => s.zone_id === z.zone_id);
        const isOpen = open === z.zone_id;
        return (
          <div className="card mb" key={z.zone_id}>
            <div className="card-head">
              <div>
                <h2 style={{ display: 'inline', marginRight: 8 }}>{z.zone_name}</h2>
                <span className="muted small">{z.location}</span>
                <div className="small muted">{z.description}</div>
              </div>
              <div className="row tight" style={{ alignItems: 'center' }}>
                <select value={z.status} onChange={(e) => setZoneStatus(z, e.target.value)}>
                  {ZONE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                <button className="btn secondary sm" onClick={() => setOpen(isOpen ? null : z.zone_id)}>
                  {isOpen ? 'Hide slots' : `Slots (${z.total_slots})`}
                </button>
                <button className="btn danger sm" onClick={() => deleteZone(z)}>Delete</button>
              </div>
            </div>
            <div className="small muted">
              {z.occupied_now} occupied now · {z.maintenance_slots} under maintenance · {z.total_slots} total
            </div>
            <Progress value={z.occupied_now} max={z.total_slots - z.maintenance_slots} />

            {isOpen && (
              <div className="mt">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Slot</th><th>Type</th><th>Floor</th><th>Now</th><th>Status</th><th /></tr>
                    </thead>
                    <tbody>
                      {zoneSlots.map((s) => (
                        <tr key={s.slot_id}>
                          <td><b>{s.slot_number}</b></td>
                          <td>{s.slot_type}</td>
                          <td>{s.floor_no}</td>
                          <td>{s.occupied_now ? <Badge color="red">Occupied</Badge> : <Badge color="green">Free</Badge>}</td>
                          <td>
                            <select value={s.slot_status} onChange={(e) => setSlotStatus(s, e.target.value)}>
                              <option>Available</option>
                              <option>Maintenance</option>
                            </select>
                          </td>
                          <td className="right"><button className="btn danger sm" onClick={() => deleteSlot(s)}>Delete</button></td>
                        </tr>
                      ))}
                      {zoneSlots.length === 0 && <tr><td colSpan={6} className="empty">No slots in this zone yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <form className="row mt" onSubmit={(e) => addSlot(e, z.zone_id)} style={{ alignItems: 'flex-end' }}>
                  <div className="field">
                    <label>Slot number</label>
                    <input value={slotForm.slot_number} onChange={(e) => setSlotForm({ ...slotForm, slot_number: e.target.value })} placeholder="C-07" required />
                  </div>
                  <div className="field">
                    <label>Type</label>
                    <select value={slotForm.slot_type} onChange={(e) => setSlotForm({ ...slotForm, slot_type: e.target.value })}>
                      <option>Car</option><option>Bike</option><option>EV</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Floor</label>
                    <input type="number" value={slotForm.floor_no} onChange={(e) => setSlotForm({ ...slotForm, floor_no: e.target.value })} />
                  </div>
                  <div className="field" style={{ flex: '0 0 auto' }}>
                    <button className="btn">Add slot</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
