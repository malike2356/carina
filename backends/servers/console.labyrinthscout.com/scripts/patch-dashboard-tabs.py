#!/usr/bin/env python3
"""Inject top tabs + action bar and alternate views into dashboard.html."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DASH = ROOT / 'public' / 'dashboard.html'

CSS = """
/* ── TOP TABS + ACTIONS ── */
.dash-views{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.dash-view{flex:1;min-height:0;display:flex;flex-direction:column;gap:.35rem;overflow:hidden;min-width:0}
.dash-view[hidden]{display:none!important}
#view-overview > .spec-overview,#view-overview > .spec-dashboard{flex-shrink:0}
#view-overview > .cols{flex:1;min-height:0}
#view-overview > .instances-bar,#view-overview > .response-terminal-strip{flex-shrink:0}
.response-terminal-strip{border-top:1px solid var(--border);background:var(--navy);max-height:120px;overflow-y:auto}
.response-terminal-strip .panel-lbl{padding:.22rem .5rem;font-size:.58rem;margin:0}
#response-terminal-panel{padding:0 .5rem .35rem}
.dash-toolbar{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:.5rem;border-bottom:1px solid var(--border);padding:.28rem 0 .38rem;flex-wrap:wrap}
.dash-tabs{display:flex;gap:.25rem;flex-wrap:wrap}
.dash-tab{font-family:'JetBrains Mono',monospace;font-size:.68rem;letter-spacing:.1em;padding:.38rem .72rem;border:1px solid transparent;background:transparent;color:var(--text);cursor:pointer;border-radius:3px;text-transform:uppercase}
.dash-tab:hover{color:var(--bright);border-color:var(--border)}
.dash-tab-active{color:var(--green);border-color:rgba(0,200,150,.35);background:rgba(0,200,150,.08)}
.dash-actions{display:flex;gap:.32rem;flex-wrap:wrap;align-items:center;margin-left:auto}
.act-btn{font-family:'JetBrains Mono',monospace;font-size:.64rem;letter-spacing:.06em;padding:.32rem .58rem;border-radius:3px;cursor:pointer;border:1px solid var(--border);background:rgba(139,175,192,.08);color:var(--text);white-space:nowrap}
.act-btn:hover{color:var(--bright);border-color:rgba(139,175,192,.35)}
.act-red{border-color:rgba(255,34,68,.45);color:var(--red);background:rgba(255,34,68,.12)}
.act-amber{border-color:rgba(212,175,55,.45);color:var(--amber);background:rgba(212,175,55,.1)}
.act-purple{border-color:rgba(155,89,255,.4);color:var(--purple);background:rgba(155,89,255,.1)}
.act-cyan{border-color:rgba(0,212,255,.4);color:var(--cyan);background:rgba(0,212,255,.1)}
.act-muted{color:var(--text);background:transparent}
.scroll-view{flex:1;min-height:0;overflow-y:auto;padding-right:.15rem}
.defense-grid{display:grid;grid-template-columns:1fr 1fr;gap:.65rem;margin-top:.65rem}
@media(max-width:900px){.defense-grid{grid-template-columns:1fr}}
.defense-form-row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:flex-end;margin-top:.45rem}
.defense-form-row label{font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--text);display:flex;flex-direction:column;gap:.2rem;flex:1;min-width:140px}
.defense-input{background:var(--lift);border:1px solid var(--border);color:var(--bright);font-family:'JetBrains Mono',monospace;font-size:.65rem;padding:.38rem .5rem;border-radius:3px;width:100%}
.defense-btn{font-family:'JetBrains Mono',monospace;font-size:.64rem;padding:.34rem .58rem;border:1px solid rgba(0,200,150,.35);background:rgba(0,200,150,.1);color:var(--green);border-radius:3px;cursor:pointer}
.defense-btn-active{border-color:var(--cyan);color:var(--cyan);background:rgba(0,212,255,.12)}
.defense-btn-muted{border-color:var(--border);color:var(--text);background:transparent}
.defense-btn-row{display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.45rem}
.defense-status-row{display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:.65rem;padding:.22rem 0;border-bottom:1px solid rgba(139,175,192,.08)}
.defense-list-row{display:grid;grid-template-columns:1fr 1fr;gap:.4rem;font-size:.62rem;padding:.25rem 0;border-bottom:1px solid rgba(139,175,192,.06)}
.defense-log-row{display:flex;gap:.5rem;font-family:'JetBrains Mono',monospace;font-size:.62rem;padding:.2rem 0}
.defense-log-row.critical{color:var(--red)}.defense-log-row.warning{color:var(--amber)}
.defense-loading{opacity:.55;pointer-events:none}
.op-metric .label{font-size:.58rem;color:var(--text);letter-spacing:.1em;text-transform:uppercase}
.op-metric .value{font-family:'JetBrains Mono',monospace;font-size:1.15rem;color:var(--bright)}
.op-metric .detail{font-size:.58rem;color:rgba(139,175,192,.6)}
.op-grid{display:grid;gap:.45rem}
.gov-tab-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.65rem;flex-wrap:wrap}
.gov-tab-head span{font-family:'JetBrains Mono',monospace;font-size:.72rem;letter-spacing:.12em;color:var(--amber);text-transform:uppercase}
.gov-tab-score-banner{background:var(--navy);border:1px solid var(--border);border-radius:4px;padding:1rem 1.1rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:.65rem}
.gov-tab-card{background:var(--navy);border:1px solid var(--border);border-radius:4px;padding:.75rem .85rem;margin-bottom:.65rem}
.gov-tab-card h3{font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.12em;color:var(--text);margin:0 0 .45rem;text-transform:uppercase}
.gov-tab-grid{display:grid;grid-template-columns:1fr 1fr;gap:.65rem}
@media(max-width:900px){.gov-tab-grid{grid-template-columns:1fr}}
.fleet-summary-bar{display:flex;gap:.45rem;flex-wrap:wrap;margin-bottom:.65rem}
.fleet-summary-pill{font-family:'JetBrains Mono',monospace;font-size:.64rem;padding:.22rem .55rem;border:1px solid var(--border);border-radius:3px;color:var(--text)}
.fleet-summary-pill.active{color:var(--green);border-color:rgba(0,200,150,.35)}
.fleet-summary-pill.suspended{color:var(--red);border-color:rgba(255,34,68,.35)}
.fleet-summary-pill.offline{color:var(--amber);border-color:rgba(212,175,55,.35)}
.fleet-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.65rem}
.fleet-card{background:var(--navy);border:1px solid var(--border);border-radius:4px;padding:.75rem;font-family:'JetBrains Mono',monospace;font-size:.64rem}
.fleet-empty{color:rgba(139,175,192,.5);font-size:.72rem;padding:1.5rem;text-align:center}
.as-head{display:flex;align-items:center;gap:.65rem;margin-bottom:.65rem;flex-wrap:wrap}
.as-score{font-family:'JetBrains Mono',monospace;font-size:2rem;font-weight:700;color:var(--green)}
.as-score-badge{font-size:.62rem;padding:.15rem .45rem;border:1px solid var(--border);border-radius:3px}
.as-score-badge.ok{color:var(--green)}.as-score-badge.warn{color:var(--amber)}.as-score-badge.bad{color:var(--red)}
.as-sev-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:.35rem;margin-bottom:.65rem}
.as-sev-box{background:var(--navy);border:1px solid var(--border);border-radius:4px;padding:.55rem;text-align:center}
.as-sev-box b{display:block;font-family:'JetBrains Mono',monospace;font-size:1.1rem}
.as-sev-box span{font-size:.58rem;color:var(--text);text-transform:uppercase}
.as-table{width:100%;border-collapse:collapse;font-family:'JetBrains Mono',monospace;font-size:.62rem}
.as-table th,.as-table td{padding:.35rem .45rem;border-bottom:1px solid rgba(139,175,192,.08);text-align:left}
.defense-confirm-overlay[hidden]{display:none!important}
.defense-confirm-overlay{position:fixed;inset:0;z-index:1200;background:rgba(2,4,9,.88);display:flex;align-items:center;justify-content:center}
.defense-confirm-box{background:var(--navy);border:1px solid var(--amber);border-radius:6px;padding:1.25rem;width:min(420px,92vw)}
"""

TOOLBAR = """
  <nav class="dash-toolbar" aria-label="Dashboard navigation">
    <div class="dash-tabs" role="tablist">
      <button type="button" class="dash-tab dash-tab-active" data-view="overview" aria-selected="true">Overview</button>
      <button type="button" class="dash-tab" data-view="defense" aria-selected="false">Defense</button>
      <button type="button" class="dash-tab" data-view="governance" aria-selected="false">Governance</button>
      <button type="button" class="dash-tab" data-view="fleet" aria-selected="false">Fleet</button>
      <button type="button" class="dash-tab" data-view="attack-surface" aria-selected="false">Attack Surface</button>
    </div>
    <div class="dash-actions" aria-label="Threat response actions">
      <button type="button" class="act-btn act-red" id="act-kill" title="Kill active instance">Kill</button>
      <button type="button" class="act-btn act-amber" id="act-honeypot" title="Deploy honeypot">Honeypot</button>
      <button type="button" class="act-btn act-purple" id="act-quarantine" title="Tool quarantine">Quarantine</button>
      <button type="button" class="act-btn act-cyan" id="act-egress" title="Egress blocklist">Egress</button>
      <button type="button" class="act-btn" id="act-memory" title="Session memory">Memory</button>
      <button type="button" class="act-btn act-amber" id="act-block" title="Block session">Block Session</button>
      <button type="button" class="act-btn act-muted" id="act-defense" title="Open defense controls">Defense Panel</button>
      <button type="button" class="act-btn act-muted" id="act-test-alert">Test Alert</button>
      <button type="button" class="act-btn act-muted" id="act-export">Export</button>
    </div>
  </nav>

  <div class="dash-views">
  <div id="view-overview" class="dash-view">
"""

ALT_VIEWS = """
  </div>

  <div id="view-defense" class="dash-view scroll-view" hidden>
    <div id="defense-tab-root">
      <div class="spec-panel">
        <h3>DEFENSE CONTEXT</h3>
        <div class="defense-form-row">
          <label>Session ID<input id="defense-session-id" class="defense-input" placeholder="from event stream" autocomplete="off"></label>
          <label>Instance ID<input id="defense-instance-id" class="defense-input" value="default" autocomplete="off"></label>
          <button type="button" class="defense-btn" id="defense-refresh">Refresh</button>
        </div>
      </div>
      <div class="spec-panel"><h3>RESPONSE SUMMARY</h3><div id="defense-terminal-summary"><div class="spec-empty">Enter session ID and refresh</div></div></div>
      <div class="defense-grid">
        <div class="spec-panel"><h3>SHIELD MODE</h3><div id="defense-shield-panel"><div class="spec-empty">Loading...</div></div></div>
        <div class="spec-panel"><h3>POLICY PACKS</h3><div id="defense-packs-panel"><div class="spec-empty">Loading...</div></div></div>
        <div class="spec-panel"><h3>JIT PRIVILEGES</h3><div id="defense-jit-panel"><div class="spec-empty">Loading...</div></div></div>
        <div class="spec-panel"><h3>ACTION SIMULATION</h3><div id="defense-simulation-panel"><div class="spec-empty">Loading...</div></div></div>
        <div class="spec-panel"><h3>AUTO-REMEDIATION</h3><div id="defense-remediation-panel"><div class="spec-empty">Loading...</div></div></div>
        <div class="spec-panel"><h3>TRIPWIRES</h3><div id="defense-tripwire-panel"><div class="spec-empty">Loading...</div></div></div>
      </div>
      <div class="spec-panel" style="margin-top:.65rem"><h3>SURFACE RESTRICTIONS</h3><div id="defense-restrictions-panel"><div class="spec-empty">Loading...</div></div></div>
      <div class="spec-panel" style="margin-top:.65rem"><h3>OPERATOR ACTIONS</h3><div id="defense-operator-actions"><div class="spec-empty">Load a session to see actions</div></div></div>
      <div class="spec-panel" style="margin-top:.65rem"><h3>OPERATOR LOG</h3><div id="defense-action-log"><div class="spec-empty">No operator actions yet this session</div></div></div>
    </div>
  </div>

  <div id="view-governance" class="dash-view scroll-view" hidden>
    <div class="gov-tab-head">
      <span>Governance posture</span>
      <button type="button" class="act-btn act-muted" id="gov-tab-refresh">Refresh</button>
      <a href="/governance" class="act-btn act-muted" target="_blank" rel="noopener" style="text-decoration:none">Full page</a>
    </div>
    <div id="gov-tab-loading" class="spec-empty">Loading governance posture...</div>
    <div id="gov-tab-content" hidden>
      <div id="gov-tab-score-banner" class="gov-tab-score-banner score-at-risk">
        <div><div id="gov-tab-score" style="font-family:'JetBrains Mono',monospace;font-size:2.5rem;font-weight:700">-</div><div style="font-size:.62rem;color:var(--text);letter-spacing:.12em">GOVERNANCE SCORE</div></div>
        <div><div id="gov-tab-label" style="font-family:'JetBrains Mono',monospace;font-size:.72rem">-</div><div id="gov-tab-subline" style="font-size:.72rem;color:var(--text);margin-top:.25rem">-</div></div>
      </div>
      <div class="gov-tab-grid">
        <div class="gov-tab-card tier-limited" id="gov-tab-eu-card"><h3>EU AI Act</h3><div id="gov-tab-eu-tier" style="font-size:1.1rem;margin-bottom:.35rem">-</div><ul id="gov-tab-eu-reasoning" style="font-size:.72rem;color:var(--text);margin-left:1rem"></ul><div id="gov-tab-eu-articles" style="font-size:.62rem;color:rgba(139,175,192,.6);margin-top:.35rem"></div></div>
        <div class="gov-tab-card"><h3>UK DSIT</h3><div id="gov-tab-uk-alignment" style="font-size:1.1rem;margin-bottom:.35rem">-</div><div id="gov-tab-uk-met" style="font-size:.72rem;color:var(--text)"></div><div id="gov-tab-uk-partial" style="font-size:.72rem;color:rgba(139,175,192,.55)"></div></div>
      </div>
      <div id="gov-tab-framework-grid" class="gov-tab-grid" style="margin-top:.65rem"></div>
      <div class="gov-tab-grid" style="margin-top:.65rem">
        <div class="gov-tab-card"><h3>Governed agents</h3><div id="gov-tab-agents-summary" style="font-size:.72rem;color:var(--text);margin-bottom:.35rem">-</div><table class="as-table"><thead><tr><th>Agent</th><th>Status</th><th>Identified</th><th>Incidents</th></tr></thead><tbody id="gov-tab-agents-tbody"></tbody></table></div>
        <div class="gov-tab-card"><h3>Human oversight</h3><div id="gov-tab-oversight-body" style="font-size:.72rem;color:var(--text)">-</div></div>
        <div class="gov-tab-card"><h3>Attestations</h3><div id="gov-tab-attest-list"></div></div>
        <div class="gov-tab-card"><h3>Action items</h3><div id="gov-tab-action-items"></div></div>
        <div class="gov-tab-card gov-tab-fw-card" style="grid-column:1/-1"><h3>Governance template</h3><div id="gov-tab-template-body" class="spec-empty">Loading template...</div></div>
      </div>
    </div>
  </div>

  <div id="view-fleet" class="dash-view scroll-view" hidden>
    <div id="fleet-summary-bar" class="fleet-summary-bar"></div>
    <div id="fleet-grid" class="fleet-grid"><div class="fleet-empty">Loading fleet...</div></div>
  </div>

  <div id="view-attack-surface" class="dash-view scroll-view" hidden>
    <div class="as-head">
      <div class="as-score" id="as-score-value">-</div>
      <span class="as-score-badge" id="as-score-badge">-</span>
      <button type="button" class="act-btn act-muted" id="as-refresh">Refresh</button>
      <a href="/api/reports/stix/download" class="act-btn act-muted" target="_blank" rel="noopener" style="text-decoration:none">STIX Export</a>
    </div>
    <div id="as-loading" class="spec-empty">Loading attack surface...</div>
    <div id="as-content" hidden>
      <div class="as-sev-grid">
        <div class="as-sev-box"><b id="as-sev-critical">0</b><span>Critical</span></div>
        <div class="as-sev-box"><b id="as-sev-high">0</b><span>High</span></div>
        <div class="as-sev-box"><b id="as-sev-medium">0</b><span>Medium</span></div>
        <div class="as-sev-box"><b id="as-sev-low">0</b><span>Low</span></div>
        <div class="as-sev-box"><b id="as-sev-info">0</b><span>Info</span></div>
      </div>
      <div class="spec-panel"><h3>MONITORED TARGETS</h3><div id="as-targets-list"></div></div>
      <div class="spec-panel" style="margin-top:.65rem"><h3>OPEN FINDINGS</h3><table class="as-table"><thead><tr><th>Sev</th><th>Title</th><th>Tool</th><th>Type</th><th>Status</th></tr></thead><tbody id="as-findings-table"></tbody></table></div>
      <div class="spec-panel" style="margin-top:.65rem"><h3>ATTACK SURFACE</h3><div style="font-size:.68rem;color:var(--text);margin-bottom:.35rem">Open ports: <span id="as-open-ports">-</span></div><div style="font-size:.68rem;color:var(--text);margin-bottom:.35rem">Subdomains: <span id="as-subdomains">-</span></div><div id="as-cve-list"></div></div>
    </div>
  </div>
  </div>
"""

CONFIRM = """
<div class="defense-confirm-overlay" id="defense-confirm-overlay" hidden>
  <div class="defense-confirm-box">
    <div class="kill-title" id="defense-confirm-title">Confirm action</div>
    <p class="kill-desc" id="defense-confirm-detail"></p>
    <div class="kill-actions">
      <button type="button" class="btn-cancel" onclick="closeDefenseConfirm()">Cancel</button>
      <button type="button" class="btn-confirm" id="defense-confirm-submit">Confirm</button>
    </div>
  </div>
</div>
"""

SCRIPTS = """
<script src="/dashboard/js/widgets/posture-summary.js"></script>
<script src="/dashboard/js/widgets/action-queue.js"></script>
<script src="/dashboard/js/widgets/attack-detail.js"></script>
<script src="/dashboard/js/widgets/response-terminal.js"></script>
<script src="/dashboard/js/widgets/defense-tab.js"></script>
<script src="/dashboard/js/widgets/governance-render.js"></script>
<script src="/dashboard/js/widgets/governance-tab.js"></script>
<script src="/dashboard/js/widgets/fleet.js"></script>
<script src="/dashboard/js/widgets/attack-surface-tab.js"></script>
<script>
(function () {
  function primaryInstanceId() {
    if (!Array.isArray(instances) || !instances.length) return null;
    var active = instances.find(function (i) { return i.status === 'active'; });
    return (active || instances[0]).id;
  }

  function wire(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  wire('act-kill', function () {
    var id = primaryInstanceId();
    if (id) openKill(id, id);
    else document.getElementById('global-kill-button')?.click();
  });
  wire('act-honeypot', function () { openHoneypotModal(); });
  wire('act-egress', function () {
    var id = primaryInstanceId();
    if (id) void openEgressModal(id);
    else toast('No instance available for egress blocklist', 'warning');
  });
  wire('act-memory', function () { openMemoryModal(); });
  wire('act-quarantine', function () {
    var id = primaryInstanceId() || 'carina-local';
    var panel = document.getElementById('qpanel-' + id);
    if (panel) {
      panel.classList.toggle('open');
      return;
    }
    if (window.DashboardDefenseTab) window.DashboardDefenseTab.switchView('defense');
  });
  wire('act-block', function () {
    var sid = window.prompt('Session ID to block (from event stream):', '');
    if (!sid) return;
    var iid = primaryInstanceId() || 'default';
    void blockSession(sid.trim(), iid);
  });
  wire('act-defense', function () {
    if (window.DashboardDefenseTab) window.DashboardDefenseTab.switchView('defense');
  });
  wire('act-test-alert', function () { triggerAlertTest(); });
  wire('act-export', function () {
    var btn = document.querySelector('.export-wrap .btn-export');
    if (btn) btn.click();
    else document.getElementById('audit-export')?.click();
  });
})();
</script>
"""


def main() -> None:
    text = DASH.read_text()
    if 'dash-toolbar' in text:
        print('Already patched')
        return

    marker = '/* ── TOASTS ── */'
    if marker not in text:
        raise SystemExit('toast marker missing')
    text = text.replace(marker, CSS + '\n' + marker)

    text = text.replace('  </header>\n\n  <section class="spec-overview"', '  </header>\n' + TOOLBAR + '\n  <section class="spec-overview"')

    # Close view-overview before kill modal (after instances-bar, before closing .app)
    anchor = '  <div class="instances-bar" id="instances-bar">'
    end_app = text.find('</div>\n\n<!-- Kill modal -->')
    if end_app < 0:
        raise SystemExit('kill modal anchor missing')
    text = text[:end_app] + ALT_VIEWS + text[end_app:]

    text = text.replace('<!-- Kill modal -->', CONFIRM + '\n<!-- Kill modal -->', 1)

    old_scripts = """<script src="/dashboard/js/widgets/live-feed.js"></script>
<script src="/dashboard/js/widgets/kill-switch.js"></script>"""
    if old_scripts not in text:
        raise SystemExit('widget scripts anchor missing')
    text = text.replace(old_scripts, old_scripts + '\n' + SCRIPTS)

    DASH.write_text(text)
    print('Patched', DASH)


if __name__ == '__main__':
    main()
