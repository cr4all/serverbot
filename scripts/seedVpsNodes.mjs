/**
 * Seed admin-managed VPS agent nodes from the historical sample addresses.
 *
 *   node --env-file=.env.local scripts/seedVpsNodes.mjs
 */
import mongoose from 'mongoose';
import crypto from 'node:crypto';

const MONGODB_URI = String(process.env.MONGODB_URI ?? '').trim();
const CREDENTIALS_KEY = String(process.env.CREDENTIALS_KEY ?? '').trim();
if (!MONGODB_URI) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}
if (CREDENTIALS_KEY.length < 16) {
  console.error('CREDENTIALS_KEY must be at least 16 characters');
  process.exit(1);
}

function deriveKey(rawKey) {
  return crypto.createHash('sha256').update(String(rawKey), 'utf8').digest();
}

function encryptSecret(plain, rawKey) {
  const key = deriveKey(rawKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

const SEED = [
  {
    name: 'BetOnline VPS (sample)',
    role: 'BETONLINE',
    address: '168.121.74.27',
    username: 'Administrator',
    password: 'f$270rpQuvULOrGG',
  },
  {
    name: 'PS3838 VPS (sample)',
    role: 'PS3838',
    address: '168.121.74.26',
    username: 'Administrator',
    password: 'f$270rpQuvULOrGG',
  },
];

await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
const col = mongoose.connection.db.collection('vpsnodes');

for (const row of SEED) {
  const passwordSecret = encryptSecret(row.password, CREDENTIALS_KEY);
  const result = await col.updateOne(
    { role: row.role, address: row.address },
    {
      $set: {
        name: row.name,
        role: row.role,
        address: row.address,
        username: row.username,
        passwordSecret,
        enabled: true,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  console.log(
    `${row.role} ${row.address}: ${result.upsertedCount ? 'inserted' : 'updated'}`
  );
}

await mongoose.disconnect();
console.log('done');
