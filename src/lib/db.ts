import mongoose from "mongoose";

type ConnectionCache = { promise: Promise<typeof mongoose> | null };

// Next.js dev mode re-evaluates modules on every change; keeping the
// connection on globalThis stops each reload from opening a new pool.
const globalForMongoose = globalThis as typeof globalThis & { mongooseCache?: ConnectionCache };
const cache = (globalForMongoose.mongooseCache ??= { promise: null });

/** MONGODB_URI is missing; the API reports it as "database unavailable". */
export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.");
    this.name = "DatabaseNotConfiguredError";
  }
}

export function connectToDatabase(): Promise<typeof mongoose> {
  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new DatabaseNotConfiguredError();
    cache.promise = mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 }).catch((error) => {
      cache.promise = null; // let the next request retry instead of caching the failure
      throw error;
    });
  }
  return cache.promise;
}
