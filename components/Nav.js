'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { Badge } from './ui';

const USER_LINKS = [
  ['/dashboard', 'Dashboard'],
  ['/book', 'Book a slot'],
  ['/bookings', 'My bookings'],
  ['/vehicles', 'Vehicles'],
  ['/complaints', 'Complaints'],
];

const ADMIN_LINKS = [
  ['/admin/zones', 'Zones & slots'],
  ['/admin/users', 'Users'],
  ['/admin/reports', 'Reports'],
  ['/admin/logs', 'Logs'],
];

export default function Nav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  if (!user) return null;

  const link = ([href, label]) => (
    <Link key={href} href={href} className={pathname === href || pathname.startsWith(href + '/') ? 'active' : ''}>
      {label}
    </Link>
  );

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">P</span> SCPMS
        </Link>
        <nav className="nav-links">
          {USER_LINKS.map(link)}
          {user.role === 'Admin' && (
            <>
              <span className="nav-sep" />
              {ADMIN_LINKS.map(link)}
            </>
          )}
        </nav>
        <div className="nav-user">
          <div className="who">
            <b>{user.name}</b>
            <Badge>{user.role}</Badge>
          </div>
          <button className="btn secondary sm" onClick={logout}>
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
