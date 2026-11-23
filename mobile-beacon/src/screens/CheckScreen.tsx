import React, { useState } from 'react';
import { Text } from 'react-native';
import { api, ApiError } from '../api/client';
import type { Asset } from '../api/types';
import { Banner, BigButton, Card, Field, Row, Screen, StatusCard } from '../components/ui';
import { beaconIdFrom, QrScanner } from '../components/QrScanner';
import { ago } from '../services/location';
import { assetStatus } from '../status';
import { T } from '../theme';
import { t } from '../i18n';

/** "Is this cooler OK?" in one glance, for anyone in the field. */
export const CheckScreen: React.FC = () => {
  const [id, setId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async (value = id) => {
    const clean = beaconIdFrom(value);
    if (!clean) return;
    setBusy(true);
    setError(null);
    try {
      setAsset((await api.asset(clean)).asset);
    } catch (err) {
      setAsset(null);
      setError(err instanceof ApiError ? (err.status === 404 ? `No cooler with ID ${clean} in your area.` : err.message) : t.cantReachServer);
    } finally {
      setBusy(false);
    }
  };

  const s = asset ? assetStatus(asset) : null;

  return (
    <Screen>
      <Text style={T.title}>{t.checkTitle}</Text>
      {scanning ? (
        <QrScanner
          onScanned={(code) => {
            setScanning(false);
            setId(code);
            void check(code);
          }}
          onCancel={() => setScanning(false)}
        />
      ) : (
        <Card>
          <Text style={T.small}>{t.checkHint}</Text>
          <BigButton label={t.scan} icon="qrcode-scan" onPress={() => setScanning(true)} />
          <Field label={t.typeId} value={id} onChangeText={(v) => setId(v.toUpperCase())} autoCapitalize="characters" onSubmitEditing={() => void check()} />
          <BigButton label={t.check} variant="secondary" icon="magnify" busy={busy} disabled={!beaconIdFrom(id)} onPress={() => void check()} />
        </Card>
      )}

      {error && <Banner tone="danger" text={error} />}
      {asset && s && (
        <>
          <StatusCard tone={s.tone} title={s.title} detail={s.detail} />
          <Card>
            <Row icon="fridge-outline" title={asset.id} detail={asset.model} />
            <Row icon="storefront-outline" title={asset.retailer_name} detail={asset.region} />
            <Row icon="clock-outline" title={`${t.lastReport} ${ago(asset.last_seen)}`} detail={asset.location_name} />
            {asset.battery_pct != null && <Row icon="battery-70" title={`Backup battery ${Math.round(asset.battery_pct)}%`} />}
          </Card>
        </>
      )}
    </Screen>
  );
};
