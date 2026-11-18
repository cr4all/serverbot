/**
 * Local-only client for exercising the dashboard flow.
 *
 * Creates (or reuses) a user and assigns the BETONLINE/PS3838 surebet templates.
 * Run: node --env-file=.env.local scripts/createLocalClient.mjs [--email=... --password=... --name=...]
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = String(process.env.MONGODB_URI ?? '').trim();
if (!MONGODB_URI) {
    console.error('MONGODB_URI is required (use --env-file=.env.local)');
    process.exit(1);
}

const args = process.argv.slice(2);
function arg(name, fallback) {
    const found = args.find((a) => a.startsWith(`--${name}=`));
    return found ? found.slice(name.length + 3).trim() : fallback;
}

const email = arg('email', process.env.LOCAL_CLIENT_EMAIL || 'client@local.test');
const password = arg('password', process.env.LOCAL_CLIENT_PASSWORD || 'client1234');
const name = arg('name', process.env.LOCAL_CLIENT_NAME || 'Local Client');
const role = arg('role', 'user');

await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
const db = mongoose.connection.db;
const users = db.collection('users');
const bots = db.collection('bots');
const assignments = db.collection('botassignments');

try {
    let user = await users.findOne({ email });
    if (!user) {
        const hashed = await bcrypt.hash(password, 12);
        const now = new Date();
        const result = await users.insertOne({
            name,
            email,
            password: hashed,
            role,
            plan: 'free',
            status: 'active',
            createdAt: now,
            updatedAt: now,
        });
        user = await users.findOne({ _id: result.insertedId });
        console.log(`created local client ${email}`);
    } else {
        console.log(`reusing local client ${email}`);
    }

    const templates = await bots.find({ type: { $in: ['BETONLINE', 'PS3838'] } }).toArray();
    for (const template of templates) {
        await assignments.updateOne(
            { botId: template._id, userId: user._id },
            {
                $setOnInsert: {
                    botId: template._id,
                    userId: user._id,
                    createdBy: user._id,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            },
            { upsert: true }
        );
    }

    console.log(`user id: ${user._id}`);
    console.log(`assigned templates: ${templates.map((t) => t.type).join(', ') || '(none)'}`);
} finally {
    await mongoose.disconnect();
}
