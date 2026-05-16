/* global window */
(function () {
  window.__propreneurListingShared = {
    cleanText: function (s) {
      if (!s || typeof s !== 'string') {
        return null;
      }
      var t = s.replace(/\s+/g, ' ').trim();
      return t === '' ? null : t;
    },
    uniqStrings: function (arr) {
      var out = [];
      var seen = {};
      (arr || []).forEach(function (u) {
        if (typeof u !== 'string' || u === '') {
          return;
        }
        u = u.trim();
        if (!seen[u]) {
          seen[u] = true;
          out.push(u);
        }
      });
      return out;
    },
    ukPostcode: function (text) {
      if (!text) {
        return null;
      }
      var m = String(text).toUpperCase().match(/\b([A-Z]{1,2}\d[\dA-Z]?\s*\d[A-Z]{2})\b/);
      return m ? m[1].replace(/\s+/g, ' ').trim() : null;
    },
    parsePrice: function (text) {
      if (text == null) {
        return null;
      }
      var s = String(text).replace(/[^0-9.]/g, '');
      if (s === '') {
        return null;
      }
      var n = parseFloat(s, 10);
      return isNaN(n) ? null : n;
    },
  };
})();
