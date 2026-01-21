import mongoose from 'mongoose';

const BotInstanceSchema = new mongoose.Schema(
    {
        botId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Bot',
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        name: {
            type: String, // User defined name for the instance
            required: true,
        },
        config: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        status: {
            type: String,
            enum: ['STOPPED', 'STARTING', 'RUNNING', 'ERROR', 'STOPPING'],
            default: 'STOPPED',
        },
        lastHeartbeat: {
            type: Date,
        },
    },
    { timestamps: true }
);

export default mongoose.models.BotInstance || mongoose.model('BotInstance', BotInstanceSchema);
