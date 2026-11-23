import React from 'react';
import { CircleCheck, LucideIcon, ShieldAlert, TriangleAlert } from 'lucide-react';
import { Severity } from '../types';

/** Delta-style nested-triangle mark (gold), drawn as SVG so it stays crisp at any size. */
export const DeltaMark: React.FC<{ size?: number; className?: string }> = ({ size = 28, className }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
    <path d="M16 4 28.5 27H3.5Z" fill="none" stroke="#C8B967" strokeWidth="2.6" strokeLinejoin="round" />
    <path d="M16 14.5 21 23.5H11Z" fill="#C8B967" />
  </svg>
);

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---- Status ---------------------------------------------------------------------------

export const STATUS_STYLE: Record<
  Severity,
  { label: string; icon: LucideIcon; badge: string; text: string; dot: string; hex: string; soft: string }
> = {
  critical: {
    label: 'Critical',
    icon: ShieldAlert,
    badge: 'bg-red-50 text-red-700 ring-red-600/20',
    text: 'text-red-700',
    dot: 'bg-red-500',
    hex: '#DC2626',
    soft: 'bg-red-50',
  },
  warning: {
    label: 'Warning',
    icon: TriangleAlert,
    badge: 'bg-amber-50 text-amber-800 ring-amber-600/25',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    hex: '#D97706',
    soft: 'bg-amber-50',
  },
  nominal: {
    label: 'Secure',
    icon: CircleCheck,
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    hex: '#059669',
    soft: 'bg-emerald-50',
  },
};

/** Status is always icon + text, never colour alone. */
export const StatusBadge: React.FC<{ severity: Severity; label?: string; size?: 'sm' | 'md' }> = ({
  severity,
  label,
  size = 'sm',
}) => {
  const s = STATUS_STYLE[severity];
  const Icon = s.icon;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md font-medium ring-1 ring-inset whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs',
        s.badge
      )}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.25} aria-hidden="true" />
      {label ?? s.label}
    </span>
  );
};

// ---- Layout primitives ----------------------------------------------------------------

export const Card: React.FC<React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' }> = ({
  as: Tag = 'section',
  className,
  children,
  ...rest
}) => (
  <Tag className={cx('bg-white rounded-lg border border-line shadow-card', className)} {...rest}>
    {children}
  </Tag>
);

export const CardHeader: React.FC<{
  title: string;
  icon?: LucideIcon;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, icon: Icon, subtitle, actions, className }) => (
  <header className={cx('flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-line', className)}>
    <div className="flex items-center gap-2.5 min-w-0">
      {Icon && <Icon className="h-4 w-4 text-delta-700 shrink-0" aria-hidden="true" />}
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900 truncate">{title}</h2>
        {subtitle && <div className="text-xs text-slate-500 truncate">{subtitle}</div>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

// ---- Buttons --------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
const BUTTON: Record<ButtonVariant, string> = {
  primary: 'bg-delta-700 text-white hover:bg-delta-800 shadow-sm',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 shadow-sm',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: LucideIcon; size?: 'sm' | 'md' }
> = ({ variant = 'secondary', icon: Icon, size = 'md', className, children, ...rest }) => (
  <button
    type="button"
    className={cx(
      'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
      size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
      BUTTON[variant],
      className
    )}
    {...rest}
  >
    {Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />}
    {children}
  </button>
);

/** Segmented control used for filters (one row, above the content it filters). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'px-2.5 h-7 rounded text-xs font-medium transition-colors',
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          )}
        >
          {o.label}
          {o.count != null && <span className="ml-1 tabular text-slate-400">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
