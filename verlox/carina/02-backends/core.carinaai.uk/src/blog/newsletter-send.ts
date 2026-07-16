import { Resend } from 'resend';
import { config } from '../config/index.js';
import { pool } from '../memory/db.js';
import {
  getUnsentNewsletterIncidents,
  listActiveSubscribers,
  markNewsletterSent,
} from './store.js';
import { buildNewsletterHtml } from './newsletter-template.js';

export async function sendIncidentNewsletter(): Promise<{
  sent: number;
  skipped: number;
  incidentsIncluded: number;
}> {
  const incidents = await getUnsentNewsletterIncidents();
  if (incidents.length === 0) {
    return { sent: 0, skipped: 0, incidentsIncluded: 0 };
  }

  const subscribers = await listActiveSubscribers();
  if (subscribers.length === 0) {
    return { sent: 0, skipped: 0, incidentsIncluded: incidents.length };
  }

  if (!config.resend.apiKey) {
    throw new Error('RESEND_API_KEY not set');
  }

  const resend = new Resend(config.resend.apiKey);
  const subject = `Scout Incident Report - ${new Date().toISOString().slice(0, 10)} - ${incidents.length} new incident${incidents.length === 1 ? '' : 's'}`;
  const html = buildNewsletterHtml(incidents);
  let sent = 0;
  let skipped = 0;

  for (const subscriber of subscribers) {
    try {
      await resend.emails.send({
        from: 'Scout Incident Report <hello@carinaai.uk>',
        to: subscriber.email,
        subject,
        html,
      });
      await pool.query(
        `UPDATE incident_blog_subscribers SET last_sent_at = NOW() WHERE id = $1`,
        [subscriber.id],
      );
      sent++;
    } catch (err) {
      skipped++;
      console.warn('[blog] newsletter send failed for', subscriber.email, err instanceof Error ? err.message : String(err));
    }
  }

  for (const incident of incidents) {
    await markNewsletterSent(incident.id);
  }

  return { sent, skipped, incidentsIncluded: incidents.length };
}
