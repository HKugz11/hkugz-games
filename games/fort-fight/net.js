// Tiny networking layer for Fort Fight online play (same design as Blaster Arena co-op).
//  - production: PeerJS (WebRTC data channels). PeerJS Cloud is only used to introduce players; game data goes peer-to-peer.
//  - testing:    ?net=local swaps in a BroadcastChannel loopback so two tabs of the same browser can play together offline.
// Topology: one host, up to 3 clients (4 players total). Clients only talk to the host.

export const MAX_PLAYERS = 4;
const PREFIX = 'hkgff-';
export const makeCode = () => { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
export const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

class Emitter {
  constructor() { this._h = {}; }
  on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return this; }
  emit(ev, ...a) { for (const fn of (this._h[ev] || []).slice()) { try { fn(...a); } catch (e) { console.error(e); } } }
}

// ---------------------------------------------------------------- local (BroadcastChannel) stand-in with the bits of PeerJS we use
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('hkff-local-net') : null;
const localPeers = new Map();
if (bc) bc.onmessage = ev => { const m = ev.data, p = localPeers.get(m.to); if (p) p._recv(m); };
class LocalConn extends Emitter {
  constructor(peer, remoteId, cid, metadata) { super(); this.peer = remoteId; this._self = peer; this.cid = cid; this.open = false; this.metadata = metadata; }
  send(data) { if (!this.open) return; bc.postMessage({ to: this.peer, from: this._self.id, kind: 'data', cid: this.cid, data: JSON.parse(JSON.stringify(data)) }); }
  close() { if (this._closed) return; this._closed = true; if (bc && this.open) bc.postMessage({ to: this.peer, from: this._self.id, kind: 'close', cid: this.cid }); this.open = false; this.emit('close'); }
}
class LocalPeer extends Emitter {
  constructor(id) {
    super(); this.id = id || 'anon-' + Math.random().toString(36).slice(2, 9); this.conns = new Map(); this.destroyed = false;
    if (id) { // is the id taken in another tab? ask around
      this._probe = true; bc.postMessage({ to: id, from: this.id + '#probe', kind: 'ping' });
      this._probeT = setTimeout(() => { this._probe = false; localPeers.set(this.id, this); this.emit('open', this.id); }, 250);
      this._probeId = id; localPeers.set(id + '#probe', this); this._regProbe = true;
    } else { localPeers.set(this.id, this); setTimeout(() => this.emit('open', this.id), 0); }
  }
  connect(id) {
    const cid = Math.random().toString(36).slice(2, 9), c = new LocalConn(this, id, cid); this.conns.set(cid, c); bc.postMessage({ to: id, from: this.id, kind: 'connect', cid });
    c._to = setTimeout(() => { if (!c.open) { this.emit('error', { type: 'peer-unavailable' }); } }, 2500); return c;
  }
  _recv(m) {
    if (this.destroyed) return;
    if (m.kind === 'ping') { bc.postMessage({ to: m.from, from: this.id, kind: 'pong' }); return; }
    if (m.kind === 'pong') { if (this._probe) { clearTimeout(this._probeT); this._probe = false; localPeers.delete(this._probeId + '#probe'); this.emit('error', { type: 'unavailable-id' }); } return; }
    if (m.kind === 'connect') { const c = new LocalConn(this, m.from, m.cid); this.conns.set(m.cid, c); this.emit('connection', c); c.open = true; bc.postMessage({ to: m.from, from: this.id, kind: 'accept', cid: m.cid }); setTimeout(() => c.emit('open'), 0); return; }
    const c = this.conns.get(m.cid); if (!c) return;
    if (m.kind === 'accept') { clearTimeout(c._to); c.open = true; c.emit('open'); }
    else if (m.kind === 'data') c.emit('data', m.data);
    else if (m.kind === 'close') { c.open = false; if (!c._closed) { c._closed = true; c.emit('close'); } }
  }
  destroy() { this.destroyed = true; clearTimeout(this._probeT); localPeers.delete(this.id); localPeers.delete((this._probeId || '') + '#probe'); for (const c of this.conns.values()) c.close(); }
}

// ---------------------------------------------------------------- Net
export class Net {
  constructor(mode) {
    this.mode = mode; this.peer = null; this.role = 'none'; this.conns = new Map(); this.hostConn = null; this.code = ''; this.closed = false;
    this.onmsg = () => {}; this.onjoin = () => {}; this.onleave = () => {}; this.onclose = () => {};
  }
  _make(id) { const P = this.mode === 'local' ? LocalPeer : window.Peer; if (!P) throw new Error('PeerJS failed to load'); return this.mode === 'local' ? new P(id) : (id ? new P(id, { debug: 0 }) : new P({ debug: 0 })); }
  host(code) {
    this.role = 'host'; this.code = code;
    return new Promise((res, rej) => {
      let p; try { p = this.peer = this._make(PREFIX + code); } catch (e) { return rej(e); }
      p.on('open', () => res(code));
      p.on('error', e => { if (!this._opened) rej(e); else console.warn('net error', e); });
      p.on('connection', conn => {
        let pid = null; for (let i = 1; i < MAX_PLAYERS; i++) if (!this.conns.has(i)) { pid = i; break; }
        conn.on('open', () => {
          if (pid === null) { try { conn.send({ t: 'full' }); } catch (e) {} setTimeout(() => conn.close(), 300); return; }
          this.conns.set(pid, conn); this.onjoin(pid, conn);
        });
        conn.on('data', d => { if (pid !== null && this.conns.get(pid) === conn) this.onmsg(pid, d); });
        conn.on('close', () => { if (pid !== null && this.conns.get(pid) === conn) { this.conns.delete(pid); this.onleave(pid); } });
        conn.on('error', () => {});
      });
      this._opened = false; p.on('open', () => { this._opened = true; });
    });
  }
  join(code) {
    this.role = 'client'; this.code = code;
    return new Promise((res, rej) => {
      let p; try { p = this.peer = this._make(); } catch (e) { return rej(e); }
      let done = false; const fail = e => { if (!done) { done = true; rej(e); } };
      p.on('error', e => { if (!done) fail(e); else console.warn('net error', e); });
      p.on('open', () => {
        const c = this.hostConn = this.mode === 'local' ? p.connect(PREFIX + code) : p.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        c.on('open', () => { if (!done) { done = true; res(); } });
        c.on('data', d => this.onmsg(0, d));
        c.on('close', () => { if (!this.closed) { this.closed = true; this.onclose(); } });
        c.on('error', fail);
        setTimeout(() => fail({ type: 'timeout' }), 12000);
      });
    });
  }
  hostSend(pid, msg) { const c = this.conns.get(pid); if (c && c.open) { try { c.send(msg); } catch (e) {} } }
  hostBroadcast(msg, except = -1) { for (const [pid, c] of this.conns) if (pid !== except && c.open) { try { c.send(msg); } catch (e) {} } }
  clientSend(msg) { const c = this.hostConn; if (c && c.open) { try { c.send(msg); } catch (e) {} } }
  kick(pid) { const c = this.conns.get(pid); if (c) { try { c.send({ t: 'kick' }); } catch (e) {} setTimeout(() => c.close(), 200); } }
  count() { return this.conns.size + 1; }
  close() { this.closed = true; try { if (this.hostConn) this.hostConn.close(); } catch (e) {} for (const c of this.conns.values()) { try { c.close(); } catch (e) {} } try { if (this.peer) this.peer.destroy(); } catch (e) {} this.peer = null; this.conns.clear(); this.hostConn = null; this.role = 'none'; }
}
