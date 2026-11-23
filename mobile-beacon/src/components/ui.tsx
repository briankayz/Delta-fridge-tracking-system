import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { C, R, S, T, TOUCH } from '../theme';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export const DeltaMark: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    <Path d="M16 4 28.5 27H3.5Z" fill="none" stroke={C.gold} strokeWidth={2.6} strokeLinejoin="round" />
    <Path d="M16 14.5 21 23.5H11Z" fill={C.gold} />
  </Svg>
);

/** Navy top bar with the Delta mark. */
export const AppHeader: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <View style={styles.header}>
    <DeltaMark size={26} />
    <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
      {title}
    </Text>
    <View style={{ marginLeft: 'auto' }}>{right}</View>
  </View>
);

export const Screen: React.FC<{ children: React.ReactNode; scroll?: boolean; refreshControl?: React.ReactElement }> = ({
  children,
  scroll = true,
  refreshControl,
}) =>
  scroll ? (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screen, styles.screenContent]}>{children}</View>
  );

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({ children, style }) => <View style={[styles.card, style]}>{children}</View>;

type Variant = 'primary' | 'secondary' | 'danger' | 'safe' | 'ghost';
const VARIANT: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: C.navy, fg: C.white },
  secondary: { bg: C.white, fg: C.navy, border: C.line },
  danger: { bg: C.dangerSolid, fg: C.white },
  safe: { bg: C.safe, fg: C.white },
  ghost: { bg: 'transparent', fg: C.navy },
};

/** Large, labelled button: the main interaction pattern for field staff. */
export const BigButton: React.FC<{
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  hint?: string;
}> = ({ label, onPress, icon, variant = 'primary', disabled, busy, hint }) => {
  const v = VARIANT[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.big,
        { backgroundColor: v.bg, borderColor: v.border ?? v.bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}
    >
      {busy ? <ActivityIndicator color={v.fg} /> : icon ? <MaterialCommunityIcons name={icon} size={24} color={v.fg} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.bigLabel, { color: v.fg }]}>{label}</Text>
        {hint && <Text style={[styles.bigHint, { color: v.fg, opacity: 0.85 }]}>{hint}</Text>}
      </View>
    </Pressable>
  );
};

export type Tone = 'safe' | 'warn' | 'danger' | 'offline' | 'info';
const TONE: Record<Tone, { fg: string; bg: string; icon: IconName }> = {
  safe: { fg: C.safe, bg: C.safeSoft, icon: 'shield-check' },
  warn: { fg: C.warn, bg: C.warnSoft, icon: 'power-plug-off' },
  danger: { fg: C.danger, bg: C.dangerSoft, icon: 'shield-alert' },
  offline: { fg: C.offline, bg: C.offlineSoft, icon: 'access-point-off' },
  info: { fg: C.navy, bg: C.navySoft, icon: 'information-outline' },
};

/** One big, plain-language status: icon + word + one sentence. Never colour alone. */
export const StatusCard: React.FC<{ tone: Tone; title: string; detail?: string; icon?: IconName }> = ({ tone, title, detail, icon }) => {
  const t = TONE[tone];
  return (
    <View style={[styles.status, { backgroundColor: t.bg, borderColor: t.fg }]} accessibilityRole="summary" accessibilityLabel={`${title}. ${detail ?? ''}`}>
      <MaterialCommunityIcons name={icon ?? t.icon} size={40} color={t.fg} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.statusTitle, { color: t.fg }]}>{title}</Text>
        {detail && <Text style={styles.statusDetail}>{detail}</Text>}
      </View>
    </View>
  );
};

export const Field: React.FC<TextInputProps & { label: string }> = ({ label, style, ...rest }) => (
  <View style={{ gap: S.xs }}>
    <Text style={T.label}>{label}</Text>
    <TextInput placeholderTextColor={C.muted} style={[styles.input, style]} {...rest} />
  </View>
);

export const Row: React.FC<{ icon?: IconName; title: string; detail?: string; right?: React.ReactNode; onPress?: () => void; tone?: string }> = ({
  icon,
  title,
  detail,
  right,
  onPress,
  tone = C.navy,
}) => (
  <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.canvas }]}>
    {icon && <MaterialCommunityIcons name={icon} size={24} color={tone} />}
    <View style={{ flex: 1 }}>
      <Text style={T.subtitle}>{title}</Text>
      {detail && <Text style={T.small}>{detail}</Text>}
    </View>
    {right}
    {onPress && !right && <MaterialCommunityIcons name="chevron-right" size={24} color={C.muted} />}
  </Pressable>
);

export const Banner: React.FC<{ tone: Tone; text: string }> = ({ tone, text }) => (
  <View style={[styles.banner, { backgroundColor: TONE[tone].bg }]} accessibilityRole="alert">
    <MaterialCommunityIcons name={TONE[tone].icon} size={20} color={TONE[tone].fg} />
    <Text style={[T.small, { color: TONE[tone].fg, flex: 1 }]}>{text}</Text>
  </View>
);

export const SectionTitle: React.FC<{ children: string }> = ({ children }) => <Text style={[T.label, { marginTop: S.sm }]}>{children.toUpperCase()}</Text>;

export const TabBar: React.FC<{ tabs: { key: string; label: string; icon: IconName; badge?: number }[]; active: string; onChange: (k: string) => void }> = ({
  tabs,
  active,
  onChange,
}) => (
  <View style={styles.tabs} accessibilityRole="tablist">
    {tabs.map((tab) => {
      const on = tab.key === active;
      return (
        <Pressable
          key={tab.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: on }}
          accessibilityLabel={tab.badge ? `${tab.label}, ${tab.badge} new` : tab.label}
          onPress={() => onChange(tab.key)}
          style={styles.tab}
        >
          <View>
            <MaterialCommunityIcons name={tab.icon} size={26} color={on ? C.navy : C.muted} />
            {!!tab.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tab.badge}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.tabLabel, { color: on ? C.navy : C.muted, fontWeight: on ? '700' : '500' }]}>{tab.label}</Text>
          {on && <View style={styles.tabIndicator} />}
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.navyDeep, paddingHorizontal: S.lg, paddingVertical: S.md, minHeight: 56 },
  headerTitle: { color: C.white, fontSize: 18, fontWeight: '700', flexShrink: 1 },
  screen: { flex: 1, backgroundColor: C.canvas },
  screenContent: { padding: S.lg, gap: S.lg, paddingBottom: S.xxl },
  card: { backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: S.lg, gap: S.md },
  big: { minHeight: TOUCH + 8, borderRadius: R.lg, borderWidth: 1, paddingHorizontal: S.lg, paddingVertical: S.md, flexDirection: 'row', alignItems: 'center', gap: S.md },
  bigLabel: { fontSize: 17, fontWeight: '700' },
  bigHint: { fontSize: 13, marginTop: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: S.lg, padding: S.lg, borderRadius: R.xl, borderWidth: 2 },
  statusTitle: { fontSize: 26, fontWeight: '800' },
  statusDetail: { ...T.body, marginTop: 2 },
  input: { minHeight: TOUCH, borderRadius: R.md, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: C.white, paddingHorizontal: S.md, fontSize: 17, color: C.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, minHeight: TOUCH + 8, paddingVertical: S.sm },
  banner: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.md },
  tabs: { flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: S.sm, minHeight: 64, gap: 2 },
  tabLabel: { fontSize: 13 },
  tabIndicator: { position: 'absolute', top: 0, height: 3, width: 36, borderRadius: 2, backgroundColor: C.gold },
  badge: { position: 'absolute', top: -4, right: -10, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.dangerSolid, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: C.white, fontSize: 12, fontWeight: '700' },
});
