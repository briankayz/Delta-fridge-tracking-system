import React, { useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { api } from '../services/api';
import { Button } from './ui';

const input =
  'mt-1 w-full h-10 px-3 rounded-md ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-delta-500 text-sm';

export const ChangePasswordDialog: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return setError('The new passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      await api.changePassword(current, next);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="pw-title">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/40" />
      <form onSubmit={submit} className="relative w-full max-w-sm rounded-lg bg-white shadow-pop ring-1 ring-line p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="pw-title" className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <KeyRound className="h-4 w-4 text-delta-700" aria-hidden="true" />
            Change password
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Current password</span>
          <input type="password" autoComplete="current-password" required className={input} value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">New password</span>
          <input type="password" autoComplete="new-password" required minLength={10} className={input} value={next} onChange={(e) => setNext(e.target.value)} />
          <span className="text-xs text-slate-500">10+ characters with letters and numbers</span>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Confirm new password</span>
          <input type="password" autoComplete="new-password" required className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">{error}</div>}
        <p className="text-xs text-slate-500">You stay signed in here; other devices are signed out.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </Button>
        </div>
      </form>
    </div>
  );
};
