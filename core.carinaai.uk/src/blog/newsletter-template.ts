import type { BlogIncident } from './types.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linkifySources(incident: BlogIncident): string {
  return incident.sources
    .map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.label)}</a>`)
    .join(' | ');
}

export function buildNewsletterHtml(incidents: BlogIncident[]): string {
  const preheader = `${incidents.length} new AI agent incident${incidents.length === 1 ? '' : 's'} documented this week`;
  const rows = incidents
    .map((incident) => `
      <tr>
        <td style="padding:18px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:12px;color:#8a9bb0;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">${escapeHtml(incident.category)}</div>
          <div style="font-size:18px;font-weight:700;color:#f0f4f8;margin-bottom:4px;">${escapeHtml(incident.title)}</div>
          <div style="font-size:14px;color:#8a9bb0;margin-bottom:4px;">${escapeHtml(incident.company)} • ${escapeHtml(incident.dateOccurred)}</div>
          <div style="font-size:14px;color:#e63946;font-weight:600;margin-bottom:8px;">${escapeHtml(incident.damage)}</div>
          <div style="font-size:14px;color:#f0f4f8;line-height:1.6;margin-bottom:8px;">${incident.bodyHtml}</div>
          <div style="font-size:13px;color:#16c97e;line-height:1.6;">Scout fix: ${incident.scoutFixHtml}</div>
          <div style="font-size:12px;color:#8a9bb0;margin-top:10px;">Sources: ${linkifySources(incident)}</div>
        </td>
      </tr>`)
    .join('');

  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#06090f;color:#f0f4f8;font-family:Inter,Arial,sans-serif;padding:32px 0;">
      <tr>
        <td align="center">
          <table width="680" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:680px;background:#111722;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px 28px;">
                <div style="font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#16c97e;margin-bottom:10px;">Scout Incident Report</div>
                <div style="font-size:26px;font-weight:700;line-height:1.1;margin-bottom:10px;">${escapeHtml(preheader)}</div>
                <div style="font-size:14px;color:#8a9bb0;line-height:1.65;">Documented AI incidents, verified sources, and the control pattern that would have prevented each one.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  ${rows}
                </table>
                <div style="font-size:12px;color:#8a9bb0;line-height:1.7;margin-top:20px;">
                  Manage subscription or unsubscribe using the links in the incident page footer.
                  <br>A VERLOX product.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}
