import { route, json } from '@/lib/api';
import { getMongoDb } from '@/lib/mongo';

/**
 * Reads the MongoDB side of the system:
 *   parking_events - activity log written by the API
 *   sensor_logs    - IoT sensor readings
 * If MongoDB is not reachable we answer { available: false } rather than failing.
 */
export const GET = route(
  async (req) => {
    const db = await getMongoDb();
    if (!db) return json({ available: false });

    const type = req.nextUrl.searchParams.get('type');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 50, 200);

    const eventFilter = type ? { event_type: type } : {};
    const [events, eventCounts, sensorByZone, recentSensors] = await Promise.all([
      db.collection('parking_events').find(eventFilter).sort({ ts: -1 }).limit(limit).toArray(),

      // aggregation pipeline: number of events per type in the last 7 days
      db.collection('parking_events').aggregate([
        { $match: { ts: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } } },
        { $group: { _id: '$event_type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray(),

      // aggregation pipeline: latest reading of every sensor, then occupancy per zone
      db.collection('sensor_logs').aggregate([
        { $sort: { ts: -1 } },
        { $group: { _id: '$slot_id', zone_id: { $first: '$zone_id' }, occupied: { $first: '$occupied' }, battery_pct: { $first: '$battery_pct' }, ts: { $first: '$ts' } } },
        { $group: {
            _id: '$zone_id',
            sensors: { $sum: 1 },
            occupied: { $sum: { $cond: ['$occupied', 1, 0] } },
            low_battery: { $sum: { $cond: [{ $lt: ['$battery_pct', 70] }, 1, 0] } },
        } },
        { $sort: { _id: 1 } },
      ]).toArray(),

      db.collection('sensor_logs').find({}).sort({ ts: -1 }).limit(15).toArray(),
    ]);

    const clean = (d) => ({ ...d, _id: String(d._id) });
    return json({
      available: true,
      events: events.map(clean),
      eventCounts: eventCounts.map((c) => ({ event_type: c._id, count: c.count })),
      sensorByZone: sensorByZone.map((z) => ({ zone_id: z._id, sensors: z.sensors, occupied: z.occupied, low_battery: z.low_battery })),
      recentSensors: recentSensors.map(clean),
    });
  },
  { roles: ['Admin'] }
);
