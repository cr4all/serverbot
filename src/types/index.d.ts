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

export type ConfigParamDataType = 'String' | 'Number' | 'Union' | 'Boolean';

export interface IConfigParam {
    paramName: string;
    dataType: ConfigParamDataType;
    unionValues?: (string | number)[];
}

export interface IBot {
    _id: string | Types.ObjectId;
    name: string;
    description?: string;
    type: string;
    subtype: number;
    defaultConfig: Record<string, any>;
    configParams?: IConfigParam[];
    version: string;
    isDefault?: boolean;
    /** Free templates run without a license */
    botTier?: 'free' | 'paid';
    templateStatus?: 'AVAILABLE' | 'MAINTENANCE';
    maintenanceSnapshotInstanceIds?: (string | Types.ObjectId)[];
    maintenanceSnapshotCreatedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Bot Instance Types
export type BotStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' | 'STOPPING';
export type Locale = 'COMMON' | 'UNITED_KINGDOM' | 'SPAIN' | 'ITALY' | 'GREECE' | 'AUSTRALIA' | 'FINLAND' | 'BRAZIL';
export type BotInstanceBotType = 'copybot' | 'valuebot' | 'tipsterbot';

export interface IBotInstanceFilters {
    minEdge?: number;
    maxEdge?: number;
    minOdds?: number;
    maxOdds?: number;
    /** Live poll + cross-batch retry count (Bet365 valuebot/tipsterbot). Default 60. */
    liveWaitRetries?: number;
    /** Interval (ms) for retry-list timer when no new tips arrive (Bet365 valuebot/tipsterbot). */
    valuebetRetryIntervalMs?: number;
    sports?: string[];
}

export interface IBotInstance {
    _id: string | Types.ObjectId;
    botId: string | Types.ObjectId | IBot;
    userId: string | Types.ObjectId | IUser;
    name: string;
    lastBalance: number;
    config: Record<string, any> & IBotInstanceFilters & { locale?: Locale; BOTTYPE?: BotInstanceBotType };
    status: BotStatus;
    lastHeartbeat?: Date;
    createdAt: Date;
    updatedAt: Date;
}

