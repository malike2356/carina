(function () {
  var hamburger = document.getElementById('nav-hamburger');
  var panel = document.getElementById('nav-mobile-panel');
  if (!hamburger || !panel) return;

  hamburger.addEventListener('click', function () {
    var open = panel.classList.contains('open');
    panel.classList.toggle('open', !open);
    hamburger.setAttribute('aria-expanded', String(!open));
    panel.setAttribute('aria-hidden', String(open));
  });

  panel.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      panel.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      panel.setAttribute('aria-hidden', 'true');
    });
  });
})();
