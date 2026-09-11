/**
 * Aiva hero orbital timeline.
 * Persistent DOM nodes + transform updates (no innerHTML thrash on rotate).
 */
(function initHeroOrbital() {
  'use strict';

  var root = document.getElementById('hero-orbital');
  if (!root) return;

  var timelineData = [
    {
      id: 1,
      title: 'Memory',
      date: 'Always on',
      content: 'Persistent context across sessions. Aiva remembers projects, preferences, and prior decisions so you never re-explain yourself.',
      icon: 'ti-brain',
      relatedIds: [2, 3],
      status: 'completed',
      energy: 100,
    },
    {
      id: 2,
      title: 'Skills',
      date: 'Compounding',
      content: 'Completed workflows distill into reusable skill entries. Every agent session starts smarter than the last.',
      icon: 'ti-puzzle',
      relatedIds: [1, 4],
      status: 'completed',
      energy: 92,
    },
    {
      id: 3,
      title: 'Channels',
      date: '40+',
      content: 'Telegram, Slack, Discord, WhatsApp, CLI, REST, and more. One agent, one memory, everywhere you work.',
      icon: 'ti-plug-connected',
      relatedIds: [1, 5],
      status: 'in-progress',
      energy: 88,
    },
    {
      id: 4,
      title: 'Workspace',
      date: 'Unified',
      content: 'Notes, calendar, research, documents, and chat in one hub. Not another disposable chat window.',
      icon: 'ti-layout-dashboard',
      relatedIds: [2, 5],
      status: 'in-progress',
      energy: 78,
    },
    {
      id: 5,
      title: 'Playbook',
      date: 'Hardware-aware',
      content: 'Detects GPU, VRAM, and storage to recommend models that fit your machine. No guesswork on local inference.',
      icon: 'ti-cpu',
      relatedIds: [3, 4],
      status: 'in-progress',
      energy: 70,
    },
    {
      id: 6,
      title: 'Scout',
      date: 'Optional',
      content: 'Set SCOUT_KEY for telemetry, audit, and governance when client data or production controls matter.',
      icon: 'ti-shield-check',
      relatedIds: [1, 3],
      status: 'pending',
      energy: 55,
    },
  ];

  var rotationAngle = 0;
  var expandedId = null;
  var activeNodeId = null;
  var pulseIds = {};
  var radius = 168;
  var rotationTimer = null;
  var nodeEls = {};
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  root.innerHTML =
    '<div class="orbital-stage">' +
      '<div class="orbital-orbit" aria-hidden="true">' +
        '<div class="orbital-center">' +
          '<div class="orbital-center-ping orbital-center-ping--delay"></div>' +
          '<div class="orbital-center-ping"></div>' +
          '<div class="orbital-center-core"><i class="ti ti-sparkles"></i></div>' +
        '</div>' +
        '<div class="orbital-ring"></div>' +
      '</div>' +
      '<div class="orbital-nodes"></div>' +
      '<div class="orbital-detail-anchor" id="orbital-detail-anchor" hidden aria-live="polite">' +
        '<div class="orbital-detail-connector"></div>' +
        '<div class="orbital-detail" id="orbital-detail"></div>' +
      '</div>' +
    '</div>';

  var nodesEl = root.querySelector('.orbital-nodes');
  var anchorEl = root.querySelector('#orbital-detail-anchor');
  var detailEl = root.querySelector('#orbital-detail');

  function statusLabel(status) {
    if (status === 'completed') return 'ACTIVE';
    if (status === 'in-progress') return 'LIVE';
    return 'READY';
  }

  function statusClass(status) {
    if (status === 'completed') return 'orbital-badge--done';
    if (status === 'in-progress') return 'orbital-badge--live';
    return 'orbital-badge--pending';
  }

  function getItem(id) {
    for (var i = 0; i < timelineData.length; i++) {
      if (timelineData[i].id === id) return timelineData[i];
    }
    return null;
  }

  function getRelatedItems(itemId) {
    var item = getItem(itemId);
    return item ? item.relatedIds : [];
  }

  function buildNodes() {
    var html = '';
    timelineData.forEach(function (item) {
      html +=
        '<button type="button" class="orbital-node" data-id="' + item.id + '" aria-expanded="false" aria-label="' + item.title + '">' +
          '<span class="orbital-node-glow"></span>' +
          '<span class="orbital-node-icon"><i class="ti ' + item.icon + '" aria-hidden="true"></i></span>' +
          '<span class="orbital-node-label">' + item.title + '</span>' +
        '</button>';
    });
    nodesEl.innerHTML = html;
    timelineData.forEach(function (item) {
      nodeEls[item.id] = nodesEl.querySelector('[data-id="' + item.id + '"]');
    });
  }

  function nodePosition(index) {
    var angle = ((index / timelineData.length) * 360 + rotationAngle) % 360;
    var radian = (angle * Math.PI) / 180;
    return {
      x: radius * Math.cos(radian),
      y: radius * Math.sin(radian),
      angle: angle,
      radian: radian,
    };
  }

  function renderDetail(item) {
    if (!item) {
      anchorEl.hidden = true;
      detailEl.innerHTML = '';
      anchorEl.style.transform = '';
      return;
    }

    var linksHtml = item.relatedIds.map(function (relId) {
      var rel = getItem(relId);
      if (!rel) return '';
      return '<button type="button" class="orbital-link-btn" data-jump="' + relId + '">' +
        rel.title + '<i class="ti ti-arrow-right" aria-hidden="true"></i></button>';
    }).join('');

    detailEl.innerHTML =
      '<button type="button" class="orbital-detail-close" aria-label="Close detail panel"><i class="ti ti-x"></i></button>' +
      '<div class="orbital-card-head">' +
        '<span class="orbital-badge ' + statusClass(item.status) + '">' + statusLabel(item.status) + '</span>' +
        '<span class="orbital-card-date">' + item.date + '</span>' +
      '</div>' +
      '<h3 class="orbital-card-title">' + item.title + '</h3>' +
      '<p class="orbital-card-body">' + item.content + '</p>' +
      '<div class="orbital-card-energy">' +
        '<span><i class="ti ti-bolt" aria-hidden="true"></i> Signal</span>' +
        '<span class="orbital-card-energy-val">' + item.energy + '%</span>' +
      '</div>' +
      '<div class="orbital-card-bar"><span style="width:' + item.energy + '%"></span></div>' +
      (item.relatedIds.length
        ? '<div class="orbital-card-links">' +
            '<span class="orbital-card-links-label"><i class="ti ti-link" aria-hidden="true"></i> Connected</span>' +
            '<div class="orbital-card-link-row">' + linksHtml + '</div>' +
          '</div>'
        : '');
    anchorEl.hidden = false;
  }

  function positionDetailAnchor() {
    if (!expandedId) return;

    var nodeIndex = -1;
    for (var i = 0; i < timelineData.length; i++) {
      if (timelineData[i].id === expandedId) {
        nodeIndex = i;
        break;
      }
    }
    if (nodeIndex === -1) return;

    var pos = nodePosition(nodeIndex);
    anchorEl.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';

    anchorEl.classList.remove(
      'orbital-detail-anchor--left',
      'orbital-detail-anchor--right',
      'orbital-detail-anchor--below',
      'orbital-detail-anchor--above',
    );

    if (pos.y < -radius * 0.25) {
      anchorEl.classList.add('orbital-detail-anchor--below');
    } else if (pos.y > radius * 0.25) {
      anchorEl.classList.add('orbital-detail-anchor--above');
    } else if (pos.x > radius * 0.2) {
      anchorEl.classList.add('orbital-detail-anchor--left');
    } else if (pos.x < -radius * 0.2) {
      anchorEl.classList.add('orbital-detail-anchor--right');
    } else {
      anchorEl.classList.add('orbital-detail-anchor--below');
    }
  }

  function updateNodeStyles() {
    timelineData.forEach(function (item, index) {
      var el = nodeEls[item.id];
      if (!el) return;

      var pos = nodePosition(index);
      var zIndex = Math.round(100 + 50 * Math.cos(pos.radian));
      var opacity = Math.max(0.45, Math.min(1, 0.45 + 0.55 * ((1 + Math.sin(pos.radian)) / 2)));
      var isExpanded = expandedId === item.id;
      var isRelated = activeNodeId && getRelatedItems(activeNodeId).indexOf(item.id) !== -1;
      var isPulsing = !!pulseIds[item.id];

      el.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
      el.style.zIndex = String(isExpanded ? 220 : zIndex);
      el.style.opacity = String(isExpanded ? 1 : opacity);

      el.classList.toggle('orbital-node--expanded', isExpanded);
      el.classList.toggle('orbital-node--related', !!isRelated);
      el.classList.toggle('orbital-node--pulse', isPulsing);
      el.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');

      var glow = el.querySelector('.orbital-node-glow');
      if (glow) {
        var glowSize = item.energy * 0.45 + 36;
        glow.style.width = glowSize + 'px';
        glow.style.height = glowSize + 'px';
      }
    });

    positionDetailAnchor();
  }

  function closeDetail() {
    expandedId = null;
    activeNodeId = null;
    pulseIds = {};
    renderDetail(null);
    updateNodeStyles();
    startRotation();
  }

  function openDetail(id) {
    if (expandedId === id) {
      closeDetail();
      return;
    }

    expandedId = id;
    activeNodeId = id;
    pulseIds = {};
    getRelatedItems(id).forEach(function (relId) {
      pulseIds[relId] = true;
    });
    stopRotation();
    renderDetail(getItem(id));
    updateNodeStyles();
  }

  function startRotation() {
    if (reducedMotion || expandedId) return;
    stopRotation();
    rotationTimer = window.setInterval(function () {
      rotationAngle = (rotationAngle + 0.3) % 360;
      updateNodeStyles();
    }, 50);
  }

  function stopRotation() {
    if (rotationTimer) {
      window.clearInterval(rotationTimer);
      rotationTimer = null;
    }
  }

  nodesEl.addEventListener('click', function (event) {
    var nodeBtn = event.target.closest('.orbital-node');
    if (!nodeBtn) return;
    event.preventDefault();
    event.stopPropagation();
    openDetail(parseInt(nodeBtn.getAttribute('data-id'), 10));
  });

  detailEl.addEventListener('click', function (event) {
    var jumpBtn = event.target.closest('[data-jump]');
    if (jumpBtn) {
      event.preventDefault();
      event.stopPropagation();
      openDetail(parseInt(jumpBtn.getAttribute('data-jump'), 10));
      return;
    }

    if (event.target.closest('.orbital-detail-close')) {
      event.preventDefault();
      closeDetail();
    }
  });

  root.addEventListener('click', function (event) {
    if (event.target.closest('.orbital-node') || event.target.closest('.orbital-detail-anchor')) return;
    if (expandedId) closeDetail();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && expandedId) closeDetail();
  });

  function onResize() {
    radius = window.innerWidth <= 768 ? 118 : 168;
    updateNodeStyles();
  }

  buildNodes();
  window.addEventListener('resize', onResize);
  onResize();
  startRotation();
})();
