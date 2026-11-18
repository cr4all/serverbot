import mongoose from 'mongoose';

const uri = String(process.env.MONGODB_URI ?? '').trim();
if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
}

await mongoose.connect(uri);
const email = process.env.LOCAL_CLIENT_EMAIL || 'client@local.test';
const u = await mongoose.connection.db.collection('users').findOne({ email });
if (!u) {
    console.error(`user not found: ${email}`);
    process.exit(2);
}
const instances = await mongoose.connection.db.collection('botinstances').find({ userId: u._id }).toArray();
console.log(JSON.stringify({ clientId: String(u._id), email: u.email, instances: instances.length }, null, 2));
await mongoose.disconnect();
