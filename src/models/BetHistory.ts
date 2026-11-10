import mongoose from 'mongoose';

const SettlementSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: ['PENDING', 'SETTLED', 'UNKNOWN', 'CANCELLED'],
            default: 'PENDING',
        },
        result: {
            type: String,
            enum: ['WON', 'LOST', 'DRAW', 'VOID', 'HALF_WON', 'HALF_LOST', 'CASHOUT'],
            default: null,
        },
        grossReturn: { type: Number, default: null },
        profit: { type: Number, default: null },
        settledAt: { type: Date, default: null },
        checkedAt: { type: Date, default: null },
        source: {
            type: String,
            enum: ['SITE_API', 'MANUAL'],
            default: null,
        },
        error: { type: String, default: null },
        raw: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    { _id: false }
);

const BetHistorySchema = new mongoose.Schema(
    {
        botInstanceId: {
            type: mongoose.Schema.Types.ObjectId,
        },

        botId: {
            type: mongoose.Schema.Types.ObjectId,
        },

        tip_id: {
            type: String,
            required: true,
        },

        tip: {
            type: String,
            required: true,
        },

        stake: {
            type: Number,
            required: true,
        },

        failedCount: {
            type: Number,
            default: 0,
            required: true,
        },

        /** @deprecated Use placeStatus; kept for backward compatibility */
        status: {
            type: String,
            enum: ['SUCCESS', 'FAILED'],
            default: 'SUCCESS',
        },

        placeStatus: {
            type: String,
            enum: ['SUCCESS', 'FAILED'],
            default: 'SUCCESS',
        },

        balance: {
            type: Number,
            default: 0,
        },

        orderId: {
            type: String,
            required: true,
            default: '',
        },

        odds: {
            type: Number,
            default: null,
        },

        currency: {
            type: String,
            default: null,
        },

        /** Distributed Surebet: links the two legs of one execution. Absent for legacy bets. */
        executionId: {
            type: String,
        },
        legSide: {
            type: String,
            enum: ['A', 'B'],
        },
        tipRef: {
            type: String,
        },

        settlement: {
            type: SettlementSchema,
            default: undefined,
        },
    },
    {
        timestamps: true,
    }
);

BetHistorySchema.index({ botInstanceId: 1, tip_id: 1 }, { unique: true });
BetHistorySchema.index({ botInstanceId: 1, 'settlement.status': 1, placeStatus: 1, createdAt: -1 });
BetHistorySchema.index({ botId: 1, 'settlement.status': 1, 'settlement.settledAt': -1 });
BetHistorySchema.index({ orderId: 1 }, { sparse: true });
BetHistorySchema.index({ executionId: 1, legSide: 1 }, { sparse: true });

export default mongoose.models.BetHistory || mongoose.model('BetHistory', BetHistorySchema);
