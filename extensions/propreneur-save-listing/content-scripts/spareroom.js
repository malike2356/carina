/* global window, document */
(function () {
  var S = window.__propreneurListingShared || {};
  var url = location.href;
  var title = S.cleanText(document.querySelector('h1')?.textContent) || S.cleanText(document.querySelector('meta[property="og:title"]')?.getAttribute('content'));
  var desc = S.cleanText(document.querySelector('meta[property="og:description"]')?.getAttribute('content'));
  var imgs = [];
  document.querySelectorAll('img[src*="spareroom"]').forEach(function (img) {
    var s = img.getAttribute('src');
    if (s && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(s)) {
      imgs.push(s.split('?')[0]);
    }
  });
  imgs = S.uniqStrings ? S.uniqStrings(imgs) : imgs;
  var bodyText = document.body ? document.body.innerText : '';
  var pc = S.ukPostcode ? S.ukPostcode(bodyText) : null;
  window.__propreneurListingPayload = {
    success: true,
    platform: 'spareroom',
    source_url: url,
    title: title,
    description: desc,
    address: null,
    postcode: pc,
    price: null,
    bedrooms: null,
    bathrooms: null,
    property_type: null,
    tenure: null,
    images: imgs.slice(0, 40),
    floor_plans: [],
    epc_rating: null,
    listed_date: null,
    key_features: [],
    council_tax_band: null,
    price_history: [],
  };
})();
