import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { route, json, readBody, text, HttpError } from '@/lib/api';
import { signToken, setAuthCookie } from '@/lib/auth';
import { logEvent } from '@/lib/mongo';

// compared against when the email is unknown, so timing does not reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export const POST = route(
  async (req) => {
    const body = await readBody(req);
    const email = text(body.email, 'Email', { max: 150 }).toLowerCase();
    const password = text(body.password, 'Password', { max: 100 });

    const { rows } = await query(
      `SELECT user_id, name, email, phone, role, status, password FROM users WHERE email = $1`,
      [email]
    );
    const row = rows[0];
    const ok = await bcrypt.compare(password, row ? row.password : DUMMY_HASH);
    if (!row || !ok) throw new HttpError(401, 'Wrong email or password');
    if (row.status !== 'Active') throw new HttpError(403, `This account is ${row.status.toLowerCase()}. Please contact the parking office.`);

    const { password: _hash, ...user } = row;
    const res = json({ user });
    setAuthCookie(res, await signToken(user));
    logEvent('auth.login', { user_id: user.user_id, role: user.role });
    return res;
  },
  { public: true }
);
