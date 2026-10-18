'use strict';
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ------------------------------ 工具 ------------------------------ */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const s = Math.floor(sec % 60);
    const m = Math.floor(sec / 60) % 60;
    const h = Math.floor(sec / 3600);
    const ss = String(s).padStart(2, '0');
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + ss : m + ':' + ss;
  }
  function fmtBytes(n) {
    if (!n) return '0 MB';
    const mb = n / 1048576;
    return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb.toFixed(mb < 10 ? 1 : 0) + ' MB';
  }
  function rel(ts) {
    if (!ts) return '尚未采集';
    const diff = (Date.now() - Number(ts)) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    return Math.floor(diff / 86400) + ' 天前';
  }
  function hueFor(seed) {
    let h = 0;
    const s = String(seed || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }
  const hueOf = (t) => (t && Number.isFinite(t.hue) ? t.hue : 24);
  const initialOf = (t) => String((t && t.title) || '?').trim().slice(0, 1) || '?';
  const coverImg = (t) => (t && t.artwork ? '<img src="' + esc(t.artwork) + '" alt="" loading="lazy" onerror="this.remove()">' : '');
  function debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }
  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'err' ? ' err' : type === 'warn' ? ' warn' : '');
    const icon = type === 'err' ? 'i-close' : type === 'warn' ? 'i-spark' : 'i-check';
    el.innerHTML = '<svg><use href="#' + icon + '"/></svg><span>' + esc(msg) + '</span>';
    $('#toasts').appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    }, type === 'err' ? 3800 : 2300);
  }

  /* ------------------------------ 分类 ------------------------------ */
  const CATS = [
    { key: 'language', label: '语言', items: [
      { id: 'zh', label: '华语', terms: ['chinese', 'mandarin', 'cpop', 'cantonese', 'taiwanese', '华语', '中文', '粤语'], radio: { language: 'chinese' } },
      { id: 'en', label: '英语', terms: ['english', 'britpop', 'american'], radio: { language: 'english' } },
      { id: 'ja', label: '日语', terms: ['japanese', 'jpop', 'j-pop', 'city pop', 'anime'], radio: { language: 'japanese' } },
      { id: 'ko', label: '韩语', terms: ['korean', 'kpop', 'k-pop', 'k indie'], radio: { language: 'korean' } },
      { id: 'es', label: '西语', terms: ['spanish', 'espanol', 'latin', 'flamenco', 'bolero', 'reggaeton'], radio: { language: 'spanish' } },
      { id: 'fr', label: '法语', terms: ['french', 'chanson', 'quebecois'], radio: { language: 'french' } },
      { id: 'instr', label: '纯音乐', terms: ['instrumental', 'no vocals', 'piano solo', '纯音乐'], radio: { tag: 'instrumental' } },
      { id: 'multi', label: '多语', terms: ['world', 'multilingual', 'fusion'], radio: {} },
    ] },
    { key: 'scene', label: '场景', items: [
      { id: 'late', label: '深夜', terms: ['late night', 'midnight', 'nocturne', 'night', '深夜'], radio: { tag: 'late night' } },
      { id: 'commute', label: '通勤', terms: ['commute', 'drive', 'road trip', 'highway'], radio: { tag: 'drive' } },
      { id: 'focus', label: '专注', terms: ['focus', 'study', 'concentration', 'reading'], radio: { tag: 'study' } },
      { id: 'gym', label: '健身', terms: ['workout', 'gym', 'energy', 'running'], radio: { tag: 'workout' } },
      { id: 'party', label: '派对', terms: ['party', 'dance', 'club', 'disco'], radio: { tag: 'dance' } },
      { id: 'cafe', label: '咖啡馆', terms: ['cafe', 'coffee', 'bossa', 'lounge'], radio: { tag: 'lounge' } },
      { id: 'rain', label: '雨天', terms: ['rain', 'rainy', 'storm', '雨天', '下雨'], radio: { tag: 'chillout' } },
      { id: 'morning', label: '清晨', terms: ['morning', 'sunrise', 'dawn', '清晨'], radio: { tag: 'morning' } },
    ] },
    { key: 'style', label: '风格', items: [
      { id: 'lofi', label: 'Lo-fi', terms: ['lo-fi', 'lofi', 'chillhop', 'study beats', 'chill'], radio: { tag: 'lo-fi' } },
      { id: 'jazz', label: '爵士', terms: ['jazz', 'swing', 'bebop', 'bossa nova', 'smooth jazz'], radio: { tag: 'jazz' } },
      { id: 'classical', label: '古典', terms: ['classical', 'orchestra', 'baroque', 'sonata', 'symphony'], radio: { tag: 'classical' } },
      { id: 'electronic', label: '电子', terms: ['electronic', 'edm', 'house', 'techno', 'synthwave', 'electronica'], radio: { tag: 'electronic' } },
      { id: 'rock', label: '摇滚', terms: ['rock', 'indie rock', 'punk', 'grunge'], radio: { tag: 'rock' } },
      { id: 'folk', label: '民谣', terms: ['folk', 'acoustic', 'singer-songwriter', 'americana'], radio: { tag: 'folk' } },
      { id: 'hiphop', label: '嘻哈', terms: ['hip hop', 'hip-hop', 'rap', 'trap', 'boom bap'], radio: { tag: 'hip hop' } },
      { id: 'ambient', label: '氛围', terms: ['ambient', 'drone', 'atmospheric', 'meditation'], radio: { tag: 'ambient' } },
      { id: 'world', label: '世界', terms: ['world', 'afrobeat', 'celtic', 'tango', 'samba'], radio: { tag: 'world' } },
      { id: 'pop', label: '流行', terms: ['pop', 'indie pop', 'dream pop', 'synth pop'], radio: { tag: 'pop' } },
    ] },
    { key: 'instrument', label: '乐器', items: [
      { id: 'piano', label: '钢琴', terms: ['piano', 'pianoforte', 'keys'], radio: { tag: 'piano' } },
      { id: 'guitar', label: '吉他', terms: ['guitar', 'acoustic guitar', 'electric guitar'], radio: { tag: 'guitar' } },
      { id: 'sax', label: '萨克斯', terms: ['sax', 'saxophone', 'tenor sax'], radio: { tag: 'saxophone' } },
      { id: 'violin', label: '小提琴', terms: ['violin', 'fiddle', 'string quartet'], radio: { tag: 'violin' } },
      { id: 'synth', label: '合成器', terms: ['synth', 'synthesizer', 'analog synth'], radio: { tag: 'synth' } },
      { id: 'drums', label: '鼓', terms: ['drum', 'drums', 'percussion', 'breakbeat'], radio: { tag: 'drum' } },
      { id: 'accordion', label: '手风琴', terms: ['accordion', 'bandoneon'], radio: { tag: 'accordion' } },
      { id: 'cello', label: '大提琴', terms: ['cello', 'violoncello'], radio: { tag: 'cello' } },
      { id: 'flute', label: '长笛', terms: ['flute', 'bansuri', 'shakuhachi'], radio: { tag: 'flute' } },
      { id: 'bass', label: '贝斯', terms: ['bass', 'double bass', 'bassline'], radio: { tag: 'bass' } },
    ] },
  ];
  const ITEM_MAP = {};
  const LABEL = {};
  for (const g of CATS) for (const it of g.items) { ITEM_MAP[g.key + ':' + it.id] = it; LABEL[g.key + ':' + it.id] = it.label; }

  const GLOSSARY = {
    钢琴: 'piano', 吉他: 'guitar', 萨克斯: 'saxophone', 小提琴: 'violin', 大提琴: 'cello',
    长笛: 'flute', 手风琴: 'accordion', 合成器: 'synth', 鼓: 'drums', 贝斯: 'bass',
    爵士: 'jazz', 古典: 'classical', 电子: 'electronic', 摇滚: 'rock', 民谣: 'folk',
    嘻哈: 'hip hop', 说唱: 'rap', 氛围: 'ambient', 世界: 'world', 流行: 'pop',
    深夜: 'late night', 通勤: 'commute', 专注: 'focus', 学习: 'study', 健身: 'workout',
    派对: 'party', 咖啡馆: 'cafe', 雨天: 'rain', 清晨: 'morning', 下雨: 'rainy',
    华语: 'chinese', 中文: 'mandarin', 粤语: 'cantonese', 日语: 'japanese', 韩语: 'korean',
    法语: 'french', 西语: 'spanish', 纯音乐: 'instrumental', 助眠: 'sleep', 放松: 'relax',
  };
  function expandQuery(text) {
    let out = String(text || '').trim();
    for (const [cn, en] of Object.entries(GLOSSARY)) {
      if (out.includes(cn)) out = out.split(cn).join(' ' + en + ' ');
    }
    return out.replace(/\s+/g, ' ').trim();
  }
  function selectionHints(sel, limit) {
    const order = ['instrument', 'style', 'scene', 'language'];
    const hints = [];
    for (const key of order) {
      for (const id of sel[key] || []) {
        const item = ITEM_MAP[key + ':' + id];
        if (!item) continue;
        if (key === 'language' && id === 'instr') continue;
        const term = item.terms[0];
        if (term && !hints.includes(term)) hints.push(term);
      }
    }
    return hints.slice(0, limit || 3);
  }
  function buildText(q, sel) {
    return [expandQuery(q), ...selectionHints(sel, 3)].filter(Boolean).join(' ').trim() || 'instrumental music';
  }
  function inferFacets(t) {
    const hay = [t.title, t.artist, t.genre, t.mood, ...(t.tags || [])].filter(Boolean).join(' ').toLowerCase();
    const facets = { language: [], scene: [], style: [], instrument: [] };
    for (const g of CATS) {
      for (const it of g.items) {
        for (const term of it.terms) {
          if (!term) continue;
          const escaped = term.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
          if (term.length <= 2) {
            const re = new RegExp('(^|[^a-z])' + escaped + '([^a-z]|$)', 'i');
            if (re.test(hay)) { facets[g.key].push(it.id); break; }
          } else if (hay.includes(term.toLowerCase())) {
            facets[g.key].push(it.id); break;
          }
        }
      }
    }
    if (/[\u4e00-\u9fff]/.test((t.title || '') + (t.artist || '')) && !facets.language.length) facets.language.push('zh');
    for (const k of Object.keys(facets)) facets[k] = [...new Set(facets[k])];
    return facets;
  }
  function mergeFacets(a, b) {
    const out = { language: [], scene: [], style: [], instrument: [] };
    for (const k of Object.keys(out)) out[k] = [...new Set([...(a && a[k] || []), ...(b && b[k] || [])])];
    return out;
  }
  function matchesFilters(t, sel) {
    for (const k of ['language', 'scene', 'style', 'instrument']) {
      const want = sel[k] || [];
      if (!want.length) continue;
      const have = (t.facets && t.facets[k]) || [];
      if (!want.some((id) => have.includes(id))) return false;
    }
    return true;
  }
  function matchesText(t, q) {
    const s = String(q || '').trim().toLowerCase();
    if (!s) return true;
    const hay = [t.title, t.artist, t.genre, t.mood, ...(t.tags || [])].filter(Boolean).join(' ').toLowerCase();
    return s.split(/\s+/).filter(Boolean).every((w) => hay.includes(w) || expandQuery(w).toLowerCase().split(' ').some((x) => x && hay.includes(x)));
  }
  const RECIPES = [
    { q: 'late night piano', sel: { scene: ['late'], instrument: ['piano'] } },
    { q: 'rainy night jazz', sel: { scene: ['rain'], style: ['jazz'] } },
    { q: 'lo-fi study beats', sel: { style: ['lofi'], scene: ['focus'] } },
    { q: 'morning acoustic folk', sel: { scene: ['morning'], style: ['folk'] } },
    { q: 'cafe bossa nova', sel: { scene: ['cafe'], style: ['jazz'] } },
    { q: 'synthwave night drive', sel: { style: ['electronic'], instrument: ['synth'] } },
    { q: 'classical cello', sel: { style: ['classical'], instrument: ['cello'] } },
    { q: 'smooth jazz saxophone', sel: { instrument: ['sax'], style: ['jazz'] } },
    { q: 'ambient meditation', sel: { style: ['ambient'], scene: ['focus'] } },
    { q: 'accordion tango', sel: { style: ['world'], instrument: ['accordion'] } },
    { q: 'chinese instrumental', sel: { language: ['zh'], style: ['world'] } },
    { q: 'japanese city pop', sel: { language: ['ja'], style: ['pop'] } },
    { q: 'korean indie', sel: { language: ['ko'], style: ['folk'] } },
    { q: 'spanish guitar flamenco', sel: { language: ['es'], instrument: ['guitar'] } },
    { q: 'french chanson', sel: { language: ['fr'] } },
    { q: 'hip hop boom bap', sel: { style: ['hiphop'], instrument: ['drums'] } },
  ];


  /* ------------------------------ IndexedDB ------------------------------ */
  const DB_NAME = 'sound-forage-mobile';
  const DB_VER = 1;
  let dbPromise = null;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('tracks')) d.createObjectStore('tracks', { keyPath: 'uid' });
        if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs', { keyPath: 'uid' });
        if (!d.objectStoreNames.contains('saved')) d.createObjectStore('saved', { keyPath: 'uid' });
        if (!d.objectStoreNames.contains('favorites')) d.createObjectStore('favorites', { keyPath: 'uid' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function getAll(name) { const d = await openDB(); return reqP(d.transaction(name, 'readonly').objectStore(name).getAll()); }
  async function getOne(name, key) { const d = await openDB(); return reqP(d.transaction(name, 'readonly').objectStore(name).get(key)); }
  async function putOne(name, val) { const d = await openDB(); return reqP(d.transaction(name, 'readwrite').objectStore(name).put(val)); }
  async function delOne(name, key) { const d = await openDB(); return reqP(d.transaction(name, 'readwrite').objectStore(name).delete(key)); }
  async function countStore(name) { const d = await openDB(); return reqP(d.transaction(name, 'readonly').objectStore(name).count()); }
  async function putMany(name, rows) {
    const d = await openDB();
    return new Promise((res, rej) => {
      const tx = d.transaction(name, 'readwrite');
      const s = tx.objectStore(name);
      for (const r of rows) s.put(r);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
  }
  async function metaGet(key) { const row = await getOne('meta', key); return row ? row.value : null; }
  async function metaSet(key, value) { return putOne('meta', { key: key, value: value }); }

  /* ------------------------------ 状态 ------------------------------ */
  const S = {
    view: 'discover',
    q: '',
    filters: { language: [], scene: [], style: [], instrument: [] },
    tracks: [],
    live: new Map(),
    items: [],
    limit: 80,
    favorites: new Set(),
    saved: new Map(),
    downloads: new Map(),
    blobUrls: new Map(),
    current: null,
    queue: [],
    qi: -1,
    repeat: 'off',
    loading: false,
    req: 0,
    collection: { running: false, last: null, cursor: 0, auto: true },
    installEvent: null,
  };
  const audio = $('#audio');
  let seeking = false;

  async function fetchJSON(url, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms || 12000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /* ------------------------------ 启动 ------------------------------ */
  async function boot() {
    try {
      await openDB();
      await seedIfNeeded();
      await loadState();
    } catch (err) {
      $('#list').innerHTML = emptyState('无法打开本地曲库', '浏览器可能禁用了存储（隐私模式）。请用普通模式打开。');
      return;
    }
    bindEvents();
    renderFilters();
    renderStats();
    syncNav();
    renderCollection();
    setView('discover');
    setupInstall();
    registerSW();
    maybeCollect();
    setTimeout(() => checkForUpdates(false), 1800);
  }

  async function seedIfNeeded() {
    const n = await countStore('tracks');
    if (n === 0 && Array.isArray(window.SEED) && window.SEED.length) {
      const rows = window.SEED.map((t, i) => Object.assign({}, t, { addedAt: new Date(Date.now() - i * 60000).toISOString() }));
      await putMany('tracks', rows);
      await metaSet('seeded', Date.now());
    }
    if (!(await metaGet('lastCollect'))) await metaSet('lastCollect', Date.now());
    if ((await metaGet('autoCollect')) === null) await metaSet('autoCollect', true);
  }

  async function loadState() {
    S.tracks = await getAll('tracks');
    const saved = await getAll('saved');
    S.saved = new Map(saved.map((x) => [x.uid, x]));
    const favs = await getAll('favorites');
    S.favorites = new Set(favs.map((x) => x.uid));
    S.collection.last = await metaGet('lastCollect');
    S.collection.cursor = (await metaGet('recipeCursor')) || 0;
    S.collection.auto = (await metaGet('autoCollect')) !== false;
    $('#auto-switch').setAttribute('aria-checked', String(S.collection.auto));
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 每次打开自动检查部署版本；有新版本就清缓存、注销旧 SW 后重载一次
  async function checkForUpdates(manual) {
    if (!/^https?:$/.test(location.protocol)) {
      if (manual) toast('本地文件模式不支持在线更新，请替换 HTML 文件', 'warn');
      return;
    }
    try {
      const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('no version.json');
      const info = await res.json();
      const remote = String(info.built || info.version || '');
      if (!remote) return;
      const local = localStorage.getItem('sf-build') || '';
      const label = 'v' + (info.version || '') + ' · 无需账号';
      const versionEl = document.getElementById('version-text');
      if (versionEl) versionEl.textContent = label;
      if (!local) {
        localStorage.setItem('sf-build', remote);
        if (manual) toast('当前已是最新版本');
        return;
      }
      if (remote === local) {
        if (manual) toast('当前已是最新版本');
        return;
      }
      const guard = 'sf-update-' + remote;
      if (sessionStorage.getItem(guard)) {
        localStorage.setItem('sf-build', remote);
        if (manual) toast('已更新到最新版本');
        return;
      }
      sessionStorage.setItem(guard, '1');
      localStorage.setItem('sf-build', remote);
      toast('发现新版本，正在自动更新…');
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch (e) { /* ignore */ }
      try {
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (e) { /* ignore */ }
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      if (manual) toast('检查更新失败：' + err.message, 'err');
    }
  }

  function maybeCollect() {
    if (!S.collection.auto) return;
    const last = Number(S.collection.last || 0);
    if (last && Date.now() - last < 8 * 3600 * 1000) return;
    setTimeout(() => collect(1, true), 1800);
  }

  /* ------------------------------ 采集 / 搜索 ------------------------------ */
  const AUDIUS = 'https://api.audius.co';
  async function audiusSearch(query, limit) {
    const params = new URLSearchParams({ query: String(query || 'music').slice(0, 80), app_name: 'SoundForageMobile', limit: String(limit || 24) });
    const json = await fetchJSON(AUDIUS + '/v1/tracks/search?' + params, 14000);
    return (json.data || []).map(mapAudius).filter(Boolean);
  }
  function mapAudius(raw) {
    if (!raw || !raw.id || raw.is_streamable === false) return null;
    const art = raw.artwork || {};
    const tags = typeof raw.tags === 'string' ? raw.tags.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8) : [];
    const t = {
      uid: 'audius:' + raw.id,
      sid: String(raw.id),
      source: 'audius',
      kind: 'track',
      title: String(raw.title || '未命名').slice(0, 120),
      artist: String((raw.user && (raw.user.name || raw.user.handle)) || '未知音乐人').slice(0, 80),
      duration: Number(raw.duration) || 0,
      artwork: art['480x480'] || art['150x150'] || art['1000x1000'] || '',
      genre: raw.genre || '',
      mood: raw.mood || '',
      tags: tags,
      link: raw.permalink ? 'https://audius.co' + raw.permalink : 'https://audius.co',
      hue: hueFor(raw.id),
      canSave: true,
      addedAt: new Date().toISOString(),
    };
    t.facets = inferFacets(t);
    return t;
  }
  async function itunesSearch(term) {
    const q = String(term || '').trim();
    if (!q) return [];
    const cjk = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(q);
    const countries = cjk ? ['tw', 'hk'] : ['us', 'tw'];
    const settled = await Promise.allSettled(countries.map((c) => fetchJSON('https://itunes.apple.com/search?' + new URLSearchParams({ term: q, entity: 'song', limit: '20', country: c }), 8000)));
    const seen = new Set();
    const out = [];
    for (const res of settled) {
      if (res.status !== 'fulfilled' || !res.value || !Array.isArray(res.value.results)) continue;
      for (const raw of res.value.results) {
        if (!raw.previewUrl || !raw.trackId) continue;
        const uid = 'itunes:' + raw.trackId;
        if (seen.has(uid)) continue;
        seen.add(uid);
        const art = String(raw.artworkUrl100 || raw.artworkUrl60 || '').replace(/\/\d+x\d+bb\./, '/600x600bb.');
        const t = {
          uid: uid, sid: String(raw.trackId), source: 'itunes', kind: 'preview', preview: true,
          title: raw.trackName, artist: raw.artistName, duration: 30, artwork: art,
          genre: raw.primaryGenreName || '', tags: [raw.primaryGenreName, '试听'].filter(Boolean),
          link: raw.trackViewUrl || 'https://music.apple.com', streamUrl: raw.previewUrl,
          canSave: false, hue: hueFor(raw.trackId), addedAt: new Date().toISOString(),
        };
        t.facets = inferFacets(t);
        out.push(t);
      }
    }
    return out;
  }

  const streamUrl = (t) => {
    if (!t) return '';
    if (t.kind === 'station') return t.streamUrl || '';
    if (t.source === 'audius') return t.sid ? AUDIUS + '/v1/tracks/' + encodeURIComponent(t.sid) + '/stream?app_name=SoundForageMobile' : '';
    return t.streamUrl || '';
  };
  const titleKey = (t) => (t.title + '|' + t.artist).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  async function collect(count, silent) {
    if (S.collection.running) return;
    S.collection.running = true;
    renderCollection();
    let added = 0;
    const seen = new Set(S.tracks.map(titleKey));
    try {
      for (let i = 0; i < count; i++) {
        const recipe = RECIPES[(S.collection.cursor + i) % RECIPES.length];
        if (!silent) toast('正在采集：' + recipe.q);
        const rows = await audiusSearch(buildText(recipe.q, recipe.sel), 24);
        const fresh = [];
        for (const t of rows) {
          const key = titleKey(t);
          if (seen.has(key) || S.tracks.some((x) => x.uid === t.uid)) continue;
          seen.add(key);
          t.facets = mergeFacets(t.facets, recipe.sel);
          t.recipe = recipe.q;
          fresh.push(t);
        }
        if (fresh.length) {
          await putMany('tracks', fresh);
          S.tracks = S.tracks.concat(fresh);
          added += fresh.length;
        }
      }
      S.collection.cursor = (S.collection.cursor + count) % RECIPES.length;
      await metaSet('recipeCursor', S.collection.cursor);
      S.collection.last = Date.now();
      await metaSet('lastCollect', S.collection.last);
      renderStats();
      if (S.view === 'discover') await loadDiscover(false);
      if (added) toast('采集完成 · 新增 ' + added + ' 首');
      else if (!silent) toast('这次没有新曲目，换个筛选试试', 'warn');
    } catch (err) {
      toast('采集失败：' + err.message, 'err');
    } finally {
      S.collection.running = false;
      renderCollection();
    }
  }

  async function loadDiscover(withLive) {
    const token = ++S.req;
    S.loading = true;
    $('#list').innerHTML = skeleton();
    const hasFilters = ['language', 'scene', 'style', 'instrument'].some((k) => S.filters[k].length);
    let local = S.tracks.filter((t) => matchesFilters(t, S.filters) && matchesText(t, S.q));
    local.sort((a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')));
    let live = [];
    if (withLive && (S.q || hasFilters)) {
      try {
        $('#collect-text').textContent = '正在全网检索…';
        if (S.q) {
          const cjk = /[\u3400-\u9fff]/.test(S.q);
          const settled = await Promise.allSettled([audiusSearch(buildText(S.q, S.filters), 30), itunesSearch(S.q)]);
          const audius = settled[0].status === 'fulfilled' ? settled[0].value : [];
          const itunes = settled[1].status === 'fulfilled' ? settled[1].value : [];
          live = cjk ? itunes.concat(audius) : audius.concat(itunes);
        } else {
          live = await audiusSearch(buildText(S.q, S.filters), 30);
        }
      } catch (err) { /* 离线时只用本地 */ }
    }
    if (token !== S.req) return;
    const seen = new Set(local.map((t) => t.uid));
    const seenTitles = new Set(local.map(titleKey));
    for (const t of live) {
      if (seen.has(t.uid) || seenTitles.has(titleKey(t))) continue;
      seen.add(t.uid);
      seenTitles.add(titleKey(t));
      S.live.set(t.uid, t);
      local.push(t);
    }
    if (S.q) {
      const q = S.q.toLowerCase();
      local.sort((a, b) => (String(b.title).toLowerCase().includes(q) ? 1 : 0) - (String(a.title).toLowerCase().includes(q) ? 1 : 0));
    }
    S.items = local.slice(0, S.limit);
    S.loading = false;
    renderCollection();
    render();
  }

  async function loadRadio() {
    S.loading = true;
    $('#list').innerHTML = skeleton();
    try {
      const first = (key) => {
        for (const id of S.filters[key] || []) {
          const item = ITEM_MAP[key + ':' + id];
          if (item && item.radio && (item.radio.tag || item.radio.language)) return item.radio;
        }
        return {};
      };
      const tag = (first('style').tag || first('instrument').tag || first('scene').tag || '');
      const language = first('language').language || '';
      const params = new URLSearchParams({ limit: '80', hidebroken: 'true', order: 'clickcount', reverse: 'true' });
      if (tag) params.set('tag', tag);
      if (language) params.set('language', language);
      let stations = [];
      const hosts = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://all.api.radio-browser.info'];
      for (const host of hosts) {
        try {
          const json = await fetchJSON(host + '/json/stations/search?' + params, 9000);
          stations = (json || []).map(mapStation).filter(Boolean);
          if (stations.length) break;
        } catch (e) { /* 换镜像 */ }
      }
      if (!stations.length) stations = await somaFallback(tag, language);
      S.items = stations;
    } catch (err) {
      S.items = [];
    } finally {
      S.loading = false;
      render();
    }
  }
  function mapStation(raw) {
    const url = raw.url_resolved || raw.url;
    if (!url || !/^https?:\/\//i.test(url)) return null;
    if (/\.(m3u8|m3u|pls|xspf)(\?|$)/i.test(url)) return null;
    const tags = String(raw.tags || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10);
    const t = {
      uid: 'radio:' + raw.stationuuid,
      source: 'radio',
      kind: 'station',
      title: String(raw.name || '未命名电台').trim().slice(0, 80) || '未命名电台',
      artist: raw.country || '网络电台',
      country: raw.country || '',
      codec: String(raw.codec || '').toUpperCase(),
      bitrate: Number(raw.bitrate) || 0,
      duration: 0,
      artwork: /^https?:/.test(raw.favicon || '') ? raw.favicon : '',
      genre: tags[0] || '',
      tags: tags,
      streamUrl: url,
      hue: hueFor(raw.stationuuid),
      canSave: false,
    };
    t.facets = inferFacets(t);
    return t;
  }
  let somaCache = null;
  async function somaFallback(tag, language) {
    if (language && language !== 'english') return [];
    try {
      if (!somaCache || Date.now() - somaCache.at > 15 * 60000) {
        const json = await fetchJSON('https://somafm.com/channels.json', 12000);
        somaCache = { at: Date.now(), list: json.channels || [] };
      }
    } catch (e) { return []; }
    const words = String(tag || '').toLowerCase().split(/\s+/).filter(Boolean);
    const scored = somaCache.list.map((ch) => {
      const hay = [ch.title, ch.genre, ch.description, ch.id].join(' ').toLowerCase();
      let score = 0;
      for (const w of words) if (hay.includes(w)) score += 2;
      return { ch, score };
    });
    scored.sort((a, b) => b.score - a.score || Number(b.ch.listeners || 0) - Number(a.ch.listeners || 0));
    return scored.slice(0, 40).map(({ ch }) => ({
      uid: 'soma:' + ch.id,
      source: 'soma',
      kind: 'station',
      title: ch.title,
      artist: 'SomaFM',
      country: 'United States',
      codec: 'MP3',
      bitrate: 128,
      duration: 0,
      artwork: ch.image || '',
      genre: ch.genre || '',
      tags: [ch.genre, ch.description].filter(Boolean),
      streamUrl: 'https://ice1.somafm.com/' + ch.id + '-128-mp3',
      hue: hueFor(ch.id),
      canSave: false,
    }));
  }

  const favTracks = () => [...S.favorites].map((uid) => S.tracks.find((t) => t.uid === uid) || S.live.get(uid)).filter(Boolean);
  const savedEntries = () => [...S.saved.values()].sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));

  /* ------------------------------ 渲染 ------------------------------ */
  function render() {
    renderStats();
    renderNav();
    renderActiveFilters();
    renderCollection();
    if (S.view === 'discover' || S.view === 'favorites') renderTrackList();
    else if (S.view === 'radio') renderRadioList();
    else renderSavedList();
    updateDock();
    renderInstall();
  }

  function renderStats() {
    $('#stat-tracks').textContent = S.tracks.length;
    $('#stat-saved').textContent = S.saved.size;
    let bytes = 0;
    for (const x of S.saved.values()) bytes += x.size || 0;
    $('#stat-size').textContent = fmtBytes(bytes);
    $('#storage-text').textContent = '已存 ' + S.saved.size + ' 首 · ' + fmtBytes(bytes);
  }

  function renderNav() {
    $$('.tab').forEach((el) => el.classList.toggle('is-on', el.dataset.view === S.view));
    const titles = { discover: '为你采集', radio: '世界电台', favorites: '我的收藏', saved: '本地已存' };
    $('#board-title').textContent = titles[S.view] || '为你采集';
    $('#collect-btn').hidden = S.view !== 'discover';
    $('#filter-btn').hidden = S.view === 'saved';
  }

  function renderCollection() {
    const line = $('#collect-line');
    line.classList.toggle('is-running', S.collection.running);
    const text = $('#collect-text');
    if (S.collection.running) text.innerHTML = '正在采集全网免费音乐…';
    else if (S.loading) text.innerHTML = '正在检索…';
    else if (S.view === 'radio') text.innerHTML = '直播流 · 来自 Radio Browser / SomaFM';
    else if (S.view === 'saved') text.innerHTML = '已存曲目断网也能播放';
    else if (S.view === 'favorites') text.innerHTML = '收藏只存在这台手机';
    else text.innerHTML = '曲库 <b>' + S.tracks.length + '</b> 首 · 上次采集 ' + rel(S.collection.last) + ' · 打开应用自动补货';
  }

  function renderActiveFilters() {
    const wrap = $('#active-filters');
    const tags = [];
    for (const key of ['language', 'scene', 'style', 'instrument']) {
      for (const id of S.filters[key]) {
        const item = ITEM_MAP[key + ':' + id];
        if (!item) continue;
        tags.push('<span class="af-tag">' + esc(item.label) + '<button data-remove="' + key + ':' + id + '" aria-label="移除"><svg><use href="#i-close"/></svg></button></span>');
      }
    }
    if (tags.length) tags.push('<button class="af-clear" data-act="clear-filters">清空</button>');
    wrap.innerHTML = tags.join('');
    wrap.classList.toggle('has-items', tags.length > 0);
  }

  function tagChips(t) {
    const out = [];
    const f = t.facets || {};
    for (const key of ['style', 'instrument', 'scene']) {
      for (const id of f[key] || []) {
        const label = LABEL[key + ':' + id];
        if (label && !out.includes(label) && out.length < 2) out.push(label);
      }
    }
    return out.join(' · ');
  }

  function trackRow(t, i) {
    const playing = S.current && S.current.uid === t.uid;
    const fav = S.favorites.has(t.uid);
    const saved = S.saved.has(t.uid);
    const canSave = t.canSave !== false;
    const dl = S.downloads.get(t.uid);
    const time = dl ? (dl.total ? Math.round((dl.bytes / dl.total) * 100) + '%' : '缓存中') : fmtTime(t.duration);
    return '<article class="track' + (playing ? ' is-playing' : '') + (dl ? ' is-downloading' : '') + '" data-uid="' + esc(t.uid) + '" data-act="play-row" style="--i:' + Math.min(i, 12) + '" tabindex="0" role="button" aria-label="播放 ' + esc(t.title) + '">' +
      '<span class="cover" style="--h:' + hueOf(t) + '">' + esc(initialOf(t)) + coverImg(t) + '<span class="eq"><i></i><i></i><i></i><i></i></span></span>' +
      '<span class="track-main"><h3>' + esc(t.title) + '</h3><p><b>' + esc(t.artist) + '</b>' + (tagChips(t) ? ' · ' + esc(tagChips(t)) : '') + (t.preview ? ' · <span class="preview-inline">试听</span>' : '') + '</p></span>' +
      '<span class="track-time">' + time + '</span>' +
      '<span class="track-act">' +
        '<button class="icon-btn' + (fav ? ' is-fav' : '') + '" data-act="fav" aria-label="收藏"><svg><use href="#' + (fav ? 'i-heart-fill' : 'i-heart') + '"/></svg></button>' +
        '<button class="icon-btn' + (saved ? ' is-saved' : '') + '" data-act="save" aria-label="存到手机" ' + (saved || !canSave ? 'disabled' : '') + ' title="' + (t.preview ? '版权歌曲仅提供 30 秒试听' : '存到手机') + '"><svg><use href="#' + (saved ? 'i-check' : 'i-down') + '"/></svg></button>' +
      '</span>' +
    '</article>';
  }

  function stationCard(t, i) {
    const playing = S.current && S.current.uid === t.uid;
    return '<article class="station' + (playing ? ' is-playing' : '') + '" data-uid="' + esc(t.uid) + '" data-act="play-row" style="--i:' + Math.min(i, 14) + ';--h:' + hueOf(t) + '" tabindex="0" role="button">' +
      '<div class="station-art">' + esc(initialOf(t)) + coverImg(t) + '<span class="station-play"><svg><use href="#' + (playing ? 'i-pause' : 'i-play') + '"/></svg></span></div>' +
      '<div class="station-body"><h3>' + esc(t.title) + '</h3><div class="station-meta"><span>' + esc(t.country || '网络电台') + '</span><span>' + esc(t.codec || 'LIVE') + (t.bitrate ? ' ' + t.bitrate + 'k' : '') + '</span></div></div>' +
    '</article>';
  }

  function savedRow(entry, i) {
    const t = entry.track || { title: entry.uid, artist: '', hue: 24, artwork: '' };
    return '<div class="saved-row" data-uid="' + esc(t.uid) + '" data-act="play-saved" style="--i:' + Math.min(i, 12) + '">' +
      '<span class="cover" style="--h:' + hueOf(t) + '">' + esc(initialOf(t)) + coverImg(t) + '</span>' +
      '<span class="track-main"><h3>' + esc(t.title) + '</h3><p><b>' + esc(t.artist) + '</b> · 已离线</p></span>' +
      '<span class="size">' + fmtBytes(entry.size) + '</span>' +
      '<span class="actions"><button class="icon-btn" data-act="play-saved" aria-label="播放"><svg><use href="#i-play"/></svg></button>' +
      '<button class="icon-btn" data-act="delete-saved" aria-label="删除"><svg><use href="#i-trash"/></svg></button></span>' +
    '</div>';
  }

  function renderTrackList() {
    const wrap = $('#list');
    const hasFilters = ['language', 'scene', 'style', 'instrument'].some((k) => S.filters[k].length);
    const count = $('#board-count');
    if (S.view === 'favorites') {
      count.textContent = S.favorites.size + ' 首';
      wrap.innerHTML = S.items.length ? S.items.map(trackRow).join('') : emptyState('还没有收藏', '点曲目右侧的心形，把喜欢的留在这里。');
      return;
    }
    count.textContent = S.items.length + ' 首' + (S.q || hasFilters ? ' · 匹配' : ' · 内置');
    if (!S.items.length) {
      wrap.innerHTML = emptyState(S.q ? '没有找到匹配的曲目' : '曲库是空的', S.q ? '换个关键词，或减少筛选条件。' : '点右上角「采集」抓取一批新歌。');
      return;
    }
    let html = S.items.map(trackRow).join('');
    if (S.items.length >= S.limit && S.tracks.length > S.items.length) {
      html += '<div class="load-more"><button data-act="more">加载更多</button></div>';
    }
    wrap.innerHTML = html;
  }

  function renderRadioList() {
    const wrap = $('#list');
    $('#board-count').textContent = S.items.length ? S.items.length + ' 个电台' : '';
    wrap.innerHTML = S.items.length
      ? '<div class="radio-grid">' + S.items.map(stationCard).join('') + '</div>'
      : emptyState('暂时没有电台', '换个风格或语言试试；也可能是电台目录暂时不可达。');
  }

  function renderSavedList() {
    const wrap = $('#list');
    const entries = savedEntries();
    let bytes = 0;
    for (const x of entries) bytes += x.size || 0;
    $('#board-count').textContent = entries.length + ' 首 · ' + fmtBytes(bytes);
    let html = '<div class="saved-head"><div class="storage"><div><b>' + fmtBytes(bytes) + '</b><span>离线占用</span></div><div class="bar"><i style="width:' + Math.min(100, (bytes / (1024 * 1024 * 1024)) * 100) + '%"></i></div></div></div>';
    html += entries.length ? entries.map(savedRow).join('') : emptyState('还没有离线曲目', '在发现页点曲目右侧的 ↓，下载后断网也能听。');
    wrap.innerHTML = html;
  }

  function emptyState(title, text) {
    return '<div class="empty"><div class="disc-empty"></div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p></div>';
  }
  function skeleton() {
    let rows = '';
    for (let i = 0; i < 6; i++) rows += '<div class="sk-row"><span class="sk art"></span><span><span class="sk" style="width:' + (45 + (i * 8) % 35) + '%"></span><span class="sk short"></span></span><span class="sk" style="width:34px"></span></div>';
    return '<div class="skeleton">' + rows + '</div>';
  }

  function renderFilters() {
    const wrap = $('#filter-groups');
    wrap.innerHTML = CATS.map((g) => {
      const active = S.filters[g.key] || [];
      return '<div class="filter-group"><div class="filter-label"><span>' + esc(g.label) + '</span>' + (active.length ? '<em>' + active.length + ' 已选</em>' : '') + '</div><div class="chips">' +
        g.items.map((it) => '<button class="chip' + (active.includes(it.id) ? ' is-on' : '') + '" data-filter="' + g.key + '" data-id="' + it.id + '" aria-pressed="' + active.includes(it.id) + '">' + esc(it.label) + '</button>').join('') +
        '</div></div>';
    }).join('');
  }

  function updateDock() {
    const t = S.current;
    if (!t) return;
    $('#np-title').textContent = t.title;
    $('#np-artist').textContent = [t.artist, t.kind === 'station' ? 'LIVE' : ''].filter(Boolean).join(' · ');
    const label = $('#mini-label');
    label.style.setProperty('--h', hueOf(t));
    label.innerHTML = esc(initialOf(t)) + coverImg(t);
    const discLabel = $('#disc-label');
    discLabel.style.setProperty('--h', hueOf(t));
    discLabel.innerHTML = esc(initialOf(t)) + coverImg(t);
    const playing = !audio.paused;
    $('#mini-disc').classList.toggle('playing', playing);
    $('#disc').classList.toggle('playing', playing);
    $('#play-icon use').setAttribute('href', playing ? '#i-pause' : '#i-play');
    $('#sheet-play-icon use').setAttribute('href', playing ? '#i-pause' : '#i-play');
    $('#sheet-title').textContent = t.title;
    $('#sheet-artist').textContent = t.kind === 'station' ? (t.country || '直播电台') : t.artist;
    $('#sheet-kicker').textContent = S.saved.has(t.uid) ? 'OFFLINE · 已离线' : t.kind === 'station' ? 'LIVE RADIO' : t.preview ? 'APPLE MUSIC · 30 秒试听' : 'AUDIUS';
    const fav = S.favorites.has(t.uid);
    $('#sheet-fav').textContent = fav ? '已收藏' : '收藏';
    const saved = S.saved.has(t.uid);
    const dl = S.downloads.get(t.uid);
    $('#sheet-save').textContent = saved ? '已在手机' : !canSave ? (t.preview ? '试听不可下载' : '不可保存') : dl ? (dl.total ? Math.round((dl.bytes / dl.total) * 100) + '%' : '缓存中') : '存到手机';
    $('#sheet-save').disabled = saved || !canSave || t.kind === 'station';
    $('#sheet-license').innerHTML = t.preview
      ? 'Apple Music 官方 30 秒试听 · <a href="' + esc(t.link) + '" target="_blank" rel="noopener">去 Apple Music 听完整版</a>'
      : t.kind === 'station'
        ? '直播流 · 版权归电台所有'
        : (saved ? '离线缓存仅供个人收听' : '来自 Audius 的公开免费曲目 · 版权归音乐人');
    $$('.station').forEach((el) => {
      const on = !!S.current && el.dataset.uid === S.current.uid;
      const use = el.querySelector('.station-play use');
      if (use) use.setAttribute('href', on && playing ? '#i-pause' : '#i-play');
    });
  }

  function updateProgress() {
    const live = S.current && S.current.kind === 'station';
    const d = audio.duration;
    const cur = audio.currentTime || 0;
    const pct = !live && Number.isFinite(d) && d > 0 ? Math.min(1, cur / d) : 0;
    $('#dock-fill').style.width = (pct * 100) + '%';
    $('#sheet-cur').textContent = Number.isFinite(d) ? fmtTime(cur) : '0:00';
    $('#sheet-dur').textContent = live ? 'LIVE' : Number.isFinite(d) ? fmtTime(d) : '0:00';
    if (!seeking) $('#sheet-range').value = String(Math.round(pct * 1000));
  }

  function setView(view) {
    S.view = view;
    S.limit = 80;
    closeSheets();
    syncNav();
    if (view === 'discover') loadDiscover(true);
    else if (view === 'radio') loadRadio();
    else if (view === 'favorites') { S.items = favTracks(); render(); }
    else render();
    const hash = view === 'discover' ? '' : '#' + view;
    try { if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname); } catch (e) {}
  }
  function syncNav() {
    $$('.tab').forEach((el) => el.classList.toggle('is-on', el.dataset.view === S.view));
    renderNav();
  }

  /* ------------------------------ 播放 ------------------------------ */
  async function playTrack(t, list) {
    if (!t) return;
    if (S.current && S.current.uid === t.uid) { toggle(); return; }
    S.current = t;
    if (!S.live.has(t.uid) && !S.tracks.find((x) => x.uid === t.uid)) S.live.set(t.uid, t);
    const queue = (list || S.items).filter((x) => x && x.uid);
    S.queue = queue.length ? queue : [t];
    S.qi = S.queue.findIndex((x) => x.uid === t.uid);
    if (S.qi < 0) { S.queue = [t]; S.qi = 0; }
    await start(t);
  }

  async function start(t) {
    let src = streamUrl(t);
    if (S.saved.has(t.uid)) {
      try {
        if (!S.blobUrls.has(t.uid)) {
          const row = await getOne('blobs', t.uid);
          if (row && row.blob) S.blobUrls.set(t.uid, URL.createObjectURL(row.blob));
        }
        if (S.blobUrls.has(t.uid)) src = S.blobUrls.get(t.uid);
      } catch (e) { /* 回退在线 */ }
    }
    if (!src) { toast('无法播放这首', 'err'); return; }
    audio.src = src;
    const p = audio.play();
    if (p && p.catch) p.catch(() => toast('音源连接失败，试试下一首', 'err'));
    updateDock();
    updateMediaSession(t);
    markPlaying();
    updateProgress();
  }

  function toggle() {
    if (!S.current) { toast('先挑一首吧', 'warn'); return; }
    if (audio.paused) audio.play().catch(() => toast('播放失败', 'err'));
    else audio.pause();
  }

  function next(auto) {
    if (!S.queue.length) return;
    if (auto && S.repeat === 'one') { audio.currentTime = 0; audio.play(); return; }
    let idx = S.qi + 1;
    if (idx >= S.queue.length) {
      if (S.repeat === 'all') idx = 0;
      else if (auto) { audio.pause(); return; }
      else idx = 0;
    }
    S.qi = idx;
    start(S.queue[idx]);
  }
  function prev() {
    if (!S.queue.length) return;
    if (audio.currentTime > 4) { audio.currentTime = 0; return; }
    S.qi = (S.qi - 1 + S.queue.length) % S.queue.length;
    start(S.queue[S.qi]);
  }
  function markPlaying() {
    $$('.track, .saved-row, .station').forEach((el) => el.classList.toggle('is-playing', !!S.current && el.dataset.uid === S.current.uid));
  }
  function updateMediaSession(t) {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist || '拾音',
        album: '拾音 · SOUND FORAGE',
        artwork: t.artwork ? [{ src: t.artwork, sizes: '480x480', type: 'image/jpeg' }] : [],
      });
      navigator.mediaSession.setActionHandler('play', () => audio.play());
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('previoustrack', prev);
      navigator.mediaSession.setActionHandler('nexttrack', () => next(false));
    } catch (e) { /* 忽略 */ }
  }

  /* ------------------------------ 下载 / 收藏 ------------------------------ */
  async function saveTrack(t) {
    if (!t) return;
    if (t.kind === 'station') { toast('直播流不能离线保存', 'warn'); return; }
    if (t.preview) { toast('版权歌曲只有 30 秒试听，无法离线保存', 'warn'); return; }
    if (S.saved.has(t.uid)) { toast('已经存在手机里了'); return; }
    if (S.downloads.has(t.uid)) { toast('正在保存，请稍候', 'warn'); return; }
    const uid = t.uid;
    const src = streamUrl(t);
    if (!src) { toast('这首没有可用的音频地址', 'err'); return; }
    S.downloads.set(uid, { bytes: 0, total: 0 });
    updateRowProgress(uid);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const total = Number(res.headers.get('content-length')) || 0;
      const mime = res.headers.get('content-type') || 'audio/mpeg';
      if (!/audio\/|octet-stream/i.test(mime)) throw new Error('音源返回的不是音频');
      const reader = res.body.getReader();
      const chunks = [];
      let bytes = 0;
      while (true) {
        const step = await reader.read();
        if (step.done) break;
        chunks.push(step.value);
        bytes += step.value.length;
        S.downloads.set(uid, { bytes: bytes, total: total });
        updateRowProgress(uid);
      }
      if (bytes < 20000) throw new Error('音频为空或过小');
      const blob = new Blob(chunks, { type: mime });
      await putOne('blobs', { uid: uid, blob: blob, mime: mime, size: bytes });
      const entry = { uid: uid, size: bytes, mime: mime, savedAt: new Date().toISOString(), track: stripTrack(t) };
      await putOne('saved', entry);
      if (!S.tracks.find((x) => x.uid === uid)) {
        const own = stripTrack(t);
        await putOne('tracks', own);
        S.tracks.push(own);
      }
      S.saved.set(uid, entry);
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
      toast('已存到手机 · ' + fmtBytes(bytes));
    } catch (err) {
      toast('保存失败：' + err.message, 'err');
    } finally {
      S.downloads.delete(uid);
      renderStats();
      if (S.view === 'saved') renderSavedList();
      if (S.view === 'discover' || S.view === 'favorites') renderTrackList();
      updateDock();
    }
  }
  function stripTrack(t) {
    return {
      uid: t.uid, sid: t.sid, source: t.source, kind: t.kind || 'track', title: t.title, artist: t.artist,
      duration: t.duration || 0, artwork: t.artwork || '', genre: t.genre || '', mood: t.mood || '',
      tags: t.tags || [], facets: t.facets || {}, hue: hueOf(t), link: t.link || '', canSave: t.canSave !== false, preview: !!t.preview,
      addedAt: t.addedAt || new Date().toISOString(),
    };
  }
  function updateRowProgress(uid) {
    const row = document.querySelector('[data-uid="' + (window.CSS && CSS.escape ? CSS.escape(uid) : uid) + '"]');
    if (!row) return;
    row.classList.add('is-downloading');
    const time = row.querySelector('.track-time');
    const dl = S.downloads.get(uid);
    if (time && dl) time.textContent = dl.total ? Math.round((dl.bytes / dl.total) * 100) + '%' : '缓存中';
  }
  async function toggleFav(uid) {
    const on = !S.favorites.has(uid);
    const t = S.tracks.find((x) => x.uid === uid) || S.live.get(uid) || S.current;
    if (on) {
      S.favorites.add(uid);
      await putOne('favorites', { uid: uid, at: Date.now() });
      if (t && !S.tracks.find((x) => x.uid === uid)) {
        const own = stripTrack(t);
        await putOne('tracks', own);
        S.tracks.push(own);
      }
    } else {
      S.favorites.delete(uid);
      await delOne('favorites', uid);
    }
    toast(on ? '已收藏' : '已取消收藏');
    if (S.view === 'favorites') { S.items = favTracks(); renderTrackList(); }
    else if (S.view === 'discover') renderTrackList();
    updateDock();
  }
  async function deleteSaved(uid) {
    if (!confirm('从手机删除这首离线曲目？')) return;
    try {
      await delOne('blobs', uid);
      await delOne('saved', uid);
      if (S.blobUrls.has(uid)) { URL.revokeObjectURL(S.blobUrls.get(uid)); S.blobUrls.delete(uid); }
      S.saved.delete(uid);
      if (S.current && S.current.uid === uid) { audio.pause(); audio.removeAttribute('src'); S.current = null; }
      toast('已删除');
      render();
    } catch (e) { toast('删除失败', 'err'); }
  }

  /* ------------------------------ 浮层 ------------------------------ */
  function openSheet(id) {
    closeSheets();
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    $('#scrim').classList.add('show');
    document.body.style.overflow = 'hidden';
    if (id === 'player-sheet') updateDock();
    if (id === 'filter-sheet') renderFilters();
  }
  function closeSheets() {
    $$('.sheet').forEach((el) => { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); });
    $('#scrim').classList.remove('show');
    document.body.style.overflow = '';
  }

  /* ------------------------------ 安装 / 存储 ------------------------------ */
  function setupInstall() {
    S.installEvent = window.__sfInstallEvent || null;
    window.addEventListener('sf-installable', () => {
      S.installEvent = window.__sfInstallEvent || null;
      renderInstall();
    });
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      S.installEvent = e;
      renderInstall();
    });
    window.addEventListener('appinstalled', () => {
      S.installEvent = null;
      toast('已安装到桌面');
      renderInstall();
    });
    if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(() => renderInstall()).catch(() => {});
    renderInstall();
  }
  function renderInstall() {
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    const isFile = location.protocol === 'file:';
    const canPrompt = !!S.installEvent;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const btn = $('#install-btn');
    if (!btn) return;
    btn.hidden = standalone || isFile;
    const row = $('#install-row');
    if (row) row.style.display = standalone ? 'none' : '';
    $('#install-btn-2').textContent = canPrompt ? '安装' : '方法';
    $('#install-hint').textContent = standalone
      ? '已安装 · 正在以独立应用运行'
      : isFile
        ? '本地文件模式：请打开托管地址后再安装'
        : canPrompt
          ? '一键添加到主屏幕，离线也能打开'
          : ios
            ? 'Safari 分享 → 添加到主屏幕'
            : 'Chrome 菜单 → 添加到主屏幕 / 安装应用';
  }
  async function install() {
    if (S.installEvent) {
      try {
        S.installEvent.prompt();
        const choice = await Promise.race([
          S.installEvent.userChoice.catch(() => null),
          new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
        if (!choice) {
          S.installEvent = null;
          renderInstall();
          showInstallHelp();
          return;
        }
        if (choice.outcome === 'accepted') toast('正在安装…');
        S.installEvent = null;
        renderInstall();
        return;
      } catch (err) {
        S.installEvent = null;
      }
    }
    showInstallHelp();
  }
  function showInstallHelp() {
    const old = document.getElementById('install-help');
    if (old) old.remove();
    const ua = navigator.userAgent;
    const inApp = /MicroMessenger|QQ\/|Weibo|DingTalk|AlipayClient|Lark|GitHub/i.test(ua);
    const ios = /iphone|ipad|ipod/i.test(ua);
    const title = inApp ? '请在浏览器中打开' : ios ? '用 Safari 添加' : '用 Chrome 安装';
    const body = inApp
      ? '当前是内置浏览器（微信/QQ/App 内），不能直接安装。点右上角 … → 在浏览器打开，再用 Chrome 打开本页。'
      : ios
        ? 'Safari：点底部分享按钮 → 添加到主屏幕。'
        : 'Chrome：点右上角 ⋮ → 安装应用；没有这一项就选“添加到主屏幕”。首次打开请先刷新一次，等页面完全加载。';
    const wrap = document.createElement('div');
    wrap.id = 'install-help';
    wrap.className = 'install-help';
    wrap.innerHTML = '<div class="install-help-card" role="dialog" aria-modal="true">' +
      '<span class="install-help-kicker">安装到桌面</span>' +
      '<h3>' + title + '</h3><p>' + body + '</p>' +
      '<button class="btn btn-solid" data-close>知道了</button></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-close]')) wrap.remove();
    });
  }
  async function clearSaved() {
    if (!confirm('清空所有离线音频？曲库和收藏会保留。')) return;
    for (const uid of [...S.saved.keys()]) {
      await delOne('blobs', uid);
      await delOne('saved', uid);
      if (S.blobUrls.has(uid)) { URL.revokeObjectURL(S.blobUrls.get(uid)); S.blobUrls.delete(uid); }
    }
    S.saved.clear();
    toast('已清空离线音频');
    render();
  }
  async function requestPersist() {
    try {
      const ok = await navigator.storage.persist();
      toast(ok ? '已获得持久存储，系统不会自动清理' : '浏览器暂未授予持久存储', ok ? 'ok' : 'warn');
    } catch (e) { toast('当前浏览器不支持', 'warn'); }
  }

  /* ------------------------------ 事件 ------------------------------ */
  function bindEvents() {
    document.addEventListener('click', (e) => {
      const remove = e.target.closest('[data-remove]');
      if (remove) {
        const parts = remove.dataset.remove.split(':');
        S.filters[parts[0]] = S.filters[parts[0]].filter((x) => x !== parts[1]);
        renderFilters();
        renderActiveFilters();
        afterFilterChange();
        return;
      }
      const view = e.target.closest('[data-view]');
      if (view) { setView(view.dataset.view); return; }
      const filter = e.target.closest('[data-filter]');
      if (filter) {
        const k = filter.dataset.filter;
        const id = filter.dataset.id;
        const arr = S.filters[k];
        const i = arr.indexOf(id);
        if (i >= 0) arr.splice(i, 1); else arr.push(id);
        renderFilters();
        renderActiveFilters();
        afterFilterChange();
        return;
      }
      const q = e.target.closest('[data-q]');
      if (q) {
        $('#search').value = q.dataset.q;
        S.q = q.dataset.q;
        S.limit = 80;
        updateSearchUI();
        if (S.view !== 'discover') setView('discover'); else loadDiscover(true);
        return;
      }
      const actEl = e.target.closest('[data-act]');
      if (!actEl) return;
      const act = actEl.dataset.act;
      const row = actEl.closest('[data-uid]');
      const uid = row ? row.dataset.uid : '';
      switch (act) {
        case 'play-row': if (uid) { const t = S.tracks.find((x) => x.uid === uid) || S.live.get(uid) || S.items.find((x) => x.uid === uid); playTrack(t, S.items); } break;
        case 'fav': if (uid) toggleFav(uid); break;
        case 'save': if (uid) { const t = S.tracks.find((x) => x.uid === uid) || S.live.get(uid); saveTrack(t); } break;
        case 'play-saved': {
          const entry = S.saved.get(uid);
          if (entry && entry.track) {
            S.current = entry.track;
            S.queue = savedEntries().map((x) => x.track).filter(Boolean);
            S.qi = S.queue.findIndex((x) => x.uid === uid);
            start(entry.track);
            openSheet('player-sheet');
          }
          break;
        }
        case 'delete-saved': deleteSaved(uid); break;
        case 'toggle': toggle(); break;
        case 'next': next(false); break;
        case 'prev': prev(); break;
        case 'shuffle': toast('随机：点任意一首开始，队列跟着列表'); break;
        case 'repeat': S.repeat = S.repeat === 'off' ? 'all' : S.repeat === 'all' ? 'one' : 'off'; toast(S.repeat === 'one' ? '单曲循环' : S.repeat === 'all' ? '列表循环' : '循环已关'); break;
        case 'fav-current': if (S.current) toggleFav(S.current.uid); break;
        case 'save-current': if (S.current) saveTrack(S.current); break;
        case 'open-player': openSheet('player-sheet'); break;
        case 'open-filter': openSheet('filter-sheet'); break;
        case 'close-sheets': closeSheets(); break;
        case 'clear-filters':
          S.filters = { language: [], scene: [], style: [], instrument: [] };
          renderFilters(); renderActiveFilters(); afterFilterChange();
          break;
        case 'collect': collect(2, false); break;
        case 'more': S.limit += 80; renderTrackList(); break;
      }
    });

    $('#settings-btn').addEventListener('click', () => openSheet('settings-sheet'));
    $('#install-btn').addEventListener('click', install);
    $('#install-btn-2').addEventListener('click', install);
    const installRow = $('#install-row');
    if (installRow) installRow.addEventListener('click', (e) => { if (e.target.closest('button')) return; install(); });
    $('#persist-btn').addEventListener('click', requestPersist);
    $('#check-update').addEventListener('click', () => checkForUpdates(true));
    $('#clear-saved').addEventListener('click', clearSaved);
    $('#auto-switch').addEventListener('click', async () => {
      S.collection.auto = !S.collection.auto;
      $('#auto-switch').setAttribute('aria-checked', String(S.collection.auto));
      await metaSet('autoCollect', S.collection.auto);
      toast(S.collection.auto ? '自动采集已开启' : '自动采集已关闭');
    });

    const search = $('#search');
    const doSearch = debounce(() => {
      S.q = search.value.trim();
      S.limit = 80;
      updateSearchUI();
      if (S.view !== 'discover') setView('discover'); else loadDiscover(true);
    }, 420);
    search.addEventListener('input', () => { updateSearchUI(); doSearch(); });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        S.q = search.value.trim();
        if (S.view !== 'discover') setView('discover'); else loadDiscover(true);
      }
    });
    $('#search-clear').addEventListener('click', () => {
      search.value = '';
      S.q = '';
      updateSearchUI();
      if (S.view !== 'discover') setView('discover'); else loadDiscover(true);
    });

    const range = $('#sheet-range');
    range.addEventListener('input', () => {
      seeking = true;
      const d = audio.duration;
      if (Number.isFinite(d)) $('#sheet-cur').textContent = fmtTime((Number(range.value) / 1000) * d);
    });
    range.addEventListener('change', () => {
      const d = audio.duration;
      if (Number.isFinite(d)) audio.currentTime = (Number(range.value) / 1000) * d;
      seeking = false;
      updateProgress();
    });

    audio.addEventListener('play', () => { updateDock(); markPlaying(); });
    audio.addEventListener('pause', () => { updateDock(); });
    audio.addEventListener('ended', () => next(true));
    audio.addEventListener('timeupdate', () => { if (!seeking) updateProgress(); });
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('waiting', () => { $('.play-btn').classList.add('is-loading'); });
    audio.addEventListener('playing', () => { $$('.play-btn').forEach((b) => b.classList.remove('is-loading')); });
    audio.addEventListener('error', () => {
      if (!S.current) return;
      $$('.play-btn').forEach((b) => b.classList.remove('is-loading'));
      toast('《' + S.current.title.slice(0, 16) + '》暂时播不了', 'err');
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheets(); });
    window.addEventListener('hashchange', () => {
      const h = (location.hash || '').replace('#', '');
      if (['discover', 'radio', 'favorites', 'saved'].includes(h)) setView(h);
    });
  }

  function updateSearchUI() {
    $('#searchbar').classList.toggle('has-value', !!$('#search').value);
  }
  function afterFilterChange() {
    if (S.view === 'discover') loadDiscover(true);
    else if (S.view === 'radio') loadRadio();
  }

  boot().then(() => {
    const hash = (location.hash || '').replace('#', '');
    if (['radio', 'favorites', 'saved'].includes(hash)) setView(hash);
    updateSearchUI();
    renderInstall();
    setInterval(() => { if (!S.collection.running && S.view === 'discover') renderCollection(); }, 60000);
  }).catch((err) => {
    $('#list').innerHTML = emptyState('应用启动失败', String((err && err.message) || err));
  });
})();
