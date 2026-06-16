(function () {
  var TOKEN_KEY = 'carina_mobile_device_token';
  var SESSION_KEY = 'carina_mobile_session_id';

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function headers() {
    var token = localStorage.getItem(TOKEN_KEY);
    var h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  }

  function showPair() {
    document.getElementById('pair-panel').classList.add('active');
    document.getElementById('chat-panel').classList.remove('active');
    document.getElementById('status').textContent = 'Pair with your desktop Carina instance';
  }

  function showChat() {
    document.getElementById('pair-panel').classList.remove('active');
    document.getElementById('chat-panel').classList.add('active');
    document.getElementById('status').textContent = 'Paired mobile companion';
  }

  function appendMessage(role, text) {
    var el = document.createElement('div');
    el.className = 'msg ' + role;
    el.textContent = text;
    document.getElementById('messages').appendChild(el);
    el.scrollIntoView({ block: 'end' });
  }

  async function pairDevice(token, name) {
    var res = await fetch('/api/pair/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, deviceName: name || 'Mobile device' }),
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Pairing failed');
    localStorage.setItem(TOKEN_KEY, data.token);
    return data;
  }

  async function sendMessage(text) {
    var sessionId = localStorage.getItem(SESSION_KEY) || 'mobile-default';
    var res = await fetch('/api/chat', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ message: text, sessionId: sessionId }),
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.error || 'Chat failed');
    }

    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var assistant = '';
    var bubble = document.createElement('div');
    bubble.className = 'msg assistant';
    document.getElementById('messages').appendChild(bubble);

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      assistant += decoder.decode(chunk.value, { stream: true });
      bubble.textContent = assistant;
      bubble.scrollIntoView({ block: 'end' });
      var match = assistant.match(/"sessionId"\s*:\s*"([^"]+)"/);
      if (match) localStorage.setItem(SESSION_KEY, match[1]);
    }
  }

  async function boot() {
    var urlToken = qs('token');
    if (urlToken) {
      document.getElementById('pair-token').value = urlToken;
    }

    if (localStorage.getItem(TOKEN_KEY)) {
      showChat();
      appendMessage('system', 'Ready. Messages use your paired device session.');
      return;
    }

    showPair();
    document.getElementById('pair-btn').addEventListener('click', async function () {
      var errEl = document.getElementById('pair-error');
      errEl.hidden = true;
      try {
        var token = document.getElementById('pair-token').value.trim();
        var name = document.getElementById('device-name').value.trim();
        if (!token) throw new Error('Token is required');
        await pairDevice(token, name);
        showChat();
        appendMessage('system', 'Paired successfully.');
      } catch (err) {
        errEl.textContent = err.message || 'Pairing failed';
        errEl.hidden = false;
      }
    });

    document.getElementById('composer').addEventListener('submit', async function (e) {
      e.preventDefault();
      var input = document.getElementById('prompt');
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      appendMessage('user', text);
      try {
        await sendMessage(text);
      } catch (err) {
        appendMessage('system', err.message || 'Send failed');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
