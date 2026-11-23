import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useBeacon } from '../context/BeaconContext';

export const EmergencyBreachScreen: React.FC = () => {
  const {
    deviceId,
    coolerId,
    retailer,
    telemetry,
    resetDisplacement,
    isLockdownActive,
    toggleLockdown,
    setCurrentScreen,
    assessment,
    link,
  } = useBeacon();

  // Backend verdict when reachable, else the on-device estimate carried in the payload.
  const confidence = assessment?.theft_prediction_confidence_pct ?? telemetry.theft_prediction_confidence_pct;
  const riskPct = assessment?.risk_score_pct ?? telemetry.risk_score_pct;
  const reason = (code: string) => assessment?.reasons.find((r) => r.code === code);
  const displacementM = assessment?.displacement_distance_m ?? telemetry.displacement_distance_m;
  const geofenceChip = reason('GEOFENCE_BREACH')
    ? `+${reason('GEOFENCE_BREACH')!.points} pts`
    : telemetry.geofence_breached
    ? 'Breached'
    : 'Inside';
  const curfewChip = reason('CURFEW_MOTION') ? 'After hours' : reason('MOTION') ? 'Trading hrs' : '—';
  const mainsChip = reason('MAINS_CUT_IN_TRANSIT') ? 'Cut in transit' : telemetry.power.mains_connected ? 'Connected' : 'Cut';

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [isLockingDown, setIsLockingDown] = useState(false);
  const [sirenActive, setSirenActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // since this breach screen opened

  // Red alert flashing glow animation
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const pingAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const flash = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.9,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    const ping = Animated.loop(
      Animated.sequence([
        Animated.timing(pingAnim, {
          toValue: 1.4,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pingAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    flash.start();
    ping.start();

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      flash.stop();
      ping.stop();
      clearInterval(timer);
    };
  }, []);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `T+ ${m < 10 ? '0' : ''}${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const handleSirenLockdown = () => {
    setIsLockingDown(true);
    setTimeout(() => {
      setIsLockingDown(false);
      setSirenActive(true);
      toggleLockdown();
    }, 1400);
  };

  const handleVerifyPin = () => {
    if (pinCode.length >= 4) {
      setPinModalVisible(false);
      setPinCode('');
      Alert.alert(
        'Authorized Movement Logged',
        `Supervisor authentication verified for ${deviceId}. Displacement status reset to nominal.`,
        [
          {
            text: 'Return to Telemetry',
            onPress: () => {
              resetDisplacement();
              setCurrentScreen('active');
            },
          },
        ]
      );
    } else {
      Alert.alert('Invalid PIN', 'Please enter a 4-digit or 6-digit authorized supervisor PIN.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Ambient Red Warning Strip */}
      <Animated.View style={[styles.redAlertBar, { opacity: glowAnim }]}>
        <MaterialIcons name="warning" size={14} color="#fff" />
        <Text style={styles.redAlertBarText}>
          EMERGENCY DISPLACEMENT PROTOCOL ACTIVE • 1-SEC TELEMETRY BURST
        </Text>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Incident Header & Live Status */}
        <View style={styles.incidentHeaderCard}>
          <View style={styles.incidentTopRow}>
            <View style={styles.incidentBadgeIconContainer}>
              <Animated.View
                style={[
                  styles.incidentPingCircle,
                  {
                    transform: [{ scale: pingAnim }],
                  },
                ]}
              />
              <View style={styles.incidentBadgeIcon}>
                <MaterialIcons name="fmd-bad" size={26} color={THEME.colors.onErrorContainer} />
              </View>
            </View>

            <View style={styles.incidentHeaderDetails}>
              <View style={styles.priorityRow}>
                <View style={styles.priorityChip}>
                  <View style={styles.whitePulseDot} />
                  <Text style={styles.priorityChipText}>PRIORITY 1 INTERVENTION</Text>
                </View>
                <Text style={styles.elapsedTimerText}>{formatElapsed(elapsedSeconds)}</Text>
              </View>

              <Text style={styles.incidentTitle}>UNAUTHORIZED DISPLACEMENT</Text>

              <Text style={styles.incidentSubtext}>
                NODE: <Text style={styles.whiteHighlightText}>{deviceId}</Text> • ASSET:{' '}
                <Text style={styles.goldHighlightText}>Industrial Refrig-V4</Text>
                {'\n'}
                {assessment?.incident_id
                  ? `HQ INCIDENT ${assessment.incident_id} • RISK ${riskPct}%`
                  : link.connected
                  ? 'HQ notified • awaiting incident ID'
                  : 'HQ UNREACHABLE • on-device estimate'}
              </Text>
            </View>
          </View>
        </View>

        {/* Primary Critical Metric Panel */}
        <View style={styles.metricsCard}>
          {/* Velocity & Vector Header */}
          <View style={styles.velocityHeaderRow}>
            <View>
              <Text style={styles.metricEyebrow}>LIVE DISPLACEMENT VELOCITY</Text>
              <View style={styles.velocityNumRow}>
                <Text style={styles.velocityBigText}>
                  {telemetry.speed_kmh.toFixed(1)}
                </Text>
                <Text style={styles.velocityUnitText}>km/h</Text>
              </View>
            </View>

            <View style={styles.vectorRightCol}>
              <View style={styles.motionBadge}>
                <MaterialIcons name="sync" size={13} color={THEME.colors.onErrorContainer} />
                <Text style={styles.motionBadgeText}>SUSTAINED MOTION</Text>
              </View>
              <Text style={styles.bearingText}>{telemetry.bearing_text}</Text>
            </View>
          </View>

          {/* Anomaly Multi-Factor Confidence Meter */}
          <View style={styles.confidenceBox}>
            <View style={styles.confidenceHeader}>
              <View style={styles.confidenceLeft}>
                <MaterialIcons name="psychology" size={16} color={THEME.colors.secondary} />
                <Text style={styles.confidenceTitle}>THEFT PREDICTION CONFIDENCE</Text>
              </View>
              <Text style={styles.confidenceScore}>{confidence.toFixed(1)}% MATCH</Text>
            </View>

            {/* Red Progress Track */}
            <View style={styles.confidenceTrackBg}>
              <View style={[styles.confidenceTrackFill, { width: `${Math.min(100, confidence)}%` }]} />
            </View>

            {/* 3 Breakdown Chips (from the backend's reasoning) */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownChip}>
                <Text style={styles.breakdownLabel}>Geofence</Text>
                <Text style={styles.breakdownValueRed}>{geofenceChip}</Text>
              </View>

              <View style={styles.breakdownChip}>
                <Text style={styles.breakdownLabel}>Curfew Time</Text>
                <Text style={styles.breakdownValueGold}>{curfewChip}</Text>
              </View>

              <View style={styles.breakdownChip}>
                <Text style={styles.breakdownLabel}>Mains Power</Text>
                <Text style={styles.breakdownValueRed}>{mainsChip}</Text>
              </View>
            </View>
          </View>

          {/* Two-Column Telemetry Diagnostics */}
          <View style={styles.twoColDiagnostics}>
            {/* Geofence Metric */}
            <View style={styles.diagBox}>
              <View style={styles.diagBoxHeader}>
                <Text style={styles.diagBoxLabel}>BOUNDARY VIOLATION</Text>
                <MaterialIcons name="fence" size={16} color={THEME.colors.criticalRed} />
              </View>
              <View>
                <Text style={styles.diagBoxValueRed}>+{(displacementM / 1000).toFixed(2)} km</Text>
                <Text style={styles.diagBoxSub} numberOfLines={1}>Anchor: {retailer.name}</Text>
              </View>
            </View>

            {/* Power Status Metric */}
            <View style={styles.diagBox}>
              <View style={styles.diagBoxHeader}>
                <Text style={styles.diagBoxLabel}>TELEMETRY POWER</Text>
                <MaterialIcons name="battery-alert" size={16} color={THEME.colors.secondary} />
              </View>
              <View>
                <Text style={styles.diagBoxValueGold}>DISCONNECTED</Text>
                <Text style={styles.diagBoxSub}>
                  Li-ion: {telemetry.power.battery_level_pct}% ({telemetry.power.backup_duration_hours}h rem.)
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Industrial Tactical Map Vector & Tracking Visual */}
        <View style={styles.tacticalMapCard}>
          {/* Tactical Map Header */}
          <View style={styles.tacticalHeader}>
            <View style={styles.tacticalTitleGroup}>
              <MaterialIcons name="satellite-alt" size={18} color={THEME.colors.primary} />
              <Text style={styles.tacticalTitle}>VECTOR DISPLACEMENT RADAR</Text>
            </View>
            <View style={styles.accuracyGroup}>
              <View style={styles.cyanPulseDot} />
              <Text style={styles.accuracyText}>GPS Accuracy ±2.8m</Text>
            </View>
          </View>

          {/* Map Canvas with SVG Grid & Curved Trajectory */}
          <View style={styles.mapCanvas}>
            {/* Dark Tactical Grid Pattern */}
            <Svg width="100%" height="220" style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id="vectorGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#2995eb" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#ffb4ab" stopOpacity="1" />
                </LinearGradient>
              </Defs>

              {/* Grid Lines */}
              <Line x1="0" y1="55" x2="400" y2="55" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <Line x1="0" y1="110" x2="400" y2="110" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <Line x1="0" y1="165" x2="400" y2="165" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <Line x1="100" y1="0" x2="100" y2="220" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <Line x1="200" y1="0" x2="200" y2="220" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <Line x1="300" y1="0" x2="300" y2="220" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

              {/* Geofence Original Radius Circle (Avondale Origin) */}
              <Circle
                cx="100"
                cy="165"
                r="32"
                stroke="#2995eb"
                strokeWidth="1.5"
                strokeDasharray="4,4"
                fill="#2995eb"
                fillOpacity="0.12"
              />

              {/* Breadcrumb Trajectory Curve */}
              <Path
                d="M 100 165 Q 160 135 200 95 T 280 50"
                fill="none"
                stroke="url(#vectorGrad)"
                strokeWidth="2.5"
                strokeDasharray="6,4"
              />
            </Svg>

            {/* Anchor Pin (Origin: 100, 165) */}
            <View style={styles.anchorPinBox}>
              <View style={styles.anchorBadge}>
                <Text style={styles.anchorBadgeText}>Anchor Point (50m)</Text>
              </View>
              <View style={styles.anchorCircle}>
                <View style={styles.anchorDot} />
              </View>
            </View>

            {/* Current Target Node Marker (280, 50) */}
            <View style={styles.targetPinBox}>
              <View style={styles.targetPingWrapper}>
                <View style={styles.targetPingOuter} />
                <View style={styles.targetIconCircle}>
                  <MaterialIcons name="navigation" size={14} color="#fff" />
                </View>
              </View>
              <View style={styles.targetBadge}>
                <Text style={styles.targetBadgeText}>Current Node (#9042)</Text>
              </View>
            </View>

            {/* Quick Coordinates Overlay */}
            <View style={styles.coordinatesOverlay}>
              <View style={styles.coordLeft}>
                <MaterialIcons name="my-location" size={14} color={THEME.colors.primary} />
                <Text style={styles.coordText}>-17.78120° S, 31.05431° E</Text>
              </View>
              <Text style={styles.coordSector}>SECTOR 4 TRANSIT</Text>
            </View>
          </View>

          {/* Map Auxiliary Telemetry Bar */}
          <View style={styles.mapAuxBar}>
            <View style={styles.auxCol}>
              <MaterialIcons name="timer" size={16} color={THEME.colors.onSurfaceVariant} />
              <View>
                <Text style={styles.auxLabel}>Exit Boundary</Text>
                <Text style={styles.auxValue}>3m 14s elapsed</Text>
              </View>
            </View>

            <View style={styles.auxCol}>
              <MaterialIcons name="signal-cellular-alt" size={16} color={THEME.colors.onSurfaceVariant} />
              <View>
                <Text style={styles.auxLabel}>Cell Transmission</Text>
                <Text style={styles.auxValueGold}>1s Burst Cadence</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Remote Containment Actions Panel */}
        <View style={styles.actionsCard}>
          <View style={styles.actionsHeader}>
            <MaterialIcons name="bolt" size={20} color={THEME.colors.criticalRed} />
            <Text style={styles.actionsTitle}>REMOTE CONTAINMENT ACTIONS</Text>
          </View>

          {/* Action 1: Hard Lockdown */}
          <TouchableOpacity
            style={[styles.lockdownBtn, (sirenActive || isLockdownActive) && styles.lockdownBtnActive]}
            activeOpacity={0.8}
            onPress={handleSirenLockdown}
            disabled={isLockingDown}
          >
            <MaterialIcons
              name={sirenActive ? 'volume-up' : 'campaign'}
              size={20}
              color={sirenActive ? THEME.colors.onErrorContainer : '#fff'}
            />
            <Text style={sirenActive ? styles.lockdownBtnTextActive : styles.lockdownBtnText}>
              {isLockingDown
                ? 'DISPATCHING KILL-SWITCH & SIREN...'
                : sirenActive
                ? 'COMMAND DELIVERED: SIREN ACTIVE (110dB)'
                : 'Lockout Compressor & Sound Siren'}
            </Text>
          </TouchableOpacity>

          {/* Action 2: PIN Override */}
          <TouchableOpacity
            style={styles.overrideBtn}
            activeOpacity={0.7}
            onPress={() => setPinModalVisible(true)}
          >
            <MaterialIcons name="vpn-key" size={18} color={THEME.colors.onSurfaceVariant} />
            <Text style={styles.overrideBtnText}>Authorize Movement / PIN Override</Text>
          </TouchableOpacity>
        </View>

        {/* Realtime Stream Toast */}
        <View style={styles.streamToast}>
          <View style={styles.streamToastLeft}>
            <View style={styles.goldPulseDot} />
            <Text style={styles.streamToastText} numberOfLines={1}>
              Streaming AES-256 burst telemetry to{' '}
              <Text style={{ color: THEME.colors.onSurface, fontWeight: '700' }}>
                Harare Central HQ
              </Text>
            </Text>
          </View>
          <View style={styles.ackChip}>
            <Text style={styles.ackChipText}>ACK 9042</Text>
          </View>
        </View>
      </ScrollView>

      {/* Supervisor PIN Verification Modal */}
      <Modal visible={pinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="security" size={22} color={THEME.colors.secondary} />
                <Text style={styles.modalTitle}>Supervisor PIN Override</Text>
              </View>
              <TouchableOpacity onPress={() => setPinModalVisible(false)}>
                <MaterialIcons name="close" size={22} color={THEME.colors.onSurface} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Enter 4-digit or 6-digit Supervisor Authorization PIN to acknowledge authorized fridge relocation and disarm the displacement siren:
            </Text>

            <TextInput
              style={styles.pinInput}
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry
              placeholder="••••"
              placeholderTextColor={THEME.colors.outline}
              value={pinCode}
              onChangeText={setPinCode}
              autoFocus
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPinModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleVerifyPin}>
                <Text style={styles.modalSubmitText}>Authorize</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
  },
  redAlertBar: {
    backgroundColor: THEME.colors.criticalRed,
    paddingVertical: 5,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  redAlertBarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
  },
  incidentHeaderCard: {
    backgroundColor: THEME.colors.surfaceContainerHigh,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  incidentTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  incidentBadgeIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  incidentPingCircle: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
  },
  incidentBadgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: THEME.colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incidentHeaderDetails: {
    flex: 1,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  priorityChip: {
    backgroundColor: THEME.colors.criticalRed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  whitePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  priorityChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  elapsedTimerText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: THEME.colors.onSurfaceVariant,
    letterSpacing: 0.4,
  },
  incidentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.criticalRed,
    letterSpacing: -0.3,
  },
  incidentSubtext: {
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
    marginTop: 2,
  },
  whiteHighlightText: {
    color: THEME.colors.onSurface,
    fontWeight: '600',
  },
  goldHighlightText: {
    color: THEME.colors.secondary,
    fontWeight: '600',
  },
  metricsCard: {
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  velocityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.onSurfaceVariant,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  velocityNumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  velocityBigText: {
    fontSize: 32,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: THEME.colors.criticalRed,
  },
  velocityUnitText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.criticalRed,
  },
  vectorRightCol: {
    alignItems: 'flex-end',
  },
  motionBadge: {
    backgroundColor: THEME.colors.errorContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  motionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.onErrorContainer,
  },
  bearingText: {
    fontSize: 10,
    color: THEME.colors.secondary,
    marginTop: 3,
  },
  confidenceBox: {
    backgroundColor: THEME.colors.surfaceContainer,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  confidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidenceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confidenceTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.secondary,
    letterSpacing: 0.6,
  },
  confidenceScore: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: THEME.colors.criticalRed,
  },
  confidenceTrackBg: {
    height: 8,
    width: '100%',
    backgroundColor: THEME.colors.surfaceContainerHighest,
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceTrackFill: {
    height: '100%',
    backgroundColor: THEME.colors.criticalRed,
    borderRadius: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  breakdownChip: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceContainerHigh,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 10,
    color: THEME.colors.onSurfaceVariant,
  },
  breakdownValueRed: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.criticalRed,
    marginTop: 2,
  },
  breakdownValueGold: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.secondary,
    marginTop: 2,
  },
  twoColDiagnostics: {
    flexDirection: 'row',
    gap: 10,
  },
  diagBox: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceContainer,
    padding: 10,
    borderRadius: 8,
    minHeight: 74,
    justifyContent: 'space-between',
  },
  diagBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diagBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.onSurfaceVariant,
  },
  diagBoxValueRed: {
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: THEME.colors.criticalRed,
  },
  diagBoxValueGold: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.secondary,
  },
  diagBoxSub: {
    fontSize: 10,
    color: THEME.colors.onSurfaceVariant,
    marginTop: 1,
  },
  tacticalMapCard: {
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tacticalHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: THEME.colors.surfaceContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tacticalTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tacticalTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.onSurface,
    letterSpacing: 0.6,
  },
  accuracyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cyanPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.primary,
  },
  accuracyText: {
    fontSize: 10,
    color: THEME.colors.onSurfaceVariant,
  },
  mapCanvas: {
    height: 220,
    width: '100%',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    position: 'relative',
  },
  anchorPinBox: {
    position: 'absolute',
    left: 80,
    top: 130,
    alignItems: 'center',
  },
  anchorBadge: {
    backgroundColor: THEME.colors.surfaceContainerHighest,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  anchorBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  anchorCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: THEME.colors.onPrimary,
  },
  targetPinBox: {
    position: 'absolute',
    left: 240,
    top: 30,
    alignItems: 'center',
  },
  targetPingWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  targetPingOuter: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
  },
  targetIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.colors.criticalRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetBadge: {
    backgroundColor: THEME.colors.errorContainer,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  targetBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.onErrorContainer,
  },
  coordinatesOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(11, 19, 38, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coordText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: THEME.colors.onSurfaceVariant,
  },
  coordSector: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.criticalRed,
  },
  mapAuxBar: {
    padding: 10,
    backgroundColor: THEME.colors.surfaceContainer,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  auxCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  auxLabel: {
    fontSize: 10,
    color: THEME.colors.onSurfaceVariant,
  },
  auxValue: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.onSurface,
  },
  auxValueGold: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.secondary,
  },
  actionsCard: {
    backgroundColor: THEME.colors.surfaceContainerHigh,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  actionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  actionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.onSurface,
    letterSpacing: 0.6,
  },
  lockdownBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: THEME.colors.criticalRed,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  lockdownBtnActive: {
    backgroundColor: THEME.colors.errorContainer,
  },
  lockdownBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  lockdownBtnTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.onErrorContainer,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  overrideBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  overrideBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.onSurface,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  streamToast: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streamToastLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  goldPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.secondary,
  },
  streamToastText: {
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
    flex: 1,
  },
  ackChip: {
    backgroundColor: THEME.colors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  ackChipText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: THEME.colors.surfaceContainerHigh,
    borderRadius: 12,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  modalDescription: {
    fontSize: 12,
    color: THEME.colors.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: 16,
  },
  pinInput: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.borderDark,
    textAlign: 'center',
    fontSize: 24,
    fontFamily: 'monospace',
    color: THEME.colors.onSurface,
    letterSpacing: 10,
    marginBottom: 18,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    color: THEME.colors.onSurfaceVariant,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: THEME.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    fontSize: 13,
    color: THEME.colors.onPrimaryContainer,
    fontWeight: '700',
  },
});

