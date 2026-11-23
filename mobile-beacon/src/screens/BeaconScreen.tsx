import React, { useEffect, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { api, ApiError, session } from '../api/client';
import type { Asset } from '../api/types';
import { Banner, BigButton, Card, Row, Screen, SectionTitle, StatusCard } from '../components/ui';
import { BeaconRunner, BeaconStatus } from '../services/telemetryStream';
import { C, S, T } from '../theme';
import { t } from '../i18n';

/** Demo: this phone pretends to be the beacon inside a cooler it installed earlier. */
export const BeaconScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [ids, setIds] = useState<string[] | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [status, setStatus] = useState<BeaconStatus | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runner = useRef<BeaconRunner | null>(null);

  useEffect(() => {
    session.deviceIds().then(setIds);
    return () => runner.current?.dispose();
  }, []);

  const begin = async (deviceId: string) => {
    setError(null);
    try {
      const token = await session.deviceToken(deviceId);
      if (!token) throw new Error('This phone does not hold the credential for that beacon. Install it again from the Install tab.');
      const a = (await api.asset(deviceId)).asset;
      setAsset(a);
      runner.current?.dispose();
      const r = new BeaconRunner({
        deviceId,
        token,
        anchor: a.anchor,
        radius: a.geofence_radius_m,
        retailerName: a.retailer_name,
        useRealGps: false,
      });
      r.subscribe(setStatus);
      r.start(5);
      runner.current = r;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    }
  };

  const a = status?.assessment;
  const plain =
    !status || status.payloads === 0
      ? { tone: 'offline' as const, title: 'Starting…', detail: 'Connecting to the control room.' }
      : !status.connected
      ? { tone: 'offline' as const, title: 'Not connected', detail: status.lastError ?? t.cantReachServer }
      : a?.severity === 'critical'
      ? { tone: 'danger' as const, title: 'Theft alert sent', detail: `Moved ${(a.displacement_distance_m / 1000).toFixed(1)} km. Risk ${a.risk_score_pct}%. ${a.incident_id ?? ''}` }
      : a?.severity === 'warning'
      ? { tone: 'warn' as const, title: 'Warning', detail: a.reasons.map((r) => r.label).join(', ') }
      : { tone: 'safe' as const, title: 'Protected', detail: `Sending every ${status.cadence} s to ${session.server.replace(/^https?:\/\//, '')}` };

  return (
    <Screen>
      <Row icon="arrow-left" title="Back" onPress={onBack} right={<View />} />
      <Text style={T.title}>{t.beaconMode}</Text>
      <Banner tone="info" text={t.demoHint} />
      {error && <Banner tone="danger" text={error} />}

      {!runner.current && (
        <Card>
          <Text style={T.subtitle}>Which cooler is this phone?</Text>
          {ids?.length === 0 && <Text style={T.small}>Install a beacon first (Install tab). This phone can then act as that beacon.</Text>}
          {ids?.map((id) => <Row key={id} icon="access-point" title={id} detail="Installed from this phone" onPress={() => void begin(id)} />)}
        </Card>
      )}

      {runner.current && asset && (
        <>
          <StatusCard tone={plain.tone} title={plain.title} detail={plain.detail} />
          <Text style={T.small}>
            {asset.id} · {asset.retailer_name}
          </Text>
          {!status?.displaced ? (
            <BigButton
              label="Simulate theft"
              hint="Unplugs the cooler and drives it away"
              icon="truck-fast"
              variant="danger"
              onPress={() => runner.current?.simulateTheft()}
            />
          ) : (
            <BigButton
              label="Stop the simulation"
              hint="Close the alert from Respond or the dashboard"
              icon="stop-circle-outline"
              variant="secondary"
              onPress={() => runner.current?.endSimulation()}
            />
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={T.subtitle}>{t.advanced}</Text>
            <Switch value={advanced} onValueChange={setAdvanced} trackColor={{ true: C.navy, false: C.line }} accessibilityLabel={t.advanced} />
          </View>
          {advanced && status?.last && (
            <Card>
              <SectionTitle>Sensors</SectionTitle>
              <Text style={T.body}>
                GPS {status.last.gps.latitude.toFixed(5)}, {status.last.gps.longitude.toFixed(5)} · {status.last.speed_kmh.toFixed(1)} km/h
              </Text>
              <Text style={T.body}>
                Motion {status.last.accelerometer.vibration_status} · tilt {status.last.accelerometer.tilt_deg.toFixed(1)}°
              </Text>
              <Text style={T.body}>
                Mains {status.last.power.mains_connected ? `${status.last.power.voltage_ac} V` : 'OFF'} · battery {status.last.power.battery_level_pct}%
              </Text>
              <Text style={T.body}>Cabinet {status.last.cold_chain.internal_temp_c.toFixed(1)} °C</Text>
              <Text style={[T.small, { marginTop: S.sm }]}>
                Mains voltage and cabinet temperature are simulated: a phone cannot measure them. Production beacons have these sensors.
              </Text>
              {a && (
                <>
                  <SectionTitle>Risk from the server</SectionTitle>
                  {a.reasons.length === 0 && <Text style={T.body}>No risk signals.</Text>}
                  {a.reasons.map((r) => (
                    <Text key={r.code} style={T.body}>
                      {r.points > 0 ? '+' : ''}
                      {r.points} {r.label}
                    </Text>
                  ))}
                  <Text style={T.small}>
                    {status.payloads} readings sent · {status.cadence}s interval
                  </Text>
                </>
              )}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
};
