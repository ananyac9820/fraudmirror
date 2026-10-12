import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

// Pin the MongoDB binary cache to server/node_modules/.cache so it is found no matter
// which directory the server is started from (avoids re-downloading ~800 MB).
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.MONGOMS_DOWNLOAD_DIR ||= path.join(serverRoot, 'node_modules', '.cache', 'mongodb-memory-server');

let memoryServer = null;

export async function connectDB() {
  let uri = process.env.MONGO_URI;
  if (uri) {
    console.log('[db] Using MongoDB from MONGO_URI');
  } else {
    console.log('[db] MONGO_URI not set -> starting in-memory MongoDB (mongodb-memory-server). Data resets on restart.');
    let MongoMemoryServer;
    try {
      ({ MongoMemoryServer } = await import('mongodb-memory-server'));
    } catch {
      // It is a dev dependency, so hosted installs (npm install --omit=dev) do not have it
      throw new Error('MONGO_URI is not set and mongodb-memory-server is not installed. Set MONGO_URI to a MongoDB connection string.');
    }
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  await mongoose.connect(uri);
  console.log(`[db] Connected (${memoryServer ? 'in-memory' : 'external'} MongoDB)`);
}
