(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function labelClass(governanceLabel) {
    var t = (governanceLabel || '').toLowerCase();
    if (t.includes('compliant') && !t.includes('non')) return 'score-compliant';
    if (t.includes('non')) return 'score-non-compliant';
    return 'score-at-risk';
  }

  function tierClass(tier) {
    if (tier === 'minimal_risk') return 'tier-minimal';
    if (tier === 'limited_risk') return 'tier-limited';
    return 'tier-high';
  }

  function frameworkStatus(score) {
    if (score >= 80) return 'Compliant';
    if (score >= 55) return 'At Risk';
    return 'Review Required';
  }

  function relativeTime(iso) {
    if (!iso) return 'Never exercised';
    var secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return secs + 's ago';
    var mins = Math.floor(secs / 60);
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    return Math.floor(hrs / 24) + 'd ago';
  }

  function explorerUrl(chain, tx) {
    if (!tx) return null;
    if (chain === 'base' || chain === '8453') return 'https://basescan.org/tx/' + tx;
    if (chain === 'ethereum' || chain === '1') return 'https://etherscan.io/tx/' + tx;
    return null;
  }

  function byId(ids, key) {
    var id = ids[key];
    return id ? document.getElementById(id) : null;
  }

  function renderPosture(data, ids, options) {
    options = options || {};
    var compact = !!options.compact;
    var maxAgentRows = options.maxAgentRows == null ? (compact ? 4 : 999) : options.maxAgentRows;
    var maxAttestations = options.maxAttestations == null ? (compact ? 3 : 999) : options.maxAttestations;
    var maxReasoning = compact ? 1 : 2;

    var loading = byId(ids, 'loading');
    var content = byId(ids, 'content');
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;

    var banner = byId(ids, 'scoreBanner');
    if (banner) {
      banner.className = (options.bannerClass || 'governance-score-banner') + ' ' + labelClass(data.governance_label);
    }
    var scoreEl = byId(ids, 'govScore');
    if (scoreEl) scoreEl.textContent = String(data.governance_score);
    var labelEl = byId(ids, 'govLabel');
    if (labelEl) labelEl.textContent = (data.governance_label || 'AT RISK').toUpperCase();
    var sublineEl = byId(ids, 'govSubline');
    if (sublineEl) {
      sublineEl.textContent = 'EU AI Act: ' + data.eu_ai_act.tier_label + ' · ' + data.action_items.length + ' action item(s)';
    }

    var euCard = byId(ids, 'euCard');
    if (euCard) euCard.className = (options.cardClass || 'card') + ' ' + tierClass(data.eu_ai_act.tier);
    var euTier = byId(ids, 'euTier');
    if (euTier) euTier.textContent = data.eu_ai_act.tier_label;
    var euReasoning = byId(ids, 'euReasoning');
    if (euReasoning) {
      euReasoning.innerHTML = (data.eu_ai_act.reasoning || [])
        .slice(0, maxReasoning)
        .map(function (r) { return '<li>' + escapeHtml(r) + '</li>'; })
        .join('');
    }
    var euArticles = byId(ids, 'euArticles');
    if (euArticles) euArticles.textContent = (data.eu_ai_act.article_refs || []).join(' · ');

    var ukAlignment = byId(ids, 'ukAlignment');
    if (ukAlignment) ukAlignment.textContent = data.uk_dsit.alignment_label;
    var ukMet = byId(ids, 'ukMet');
    if (ukMet) ukMet.textContent = 'Principles met: ' + ((data.uk_dsit.principles_met || []).join(', ') || 'None');
    var ukPartial = byId(ids, 'ukPartial');
    if (ukPartial) ukPartial.textContent = 'Partial: ' + ((data.uk_dsit.principles_partial || []).join(', ') || 'None');

    var fw = data.frameworks || {};
    var gaps = {
      eu_ai_act_readiness: (data.action_items.find(function (a) { return a.framework === 'EU AI Act'; }) || {}).label,
      gdpr_readiness: 'Data retention policy',
      soc2_readiness: 'Monitoring or audit logging',
      iso42001_readiness: 'Governance policy pack',
    };
    var fwNames = [
      ['eu_ai_act_readiness', 'EU AI Act'],
      ['gdpr_readiness', 'GDPR'],
      ['soc2_readiness', 'SOC2 Type II'],
      ['iso42001_readiness', 'ISO 42001'],
    ];
    var frameworkGrid = byId(ids, 'frameworkGrid');
    if (frameworkGrid) {
      frameworkGrid.innerHTML = fwNames.map(function (pair) {
        var key = pair[0];
        var name = pair[1];
        var score = fw[key] != null ? fw[key] : 0;
        var gap = score < 80 ? (gaps[key] || 'Review controls') : 'No primary gap';
        return (
          '<div class="' + escapeHtml(options.fwCardClass || 'card fw-card') + '">' +
            '<div class="progress-ring" style="--pct:' + score + '" data-label="' + score + '%"></div>' +
            '<div class="fw-meta">' +
              '<div class="fw-name">' + escapeHtml(name) + '</div>' +
              '<div class="fw-status">' + escapeHtml(frameworkStatus(score)) + '</div>' +
              '<div class="fw-gap">' + escapeHtml(gap) + '</div>' +
            '</div>' +
          '</div>'
        );
      }).join('');
    }

    var agentsSummary = byId(ids, 'agentsSummary');
    if (agentsSummary) {
      agentsSummary.textContent =
        'Governed ' + data.agents.governed + '/' + data.agents.total +
        ' · Compliant ' + data.agents.compliant + '/' + data.agents.total;
    }
    var agentsTbody = byId(ids, 'agentsTbody');
    if (agentsTbody) {
      var rows = (data.agents.rows || []).slice(0, maxAgentRows);
      agentsTbody.innerHTML = rows.map(function (row) {
        return (
          '<tr><td>' + escapeHtml(row.id) + '</td><td>' + escapeHtml(row.status) + '</td>' +
          '<td>' + (row.identified ? 'Yes' : 'No') + '</td><td>' + row.incidents + '</td></tr>'
        );
      }).join('') || '<tr><td colspan="4">No agents registered</td></tr>';
    }

    var oversightBody = byId(ids, 'oversightBody');
    if (oversightBody) {
      var ho = data.human_oversight || {};
      var responseLabel = ho.response_time_secs != null ? '< ' + ho.response_time_secs + 's' : 'N/A';
      oversightBody.innerHTML =
        '<p><strong>Human Override:</strong> ' + (ho.enabled ? 'ENABLED' : 'DISABLED') + '</p>' +
        '<p><strong>Last exercised:</strong> ' + escapeHtml(relativeTime(ho.last_exercised)) + '</p>' +
        '<p><strong>Response time:</strong> ' + escapeHtml(responseLabel) + '</p>' +
        (ho.approval_workflow_active
          ? '<p><strong>Approval workflow:</strong> Active (' + (ho.pending_approvals || 0) + ' pending)</p>'
          : '');
    }

    var attestList = byId(ids, 'attestList');
    if (attestList) {
      var attestations = (data.attestations || []).slice(0, maxAttestations);
      if (!attestations.length) {
        attestList.innerHTML = '<div class="body">No attestations recorded. Run <code>scout trust:attest</code> to create one.</div>';
      } else {
        attestList.innerHTML = attestations.map(function (row) {
          var url = explorerUrl(row.chain, row.tx_hash);
          var tx = row.tx_hash ? row.tx_hash.slice(0, 14) + '...' : 'n/a';
          var txHtml = url
            ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(tx) + '</a>'
            : escapeHtml(tx);
          return (
            '<div class="attest-row"><span>' + escapeHtml(row.attested_at.slice(0, 10)) + '</span>' +
            '<span>' + escapeHtml(row.chain) + '</span><span>' + txHtml + '</span></div>'
          );
        }).join('');
      }
    }

    var actionItems = byId(ids, 'actionItems');
    if (actionItems) {
      if (!data.action_items || !data.action_items.length) {
        actionItems.innerHTML = '<div class="action-complete">No action items. Governance posture is complete.</div>';
      } else {
        var items = compact ? data.action_items.slice(0, 5) : data.action_items;
        actionItems.innerHTML = '<ul class="action-list">' + items.map(function (item) {
          return (
            '<li class="action-item">' +
              '<span class="badge badge-' + escapeHtml(item.priority) + '">' + escapeHtml(item.priority.toUpperCase()) + '</span>' +
              '<span>' + escapeHtml(item.label) + ' <em>(' + escapeHtml(item.framework) + ' ' + escapeHtml(item.article) + ')</em></span>' +
            '</li>'
          );
        }).join('') + '</ul>';
        if (compact && data.action_items.length > items.length) {
          actionItems.innerHTML += '<p class="gov-tab-more">' + (data.action_items.length - items.length) + ' more on full governance page</p>';
        }
      }
    }
  }

  function renderTemplateCard(data, ids, templateCatalog) {
    var body = byId(ids, 'templateBody');
    var select = byId(ids, 'templateSelect');
    if (!body) return;

    var active = data.active_industry_template;
    if (!active) {
      body.innerHTML = 'No industry template applied. Select one for sector-specific governance.';
    } else {
      body.innerHTML =
        '<p><strong>' + escapeHtml(active.label) + '</strong></p>' +
        '<p>Regulations: ' + escapeHtml(active.regulations.slice(0, 3).join(', ')) + '</p>' +
        '<p>Tools requiring human review: ' + escapeHtml((active.human_review_required_for || []).join(', ')) + '</p>';
    }

    if (!select) return;
    var currentOptions = '<option value="">Change template...</option>' +
      (templateCatalog || []).map(function (t) {
        return '<option value="' + escapeHtml(t.id) + '"' +
          (active && active.id === t.id ? ' selected' : '') + '>' + escapeHtml(t.label) + '</option>';
      }).join('');
    select.innerHTML = currentOptions;
  }

  var STANDALONE_IDS = {
    loading: 'loading',
    content: 'content',
    scoreBanner: 'score-banner',
    govScore: 'gov-score',
    govLabel: 'gov-label',
    govSubline: 'gov-subline',
    euCard: 'eu-card',
    euTier: 'eu-tier',
    euReasoning: 'eu-reasoning',
    euArticles: 'eu-articles',
    ukAlignment: 'uk-alignment',
    ukMet: 'uk-met',
    ukPartial: 'uk-partial',
    frameworkGrid: 'framework-grid',
    agentsSummary: 'agents-summary',
    agentsTbody: 'agents-tbody',
    oversightBody: 'oversight-body',
    attestList: 'attest-list',
    actionItems: 'action-items',
    templateBody: 'template-body',
    templateSelect: 'template-select',
  };

  var DASHBOARD_TAB_IDS = {
    loading: 'gov-tab-loading',
    content: 'gov-tab-content',
    scoreBanner: 'gov-tab-score-banner',
    govScore: 'gov-tab-score',
    govLabel: 'gov-tab-label',
    govSubline: 'gov-tab-subline',
    euCard: 'gov-tab-eu-card',
    euTier: 'gov-tab-eu-tier',
    euReasoning: 'gov-tab-eu-reasoning',
    euArticles: 'gov-tab-eu-articles',
    ukAlignment: 'gov-tab-uk-alignment',
    ukMet: 'gov-tab-uk-met',
    ukPartial: 'gov-tab-uk-partial',
    frameworkGrid: 'gov-tab-framework-grid',
    agentsSummary: 'gov-tab-agents-summary',
    agentsTbody: 'gov-tab-agents-tbody',
    oversightBody: 'gov-tab-oversight-body',
    attestList: 'gov-tab-attest-list',
    actionItems: 'gov-tab-action-items',
    templateBody: 'gov-tab-template-body',
  };

  window.GovernanceRender = {
    renderPosture: renderPosture,
    renderTemplateCard: renderTemplateCard,
    labelClass: labelClass,
    tierClass: tierClass,
    relativeTime: relativeTime,
    explorerUrl: explorerUrl,
    frameworkStatus: frameworkStatus,
    STANDALONE_IDS: STANDALONE_IDS,
    DASHBOARD_TAB_IDS: DASHBOARD_TAB_IDS,
  };
})();
