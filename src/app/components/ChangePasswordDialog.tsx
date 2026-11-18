'use client';

import { useEffect, useState } from 'react';

export default function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return alert('New passwords do not match');
    if (newPassword.length < 6) return alert('New password must be at least 6 characters');

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data?.error || 'Failed to change password');
      alert('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error changing password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="sb-modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <form className="sb-modal" onSubmit={handleSubmit} style={{ width: 'min(440px, 100%)' }}>
        <header className="sb-modal__header">
          <p className="sb-kicker">Account</p>
          <h2 id="change-password-title">Change password</h2>
          <p>Update the password you use to sign in to ServerBot.</p>
        </header>

        <div style={{ padding: '0.4rem 1.4rem 0.2rem', display: 'grid', gap: '0.85rem' }}>
          <label className="sb-field">
            <span>Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              disabled={loading}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              required
            />
          </label>
          <label className="sb-field">
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              disabled={loading}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
            />
          </label>
          <label className="sb-field">
            <span>Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              disabled={loading}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              required
            />
          </label>
        </div>

        <footer className="sb-modal__footer">
          <button type="button" className="sb-btn sb-btn--ghost" disabled={loading} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="sb-btn sb-btn--primary" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </footer>
      </form>
    </div>
  );
}
