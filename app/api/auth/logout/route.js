import { route, json } from '@/lib/api';
import { clearAuthCookie } from '@/lib/auth';

export const POST = route(
  async () => {
    const res = json({ ok: true });
    clearAuthCookie(res);
    return res;
  },
  { public: true }
);
