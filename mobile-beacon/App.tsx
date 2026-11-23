import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from './src/state/session';
import { AppHeader, DeltaMark, IconName, TabBar } from './src/components/ui';
import { SignInScreen } from './src/screens/SignInScreen';
import { RespondScreen } from './src/screens/RespondScreen';
import { InstallScreen } from './src/screens/InstallScreen';
import { CheckScreen } from './src/screens/CheckScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { C } from './src/theme';
import { t } from './src/i18n';

type TabKey = 'respond' | 'install' | 'check' | 'more';

/** Tabs depend on the person's role: responders see Respond first, technicians see Install. */
const Main: React.FC = () => {
  const { can, user } = useSession();
  const [theftCount, setTheftCount] = useState(0);

  const tabs = useMemo(() => {
    const list: { key: TabKey; label: string; icon: IconName; badge?: number }[] = [];
    if (can('incident:field')) list.push({ key: 'respond', label: t.tabRespond, icon: 'shield-alert-outline' });
    if (can('asset:provision')) list.push({ key: 'install', label: t.tabInstall, icon: 'plus-circle-outline' });
    list.push({ key: 'check', label: t.tabCheck, icon: 'magnify' });
    list.push({ key: 'more', label: t.tabMore, icon: 'dots-horizontal-circle-outline' });
    return list;
  }, [can]);

  // Technicians mostly install; everyone else mostly responds.
  const [tab, setTab] = useState<TabKey>(
    user?.role === 'technician' && tabs.some((x) => x.key === 'install') ? 'install' : tabs[0].key
  );
  const withBadge = tabs.map((x) => (x.key === 'respond' ? { ...x, badge: theftCount } : x));

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <AppHeader title={t.appName} />
      <View style={{ flex: 1 }}>
        {tab === 'respond' && <RespondScreen onCount={setTheftCount} />}
        {tab === 'install' && <InstallScreen />}
        {tab === 'check' && <CheckScreen />}
        {tab === 'more' && <MoreScreen />}
      </View>
      <TabBar tabs={withBadge} active={tab} onChange={(k) => setTab(k as TabKey)} />
    </SafeAreaView>
  );
};

const Gate: React.FC = () => {
  const { status } = useSession();
  if (status === 'loading') {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: C.navyDeep }]}>
        <DeltaMark size={56} />
        <ActivityIndicator color={C.gold} style={{ marginTop: 16 }} />
      </View>
    );
  }
  return status === 'signed-in' ? (
    <Main />
  ) : (
    <SafeAreaView style={[styles.root, { backgroundColor: C.navyDeep }]} edges={['top']}>
      <StatusBar style="light" />
      <SignInScreen />
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.canvas },
  center: { alignItems: 'center', justifyContent: 'center' },
});
