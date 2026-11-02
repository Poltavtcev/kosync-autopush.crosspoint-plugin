// KOSync Auto-push: settings card for the web UI.
// Writes config.json in the plugin folder; device.json reads it as {cfg.*}
// when the firmware delivers reader.session events. No code runs on the device.
(function () {
  'use strict';

  // --- MD5 (KOSync's x-auth-key is md5(password); neither the browser's
  // crypto.subtle nor the device's /api/crypto offers MD5) ------------------
  function md5(str) {
    const bytes = new TextEncoder().encode(str);
    const n = (((bytes.length + 8) >>> 6) + 1) * 16;
    const w = new Array(n).fill(0);
    for (let i = 0; i < bytes.length; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
    w[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);
    const bits = bytes.length * 8;
    w[n - 2] = bits >>> 0;
    w[n - 1] = Math.floor(bits / 0x100000000) >>> 0;

    const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    const K = [];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

    for (let off = 0; off < n; off += 16) {
      let a = a0, b = b0, c = c0, d = d0;
      for (let i = 0; i < 64; i++) {
        let f, g;
        if (i < 16) { f = (b & c) | (~b & d); g = i; }
        else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
        else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
        else { f = c ^ (b | ~d); g = (7 * i) % 16; }
        const s = S[(i >> 4) * 4 + (i % 4)];
        const t = d;
        d = c;
        c = b;
        const x = (a + f + K[i] + w[off + g]) >>> 0;
        b = (b + ((x << s) | (x >>> (32 - s)))) >>> 0;
        a = t;
      }
      a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
    }
    let hex = '';
    for (const v of [a0, b0, c0, d0]) {
      for (let i = 0; i < 4; i++) hex += ((v >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    }
    return hex;
  }

  function randomHex(len) {
    const b = new Uint8Array(len);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }

  function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach((x) => { bin += String.fromCharCode(x); });
    return btoa(bin);
  }

  // Config values are pasted verbatim into the request URL, headers and JSON
  // body on the device, so anything that would break those is rejected here.
  const UNSAFE = /["\\\x00-\x1f\x7f]/;
  const DEFAULT_SERVER = 'https://sync.crosspointreader.com';

  function el(tag, props, children) {
    const e = document.createElement(tag);
    Object.assign(e, props || {});
    (children || []).forEach((c) => e.append(c));
    return e;
  }

  function field(label, input, hint) {
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    const row = el('div', { className: 'setting-row' }, [
      el('div', { className: 'setting-name', textContent: label }),
      el('div', { className: 'setting-control' }, [input])
    ]);
    row.style.display = 'block';
    row.style.marginBottom = '10px';
    if (hint) {
      const h = el('div', { textContent: hint });
      h.style.fontSize = '0.85em';
      h.style.opacity = '0.7';
      row.append(h);
    }
    return row;
  }

  CrossPoint.registerPlugin(async (container, api) => {
    let saved = {};
    try {
      const r = await fetch(api.pluginFile('config.json'), { cache: 'no-store' });
      if (r.ok) saved = await r.json();
    } catch (e) { /* no config yet */ }

    const server = el('input', { type: 'url', value: saved.server || DEFAULT_SERVER, placeholder: DEFAULT_SERVER });
    const user = el('input', { type: 'text', value: saved.user || '', autocomplete: 'username' });
    const pass = el('input', {
      type: 'password', autocomplete: 'new-password',
      placeholder: saved.key ? '(saved - leave blank to keep)' : ''
    });
    const device = el('input', { type: 'text', value: saved.device || 'CrossPoint' });
    const status = el('p', { className: 'status' });
    const testBtn = el('button', { className: 'btn', textContent: 'Test login', type: 'button' });
    const saveBtn = el('button', { className: 'btn btn-primary', textContent: 'Save', type: 'button' });
    testBtn.style.marginRight = '8px';

    function setStatus(msg, ok) {
      status.textContent = msg;
      status.style.color = ok === false ? '#c0392b' : ok ? '#27ae60' : '';
    }

    // Returns the config to save, or throws with a message for the user.
    function collect() {
      const cfg = {
        server: server.value.trim().replace(/\/+$/, ''),
        user: user.value.trim(),
        key: pass.value ? md5(pass.value) : (saved.key || ''),
        device: device.value.trim() || 'CrossPoint',
        device_id: saved.device_id || randomHex(16)
      };
      if (!/^https?:\/\/[^\s"\\]+$/.test(cfg.server)) throw new Error('Server URL must start with http:// or https://');
      if (!cfg.user) throw new Error('Username is required');
      if (!cfg.key) throw new Error('Password is required');
      for (const k of ['user', 'device']) {
        if (UNSAFE.test(cfg[k])) throw new Error('Quotes, backslashes and control characters are not allowed in ' + k);
      }
      return cfg;
    }

    async function testLogin(cfg) {
      const r = await api.relay('GET', cfg.server + '/users/auth', {
        'x-auth-user': cfg.user,
        'x-auth-key': cfg.key,
        'Accept': 'application/vnd.koreader.v1+json'
      }, '');
      if (r.status === 200) return;
      if (r.status === 401 || r.status === 403) throw new Error('Server rejected the username or password (HTTP ' + r.status + ')');
      throw new Error('Unexpected answer from server: HTTP ' + r.status);
    }

    testBtn.onclick = async () => {
      testBtn.disabled = true;
      setStatus('Testing...');
      try {
        await testLogin(collect());
        setStatus('Login OK.', true);
      } catch (e) {
        setStatus(e.message || String(e), false);
      } finally {
        testBtn.disabled = false;
      }
    };

    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      setStatus('Saving...');
      try {
        const cfg = collect();
        await api.writeFile(api.dir + '/config.json', toBase64(JSON.stringify(cfg)));
        saved = cfg;
        pass.value = '';
        pass.placeholder = '(saved - leave blank to keep)';
        setStatus('Saved. Restart the reader once after first install so it subscribes to events.', true);
      } catch (e) {
        setStatus(e.message || String(e), false);
      } finally {
        saveBtn.disabled = false;
      }
    };

    const intro = el('p', {
      textContent: 'Pushes your reading position (as a percentage) to a KOSync server when the reader goes to sleep. ' +
        'Upload only - pulling progress still uses Sync Progress in the reader menu.'
    });

    container.replaceChildren(
      el('h2', { textContent: 'KOSync Auto-push' }),
      intro,
      field('Server URL', server, 'e.g. https://sync.crosspointreader.com or https://sync.koreader.rocks'),
      field('Username', user),
      field('Password', pass, 'Stored only as its MD5 hash, as KOSync expects.'),
      field('Device name', device, 'Shown to other devices as the source of the progress.'),
      el('div', {}, [testBtn, saveBtn]),
      status
    );
  });
})();
