import { redirect } from 'next/navigation';

// The dashboard layout sends visitors who are not logged in to /login
export default function Home() {
  redirect('/dashboard');
}
