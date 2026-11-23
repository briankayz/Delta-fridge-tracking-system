import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../state/session';
import { ApiError } from '../api/client';
import { Banner, BigButton, DeltaMark, Field } from '../components/ui';
import { C, S, T } from '../theme';
import { t } from '../i18n';

export const SignInScreen: React.FC = () => {
  const { signIn, server, setServer, meta } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editServer, setEditServer] = useState(false);
  const [serverText, setServerText] = useState(server);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editServer && serverText !== server) await setServer(serverText);
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.cantReachServer);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.navyDeep }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.top}>
        <DeltaMark size={56} />
        <Text style={styles.brand}>Delta</Text>
        <Text style={styles.product}>ASSET GUARD</Text>
        <View style={styles.rule} />
        <Text style={styles.tagline}>Field app for installing beacons and responding to cooler alerts.</Text>
      </View>

      <View style={styles.sheet}>
        <Text style={T.title}>{t.signIn}</Text>
        <Field label={t.email} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" />
        <Field label={t.password} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
        {editServer && (
          <Field label={t.serverAddress} value={serverText} onChangeText={setServerText} autoCapitalize="none" keyboardType="url" />
        )}
        {error && <Banner tone="danger" text={error} />}
        <BigButton label={busy ? t.signingIn : t.signIn} icon="login" onPress={submit} busy={busy} disabled={!email || !password} />
        <Pressable accessibilityRole="button" onPress={() => setEditServer((v) => !v)} style={{ paddingVertical: S.sm }}>
          <Text style={[T.small, { textAlign: 'center' }]}>
            {server.replace(/^https?:\/\//, '')} · <Text style={{ color: C.navy, fontWeight: '600' }}>{t.changeServer}</Text>
          </Text>
        </Pressable>
        {meta?.demo_mode && (
          <Text style={[T.small, { textAlign: 'center', color: C.goldText }]}>Demo server: try tech@delta.demo or security@delta.demo</Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  top: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl, gap: S.xs },
  brand: { color: C.white, fontSize: 34, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }), marginTop: S.sm },
  product: { color: C.gold, fontSize: 13, letterSpacing: 3, fontWeight: '600' },
  rule: { height: 2, width: 48, backgroundColor: C.gold, marginVertical: S.md },
  tagline: { color: '#DCE6F2', fontSize: 15, textAlign: 'center', maxWidth: 300 },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: S.xl, gap: S.md },
});
