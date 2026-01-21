import mongoose from 'mongoose';

const BotLogSchema = new mongoose.Schema(
    {
        instanceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BotInstance',
            required: true,
        },
        level: {
            type: String,
            enum: ['INFO', 'WARN', 'ERROR'],
            default: 'INFO',
        },
        message: {
            type: String,
            required: true,
        },
        meta: {
            type: mongoose.Schema.Types.Mixed,
        },
    },
    { timestamps: true }
);

// Index for efficient querying by instance and time
BotLogSchema.index({ instanceId: 1, createdAt: -1 });

export default mongoose.models.BotLog || mongoose.model('BotLog', BotLogSchema);
