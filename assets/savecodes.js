// Save codes: move your progress between devices with no account and no password.
// Everything the games save lives in this browser (localStorage). A save code is that data packed into a short piece of text.
(function () {
  var GAMES = [['ba.', 'Blaster Arena'], ['cs.', 'Core Strike'], ['ff.', 'Fort Fight'], ['st.', 'Sky Tower'], ['kr.', 'Kart Rush'], ['gg.', 'Gadget Guard'], ['wd.', 'Wobble Dash'], ['pp.', 'Putt Party'],
    ['hkugz.snake.', 'Snake'], ['hkugz.breakout.', 'Breakout'], ['hkugz.cubeflap.', 'Cube Flap'], ['hkugz.blockstack.', 'Block Stack']];
  var OTHER = 'Other (Tower of Destiny and more)';
  var SKIP = [/^peerjs/i, /^hksave\./i, /^hktimer$/i];                       // network helper data and this page's own notes are never packed
  var MAX_KEY = 120, MAX_VALUE = 400000, MAX_TOTAL = 1500000;   // an imported code can never write anything huge

  function gameOf(key) { for (var i = 0; i < GAMES.length; i++) if (key.indexOf(GAMES[i][0]) === 0) return GAMES[i][1]; return OTHER; }
  function skipped(key) { for (var i = 0; i < SKIP.length; i++) if (SKIP[i].test(key)) return true; return false; }
  function allKeys() { var out = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k !== null && !skipped(k)) out.push(k); } } catch (e) {} return out.sort(); }

  // what this browser has saved, grouped by game
  function scan() {
    var groups = {}, total = 0;
    allKeys().forEach(function (k) {
      var v = ''; try { v = localStorage.getItem(k) || ''; } catch (e) {}
      var g = gameOf(k), o = groups[g] || (groups[g] = { name: g, keys: [], bytes: 0 });
      o.keys.push(k); o.bytes += k.length + v.length; total += k.length + v.length;
    });
    var list = Object.keys(groups).map(function (n) { return groups[n]; }).sort(function (a, b) { return a.name === OTHER ? 1 : b.name === OTHER ? -1 : a.name < b.name ? -1 : 1; });
    return { groups: list, total: total };
  }

  // ---- little helpers: base64url, checksum, compression
  function toB64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function fromB64(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; var s = atob(str), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  var CRC = (function () { var t = new Int32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
  function crc32(bytes) { var c = -1; for (var i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8); return ((c ^ -1) >>> 0).toString(16).padStart(8, '0'); }
  function pipe(bytes, stream) { var w = stream.writable.getWriter(); w.write(bytes); w.close(); return new Response(stream.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function deflate(bytes) { return typeof CompressionStream === 'function' ? pipe(bytes, new CompressionStream('deflate-raw')) : Promise.resolve(null); }
  function inflate(bytes) { if (typeof DecompressionStream !== 'function') return Promise.reject(new Error('This browser is too old to open compressed codes. Try Chrome, Edge, Firefox or Safari.')); return pipe(bytes, new DecompressionStream('deflate-raw')); }

  // ---- make a code from the ticked games (null = everything)
  function makeCode(names) {
    var d = {}, count = 0;
    allKeys().forEach(function (k) { if (names && names.indexOf(gameOf(k)) < 0) return; var v = null; try { v = localStorage.getItem(k); } catch (e) {} if (typeof v === 'string' && k.length <= MAX_KEY && v.length <= MAX_VALUE) { d[k] = v; count++; } });
    if (!count) return Promise.reject(new Error('There is nothing saved for those games yet. Play a game first.'));
    var raw = new TextEncoder().encode(JSON.stringify({ v: 1, t: Date.now(), d: d }));
    return deflate(raw).then(function (z) {
      var packed = z && z.length < raw.length ? z : raw, tag = packed === z ? 'HKG1' : 'HKG0';
      return tag + '.' + toB64(packed) + '.' + crc32(packed);
    });
  }

  // ---- read a code and check it is safe and unbroken (does not change anything yet)
  function readCode(text) {
    var code = String(text || '').replace(/\s+/g, '');
    var m = /^(HKG[01])\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(code);
    if (!m) return Promise.reject(new Error('That does not look like a save code. It should start with HKG1 and have two dots in it. Did part of it get cut off?'));
    var bytes; try { bytes = fromB64(m[2]); } catch (e) { return Promise.reject(new Error('That code is damaged (it has letters that do not belong).')); }
    if (crc32(bytes) !== m[3]) return Promise.reject(new Error('That code is damaged or incomplete: the check did not match. Copy it again, all of it.'));
    return (m[1] === 'HKG1' ? inflate(bytes) : Promise.resolve(bytes)).then(function (raw) {
      var o; try { o = JSON.parse(new TextDecoder().decode(raw)); } catch (e) { throw new Error('That code could not be opened.'); }
      if (!o || o.v !== 1 || !o.d || typeof o.d !== 'object') throw new Error('That code is from a different version and cannot be opened.');
      var d = {}, total = 0, groups = {};
      Object.keys(o.d).forEach(function (k) {
        var v = o.d[k]; if (typeof v !== 'string' || !k || k.length > MAX_KEY || v.length > MAX_VALUE || /[\u0000-\u001f]/.test(k) || skipped(k)) return;
        total += k.length + v.length; if (total > MAX_TOTAL) throw new Error('That code holds too much data.');
        d[k] = v; var g = gameOf(k), x = groups[g] || (groups[g] = { name: g, keys: [], bytes: 0 }); x.keys.push(k); x.bytes += k.length + v.length;
      });
      var list = Object.keys(groups).map(function (n) { return groups[n]; }).sort(function (a, b) { return a.name === OTHER ? 1 : b.name === OTHER ? -1 : a.name < b.name ? -1 : 1; });
      if (!list.length) throw new Error('That code has no saves in it.');
      return { t: +o.t || 0, d: d, groups: list };
    });
  }

  // ---- put the ticked games from a code into this browser (their old saves here are replaced)
  function apply(read, names) {
    var written = 0, removed = 0;
    allKeys().forEach(function (k) { if (names.indexOf(gameOf(k)) >= 0) { try { localStorage.removeItem(k); removed++; } catch (e) {} } });
    Object.keys(read.d).forEach(function (k) { if (names.indexOf(gameOf(k)) < 0 || skipped(k)) return; try { localStorage.setItem(k, read.d[k]); written++; } catch (e) {} });
    return { written: written, removed: removed };
  }

  window.HKSave = { scan: scan, makeCode: makeCode, readCode: readCode, apply: apply, gameOf: gameOf, GAMES: GAMES, OTHER: OTHER };
})();
