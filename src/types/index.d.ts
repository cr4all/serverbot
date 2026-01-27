import { Types } from 'mongoose';

// User Types
export type UserRole = 'user' | 'admin';

export interface IUser {
    _id: string | Types.ObjectId;
    name: string;
    email: string;
    image?: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}

// Bot Types (Template)
export type BotType = 'CHAT' | 'TRADING' | 'CRAWLER';

export interface IBot {
    _id: string | Types.ObjectId;
    name: string;
    description?: string;
    type: BotType;
    defaultConfig: Record<string, any>;
    version: string;
    createdAt: Date;
    updatedAt: Date;
}

// Bot Instance Types
export type BotStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' | 'STOPPING';

export interface IBotInstance {
    _id: string | Types.ObjectId;
    botId: string | Types.ObjectId | IBot;
    userId: string | Types.ObjectId | IUser;
    name: string;
    lastBalance: number;
    config: Record<string, any>;
    status: BotStatus;
    lastHeartbeat?: Date;
    createdAt: Date;
    updatedAt: Date;
}

