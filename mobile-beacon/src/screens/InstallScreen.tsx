import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { api, ApiError, session } from '../api/client';
import type { Retailer } from '../api/types';
import { Banner, BigButton, Card, Field, Row, Screen, StatusCard } from '../components/ui';
import { beaconIdFrom, QrScanner } from '../components/QrScanner';
import { currentFix, distanceLabel, distanceM, Fix } from '../services/location';
import { C, S, T } from '../theme';
import { t } from '../i18n';

type Step = 'id' | 'scan' | 'store' | 'fence' | 'done';

const FENCES = [
  { m: 50, label: t.fenceSmall, hint: t.fenceSmallHint, icon: 'circle-small' as const },
  { m: 100, label: t.fenceMedium, hint: t.fenceMediumHint, icon: 'circle-medium' as const },
  { m: 250, label: t.fenceLarge, hint: t.fenceLargeHint, icon: 'circle-outline' as const },
];

/** If the phone is this close to the store, its GPS is a better "home" than the registered address. */
const USE_PHONE_GPS_WITHIN_M = 300;

/** Three-step beacon installation for technicians: which beacon -> which store -> how big a fence. */
export const InstallScreen: React.FC = () => {
  const [step, setStep] = useState<Step>('id');
  const [id, setId] = useState('');
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [query, setQuery] = useState('');
  const [store, setStore] = useState<Retailer | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedPhoneGps, setUsedPhoneGps] = useState(false);

  useEffect(() => {
    if (step === 'store' && retailers.length === 0) {
      api.retailers().then(setRetailers).catch((e) => setError(e instanceof ApiError ? e.message : t.cantReachServer));
      currentFix().then(setFix);
    }
  }, [step, retailers.length]);

  const nearby = useMemo(
    () =>
      retailers
        .filter((r) => !query || `${r.name} ${r.region} ${r.address ?? ''}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => distanceM(fix, a.lat, a.lng) - distanceM(fix, b.lat, b.lng) || a.name.localeCompare(b.name))
        .slice(0, 25),
    [retailers, query, fix]
  );

  const reset = () => {
    setStep('id');
    setId('');
    setStore(null);
    setError(null);
    setQuery('');
  };

  const protect = async (radius: number) => {
    if (!store) return;
    setBusy(true);
    setError(null);
    try {
      const here = fix ?? (await currentFix());
      const near = here && store.lat != null && distanceM(here, store.lat, store.lng) <= USE_PHONE_GPS_WITHIN_M;
      const anchor = near || store.lat == null ? here : { lat: store.lat, lng: store.lng! };
      if (!anchor) throw new Error('Turn on location: the store has no registered position.');
      const r = await api.provision(id, { retailer_id: store.id, anchor_lat: anchor.lat, anchor_lng: anchor.lng, geofence_radius_m: radius });
      await session.saveDeviceToken(id, r.device_token);
      setUsedPhoneGps(!!near || store.lat == null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message || t.cantReachServer);
    } finally {
      setBusy(false);
    }
  };

  const stepNo = { id: 1, scan: 1, store: 2, fence: 3, done: 3 }[step];

  return (
    <Screen>
      <Text style={T.title}>{t.installTitle}</Text>
      {step !== 'done' && (
        <View style={{ flexDirection: 'row', gap: S.sm }} accessibilityLabel={`Step ${stepNo} of 3`}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: n <= stepNo ? C.navy : C.line }} />
          ))}
        </View>
      )}
      {error && <Banner tone="danger" text={error} />}

      {step === 'id' && (
        <Card>
          <Text style={T.subtitle}>1. {t.step1}</Text>
          <Text style={T.small}>{t.step1Hint}</Text>
          <BigButton label={t.scan} icon="qrcode-scan" onPress={() => setStep('scan')} />
          <Field label={t.typeId} value={id} onChangeText={(v) => setId(v.toUpperCase())} autoCapitalize="characters" placeholder="e.g. DLTA-BCN-9042" />
          <BigButton label={t.next} variant="secondary" icon="arrow-right" disabled={!beaconIdFrom(id)} onPress={() => setStep('store')} />
        </Card>
      )}

      {step === 'scan' && (
        <QrScanner
          onScanned={(code) => {
            setId(code);
            setStep('store');
          }}
          onCancel={() => setStep('id')}
        />
      )}

      {step === 'store' && (
        <Card>
          <Text style={T.subtitle}>2. {t.step2}</Text>
          <Text style={T.small}>
            Beacon {id} · {fix ? t.nearestFirst : 'Turn on location to sort by distance'}
          </Text>
          <Field label={t.searchStores} value={query} onChangeText={setQuery} placeholder="Store name or area" />
          {nearby.map((r) => (
            <Row
              key={r.id}
              icon="storefront-outline"
              title={r.name}
              detail={[distanceLabel(fix, r.lat, r.lng), r.region, `${r.coolers} cooler${r.coolers === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
              onPress={() => {
                setStore(r);
                setStep('fence');
              }}
            />
          ))}
          <BigButton label="Back" variant="ghost" icon="arrow-left" onPress={() => setStep('id')} />
        </Card>
      )}

      {step === 'fence' && store && (
        <Card>
          <Text style={T.subtitle}>3. {t.step3}</Text>
          <Text style={T.small}>
            {id} at {store.name}
          </Text>
          {FENCES.map((f) => (
            <BigButton key={f.m} label={f.label} hint={f.hint} icon={f.icon} variant="secondary" busy={busy} onPress={() => void protect(f.m)} />
          ))}
          <BigButton label="Back" variant="ghost" icon="arrow-left" onPress={() => setStep('store')} />
        </Card>
      )}

      {step === 'done' && store && (
        <>
          <StatusCard tone="safe" title={t.protected} detail={`${id} · ${store.name}`} />
          <Text style={T.body}>{t.protectedHint}</Text>
          <Text style={T.small}>{usedPhoneGps ? t.usingPhoneLocation : t.usingStoreLocation}</Text>
          <BigButton label={t.installAnother} icon="plus" onPress={reset} />
        </>
      )}
    </Screen>
  );
};
