import type { InlineKeyboard } from '@/lib/telegramLogic';

type TelegramResult<T = unknown> = { ok: boolean; result?: T; description?: string };

async function callTelegram<T = unknown>(method: string, payload: Record<string, unknown>): Promise<TelegramResult<T>> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.warn(`[telegram] TELEGRAM_BOT_TOKEN is not set; skip ${method}`);
        return { ok: false, description: 'TELEGRAM_BOT_TOKEN is not set' };
    }
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15_000),
        });
        const data = (await res.json().catch(() => ({ ok: false }))) as TelegramResult<T>;
        if (!data.ok) console.warn(`[telegram] ${method} failed: ${data.description ?? res.status}`);
        return data;
    } catch (error) {
        console.error(`[telegram] ${method} error`, error);
        return { ok: false, description: String(error) };
    }
}

export function sendMessage(chatId: string | number, text: string, replyMarkup?: InlineKeyboard) {
    return callTelegram<{ message_id: number }>('sendMessage', {
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
}

export function editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    replyMarkup?: InlineKeyboard
) {
    return callTelegram('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
}

export function deleteMessage(chatId: string | number, messageId: number) {
    return callTelegram('deleteMessage', { chat_id: chatId, message_id: messageId });
}

export function answerCallbackQuery(callbackQueryId: string, text?: string) {
    return callTelegram('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        ...(text ? { text } : {}),
    });
}
