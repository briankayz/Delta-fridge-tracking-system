import React, { useState } from 'react';
import { StyleSheet, View, Modal, Text, TouchableOpacity, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { BeaconProvider, useBeacon } from './src/context/BeaconContext';
import { Header } from './src/components/Header';
import { BottomNavBar } from './src/components/BottomNavBar';
import { ProvisioningScreen } from './src/screens/ProvisioningScreen';
import { ActiveTelemetryScreen } from './src/screens/ActiveTelemetryScreen';
import { EmergencyBreachScreen } from './src/screens/EmergencyBreachScreen';
import { THEME } from './src/constants/theme';

const MainNavigator: React.FC = () => {
  const { currentScreen, setCurrentScreen, isDisplaced, resetDisplacement, simulateDisplacement } =
    useBeacon();
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Top Header */}
      <Header onProfilePress={() => setProfileModalVisible(true)} />

      {/* Primary Screen View */}
      <View style={styles.screenContainer}>
        {currentScreen === 'setup' && <ProvisioningScreen />}
        {currentScreen === 'active' && <ActiveTelemetryScreen />}
        {currentScreen === 'breach' && <EmergencyBreachScreen />}
      </View>

      {/* Bottom Navigation Dock */}
      <BottomNavBar />

      {/* Operator Diagnostics & Profile Modal */}
      <Modal visible={profileModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.profileModalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.avatarRow}>
                <View style={styles.avatarBig}>
                  <MaterialIcons name="person" size={24} color={THEME.colors.onPrimary} />
                </View>
                <View>
                  <Text style={styles.operatorName}>Tendai Chiwenga</Text>
                  <Text style={styles.operatorRole}>Delta Field Logistics Engineer #410</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
                <MaterialIcons name="close" size={22} color={THEME.colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              <Text style={styles.sheetSectionTitle}>QUICK NAVIGATION / DEMO SHORTCUTS</Text>

              <TouchableOpacity
                style={styles.sheetActionRow}
                onPress={() => {
                  setProfileModalVisible(false);
                  setCurrentScreen('setup');
                }}
              >
                <MaterialIcons name="settings" size={20} color={THEME.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionRowTitle}>1. Setup & Provisioning Screen</Text>
                  <Text style={styles.actionRowSub}>Geofence radius, Retailer & Pre-flight self-test</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={THEME.colors.outline} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetActionRow}
                onPress={() => {
                  setProfileModalVisible(false);
                  resetDisplacement();
                  setCurrentScreen('active');
                }}
              >
                <MaterialIcons name="radar" size={20} color={THEME.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionRowTitle}>2. Active Telemetry Screen</Text>
                  <Text style={styles.actionRowSub}>Live radar, MPU6050 waveforms & AC 234V</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={THEME.colors.outline} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetActionRow}
                onPress={() => {
                  setProfileModalVisible(false);
                  simulateDisplacement();
                }}
              >
                <MaterialIcons name="notification-important" size={20} color={THEME.colors.criticalRed} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionRowTitle, { color: THEME.colors.criticalRed }]}>
                    3. Simulate Displacement Breach
                  </Text>
                  <Text style={styles.actionRowSub}>38.5 km/h transit, geofence breached alert</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={THEME.colors.outline} />
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={styles.closeSheetBtn}
              onPress={() => setProfileModalVisible(false)}
            >
              <Text style={styles.closeSheetText}>Close Diagnostics Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <BeaconProvider>
        <MainNavigator />
      </BeaconProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
  },
  screenContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  profileModalContent: {
    backgroundColor: THEME.colors.surfaceContainerHigh,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBig: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorName: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  operatorRole: {
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
    marginTop: 2,
  },
  sheetSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.outline,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  sheetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceContainer,
    marginBottom: 8,
  },
  actionRowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.onSurface,
  },
  actionRowSub: {
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
    marginTop: 2,
  },
  closeSheetBtn: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  closeSheetText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.onSurfaceVariant,
  },
});

