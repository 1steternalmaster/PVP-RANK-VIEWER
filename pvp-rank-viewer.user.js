// ==UserScript==
// @name         PvP Rank Viewer (My Guild + Everyone)
// @namespace    https://demonicscans.org/
// @version      6.0.1
// @description  RANK button on the PvP page. Your guild: guild member list. Everyone else: PvP points from each profile; players in no PvP party are marked unqualified.
// @match        https://demonicscans.org/pvp.php*
// @author       WRiTER
// @icon         https://demonicscans.org/images/pvp/party_image/party_88_20260403122525_d936f6b5.webp
// @updateURL    https://raw.githubusercontent.com/1steternalmaster/PVP-RANK-VIEWER/main/pvp-viewer.user.js
// @downloadURL  https://raw.githubusercontent.com/1steternalmaster/PVP-RANK-VIEWER/main/pvp-viewer.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  if (window.__pvpRankLoaded) return;
  window.__pvpRankLoaded = true;

  const PAGE_T = Date.now();
  const BASE = location.origin + '/';
  const BTN_ID = 'pvr-open-btn';
  const MODAL_ID = 'pvrModal';
  const PLAYERS_KEY = 'pvr_players_v4';
  const GUILDS_KEY = 'pvr_guilds_v4';
  ['pvr_everyone_cache_v1', 'pvr_players_v2', 'pvr_guilds_v2', 'pvr_players_v3', 'pvr_guilds_v3'].forEach((k) => { try { localStorage.removeItem(k); } catch (_) {} });

  const PAGE_SIZE = 100;
  const TOP_N = 300;
  const GUILD_CONC = 28;
  const PLAYER_CONC = 64;
  const DIR_CONC = 12;
  const GUILDS_TTL = 6 * 60 * 60 * 1000;
  const AUTO_TOP_AGE = 5 * 60 * 1000;
  const PROFILE_FRESH_MS = 10 * 60 * 1000;
  const PROFILE_STALE_MS = 2 * 60 * 60 * 1000;

  const style = document.createElement('style');
  style.textContent = `

    #${BTN_ID} { min-width: 0 !important; width: auto !important; flex: 0 0 auto; padding: 10px 18px; }

    #${MODAL_ID} { z-index: 10060; }
    #${MODAL_ID} .rewardBox { width: min(780px, 100%); display: flex; flex-direction: column; }
    #${MODAL_ID} .rewardBody { display: flex; flex-direction: column; min-height: 0; }

    .pvr-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .pvr-controls { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; }
    .pvr-controls input[type="text"] { flex: 1 1 200px; width: auto; }
    .pvr-controls select { flex: 0 0 auto; width: auto; }
    .pvr-status { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; }
    .pvr-status .section-btn { padding: 6px 12px; font-size: 11px; }

    .pvr-scan {
      margin-bottom: 10px; padding: 12px; border-radius: 12px;
      border: 1px solid rgba(148, 163, 184, 0.18); background: rgba(15, 23, 42, 0.42);
    }
    .pvr-scan[hidden] { display: none; }
    .pvr-scan-text { font-size: 12px; color: var(--muted); line-height: 1.55; }
    .pvr-scan .achievement-bar { margin: 8px 0 10px; }
    .pvr-scan-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }

    .pvr-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 50vh; padding-right: 2px; }
    .pvr-row { flex-direction: row !important; align-items: center !important; justify-content: space-between; gap: 12px; padding: 8px 12px; }
    .pvr-row .member-main { flex: 1 1 auto; }
    .pvr-row .rank-chip { min-width: 46px; height: 40px; font-size: 13px; flex: none; }
    .pvr-row .avatar { width: 40px; height: 40px; flex: none; }
    .pvr-info { min-width: 0; }
    .pvr-row .member-name { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pvr-row .member-meta-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pvr-row.me {
      border-color: rgba(225, 182, 91, 0.7);
      background: rgba(225, 182, 91, 0.10);
      box-shadow: inset 3px 0 0 var(--accent);
    }
    .pvr-pills { display: flex; gap: 6px; flex: none; flex-wrap: wrap; justify-content: flex-end; }
    .pvr-more { display: flex; justify-content: center; padding: 10px 0 2px; }
    .pvr-msg { padding: 22px; text-align: center; color: var(--muted); font-size: 13px; line-height: 1.6; }
    .pvr-row.unq { opacity: 0.6; }
    .pvr-row.unq .pvr-pvp { text-decoration: line-through; opacity: 0.75; }
    .pvr-badge { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 10px; font-weight: 700; vertical-align: middle; border: 1px solid; }
    .pvr-badge-leader { color: #fde68a; border-color: rgba(250, 204, 21, 0.6); background: rgba(250, 204, 21, 0.12); }
    .pvr-badge-vice { color: #bfdbfe; border-color: rgba(96, 165, 250, 0.6); background: rgba(96, 165, 250, 0.12); }
    .pvr-party { cursor: pointer; text-decoration: underline dotted; }
    .pvr-party:hover { color: var(--accent); }
    .pvr-pill-unq { border-color: rgba(248, 113, 113, 0.55) !important; color: #fecaca !important; }
    .pvr-pill-unv { border-color: rgba(250, 204, 21, 0.55) !important; color: #fde68a !important; }

    @media (max-width: 760px) {
      .pvr-pills { flex-direction: column; align-items: flex-end; gap: 4px; }
      .pvr-row .rank-chip { min-width: 40px; }
    }
  `;
  document.head.appendChild(style);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const num = (s) => {
    const m = String(s == null ? '' : s).replace(/,/g, '').match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  };
  const fmt = (n) => Number(n || 0).toLocaleString();
  const pidOf = (a) => (a.getAttribute('href').match(/pid=(\d+)/) || [])[1];
  const cleanTag = (t) => String(t || '').trim().replace(/^\[+/, '[').replace(/\]+$/, ']');
  const cleanName = (n) => String(n || '').replace(/\s*\(you\)\s*$/i, '').trim();
  const cellText = (c) => (c ? c.textContent.trim() : '');
  const normRole = (r) => {
    r = String(r || '');
    if (/vice|co-?lead|officer/i.test(r)) return 'Vice';
    if (/lead/i.test(r)) return 'Leader';
    return '';
  };
  function parseLabel(raw) {
    const t = String(raw || '').replace(/\s+/g, ' ').trim();
    const m = t.match(/^(.*?)\s*Level\s*([\d,]+)\s*[·•|]\s*(.*)$/i);
    if (!m) return { name: t, level: 0, cls: '', role: '' };
    let rest = m[3], role = '';
    const rm = rest.match(/\s*(Vice[\s-]*Leader|Vice|Co-?Leader|Leader|Officer|Member)\s*$/i);
    if (rm) { role = rm[1]; rest = rest.slice(0, rm.index); }
    return { name: m[1].trim(), level: num(m[2]), cls: rest.trim(), role };
  }
  function spacedText(el) {
    const w = el.ownerDocument.createTreeWalker(el, 4);
    let s = '', n;
    while ((n = w.nextNode())) s += n.nodeValue + ' ';
    return s.replace(/\s+/g, ' ').trim();
  }

  const _ta = document.createElement('textarea');
  function decodeHtml(s) {
    _ta.innerHTML = String(s || '').replace(/<[^>]*>/g, '');
    return _ta.value.trim();
  }

  const AV_KEY = 'pvr_avatars_v1';
  const AV_MAX = 500;
  const AV_SIZE = 48;
  const AV_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="8" fill="#1e293b"/></svg>');
  const AV_CACHE = new Map();
  try { Object.entries(JSON.parse(localStorage.getItem(AV_KEY) || '{}')).forEach(([k, v]) => AV_CACHE.set(k, v)); } catch (_) {}
  let avSaveTimer = null;
  function saveAvatars() {
    if (avSaveTimer) return;
    avSaveTimer = setTimeout(() => {
      avSaveTimer = null;
      try {
        const keys = [...AV_CACHE.keys()];
        if (keys.length > AV_MAX) keys.slice(0, keys.length - AV_MAX).forEach((k) => AV_CACHE.delete(k));
        localStorage.setItem(AV_KEY, JSON.stringify(Object.fromEntries(AV_CACHE)));
      } catch (_) { }
    }, 1500);
  }
  function staticAvatar(img, src) {
    const hit = AV_CACHE.get(src);
    if (hit) { img.src = hit; return; }
    img.src = AV_PLACEHOLDER;
    const tmp = new Image();
    tmp.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = AV_SIZE;
        c.getContext('2d').drawImage(tmp, 0, 0, AV_SIZE, AV_SIZE);
        const url = c.toDataURL('image/jpeg', 0.7);
        AV_CACHE.set(src, url);
        saveAvatars();
        img.src = url;
      } catch (_) { img.src = src; }
    };
    tmp.onerror = () => { img.src = BASE + 'images/userpics/default.webp'; };
    tmp.src = src;
  }

  function normAvatar(src) {
    if (!src) return BASE + 'images/userpics/default.webp';
    if (/^https?:/i.test(src)) return src;
    return BASE + src.replace(/^\//, '');
  }

  function pill(label, value) {
    const d = document.createElement('div');
    d.className = 'info-pill';
    const s = document.createElement('strong');
    s.textContent = label;
    const v = document.createElement('span');
    v.textContent = value;
    d.append(s, ' ', v);
    return d;
  }

  function myPid() {
    const a = document.querySelector('#sideDrawer a[href*="player.php?pid="], .side-head a[href*="pid="]');
    return a ? pidOf(a) : null;
  }
  const ME = myPid();

  async function fetchText(url, signal) {
    let last;
    for (let t = 0; t < 3; t++) {
      try {
        const res = await fetch(url, { credentials: 'include', signal });
        if (res.status === 429 || res.status === 503) { await sleep(1500 * (t + 1)); last = new Error('HTTP ' + res.status); continue; }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.text();
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        last = e;
        await sleep(400);
      }
    }
    throw last || new Error('fetch failed');
  }
  const docFromHtml = (html) => new DOMParser().parseFromString(html, 'text/html');
  const fetchDoc = async (url, signal) => docFromHtml(await fetchText(url, signal));

  const noParty = (p) => !p || /^(none|no party|n\/a|-|\u2014|\u2013)?$/i.test(String(p).trim());

  function extractProfile(buf, final) {
    const lv = /<div class="muted">\s*Level\s+([\d,]+)\s*<\/div>/.exec(buf);
    const pts = /PvP Points:<\/strong>\s*<span>([\d,]+)<\/span>/.exec(buf);
    const party = /PvP Party:<\/strong>\s*<span>([\s\S]*?)<\/span>/.exec(buf);
    const headerDone = buf.indexOf('class="sec-head"') >= 0;
    if (!(lv && pts && party) && !headerDone && !final) return null;
    if (!lv && !pts) return { bad: true };
    const nm = /<h1>([\s\S]*?)<\/h1>/.exec(buf);
    const av = /<div class="avatar">\s*<img src="([^"]+)"/.exec(buf);
    const tier = /PvP Rank:<\/strong>\s*<span>([^<]*)<\/span>/.exec(buf);
    const gl = /profile-guild-link" href="guild_join_create\.php\?guild_id=\d+">\s*<strong>Guild:<\/strong>\s*<span>([\s\S]*?)<\/span>/.exec(buf);
    return {
      name: nm ? decodeHtml(nm[1]) : '',
      level: lv ? num(lv[1]) : 0,
      pvp: pts ? num(pts[1]) : 0,
      tier: tier ? decodeHtml(tier[1]) : '',
      party: party ? decodeHtml(party[1]) : '',
      avatar: av ? av[1] : '',
      guild: gl ? decodeHtml(gl[1]) : '',
    };
  }

  async function fetchProfile(pid, signal, pvpOnly) {
    let last;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(BASE + 'player.php?pid=' + pid, { credentials: 'include', cache: 'no-store', signal });
        if (res.status === 429 || res.status === 503) { await sleep(1500 * (attempt + 1)); last = new Error('HTTP ' + res.status); continue; }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '', seen = false, out = null;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = dec.decode(value, { stream: true });
          const scan = buf.slice(-300) + text;
          buf += text;
          if (pvpOnly) {
            const pm = /PvP Points:<\/strong>\s*<span>([\d,]+)<\/span>/.exec(buf);
            if (pm) { out = { pvp: num(pm[1]) }; break; }
          }
          if (!seen && (scan.includes('PvP Party:</strong>') || scan.includes('class="sec-head"'))) seen = true;
          if (seen) { out = extractProfile(buf, false); if (out) break; }
          if (buf.length > 700000) break;
        }
        reader.cancel().catch(() => {});
        return out || extractProfile(buf, true);
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        last = e;
        await sleep(400);
      }
    }
    throw last || new Error('fetch failed');
  }

  const headerCache = new WeakMap();
  function headerMap(table) {
    const m = { level: -1, pvp: -1, cls: -1 };
    if (!table) return m;
    if (headerCache.has(table)) return headerCache.get(table);
    const hr = table.querySelector('thead tr') || [...table.querySelectorAll('tr')].find((r) => r.querySelector('th'));
    if (hr) {
      [...hr.children].forEach((h, i) => {
        const t = h.textContent.trim().toLowerCase();
        if (m.level < 0 && /^(lv|lvl|level)\b/.test(t)) m.level = i;
        else if (m.pvp < 0 && /pvp/.test(t)) m.pvp = i;
        else if (m.cls < 0 && /class/.test(t)) m.cls = i;
      });
    }
    headerCache.set(table, m);
    return m;
  }

  const LAYOUT = {};
  const numStrict = (str) => {
    const t = String(str || '').trim();
    if (!/\d/.test(t)) return null;
    const m = t.replace(/,/g, '').match(/^\D*(\d+)\D*$/);
    return m ? parseInt(m[1], 10) : null;
  };
  function calibrate(rows) {
    const pv = new Map(), lv = new Map();
    rows.forEach((e) => {
      const kp = KNOWN_PVP.get(e.pid), kl = KNOWN_LEVEL.get(e.pid);
      if (kp === undefined && kl === undefined) return;
      e.td.forEach((c, i) => {
        const v = numStrict(c.textContent);
        if (v === null) return;
        if (kp !== undefined && Math.abs(v - kp) <= Math.max(30, kp * 0.04)) pv.set(i, (pv.get(i) || 0) + 1);
        if (kl !== undefined && Math.abs(v - kl) <= 2) lv.set(i, (lv.get(i) || 0) + 1);
      });
    });
    const best = (m) => { let bi = -1, bc = 0; m.forEach((c, i) => { if (c > bc) { bc = c; bi = i; } }); return [bi, bc]; };
    const [pi, pc] = best(pv);
    const [li, lc] = best(lv);
    const okP = pc >= 2, okL = lc >= 1 && li !== pi;
    if (!okP && !okL) return null;
    return { pvp: okP ? pi : -1, level: okL ? li : -1 };
  }

  function parseMembers(doc, kind) {
    const links = [...doc.querySelectorAll('a[href*="player.php"]')].filter(
      (a) => /pid=\d+/.test(a.getAttribute('href')) && !a.closest('.side-drawer, .game-topbar, #gcw_container, nav')
    );
    const nameByPid = new Map();
    links.forEach((a) => {
      const p = pidOf(a), t = a.textContent.trim();
      if (p && t && !nameByPid.has(p)) nameByPid.set(p, t);
    });
    const entries = [];
    const seenPid = new Set();
    links.forEach((a) => {
      const pid = pidOf(a);
      if (!pid || seenPid.has(pid)) return;
      seenPid.add(pid);
      const tr = a.closest('tr');
      entries.push({ pid, a, tr, td: tr ? [...tr.children].filter((c) => /^T[DH]$/.test(c.tagName)) : null });
    });
    const groups = new Map();
    entries.forEach((e) => {
      if (!e.tr || e.td.length < 3) return;
      const t = e.tr.closest('table');
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t).push(e);
    });
    const tableLayout = new Map();
    groups.forEach((rows, t) => {
      const lay = calibrate(rows);
      if (lay) { tableLayout.set(t, lay); if (kind) LAYOUT[kind] = lay; }
    });

    const out = [];
    entries.forEach((e) => {
      const { pid, a, tr } = e;
      let level = null, pvp = null, cls = '', row;

      if (tr) {
        row = tr;
        const td = e.td;
        if (td.length < 3) return;
        const table = tr.closest('table');
        const hdr = headerMap(table);
        const wide = td.length >= 8;
        const at = (i) => (i >= 0 && i < td.length ? td[i] : null);
        const lay = tableLayout.get(table) || (kind && LAYOUT[kind]) || null;
        if (lay) {
          if (lay.pvp >= 0) pvp = num(cellText(at(lay.pvp)));
          if (lay.level >= 0) level = num(cellText(at(lay.level)));
        }
        td.forEach((c) => {
          const hint = ((c.getAttribute('data-label') || c.getAttribute('data-title') || c.getAttribute('data-col') || '') + ' ' + c.className).toLowerCase();
          const txt = c.textContent.trim();
          if (pvp === null && (/pvp/.test(hint) || /^pvp\b/i.test(txt))) pvp = num(txt);
          else if (level === null && (/\b(lv|lvl|level)\b/.test(hint) || /^(lv\.?|level)\s*[:.]?\s*\d/i.test(txt))) level = num(txt);
          else if (!cls && /class/.test(hint)) cls = txt;
        });
        if (level === null && hdr.level >= 0) level = num(cellText(at(hdr.level)));
        if (pvp === null && hdr.pvp >= 0) pvp = num(cellText(at(hdr.pvp)));
        if (!cls && hdr.cls >= 0) cls = cellText(at(hdr.cls));
        if (wide) {
          if (level === null) level = num(cellText(at(5)));
          if (pvp === null) pvp = num(cellText(at(7)));
          if (!cls) cls = cellText(at(6));
        }
      } else {
        row = a;
        for (let i = 0; i < 6; i++) {
          const p = row.parentElement;
          if (!p || p === doc.body) break;
          const pids = new Set([...p.querySelectorAll('a[href*="player.php"]')].map(pidOf).filter(Boolean));
          if (pids.size > 1) break;
          row = p;
        }
        const text = spacedText(row);
        const dsL = row.dataset.level || (row.querySelector('[data-level]') || {}).dataset?.level;
        const dsP = row.dataset.pvp || (row.querySelector('[data-pvp]') || {}).dataset?.pvp;
        const mL = text.match(/(?:^|[^a-z])(?:lv\.?|level)\s*:?\s*([\d,]+)/i);
        const mP = text.match(/pvp(?:\s*points?)?\s*:?\s*([\d,]+)/i);
        if (dsL) level = num(dsL); else if (mL) level = num(mL[1]);
        if (dsP) pvp = num(dsP); else if (mP) pvp = num(mP[1]);
        if (level === null && pvp === null) return;
      }

      if (/\d/.test(cls)) cls = '';
      const img = row.querySelector('img');
      const lab = parseLabel(nameByPid.get(pid));
      out.push({
        pid,
        name: cleanName(lab.name || (img && img.alt) || 'Player ' + pid),
        level: level || lab.level || 0,
        pvp: pvp || 0,
        cls: cls || (/\d/.test(lab.cls) ? '' : lab.cls),
        role: normRole(((row.querySelector('.role') || {}).textContent || '') || lab.role),
        avatar: normAvatar(img ? img.getAttribute('src') : ''),
      });
    });
    return out;
  }
  function parseGuildHtml(html) {
    let i = html.indexOf('<main');
    if (i < 0) i = html.indexOf('<table');
    return parseMembers(docFromHtml(i >= 0 ? html.slice(i) : html), 'guild');
  }
  const totalPagesText = (html) => {
    const m = html.match(/Page\s+\d+\s+of\s+(\d+)/i);
    return m ? parseInt(m[1], 10) : 1;
  };

  function parseDirectory(doc) {
    const guilds = [];
    let own = null;
    doc.querySelectorAll('.gd-card').forEach((card) => {
      const a = card.querySelector('h2 a[href*="guild_id="]');
      if (!a) return;
      const id = (a.getAttribute('href').match(/guild_id=(\d+)/) || [])[1];
      if (!id) return;
      if (card.classList.contains('gd-own')) own = id;
      const cap = (card.querySelector('.gd-capacity span') || {}).textContent || '';
      guilds.push({
        id,
        name: a.textContent.trim(),
        tag: cleanTag((card.querySelector('.gd-tag') || {}).textContent),
        members: num((cap.match(/([\d,]+)\s*\//) || [])[1]),
      });
    });
    return { guilds, own };
  }
  function readLeaderboardSeeds() {
    const out = [];
    const take = (card) => {
      const a = card.querySelector('a.leader-link[href*="pid="], a[href*="player.php?pid="]');
      if (!a) return;
      const meta = card.textContent.replace(/\s+/g, ' ');
      const m = meta.match(/([\d,]+)\s*pts/i);
      if (!m) return;
      const img = card.querySelector('.leader-avatar, img');
      out.push({ pid: pidOf(a), name: cleanName(a.textContent), pvp: num(m[1]), level: 0, avatar: normAvatar(img ? img.getAttribute('src') : '') });
    };
    document.querySelectorAll('.section').forEach((sec) => {
      const t = (sec.querySelector('.section-title') || {}).textContent || '';
      if (!/solo/i.test(t) || !/leaderboard/i.test(t)) return;
      sec.querySelectorAll('.leader-card').forEach(take);
    });
    if (!out.length) {
      document.querySelectorAll('.leader-card').forEach((card) => {
        const sec = card.closest('.section');
        const t = sec ? ((sec.querySelector('.section-title') || {}).textContent || '') : '';
        if (/party/i.test(t) || /leader:/i.test(card.textContent)) return;
        take(card);
      });
    }
    return out;
  }
  function readMe() {
    if (!ME) return null;
    const pillEl = [...document.querySelectorAll('.banner-pill, .info-pill')].find((p) => /solo points/i.test(p.textContent));
    const pvp = pillEl ? num(pillEl.textContent.replace(/solo points:?/i, '')) : 0;
    const lvEl = document.querySelector('.small-level, .gtb-level');
    const level = lvEl ? num(lvEl.textContent) : 0;
    const nameEl = document.querySelector('.small-name');
    const img = document.querySelector('.small-ava img');
    if (!pvp && !level) return null;
    return { pid: ME, name: cleanName(nameEl ? nameEl.textContent : '') || 'Player ' + ME, pvp, level, avatar: normAvatar(img ? img.getAttribute('src') : '') };
  }

  const SEEDS = readLeaderboardSeeds();
  const ME_SEED = readMe();
  if (ME_SEED && !SEEDS.some((s) => s.pid === ME_SEED.pid)) SEEDS.push(ME_SEED);
  else if (ME_SEED) { const s = SEEDS.find((x) => x.pid === ME_SEED.pid); if (!s.level) s.level = ME_SEED.level; }
  const KNOWN_PVP = new Map(SEEDS.filter((s) => s.pvp > 0).map((s) => [s.pid, s.pvp]));
  const KNOWN_LEVEL = new Map(SEEDS.filter((s) => s.level > 0).map((s) => [s.pid, s.level]));

  let modal = null;
  let tab = 'guild';
  let sortMode = 'pvp';
  let query = '';
  let limit = PAGE_SIZE;
  let hideZero = true;
  let hideUnq = false;
  let partyFilter = '';
  let mixUnq = true;
  const PREFS_KEY = 'pvr_prefs_v2';
  try {
    const sp = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (sp) { hideZero = sp.hideZero !== false; hideUnq = !!sp.hideUnq; mixUnq = sp.mixUnq !== false; }
  } catch (_) {}
  const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify({ hideZero, hideUnq, mixUnq })); } catch (_) {} };

  const players = new Map();
  const SEED_MAP = new Map(SEEDS.map((s) => [s.pid, s]));
  let ownPids = new Set();
  let playersUpdatedAt = 0;
  let guildsMeta = null;

  let guildData = [];
  let guildState = 'idle';
  let scanWarn = '';

  const newJob = () => ({ running: false, phase: '', done: 0, total: 0, page: 0, pages: 0, failed: 0, parsed: 0, profOk: 0, profBad: 0, abort: null });
  const jobAll = newJob();
  const jobGuild = newJob();

  const mk = (pid, o) => Object.assign({
    pid, name: '', level: 0, pvp: 0, cls: '', tag: '', gid: '', avatar: normAvatar(''), t: 0,
    party: '', tier: '', q: '?', profT: 0, listPvp: 0, src: 'list', role: '',
  }, o);

  function savePlayers() {
    try {
      const p = {};
      players.forEach((r) => { p[r.pid] = [r.name, r.level, r.pvp, r.cls, r.tag, r.gid, r.avatar.replace(BASE, ''), r.t, r.party, r.tier, r.q, r.profT, r.listPvp, r.src, r.role]; });
      playersUpdatedAt = Date.now();
      localStorage.setItem(PLAYERS_KEY, JSON.stringify({ t: playersUpdatedAt, p }));
    } catch (_) { }
  }
  function loadPlayers() {
    try {
      const c = JSON.parse(localStorage.getItem(PLAYERS_KEY) || 'null');
      if (!c) return;
      playersUpdatedAt = c.t || 0;
      Object.keys(c.p || {}).forEach((pid) => {
        const r = c.p[pid];
        players.set(pid, mk(pid, { name: r[0], level: r[1], pvp: r[2], cls: r[3] || '', tag: r[4] || '', gid: r[5] || '', avatar: normAvatar(r[6]), t: r[7] || 0, party: r[8] || '', tier: r[9] || '', q: r[10] || '?', profT: r[11] || 0, listPvp: r[12] || 0, src: r[13] || 'list', role: r[14] || '' }));
      });
    } catch (_) {}
  }
  function saveGuilds() {
    try { localStorage.setItem(GUILDS_KEY, JSON.stringify({ t: guildsMeta.t, ct: guildsMeta.ct || 0, own: guildsMeta.own, g: guildsMeta.guilds.map((g) => [g.id, g.tag, g.name, g.members]) })); } catch (_) {}
  }
  function loadGuilds() {
    try {
      const c = JSON.parse(localStorage.getItem(GUILDS_KEY) || 'null');
      if (c) guildsMeta = { t: c.t, ct: c.ct || 0, own: c.own, guilds: c.g.map((g) => ({ id: g[0], tag: g[1], name: g[2], members: g[3] })) };
    } catch (_) {}
  }
  loadPlayers();
  loadGuilds();
  SEEDS.forEach((s) => {
    const p = players.get(s.pid);
    if (!p) players.set(s.pid, mk(s.pid, { name: s.name, level: s.level || 0, pvp: s.pvp, avatar: s.avatar, t: PAGE_T, q: 'ok', src: 'seed', listPvp: s.pvp }));
    else if (p.t < PAGE_T) { p.pvp = s.pvp; if (s.level > 0) p.level = s.level; p.q = 'ok'; p.src = 'seed'; p.t = PAGE_T; }
  });

  const ownTag = () => {
    if (!guildsMeta || !guildsMeta.own) return '';
    const g = guildsMeta.guilds.find((x) => x.id === guildsMeta.own);
    return g ? g.tag : '';
  };

  async function pool(items, n, fn, job) {
    let i = 0;
    const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        if (job.abort.signal.aborted) return;
        const it = items[i++];
        try { await fn(it); }
        catch (e) { if (e && e.name === 'AbortError') return; job.failed++; }
      }
    });
    await Promise.all(workers);
  }

  let renderTimer = null;
  function scheduleRender() {
    if (renderTimer) return;
    renderTimer = setTimeout(() => { renderTimer = null; render(); }, 800);
  }

  async function ensureGuildList(job) {
    const signal = job.abort.signal;
    if (guildsMeta && Date.now() - guildsMeta.t < GUILDS_TTL) return guildsMeta.guilds;

    job.phase = 'dir'; job.page = 0; job.pages = 0; render();
    const dirUrl = (p) => BASE + 'guild_join_create.php?filter=all&sort=members&page=' + p;
    const first = await fetchDoc(dirUrl(1), signal);
    const m = (first.body ? first.body.textContent : '').match(/Page\s+\d+\s+of\s+(\d+)/i);
    job.pages = m ? parseInt(m[1], 10) : 1;
    job.page = 1;
    const d1 = parseDirectory(first);
    let guilds = d1.guilds;
    let own = d1.own;

    const nums = [];
    for (let p = 2; p <= job.pages; p++) nums.push(p);
    await pool(nums, DIR_CONC, async (p) => {
      const d = parseDirectory(await fetchDoc(dirUrl(p), signal));
      guilds.push(...d.guilds);
      if (d.own) own = d.own;
      job.page++;
      scheduleRender();
    }, job);
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');

    const uniq = new Map();
    guilds.forEach((g) => { if (g.members > 0 && !uniq.has(g.id)) uniq.set(g.id, g); });
    guildsMeta = { t: Date.now(), own: own || (guildsMeta && guildsMeta.own) || null, guilds: [...uniq.values()].sort((a, b) => b.members - a.members) };
    saveGuilds();
    return guildsMeta.guilds;
  }

  async function loadGuildData() {
    const rows = parseMembers(await fetchDoc(BASE + 'guild_members.php'), 'members');
    guildData = rows;
    ownPids = new Set(rows.map((r) => r.pid));
    const now = Date.now();
    const tag = ownTag();
    const gid = (guildsMeta && guildsMeta.own) || '';
    rows.forEach((r) => {
      const prev = players.get(r.pid);
      players.set(r.pid, mk(r.pid, {
        name: r.name,
        level: r.level || (prev ? prev.level : 0) || KNOWN_LEVEL.get(r.pid) || 0,
        pvp: r.pvp > 0 ? r.pvp : (KNOWN_PVP.get(r.pid) || 0),
        cls: r.cls,
        tag: tag || (prev ? prev.tag : ''),
        gid,
        avatar: r.avatar.endsWith('default.webp') && prev ? prev.avatar : r.avatar,
        t: now, q: 'ok', src: 'list', listPvp: r.pvp, profT: prev ? prev.profT : 0,
        party: prev ? prev.party : '', tier: prev ? prev.tier : '',
        role: r.role || (prev ? prev.role : ''),
      }));
    });
    return rows;
  }

  function applyProfile(pid, r) {
    const p = players.get(pid) || mk(pid, {});
    const own = ownPids.has(pid);
    if (r.level > 0) p.level = r.level;
    if (r.name && (!p.name || /^Player \d+$/.test(p.name))) p.name = r.name;
    if (r.avatar && p.avatar.endsWith('default.webp')) p.avatar = normAvatar(r.avatar);
    const lt = (r.guild.match(/^\s*(\[+[^\]]*\]+)/) || [])[1];
    if (!p.tag && lt) p.tag = cleanTag(lt);
    p.profT = Date.now();
    p.tier = r.tier;
    p.party = r.party;
    if (!own) {
      if (SEED_MAP.has(pid)) { p.pvp = SEED_MAP.get(pid).pvp; p.q = 'ok'; p.src = 'seed'; }
      else { p.pvp = r.pvp; p.q = noParty(r.party) ? 'no' : 'ok'; p.src = 'profile'; }
    }
    players.set(pid, p);
  }

  async function fetchProfiles(pids, job, pvpOnly) {
    job.phase = 'profiles'; job.done = 0; job.total = pids.length; render();
    await pool(pids, PLAYER_CONC, async (pid) => {
      try {
        const r = await fetchProfile(pid, job.abort.signal, pvpOnly);
        if (!r || r.bad) { job.profBad++; return; }
        job.profOk++;
        if (pvpOnly) { const p = players.get(pid); if (p) { p.pvp = SEED_MAP.has(pid) ? SEED_MAP.get(pid).pvp : r.pvp; p.t = Date.now(); } }
        else applyProfile(pid, r);
      } finally {
        job.done++;
        scheduleRender();
      }
    }, job);
  }

  function applyRow(r, g, job) {
    job.parsed++;
    const prev = players.get(r.pid);
    const level = r.level || (prev ? prev.level : 0) || KNOWN_LEVEL.get(r.pid) || 0;
    if (ownPids.has(r.pid)) {
      if (prev) { prev.tag = g.tag; prev.gid = g.id; if (!prev.level) prev.level = level; }
      return;
    }
    const base = {
      name: r.name,
      level,
      cls: r.cls || (prev ? prev.cls : ''),
      tag: g.tag,
      gid: g.id,
      avatar: r.avatar.endsWith('default.webp') && prev ? prev.avatar : r.avatar,
      listPvp: r.pvp,
      role: r.role || (prev ? prev.role : ''),
    };
    if (prev && prev.profT > 0 && prev.src !== 'list') { Object.assign(prev, base); return; }
    const seed = SEED_MAP.get(r.pid);
    players.set(r.pid, mk(r.pid, {
      ...base,
      pvp: seed ? seed.pvp : r.pvp,
      q: seed ? 'ok' : '?',
      src: seed ? 'seed' : 'list',
      t: Date.now(),
      profT: prev ? prev.profT : 0,
    }));
  }

  async function readGuild(g, job) {
    const signal = job.abort.signal;
    try {
      const url = BASE + 'guild_join_create.php?guild_id=' + g.id;
      const html = await fetchText(url, signal);
      const seen = new Set();
      const add = (rows) => {
        let fresh = 0;
        rows.forEach((r) => { if (!seen.has(r.pid)) { seen.add(r.pid); fresh++; applyRow(r, g, job); } });
        return fresh;
      };
      add(parseGuildHtml(html));
      const pages = Math.min(totalPagesText(html), 60);
      for (let p = 2; p <= pages; p++) {
        if (signal.aborted) break;
        if (!add(parseGuildHtml(await fetchText(url + '&page=' + p, signal)))) break;
      }
    } finally {
      job.done++;
      scheduleRender();
    }
  }

  async function crawlGuilds(guilds, job) {
    job.phase = 'guilds'; job.done = 0; job.total = guilds.length; job.parsed = 0; render();
    const own = guildsMeta && guildsMeta.own;
    const first = own ? guilds.filter((g) => g.id === own) : [];
    const rest = own ? guilds.filter((g) => g.id !== own) : guilds;
    for (const g of first) { try { await readGuild(g, job); } catch (e) { if (e && e.name === 'AbortError') return; job.failed++; } }
    await pool(rest, GUILD_CONC, (g) => readGuild(g, job), job);
    if (!job.abort.signal.aborted && job.parsed === 0) {
      scanWarn = 'No members could be read from the guild pages. Check PvpRank.debugGuild(' + (own || '5') + ') in the console.';
    }
  }

  async function scanAll(mode) {
    const job = jobAll;
    if (job.running) return;
    const hadScan = [...players.values()].some((p) => p.profT > 0 && !ownPids.has(p.pid));
    if (mode === 'top' && !hadScan) mode = 'full';
    Object.assign(job, newJob());
    job.running = true;
    job.abort = new AbortController();
    scanWarn = '';
    render();

    try {
      const guilds = await ensureGuildList(job);
      await loadGuildData();
      if (mode === 'full' && (!hadScan || !guildsMeta.ct || Date.now() - guildsMeta.ct > GUILDS_TTL)) {
        await crawlGuilds(guilds, job);
        if (!job.abort.signal.aborted) { guildsMeta.ct = Date.now(); saveGuilds(); }
      }

      const now = Date.now();
      let list;
      if (mode === 'top') {
        list = [...players.values()].filter((p) => !ownPids.has(p.pid) && p.q !== 'no').sort((a, b) => b.pvp - a.pvp).slice(0, TOP_N).map((p) => p.pid);
      } else {
        list = [...players.values()]
          .filter((p) => {
            if (ownPids.has(p.pid)) return !(p.level > 0) || !p.profT || now - p.profT > PROFILE_STALE_MS;
            if (!p.profT) return true;
            return now - p.profT > (p.q === 'ok' ? PROFILE_FRESH_MS : PROFILE_STALE_MS);
          })
          .sort((a, b) => (b.listPvp || b.pvp) - (a.listPvp || a.pvp))
          .map((p) => p.pid);
      }
      await fetchProfiles(list, job, mode === 'top');
      if (!job.abort.signal.aborted && job.profBad > 30 && job.profOk === 0) {
        scanWarn = 'Player profiles could not be read. Check PvpRank.debugPlayer(41236) in the console.';
      }
    } catch (e) {
      if (!(e && e.name === 'AbortError')) console.error('[PvpRank] scan failed', e);
    } finally {
      job.running = false;
      job.phase = '';
      savePlayers();
      render();
    }
  }
  const stopScan = () => { if (jobAll.abort) jobAll.abort.abort(); };

  const hasScan = () => [...players.values()].some((p) => p.profT > 0 && !ownPids.has(p.pid));
  function maybeAutoRefresh() {
    if (tab === 'all' && !jobAll.running && hasScan() && Date.now() - playersUpdatedAt > AUTO_TOP_AGE) scanAll('top');
  }

  let guildLoadedAt = 0;
  async function loadGuild() {
    if (guildState === 'ok' && Date.now() - guildLoadedAt < 60 * 1000) return;
    guildState = 'loading';
    render();
    try {
      await loadGuildData();
      guildLoadedAt = Date.now();
      guildState = guildData.length ? 'ok' : 'empty';
    } catch (e) {
      console.error('[PvpRank] guild load failed', e);
      guildState = 'error';
    }
    render();
    if (guildState === 'ok') {
      const job = jobGuild;
      if (job.running) return;
      Object.assign(job, newJob());
      job.running = true;
      job.abort = new AbortController();
      const nowG = Date.now();
      try { await fetchProfiles(guildData.filter((m) => { const p = players.get(m.pid) || {}; return !(p.level > 0) || !p.profT || nowG - p.profT > PROFILE_STALE_MS; }).map((m) => m.pid), job); } catch (_) {}
      finally { job.running = false; render(); }
    }
  }

  function currentData() {
    if (tab === 'guild') {
      return guildData.map((m) => {
        const p = players.get(m.pid);
        return m.level > 0 || !p ? m : { ...m, level: p.level };
      });
    }
    return [...players.values()];
  }
  function ranked() {
    let data = currentData();
    if (tab === 'all') {
      if (partyFilter) {
        data = data.filter((m) => m.party === partyFilter);
      } else {
        if (hideZero) data = data.filter((m) => m.pvp > 0);
        if (hideUnq) data = data.filter((m) => m.q !== 'no');
      }
    }
    const cmp = sortMode === 'level'
      ? (a, b) => b.level - a.level || b.pvp - a.pvp || a.name.localeCompare(b.name)
      : (a, b) => b.pvp - a.pvp || b.level - a.level || a.name.localeCompare(b.name);
    const good = data.filter((m) => m.q !== 'no').sort(cmp);
    const bad = data.filter((m) => m.q === 'no').sort(cmp);
    if (sortMode === 'level' || (sortMode === 'pvp' && mixUnq)) {
      let n = 0;
      return [...data].sort(cmp).map((m) => ({ m, rank: ++n }));
    }
    const g = good.map((m, i) => ({ m, rank: i + 1 })), b = bad.map((m) => ({ m, rank: 0 }));
    return sortMode === 'noparty' ? [...b, ...g] : [...g, ...b];
  }

  function rowEl({ m, rank }) {
    const unq = m.q === 'no';
    const row = document.createElement('div');
    row.className = 'member-card pvr-row' + (ME && m.pid === ME ? ' me' : '') + (unq ? ' unq' : '');

    const main = document.createElement('div');
    main.className = 'member-main';

    const chip = document.createElement('div');
    chip.className = 'rank-chip';
    chip.textContent = rank > 0 ? '#' + rank : '\u2014';

    const img = document.createElement('img');
    img.className = 'avatar';
    img.alt = '';
    staticAvatar(img, m.avatar);

    const info = document.createElement('div');
    info.className = 'pvr-info';
    const name = document.createElement('div');
    name.className = 'member-name';
    const a = document.createElement('a');
    a.className = 'member-link';
    a.href = 'player.php?pid=' + m.pid;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = m.name;
    name.appendChild(a);
    if (m.role) {
      const bd = document.createElement('span');
      bd.className = 'pvr-badge pvr-badge-' + m.role.toLowerCase();
      bd.textContent = m.role;
      name.append(' ', bd);
    }

    const meta = document.createElement('div');
    meta.className = 'member-meta-line';
    const bits = [];
    if (tab === 'all') bits.push(m.tag || 'No guild');
    if (m.cls) bits.push(m.cls);
    if (tab === 'all' && m.party) {
      const pa = document.createElement('span');
      pa.className = 'pvr-party';
      pa.dataset.party = m.party;
      pa.title = 'Show all players in this party';
      pa.textContent = m.party;
      bits.push(pa);
    }
    bits.forEach((b, i) => { if (i) meta.append(' \u00b7 '); meta.append(b); });

    info.append(name, meta);
    main.append(chip, img, info);

    const pills = document.createElement('div');
    pills.className = 'pvr-pills';
    if (unq) { const u = pill('', 'Unqualified'); u.classList.add('pvr-pill-unq'); u.title = 'Not in a PvP party: these points are invalid'; pills.append(u); }
    else if (tab === 'all' && m.q === '?') { const u = pill('', 'Unverified'); u.classList.add('pvr-pill-unv'); u.title = 'Profile not read yet'; pills.append(u); }
    const pv = pill('PvP', fmt(m.pvp));
    pv.classList.add('pvr-pvp');
    pills.append(pill('Lv.', m.level ? fmt(m.level) : '-'), pv);

    row.append(main, pills);
    return row;
  }

  function agoText(t) {
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    return m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago';
  }

  function renderScan() {
    const box = modal.querySelector('#pvr-scan');
    if (tab !== 'all') { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '';

    const job = jobAll;
    const text = document.createElement('div');
    text.className = 'pvr-scan-text';
    const actions = document.createElement('div');
    actions.className = 'pvr-scan-actions';
    const btn = (label, act, cls) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = cls || 'section-btn'; b.dataset.act = act; b.textContent = label;
      return b;
    };

    if (job.running) {
      let pct = 0;
      if (job.phase === 'dir') {
        text.textContent = 'Reading guild directory... page ' + job.page + ' / ' + (job.pages || '?');
        pct = job.pages ? (job.page / job.pages) * 100 : 0;
      } else if (job.phase === 'guilds') {
        text.textContent = 'Reading guild member lists ' + fmt(job.done) + ' / ' + fmt(job.total) + ' \u00b7 ' + fmt(players.size) + ' players';
        pct = job.total ? (job.done / job.total) * 100 : 0;
      } else {
        text.textContent = 'Checking player profiles ' + fmt(job.done) + ' / ' + fmt(job.total) + (job.failed + job.profBad ? ' \u00b7 ' + (job.failed + job.profBad) + ' failed' : '');
        pct = job.total ? (job.done / job.total) * 100 : 0;
      }
      const bar = document.createElement('div');
      bar.className = 'achievement-bar';
      const fill = document.createElement('div');
      fill.className = 'achievement-bar-fill';
      fill.style.width = Math.min(100, pct).toFixed(1) + '%';
      bar.appendChild(fill);
      actions.appendChild(btn('Stop', 'stop', 'danger-btn'));
      box.append(text, bar, actions);
    } else if (hasScan() || scanWarn) {
      const all = [...players.values()];
      const bad = all.filter((p) => p.q === 'no').length;
      const unv = all.filter((p) => p.q === '?' && !ownPids.has(p.pid)).length;
      text.textContent = fmt(all.length - bad) + ' players \u00b7 ' + fmt(bad) + ' unqualified' + (unv ? ' \u00b7 ' + fmt(unv) + ' unverified' : '') + (playersUpdatedAt ? ' \u00b7 updated ' + agoText(playersUpdatedAt) : '');
      actions.append(btn('Refresh top ' + TOP_N, 'top', 'action-btn'), btn('Full rescan', 'full'));
      box.append(text);
      if (scanWarn) {
        const w = document.createElement('div');
        w.className = 'pvr-scan-text';
        w.style.color = '#fca5a5';
        w.textContent = '\u26a0 ' + scanWarn;
        box.append(w);
      }
      box.append(actions);
    } else {
      text.textContent = 'Your guild is ranked from its member list. Everyone else is ranked by the PvP points on their profile, and players who are in no PvP party are marked unqualified (their points are invalid). The first scan reads every guild and then every profile, so it takes a while; after that it is cached and refreshes in seconds.';
      actions.appendChild(btn('Scan all guilds', 'full', 'action-btn'));
      box.append(text, actions);
    }
  }

  function renderList() {
    const list = modal.querySelector('#pvr-list');
    const status = modal.querySelector('#pvr-status');
    list.innerHTML = '';
    status.innerHTML = '';

    const msg = (t) => {
      const d = document.createElement('div');
      d.className = 'pvr-msg';
      d.textContent = t;
      list.appendChild(d);
    };

    if (tab === 'guild') {
      if (guildState === 'loading' || guildState === 'idle') return msg('Loading your guild members...');
      if (guildState === 'error') return msg('Could not load your guild. Make sure you are logged in.');
      if (guildState === 'empty') return msg('No guild members found.');
    }

    const all = ranked();
    const q = query.trim().toLowerCase();
    const filtered = q
      ? all.filter(({ m }) => (m.name + ' ' + (m.tag || '') + ' ' + (m.party || '') + ' ' + (m.cls || '') + ' ' + m.level + ' ' + m.pvp).toLowerCase().includes(q))
      : all;

    const qualified = all.filter((x) => x.rank > 0).length;
    const unqCount = all.length - qualified;
    const mine = ME ? all.find((x) => x.m.pid === ME && x.rank > 0) : null;
    status.append(pill(tab === 'guild' ? 'Members:' : 'Players:', fmt(qualified)));
    if (mine) {
      status.append(pill('Your rank:', '#' + fmt(mine.rank) + ' of ' + fmt(qualified)));
      const me = document.createElement('button');
      me.type = 'button'; me.className = 'section-btn'; me.dataset.act = 'me'; me.textContent = 'Find me';
      status.appendChild(me);
    }
    if (tab === 'all' && unqCount) { const u = pill('Unqualified:', fmt(unqCount)); u.classList.add('pvr-pill-unq'); status.append(u); }
    if (tab === 'all' && partyFilter) {
      status.append(pill('Party:', partyFilter));
      const clr = document.createElement('button');
      clr.type = 'button'; clr.className = 'section-btn'; clr.dataset.act = 'clearparty'; clr.textContent = 'Show all players';
      status.appendChild(clr);
    }
    if (q) status.append(pill('Matches:', fmt(filtered.length)));

    if (!filtered.length) return msg(q ? 'No players match your search.' : (tab === 'all' ? 'Run a scan to build the full ranking.' : 'Nothing to show yet.'));

    filtered.slice(0, limit).forEach((r) => list.appendChild(rowEl(r)));

    if (filtered.length > limit) {
      const more = document.createElement('div');
      more.className = 'pvr-more';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'section-btn'; b.dataset.act = 'more';
      b.textContent = 'Show more (' + fmt(filtered.length - limit) + ' left)';
      more.appendChild(b);
      list.appendChild(more);
    }
  }

  function render() {
    if (!modal) return;
    modal.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    modal.querySelector('#pvr-zero-wrap').style.display = tab === 'all' ? '' : 'none';
    modal.querySelector('#pvr-unq-wrap').style.display = tab === 'all' ? '' : 'none';
    modal.querySelector('#pvr-mix-wrap').style.display = tab === 'all' ? '' : 'none';
    renderScan();
    renderList();
  }

  function findMe() {
    if (!ME) return;
    const r = ranked().find((x) => x.m.pid === ME && x.rank > 0);
    if (!r) return;
    query = '';
    modal.querySelector('#pvr-search').value = '';
    limit = Math.max(limit, r.rank + 10);
    renderList();
    const row = modal.querySelector('.pvr-row.me');
    if (row) row.scrollIntoView({ block: 'center' });
  }

  function buildModal() {
    modal = document.createElement('div');
    modal.className = 'rewardModal';
    modal.id = MODAL_ID;
    modal.innerHTML = `
      <div class="rewardBox">
        <div class="rewardHead">
          <strong>\ud83c\udfc6 PvP Rankings</strong>
          <button class="section-btn" type="button" id="pvr-close">Close</button>
        </div>
        <div class="rewardBody">
          <div class="pvr-tabs">
            <button class="achievementTab active" type="button" data-tab="guild">My Guild</button>
            <button class="achievementTab" type="button" data-tab="all">Everyone</button>
          </div>
          <div class="pvr-controls">
            <input type="text" id="pvr-search" placeholder="\ud83d\udd0d Search name, tag, party or class">
            <select id="pvr-sort">
              <option value="pvp">Sort: PvP \u2193</option>
              <option value="level">Sort: Level \u2193</option>
              <option value="noparty">Sort: No party first</option>
            </select>
            <label class="pattern-check" id="pvr-zero-wrap" style="display:none">
              <input type="checkbox" id="pvr-zero" checked> Only players with PvP points
            </label>
            <label class="pattern-check" id="pvr-unq-wrap" style="display:none">
              <input type="checkbox" id="pvr-unq"> Hide unqualified
            </label>
            <label class="pattern-check" id="pvr-mix-wrap" style="display:none">
              <input type="checkbox" id="pvr-mix"> Rank unqualified in PvP sort
            </label>
          </div>
          <div class="pvr-status" id="pvr-status"></div>
          <div class="pvr-scan" id="pvr-scan" hidden></div>
          <div class="pvr-list" id="pvr-list"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.classList.remove('show');
    modal.querySelector('#pvr-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('show')) close(); });

    modal.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.tab;
      limit = PAGE_SIZE;
      render();
      maybeAutoRefresh();
    }));

    modal.querySelector('#pvr-search').addEventListener('input', (e) => { query = e.target.value; limit = PAGE_SIZE; renderList(); });
    modal.querySelector('#pvr-sort').addEventListener('change', (e) => { sortMode = e.target.value; limit = PAGE_SIZE; renderList(); });
    modal.querySelector('#pvr-zero').checked = hideZero;
    modal.querySelector('#pvr-unq').checked = hideUnq;
    modal.querySelector('#pvr-mix').checked = mixUnq;
    modal.querySelector('#pvr-zero').addEventListener('change', (e) => { hideZero = e.target.checked; savePrefs(); limit = PAGE_SIZE; renderList(); });
    modal.querySelector('#pvr-unq').addEventListener('change', (e) => { hideUnq = e.target.checked; savePrefs(); limit = PAGE_SIZE; renderList(); });
    modal.querySelector('#pvr-mix').addEventListener('change', (e) => { mixUnq = e.target.checked; savePrefs(); limit = PAGE_SIZE; renderList(); });

    modal.addEventListener('click', (e) => {
      const pt = e.target.closest('[data-party]');
      if (pt) { partyFilter = pt.dataset.party; limit = PAGE_SIZE; renderList(); return; }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'clearparty') { partyFilter = ''; limit = PAGE_SIZE; renderList(); return; }
      if (act === 'full') scanAll('full');
      else if (act === 'top') scanAll('top');
      else if (act === 'stop') stopScan();
      else if (act === 'more') { limit += PAGE_SIZE; renderList(); }
      else if (act === 'me') findMe();
    });
  }

  function openModal() {
    if (!modal) buildModal();
    modal.classList.add('show');
    render();
    loadGuild();
    maybeAutoRefresh();
  }

  function injectButton() {
    if (document.getElementById(BTN_ID)) return true;

    let row = document.querySelector('.reward-trigger-row');
    if (!row) {
      const pills = document.querySelector('.banner-content .banner-pill-row');
      if (!pills) return false;
      row = document.createElement('div');
      row.className = 'reward-trigger-row';
      pills.insertAdjacentElement('afterend', row);
    }

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.className = 'reward-trigger';
    btn.textContent = 'RANK';
    btn.addEventListener('click', openModal);
    row.appendChild(btn);
    return true;
  }

  injectButton();
  let pending = false;
  new MutationObserver(() => {
    if (pending || document.getElementById(BTN_ID)) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; injectButton(); });
  }).observe(document.body, { childList: true, subtree: true });

  window.PvpRank = {
    scanAll,
    stopScan,
    async debugGuild(id) {
      const html = await fetchText(BASE + 'guild_join_create.php?guild_id=' + id);
      let i = html.indexOf('<main');
      if (i < 0) i = html.indexOf('<table');
      const doc = docFromHtml(i >= 0 ? html.slice(i) : html);
      const rows = parseMembers(doc, 'guild');
      console.table(rows.map(({ pid, name, level, pvp, cls, role }) => ({ pid, name, level, pvp, cls, role })));
      console.log('pages:', totalPagesText(html), '| rows:', rows.length, '| missing level:', rows.filter((r) => !r.level).length, '| zero pvp:', rows.filter((r) => !r.pvp).length);
      console.log('learned columns:', JSON.stringify(LAYOUT), '| known players:', KNOWN_PVP.size, 'pvp /', KNOWN_LEVEL.size, 'level | top-25 seeds found:', SEEDS.length);
      const tr = doc.querySelector('table tbody tr') || doc.querySelector('tr');
      console.log('first row HTML:', tr ? tr.outerHTML.slice(0, 1500) : '(no table row found)');
      return rows;
    },
    async debugPlayer(pid) {
      const r = await fetchProfile(String(pid));
      console.log(r, r && !r.bad ? (noParty(r.party) ? 'UNQUALIFIED (no PvP party)' : 'qualified, party: ' + r.party) : '');
      return r;
    },
    clearCache() {
      localStorage.removeItem(PLAYERS_KEY); localStorage.removeItem(GUILDS_KEY);
      players.clear(); guildsMeta = null; render();
    },
  };
})();
