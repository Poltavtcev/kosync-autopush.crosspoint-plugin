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
      placeholder: (saved.key || saved.auth_header) ? '(saved - leave blank to keep)' : ''
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

    function collect() {
      const s = server.value.trim().replace(/\/+$/, '');
      const u = user.value.trim();
      const p = pass.value;
      const dev = device.value.trim() || 'CrossPoint';

      if (!/^https?:\/\/[^\s"\\]+$/.test(s)) throw new Error('Server URL must start with http:// or https://');
      if (!u) throw new Error('Username is required');
      if (!p && !saved.key && !saved.auth_header) throw new Error('Password is required');
      for (const k of ['user', 'device']) {
        const val = k === 'user' ? u : dev;
        if (UNSAFE.test(val)) throw new Error('Quotes, backslashes and control characters are not allowed in ' + k);
      }

      return {
        server: s,
        user: u,
        password: p,
        device: dev,
        device_id: saved.device_id || randomHex(16)
      };
    }

    async function detectAndTest(cfg) {
      const s = cfg.server;
      const u = cfg.user;
      const rawPass = cfg.password;

      const md5Key = rawPass ? md5(rawPass) : (saved.key || '');
      const basicAuth = rawPass ? ('Basic ' + toBase64(u + ':' + rawPass)) : (saved.auth_header || '');

      const hasKosyncInUrl = /\/kosync$/i.test(s);
      const cwaUrl = hasKosyncInUrl ? s : (s + '/kosync');
      const standardUrl = s;

      const candidates = hasKosyncInUrl
        ? [
            {
              type: 'cwa',
              name: 'Calibre-Web Automated',
              authUrl: cwaUrl + '/users/auth',
              syncUrl: cwaUrl + '/syncs/progress',
              headers: { 'Authorization': basicAuth, 'Accept': 'application/vnd.koreader.v1+json' }
            },
            {
              type: 'kosync',
              name: 'Standard KOSync',
              authUrl: standardUrl + '/users/auth',
              syncUrl: standardUrl + '/syncs/progress',
              headers: { 'x-auth-user': u, 'x-auth-key': md5Key, 'Accept': 'application/vnd.koreader.v1+json' }
            }
          ]
        : [
            {
              type: 'kosync',
              name: 'Standard KOSync',
              authUrl: standardUrl + '/users/auth',
              syncUrl: standardUrl + '/syncs/progress',
              headers: { 'x-auth-user': u, 'x-auth-key': md5Key, 'Accept': 'application/vnd.koreader.v1+json' }
            },
            {
              type: 'cwa',
              name: 'Calibre-Web Automated',
              authUrl: cwaUrl + '/users/auth',
              syncUrl: cwaUrl + '/syncs/progress',
              headers: { 'Authorization': basicAuth, 'Accept': 'application/vnd.koreader.v1+json' }
            }
          ];

      let lastAuthError = null;
      for (const cand of candidates) {
        try {
          const r = await api.relay('GET', cand.authUrl, cand.headers, '');
          if (r.status === 200) {
            return {
              type: cand.type,
              name: cand.name,
              syncUrl: cand.syncUrl,
              authHeader: cand.type === 'cwa' ? basicAuth : '',
              key: cand.type === 'kosync' ? md5Key : '',
              user: u
            };
          }
          if (r.status === 401 || r.status === 403) {
            lastAuthError = cand.name + ' rejected credentials (HTTP ' + r.status + ')';
          }
        } catch (e) {
          // Relay or network failure, try next candidate
        }
      }

      if (lastAuthError) throw new Error(lastAuthError);
      throw new Error('Connection failed: neither KOSync nor Calibre-Web Automated responded at ' + s);
    }

    testBtn.onclick = async () => {
      testBtn.disabled = true;
      setStatus('Detecting server and testing login...');
      try {
        const cfg = collect();
        const detected = await detectAndTest(cfg);
        setStatus('Login OK (' + detected.name + ' detected).', true);
      } catch (e) {
        setStatus(e.message || String(e), false);
      } finally {
        testBtn.disabled = false;
      }
    };

    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      setStatus('Detecting server...');
      try {
        const cfg = collect();
        let detected = null;
        try {
          detected = await detectAndTest(cfg);
        } catch (e) {
          if (e.message && e.message.includes('rejected credentials')) {
            throw e;
          }
          const isCwa = /\/kosync$/i.test(cfg.server);
          const rawPass = cfg.password;
          detected = {
            type: isCwa ? 'cwa' : 'kosync',
            name: isCwa ? 'Calibre-Web Automated (unverified)' : 'Standard KOSync (unverified)',
            syncUrl: isCwa ? (cfg.server + '/syncs/progress') : (cfg.server + '/syncs/progress'),
            authHeader: (isCwa && rawPass) ? ('Basic ' + toBase64(cfg.user + ':' + rawPass)) : (saved.auth_header || ''),
            key: (!isCwa && rawPass) ? md5(rawPass) : (saved.key || '')
          };
        }

        const toSave = {
          server: cfg.server,
          sync_url: detected.syncUrl,
          auth_type: detected.type,
          auth_header: detected.authHeader,
          user: cfg.user,
          key: detected.key,
          device: cfg.device,
          device_id: cfg.device_id
        };

        const deviceDoc = {
          title: "KOSync Auto-push",
          description: "Pushes reading progress to a KOSync server on sleep",
          config: { file: "config.json" },
          events: {
            "reader.session": {
              connect: true,
              request: {
                method: "PUT",
                url: "{cfg.sync_url}",
                headers: detected.type === 'cwa'
                  ? {
                      "Authorization": "{cfg.auth_header}",
                      "Accept": "application/vnd.koreader.v1+json",
                      "Content-Type": "application/json"
                    }
                  : {
                      "x-auth-user": "{cfg.user}",
                      "x-auth-key": "{cfg.key}",
                      "Accept": "application/vnd.koreader.v1+json",
                      "Content-Type": "application/json"
                    },
                body: "{\"document\":\"{event.document}\",\"progress\":\"crosspoint-autopush\",\"percentage\":{event.end_progress_bp}e-4,\"device\":\"{cfg.device}\",\"device_id\":\"{cfg.device_id}\"}"
              },
              toast: "KOSync: progress pushed"
            }
          }
        };

        await api.writeFile(api.dir + '/config.json', toBase64(JSON.stringify(toSave, null, 2)));
        await api.writeFile(api.dir + '/device.json', toBase64(JSON.stringify(deviceDoc, null, 2)));

        saved = toSave;
        pass.value = '';
        pass.placeholder = '(saved - leave blank to keep)';
        setStatus('Saved (' + detected.name + '). Restart the reader once after first install so it subscribes to events.', true);
      } catch (e) {
        setStatus(e.message || String(e), false);
      } finally {
        saveBtn.disabled = false;
      }
    };

    const intro = el('p', {
      textContent: 'Pushes your reading position (as a percentage) to a KOSync or Calibre-Web Automated server when the reader goes to sleep. ' +
        'Upload only - pulling progress still uses Sync Progress in the reader menu.'
    });

    container.replaceChildren(
      el('h2', { textContent: 'KOSync Auto-push' }),
      intro,
      field('Server URL', server, 'e.g. https://sync.crosspointreader.com or http://192.168.1.100:8083'),
      field('Username', user),
      field('Password', pass, 'Stored securely based on detected server type.'),
      field('Device name', device, 'Shown to other devices as the source of the progress.'),
      el('div', {}, [testBtn, saveBtn]),
      status
    );
  });
})();
