'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Nav from '@/components/Nav';
import { Spinner } from '@/components/ui';

// Wraps every logged-in page: checks the session, shows the navbar, guards /admin pages
export default function AppLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAdminPage = pathname.startsWith('/admin');

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (isAdminPage && user.role !== 'Admin') router.replace('/dashboard');
  }, [loading, user, isAdminPage, router]);

  if (loading || !user || (isAdminPage && user.role !== 'Admin')) return <Spinner />;

  return (
    <>
      <Nav />
      <main className="container">{children}</main>
    </>
  );
}
