import connectDB from '@/lib/db';
import Bot from '@/models/Bot';
import User from '@/models/User';
import BotInstance from '@/models/BotInstance';
import BotAssignment from '@/models/BotAssignment';
import BetHistory from '@/models/BetHistory';
import TelegramSession, { TELEGRAM_SESSION_TTL_SECONDS } from '@/models/TelegramSession';
import { templateUsesBookieConfig } from '@/lib/botInstanceFilters';
import { createInstanceForUser, fetchInstanceBalance, setInstanceStatus } from '@/lib/botInstanceService';
import { answerCallbackQuery, deleteMessage, editMessageText, sendMessage } from '@/lib/telegram';
import {
    applyAnswer,
    buildCreateQuestions,
    checkLinkCode,
    finalizeCreateConfig,
    formatCreateSummary,
    formatInstanceList,
    formatSignedMoney,
    isLinkCodeFormat,
    nextQuestionIndex,
    parseCommand,
    parseListIndex,
    renderQuestion,
    type FlowInput,
    type FlowTemplate,
    type InlineKeyboard,
    type Question,
} from '@/lib/telegramLogic';

type TgUser = { _id: unknown; role?: string; name?: string };
type TgSession = {
    chatId: string;
    flow?: string | null;
    step?: string | null;
    botId?: unknown;
    instanceName?: string | null;
    config?: Record<string, unknown>;
    paramIndex?: number;
    listCache?: string[];
    updatedAt?: Date;
};

type Ctx = {
    chatId: string;
    user: TgUser | null;
    messageId?: number;
    callbackId?: string;
};

const HELP_TEXT = [
    '명령 목록',
    '/bots - 사용 가능한 템플릿',
    '/create - 인스턴스 만들기',
    '/list - 내 인스턴스 목록',
    '/run N - 실행',
    '/stop N - 중지',
    '/balance N - 잔고',
    '/status N - 상태, 최근 정산, 오늘 손익',
    '/cancel - 생성 취소',
].join('\n');

function userId(user: TgUser): string {
    return String(user._id);
}

function isAdmin(user: TgUser): boolean {
    return user.role === 'admin';
}

async function loadSession(chatId: string): Promise<TgSession | null> {
    const s = await TelegramSession.findOne({ chatId }).lean<TgSession | null>();
    if (!s) return null;
    const age = s.updatedAt ? Date.now() - new Date(s.updatedAt).getTime() : 0;
    if (age > TELEGRAM_SESSION_TTL_SECONDS * 1000) {
        await TelegramSession.deleteOne({ chatId });
        return null;
    }
    return s;
}

async function saveSession(chatId: string, patch: Partial<TgSession>): Promise<void> {
    await TelegramSession.updateOne({ chatId }, { $set: { ...patch, chatId } }, { upsert: true });
}

async function clearFlow(chatId: string): Promise<void> {
    await TelegramSession.updateOne(
        { chatId },
        { $set: { flow: null, step: null, botId: null, instanceName: null, config: {}, paramIndex: 0 } }
    );
}

async function reply(ctx: Ctx, text: string, keyboard?: InlineKeyboard) {
    return sendMessage(ctx.chatId, text, keyboard);
}

/* ------------------------------------------------------------------ */
/* Templates / instances                                               */
/* ------------------------------------------------------------------ */

type TemplateDoc = {
    _id: unknown;
    name: string;
    type?: string;
    subtype?: number;
    botTier?: string;
    templateStatus?: string;
    defaultConfig?: Record<string, unknown>;
    configParams?: FlowTemplate['configParams'];
};

async function templatesForUser(user: TgUser): Promise<TemplateDoc[]> {
    if (isAdmin(user)) {
        return Bot.find({}).sort({ createdAt: -1 }).lean<TemplateDoc[]>();
    }
    const assigns = await BotAssignment.find({ userId: user._id }).lean<{ botId: unknown }[]>();
    const ids = assigns.map((a) => a.botId).filter(Boolean);
    if (!ids.length) return [];
    return Bot.find({ _id: { $in: ids } }).sort({ createdAt: -1 }).lean<TemplateDoc[]>();
}

async function findTemplateForUser(user: TgUser, botId: string): Promise<TemplateDoc | null> {
    const list = await templatesForUser(user);
    return list.find((t) => String(t._id) === botId) ?? null;
}

function questionsFor(template: TemplateDoc): Question[] {
    return buildCreateQuestions(
        {
            id: String(template._id),
            name: template.name,
            defaultConfig: template.defaultConfig ?? {},
            configParams: template.configParams ?? [],
        },
        {
            usesBookieConfig: templateUsesBookieConfig(template as any),
            isFreeTier: template.botTier === 'free',
        }
    );
}

type InstanceDoc = { _id: unknown; name?: string; status?: string; lastBalance?: number; botId?: { name?: string } | null };

async function listInstances(user: TgUser): Promise<InstanceDoc[]> {
    return BotInstance.find({ userId: user._id })
        .populate('botId', 'name')
        .sort({ createdAt: -1 })
        .lean<InstanceDoc[]>();
}

/** Resolves `/cmd N` into an instance id using the cached `/list` order when available. */
async function resolveInstanceArg(ctx: Ctx, user: TgUser, arg: string | undefined): Promise<string | null> {
    const session = await loadSession(ctx.chatId);
    let ids = session?.listCache;
    if (!ids?.length) {
        ids = (await listInstances(user)).map((i) => String(i._id));
        await saveSession(ctx.chatId, { listCache: ids });
    }
    const parsed = parseListIndex(arg, ids.length);
    if (!parsed.ok) {
        await reply(ctx, parsed.error);
        return null;
    }
    return ids[parsed.index];
}

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

async function cmdStart(ctx: Ctx) {
    if (ctx.user) {
        await reply(ctx, `연결된 계정: ${ctx.user.name ?? ''}\n\n${HELP_TEXT}`);
    } else {
        await reply(
            ctx,
            '이 채팅은 아직 계정과 연결되지 않았습니다.\n대시보드에서 "Connect Telegram"을 눌러 코드를 받은 뒤 /link 123456 을 보내세요.'
        );
    }
}

async function cmdLink(ctx: Ctx, code: string | undefined) {
    if (!isLinkCodeFormat(code)) {
        await reply(ctx, '사용법: /link 123456 (대시보드에서 발급한 6자리 코드)');
        return;
    }
    const target = await User.findOne({ telegramLinkCode: code })
        .select('name telegramLinkCode telegramLinkExpiresAt')
        .lean<{ _id: unknown; name?: string; telegramLinkCode?: string; telegramLinkExpiresAt?: Date } | null>();
    const check = checkLinkCode(target, code as string);
    if (!check.ok || !target) {
        await reply(
            ctx,
            check.ok || check.reason === 'invalid'
                ? '코드가 올바르지 않습니다. 대시보드에서 새 코드를 받으세요.'
                : '코드가 만료되었습니다. 대시보드에서 새 코드를 받으세요.'
        );
        return;
    }
    await User.updateMany(
        { telegramChatId: ctx.chatId, _id: { $ne: target._id } },
        { $unset: { telegramChatId: 1 } }
    );
    await User.updateOne(
        { _id: target._id },
        { $set: { telegramChatId: ctx.chatId }, $unset: { telegramLinkCode: 1, telegramLinkExpiresAt: 1 } }
    );
    await TelegramSession.deleteOne({ chatId: ctx.chatId });
    await reply(ctx, `연결되었습니다: ${target.name ?? ''}\n\n${HELP_TEXT}`);
}

async function cmdBots(ctx: Ctx, user: TgUser) {
    const list = await templatesForUser(user);
    if (!list.length) {
        await reply(ctx, '할당된 템플릿이 없습니다.');
        return;
    }
    const lines = list.map(
        (t, i) => `${i + 1}. ${t.name}${t.templateStatus === 'MAINTENANCE' ? ' [점검 중]' : ''}`
    );
    await reply(ctx, lines.join('\n'));
}

async function cmdList(ctx: Ctx, user: TgUser) {
    const list = await listInstances(user);
    await saveSession(ctx.chatId, { listCache: list.map((i) => String(i._id)) });
    await reply(
        ctx,
        formatInstanceList(list.map((i) => ({ name: i.name, status: i.status, botName: i.botId?.name })))
    );
}

async function cmdRunStop(ctx: Ctx, user: TgUser, arg: string | undefined, status: 'RUNNING' | 'STOPPED') {
    const id = await resolveInstanceArg(ctx, user, arg);
    if (!id) return;
    await runStopById(ctx, user, id, status);
}

async function runStopById(ctx: Ctx, user: TgUser, id: string, status: 'RUNNING' | 'STOPPED') {
    const r = await setInstanceStatus({ userId: userId(user), isAdmin: isAdmin(user), id, status });
    if (!r.ok) {
        await reply(ctx, `실패: ${r.error}`);
        return;
    }
    const name = (r.instance as { name?: string })?.name ?? id;
    await reply(ctx, status === 'RUNNING' ? `${name} 실행을 요청했습니다.` : `${name} 중지를 요청했습니다.`);
}

async function findOwnedInstance(user: TgUser, id: string): Promise<InstanceDoc | null> {
    const q: Record<string, unknown> = { _id: id };
    if (!isAdmin(user)) q.userId = user._id;
    return BotInstance.findOne(q).populate('botId', 'name').lean<InstanceDoc | null>();
}

async function cmdBalance(ctx: Ctx, user: TgUser, arg: string | undefined) {
    const id = await resolveInstanceArg(ctx, user, arg);
    if (!id) return;
    const inst = await findOwnedInstance(user, id);
    if (!inst) {
        await reply(ctx, '인스턴스를 찾을 수 없습니다. /list 로 다시 확인하세요.');
        return;
    }
    const b = await fetchInstanceBalance(id, inst.lastBalance);
    if (b.balance == null) {
        await reply(ctx, `${inst.name}: 잔고를 가져오지 못했습니다.`);
        return;
    }
    const note = b.source === 'cached' ? ' (마지막 저장값)' : '';
    await reply(ctx, `${inst.name} 잔고: ${b.balance.toFixed(2)}${note}`);
}

async function cmdStatus(ctx: Ctx, user: TgUser, arg: string | undefined) {
    const id = await resolveInstanceArg(ctx, user, arg);
    if (!id) return;
    const inst = await findOwnedInstance(user, id);
    if (!inst) {
        await reply(ctx, '인스턴스를 찾을 수 없습니다. /list 로 다시 확인하세요.');
        return;
    }
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const [recent, todayRows, pending] = await Promise.all([
        BetHistory.find({ botInstanceId: inst._id, 'settlement.status': 'SETTLED' })
            .sort({ 'settlement.settledAt': -1 })
            .limit(5)
            .select('tip stake odds settlement.result settlement.profit')
            .lean<{ tip?: string; stake?: number; odds?: number; settlement?: { result?: string; profit?: number } }[]>(),
        BetHistory.find({
            botInstanceId: inst._id,
            'settlement.status': 'SETTLED',
            'settlement.settledAt': { $gte: todayStart },
        })
            .select('settlement.profit')
            .lean<{ settlement?: { profit?: number } }[]>(),
        BetHistory.countDocuments({ botInstanceId: inst._id, 'settlement.status': 'PENDING' }),
    ]);
    const todayPnl = todayRows.reduce((sum, r) => sum + (Number(r.settlement?.profit) || 0), 0);
    const lines = [
        `${inst.name} (${inst.botId?.name ?? '-'})`,
        `상태: ${inst.status ?? '-'}`,
        `정산 대기: ${pending}건`,
        `오늘 손익 (UTC): ${formatSignedMoney(todayPnl)} (${todayRows.length}건)`,
    ];
    if (recent.length) {
        lines.push('', '최근 정산');
        for (const r of recent) {
            const tipLabel = String(r.tip ?? '').slice(0, 60);
            lines.push(
                `${r.settlement?.result ?? '-'} ${formatSignedMoney(r.settlement?.profit)} | ${tipLabel} @${r.odds ?? '-'} stake ${r.stake ?? '-'}`
            );
        }
    }
    await reply(ctx, lines.join('\n'));
}

/* ------------------------------------------------------------------ */
/* Create flow                                                         */
/* ------------------------------------------------------------------ */

async function cmdCreate(ctx: Ctx, user: TgUser) {
    const list = (await templatesForUser(user)).filter(
        (t) => isAdmin(user) || t.templateStatus !== 'MAINTENANCE'
    );
    if (!list.length) {
        await reply(ctx, '만들 수 있는 템플릿이 없습니다.');
        return;
    }
    await saveSession(ctx.chatId, {
        flow: 'create',
        step: 'template',
        botId: null,
        instanceName: null,
        config: {},
        paramIndex: 0,
    });
    await reply(ctx, '템플릿을 고르세요. (/cancel 로 취소)', {
        inline_keyboard: list.map((t) => [{ text: t.name, callback_data: `tpl:${String(t._id)}` }]),
    });
}

async function askQuestion(ctx: Ctx, questions: Question[], index: number, config: Record<string, unknown>) {
    const q = questions[index];
    const { text, keyboard } = renderQuestion(q, config, { index, total: questions.length });
    await reply(ctx, text, keyboard);
}

async function showConfirm(ctx: Ctx, template: TemplateDoc, session: TgSession, config: Record<string, unknown>) {
    const questions = questionsFor(template);
    const summary = formatCreateSummary(template.name, session.instanceName ?? '', questions, config);
    await reply(ctx, `${summary}\n\n이대로 만들까요?`, {
        inline_keyboard: [[
            { text: '생성', callback_data: 'mk:yes' },
            { text: '취소', callback_data: 'mk:no' },
        ]],
    });
}

/** Advances to the next active question, or the confirm step. */
async function advance(
    ctx: Ctx,
    template: TemplateDoc,
    session: TgSession,
    config: Record<string, unknown>,
    from: number
) {
    const questions = questionsFor(template);
    const idx = nextQuestionIndex(questions, config, from);
    if (idx >= questions.length) {
        await saveSession(ctx.chatId, { step: 'confirm', config, paramIndex: idx });
        await showConfirm(ctx, template, session, config);
        return;
    }
    await saveSession(ctx.chatId, { step: 'param', config, paramIndex: idx });
    await askQuestion(ctx, questions, idx, config);
}

async function flowPickTemplate(ctx: Ctx, user: TgUser, session: TgSession | null, botId: string) {
    if (session?.flow !== 'create' || session.step !== 'template') {
        await reply(ctx, '진행 중인 생성이 없습니다. /create 로 시작하세요.');
        return;
    }
    const template = await findTemplateForUser(user, botId);
    if (!template) {
        await reply(ctx, '이 템플릿을 사용할 수 없습니다.');
        return;
    }
    await saveSession(ctx.chatId, { step: 'name', botId: template._id, config: {}, paramIndex: 0 });
    if (ctx.messageId) await editMessageText(ctx.chatId, ctx.messageId, `템플릿: ${template.name}`);
    await reply(ctx, '인스턴스 이름을 입력하세요.');
}

async function flowInput(ctx: Ctx, user: TgUser, session: TgSession, input: FlowInput) {
    if (session.step === 'template') {
        await reply(ctx, '위 버튼에서 템플릿을 고르세요. (/cancel 로 취소)');
        return;
    }
    const template = session.botId ? await findTemplateForUser(user, String(session.botId)) : null;
    if (!template) {
        await clearFlow(ctx.chatId);
        await reply(ctx, '템플릿을 찾을 수 없어 생성을 취소했습니다.');
        return;
    }

    if (session.step === 'name') {
        const name = input.type === 'text' ? input.text.trim() : '';
        if (!name) {
            await reply(ctx, '인스턴스 이름을 입력하세요.');
            return;
        }
        if (name.length > 100) {
            await reply(ctx, '이름은 100자 이하로 입력하세요.');
            return;
        }
        session.instanceName = name;
        await saveSession(ctx.chatId, { instanceName: name });
        await advance(ctx, template, session, session.config ?? {}, 0);
        return;
    }

    if (session.step === 'confirm') {
        await reply(ctx, '"생성" 또는 "취소" 버튼을 누르세요.');
        return;
    }

    const questions = questionsFor(template);
    const idx = session.paramIndex ?? 0;
    const q = questions[idx];
    if (!q) {
        await advance(ctx, template, session, session.config ?? {}, idx);
        return;
    }

    if (input.type === 'text' && q.kind === 'secret' && ctx.messageId) {
        await deleteMessage(ctx.chatId, ctx.messageId);
    }

    const result = applyAnswer(q, session.config ?? {}, input);
    if (result.kind === 'error') {
        await reply(ctx, result.error);
        if (input.type === 'text') await askQuestion(ctx, questions, idx, session.config ?? {});
        return;
    }
    if (result.kind === 'stay') {
        await saveSession(ctx.chatId, { config: result.config });
        const { text, keyboard } = renderQuestion(q, result.config, { index: idx, total: questions.length });
        if (ctx.messageId) await editMessageText(ctx.chatId, ctx.messageId, text, keyboard);
        else await reply(ctx, text, keyboard);
        return;
    }

    if (input.type === 'callback' && ctx.messageId) {
        const v = result.config[q.key];
        const shown = q.kind === 'secret' ? '****' : Array.isArray(v) ? v.join(', ') : String(v ?? '');
        await editMessageText(ctx.chatId, ctx.messageId, `${q.key}: ${shown}`);
    }
    await advance(ctx, template, session, result.config, idx + 1);
}

async function flowCreate(ctx: Ctx, user: TgUser, session: TgSession | null) {
    if (session?.flow !== 'create' || session.step !== 'confirm' || !session.botId) {
        await reply(ctx, '진행 중인 생성이 없습니다. /create 로 시작하세요.');
        return;
    }
    const template = await findTemplateForUser(user, String(session.botId));
    if (!template) {
        await clearFlow(ctx.chatId);
        await reply(ctx, '템플릿을 찾을 수 없어 생성을 취소했습니다.');
        return;
    }
    const config = finalizeCreateConfig(questionsFor(template), session.config ?? {}, template.defaultConfig ?? {});
    const r = await createInstanceForUser({
        userId: userId(user),
        isAdmin: isAdmin(user),
        body: { botId: String(template._id), name: session.instanceName, config, status: 'STOPPED' },
    });
    if (!r.ok) {
        await reply(ctx, `생성 실패: ${r.error}`);
        return;
    }
    await clearFlow(ctx.chatId);
    await TelegramSession.updateOne({ chatId: ctx.chatId }, { $unset: { listCache: 1 } });
    if (ctx.messageId) await editMessageText(ctx.chatId, ctx.messageId, '생성 완료');
    const id = String((r.instance as { _id: unknown })._id);
    await reply(ctx, `${session.instanceName} 인스턴스를 만들었습니다. (STOPPED)`, {
        inline_keyboard: [[{ text: '지금 실행', callback_data: `run:${id}` }]],
    });
}

async function cmdCancel(ctx: Ctx, session: TgSession | null) {
    if (session?.flow !== 'create') {
        await reply(ctx, '진행 중인 생성이 없습니다.');
        return;
    }
    await clearFlow(ctx.chatId);
    await reply(ctx, '생성을 취소했습니다.');
}

/* ------------------------------------------------------------------ */
/* Entry                                                               */
/* ------------------------------------------------------------------ */

async function findLinkedUser(chatId: string): Promise<TgUser | null> {
    return User.findOne({ telegramChatId: chatId }).select('name role').lean<TgUser | null>();
}

async function handleMessage(message: any) {
    const chatId = String(message?.chat?.id ?? '');
    if (!chatId) return;
    const text = typeof message.text === 'string' ? message.text : '';
    const user = await findLinkedUser(chatId);
    const ctx: Ctx = { chatId, user, messageId: message.message_id };
    const cmd = parseCommand(text);

    if (cmd) {
        if (cmd.cmd === 'start' || cmd.cmd === 'help') return cmdStart(ctx);
        if (cmd.cmd === 'link') return cmdLink(ctx, cmd.args[0]);
        if (!user) return reply(ctx, '먼저 계정을 연결하세요: /link 123456');
        const session = await loadSession(chatId);
        switch (cmd.cmd) {
            case 'bots':
                return cmdBots(ctx, user);
            case 'create':
                return cmdCreate(ctx, user);
            case 'list':
                return cmdList(ctx, user);
            case 'run':
                return cmdRunStop(ctx, user, cmd.args[0], 'RUNNING');
            case 'stop':
                return cmdRunStop(ctx, user, cmd.args[0], 'STOPPED');
            case 'balance':
                return cmdBalance(ctx, user, cmd.args[0]);
            case 'status':
                return cmdStatus(ctx, user, cmd.args[0]);
            case 'cancel':
                return cmdCancel(ctx, session);
            default:
                return reply(ctx, `알 수 없는 명령입니다.\n\n${HELP_TEXT}`);
        }
    }

    if (!user) return reply(ctx, '먼저 계정을 연결하세요: /link 123456');
    if (!text) return;
    const session = await loadSession(chatId);
    if (session?.flow === 'create') return flowInput(ctx, user, session, { type: 'text', text });
    return reply(ctx, HELP_TEXT);
}

async function handleCallback(cq: any) {
    const chatId = String(cq?.message?.chat?.id ?? '');
    const data = String(cq?.data ?? '');
    if (cq?.id) await answerCallbackQuery(cq.id);
    if (!chatId || !data) return;
    const user = await findLinkedUser(chatId);
    const ctx: Ctx = { chatId, user, messageId: cq.message?.message_id, callbackId: cq.id };
    if (!user) return reply(ctx, '먼저 계정을 연결하세요: /link 123456');

    const session = await loadSession(chatId);
    if (data.startsWith('tpl:')) return flowPickTemplate(ctx, user, session, data.slice(4));
    if (data === 'mk:yes') return flowCreate(ctx, user, session);
    if (data === 'mk:no') {
        if (ctx.messageId) await editMessageText(chatId, ctx.messageId, '생성 취소');
        return cmdCancel(ctx, session);
    }
    if (data.startsWith('run:')) {
        if (ctx.messageId) await editMessageText(chatId, ctx.messageId, '실행 요청');
        return runStopById(ctx, user, data.slice(4), 'RUNNING');
    }
    if (data.startsWith('cf:')) {
        if (session?.flow !== 'create' || session.step !== 'param') {
            return reply(ctx, '진행 중인 생성이 없습니다. /create 로 시작하세요.');
        }
        return flowInput(ctx, user, session, { type: 'callback', data });
    }
}

export async function handleTelegramUpdate(update: any): Promise<void> {
    await connectDB();
    if (update?.message) await handleMessage(update.message);
    else if (update?.callback_query) await handleCallback(update.callback_query);
}
