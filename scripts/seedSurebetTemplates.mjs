/**
 * One-time seed for the distributed surebet bookmaker templates.
 *
 * Creates the BETONLINE and PS3838 Bot templates the dashboard needs before a client can create an instance.
 * Optionally assigns them to a user (--email=...) or to every user (--all).
 *
 * Run: node --env-file=.env.local scripts/seedSurebetTemplates.mjs --all
 */
import mongoose from 'mongoose';

const MONGODB_URI = String(process.env.MONGODB_URI ?? '').trim();
if (!MONGODB_URI) {
    console.error('MONGODB_URI is required (use --env-file=.env.local or set it in the environment)');
    process.exit(1);
}

const TEMPLATES = [
    {
        name: 'BetOnline Surebet',
        description: 'Distributed surebet — BetOnline leg. The client account is stored encrypted on the instance.',
        type: 'BETONLINE',
    },
    {
        name: 'PS3838 Surebet',
        description: 'Distributed surebet — PS3838 leg. The client account is stored encrypted on the instance.',
        type: 'PS3838',
    },
];

function templateFields(t) {
    return {
        name: t.name,
        description: t.description,
        type: t.type,
        subtype: 0,
        defaultConfig: { stake: 1 },
        configParams: [],
        version: '1.0.0',
        isDefault: false,
        processType: 'inline',
        botTier: 'free',
        templateStatus: 'AVAILABLE',
        updatedAt: new Date(),
    };
}

const args = process.argv.slice(2);
const emailArg = args.find((a) => a.startsWith('--email='));
const assignEmail = emailArg ? emailArg.slice('--email='.length).trim() : String(process.env.SEED_ASSIGN_EMAIL ?? '').trim();
const assignAll = args.includes('--all');

await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
const db = mongoose.connection.db;
const bots = db.collection('bots');
const assignments = db.collection('botassignments');
const users = db.collection('users');

try {
    for (const template of TEMPLATES) {
        await bots.updateOne(
            { name: template.name },
            { $set: templateFields(template), $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
        );
        const stored = await bots.findOne({ name: template.name }, { projection: { _id: 1, type: 1 } });
        console.log(`template ${template.type} -> ${stored?._id ?? 'missing'}`);
    }

    let targets = [];
    if (assignAll) {
        targets = await users.find({}, { projection: { _id: 1, email: 1 } }).toArray();
    } else if (assignEmail) {
        const user = await users.findOne({ email: assignEmail }, { projection: { _id: 1, email: 1 } });
        if (!user) {
            console.error(`user not found: ${assignEmail}`);
        } else {
            targets = [user];
        }
    } else {
        console.log('no assignment requested (use --email=<address> or --all)');
    }

    for (const user of targets) {
        for (const template of TEMPLATES) {
            const bot = await bots.findOne({ name: template.name }, { projection: { _id: 1 } });
            if (!bot) continue;
            await assignments.updateOne(
                { botId: bot._id, userId: user._id },
                {
                    $setOnInsert: {
                        botId: bot._id,
                        userId: user._id,
                        createdBy: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                },
                { upsert: true }
            );
        }
        console.log(`assigned BETONLINE + PS3838 to ${user.email || user._id}`);
    }
} finally {
    await mongoose.disconnect();
}
