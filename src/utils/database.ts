import mongoose from 'mongoose';
import { MONGODB_URI } from '../config';

function log(msg: string) {
  console.log(`[DB] ${msg}`);
}

export async function connectDB(uri = MONGODB_URI): Promise<typeof mongoose> {
  try {
    log(`Connecting to ${uri}`);
    const conn = await mongoose.connect(uri);
    log('Connected');
    return conn;
  } catch (err) {
    console.error('[ERROR][DB] Failed to connect', err);
    throw err;
  }
}

export async function disconnectDB(): Promise<void> {
  try {
    await mongoose.connection.close();
    log('Disconnected');
  } catch (err) {
    console.error('[ERROR][DB] Failed to disconnect', err);
  }
}

// Attach event listeners once
mongoose.connection.on('error', (err) => {
  console.error('[ERROR][DB] Connection error', err);
});

mongoose.connection.on('disconnected', () => {
  log('Connection lost');
});
