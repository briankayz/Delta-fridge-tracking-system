import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useBeacon } from '../context/BeaconContext';

interface HeaderProps {
  onProfilePress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onProfilePress }) => {
  const { currentScreen, isMuted, toggleMute } = useBeacon();
  const isBreach = currentScreen === 'breach';

  return (
    <View style={[styles.headerContainer, isBreach && styles.headerContainerBreach]}>
      <View style={styles.contentRow}>
        {/* Left Branding Block */}
        <View style={styles.leftGroup}>
          <View style={[styles.iconBox, isBreach ? styles.iconBoxBreach : styles.iconBoxNormal]}>
            <MaterialIcons
              name={isBreach ? 'shield' : 'sensors'}
              size={20}
              color={isBreach ? THEME.colors.error : THEME.colors.primary}
            />
          </View>

          <View style={styles.titleColumn}>
            {isBreach ? (
              <>
                <View style={styles.breachRow}>
                  <View style={styles.pulsingRedDot} />
                  <Text style={styles.breachSubtext}>CRITICAL BREACH IN PROGRESS</Text>
                </View>
                <View style={styles.incidentRow}>
                  <Text style={styles.titleText}>INCIDENT TELEMETRY</Text>
                  <View style={styles.deviceTag}>
                    <Text style={styles.deviceTagText}>#9042</Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.eyebrowText}>DELTA ASSET GUARD</Text>
                <Text style={styles.titleText}>Beacon Scanner</Text>
              </>
            )}
          </View>
        </View>

        {/* Right Status / Action Block */}
        <View style={styles.rightGroup}>
          {isBreach ? (
            <TouchableOpacity
              style={styles.muteButton}
              onPress={toggleMute}
              activeOpacity={0.7}
              accessibilityLabel="Toggle audio mute"
            >
              <MaterialIcons
                name={isMuted ? 'volume-off' : 'volume-up'}
                size={20}
                color={THEME.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.bleBadge}>
              <View style={styles.pulsingGoldDot} />
              <Text style={styles.bleText}>BLE RDY</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={onProfilePress}
            activeOpacity={0.8}
            accessibilityLabel="Operator Profile"
          >
            <MaterialIcons name="person" size={18} color={THEME.colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    backgroundColor: 'rgba(6, 14, 32, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    zIndex: 50,
  },
  headerContainerBreach: {
    backgroundColor: 'rgba(11, 19, 38, 0.96)',
    borderBottomColor: 'rgba(239, 68, 68, 0.2)',
  },
  contentRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxNormal: {
    backgroundColor: THEME.colors.surfaceContainerHigh,
  },
  iconBoxBreach: {
    backgroundColor: 'rgba(147, 0, 10, 0.35)',
  },
  titleColumn: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.outline,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.onSurface,
    letterSpacing: -0.2,
  },
  breachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulsingRedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: THEME.colors.criticalRed,
  },
  breachSubtext: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.criticalRed,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceTag: {
    backgroundColor: 'rgba(233, 195, 73, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  deviceTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.secondary,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
  },
  pulsingGoldDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: THEME.colors.secondary,
  },
  bleText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.secondary,
    letterSpacing: 0.4,
  },
  muteButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceContainer,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

