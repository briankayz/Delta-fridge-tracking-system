// Outbound alerts. Every message is recorded in the `notifications` outbox; delivery channels
// are enabled by configuration:
//   - always:            'console' (visible in the dashboard's notification log)
//   - NOTIFY_WEBHOOK_URL: JSON POST (Microsoft Teams workflow, Slack, or any integration endpoint)
//   - TWILIO_* :          SMS and/or WhatsApp to on-duty staff with a phone number
import { Config } from '../config.ts';
import { Db } from '../db/index.ts';
import { AssetState, Incident } from '../types.ts';
import { log } from '../util.ts';

const KIND_TITLE: Record<Incident['kind'], string> = {
  displacement: 'Cooler moved without authorisation',
  power: 'Cooler unplugged for a long time',
  signal_lost: 'Cooler beacon stopped reporting',
};

export class Notifier {
  constructor(private readonly db: Db, private readonly cfg: Config, private readonly fetchImpl: typeof fetch = fetch) {}

  /** Plain-language message suitable for SMS. */
  static message(incident: Incident, asset: AssetState): { subject: string; body: string } {
    const subject = `${KIND_TITLE[incident.kind]} · ${asset.id}`;
    const where =
      incident.kind === 'displacement'
        ? `${(asset.distance_m / 1000).toFixed(1)} km from ${asset.retailer_name}, ${asset.location_name}`
        : `${asset.retailer_name} (${asset.region})`;
    const body = `[Delta Asset Guard] ${KIND_TITLE[incident.kind]}: ${asset.id} at ${where}. Risk ${asset.risk.score}%. Incident ${incident.id}.`;
    return { subject, body };
  }

  async incidentOpened(incident: Incident, asset: AssetState): Promise<void> {
    const roles = incident.kind === 'displacement' ? ['asset_protection', 'ops_lead'] : ['ops_lead', 'area_manager'];
    const people = await this.db.query<{ name: string; phone: string | null }>(
      `SELECT name, phone FROM users
        WHERE active AND role = ANY($1::text[]) AND (region IS NULL OR lower(region) = lower($2))`,
      [roles, asset.region]
    );
    const { subject, body } = Notifier.message(incident, asset);
    await this.deliver({ subject, body, incident, asset, people });
  }

  async dispatched(incident: Incident, asset: AssetState, to: { name: string; phone: string | null } | null, note: string | null) {
    const { subject } = Notifier.message(incident, asset);
    const body = `[Delta Asset Guard] DISPATCH: go to ${asset.id} near ${asset.location_name} (${asset.lat.toFixed(5)}, ${asset.lng.toFixed(5)}). Incident ${incident.id}.${note ? ` Note: ${note}` : ''}`;
    await this.deliver({ subject: `Dispatch · ${subject}`, body, incident, asset, people: to ? [to] : [] });
  }

  private async deliver(m: {
    subject: string;
    body: string;
    incident: Incident;
    asset: AssetState;
    people: { name: string; phone: string | null }[];
  }) {
    await this.record('console', 'Operations console', m.subject, m.body, m.incident.id, 'logged');

    const { webhookUrl, twilioSid, twilioToken, twilioSmsFrom, twilioWhatsappFrom } = this.cfg.notify;
    if (webhookUrl) {
      await this.attempt('webhook', webhookUrl, m.subject, m.body, m.incident.id, () =>
        this.fetchImpl(webhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: m.body, subject: m.subject, incident: m.incident, asset_id: m.asset.id }),
        })
      );
    }
    if (twilioSid && twilioToken) {
      for (const p of m.people.filter((x) => x.phone)) {
        if (twilioSmsFrom) await this.attempt('sms', p.phone!, m.subject, m.body, m.incident.id, () => this.twilio(p.phone!, twilioSmsFrom, m.body));
        if (twilioWhatsappFrom)
          await this.attempt('whatsapp', p.phone!, m.subject, m.body, m.incident.id, () =>
            this.twilio(`whatsapp:${p.phone}`, `whatsapp:${twilioWhatsappFrom}`, m.body)
          );
      }
    }
  }

  private twilio(to: string, from: string, body: string) {
    const { twilioSid, twilioToken } = this.cfg.notify;
    return this.fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
  }

  private async attempt(channel: string, recipient: string, subject: string, body: string, incidentId: string, send: () => Promise<Response>) {
    const row = await this.record(channel, recipient, subject, body, incidentId, 'queued');
    try {
      const res = await send();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.db.query(`UPDATE notifications SET status='sent' WHERE id=$1`, [row]);
    } catch (err) {
      log.warn('notification failed', { channel, recipient, error: (err as Error).message });
      await this.db.query(`UPDATE notifications SET status='failed', error=$2 WHERE id=$1`, [row, (err as Error).message]);
    }
  }

  private async record(channel: string, recipient: string, subject: string, body: string, incidentId: string, status: string) {
    const r = await this.db.one<{ id: number }>(
      `INSERT INTO notifications (channel, recipient, subject, body, incident_id, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [channel, recipient, subject, body, incidentId, status]
    );
    return r!.id;
  }
}
