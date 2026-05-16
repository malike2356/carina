(function () {
  var ext = typeof browser !== 'undefined' ? browser : chrome;

  ext.storage.sync.get(['apiBase', 'token', 'strategy'], function (data) {
    if (data.apiBase) {
      document.getElementById('apiBase').value = data.apiBase;
    }
    if (data.token) {
      document.getElementById('token').value = data.token;
    }
    if (data.strategy) {
      document.getElementById('strategy').value = data.strategy;
    }
  });

  document.getElementById('saveBtn').addEventListener('click', function () {
    var base = document.getElementById('apiBase').value.trim().replace(/\/$/, '');
    var token = document.getElementById('token').value.trim();
    var strategy = document.getElementById('strategy').value;
    ext.storage.sync.set({ apiBase: base, token: token, strategy: strategy }, function () {
      document.getElementById('status').textContent = 'Saved.';
    });
  });
})();
