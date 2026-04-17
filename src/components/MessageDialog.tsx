'use client';

import { useEffect, useId } from 'react';

type Variant = 'info' | 'warning' | 'danger' | 'success';

export default function MessageDialog({
  open,
  title,
  message,
  variant = 'info',
  confirmText = 'OK',
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  variant?: Variant;
  confirmText?: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const accent =
    variant === 'danger'
      ? 'bg-red-600'
      : variant === 'warning'
        ? 'bg-amber-500'
        : variant === 'success'
          ? 'bg-emerald-600'
          : 'bg-blue-600';

  const ring =
    variant === 'danger'
      ? 'focus:ring-red-500'
      : variant === 'warning'
        ? 'focus:ring-amber-500'
        : variant === 'success'
          ? 'focus:ring-emerald-500'
          : 'focus:ring-blue-500';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className={`h-1.5 w-full ${accent}`} aria-hidden />
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${accent}`} aria-hidden />
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-gray-900 dark:text-white">
                {title}
              </h2>
              <p id={messageId} className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                {message}
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className={`inline-flex items-center justify-center rounded-lg ${accent} px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2 ${ring} dark:focus:ring-offset-gray-900`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

