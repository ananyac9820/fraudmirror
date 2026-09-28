import mongoose from 'mongoose';

let memoryServer = null;

export async function connectDB() {
  let uri = process.env.MONGO_URI;
  if (uri) {
    console.log('[db] Using MongoDB from MONGO_URI');
  } else {
    console.log('[db] MONGO_URI not set -> starting in-memory MongoDB (mongodb-memory-server). Data resets on restart.');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  await mongoose.connect(uri);
  console.log(`[db] Connected (${memoryServer ? 'in-memory' : 'external'} MongoDB)`);
}
