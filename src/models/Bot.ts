import mongoose from 'mongoose';

const BotSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
        },
        description: {
            type: String,
        },
        type: {
            type: String,
            enum: ['CHAT', 'TRADING', 'CRAWLER'],
            required: true,
        },
        defaultConfig: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        version: {
            type: String,
            default: '1.0.0',
        },
    },
    { timestamps: true }
);

export default mongoose.models.Bot || mongoose.model('Bot', BotSchema);
