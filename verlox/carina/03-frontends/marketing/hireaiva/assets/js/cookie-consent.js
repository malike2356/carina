(function () {
  var KEY = 'carina_cookie_consent';
  if (localStorage.getItem(KEY)) return;

  var bar = document.createElement('div');
  bar.id = 'cookie-consent-bar';
  bar.innerHTML =
    '<div class="cookie-consent-inner">' +
    '<p>We use cookies and analytics to improve your experience. ' +
    '<a href="/privacy/">Privacy Policy</a></p>' +
    '<div class="cookie-consent-actions">' +
    '<button type="button" id="cookie-decline">Decline</button>' +
    '<button type="button" id="cookie-accept">Accept</button>' +
    '</div></div>';

  var style = document.createElement('style');
  style.textContent =
    '#cookie-consent-bar{position:fixed;left:0;right:0;bottom:0;z-index:300;background:rgba(9,22,30,.96);border-top:1px solid rgba(26,95,122,.18);padding:1rem 1.25rem;font-family:Instrument Sans,system-ui,sans-serif}' +
    '#cookie-consent-bar p{color:#7a9daf;font-size:.875rem;margin:0}' +
    '#cookie-consent-bar a{color:#f5a623}' +
    '.cookie-consent-inner{max-width:960px;margin:0 auto;display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between}' +
    '.cookie-consent-actions{display:flex;gap:.5rem}' +
    '#cookie-consent-bar button{border:1px solid rgba(26,95,122,.18);background:#1a5f7a;color:#fff;border-radius:6px;padding:.45rem .9rem;cursor:pointer;font-size:.82rem}' +
    '#cookie-decline{background:transparent;color:#7a9daf}';

  document.head.appendChild(style);
  document.body.appendChild(bar);

  document.getElementById('cookie-accept').addEventListener('click', function () {
    localStorage.setItem(KEY, 'accepted');
    bar.remove();
  });
  document.getElementById('cookie-decline').addEventListener('click', function () {
    localStorage.setItem(KEY, 'declined');
    bar.remove();
  });
})();
