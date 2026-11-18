/**
 * Local-only: create the client's BETONLINE/PS3838 BotInstance rows with encrypted accounts.
 *
 * The dashboard does the same through POST /api/bot-instances. This script exists so the pipeline can be
 * exercised without clicking through the UI; it reads the site accounts from mainbot/.env and never prints them.
 *
 * Run: node --env-file=.env.local scripts/seedClientAccounts.mjs [--email=...]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

const MONGODB_URI = String(process.env.MONGODB_URI ?? '').trim();
const KEY = String(process.env.CREDENTIALS_KEY ?? '').trim();
if (!MONGODB_URI) {
    console.error('MONGODB_URI is required (use --env-file=.env.local)');
    process.exit(1);
}
if (KEY.length < 16) {
    console.error('CREDENTIALS_KEY must be at least 16 characters');
    process.exit(1);
}

const args = process.argv.slice(2);
const emailArg = args.find((a) => a.startsWith('--email='));
const email = emailArg
    ? emailArg.slice('--email='.length).trim()
    : String(process.env.LOCAL_CLIENT_EMAIL || 'client@local.test').trim();

function parseEnvFile(pathname) {
    const out = {};
    if (!fs.existsSync(pathname)) return out;
    for (const line of fs.readFileSync(pathname, 'utf8').split(/\r?\n/)) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
        if (!match) continue;
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        out[match[1]] = value;
    }
    return out;
}

function deriveKey(raw) {
    return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

function encryptSecret(plain, raw) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(raw), iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

const mainbotEnvPath = path.resolve(process.cwd(), '..', 'mainbot', '.env');
const site = parseEnvFile(mainbotEnvPath);
const accounts = {
    BETONLINE: { username: site.BETONLINE_USERNAME || '', password: site.BETONLINE_PASSWORD || '' },
    PS3838: { username: site.PS3838_USERNAME || '', password: site.PS3838_PASSWORD || '' },
};
for (const [role, account] of Object.entries(accounts)) {
    if (!account.username || !account.password) {
        console.error(`mainbot/.env is missing ${role}_USERNAME / ${role}_PASSWORD`);
        process.exit(1);
    }
}

await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
const db = mongoose.connection.db;
const users = db.collection('users');
const bots = db.collection('bots');
const instances = db.collection('botinstances');

try {
    const user = await users.findOne({ email });
    if (!user) {
        console.error(`user not found: ${email} (run npm run seed:local-client first)`);
        process.exit(1);
    }

    for (const [role, account] of Object.entries(accounts)) {
        const template = await bots.findOne({ type: role });
        if (!template) {
            console.error(`template not found: ${role} (run npm run seed:surebet-templates first)`);
            continue;
        }
        const name = role === 'BETONLINE' ? 'BetOnline' : 'PS3838';
        await instances.updateOne(
            { userId: user._id, botId: template._id },
            {
                $set: {
                    name,
                    config: { account: { username: account.username, secret: encryptSecret(account.password, KEY) } },
                    status: 'STOPPED',
                    lastBalance: 0,
                    updatedAt: new Date(),
                },
                $setOnInsert: { userId: user._id, botId: template._id, createdAt: new Date() },
            },
            { upsert: true }
        );
        const stored = await instances.findOne({ userId: user._id, botId: template._id }, { projection: { _id: 1 } });
        console.log(`${role} instance -> ${stored?._id ?? 'missing'}`);
    }
} finally {
    await mongoose.disconnect();
}
