/**
 * HireAiva interactive product demos.
 * Clinicom-style beat sync, but advances DOM step panels instead of video.
 */
(function () {
  'use strict';

  var DEFAULT_PANEL = 'live-telegram';

  var WORKFLOWS = {
    register: [
      { step: 0, label: 'Create your account', beat: 0, hold: 2200 },
      { step: 1, label: 'Choose a starting role', beat: 1, hold: 2400 },
      { step: 2, label: 'Connect a channel', beat: 2, hold: 2400 },
      { step: 3, label: 'Launch into the workspace', beat: 3, hold: 2600 }
    ],
    workspace: [
      { step: 0, label: 'Open your Aiva home', beat: 0, hold: 2200 },
      { step: 1, label: 'See workers and shortcuts', beat: 1, hold: 2600 },
      { step: 2, label: 'Review approvals and activity', beat: 2, hold: 2600 },
      { step: 3, label: 'Jump into a worker chat', beat: 3, hold: 2400 }
    ],
    automation: [
      { step: 0, label: 'Open Automations tab', beat: 0, hold: 2000 },
      { step: 1, label: 'Describe a recurring job', beat: 1, hold: 2600 },
      { step: 2, label: 'Morning briefing is live', beat: 2, hold: 2800 },
      { step: 3, label: 'Runs while you sleep', beat: 3, hold: 2400 }
    ],
    telegram: [
      { step: 0, label: 'Open Telegram connect', beat: 0, hold: 2000 },
      { step: 1, label: 'Paste BotFather token', beat: 1, hold: 2400 },
      { step: 2, label: 'Channel shows Connected', beat: 2, hold: 2400 },
      { step: 3, label: 'Aiva replies in Telegram', beat: 3, hold: 2800 }
    ],
    email: [
      { step: 0, label: 'Open the shared inbox', beat: 0, hold: 2200 },
      { step: 1, label: 'Read a high-urgency thread', beat: 1, hold: 2400 },
      { step: 2, label: 'Generate a draft reply', beat: 2, hold: 2600 },
      { step: 3, label: 'Send or submit for approval', beat: 3, hold: 2600 }
    ],
    calendar: [
      { step: 0, label: 'Open your calendar', beat: 0, hold: 2000 },
      { step: 1, label: 'Type a natural-language event', beat: 1, hold: 2400 },
      { step: 2, label: 'Confirm and save', beat: 2, hold: 2400 },
      { step: 3, label: 'Synced across Google and local', beat: 3, hold: 2600 }
    ],
    notes: [
      { step: 0, label: 'Open Notes', beat: 0, hold: 2000 },
      { step: 1, label: 'Capture a note or reminder', beat: 1, hold: 2400 },
      { step: 2, label: 'Tag as Reminder or Task', beat: 2, hold: 2400 },
      { step: 3, label: 'Hand off to calendar or automation', beat: 3, hold: 2600 }
    ],
    documents: [
      { step: 0, label: 'Open Documents', beat: 0, hold: 2000 },
      { step: 1, label: 'Create a workspace doc', beat: 1, hold: 2400 },
      { step: 2, label: 'Ask Aiva to write inline', beat: 2, hold: 2600 },
      { step: 3, label: 'Train from Drive uploads', beat: 3, hold: 2600 }
    ],
    contacts: [
      { step: 0, label: 'Open Contacts', beat: 0, hold: 2000 },
      { step: 1, label: 'Resync Google or import CSV', beat: 1, hold: 2400 },
      { step: 2, label: 'Open a contact dossier', beat: 2, hold: 2400 },
      { step: 3, label: 'Aivas search this directory', beat: 3, hold: 2600 }
    ],
    research: [
      { step: 0, label: 'Start a research paper', beat: 0, hold: 2200 },
      { step: 1, label: 'Aiva is researching', beat: 1, hold: 2600 },
      { step: 2, label: 'Review cited sources', beat: 2, hold: 2600 },
      { step: 3, label: 'Save to Documents', beat: 3, hold: 2400 }
    ],
    businesslines: [
      { step: 0, label: 'Import your business line', beat: 0, hold: 2200 },
      { step: 1, label: 'Simulate an inbound message', beat: 1, hold: 2400 },
      { step: 2, label: 'See pipeline stage counts', beat: 2, hold: 2400 },
      { step: 3, label: 'Ready for live channels', beat: 3, hold: 2600 }
    ],
    outreach: [
      { step: 0, label: 'New lead in CRM', beat: 0, hold: 2200 },
      { step: 1, label: 'Qualification fields captured', beat: 1, hold: 2400 },
      { step: 2, label: 'Draft follow-up for approval', beat: 2, hold: 2600 },
      { step: 3, label: 'Pipeline stage updated', beat: 3, hold: 2400 }
    ],
    property: [
      { step: 0, label: 'Run due diligence', beat: 0, hold: 2200 },
      { step: 1, label: 'Review Land Registry and EPC', beat: 1, hold: 2600 },
      { step: 2, label: 'Run BTL calculator', beat: 2, hold: 2600 },
      { step: 3, label: 'Save to your workspace', beat: 3, hold: 2400 }
    ]
  };

  var HASH_TO_PANEL = {
    register: 'live-register',
    registration: 'live-register',
    workspace: 'live-workspace',
    automation: 'live-automation',
    automations: 'live-automation',
    telegram: 'live-telegram',
    email: 'live-email',
    calendar: 'live-calendar',
    notes: 'live-notes',
    documents: 'live-documents',
    docs: 'live-documents',
    contacts: 'live-contacts',
    research: 'live-research',
    businesslines: 'live-businesslines',
    outreach: 'live-outreach',
    property: 'live-property',
    'live-register': 'live-register',
    'live-workspace': 'live-workspace',
    'live-automation': 'live-automation',
    'live-telegram': 'live-telegram',
    'live-email': 'live-email',
    'live-calendar': 'live-calendar',
    'live-notes': 'live-notes',
    'live-documents': 'live-documents',
    'live-contacts': 'live-contacts',
    'live-research': 'live-research',
    'live-businesslines': 'live-businesslines',
    'live-outreach': 'live-outreach',
    'live-property': 'live-property'
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function syncBeats(workflow, beatIndex) {
    document.querySelectorAll('.workflow-beats[data-beats-for="' + workflow + '"]').forEach(function (list) {
      Array.prototype.forEach.call(list.children, function (li, index) {
        li.classList.toggle('is-active', index === beatIndex);
        li.classList.toggle('is-done', index < beatIndex);
      });
    });
  }

  function setStep(player, stepIndex, label, progress) {
    var steps = player.querySelectorAll('.live-step');
    steps.forEach(function (node) {
      var n = Number(node.getAttribute('data-step'));
      node.classList.toggle('is-active', n === stepIndex);
    });
    var chip = player.querySelector('[data-workflow-label]');
    if (chip && label) chip.textContent = label;
    var bar = player.querySelector('.workflow-progress i');
    if (bar) bar.style.width = Math.round(progress * 100) + '%';
  }

  function createController(player) {
    var workflow = player.getAttribute('data-workflow') || 'telegram';
    var timeline = WORKFLOWS[workflow] || WORKFLOWS.telegram;
    var timer = null;
    var index = 0;
    var running = false;

    function paint(i) {
      var frame = timeline[i] || timeline[0];
      var progress = (i + 1) / timeline.length;
      setStep(player, frame.step, frame.label, progress);
      syncBeats(workflow, frame.beat);
    }

    // Always leave step 0 painted so the frame is never empty.
    paint(0);

    function stop() {
      running = false;
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      // Keep the current frame visible after stop.
      paint(index);
    }

    function tick() {
      if (!running) return;
      paint(index);
      var frame = timeline[index];
      var hold = frame && frame.hold ? frame.hold : 2200;
      timer = window.setTimeout(function () {
        index = (index + 1) % timeline.length;
        if (index === 0) {
          timer = window.setTimeout(tick, 700);
        } else {
          tick();
        }
      }, hold);
    }

    function start() {
      if (running) return;
      running = true;
      index = 0;
      tick();
    }

    function jump(beat) {
      stop();
      index = Math.max(0, Math.min(beat, timeline.length - 1));
      paint(index);
      if (!reduceMotion) {
        running = true;
        tick();
      }
    }

    if (reduceMotion) {
      paint(timeline.length - 1);
      return { start: function () { paint(timeline.length - 1); }, stop: stop, jump: jump, workflow: workflow };
    }

    return { start: start, stop: stop, jump: jump, workflow: workflow };
  }

  function bindBeatClicks(controller) {
    document.querySelectorAll('.workflow-beats[data-beats-for="' + controller.workflow + '"]').forEach(function (list) {
      Array.prototype.forEach.call(list.children, function (li, beatIndex) {
        li.style.cursor = 'pointer';
        li.addEventListener('click', function () {
          controller.jump(beatIndex);
        });
      });
    });
  }

  var players = Array.prototype.slice.call(document.querySelectorAll('.live-demo[data-workflow]'));
  if (!players.length) return;

  var controllers = players.map(function (player) {
    var c = createController(player);
    bindBeatClicks(c);
    return { player: player, controller: c };
  });

  var tabs = Array.prototype.slice.call(document.querySelectorAll('.live-demo-tab'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.live-demo-panel'));

  function isDemoPanelId(id) {
    if (!id) return false;
    var el = document.getElementById(id);
    return !!(el && el.classList.contains('live-demo-panel'));
  }

  function resolvePanelId(candidate) {
    if (isDemoPanelId(candidate)) return candidate;
    if (HASH_TO_PANEL[candidate] && isDemoPanelId(HASH_TO_PANEL[candidate])) {
      return HASH_TO_PANEL[candidate];
    }
    if (isDemoPanelId(DEFAULT_PANEL)) return DEFAULT_PANEL;
    if (panels[0]) return panels[0].id;
    return null;
  }

  function activateTab(rawTarget) {
    var target = resolvePanelId(rawTarget);
    if (!target) return;

    tabs.forEach(function (tab) {
      var on = tab.getAttribute('data-live-demo') === target;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(function (panel) {
      panel.classList.toggle('is-active', panel.id === target);
    });

    // Guarantee exactly one panel stays visible.
    var active = document.querySelector('.live-demo-panel.is-active');
    if (!active) {
      var fallback = document.getElementById(DEFAULT_PANEL) || panels[0];
      if (fallback) fallback.classList.add('is-active');
      active = fallback;
      target = fallback ? fallback.id : target;
      tabs.forEach(function (tab) {
        var on = tab.getAttribute('data-live-demo') === target;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    controllers.forEach(function (entry) {
      entry.controller.stop();
    });

    if (!active) return;
    active.querySelectorAll('.live-demo[data-workflow]').forEach(function (player) {
      var match = controllers.find(function (entry) { return entry.player === player; });
      if (match) match.controller.start();
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activateTab(tab.getAttribute('data-live-demo'));
    });
  });

  function startActivePlayers() {
    var active = document.querySelector('.live-demo-panel.is-active');
    if (!active) {
      activateTab(DEFAULT_PANEL);
      return;
    }
    active.querySelectorAll('.live-demo[data-workflow]').forEach(function (player) {
      var match = controllers.find(function (entry) { return entry.player === player; });
      if (match) match.controller.start();
    });
  }

  // Keep the active demo playing when in view; never leave zero panels active.
  if ('IntersectionObserver' in window && !reduceMotion) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var match = controllers.find(function (c) { return c.player === entry.target; });
        if (!match) return;
        var panel = entry.target.closest('.live-demo-panel');
        var isActivePanel = !panel || panel.classList.contains('is-active');
        if (entry.isIntersecting && isActivePanel) {
          match.controller.start();
        } else if (!entry.isIntersecting && isActivePanel) {
          // Pause looping off-screen, but leave the painted frame visible.
          match.controller.stop();
        }
      });
    }, { threshold: 0.2 });

    controllers.forEach(function (entry) {
      observer.observe(entry.player);
    });
  }

  // Deep-link support: /demo/#telegram etc. Ignore section anchors like #aiva-in-action.
  function applyHash() {
    var hash = (location.hash || '').replace(/^#/, '');
    if (!hash) {
      activateTab(DEFAULT_PANEL);
      return;
    }
    if (hash.indexOf('shot-') === 0) {
      var shotKey = hash.slice(5);
      var fromShot = resolvePanelId(shotKey);
      if (fromShot) activateTab(fromShot);
      else activateTab(DEFAULT_PANEL);
      var shot = document.getElementById(hash);
      if (shot) shot.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    var mapped = HASH_TO_PANEL[hash];
    if (mapped || isDemoPanelId(hash)) {
      activateTab(mapped || hash);
      return;
    }
    // Non-demo hashes (#aiva-in-action, #pricing, #watch): keep default demo visible.
    activateTab(DEFAULT_PANEL);
  }

  window.addEventListener('hashchange', applyHash);

  // First paint: default Telegram (or hash if it is a real demo panel).
  applyHash();
  startActivePlayers();
})();
