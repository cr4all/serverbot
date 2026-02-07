import mongoose from 'mongoose';
import './Bot';
import './User';

const BotAssignmentSchema = new mongoose.Schema(
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
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

BotAssignmentSchema.index({ userId: 1 });
BotAssignmentSchema.index({ botId: 1 });
BotAssignmentSchema.index({ botId: 1, userId: 1 }, { unique: true });

export default mongoose.models.BotAssignment || mongoose.model('BotAssignment', BotAssignmentSchema);
