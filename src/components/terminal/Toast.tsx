'use client';

import { useEffect } from 'react';

export type ToastTone = 'success' | 'warning' | 'danger' | 'info';

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
  details?: string[];
  durationMs?: number;
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'success') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === 'danger' || tone === 'warning') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 4 3.5 19h17L12 4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M12 9v4.5M12 16.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 10.5V16M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Toast({
  toast,
  onClose,
}: {
  toast: ToastMessage | null;
  onClose: () => void;
}) {
  const durationMs = toast?.durationMs ?? (toast?.tone === 'danger' ? 9000 : 6500);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, durationMs);
    return () => clearTimeout(timer);
  }, [toast, durationMs, onClose]);

  if (!toast) return null;

  return (
    <div key={toast.id} className="pt-toast-wrap" role="status" aria-live="polite">
      <div className={`pt-toast pt-toast--${toast.tone}`}>
        <span className="pt-toast__accent" aria-hidden />
        <div className="pt-toast__head">
          <span className="pt-toast__icon" aria-hidden>
            <ToastIcon tone={toast.tone} />
          </span>
          <div className="pt-toast__copy">
            <p className="pt-toast__title">{toast.title}</p>
            {toast.message ? <p className="pt-toast__message">{toast.message}</p> : null}
          </div>
          <button type="button" className="pt-toast__close" aria-label="Close notification" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {toast.details && toast.details.length > 0 ? (
          <ul className="pt-toast__details">
            {toast.details.slice(0, 4).map((detail, index) => (
              <li key={`${toast.id}-${index}`}>{detail}</li>
            ))}
          </ul>
        ) : null}
        <span className="pt-toast__bar" style={{ animationDuration: `${durationMs}ms` }} aria-hidden />
      </div>
    </div>
  );
}
