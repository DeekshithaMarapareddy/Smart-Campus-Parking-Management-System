import bcrypt from 'bcryptjs';
import { withTransaction } from '@/lib/db';
import { route, json, readBody, text, oneOf, HttpError } from '@/lib/api';
import { signToken, setAuthCookie } from '@/lib/auth';
import { logEvent } from '@/lib/mongo';

export const POST = route(
  async (req) => {
    const body = await readBody(req);
    const name = text(body.name, 'Name', { min: 2, max: 100 });
    const email = text(body.email, 'Email', { max: 150 }).toLowerCase();
    const phone = text(body.phone, 'Phone', { max: 20, optional: true });
    const password = text(body.password, 'Password', { min: 8, max: 100 });
    const role = oneOf(body.role, 'Role', ['Student', 'Staff']); // admins are created by the setup script only

    let department = null;
    let designation = null;
    if (role === 'Staff') {
      department = text(body.department, 'Department', { max: 100 });
      designation = text(body.designation, 'Designation', { max: 100 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Email is not valid');

    const hash = await bcrypt.hash(password, 10);

    // user row + staff row must succeed or fail together
    const user = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO users (name, email, phone, password, role)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING user_id, name, email, phone, role, status`,
        [name, email, phone, hash, role]
      );
      if (role === 'Staff') {
        await client.query(
          `INSERT INTO staff (user_id, department, designation) VALUES ($1,$2,$3)`,
          [rows[0].user_id, department, designation]
        );
      }
      return rows[0];
    }).catch((err) => {
      if (err.code === '23505') throw new HttpError(409, 'An account with this email already exists');
      throw err;
    });

    const res = json({ user }, 201);
    setAuthCookie(res, await signToken(user));
    logEvent('user.registered', { user_id: user.user_id, role });
    return res;
  },
  { public: true }
);
