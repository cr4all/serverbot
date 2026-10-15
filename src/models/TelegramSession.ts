import mongoose from 'mongoose';

export const TELEGRAM_SESSION_TTL_SECONDS = 30 * 60;

const TelegramSessionSchema = new mongoose.Schema(
    {
        chatId: { type: String, required: true, unique: true },
        flow: { type: String, enum: ['create', null], default: null },
        step: { type: String, enum: ['template', 'name', 'param', 'confirm', null], default: null },
        botId: { type: mongoose.Schema.Types.ObjectId, default: null },
        instanceName: { type: String, default: null },
        config: { type: mongoose.Schema.Types.Mixed, default: {} },
        paramIndex: { type: Number, default: 0 },
        /** Instance ids in `/list` order (createdAt desc). */
        listCache: { type: [String], default: undefined },
    },
    { timestamps: { createdAt: false, updatedAt: true }, minimize: false }
);

TelegramSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: TELEGRAM_SESSION_TTL_SECONDS });

export default mongoose.models.TelegramSession || mongoose.model('TelegramSession', TelegramSessionSchema);
