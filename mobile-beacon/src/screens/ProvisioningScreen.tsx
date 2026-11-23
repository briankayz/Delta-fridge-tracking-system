import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useBeacon, AVAILABLE_RETAILERS } from '../context/BeaconContext';

export const ProvisioningScreen: React.FC = () => {
  const {
    deviceId,
    retailer,
    geofenceRadius,
    setGeofenceRadius,
    commitProvisioning,
    isProvisioningInProgress,
    setCurrentScreen,
  } = useBeacon();

  const [isRetailerModalOpen, setIsRetailerModalOpen] = useState(false);
  const [isLockedSuccess, setIsLockedSuccess] = useState(false);

  const getRadiusZoneLabel = (radius: number) => {
    if (radius <= 30) return 'Strict Display Zone';
    if (radius <= 75) return 'Store Floor Zone';
    if (radius <= 150) return 'Premise Perimeter';
    return 'Wide Logistic Zone';
  };

  const handleArmBeacon = async () => {
    await commitProvisioning();
    setIsLockedSuccess(true);
    setTimeout(() => {
      setIsLockedSuccess(false);
      setCurrentScreen('active');
    }, 1200);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Hardware Telemetry Header Section */}
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.titleWithLogo}>
              {/* Minimalist Geometric Delta Logo */}
              <View style={styles.logoBox}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 3L2 21H22L12 3Z"
                    stroke={THEME.colors.onSurface}
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                  <Path
                    d="M12 9L6.5 19H17.5L12 9Z"
                    fill={THEME.colors.onSurface}
                    fillOpacity={0.15}
                    stroke={THEME.colors.onSurface}
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                  />
                </Svg>
              </View>

              <View style={styles.headerTextGroup}>
                <Text style={styles.brandSubtitle}>COLD-CHAIN SENTINEL</Text>
                <Text style={styles.beaconTitle}>Sentinel Beacon #9042</Text>
              </View>
            </View>

            {/* Mode Badge with Cyan Pulse */}
            <View style={styles.provisioningBadge}>
              <View style={styles.cyanPulseDot} />
              <Text style={styles.provisioningBadgeText}>PROVISIONING</Text>
            </View>
          </View>

          {/* Hardware Metadata Pill Box */}
          <View style={styles.metadataPillBox}>
            <View style={styles.metaItem}>
              <MaterialIcons name="memory" size={14} color={THEME.colors.secondary} />
              <Text style={styles.metaVersionText}>v2.4.1</Text>
            </View>
            <Text style={styles.metaDivider}>•</Text>
            <Text style={styles.metaDeviceText}>{deviceId}</Text>
            <Text style={styles.metaDivider}>•</Text>
            <Text style={styles.metaImeiText}>IMEI: 864920041289123</Text>
          </View>
        </View>

        {/* Merchant & Operational Profile Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <MaterialIcons name="storefront" size={20} color={THEME.colors.secondary} />
              <Text style={styles.sectionTitleText}>MERCHANT & OPERATIONAL PROFILE</Text>
            </View>
            <View style={styles.clusterBadge}>
              <Text style={styles.clusterBadgeText}>HARARE CLUSTER</Text>
            </View>
          </View>

          {/* Retailer Assignment Selector */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ASSIGN TO RETAILER</Text>
            <TouchableOpacity
              style={styles.retailerSelectorBox}
              activeOpacity={0.8}
              onPress={() => setIsRetailerModalOpen(true)}
            >
              <View style={styles.retailerLeftInfo}>
                <View style={styles.retailerPinBox}>
                  <MaterialIcons name="location-on" size={18} color={THEME.colors.primary} />
                </View>
                <View style={styles.retailerDetails}>
                  <View style={styles.retailerNameRow}>
                    <Text style={styles.retailerNameText}>{retailer.name}</Text>
                    <MaterialIcons name="verified" size={16} color={THEME.colors.secondary} />
                  </View>
                  <View style={styles.retailerSubRow}>
                    <View style={styles.siteCodeChip}>
                      <Text style={styles.siteCodeText}>Site: {retailer.site_code}</Text>
                    </View>
                    <Text style={styles.siteZoneText}>{retailer.cluster}</Text>
                  </View>
                </View>
              </View>
              <MaterialIcons name="expand-more" size={22} color={THEME.colors.outline} />
            </TouchableOpacity>
          </View>

          {/* Geofence Radius Slider Box */}
          <View style={styles.geofenceBox}>
            <View style={styles.geofenceHeader}>
              <Text style={styles.fieldLabel}>ASSIGNED GEOFENCE RADIUS</Text>
              <Text style={styles.geofenceValueText}>
                {geofenceRadius}m ({getRadiusZoneLabel(geofenceRadius)})
              </Text>
            </View>

            {/* Range Adjustment Control */}
            <View style={styles.sliderControlContainer}>
              <TouchableOpacity
                style={styles.sliderStepBtn}
                onPress={() => setGeofenceRadius(Math.max(25, geofenceRadius - 5))}
              >
                <MaterialIcons name="remove" size={16} color={THEME.colors.onSurface} />
              </TouchableOpacity>

              <View style={styles.sliderTrackBackground}>
                <View
                  style={[
                    styles.sliderTrackFill,
                    {
                      width: `${Math.min(100, Math.max(0, ((geofenceRadius - 25) / (250 - 25)) * 100))}%`,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      left: `${Math.min(94, Math.max(0, ((geofenceRadius - 25) / (250 - 25)) * 100))}%`,
                    },
                  ]}
                />
              </View>

              <TouchableOpacity
                style={styles.sliderStepBtn}
                onPress={() => setGeofenceRadius(Math.min(250, geofenceRadius + 5))}
              >
                <MaterialIcons name="add" size={16} color={THEME.colors.onSurface} />
              </TouchableOpacity>
            </View>

            {/* Scale Markings */}
            <View style={styles.scaleRow}>
              <TouchableOpacity onPress={() => setGeofenceRadius(25)}>
                <Text style={styles.scaleText}>25m (Boutique)</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setGeofenceRadius(50)}>
                <Text style={styles.scaleTextHighlight}>Strict 50m</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setGeofenceRadius(250)}>
                <Text style={styles.scaleText}>250m (Warehouse)</Text>
              </TouchableOpacity>
            </View>

            {/* Displacement Footnote */}
            <View style={styles.geofenceFootnote}>
              <MaterialIcons name="crisis-alert" size={15} color={THEME.colors.criticalRed} />
              <Text style={styles.footnoteText}>
                Displacement &gt; <Text style={styles.boldWhiteText}>{geofenceRadius}m</Text> triggers instant lock and field alert.
              </Text>
            </View>
          </View>

          {/* Operating Hours Timeline & Bar */}
          <View style={styles.operatingHoursSection}>
            <View style={styles.operatingHoursHeader}>
              <Text style={styles.fieldLabel}>OPERATING SHIFT WINDOWS</Text>
              <Text style={styles.operatingHoursSubtitle}>15h Active / 9h Lockdown</Text>
            </View>

            <View style={styles.shiftBoxesRow}>
              <View style={styles.shiftBox}>
                <View>
                  <Text style={styles.shiftLabel}>Store Open</Text>
                  <Text style={styles.shiftTime}>07:00</Text>
                </View>
                <MaterialIcons name="wb-sunny" size={20} color={THEME.colors.primary} />
              </View>

              <View style={styles.shiftBox}>
                <View>
                  <Text style={styles.shiftLabel}>Store Close</Text>
                  <Text style={styles.shiftTime}>22:00</Text>
                </View>
                <MaterialIcons name="bedtime" size={20} color={THEME.colors.tertiary} />
              </View>
            </View>

            {/* Segmented Day Schedule Ribbon */}
            <View style={styles.scheduleRibbonContainer}>
              <View style={styles.scheduleRibbonBar}>
                <View style={[styles.ribbonSegment, { width: '29.1%', backgroundColor: THEME.colors.surfaceContainerHighest }]} />
                <View style={[styles.ribbonSegment, { width: '62.5%', backgroundColor: THEME.colors.primary }]} />
                <View style={[styles.ribbonSegment, { width: '8.4%', backgroundColor: THEME.colors.surfaceContainerHighest }]} />
              </View>

              <View style={styles.ribbonLabelsRow}>
                <Text style={styles.ribbonLabel}>00:00</Text>
                <Text style={styles.ribbonLabelPrimary}>07:00 • Daytime Floor Ops</Text>
                <Text style={styles.ribbonLabelError}>22:00 • Lockdown</Text>
                <Text style={styles.ribbonLabel}>24:00</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Telemetry Sensor Pre-Flight Diagnostics (2x2 Grid) */}
        <View style={styles.diagnosticsSection}>
          <View style={styles.diagnosticsHeaderRow}>
            <View style={styles.diagnosticsTitleGroup}>
              <MaterialIcons name="fact-check" size={20} color={THEME.colors.primary} />
              <Text style={styles.sectionTitleText}>TELEMETRY PRE-FLIGHT DIAGNOSTICS</Text>
            </View>
            <Text style={styles.passedText}>4/4 Passed</Text>
          </View>

          <View style={styles.diagnosticsGrid}>
            {/* Card 1: GPS Module */}
            <View style={styles.diagnosticCard}>
              <View style={styles.diagCardHeader}>
                <MaterialIcons name="my-location" size={20} color={THEME.colors.primary} />
                <View style={styles.diagBadge}>
                  <View style={styles.greenPulseDot} />
                  <Text style={styles.diagBadgeText}>12 Sats</Text>
                </View>
              </View>
              <View>
                <Text style={styles.diagLabel}>GNSS ACCURACY</Text>
                <Text style={styles.diagValue}>±3m</Text>
                <Text style={styles.diagDetails}>
                  Lat: -17.7942° S{'\n'}
                  Lon: 31.0378° E{'\n'}
                  <Text style={{ color: THEME.colors.secondary }}>HDOP: 0.8 (Optimal)</Text>
                </Text>
              </View>
            </View>

            {/* Card 2: Accelerometer (MPU6050) */}
            <View style={styles.diagnosticCard}>
              <View style={styles.diagCardHeader}>
                <MaterialIcons name="screen-rotation" size={20} color={THEME.colors.secondary} />
                <View style={styles.diagBadge}>
                  <View style={styles.greenPulseDot} />
                  <Text style={styles.diagBadgeText}>Calibrated</Text>
                </View>
              </View>
              <View>
                <Text style={styles.diagLabel}>VECTOR G-FORCE</Text>
                <Text style={styles.diagValue}>0.01g</Text>
                <Text style={styles.diagDetails}>
                  Tilt Angle: 0.4°{'\n'}
                  Idle Rest Validated{'\n'}
                  <Text style={{ color: THEME.colors.primary }}>Motion Guard Armed</Text>
                </Text>
              </View>
            </View>

            {/* Card 3: Supply Feed */}
            <View style={styles.diagnosticCard}>
              <View style={styles.diagCardHeader}>
                <MaterialIcons name="bolt" size={20} color={THEME.colors.statusSafe} />
                <View style={styles.diagBadge}>
                  <View style={styles.greenPulseDot} />
                  <Text style={styles.diagBadgeText}>Mains AC</Text>
                </View>
              </View>
              <View>
                <Text style={styles.diagLabel}>SUPPLY FEED</Text>
                <Text style={styles.diagValue}>234V</Text>
                <Text style={styles.diagDetails}>
                  Grid: 50.0 Hz Clean{'\n'}
                  Li-ion Backup: 98%{'\n'}
                  <Text style={{ color: THEME.colors.tertiary }}>Unplug Trip Active</Text>
                </Text>
              </View>
            </View>

            {/* Card 4: Cellular Link */}
            <View style={styles.diagnosticCard}>
              <View style={styles.diagCardHeader}>
                <MaterialIcons name="signal-cellular-alt" size={20} color={THEME.colors.primary} />
                <View style={styles.diagBadge}>
                  <View style={styles.greenPulseDot} />
                  <Text style={styles.diagBadgeText}>-72 dBm</Text>
                </View>
              </View>
              <View>
                <Text style={styles.diagLabel}>CELLULAR LINK</Text>
                <Text style={styles.diagValue}>4G LTE</Text>
                <Text style={styles.diagDetails}>
                  APN: iot.deltabev.co{'\n'}
                  Encrypted TLS 1.3{'\n'}
                  <Text style={{ color: THEME.colors.onSurface }}>5-Min Heartbeat</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Physical Asset Mounting Preview Spot */}
        <View style={styles.mountingCard}>
          <View style={styles.mountingThumbBox}>
            <MaterialIcons name="developer-board" size={30} color={THEME.colors.primary} />
          </View>
          <View style={styles.mountingInfo}>
            <Text style={styles.mountingEyebrow}>PHYSICAL ASSET MOUNTING</Text>
            <Text style={styles.mountingTitle}>Showcase Bay 02 Bracket</Text>
            <View style={styles.mountingSealRow}>
              <MaterialIcons name="done-all" size={13} color={THEME.colors.statusSafe} />
              <Text style={styles.mountingSealText}>Magnetic Tamper Seal Verified</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.cameraBtn} activeOpacity={0.7}>
            <MaterialIcons name="photo-camera" size={18} color={THEME.colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {/* Pinned Operational Action Dock */}
        <View style={styles.actionDock}>
          <TouchableOpacity
            style={[
              styles.lockBtn,
              isProvisioningInProgress && styles.lockBtnCommitting,
              isLockedSuccess && styles.lockBtnSuccess,
            ]}
            onPress={handleArmBeacon}
            disabled={isProvisioningInProgress || isLockedSuccess}
            activeOpacity={0.85}
          >
            {isProvisioningInProgress ? (
              <>
                <ActivityIndicator size="small" color={THEME.colors.onSecondaryContainer} />
                <Text style={styles.lockBtnTextCommitting}>COMMITTING CRYPTO KEY...</Text>
              </>
            ) : isLockedSuccess ? (
              <>
                <MaterialIcons name="lock" size={20} color="#060e20" />
                <Text style={styles.lockBtnTextSuccess}>SENTINEL ACTIVE & GEOFENCED</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="lock-open" size={20} color={THEME.colors.onPrimaryContainer} />
                <Text style={styles.lockBtnText}>LOCK & START SENTINEL TRACKER</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dockFootnote}>
            <MaterialIcons name="verified-user" size={13} color={THEME.colors.outline} />
            <Text style={styles.dockFootnoteText}>
              Arming locks hardware module config & starts 5-min telemetry loop.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Retailer Selector Modal */}
      <Modal visible={isRetailerModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Assigned Retailer</Text>
              <TouchableOpacity onPress={() => setIsRetailerModalOpen(false)}>
                <MaterialIcons name="close" size={22} color={THEME.colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {AVAILABLE_RETAILERS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.modalRetailerRow,
                    item.id === retailer.id && styles.modalRetailerRowSelected,
                  ]}
                  onPress={() => {
                    setIsRetailerModalOpen(false);
                  }}
                >
                  <View style={styles.modalRetailerIconBox}>
                    <MaterialIcons
                      name="store"
                      size={20}
                      color={item.id === retailer.id ? THEME.colors.primary : THEME.colors.outline}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalRetailerName}>{item.name}</Text>
                    <Text style={styles.modalRetailerCode}>
                      {item.site_code} • {item.cluster}
                    </Text>
                  </View>
                  {item.id === retailer.id && (
                    <MaterialIcons name="check" size={20} color={THEME.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  headerCard: {
    backgroundColor: THEME.colors.surfaceContainerHigh,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleWithLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flexDirection: 'column',
    flex: 1,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  beaconTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME.colors.onSurface,
    letterSpacing: -0.2,
  },
  provisioningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(156, 202, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 6,
  },
  cyanPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
  },
  provisioningBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
    textTransform: 'uppercase',
  },
  metadataPillBox: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaVersionText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: THEME.colors.secondary,
  },
  metaDivider: {
    color: THEME.colors.outlineVariant,
    fontSize: 10,
  },
  metaDeviceText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: THEME.colors.onSurface,
  },
  metaImeiText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: THEME.colors.outline,
  },
  sectionCard: {
    backgroundColor: THEME.colors.surfaceContainer,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.onSurface,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  clusterBadge: {
    backgroundColor: 'rgba(233, 195, 73, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  clusterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.secondary,
    textTransform: 'uppercase',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.onSurfaceVariant,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  retailerSelectorBox: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  retailerLeftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  retailerPinBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retailerDetails: {
    flex: 1,
  },
  retailerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  retailerNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.onSurface,
  },
  retailerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
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
  siteZoneText: {
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
  },
  geofenceBox: {
    backgroundColor: 'rgba(6, 14, 32, 0.6)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  geofenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  geofenceValueText: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  sliderControlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 6,
  },
  sliderStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderTrackBackground: {
    flex: 1,
    height: 6,
    backgroundColor: THEME.colors.surfaceContainerHigh,
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderTrackFill: {
    height: 6,
    backgroundColor: THEME.colors.primary,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: THEME.colors.primary,
    top: -5,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  scaleText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: THEME.colors.outline,
  },
  scaleTextHighlight: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: THEME.colors.secondary,
  },
  geofenceFootnote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  footnoteText: {
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
    flex: 1,
  },
  boldWhiteText: {
    color: THEME.colors.onSurface,
    fontWeight: '700',
  },
  operatingHoursSection: {
    marginTop: 4,
  },
  operatingHoursHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  operatingHoursSubtitle: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: THEME.colors.secondary,
  },
  shiftBoxesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  shiftBox: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shiftLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.outline,
    textTransform: 'uppercase',
  },
  shiftTime: {
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: '600',
    color: THEME.colors.onSurface,
    marginTop: 2,
  },
  scheduleRibbonContainer: {
    flexDirection: 'column',
    gap: 4,
  },
  scheduleRibbonBar: {
    height: 10,
    width: '100%',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  ribbonSegment: {
    height: '100%',
  },
  ribbonLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  ribbonLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: THEME.colors.outline,
  },
  ribbonLabelPrimary: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: THEME.colors.primary,
    fontWeight: '600',
  },
  ribbonLabelError: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: THEME.colors.criticalRed,
    fontWeight: '600',
  },
  diagnosticsSection: {
    marginBottom: 16,
  },
  diagnosticsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  diagnosticsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passedText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: THEME.colors.onSurfaceVariant,
  },
  diagnosticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  diagnosticCard: {
    width: '48.3%',
    backgroundColor: THEME.colors.surfaceContainer,
    padding: 12,
    borderRadius: 8,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  diagCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  diagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    gap: 4,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.statusSafe,
  },
  diagBadgeText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: THEME.colors.onSurface,
  },
  diagLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.outline,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  diagValue: {
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: THEME.colors.onSurface,
    marginTop: 1,
  },
  diagDetails: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: THEME.colors.onSurfaceVariant,
    marginTop: 4,
    lineHeight: 14,
  },
  mountingCard: {
    backgroundColor: THEME.colors.surfaceContainerLow,
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mountingThumbBox: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mountingInfo: {
    flex: 1,
  },
  mountingEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.outline,
    textTransform: 'uppercase',
  },
  mountingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.onSurface,
    marginTop: 1,
  },
  mountingSealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  mountingSealText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: THEME.colors.statusSafe,
  },
  cameraBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDock: {
    marginTop: 6,
    gap: 8,
  },
  lockBtn: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    backgroundColor: THEME.colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: THEME.colors.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  lockBtnCommitting: {
    backgroundColor: THEME.colors.secondary,
  },
  lockBtnSuccess: {
    backgroundColor: THEME.colors.statusSafe,
  },
  lockBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.onPrimaryContainer,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  lockBtnTextCommitting: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.onSecondaryContainer,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  lockBtnTextSuccess: {
    fontSize: 14,
    fontWeight: '700',
    color: '#060e20',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dockFootnote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  dockFootnoteText: {
    fontSize: 11,
    color: THEME.colors.outline,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: THEME.colors.surfaceContainerHigh,
    borderRadius: 12,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  modalRetailerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 12,
    marginBottom: 4,
  },
  modalRetailerRowSelected: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
  },
  modalRetailerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRetailerName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.onSurface,
  },
  modalRetailerCode: {
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
    marginTop: 1,
  },
});

