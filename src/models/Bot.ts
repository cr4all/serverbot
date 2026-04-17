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
        processType: {
            type: String,
            enum: ['inline', 'standalone'],
            default: 'inline',
        },
        /** Free bots run without a license; paid bots require a license */
        botTier: {
            type: String,
            enum: ['free', 'paid'],
            default: 'paid',
        },
        workerPath: {
            type: String,
        },
        templateStatus: {
            type: String,
            enum: ['AVAILABLE', 'MAINTENANCE'],
            default: 'AVAILABLE',
        },
        maintenanceSnapshotInstanceIds: {
            type: [mongoose.Schema.Types.ObjectId],
            default: [],
        },
        maintenanceSnapshotCreatedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

const ExistingBotModel = mongoose.models.Bot;
if (ExistingBotModel) {
    // Next.js dev mode may keep models cached across HMR. Ensure newly-added fields exist on the schema
    // so update operations don't strip them under strict mode.
    const schema = (ExistingBotModel as any).schema;
    if (!schema.path('maintenanceSnapshotInstanceIds')) {
        schema.add({
            maintenanceSnapshotInstanceIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
        });
    }
    if (!schema.path('maintenanceSnapshotCreatedAt')) {
        schema.add({
            maintenanceSnapshotCreatedAt: { type: Date },
        });
    }
    if (!schema.path('templateStatus')) {
        schema.add({
            templateStatus: { type: String, enum: ['AVAILABLE', 'MAINTENANCE'], default: 'AVAILABLE' },
        });
    }
}

export default ExistingBotModel || mongoose.model('Bot', BotSchema);
