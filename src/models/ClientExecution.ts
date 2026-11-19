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

const RebuildSchema = new mongoose.Schema(
    {
        originalLine: { type: Number, default: null },
        appliedLine: { type: Number, required: true },
        profitPercent: { type: Number, default: 0 },
        reason: { type: String, default: '' },
    },
    { _id: false }
);

/** Snapshot of the tip at bet time so history stays readable after the tip expires. */
const TipSummaryLegSchema = new mongoose.Schema(
    {
        bookmaker: { type: String, required: true },
        selection: { type: String, default: '' },
        odds: { type: Number, default: null },
        marketType: { type: String, default: null },
        line: { type: Number, default: null },
        eventName: { type: String, default: null },
    },
    { _id: false }
);

const TipSummarySchema = new mongoose.Schema(
    {
        eventName: { type: String, default: '' },
        sport: { type: String, default: '' },
        profitPercent: { type: Number, default: null },
        legs: { type: [TipSummaryLegSchema], default: [] },
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
        tipSummary: { type: TipSummarySchema, default: null },
        /** Nearby-line rebuild. Persisted always; API may omit when SUREBET_SHOW_REBUILT is unset. */
        rebuilt: { type: Boolean, default: false },
        rebuild: { type: RebuildSchema, default: null },
    },
    { timestamps: true }
);

ClientExecutionSchema.index({ clientId: 1, createdAt: -1 });

export default mongoose.models.ClientExecution || mongoose.model('ClientExecution', ClientExecutionSchema);
