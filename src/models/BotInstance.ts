import mongoose from 'mongoose';
import './Bot';
import './User';
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
        lastBalance: {
            type: Number,
            default: 0,
        },
        config: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
            validate: {
                validator: function (v: any) {
                    if (!v) return true; // nothing to validate
                    const allowed = ['COMMON', 'SPAIN', 'ITALY', 'AUSTRALIA', 'FINLAND', 'BRAZIL'];
                    if (v.locale === undefined || v.locale === null) return true; // optional
                    return allowed.includes(v.locale);
                },
                message: (props: any) => `Invalid locale '${props.value?.locale}'`,
            },
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
