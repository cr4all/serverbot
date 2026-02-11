import mongoose from 'mongoose';

const ConfigParamSchema = new mongoose.Schema(
    {
        paramName: {
            type: String,
            required: true,
        },
        dataType: {
            type: String,
            enum: ['String', 'Number', 'Union', 'Boolean'],
            required: true,
        },
        unionValues: {
            type: [mongoose.Schema.Types.Mixed],
            default: undefined,
        },
    },
    { _id: false }
);

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
            required: true,
        },
        subtype: {
            type: Number,
            required: true,
            default: 0,
        },
        defaultConfig: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        configParams: {
            type: [ConfigParamSchema],
            default: [],
        },
        version: {
            type: String,
            default: '1.0.0',
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

export default mongoose.models.Bot || mongoose.model('Bot', BotSchema);
