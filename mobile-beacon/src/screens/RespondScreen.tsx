import React, { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { api, ApiError } from '../api/client';
import type { Incident } from '../api/types';
import { useSession } from '../state/session';
import { Banner, BigButton, Card, Field, Row, Screen, SectionTitle, StatusCard } from '../components/ui';
import { currentFix, directionsUrl, distanceLabel, distanceM, Fix } from '../services/location';
import { KIND_TITLE, minutesOpen } from '../status';
import { C, S, T } from '../theme';
import { t } from '../i18n';

const KIND_ICON = { displacement: 'shield-alert', power: 'power-plug-off', signal_lost: 'access-point-off' } as const;

/** List of open alerts, nearest first. */
export const RespondScreen: React.FC<{ onCount: (n: number) => void }> = ({ onCount }) => {
  const [items, setItems] = useState<Incident[] | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<Incident | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.openIncidents();
      setItems(list);
      onCount(list.filter((i) => i.kind === 'displacement').length);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.cantReachServer);
    }
  }, [onCount]);

  useEffect(() => {
    void load();
    currentFix().then(setFix);
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [load]);

  if (open) return <IncidentDetail incident={open} fix={fix} onBack={() => (setOpen(null), void load())} />;

  const sorted = [...(items ?? [])].sort(
    (a, b) =>
      Number(b.kind === 'displacement') - Number(a.kind === 'displacement') ||
      distanceM(fix, a.position?.lat, a.position?.lng) - distanceM(fix, b.position?.lat, b.position?.lng)
  );

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await Promise.all([load(), currentFix().then(setFix)]);
            setRefreshing(false);
          }}
        />
      }
    >
      <Text style={T.title}>{t.respondTitle}</Text>
      {error && <Banner tone="offline" text={error} />}
      {items && sorted.length === 0 && <StatusCard tone="safe" title="All clear" detail={t.respondEmpty} />}
      {sorted.map((i) => {
        const dist = distanceLabel(fix, i.position?.lat, i.position?.lng);
        const tone = i.kind === 'displacement' ? C.danger : i.kind === 'power' ? C.warn : C.offline;
        return (
          <Card key={i.id} style={{ paddingVertical: S.sm, borderColor: i.kind === 'displacement' ? '#FECACA' : C.line }}>
            <Row
              icon={KIND_ICON[i.kind]}
              tone={tone}
              title={`${KIND_TITLE[i.kind]} · ${i.retailer_name ?? i.asset_id}`}
              detail={[dist ? `${dist} ${t.away}` : null, `${t.openFor} ${minutesOpen(i.opened_at)}`, i.assigned_name ? `Assigned: ${i.assigned_name}` : null]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => setOpen(i)}
            />
          </Card>
        );
      })}
    </Screen>
  );
};

/** One alert: where it is, how to get there, and three big outcome buttons. */
const IncidentDetail: React.FC<{ incident: Incident; fix: Fix | null; onBack: () => void }> = ({ incident, fix, onBack }) => {
  const { refreshPending } = useSession();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: 'safe' | 'warn' | 'danger'; text: string } | null>(null);
  const pos = incident.position ?? { lat: incident.origin.lat, lng: incident.origin.lng };
  const dist = distanceLabel(fix, pos.lat, pos.lng);
  const theft = incident.kind === 'displacement';

  const report = async (outcome: 'found' | 'not_found' | 'recovered' | 'authorized') => {
    setBusy(outcome);
    try {
      const here = await currentFix(4000);
      const r = await api.fieldUpdate(incident.id, { outcome, note: note.trim() || undefined, lat: here?.lat, lng: here?.lng });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setResult(r === 'sent' ? { tone: 'safe', text: t.sent } : { tone: 'warn', text: t.queued });
      await refreshPending();
      if (outcome === 'recovered' || outcome === 'authorized') setTimeout(onBack, 1200);
    } catch (err) {
      setResult({ tone: 'danger', text: err instanceof ApiError && err.status === 409 ? t.alreadyClosed : (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Row icon="arrow-left" title="Back to alerts" onPress={onBack} right={<View />} />
      <StatusCard
        tone={theft ? 'danger' : incident.kind === 'power' ? 'warn' : 'offline'}
        title={KIND_TITLE[incident.kind]}
        detail={`${incident.retailer_name ?? ''} · ${incident.region ?? ''}. ${incident.reasons[0]?.detail ?? ''}`}
      />

      <Card>
        <Text style={T.subtitle}>{theft ? 'Cooler’s last position' : 'Store'}</Text>
        <Text style={T.body}>
          {dist ? `${dist} from you` : 'Distance unknown (turn on location)'} · {t.openFor.toLowerCase()} {minutesOpen(incident.opened_at)}
        </Text>
        <BigButton label={t.directions} icon="navigation-variant" variant="primary" onPress={() => void Linking.openURL(directionsUrl(pos.lat, pos.lng))} />
        {incident.retailer_contact.phone && (
          <BigButton
            label={t.callStore}
            hint={`${incident.retailer_contact.name ?? ''} ${incident.retailer_contact.phone}`}
            icon="phone"
            variant="secondary"
            onPress={() => void Linking.openURL(`tel:${incident.retailer_contact.phone!.replace(/\s/g, '')}`)}
          />
        )}
      </Card>

      <SectionTitle>{t.whatDidYouFind}</SectionTitle>
      {result && <Banner tone={result.tone} text={result.text} />}
      <Field label={t.addNote} value={note} onChangeText={setNote} multiline style={{ minHeight: 72, textAlignVertical: 'top', paddingTop: S.sm }} />
      {theft ? (
        <>
          <BigButton label={t.recovered} hint="Closes the alert" icon="check-decagram" variant="safe" busy={busy === 'recovered'} onPress={() => void report('recovered')} />
          <BigButton label={t.foundIt} hint="Cooler located, still handling" icon="map-marker-check" variant="secondary" busy={busy === 'found'} onPress={() => void report('found')} />
          <BigButton label={t.authorisedMove} hint="Closes the alert and updates the cooler’s home" icon="clipboard-check" variant="secondary" busy={busy === 'authorized'} onPress={() => void report('authorized')} />
          <BigButton label={t.cantFind} hint="Tells the control room to escalate" icon="map-marker-question" variant="danger" busy={busy === 'not_found'} onPress={() => void report('not_found')} />
        </>
      ) : (
        <>
          <BigButton label={t.foundIt} hint="Report what you see on site" icon="map-marker-check" variant="primary" busy={busy === 'found'} onPress={() => void report('found')} />
          <BigButton label={t.cantFind} icon="map-marker-question" variant="secondary" busy={busy === 'not_found'} onPress={() => void report('not_found')} />
        </>
      )}
      <Text style={[T.small, { textAlign: 'center' }]}>Alert {incident.id}</Text>
    </Screen>
  );
};
