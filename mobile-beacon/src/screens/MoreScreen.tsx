import React, { useState } from 'react';
import { Text } from 'react-native';
import { useSession } from '../state/session';
import { Banner, BigButton, Card, Row, Screen, SectionTitle } from '../components/ui';
import { BeaconScreen } from './BeaconScreen';
import { T } from '../theme';
import { t } from '../i18n';

const ROLE: Record<string, string> = {
  admin: 'Administrator',
  ops_lead: 'Operations lead',
  area_manager: 'Area manager',
  asset_protection: 'Asset Protection',
  technician: 'Field technician',
  viewer: 'Viewer',
};

export const MoreScreen: React.FC = () => {
  const { user, meta, server, pending, signOut, can } = useSession();
  const [beacon, setBeacon] = useState(false);

  if (beacon) return <BeaconScreen onBack={() => setBeacon(false)} />;

  return (
    <Screen>
      <Text style={T.title}>{t.account}</Text>
      <Card>
        <Row icon="account-circle-outline" title={user?.name ?? ''} detail={`${ROLE[user?.role ?? ''] ?? ''}${user?.region ? ` · ${user.region}` : ''}`} />
        <Row icon="email-outline" title={user?.email ?? ''} />
        <Row icon="server-network" title={server.replace(/^https?:\/\//, '')} detail={meta ? `Server version ${meta.version}` : 'Server not reachable'} />
      </Card>
      {pending > 0 && <Banner tone="warn" text={`${pending} report${pending === 1 ? '' : 's'} ${t.pendingSync}. They send automatically when you have signal.`} />}

      {meta?.demo_mode && can('asset:provision') && (
        <>
          <SectionTitle>{t.demoMode}</SectionTitle>
          <Card>
            <Text style={T.small}>{t.demoHint}</Text>
            <BigButton label={t.beaconMode} icon="access-point" variant="secondary" onPress={() => setBeacon(true)} />
          </Card>
        </>
      )}

      <BigButton label={t.signOut} icon="logout" variant="secondary" onPress={() => void signOut()} />
      <Text style={[T.small, { textAlign: 'center' }]}>Delta Asset Guard · authorised Delta Beverages staff only</Text>
    </Screen>
  );
};
