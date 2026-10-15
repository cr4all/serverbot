import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: false, // Optional if using OAuth
        },
        image: {
            type: String,
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        telegramChatId: {
            type: String,
            unique: true,
            sparse: true,
        },
        telegramLinkCode: {
            type: String,
        },
        telegramLinkExpiresAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

const ExistingUserModel = mongoose.models.User;
if (ExistingUserModel) {
    // Next.js dev HMR keeps the cached model; add new fields so strict mode keeps them.
    const schema = (ExistingUserModel as any).schema;
    if (!schema.path('telegramChatId')) {
        schema.add({
            telegramChatId: { type: String, unique: true, sparse: true },
            telegramLinkCode: { type: String },
            telegramLinkExpiresAt: { type: Date },
        });
    }
}

export default ExistingUserModel || mongoose.model('User', UserSchema);
