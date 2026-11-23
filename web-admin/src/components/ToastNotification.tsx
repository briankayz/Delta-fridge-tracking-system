import React from 'react';
import { CircleCheck, Info, ShieldAlert, X } from 'lucide-react';
import { cx } from './ui';

interface ToastNotificationProps {
  toast: {
    id: number;
    title: string;
    description: string;
    type: 'critical' | 'success' | 'info';
  } | null;
  onDismiss: () => void;
}

const TONE = {
  critical: { icon: ShieldAlert, bar: 'bg-red-600', iconTone: 'text-red-600' },
  success: { icon: CircleCheck, bar: 'bg-emerald-600', iconTone: 'text-emerald-600' },
  info: { icon: Info, bar: 'bg-delta-600', iconTone: 'text-delta-600' },
};

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onDismiss }) => {
  if (!toast) return null;
  const t = TONE[toast.type];
  const Icon = t.icon;

  return (
    <div
      role={toast.type === 'critical' ? 'alert' : 'status'}
      className="fixed bottom-5 right-5 z-[60] w-[380px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-lg bg-white shadow-pop ring-1 ring-line"
    >
      <div className={cx('h-1', t.bar)} />
      <div className="flex items-start gap-3 p-4">
        <Icon className={cx('h-5 w-5 shrink-0 mt-0.5', t.iconTone)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">{toast.title}</div>
          <div className="mt-0.5 text-xs text-slate-600 leading-relaxed">{toast.description}</div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
