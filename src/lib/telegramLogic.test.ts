/**
 * Run: npm run test:telegram
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    applyAnswer,
    buildCreateQuestions,
    checkLinkCode,
    finalizeCreateConfig,
    formatCreateSummary,
    formatInstanceList,
    formatSignedMoney,
    generateLinkCode,
    isLinkCodeFormat,
    LINK_CODE_TTL_MS,
    nextQuestionIndex,
    parseCommand,
    parseListIndex,
    renderQuestion,
} from './telegramLogic.ts';
import type { FlowTemplate, Question } from './telegramLogic.ts';

describe('link code', () => {
    it('generates 6 digits', () => {
        for (let i = 0; i < 50; i++) {
            const c = generateLinkCode();
            assert.ok(isLinkCodeFormat(c), c);
        }
    });

    it('accepts a valid unexpired code', () => {
        const now = new Date('2026-10-07T10:00:00Z');
        const holder = { telegramLinkCode: '012345', telegramLinkExpiresAt: new Date(now.getTime() + LINK_CODE_TTL_MS) };
        assert.deepEqual(checkLinkCode(holder, '012345', now), { ok: true });
    });

    it('rejects expired code', () => {
        const now = new Date('2026-10-07T10:00:00Z');
        const holder = { telegramLinkCode: '012345', telegramLinkExpiresAt: new Date(now.getTime() - 1) };
        assert.deepEqual(checkLinkCode(holder, '012345', now), { ok: false, reason: 'expired' });
    });

    it('rejects wrong code or missing holder', () => {
        const holder = { telegramLinkCode: '012345', telegramLinkExpiresAt: new Date(Date.now() + 60_000) };
        assert.deepEqual(checkLinkCode(holder, '999999'), { ok: false, reason: 'invalid' });
        assert.deepEqual(checkLinkCode(null, '012345'), { ok: false, reason: 'invalid' });
        assert.deepEqual(checkLinkCode({ telegramLinkCode: null }, '012345'), { ok: false, reason: 'invalid' });
    });

    it('rejects code after relink cleared it', () => {
        assert.deepEqual(checkLinkCode({}, '012345'), { ok: false, reason: 'invalid' });
    });

    it('validates format', () => {
        assert.equal(isLinkCodeFormat('12345'), false);
        assert.equal(isLinkCodeFormat('abcdef'), false);
        assert.equal(isLinkCodeFormat(undefined), false);
    });
});

describe('command parsing', () => {
    it('parses commands with args and bot suffix', () => {
        assert.deepEqual(parseCommand('/run 2'), { cmd: 'run', args: ['2'] });
        assert.deepEqual(parseCommand('/STOP@MyBot  3 '), { cmd: 'stop', args: ['3'] });
        assert.deepEqual(parseCommand('/list'), { cmd: 'list', args: [] });
    });

    it('returns null for plain text', () => {
        assert.equal(parseCommand('hello'), null);
        assert.equal(parseCommand(''), null);
        assert.equal(parseCommand('/'), null);
    });

    it('validates list index', () => {
        assert.deepEqual(parseListIndex('2', 3), { ok: true, index: 1 });
        const bad = parseListIndex('abc', 3);
        assert.equal(bad.ok, false);
        assert.match((bad as { error: string }).error, /잘못된 번호/);
        assert.equal(parseListIndex('4', 3).ok, false);
        assert.equal(parseListIndex('0', 3).ok, false);
        assert.equal(parseListIndex(undefined, 3).ok, false);
        assert.equal(parseListIndex('1', 0).ok, false);
    });

    it('formats instance list and money', () => {
        assert.equal(
            formatInstanceList([{ name: 'A', status: 'RUNNING', botName: 'Superbet' }, { name: 'B', status: 'STOPPED' }]),
            '1. A (Superbet) [RUNNING]\n2. B [STOPPED]'
        );
        assert.equal(formatSignedMoney(60), '+60.00');
        assert.equal(formatSignedMoney(-50), '-50.00');
        assert.equal(formatSignedMoney(0), '0.00');
    });
});

const superbetTemplate: FlowTemplate = {
    id: 't1',
    name: 'Superbet',
    defaultConfig: { stake: 10, enableMaxbetAdjust: false, BOTTYPE: ['copybot'] },
    configParams: [
        { paramName: 'BOTTYPE', dataType: 'Union', unionValues: ['copybot', 'valuebot', 'tipsterbot'] },
        { paramName: 'VALUEBET_MODE', dataType: 'Union', unionValues: ['single', 'double'] },
        { paramName: 'stake', dataType: 'Number' },
        { paramName: 'enableMaxbetAdjust', dataType: 'Boolean' },
        { paramName: 'apiPassword', dataType: 'String' },
    ],
};

function q(questions: Question[], key: string): Question {
    const found = questions.find((x) => x.key === key);
    assert.ok(found, key);
    return found!;
}

describe('create flow', () => {
    const questions = buildCreateQuestions(superbetTemplate, { usesBookieConfig: true, isFreeTier: false });

    it('builds questions from base fields and configParams', () => {
        assert.deepEqual(
            questions.map((x) => `${x.key}:${x.kind}`),
            [
                'licenseKey:string',
                'username:string',
                'password:secret',
                'locale:union',
                'BOTTYPE:multi',
                'VALUEBET_MODE:union',
                'stake:number',
                'enableMaxbetAdjust:boolean',
                'apiPassword:secret',
            ]
        );
    });

    it('hides licenseKey for free tier and bookie fields when not used', () => {
        const free = buildCreateQuestions(superbetTemplate, { usesBookieConfig: false, isFreeTier: true });
        assert.equal(free.some((x) => ['licenseKey', 'username', 'password', 'locale'].includes(x.key)), false);
    });

    it('Union multi-select toggles then completes', () => {
        const bt = q(questions, 'BOTTYPE');
        let r = applyAnswer(bt, {}, { type: 'callback', data: 'cf:t:2' });
        assert.equal(r.kind, 'stay');
        let cfg = (r as { config: Record<string, unknown> }).config;
        assert.deepEqual(cfg.BOTTYPE, ['copybot', 'tipsterbot']);

        r = applyAnswer(bt, cfg, { type: 'callback', data: 'cf:t:0' });
        cfg = (r as { config: Record<string, unknown> }).config;
        assert.deepEqual(cfg.BOTTYPE, ['tipsterbot']);

        const rendered = renderQuestion(bt, cfg, { index: 4, total: questions.length });
        const texts = rendered.keyboard!.inline_keyboard.flat().map((b) => b.text);
        assert.ok(texts.includes('✅ tipsterbot'));
        assert.ok(texts.includes('⬜ copybot'));

        r = applyAnswer(bt, cfg, { type: 'callback', data: 'cf:ok' });
        assert.equal(r.kind, 'next');

        r = applyAnswer(bt, { BOTTYPE: [] }, { type: 'callback', data: 'cf:ok' });
        assert.equal(r.kind, 'error');
    });

    it('skips VALUEBET_MODE unless valuebot is selected', () => {
        const vmIdx = questions.findIndex((x) => x.key === 'VALUEBET_MODE');
        assert.equal(nextQuestionIndex(questions, { BOTTYPE: ['copybot'] }, vmIdx), vmIdx + 1);
        assert.equal(nextQuestionIndex(questions, { BOTTYPE: ['valuebot'] }, vmIdx), vmIdx);
        assert.equal(finalizeCreateConfig(questions, { BOTTYPE: ['copybot'], VALUEBET_MODE: 'double' }).VALUEBET_MODE, 'single');
    });

    it('validates numbers and supports default button', () => {
        const stake = q(questions, 'stake');
        assert.equal(applyAnswer(stake, {}, { type: 'text', text: 'abc' }).kind, 'error');
        const ok = applyAnswer(stake, {}, { type: 'text', text: '12,5' });
        assert.deepEqual(ok, { kind: 'next', config: { stake: 12.5 } });
        const def = applyAnswer(stake, {}, { type: 'callback', data: 'cf:def' });
        assert.deepEqual(def, { kind: 'next', config: { stake: 10 } });
        const noDef = applyAnswer(q(questions, 'username'), {}, { type: 'callback', data: 'cf:def' });
        assert.equal(noDef.kind, 'error');
    });

    it('handles boolean buttons', () => {
        const b = q(questions, 'enableMaxbetAdjust');
        assert.deepEqual(applyAnswer(b, {}, { type: 'callback', data: 'cf:yes' }), { kind: 'next', config: { enableMaxbetAdjust: true } });
        assert.deepEqual(applyAnswer(b, {}, { type: 'callback', data: 'cf:no' }), { kind: 'next', config: { enableMaxbetAdjust: false } });
    });

    it('masks secrets in summary and notes deletion in prompt', () => {
        const pw = q(questions, 'password');
        const prompt = renderQuestion(pw, {}, { index: 2, total: questions.length });
        assert.match(prompt.text, /삭제/);
        const summary = formatCreateSummary('Superbet', 'SB-1', questions, {
            username: 'john',
            password: 'hunter2',
            apiPassword: 'x',
            BOTTYPE: ['copybot'],
        });
        assert.ok(!summary.includes('hunter2'));
        assert.match(summary, /password: \*\*\*\*/);
        assert.match(summary, /apiPassword: \*\*\*\*/);
        assert.match(summary, /BOTTYPE: copybot/);
    });

    it('finalize merges defaults and normalizes BOTTYPE', () => {
        const cfg = finalizeCreateConfig(questions, { BOTTYPE: [] }, superbetTemplate.defaultConfig);
        assert.deepEqual(cfg.BOTTYPE, ['copybot']);
        assert.equal(cfg.stake, 10);
    });
});
