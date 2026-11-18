/**
 * Wipe all users and user-owned rows. Keeps bot templates.
 * Run: node --env-file=.env.local scripts/clearUsers.mjs
 */
import mongoose from 'mongoose';

const uri = String(process.env.MONGODB_URI ?? '').trim();
if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
const db = mongoose.connection.db;

const cols = ['users', 'botassignments', 'botinstances', 'clientexecutions', 'sessions', 'accounts'];
const report = {};
for (const name of cols) {
    try {
        const r = await db.collection(name).deleteMany({});
        report[name] = r.deletedCount;
    } catch (err) {
        report[name] = String(err?.message || err);
    }
}

const bots = await db
    .collection('bots')
    .find({ type: { $in: ['BETONLINE', 'PS3838'] } }, { projection: { name: 1, type: 1 } })
    .toArray();

console.log(JSON.stringify({ cleared: report, surebetTemplates: bots }, null, 2));
await mongoose.disconnect();
