'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Alert } from '@/components/ui';

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', role: 'Student', department: '', designation: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/api/auth/register', { method: 'POST', body: form });
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">P</span> SCPMS
        </div>
        <div className="auth-sub">Create your parking account</div>

        <form className="card" onSubmit={submit}>
          <Alert>{error}</Alert>
          <div className="field">
            <label>Full name</label>
            <input value={form.name} onChange={set('name')} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div className="row">
            <div className="field">
              <label>Phone (optional)</label>
              <input value={form.phone} onChange={set('phone')} />
            </div>
            <div className="field">
              <label>I am a</label>
              <select value={form.role} onChange={set('role')}>
                <option>Student</option>
                <option>Staff</option>
              </select>
            </div>
          </div>
          {form.role === 'Staff' && (
            <div className="row">
              <div className="field">
                <label>Department</label>
                <input value={form.department} onChange={set('department')} required />
              </div>
              <div className="field">
                <label>Designation</label>
                <input value={form.designation} onChange={set('designation')} required />
              </div>
            </div>
          )}
          <div className="field">
            <label>Password (at least 8 characters)</label>
            <input type="password" minLength={8} value={form.password} onChange={set('password')} required />
          </div>
          <button className="btn block" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
          <p className="small muted mt" style={{ textAlign: 'center', marginBottom: 0 }}>
            Already registered? <Link href="/login">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
