import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BigButton } from './ui';
import { C, R, S, T } from '../theme';

/** Accepts a bare beacon ID or a URL whose last path segment is the ID. */
export function beaconIdFrom(data: string): string | null {
  const last = data.trim().split(/[/?#=]/).filter(Boolean).pop() ?? '';
  return /^[A-Za-z0-9_-]{3,64}$/.test(last) ? last.toUpperCase() : null;
}

export const QrScanner: React.FC<{ onScanned: (id: string) => void; onCancel: () => void }> = ({ onScanned, onCancel }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View style={{ gap: S.md }}>
        <Text style={T.body}>Allow the camera to scan the beacon’s QR code.</Text>
        <BigButton label="Allow camera" icon="camera" onPress={() => void requestPermission()} />
        <BigButton label="Type the ID instead" variant="secondary" onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={{ gap: S.md }}>
      <View style={styles.frame}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            const id = beaconIdFrom(data);
            if (id && !done.current) {
              done.current = true;
              onScanned(id);
            }
          }}
        />
        <View style={styles.target} pointerEvents="none" />
      </View>
      <Text style={[T.small, { textAlign: 'center' }]}>Point at the QR sticker on the beacon.</Text>
      <BigButton label="Cancel" variant="secondary" onPress={onCancel} />
    </View>
  );
};

const styles = StyleSheet.create({
  frame: { height: 300, borderRadius: R.xl, overflow: 'hidden', backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  target: { width: 200, height: 200, borderWidth: 3, borderColor: C.gold, borderRadius: R.lg },
});
