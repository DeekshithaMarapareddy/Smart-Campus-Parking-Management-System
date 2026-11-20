'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { api, useLoad, money } from '@/lib/client';
import { Alert, Badge, PageHead, Spinner } from '@/components/ui';

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const { data, error, loading, reload } = useLoad(() => api('/api/admin/users'));
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const [filter, setFilter] = useState('');

  async function update(u, patch) {
    setMsg({ type: 'error', text: '' });
    try {
      await api(`/api/admin/users/${u.user_id}`, { method: 'PATCH', body: patch });
      setMsg({ type: 'success', text: `Updated ${u.name}.` });
      reload();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;

  const q = filter.trim().toLowerCase();
  const users = data.users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

  return (
    <>
      <PageHead title="Users" subtitle="Roles, account status and parking activity.">
        <input placeholder="Search name or email" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ minWidth: 240 }} />
      </PageHead>
      <Alert type={msg.type}>{msg.text}</Alert>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>User</th><th>Role</th><th>Status</th><th>Bookings</th><th>Cancelled</th><th>Spent</th><th>Complaints</th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.user_id === me.user_id;
                return (
                  <tr key={u.user_id}>
                    <td>
                      <b>{u.name}</b>
                      <div className="small muted">{u.email}</div>
                      {u.department && <div className="small muted">{u.designation}, {u.department}</div>}
                    </td>
                    <td>
                      {self ? <Badge>{u.role}</Badge> : (
                        <select value={u.role} onChange={(e) => update(u, { role: e.target.value })}>
                          <option>Admin</option><option>Staff</option><option>Student</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {self ? <Badge>{u.status}</Badge> : (
                        <select value={u.status} onChange={(e) => update(u, { status: e.target.value })}>
                          <option>Active</option><option>Inactive</option><option>Blocked</option>
                        </select>
                      )}
                    </td>
                    <td>{u.total_bookings}</td>
                    <td>{u.cancelled_bookings}</td>
                    <td>{money(u.total_spent)}</td>
                    <td>{u.complaints_raised}</td>
                  </tr>
                );
              })}
              {users.length === 0 && <tr><td colSpan={7} className="empty">No users match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
