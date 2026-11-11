import mongoose from 'mongoose';

/**
 * One client's execution of one tip on its own two VPSs (decision: the client runs the bet, the hub only
 * distributes tips). Kept per client so a dashboard can only ever read its own rows.
 */
const ExecutionLegSchema = new mongoose.Schema(
    {
        bookmaker: { type: String, required: true },
        state: { type: String, required: true },
        reason: { type: String, default: null },
        orderId: { type: String, default: null },
        odds: { type: Number, default: null },
    },
    { _id: false }
);

const ClientExecutionSchema = new mongoose.Schema(
    {
        executionId: { type: String, required: true, unique: true },
        tipId: { type: String, required: true },
        clientId: { type: String, required: true, index: true },
        totalStake: { type: Number, required: true },
        state: { type: String, required: true },
        note: { type: String, default: null },
        legs: { type: [ExecutionLegSchema], default: [] },
    },
    { timestamps: true }
);

ClientExecutionSchema.index({ clientId: 1, createdAt: -1 });

export default mongoose.models.ClientExecution || mongoose.model('ClientExecution', ClientExecutionSchema);
