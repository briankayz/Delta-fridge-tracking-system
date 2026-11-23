import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useBeacon } from '../context/BeaconContext';

export const BottomNavBar: React.FC = () => {
  const { currentScreen, activeTab, setActiveTab, setCurrentScreen } = useBeacon();
  const isBreach = currentScreen === 'breach';

  const normalTabs = [
    {
      id: 'scan' as const,
      label: 'Scan',
      icon: 'radar' as const,
      screen: 'setup' as const,
    },
    {
      id: 'queue' as const,
      label: 'Queue',
      icon: 'checklist' as const,
      screen: 'setup' as const,
    },
    {
      id: 'telemetry' as const,
      label: 'Telemetry',
      icon: 'query-stats' as const,
      screen: 'active' as const,
    },
    {
      id: 'security' as const,
      label: 'Security',
      icon: 'vpn-key' as const,
      screen: 'active' as const,
    },
  ];

  const breachTabs = [
    {
      id: 'telemetry' as const,
      label: 'Telemetry',
      icon: 'emergency' as const,
      screen: 'breach' as const,
    },
    {
      id: 'scan' as const,
      label: 'Sensors',
      icon: 'radar' as const,
      screen: 'breach' as const,
    },
    {
      id: 'queue' as const,
      label: 'Controls',
      icon: 'lock-reset' as const,
      screen: 'breach' as const,
    },
    {
      id: 'security' as const,
      label: 'Logs',
      icon: 'security-update-warning' as const,
      screen: 'breach' as const,
    },
  ];

  const tabs = isBreach ? breachTabs : normalTabs;

  return (
    <View style={[styles.navContainer, isBreach && styles.navContainerBreach]}>
      <View style={styles.tabsRow}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabButton}
              activeOpacity={0.7}
              onPress={() => {
                setActiveTab(tab.id);
                if (tab.screen !== currentScreen) {
                  setCurrentScreen(tab.screen);
                }
              }}
            >
              <MaterialIcons
                name={tab.icon}
                size={22}
                color={
                  isActive
                    ? isBreach
                      ? THEME.colors.criticalRed
                      : THEME.colors.primary
                    : THEME.colors.onSurfaceVariant
                }
              />
              <Text
                style={[
                  styles.tabLabel,
                  isActive &&
                    (isBreach ? styles.tabLabelBreachActive : styles.tabLabelActive),
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(6, 14, 32, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 20,
    paddingTop: 8,
    zIndex: 50,
  },
  navContainerBreach: {
    backgroundColor: 'rgba(11, 19, 38, 0.96)',
    borderTopColor: 'rgba(239, 68, 68, 0.2)',
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 52,
  },
  tabButton: {
    minWidth: 54,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.onSurfaceVariant,
    marginTop: 3,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  tabLabelBreachActive: {
    color: THEME.colors.criticalRed,
    fontWeight: '700',
  },
});

