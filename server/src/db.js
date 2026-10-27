import mongoose from 'mongoose';
import { config } from './config.js';

// Serverless functions can be re-used across invocations, so the connection
// promise is cached on globalThis. Without this every cold request would open
// a new pool and Atlas would run out of connections quickly.
const cached = globalThis.__saathiMongo || (globalThis.__saathiMongo = { conn: null, promise: null });

mongoose.set('strictQuery', true);

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(config.mongoUri, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 10,
      })
      .then((m) => m)
      .catch((err) => {
        // Reset so the next request can retry instead of re-using a rejected promise.
        cached.promise = null;
        throw err;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
