import { MongoClient } from 'mongodb';

/**
 * MongoDB holds the flexible, high-volume data: parking activity events
 * (collection "parking_events") and IoT sensor readings ("sensor_logs").
 *
 * The app must keep working when MongoDB is down, so every helper here
 * swallows connection errors and remembers a failure for 30 seconds
 * instead of making each request wait for a timeout.
 */
const g = globalThis;
const RETRY_AFTER_MS = 30_000;

export async function getMongoDb() {
  if (!process.env.MONGODB_URI) return null;
  if (g.__scpmsMongoFailedAt && Date.now() - g.__scpmsMongoFailedAt < RETRY_AFTER_MS) return null;

  try {
    if (!g.__scpmsMongoClient) {
      g.__scpmsMongoClient = new MongoClient(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 2000,
      }).connect();
    }
    const client = await g.__scpmsMongoClient;
    return client.db(process.env.MONGODB_DB || 'scpms_logs');
  } catch (err) {
    g.__scpmsMongoClient = null;
    g.__scpmsMongoFailedAt = Date.now();
    return null;
  }
}

/** Fire-and-forget activity log. Never throws. */
export async function logEvent(eventType, data = {}) {
  try {
    const db = await getMongoDb();
    if (!db) return;
    await db.collection('parking_events').insertOne({
      event_type: eventType,
      ...data,
      ts: new Date(),
    });
  } catch {
    // logging must never break the request
  }
}
