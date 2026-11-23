import React from 'react';

interface ToastNotificationProps {
  toast: {
    id: number;
    title: string;
    description: string;
    type: 'critical' | 'success' | 'info';
  } | null;
  onDismiss: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  toast,
  onDismiss,
}) => {
  if (!toast) return null;

  const isCritical = toast.type === 'critical';
  const isSuccess = toast.type === 'success';

  return (
    <div
      onClick={onDismiss}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl transition-all duration-300 max-w-md cursor-pointer border ${
        isCritical
          ? 'bg-[#ba1a1a] text-white border-white/20'
          : isSuccess
          ? 'bg-[#10B981] text-white border-white/20'
          : 'bg-[#131b2e] text-white border-white/10'
      }`}
    >
      <span className="material-symbols-outlined text-[22px] shrink-0">
        {isCritical ? 'crisis_alert' : isSuccess ? 'check_circle' : 'info'}
      </span>
      <div className="flex flex-col min-w-0">
        <span className="text-[13px] font-bold leading-tight">{toast.title}</span>
        <span className="text-[11px] opacity-90 mt-0.5 leading-snug">{toast.description}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="ml-2 text-white/70 hover:text-white"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
};

