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
        /** Distributed Surebet: service plan. Free-form until plan tiers are decided. */
        plan: {
            type: String,
            trim: true,
            default: 'free',
        },
        /** Distributed Surebet: account state. Existing users default to 'active' (not enforced yet). */
        status: {
            type: String,
            enum: ['active', 'pending', 'suspended'],
            default: 'active',
        },
    },
    { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', UserSchema);
