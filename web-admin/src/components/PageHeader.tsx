import React from 'react';

interface PageHeaderProps {
  kicker?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ kicker, title, description, actions }) => (
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
    <div className="min-w-0">
      {kicker && <div className="text-xs font-medium uppercase tracking-wider text-gold-700">{kicker}</div>}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
