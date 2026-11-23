// Delta brand, light high-contrast theme for outdoor use (sunlight, low-end screens).
export const C = {
  navy: '#123965',
  navyDeep: '#082563',
  navySoft: '#EEF3F9',
  gold: '#C8B967',
  goldText: '#7A6C2C',
  goldSoft: '#FAF7EC',
  ink: '#0F172A',
  ink2: '#334155',
  muted: '#64748B',
  line: '#E2E8F0',
  canvas: '#F8FAFC',
  white: '#FFFFFF',
  safe: '#047857',
  safeSoft: '#ECFDF5',
  warn: '#B45309',
  warnSoft: '#FFFBEB',
  danger: '#B91C1C',
  dangerSolid: '#DC2626',
  dangerSoft: '#FEF2F2',
  offline: '#475569',
  offlineSoft: '#F1F5F9',
};

export const R = { sm: 6, md: 8, lg: 12, xl: 16 };
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/** Minimum touch target (Android guideline 48dp). */
export const TOUCH = 52;

export const T = {
  hero: { fontSize: 28, fontWeight: '700' as const, color: C.ink },
  title: { fontSize: 20, fontWeight: '700' as const, color: C.ink },
  subtitle: { fontSize: 16, fontWeight: '600' as const, color: C.ink },
  body: { fontSize: 16, color: C.ink2, lineHeight: 22 },
  small: { fontSize: 14, color: C.muted, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '600' as const, color: C.muted, letterSpacing: 0.3 },
};
