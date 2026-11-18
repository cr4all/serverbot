import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import User from '@/models/User';
import Bot from '@/models/Bot';
import BotAssignment from '@/models/BotAssignment';

export async function POST(request: Request) {
    try {
        const { name, email, password } = await request.json();

        if (!name || !email || !password) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        await connectDB();

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { error: 'Email already in use' },
                { status: 400 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // New accounts start pending unless REGISTER_DEFAULT_STATUS=active (local/dev).
        const defaultStatusRaw = String(process.env.REGISTER_DEFAULT_STATUS ?? 'pending').trim().toLowerCase();
        const status =
            defaultStatusRaw === 'active' || defaultStatusRaw === 'suspended' || defaultStatusRaw === 'pending'
                ? defaultStatusRaw
                : 'pending';

        // Create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            status,
            plan: 'free',
        });
        // After user creation, auto-assign any default templates
        try {
            const defaults = await Bot.find({ isDefault: true }).lean();
            if (defaults && defaults.length > 0) {
                const docs = defaults.map((b: any) => ({ botId: b._id, userId: user._id, createdBy: user._id }));
                await BotAssignment.insertMany(docs);
            }
        } catch (e) {
            console.error('Error assigning default bots to new user', e);
        }

        return NextResponse.json(
            {
                message:
                    status === 'active'
                        ? 'User created successfully'
                        : 'User created; awaiting approval before login',
                userId: user._id,
                status,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
