import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { api, ApiError, session } from '../api/client';
import type { Asset } from '../api/types';
import { Banner, BigButton, Card, Row, Screen, SectionTitle, StatusCard } from '../components/ui';
import { DEFAULT_HEARTBEAT_S, FirmwareLoop, FirmwareSnapshot } from '../hardware/firmwareLoop';
import { SerialLine, SerialPort } from '../hardware/serial';
import { C, R, S, T } from '../theme';
import { t } from '../i18n';

const HEARTBEATS = [
  { s: 5, label: '5 s', hint: 'demo' },
  { s: 30, label: '30 s', hint: '' },
  { s: 300, label: '5 min', hint: 'hardware' },
];

/** Keeps the screen on while the twin is transmitting (a locked phone stops sending). */
const KeepAwake: React.FC = () => {
  useKeepAwake('dag-beacon');
  return null;
};

/** Demo: this phone runs the beacon firmware twin for a cooler it installed earlier. */
export const BeaconScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [ids, setIds] = useState<string[] | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [snap, setSnap] = useState<FirmwareSnapshot | null>(null);
  const [lines, setLines] = useState<SerialLine[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [chargerAsMains, setChargerAsMains] = useState(false);
  const [heartbeat, setHeartbeat] = useState(DEFAULT_HEARTBEAT_S);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fw = useRef<FirmwareLoop | null>(null);

  useEffect(() => {
    session.deviceIds().then(setIds);
    return () => fw.current?.stop();
  }, []);

  const begin = async (deviceId: string) => {
    setError(null);
    try {
      const token = await session.deviceToken(deviceId);
      if (!token) throw new Error('This phone does not hold the credential for that beacon. Install it again from the Install tab.');
      const a = (await api.asset(deviceId)).asset;
      setAsset(a);
      fw.current?.stop();
      const loop = new FirmwareLoop({
        deviceId,
        deviceToken: token,
        server: session.server,
        anchor: a.anchor,
        heartbeatS: heartbeat,
        chargerAsMains,
      });
      loop.subscribe(setSnap);
      loop.serial.subscribe((l) => setLines([...l]));
      fw.current = loop;
      await loop.setup();
      loop.start();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    }
  };

  const a = snap?.assessment;
  const plain =
    !snap || snap.seq === 0
      ? { tone: 'offline' as const, title: 'Starting…', detail: 'Booting the beacon and connecting to the control room.' }
      : snap.connected === false
      ? { tone: 'offline' as const, title: 'Not connected', detail: `${snap.buffered} reading${snap.buffered === 1 ? '' : 's'} saved; they will send when the connection returns.` }
      : a?.severity === 'critical'
      ? { tone: 'danger' as const, title: 'Theft alert sent', detail: `Moved ${(a.displacement_distance_m / 1000).toFixed(1)} km. Risk ${a.risk_score_pct}%. ${a.incident_id ?? ''}` }
      : a?.severity === 'warning'
      ? { tone: 'warn' as const, title: 'Warning', detail: a.reasons.map((r) => r.label).join(', ') }
      : { tone: 'safe' as const, title: 'Protected', detail: `Reporting every ${snap.heartbeatS} s.` };

  const p = snap?.lastPayload;
  const sim = (path: string) => !!p?.simulated.some((s) => path === s || path.startsWith(`${s}.`));
  const shown = paused ? [] : lines.slice(-150);

  return (
    <Screen>
      {fw.current && <KeepAwake />}
      <Row icon="arrow-left" title="Back" onPress={onBack} right={<View />} />
      <Text style={T.title}>{t.beaconMode}</Text>
      <Banner tone="info" text={t.demoHint} />
      {error && <Banner tone="danger" text={error} />}

      {!fw.current && (
        <Card>
          <Text style={T.subtitle}>Which cooler is this phone?</Text>
          {ids?.length === 0 && <Text style={T.small}>Install a beacon first (Install tab). This phone can then act as that beacon.</Text>}
          {ids?.map((id) => <Row key={id} icon="access-point" title={id} detail="Installed from this phone" onPress={() => void begin(id)} />)}
        </Card>
      )}

      {fw.current && asset && (
        <>
          <StatusCard tone={plain.tone} title={plain.title} detail={plain.detail} />
          <Text style={T.small}>
            {asset.id} · {asset.retailer_name}
          </Text>
          {!snap?.simulatingDisplacement ? (
            <BigButton label="Simulate theft" hint="Unplugs the cooler and drives it away" icon="truck-fast" variant="danger" onPress={() => fw.current?.triggerDisplacement()} />
          ) : (
            <BigButton label="Stop the simulation" hint="Close the alert from Respond or the dashboard" icon="stop-circle-outline" variant="secondary" onPress={() => fw.current?.clearAlarm()} />
          )}

          <View style={styles.rowBetween}>
            <Text style={T.subtitle}>{t.advanced}</Text>
            <Switch value={advanced} onValueChange={setAdvanced} trackColor={{ true: C.navy, false: C.line }} accessibilityLabel={t.advanced} />
          </View>

          {advanced && (
            <>
              <Card>
                <SectionTitle>Firmware</SectionTitle>
                <Text style={styles.mono}>
                  state {snap?.state ?? '—'} · seq {snap?.seq ?? 0} · up {snap?.uptimeS ?? 0}s · buffered {snap?.buffered ?? 0}
                </Text>
                <Text style={styles.mono}>
                  last HTTP {snap?.lastHttp ? `${snap.lastHttp.status || 'ERR'} in ${snap.lastHttp.ms} ms` : '—'}
                </Text>

                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, paddingRight: S.md }}>
                    <Text style={T.subtitle}>Use phone charger as mains sensor</Text>
                    <Text style={T.small}>Unplug the charger to show an unplugged cooler.</Text>
                  </View>
                  <Switch
                    value={chargerAsMains}
                    onValueChange={(v) => {
                      setChargerAsMains(v);
                      fw.current?.setChargerAsMains(v);
                    }}
                    trackColor={{ true: C.navy, false: C.line }}
                    accessibilityLabel="Use phone charger as mains sensor"
                  />
                </View>

                <Text style={T.subtitle}>Heartbeat</Text>
                <View style={styles.segment} accessibilityRole="radiogroup">
                  {HEARTBEATS.map((h) => (
                    <Pressable
                      key={h.s}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: heartbeat === h.s }}
                      onPress={() => {
                        setHeartbeat(h.s);
                        fw.current?.setHeartbeat(h.s);
                      }}
                      style={[styles.segItem, heartbeat === h.s && styles.segOn]}
                    >
                      <Text style={[styles.segText, heartbeat === h.s && { color: C.white }]}>{h.label}</Text>
                      {!!h.hint && <Text style={[styles.segHint, heartbeat === h.s && { color: C.navySoft }]}>{h.hint}</Text>}
                    </Pressable>
                  ))}
                </View>
                <Text style={T.small}>Production beacons report every 5 min and speed up to 1 s during an alarm.</Text>
              </Card>

              {p && (
                <Card>
                  <SectionTitle>Sensors (last reading)</SectionTitle>
                  <Text style={T.small}>[SIM] = simulated; a phone cannot measure it.</Text>
                  <Reading label="GNSS" value={`${p.gps.latitude.toFixed(6)}, ${p.gps.longitude.toFixed(6)} · ${p.gps.satellites} sats · HDOP ${p.gps.hdop}`} sim={sim('gps')} />
                  <Reading label="Speed / course" value={`${p.speed_kmh} km/h · ${p.bearing_deg}°`} sim={sim('gps')} />
                  <Reading label="MPU6050 (g)" value={`${p.accelerometer.accel_x}, ${p.accelerometer.accel_y}, ${p.accelerometer.accel_z}`} sim={sim('accelerometer')} />
                  <Reading label="MPU6050 raw" value={p.accelerometer.accel_raw.join(', ')} sim={sim('accelerometer')} />
                  <Reading label="Vibration" value={`${p.accelerometer.vibration_rms} g RMS · ${p.accelerometer.vibration_status} · tilt ${p.accelerometer.tilt_deg}°`} sim={sim('accelerometer')} />
                  <Reading label="AC mains" value={p.power.mains_connected ? `ON · ${p.power.voltage_ac} V · ${p.power.frequency_hz} Hz` : 'OFF · 0 V'} sim={sim('power.mains_connected') || sim('power.voltage_ac')} />
                  <Reading label="Backup battery" value={`${p.power.battery_level_pct}%${p.power.battery_charging ? ' · charging' : ''}`} sim={sim('power.battery_level_pct')} />
                  <Reading label="Cabinet (DS18B20)" value={`${p.cold_chain.internal_temp_c} °C`} sim={sim('cold_chain')} />
                  <Reading label="Cellular" value={`${p.cellular.network} · ${p.cellular.rssi_dbm} dBm (CSQ ${p.cellular.csq})`} sim={sim('cellular')} />
                </Card>
              )}

              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <View style={[styles.rowBetween, { paddingHorizontal: S.lg, paddingTop: S.md }]}>
                  <SectionTitle>Serial console · 115200</SectionTitle>
                  <View style={{ flexDirection: 'row', gap: S.md }}>
                    <Pressable accessibilityRole="button" onPress={() => setPaused((v) => !v)}>
                      <Text style={styles.link}>{paused ? 'Resume' : 'Pause'}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => fw.current?.serial.clear()}>
                      <Text style={styles.link}>Clear</Text>
                    </Pressable>
                  </View>
                </View>
                <SerialConsole lines={shown} paused={paused} />
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
};

const Reading: React.FC<{ label: string; value: string; sim: boolean }> = ({ label, value, sim }) => (
  <View style={styles.reading}>
    <Text style={[T.small, { width: 120 }]}>{label}</Text>
    <Text style={[styles.mono, { flex: 1 }]}>
      {value}
      {sim && <Text style={{ color: C.goldText }}> [SIM]</Text>}
    </Text>
  </View>
);

const LEVEL_COLOR = { info: '#D1FAE5', warn: '#FDE68A', error: '#FCA5A5' } as const;

const SerialConsole: React.FC<{ lines: SerialLine[]; paused: boolean }> = ({ lines, paused }) => {
  const ref = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    if (!paused) ref.current?.scrollToEnd({ animated: false });
  }, [lines, paused]);
  return (
    <ScrollView ref={ref} style={styles.console} contentContainerStyle={{ padding: S.md }} nestedScrollEnabled>
      {paused && <Text style={[styles.consoleText, { color: '#94A3B8' }]}>-- paused --</Text>}
      {lines.map((l) => (
        <Text key={l.id} style={[styles.consoleText, { color: l.sim && l.level === 'info' ? '#94A3B8' : LEVEL_COLOR[l.level] }]} selectable>
          {SerialPort.format(l)}
        </Text>
      ))}
    </ScrollView>
  );
};

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, Consolas, monospace' });

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.md },
  mono: { fontFamily: MONO, fontSize: 13, color: C.ink2 },
  reading: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, paddingVertical: 2 },
  segment: { flexDirection: 'row', gap: S.sm },
  segItem: { flex: 1, minHeight: 48, borderRadius: R.md, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white },
  segOn: { backgroundColor: C.navy, borderColor: C.navy },
  segText: { fontSize: 15, fontWeight: '700', color: C.navy },
  segHint: { fontSize: 11, color: C.muted },
  link: { color: C.navy, fontWeight: '600', fontSize: 14 },
  console: { height: 320, backgroundColor: '#0B1220', marginTop: S.sm },
  consoleText: { fontFamily: MONO, fontSize: 11, lineHeight: 16 },
});
