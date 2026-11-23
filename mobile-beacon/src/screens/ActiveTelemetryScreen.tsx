import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import Svg, { Circle, Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useBeacon } from '../context/BeaconContext';

export const ActiveTelemetryScreen: React.FC = () => {
  const {
    deviceId,
    retailer,
    geofenceRadius,
    telemetry,
    countdown,
    lastPayloadLabel,
    simulateDisplacement,
    setCurrentScreen,
    assessment,
    link,
  } = useBeacon();

  // Backend verdict when reachable; otherwise the beacon's own estimate, clearly labelled.
  const riskPct = assessment?.risk_score_pct ?? telemetry.risk_score_pct;
  const riskLabel = assessment
    ? assessment.severity === 'critical'
      ? 'Critical'
      : assessment.severity === 'warning'
      ? 'Warning'
      : 'Nominal / Safe'
    : 'on-device estimate';
  const outsideFence = assessment?.geofence_breached ?? telemetry.geofence_breached;
  const driftM = assessment?.displacement_distance_m ?? telemetry.displacement_distance_m;
  const driftPct = Math.min(100, Math.round((driftM / Math.max(1, geofenceRadius)) * 100));
  const hemi = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(5)}° ${v < 0 ? neg : pos}`;

  // Radar sweep animation
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const spinAnim = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    spinAnim.start();
    pulseAnim.start();

    return () => {
      spinAnim.stop();
      pulseAnim.stop();
    };
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleDeactivatePrompt = () => {
    Alert.alert(
      'Technician Authentication Required',
      'Enter authorized maintenance PIN to de-provision node DLTA-BCN-9042 from OK Supermarket Avondale.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Configure',
          onPress: () => setCurrentScreen('setup'),
        },
      ]
    );
  };

  const padZero = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Node Identification Strip */}
        <View style={styles.nodeStripCard}>
          <View style={styles.stripRowTop}>
            <View style={styles.stripIdGroup}>
              <View style={styles.cyanPulseDot} />
              <Text style={styles.stripIdText}>NODE ID: {deviceId}</Text>
            </View>
            <View style={styles.stripFwGroup}>
              <Text style={styles.stripFwText}>FW v2.4.1</Text>
              <Text style={styles.stripDot}>•</Text>
              <View style={styles.batteryRow}>
                <MaterialIcons name="battery-charging-full" size={14} color={THEME.colors.primary} />
                <Text style={styles.batteryText}>{telemetry.power.battery_level_pct}%</Text>
              </View>
            </View>
          </View>

          <View style={styles.stripRowBottom}>
            <View style={styles.retailerGroup}>
              <MaterialIcons name="storefront" size={16} color={THEME.colors.secondary} />
              <Text style={styles.retailerText} numberOfLines={1}>
                {retailer.name} Branch
              </Text>
            </View>
            <View style={styles.siteCodeChip}>
              <Text style={styles.siteCodeText}>{retailer.site_code}</Text>
            </View>
          </View>
        </View>

        {/* Primary Surveillance Status & Radar Hub */}
        <View style={styles.radarHubCard}>
          {/* Radar Visual Rings */}
          <View style={styles.radarContainer}>
            <Animated.View
              style={[
                styles.radarOuterRing,
                {
                  transform: [{ scale: pulseValue }],
                },
              ]}
            />
            <View style={styles.radarMidRing} />
            <View style={styles.radarInnerRing} />

            {/* Rotating Sweep Segment */}
            <Animated.View
              style={[
                styles.sweepRotatingLayer,
                {
                  transform: [{ rotate: spin }],
                },
              ]}
            >
              <Svg width={144} height={144} viewBox="0 0 100 100">
                <Defs>
                  <LinearGradient id="radarSweep" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#9ccaff" stopOpacity="0.8" />
                    <Stop offset="100%" stopColor="#9ccaff" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Circle
                  cx="50"
                  cy="50"
                  r="46"
                  stroke={THEME.colors.primary}
                  strokeOpacity={0.2}
                  strokeWidth="1.5"
                  strokeDasharray="4,6"
                  fill="none"
                />
                <Path d="M 50 50 L 50 4 A 46 46 0 0 1 85 20 Z" fill="url(#radarSweep)" opacity={0.45} />
              </Svg>
            </Animated.View>

            {/* Center Node Badge */}
            <View style={styles.centerNodeBadge}>
              <MaterialIcons name="sensors" size={26} color={THEME.colors.primary} />
            </View>
          </View>

          {/* Status Headline */}
          <View style={styles.statusBadge}>
            <View style={styles.cyanPulseDot} />
            <Text style={styles.statusBadgeText}>
              {link.connected ? 'STATUS: SECURE & TRANSMITTING' : 'STATUS: SECURE • BACKEND OFFLINE'}
            </Text>
          </View>

          <View style={styles.heartbeatRow}>
            <Text style={[styles.heartbeatDot, !link.connected && { color: THEME.colors.criticalRed }]}>●</Text>
            <Text style={styles.heartbeatText} numberOfLines={1}>
              {link.connected
                ? `Heartbeat Live (${link.cadenceSeconds}s cadence) • ${link.apiBase.replace(/^https?:\/\//, '')}`
                : `Retrying ${link.apiBase.replace(/^https?:\/\//, '')}`}
            </Text>
          </View>

          {/* Digital Telemetry Counters */}
          <View style={styles.countersBox}>
            <View style={styles.counterColLeft}>
              <Text style={styles.counterLabel}>LAST PAYLOAD</Text>
              <Text style={styles.counterValue}>{lastPayloadLabel}</Text>
            </View>
            <View style={styles.counterColRight}>
              <Text style={styles.counterLabel}>NEXT SYNC</Text>
              <Text style={styles.counterValueCountdown}>00:{padZero(countdown)}</Text>
            </View>
          </View>

          {/* Sentinel AI Risk Evaluation Ribbon */}
          <View style={styles.aiRiskRibbon}>
            <View style={styles.aiRiskLeft}>
              <MaterialIcons name="verified-user" size={16} color={THEME.colors.secondary} />
              <Text style={styles.aiRiskLabel}>AI Displacement Risk</Text>
            </View>
            <Text style={styles.aiRiskValue}>
              {riskPct.toFixed(1)}% ({riskLabel})
            </Text>
          </View>
        </View>

        {/* Live Data Feed Section */}
        <View style={styles.feedSection}>
          {/* Card 1: GPS Telemetry */}
          <View style={styles.feedCard}>
            <View style={styles.feedCardHeader}>
              <View style={styles.feedCardHeaderLeft}>
                <View style={styles.feedIconBox}>
                  <MaterialIcons name="satellite-alt" size={18} color={THEME.colors.primary} />
                </View>
                <View>
                  <Text style={styles.feedCardTitle}>GPS Telemetry</Text>
                  <Text style={styles.feedCardSubtitle}>GNSS DUAL-BAND L1 / L5</Text>
                </View>
              </View>
              <View style={styles.geofenceInsideBadge}>
                <Text style={[styles.geofenceInsideText, outsideFence && { color: THEME.colors.criticalRed }]}>
                  GEOFENCE: {outsideFence ? 'OUTSIDE' : 'INSIDE'}
                </Text>
              </View>
            </View>

            {/* Coordinates Grid */}
            <View style={styles.gpsGridRow}>
              <View style={styles.gpsMetricBox}>
                <Text style={styles.microLabel}>Coordinates</Text>
                <Text style={styles.monoValue}>
                  {hemi(telemetry.gps.latitude, 'N', 'S')}{'\n'}
                  {hemi(telemetry.gps.longitude, 'E', 'W')}
                </Text>
              </View>

              <View style={styles.gpsMetricBox}>
                <View>
                  <Text style={styles.microLabel}>Lock State</Text>
                  <Text style={styles.statValue}>14 Sats (HDOP 0.7)</Text>
                </View>
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.microLabel}>Elevation</Text>
                  <Text style={styles.elevationText}>1,492m ASL</Text>
                </View>
              </View>
            </View>

            {/* Displacement & Velocity Bar */}
            <View style={styles.velocityRow}>
              <View>
                <Text style={styles.microLabel}>CURRENT VELOCITY</Text>
                <View style={styles.speedInlineGroup}>
                  <Text style={styles.speedLargeText}>{telemetry.speed_kmh.toFixed(1)}</Text>
                  <Text style={styles.speedUnitText}>km/h</Text>
                  <Text style={styles.speedTagText}>{telemetry.speed_kmh < 1 ? 'STATIONARY' : 'MOVING'}</Text>
                </View>
              </View>

              <View style={styles.driftContainer}>
                <Text style={styles.microLabel}>Anchor Drift</Text>
                <Text style={styles.driftValueText}>
                  {driftM.toFixed(1)}m / {geofenceRadius}.0m
                </Text>
                <View style={styles.driftProgressBar}>
                  <View
                    style={[
                      styles.driftProgressFill,
                      { width: `${Math.max(2, driftPct)}%` },
                      driftPct >= 100 && { backgroundColor: THEME.colors.criticalRed },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Card 2: 3-Axis Accelerometer (MPU-6050) */}
          <View style={styles.feedCard}>
            <View style={styles.feedCardHeader}>
              <View style={styles.feedCardHeaderLeft}>
                <View style={styles.feedIconBox}>
                  <MaterialIcons name="screen-rotation" size={18} color={THEME.colors.primary} />
                </View>
                <View>
                  <Text style={styles.feedCardTitle}>Inertial Sentinel</Text>
                  <Text style={styles.feedCardSubtitle}>MPU-6050 3-AXIS ACCEL</Text>
                </View>
              </View>
              <View style={styles.stableBadge}>
                <Text style={styles.stableBadgeText}>STABLE</Text>
              </View>
            </View>

            {/* Tri-Axis Real-Time Waveforms */}
            <View style={styles.waveformsContainer}>
              {/* X Axis */}
              <View style={styles.axisRow}>
                <View style={styles.axisLabelBox}>
                  <Text style={styles.axisLabel}>X-AXIS</Text>
                  <Text style={styles.axisValue}>
                    {telemetry.accelerometer.accel_x >= 0 ? '+' : ''}
                    {telemetry.accelerometer.accel_x.toFixed(3)}g
                  </Text>
                </View>
                <Svg width={140} height={24} viewBox="0 0 144 24">
                  <Path
                    d="M0,12 L30,12 L35,10 L40,14 L45,12 L80,12 L85,11 L90,13 L95,12 L144,12"
                    stroke={THEME.colors.primary}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </Svg>
                <Text style={styles.axisStateTag}>REST</Text>
              </View>

              {/* Y Axis */}
              <View style={styles.axisRow}>
                <View style={styles.axisLabelBox}>
                  <Text style={styles.axisLabel}>Y-AXIS</Text>
                  <Text style={styles.axisValue}>
                    {telemetry.accelerometer.accel_y >= 0 ? '+' : ''}
                    {telemetry.accelerometer.accel_y.toFixed(3)}g
                  </Text>
                </View>
                <Svg width={140} height={24} viewBox="0 0 144 24">
                  <Path
                    d="M0,12 L20,12 L25,13 L30,11 L35,12 L90,12 L95,13 L100,11 L105,12 L144,12"
                    stroke={THEME.colors.primary}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </Svg>
                <Text style={styles.axisStateTag}>REST</Text>
              </View>

              {/* Z Axis */}
              <View style={styles.axisRow}>
                <View style={styles.axisLabelBox}>
                  <Text style={styles.axisLabel}>Z-AXIS</Text>
                  <Text style={[styles.axisValue, { color: THEME.colors.secondary }]}>
                    {telemetry.accelerometer.accel_z.toFixed(3)}g
                  </Text>
                </View>
                <Svg width={140} height={24} viewBox="0 0 144 24">
                  <Path
                    d="M0,12 L15,12 L20,9 L25,15 L30,12 L60,12 L65,10 L70,14 L75,12 L144,12"
                    stroke={THEME.colors.secondary}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </Svg>
                <Text style={styles.axisStateTagGold}>1G VEC</Text>
              </View>
            </View>

            {/* Vibration Footnote */}
            <View style={styles.vibrationFootnote}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MaterialIcons name="vibration" size={14} color={THEME.colors.onSurfaceVariant} />
                <Text style={styles.vibrationText}>RMS: 0.004 mm/s</Text>
              </View>
              <Text style={styles.harmonicText}>Compressor Harmonic: Nominal</Text>
            </View>
          </View>

          {/* Card 3: Cold Chain & Grid */}
          <View style={styles.feedCard}>
            <View style={styles.feedCardHeader}>
              <View style={styles.feedCardHeaderLeft}>
                <View style={styles.feedIconBox}>
                  <MaterialIcons name="ac-unit" size={18} color={THEME.colors.primary} />
                </View>
                <View>
                  <Text style={styles.feedCardTitle}>Cold Chain & Grid</Text>
                  <Text style={styles.feedCardSubtitle}>AC MONITOR & NTC PROBE</Text>
                </View>
              </View>
              <View style={styles.acOnlineBadge}>
                <Text style={styles.acOnlineText}>AC ONLINE</Text>
              </View>
            </View>

            {/* Metrics */}
            <View style={styles.coldChainGridRow}>
              <View style={styles.coldChainBox}>
                <Text style={styles.microLabel}>Internal Chamber Probe</Text>
                <Text style={styles.metricBigNum}>{telemetry.cold_chain.internal_temp_c}°C</Text>
                <Text style={styles.metricOptimalTag}>Optimal (2.0° - 6.0°)</Text>
              </View>

              <View style={styles.coldChainBox}>
                <Text style={styles.microLabel}>Compressor Load</Text>
                <Text style={[styles.metricBigNum, { color: THEME.colors.secondary }]}>
                  {telemetry.power.current_amps}A
                </Text>
                <Text style={styles.monoVoltageText}>
                  {telemetry.power.voltage_ac}V AC / {telemetry.power.frequency_hz}Hz
                </Text>
              </View>
            </View>

            {/* Tamper Status Bar */}
            <View style={styles.tamperBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="lock" size={18} color={THEME.colors.primary} />
                <Text style={styles.tamperTitle}>Magnetic Chassis Bracket</Text>
              </View>
              <Text style={styles.tamperStatusText}>ARMED & SEALED</Text>
            </View>
          </View>
        </View>

        {/* Bottom Control Actions & Testing Rig */}
        <View style={styles.controlsSection}>
          {/* SIMULATE DISPLACEMENT EVENT BUTTON */}
          <TouchableOpacity
            style={styles.simulateBtn}
            activeOpacity={0.85}
            onPress={simulateDisplacement}
          >
            <View style={styles.simulateLeft}>
              <View style={styles.alertIconCircle}>
                <MaterialIcons name="notification-important" size={20} color={THEME.colors.onSecondaryContainer} />
              </View>
              <View style={styles.simulateTextCol}>
                <Text style={styles.simulateTitle}>SIMULATE DISPLACEMENT EVENT</Text>
                <Text style={styles.simulateSubtitle}>
                  Unplugs & moves the cooler; streams 1-sec breach telemetry to HQ
                </Text>
              </View>
            </View>
            <MaterialIcons name="sensors-off" size={22} color={THEME.colors.secondary} />
          </TouchableOpacity>

          {/* Node Maintenance PIN Lock Button */}
          <TouchableOpacity
            style={styles.deactivateBtn}
            activeOpacity={0.7}
            onPress={handleDeactivatePrompt}
          >
            <MaterialIcons name="vpn-key" size={16} color={THEME.colors.outline} />
            <Text style={styles.deactivateBtnText}>
              Deactivate Sentinel Node (Technician PIN Required)
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  nodeStripCard: {
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  stripRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stripIdGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cyanPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
  },
  stripIdText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.onSurface,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  stripFwGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stripFwText: {
    fontSize: 10,
    color: THEME.colors.onSurfaceVariant,
  },
  stripDot: {
    color: THEME.colors.outlineVariant,
    fontSize: 10,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  batteryText: {
    fontSize: 10,
    color: THEME.colors.primary,
    fontWeight: '600',
  },
  stripRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  retailerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  retailerText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.onSurface,
    flex: 1,
  },
  siteCodeChip: {
    backgroundColor: THEME.colors.surfaceContainerHigh,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  siteCodeText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: THEME.colors.onSurfaceVariant,
  },
  radarHubCard: {
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  radarContainer: {
    width: 144,
    height: 144,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 6,
  },
  radarOuterRing: {
    position: 'absolute',
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: 'rgba(156, 202, 255, 0.05)',
  },
  radarMidRing: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(34, 42, 61, 0.6)',
  },
  radarInnerRing: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(45, 52, 73, 0.8)',
  },
  sweepRotatingLayer: {
    position: 'absolute',
    width: 144,
    height: 144,
  },
  centerNodeBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceContainerHighest,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 6,
    marginTop: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
    letterSpacing: 0.6,
  },
  heartbeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  heartbeatDot: {
    color: THEME.colors.primary,
    fontSize: 10,
  },
  heartbeatText: {
    fontSize: 12,
    color: THEME.colors.onSurfaceVariant,
  },
  countersBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: 'rgba(23, 31, 51, 0.6)',
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
  },
  counterColLeft: {
    alignItems: 'flex-start',
  },
  counterColRight: {
    alignItems: 'flex-end',
  },
  counterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.outline,
    letterSpacing: 0.5,
  },
  counterValue: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.onSurface,
    marginTop: 2,
  },
  counterValueCountdown: {
    fontSize: 15,
    fontFamily: 'monospace',
    fontWeight: '600',
    color: THEME.colors.primary,
    marginTop: 2,
  },
  aiRiskRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: THEME.colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
  },
  aiRiskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiRiskLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: THEME.colors.onSurfaceVariant,
  },
  aiRiskValue: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  feedSection: {
    gap: 16,
    marginBottom: 16,
  },
  feedCard: {
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  feedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedIconBox: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: THEME.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.onSurface,
  },
  feedCardSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.outline,
    letterSpacing: 0.6,
  },
  geofenceInsideBadge: {
    backgroundColor: THEME.colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  geofenceInsideText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  stableBadge: {
    backgroundColor: THEME.colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stableBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  acOnlineBadge: {
    backgroundColor: THEME.colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  acOnlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  gpsGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gpsMetricBox: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceContainer,
    padding: 8,
    borderRadius: 8,
    justifyContent: 'space-between',
  },
  microLabel: {
    fontSize: 10,
    color: THEME.colors.outline,
  },
  monoValue: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '600',
    color: THEME.colors.onSurface,
    marginTop: 4,
    lineHeight: 16,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.onSurface,
    marginTop: 2,
  },
  elevationText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: THEME.colors.onSurfaceVariant,
    marginTop: 1,
  },
  velocityRow: {
    backgroundColor: THEME.colors.surfaceContainer,
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speedInlineGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  speedLargeText: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  speedUnitText: {
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
  },
  speedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginLeft: 4,
  },
  driftContainer: {
    width: '48%',
    alignItems: 'flex-end',
  },
  driftValueText: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '600',
    color: THEME.colors.onSurface,
    marginTop: 2,
  },
  driftProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: THEME.colors.surfaceContainerHighest,
    borderRadius: 3,
    marginTop: 4,
    overflow: 'hidden',
  },
  driftProgressFill: {
    height: '100%',
    backgroundColor: THEME.colors.primary,
    borderRadius: 3,
  },
  waveformsContainer: {
    gap: 6,
  },
  axisRow: {
    backgroundColor: THEME.colors.surfaceContainer,
    padding: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  axisLabelBox: {
    width: 64,
  },
  axisLabel: {
    fontSize: 10,
    color: THEME.colors.outline,
  },
  axisValue: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: THEME.colors.onSurface,
    marginTop: 1,
  },
  axisStateTag: {
    fontSize: 10,
    color: THEME.colors.outline,
    fontWeight: '600',
  },
  axisStateTagGold: {
    fontSize: 10,
    color: THEME.colors.secondary,
    fontWeight: '700',
  },
  vibrationFootnote: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  vibrationText: {
    fontSize: 10,
    color: THEME.colors.onSurfaceVariant,
  },
  harmonicText: {
    fontSize: 10,
    color: THEME.colors.outline,
  },
  coldChainGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  coldChainBox: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceContainer,
    padding: 10,
    borderRadius: 8,
    justifyContent: 'space-between',
  },
  metricBigNum: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.colors.onSurface,
    marginVertical: 4,
  },
  metricOptimalTag: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  monoVoltageText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: THEME.colors.onSurfaceVariant,
  },
  tamperBar: {
    backgroundColor: THEME.colors.surfaceContainer,
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tamperTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.onSurface,
  },
  tamperStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
    textTransform: 'uppercase',
  },
  controlsSection: {
    gap: 10,
  },
  simulateBtn: {
    backgroundColor: 'rgba(233, 195, 73, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(233, 195, 73, 0.25)',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  simulateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  alertIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulateTextCol: {
    flex: 1,
  },
  simulateTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  simulateSubtitle: {
    fontSize: 10,
    color: THEME.colors.onSurfaceVariant,
    opacity: 0.85,
    marginTop: 1,
  },
  deactivateBtn: {
    backgroundColor: THEME.colors.surfaceContainer,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deactivateBtnText: {
    fontSize: 12,
    color: THEME.colors.outline,
    fontWeight: '500',
  },
});

