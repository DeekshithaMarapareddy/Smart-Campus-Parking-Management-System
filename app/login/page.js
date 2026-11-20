'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Alert } from '@/components/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/api/auth/login', { method: 'POST', body: { email, password } });
      // full reload so the session provider picks up the new cookie
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function fill(e, p) {
    setEmail(e);
    setPassword(p);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">P</span> SCPMS
        </div>
        <div className="auth-sub">Smart Campus Parking Management System</div>

        <form className="card" onSubmit={submit}>
          <h2>Log in</h2>
          <Alert>{error}</Alert>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn block" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
          <p className="small muted mt" style={{ textAlign: 'center', marginBottom: 0 }}>
            New here? <Link href="/register">Create an account</Link>
          </p>

          <div className="demo-box">
            <b>Demo accounts</b> (after running the DB setup)
            <div>
              <button type="button" onClick={() => fill('admin@scpms.edu', 'Admin@123')}>Admin</button> ·{' '}
              <button type="button" onClick={() => fill('ravi.kumar@scpms.edu', 'Password@123')}>Staff</button> ·{' '}
              <button type="button" onClick={() => fill('ananya@scpms.edu', 'Password@123')}>Student</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
