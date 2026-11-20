'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { api, useLoad, fmtDateTime } from '@/lib/client';
import { Alert, Badge, PageHead, Spinner } from '@/components/ui';

const CATEGORIES = ['Slot Occupied', 'Wrong Billing', 'Damaged Slot', 'Safety', 'Other'];
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

function ComplaintsInner() {
  const { user } = useAuth();
  const isAdmin = user.role === 'Admin';
  const params = useSearchParams();

  const [everyone, setEveryone] = useState(isAdmin);
  const complaintsQ = useLoad(() => api(`/api/complaints${everyone ? '?all=1' : ''}`), [everyone]);
  const slotsQ = useLoad(() => api('/api/slots'));

  const [form, setForm] = useState({ slot_id: params.get('slot') || '', category: 'Slot Occupied', description: '' });
  const bookingId = params.get('booking');
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!form.slot_id && slotsQ.data?.slots.length) setForm((f) => ({ ...f, slot_id: String(slotsQ.data.slots[0].slot_id) }));
  }, [slotsQ.data, form.slot_id]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg({ type: 'error', text: '' });
    try {
      await api('/api/complaints', {
        method: 'POST',
        body: { ...form, slot_id: Number(form.slot_id), booking_id: bookingId ? Number(bookingId) : undefined },
      });
      setForm({ ...form, description: '' });
      setMsg({ type: 'success', text: 'Complaint submitted. The parking office will look into it.' });
      complaintsQ.reload();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id, status) {
    try {
      await api(`/api/complaints/${id}`, { method: 'PATCH', body: { status } });
      complaintsQ.reload();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  const slots = slotsQ.data?.slots || [];
  const complaints = complaintsQ.data?.complaints || [];

  return (
    <>
      <PageHead title="Complaints" subtitle={isAdmin ? 'Review and update complaints raised by users.' : 'Report a problem with a parking slot.'}>
        {isAdmin && (
          <label className="check" style={{ marginBottom: 0 }}>
            <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} />
            Show everyone&apos;s complaints
          </label>
        )}
      </PageHead>
      <Alert type={msg.type}>{msg.text}</Alert>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', alignItems: 'start' }}>
        <form className="card" onSubmit={submit}>
          <h2>Raise a complaint</h2>
          {bookingId && <div className="alert info">This will be linked to booking #{bookingId}.</div>}
          <div className="field">
            <label>Parking slot</label>
            <select value={form.slot_id} onChange={(e) => setForm({ ...form, slot_id: e.target.value })} required>
              {slots.map((s) => (
                <option key={s.slot_id} value={s.slot_id}>{s.zone_name} · {s.slot_number}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>What happened?</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              minLength={10}
              maxLength={1000}
              required
            />
          </div>
          <button className="btn block" disabled={busy}>Submit complaint</button>
        </form>

        <div className="card flush">
          {complaintsQ.loading ? (
            <Spinner />
          ) : complaints.length === 0 ? (
            <div className="empty">No complaints yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Slot</th>
                    {everyone && <th>Raised by</th>}
                    <th>Issue</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((c) => (
                    <tr key={c.complaint_id}>
                      <td>
                        <b>{c.slot_number}</b>
                        <div className="small muted">{c.zone_name}</div>
                      </td>
                      {everyone && <td>{c.user_name}</td>}
                      <td style={{ maxWidth: 340 }}>
                        <Badge color="blue">{c.category}</Badge>
                        <div>{c.description}</div>
                        <div className="small muted">
                          {fmtDateTime(c.created_at)}
                          {c.resolved_at ? ` · resolved ${fmtDateTime(c.resolved_at)}` : ''}
                        </div>
                      </td>
                      <td>
                        {isAdmin ? (
                          <select value={c.status} onChange={(e) => setStatus(c.complaint_id, e.target.value)}>
                            {STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        ) : (
                          <Badge>{c.status}</Badge>
                        )}
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

// useSearchParams needs a Suspense boundary for production builds
export default function ComplaintsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ComplaintsInner />
    </Suspense>
  );
}
