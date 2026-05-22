import mongoose from 'mongoose';

/**
 * PR5a-v2 — precomputed stats cache (optional; not written until STATS_ROLLUP_ENABLED).
 */
const BotStatsRollupSchema = new mongoose.Schema(
    {
        scope: {
            type: String,
            enum: ['INSTANCE', 'TEMPLATE'],
            required: true,
        },
        scopeId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        periodType: {
            type: String,
            enum: ['WEEK', 'MONTH'],
            required: true,
        },
        periodStart: {
            type: Date,
            required: true,
        },
        metrics: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        computedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

BotStatsRollupSchema.index({ scope: 1, scopeId: 1, periodType: 1, periodStart: 1 }, { unique: true });

export default mongoose.models.BotStatsRollup || mongoose.model('BotStatsRollup', BotStatsRollupSchema);
