/**
 * Pure helpers for the Telegram bot (no DB / network) — unit tested by telegramLogic.test.ts.
 */
import { randomInt } from 'node:crypto';

export const LINK_CODE_TTL_MS = 10 * 60 * 1000;

export const ALLOWED_LOCALES = ['COMMON', 'UNITED_KINGDOM', 'SPAIN', 'ITALY', 'GREECE', 'AUSTRALIA', 'FINLAND', 'BRAZIL', 'NETHERLANDS'];

const ALLOWED_BOT_TYPES = ['copybot', 'valuebot', 'tipsterbot'];

export function generateLinkCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function isLinkCodeFormat(code: unknown): boolean {
    return typeof code === 'string' && /^\d{6}$/.test(code);
}

export type LinkCodeHolder = {
    telegramLinkCode?: string | null;
    telegramLinkExpiresAt?: Date | string | null;
};

export function checkLinkCode(
    holder: LinkCodeHolder | null | undefined,
    code: string,
    now: Date = new Date()
): { ok: true } | { ok: false; reason: 'invalid' | 'expired' } {
    if (!holder || !holder.telegramLinkCode || holder.telegramLinkCode !== code) {
        return { ok: false, reason: 'invalid' };
    }
    const exp = holder.telegramLinkExpiresAt ? new Date(holder.telegramLinkExpiresAt) : null;
    if (!exp || Number.isNaN(exp.getTime()) || exp.getTime() <= now.getTime()) {
        return { ok: false, reason: 'expired' };
    }
    return { ok: true };
}

export type ParsedCommand = { cmd: string; args: string[] };

/** `/run@MyBot 2` → { cmd: 'run', args: ['2'] }. Returns null for non-command text. */
export function parseCommand(text: unknown): ParsedCommand | null {
    const s = String(text ?? '').trim();
    if (!s.startsWith('/')) return null;
    const parts = s.split(/\s+/);
    const head = parts[0].slice(1).split('@')[0].toLowerCase();
    if (!head || !/^[a-z0-9_]+$/.test(head)) return null;
    return { cmd: head, args: parts.slice(1) };
}

/** Converts a 1-based `/list` number into an array index. */
export function parseListIndex(
    arg: unknown,
    count: number
): { ok: true; index: number } | { ok: false; error: string } {
    const s = String(arg ?? '').trim();
    if (!s) return { ok: false, error: '번호를 입력하세요. 예: /run 1 (번호는 /list 참고)' };
    if (!/^\d+$/.test(s)) return { ok: false, error: `잘못된 번호입니다: ${s}. 예: /run 1` };
    const n = Number(s);
    if (count <= 0) return { ok: false, error: '인스턴스가 없습니다. /create 로 만드세요.' };
    if (n < 1 || n > count) return { ok: false, error: `1부터 ${count} 사이의 번호를 입력하세요.` };
    return { ok: true, index: n - 1 };
}

export type InstanceListItem = { name?: string; status?: string; botName?: string };

export function formatInstanceList(items: InstanceListItem[]): string {
    if (!items.length) return '인스턴스가 없습니다. /create 로 만드세요.';
    return items
        .map((it, i) => {
            const bot = it.botName ? ` (${it.botName})` : '';
            return `${i + 1}. ${it.name || '-'}${bot} [${it.status || 'UNKNOWN'}]`;
        })
        .join('\n');
}

export function formatSignedMoney(n: unknown): string {
    const v = Number(n);
    if (!Number.isFinite(v)) return '-';
    const sign = v > 0 ? '+' : v < 0 ? '-' : '';
    return `${sign}${Math.abs(v).toFixed(2)}`;
}

/* ------------------------------------------------------------------ */
/* Create flow                                                         */
/* ------------------------------------------------------------------ */

export type TemplateParam = { paramName: string; dataType?: string; unionValues?: (string | number)[] };

export type FlowTemplate = {
    id: string;
    name: string;
    defaultConfig?: Record<string, unknown>;
    configParams?: TemplateParam[];
};

export type QuestionKind = 'string' | 'secret' | 'number' | 'boolean' | 'union' | 'multi';

export type Question = {
    key: string;
    kind: QuestionKind;
    options?: string[];
    defaultValue?: unknown;
    required?: boolean;
    /** Only ask when BOTTYPE contains this value. */
    requiresBotType?: string;
};

const FREE_TIER_HIDDEN = new Set(['licenseKey', 'proxyType', 'proxyHost', 'proxyPort', 'proxyUsername', 'proxyPassword']);

export function isSecretKey(key: string): boolean {
    return /password|secret|privatekey|apikey/i.test(key);
}

function normalizeDataType(dt: unknown): string {
    return String(dt ?? '').trim().toLowerCase();
}

export function buildCreateQuestions(
    template: FlowTemplate,
    opts: { usesBookieConfig: boolean; isFreeTier: boolean }
): Question[] {
    const defaults = template.defaultConfig ?? {};
    const out: Question[] = [];
    const seen = new Set<string>();
    const push = (q: Question) => {
        if (seen.has(q.key)) return;
        seen.add(q.key);
        out.push(q);
    };

    if (!opts.isFreeTier) {
        push({ key: 'licenseKey', kind: 'string', required: true });
    }
    if (opts.usesBookieConfig) {
        push({ key: 'username', kind: 'string', required: true });
        push({ key: 'password', kind: 'secret', required: true });
        push({ key: 'locale', kind: 'union', options: ALLOWED_LOCALES, defaultValue: defaults.locale ?? 'COMMON' });
    }

    for (const p of template.configParams ?? []) {
        const key = String(p?.paramName ?? '').trim();
        if (!key) continue;
        if (opts.isFreeTier && FREE_TIER_HIDDEN.has(key)) continue;
        const dt = normalizeDataType(p.dataType);
        const def = defaults[key];
        const options = (p.unionValues ?? []).map((v) => String(v));
        if (dt === 'union' && options.length) {
            if (key === 'BOTTYPE') {
                push({ key, kind: 'multi', options, defaultValue: def });
            } else {
                push({
                    key,
                    kind: 'union',
                    options,
                    defaultValue: def,
                    ...(key === 'VALUEBET_MODE' ? { requiresBotType: 'valuebot' } : {}),
                });
            }
        } else if (dt === 'boolean') {
            push({ key, kind: 'boolean', defaultValue: def });
        } else if (dt === 'number') {
            push({ key, kind: 'number', defaultValue: def });
        } else {
            push({ key, kind: isSecretKey(key) ? 'secret' : 'string', defaultValue: def });
        }
    }
    return out;
}

export function selectedBotTypes(raw: unknown): string[] {
    const tokens: string[] = [];
    const walk = (v: unknown) => {
        if (v == null || v === '') return;
        if (Array.isArray(v)) {
            v.forEach(walk);
            return;
        }
        for (const part of String(v).split(/[,|]/)) {
            const t = part.trim().toLowerCase();
            if (t) tokens.push(t);
        }
    };
    walk(raw);
    const out: string[] = [];
    for (const t of tokens) {
        if (ALLOWED_BOT_TYPES.includes(t) && !out.includes(t)) out.push(t);
    }
    return out;
}

export function isQuestionActive(q: Question, config: Record<string, unknown>): boolean {
    if (!q.requiresBotType) return true;
    return selectedBotTypes(config.BOTTYPE).includes(q.requiresBotType);
}

/** Next active question index at or after `from`; returns questions.length when done. */
export function nextQuestionIndex(questions: Question[], config: Record<string, unknown>, from: number): number {
    let i = Math.max(0, from);
    while (i < questions.length && !isQuestionActive(questions[i], config)) i++;
    return i;
}

export type InlineButton = { text: string; callback_data: string };
export type InlineKeyboard = { inline_keyboard: InlineButton[][] };

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function hasDefault(q: Question): boolean {
    return q.defaultValue !== undefined && q.defaultValue !== null && q.defaultValue !== '';
}

function displayValue(v: unknown): string {
    if (Array.isArray(v)) return v.join(', ');
    if (v === true) return 'yes';
    if (v === false) return 'no';
    return String(v ?? '');
}

export function renderQuestion(
    q: Question,
    config: Record<string, unknown>,
    position: { index: number; total: number }
): { text: string; keyboard?: InlineKeyboard } {
    const head = `(${position.index + 1}/${position.total}) ${q.key}`;
    const defText = hasDefault(q) ? `\n기본값: ${q.kind === 'secret' ? '****' : displayValue(q.defaultValue)}` : '';
    const rows: InlineButton[][] = [];

    switch (q.kind) {
        case 'multi': {
            const current = Array.isArray(config[q.key])
                ? (config[q.key] as string[])
                : selectedBotTypes(q.defaultValue);
            rows.push(
                ...chunk(
                    (q.options ?? []).map((opt, i) => ({
                        text: `${current.includes(opt) ? '✅' : '⬜'} ${opt}`,
                        callback_data: `cf:t:${i}`,
                    })),
                    2
                )
            );
            rows.push([{ text: '완료', callback_data: 'cf:ok' }]);
            return { text: `${head}\n여러 개 선택 후 "완료"를 누르세요.`, keyboard: { inline_keyboard: rows } };
        }
        case 'union':
            rows.push(...chunk((q.options ?? []).map((opt, i) => ({ text: opt, callback_data: `cf:v:${i}` })), 2));
            if (hasDefault(q)) rows.push([{ text: '기본값', callback_data: 'cf:def' }]);
            return { text: `${head}\n하나를 고르세요.${defText}`, keyboard: { inline_keyboard: rows } };
        case 'boolean':
            rows.push([
                { text: '예', callback_data: 'cf:yes' },
                { text: '아니오', callback_data: 'cf:no' },
            ]);
            if (hasDefault(q)) rows.push([{ text: '기본값', callback_data: 'cf:def' }]);
            return { text: `${head}${defText}`, keyboard: { inline_keyboard: rows } };
        case 'number':
            if (hasDefault(q)) rows.push([{ text: '기본값', callback_data: 'cf:def' }]);
            return {
                text: `${head}\n숫자를 입력하세요.${defText}`,
                keyboard: rows.length ? { inline_keyboard: rows } : undefined,
            };
        case 'secret':
        case 'string':
        default: {
            if (hasDefault(q)) rows.push([{ text: '기본값', callback_data: 'cf:def' }]);
            else if (!q.required) rows.push([{ text: '건너뛰기', callback_data: 'cf:skip' }]);
            const note = q.kind === 'secret' ? '\n입력한 메시지는 바로 삭제됩니다.' : '';
            return {
                text: `${head}\n값을 입력하세요.${note}${defText}`,
                keyboard: rows.length ? { inline_keyboard: rows } : undefined,
            };
        }
    }
}

export type FlowInput = { type: 'text'; text: string } | { type: 'callback'; data: string };

export type AnswerResult =
    /** Value stored; move to the next question. */
    | { kind: 'next'; config: Record<string, unknown> }
    /** Multi-select toggled; re-render the same question. */
    | { kind: 'stay'; config: Record<string, unknown> }
    | { kind: 'error'; error: string };

export function applyAnswer(q: Question, config: Record<string, unknown>, input: FlowInput): AnswerResult {
    const next = { ...config };
    const data = input.type === 'callback' ? input.data : '';
    const text = input.type === 'text' ? input.text.trim() : '';

    if (data === 'cf:def') {
        if (!hasDefault(q)) return { kind: 'error', error: '기본값이 없습니다.' };
        next[q.key] = q.kind === 'multi' ? selectedBotTypes(q.defaultValue) : q.defaultValue;
        return { kind: 'next', config: next };
    }
    if (data === 'cf:skip') {
        if (q.required) return { kind: 'error', error: '필수 항목입니다.' };
        delete next[q.key];
        return { kind: 'next', config: next };
    }

    switch (q.kind) {
        case 'multi': {
            const options = q.options ?? [];
            const current = Array.isArray(next[q.key])
                ? [...(next[q.key] as string[])]
                : selectedBotTypes(q.defaultValue);
            if (data.startsWith('cf:t:')) {
                const opt = options[Number(data.slice(5))];
                if (opt === undefined) return { kind: 'error', error: '알 수 없는 선택입니다.' };
                const pos = current.indexOf(opt);
                if (pos >= 0) current.splice(pos, 1);
                else current.push(opt);
                next[q.key] = options.filter((o) => current.includes(o));
                return { kind: 'stay', config: next };
            }
            if (data === 'cf:ok') {
                if (!current.length) return { kind: 'error', error: '하나 이상 선택하세요.' };
                next[q.key] = options.filter((o) => current.includes(o));
                return { kind: 'next', config: next };
            }
            return { kind: 'error', error: '버튼으로 선택하세요.' };
        }
        case 'union': {
            const options = q.options ?? [];
            let value: string | undefined;
            if (data.startsWith('cf:v:')) value = options[Number(data.slice(5))];
            else if (text) value = options.find((o) => o.toLowerCase() === text.toLowerCase());
            if (value === undefined) return { kind: 'error', error: '목록에서 고르세요.' };
            next[q.key] = value;
            return { kind: 'next', config: next };
        }
        case 'boolean': {
            const t = text.toLowerCase();
            if (data === 'cf:yes' || ['y', 'yes', 'true', '예', '1'].includes(t)) next[q.key] = true;
            else if (data === 'cf:no' || ['n', 'no', 'false', '아니오', '0'].includes(t)) next[q.key] = false;
            else return { kind: 'error', error: '예 또는 아니오를 고르세요.' };
            return { kind: 'next', config: next };
        }
        case 'number': {
            if (!text) return { kind: 'error', error: '숫자를 입력하세요.' };
            const n = Number(text.replace(',', '.'));
            if (!Number.isFinite(n)) return { kind: 'error', error: `숫자가 아닙니다: ${text}` };
            next[q.key] = n;
            return { kind: 'next', config: next };
        }
        default: {
            if (!text) return { kind: 'error', error: '값을 입력하세요.' };
            next[q.key] = text;
            return { kind: 'next', config: next };
        }
    }
}

/** Fill unanswered keys from template defaults and drop inactive conditional keys. */
export function finalizeCreateConfig(
    questions: Question[],
    config: Record<string, unknown>,
    defaults: Record<string, unknown> = {}
): Record<string, unknown> {
    const out: Record<string, unknown> = { ...defaults, ...config };
    for (const q of questions) {
        if (!isQuestionActive(q, out)) {
            if (q.key === 'VALUEBET_MODE') out.VALUEBET_MODE = 'single';
            else delete out[q.key];
        }
    }
    if ('BOTTYPE' in out) {
        const types = selectedBotTypes(out.BOTTYPE);
        out.BOTTYPE = types.length ? types : ['copybot'];
    }
    return out;
}

export function formatCreateSummary(
    templateName: string,
    instanceName: string,
    questions: Question[],
    config: Record<string, unknown>
): string {
    const lines = [`템플릿: ${templateName}`, `이름: ${instanceName}`];
    for (const q of questions) {
        if (!isQuestionActive(q, config)) continue;
        const v = config[q.key];
        if (v === undefined || v === '') continue;
        const shown = q.kind === 'secret' || isSecretKey(q.key) ? '****' : displayValue(v);
        lines.push(`${q.key}: ${shown}`);
    }
    return lines.join('\n');
}

export function parseCallbackData(data: unknown): { ns: string; parts: string[] } | null {
    const s = String(data ?? '');
    if (!s) return null;
    const [ns, ...parts] = s.split(':');
    return { ns, parts };
}
