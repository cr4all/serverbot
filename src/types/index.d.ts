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
export type Locale = 'COMMON' | 'SPAIN' | 'ITALY' | 'AUSTRALIA' | 'FINLAND';

export interface IBotInstance {
    _id: string | Types.ObjectId;
    botId: string | Types.ObjectId | IBot;
    userId: string | Types.ObjectId | IUser;
    name: string;
    lastBalance: number;
    config: Record<string, any> & { locale?: Locale };
    status: BotStatus;
    lastHeartbeat?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Betting stats (PR5b) — mirrors lib/bettingStats BettingStatsPayload
export type StatsPeriodType = 'day' | 'days7' | 'days30' | 'year' | 'all' | 'week' | 'month';

export interface IBettingStatsPeriod {
    type: StatsPeriodType;
    start: string;
    end: string;
    offset: number;
}

export interface IBettingStatsResponse {
    period: IBettingStatsPeriod;
    execution: {
        betsPlaced: number;
        submitFailed: number;
        submitSuccessRate: number;
    };
    settlement: {
        settled: number;
        pending: number;
        won: number;
        lost: number;
        draw: number;
        void: number;
    };
    performance: {
        netPnL: number;
        roi: number;
        winRate: number;
        avgOdds: number;
        totalStakedSettled: number;
    };
    series: {
        cumulativePnLByDay: Array<{ date: string; pnl: number; cumulative: number }>;
    };
    definitions: Record<string, string>;
}

export interface ITemplateBettingStatsResponse extends IBettingStatsResponse {
    botId: string;
    botName?: string;
    insufficientData: boolean;
    minSettledRequired: number;
}

