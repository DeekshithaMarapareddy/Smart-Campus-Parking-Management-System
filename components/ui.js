'use client';

const BADGE_COLORS = {
  Booked: 'blue',
  Completed: 'green',
  Cancelled: 'gray',
  Paid: 'green',
  Pending: 'amber',
  Refunded: 'purple',
  Failed: 'red',
  Open: 'red',
  'In Progress': 'amber',
  Resolved: 'green',
  Closed: 'gray',
  Active: 'green',
  Inactive: 'gray',
  Blocked: 'red',
  Maintenance: 'amber',
  Available: 'green',
  Admin: 'purple',
  Staff: 'blue',
  Student: 'gray',
};

export function Badge({ children, color }) {
  const cls = color || BADGE_COLORS[children] || 'gray';
  return <span className={`badge ${cls}`}>{children}</span>;
}

export function Alert({ type = 'error', children }) {
  if (!children) return null;
  return <div className={`alert ${type}`}>{children}</div>;
}

export function Spinner({ label = 'Loading…' }) {
  return <div className="spinner-wrap">{label}</div>;
}

export function Stat({ label, value, sub }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <div className="muted">{subtitle}</div> : null}
      </div>
      {children ? <div className="row tight">{children}</div> : null}
    </div>
  );
}

export function Progress({ value, max }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const cls = pct >= 85 ? 'bad' : pct >= 60 ? 'warn' : '';
  return (
    <div className={`progress ${cls}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Simple vertical bar chart, no chart library needed. */
export function BarChart({ items, valueKey = 'value', labelKey = 'label', format = (v) => v }) {
  const max = Math.max(1, ...items.map((i) => i[valueKey]));
  return (
    <div className="bars">
      {items.map((i) => (
        <div className="bar-col" key={i[labelKey]} title={`${i[labelKey]}: ${format(i[valueKey])}`}>
          <div className="bar-val">{i[valueKey] ? format(i[valueKey]) : ''}</div>
          <div className="bar" style={{ height: `${(i[valueKey] / max) * 100}%` }} />
          <div className="bar-label">{i[labelKey]}</div>
        </div>
      ))}
    </div>
  );
}
