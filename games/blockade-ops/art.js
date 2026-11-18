// Core Strike art, Krunker-style: crisp pixel textures, clean blocky geometry, bright colours.
import * as THREE from './three.module.min.js?v=298';
import { W, H, CS, G, ZONE, HG, hAt, SITES, MAP } from './map.js?v=298';

// Lite mode (Chromebooks): game.js sets GFX.lite before the world is built. No sky dome or skyline, 1-draw-call soldier parts.
export const GFX = { lite: false };

// ------------------------------------------------------------------ helpers
let seed = 4242;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
const P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rgb = (c, k = 0) => `rgb(${Math.max(0, Math.min(255, c[0] + k))},${Math.max(0, Math.min(255, c[1] + k))},${Math.max(0, Math.min(255, c[2] + k))})`;
// Keep texture pixels in CPU memory so canvas/graphics-context resets can re-upload them.
function staticTexture(canvas) {
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const t=new THREE.DataTexture(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
 t.flipY=true; t.generateMipmaps=true; t.colorSpace=THREE.SRGBColorSpace;
 t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
}
// Render architectural surfaces at higher resolution without adding polygons.
function pix(size, draw) {
  const scale = size >= 32 ? 2 : 1;
  const c = cv(size * scale), x = c.getContext('2d', {willReadFrequently:true}); x.scale(scale,scale); draw(x, size);
  const t = staticTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = GFX.lite ? 1 : 4;
  return t;
}
// fast version: one little picture of noise drawn in one go (it used to be one canvas call PER pixel, which made loading slow). Same random numbers, same look.
let spkC = null, spkX = null;
const speckle = (x, S, base, amt, x0 = 0, y0 = 0, w = S, h = S) => {
  w = Math.ceil(w); h = Math.ceil(h); if (!(w > 0 && h > 0)) return;
  if (!spkC) { spkC = cv(1); spkX = spkC.getContext('2d'); }
  if (spkC.width !== w || spkC.height !== h) { spkC.width = w; spkC.height = h; }
  const im = spkX.createImageData(w, h), d = im.data, b0 = base[0], b1 = base[1], b2 = base[2]; let p = 0;
  for (let n = w * h; n > 0; n--) { const k = Math.round((rnd() - 0.5) * amt); d[p++] = b0 + k; d[p++] = b1 + k; d[p++] = b2 + k; d[p++] = 255; }
  spkX.putImageData(im, 0, 0);
  const sm = x.imageSmoothingEnabled; x.imageSmoothingEnabled = false; x.drawImage(spkC, x0, y0, w, h); x.imageSmoothingEnabled = sm;
};

export const TEX = {};
const WALL_STYLE = { sandstone: 'Blocks', warehouse: 'Panels', courtyard: 'Blocks', harbor: 'Panels', canyon: 'Blocks', frostbase: 'Panels', oldtown: 'Brick', ruins: 'Blocks', downtown: 'Brick', lab: 'Panels', manor: 'Brick' };   // the wall texture of each map (see makeTextures)
// Krunker look: very soft, low-contrast blotches (big 'pixels'), muted colours
const soft = (size, base, amt, extra) => pix(size, (x, S) => { speckle(x, S, base, amt); if (extra) extra(x, S); });
function makeTextures() {
  if (TEX.wall) return;
  // Fine grain and narrow joints at 128 px per two metres, shared by every map.
  const jitter = (x, x0, y0, w, h, amt) => { const v = (rnd() - 0.5) * amt; x.fillStyle = v > 0 ? `rgba(255,255,255,${v.toFixed(3)})` : `rgba(0,0,0,${(-v).toFixed(3)})`; for (const dx of [0, -32]) x.fillRect(x0 + dx, y0, w, h); };
  function masonry(kind) {
    const t = pix(128, (x, S) => {
      speckle(x, S, [210, 207, 201], 8);
      const bw = kind === 'brick' ? 32 : 64, bh = kind === 'blocks' ? 32 : kind === 'brick' ? 16 : 64;
      for (let row = 0; row < S / bh; row++) {
        const off = kind === 'panels' ? 0 : (row % 2) * bw / 2;
        for (let col = -1; col <= S / bw; col++) {
          const bx = col * bw + off, by = row * bh, shade = (rnd() - .5) * (kind === 'panels' ? 10 : 24);
          const base = kind === 'panels' ? [229+shade,231+shade,233+shade] : [235+shade,232+shade,226+shade];
          speckle(x, S, base, 7, bx+1, by+1, bw-2, bh-2);
          x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(bx+1,by+1,bw-2,1);
          x.fillStyle = 'rgba(50,40,30,.16)'; x.fillRect(bx+1,by+bh-2,bw-2,1);
          if (kind === 'panels') {
            x.fillStyle='rgba(35,45,55,.4)';
            for (const dx of [5,bw-6]) for (const dy of [5,bh-6]) { x.beginPath(); x.arc(bx+dx,by+dy,1,0,Math.PI*2); x.fill(); }
          }
        }
      }
    });
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }
  TEX.wallBlocks = masonry('blocks');
  TEX.wallBrick = masonry('brick');
  TEX.wallPanels = masonry('panels');
  TEX.wall = TEX.wallBlocks;
  TEX.plinth = soft(32, [206, 200, 192], 12, (x, S) => {   // the stone base of every wall: chunky dark blocks
    for (let row = 0; row < 4; row++) {
      const y0 = row * 8, off = (row % 2) * 16;
      jitter(x, off + 1, y0 + 1, 15, 7, 0.24); jitter(x, ((off + 16) % S) + 1, y0 + 1, 15, 7, 0.24);
      x.fillStyle = 'rgba(40,32,24,.55)'; x.fillRect(0, y0, S, 1); x.fillRect(off % S, y0, 1, 8); x.fillRect((off + 16) % S, y0, 1, 8);
      x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(0, y0 + 1, S, 1);
    }
  });
  TEX.cornice = soft(32, [244, 241, 236], 6, (x, S) => {   // the ledge and parapet on top of every wall: slabs with joints
    x.fillStyle = 'rgba(60,48,36,.32)'; for (const y of [0, 12, 20, 28]) x.fillRect(0, y, S, 1); x.fillRect(0, 0, 1, S); x.fillRect(16, 0, 1, S);
    x.fillStyle = 'rgba(255,255,255,.22)'; for (const y of [1, 13, 21, 29]) x.fillRect(0, y, S, 1);
  });
  TEX.wallTop = soft(32, [238, 234, 228], 9, (x, S) => { x.fillStyle = 'rgba(60,50,40,.24)'; for (let i = 0; i < S; i += 8) { x.fillRect(i, 0, 1, S); x.fillRect(0, i, S, 1); } });   // roof slabs
  TEX.floor = soft(16, [178, 116, 88], 12);
  TEX.floorConcrete = soft(16, [172, 174, 176], 10, (x, S) => { x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(0, 0, S, 1); x.fillRect(0, 0, 1, S); x.fillRect(0, 8, S, 1); x.fillRect(8, 0, 1, S); });
  TEX.floorPave = soft(16, [206, 196, 176], 11, (x, S) => { x.fillStyle = 'rgba(70,55,35,.2)'; x.fillRect(0, 0, S, 1); x.fillRect(0, 8, S, 1); x.fillRect(0, 0, 1, 8); x.fillRect(8, 8, 1, 8); });
  TEX.floorAsphalt = soft(16, [118, 124, 132], 10, (x, S) => { x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(0, 0, S, 1); x.fillRect(0, 0, 1, S); x.fillStyle = 'rgba(255,214,70,.16)'; x.fillRect(5, 6, 6, 1); });
  TEX.floorSnow = soft(16, [226, 233, 240], 7, (x, S) => { x.fillStyle = 'rgba(120,150,190,.12)'; x.fillRect(0, 8, S, 1); x.fillRect(8, 0, 1, S); });
  TEX.floorDirt = soft(16, [184, 150, 108], 13, (x, S) => { x.fillStyle = 'rgba(80,55,30,.12)'; x.fillRect(3, 5, 3, 1); x.fillRect(10, 12, 4, 1); });
  TEX.floorTile = soft(16, [204, 200, 190], 8, (x, S) => { x.fillStyle = 'rgba(40,40,40,.16)'; x.fillRect(0, 0, S, 1); x.fillRect(0, 0, 1, S); x.fillRect(0, 8, S, 1); x.fillRect(8, 0, 1, S); });
  TEX.container = soft(16, [238, 238, 238], 5, (x, S) => { x.fillStyle = 'rgba(0,0,0,.16)'; for (let i = 1; i < S; i += 2) x.fillRect(i, 1, 1, S - 2); x.fillStyle = 'rgba(0,0,0,.42)'; x.fillRect(0, 0, S, 1); x.fillRect(0, S - 1, S, 1); x.fillRect(0, 0, 1, S); x.fillRect(S - 1, 0, 1, S); });
  TEX.site = soft(16, [198, 192, 182], 9, (x, S) => { x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, 15, S, 1); x.fillRect(15, 0, 1, S); });
  TEX.crate = soft(16, [170, 122, 78], 8, (x, S) => {
    x.fillStyle = 'rgba(70,40,15,.25)'; for (let i = 3; i < S; i += 4) x.fillRect(1, i, S - 2, 1);
    x.fillStyle = 'rgba(60,35,12,.45)'; x.fillRect(0, 0, S, 1); x.fillRect(0, S - 1, S, 1); x.fillRect(0, 0, 1, S); x.fillRect(S - 1, 0, 1, S);
  });
  TEX.concrete = soft(16, [206, 204, 198], 8, (x, S) => { x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, 0, S, 1); x.fillRect(0, 0, 1, S); });
  TEX.bag = soft(16, [200, 182, 140], 9, (x, S) => { x.fillStyle = 'rgba(80,60,30,.18)'; x.fillRect(0, 3, S, 1); x.fillRect(0, 7, S, 1); x.fillRect(0, 11, S, 1); x.fillRect(0, 15, S, 1); });
  TEX.metal = soft(16, [236, 236, 236], 5, (x, S) => { x.fillStyle = 'rgba(0,0,0,.1)'; for (let i = 0; i < S; i += 2) x.fillRect(i, 0, 1, S); });
  TEX.cloth = soft(4, [240, 240, 240], 3);
  TEX.gun = TEX.cloth; TEX.plain = TEX.cloth;
  TEX.grass = soft(8, [120, 150, 90], 14);
  for (const [name, texture] of Object.entries(TEX)) {
    if (/^(wall|floor|plinth|cornice|concrete|site)/.test(name)) {
      texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
    }
  }
  // Small shared material tiles: detail without additional geometry or draw calls.
  const surface = (name, base, joints) => {
    TEX[name].dispose(); TEX[name] = pix(128, (x,S) => {
      speckle(x,S,base,8);
      if(joints) { x.strokeStyle='rgba(50,44,34,.14)'; x.lineWidth=1;
        for(let row=0;row<4;row++){const y=row*32, off=(row%2)*32;x.beginPath();x.moveTo(0,y+.5);x.lineTo(S,y+.5);x.stroke();
          for(let bx=off;bx<S;bx+=64){x.beginPath();x.moveTo(bx+.5,y);x.lineTo(bx+.5,y+32);x.stroke();}}
      }
    }); TEX[name].magFilter=THREE.LinearFilter; TEX[name].minFilter=THREE.LinearMipmapLinearFilter;
  };
  surface('floor',[190,164,124],false);
  surface('floorDirt',[174,148,111],false);
  surface('floorPave',[198,187,166],true);
  surface('site',[188,184,170],true);
  surface('wallTop',[205,197,180],false);
  TEX.crate.dispose(); TEX.crate=pix(128,(x,S)=>{
    speckle(x,S,[155,112,70],12);
    for(let y=0;y<S;y+=16){x.fillStyle='rgba(42,28,17,.4)';x.fillRect(0,y,S,2);x.fillStyle='rgba(235,195,135,.22)';x.fillRect(0,y+2,S,1);}
    for(let i=0;i<90;i++){x.fillStyle='rgba(52,32,16,.1)';x.fillRect(rnd()*S,rnd()*S,6+rnd()*26,1);}
    x.fillStyle='#645845';for(const xx of [9,109])x.fillRect(xx,0,10,S);
    x.fillStyle='#b7ac8d';for(const xx of [12,112])for(const yy of [7,39,87,119])x.fillRect(xx,yy,3,3);
    x.fillStyle='rgba(235,221,184,.7)';x.fillRect(43,44,37,27);x.fillStyle='#685b43';x.font='bold 17px sans-serif';x.fillText('↑ ↑',47,64);
  });TEX.crate.magFilter=THREE.LinearFilter;TEX.crate.minFilter=THREE.LinearMipmapLinearFilter;
  // A stitched canvas wrap reads across the existing low-cover silhouettes.
  TEX.bag.dispose();
  TEX.bag = pix(64, (x,S) => {
    speckle(x,S,[176,165,128],9);
    for(let row=0;row<3;row++){
      const seam=Math.round(row*S/3);
      x.fillStyle='rgba(52,48,31,.38)';x.fillRect(0,seam,S,2);
      x.fillStyle='rgba(245,227,175,.4)';
      for(let i=0;i<S;i+=4)x.fillRect(i,seam+2,2,1);
    }
  });
  TEX.bag.magFilter=THREE.LinearFilter;TEX.bag.minFilter=THREE.LinearMipmapLinearFilter;
  // faces (transparent background; the head colour shows through)
  TEX.face = [0, 1].map((side) => pix(16, (x) => {
    x.clearRect(0, 0, 16, 16);
    x.fillStyle = '#1d1d1f'; x.fillRect(4, 6, 2, 2); x.fillRect(10, 6, 2, 2);
    x.fillStyle = 'rgba(40,25,20,.75)'; x.fillRect(3, 4, 3, 1); x.fillRect(10, 4, 3, 1);
    if (side === 0) { x.fillStyle = '#2d2d30'; x.fillRect(1, 10, 14, 6); x.fillStyle = '#3d3d42'; x.fillRect(1, 10, 14, 1); }
    else { x.fillStyle = 'rgba(90,45,35,.8)'; x.fillRect(6, 12, 4, 1); }
  }));
}

// ------------------------------------------------------------------ geometry
const GEO = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), c8: new THREE.CylinderGeometry(1, 1, 1, 8), c12: new THREE.CylinderGeometry(1, 1, 1, 12) };
const coneCache = {};
const coneGeo = (r1, r2) => { const k = r1 + ':' + r2; return coneCache[k] || (coneCache[k] = new THREE.CylinderGeometry(r1, r2, 1, 12)); };
const m4 = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(P3.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S3.set(sx, sy, sz));
const pt = {
  box: (w, h, d, x, y, z, c, rx = 0, ry = 0, rz = 0) => [GEO.box, m4(x, y, z, w, h, d, rx, ry, rz), c],
  cyl: (r, h, x, y, z, c, rx = 0, ry = 0, rz = 0) => [GEO.cyl, m4(x, y, z, r, h, r, rx, ry, rz), c],
  // cylinder lying along z (barrels, scopes)
  cz: (r, len, x, y, z, c, seg = 12) => [seg === 8 ? GEO.c8 : GEO.c12, m4(x, y, z, r, len, r, Math.PI / 2), c],
  // tapered cylinder along z: r1 at the front (-z), r2 at the back
  tz: (r1, r2, len, x, y, z, c) => [coneGeo(r2, r1), m4(x, y, z, 1, len, 1, Math.PI / 2), c],
  // box stretched between two points
  seg: (a, b, w, d, c) => {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
    return [GEO.box, new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), new THREE.Vector3(w, len, d)), c];
  },
};
export function mergeParts(list) {
  const pos = [], nor = [], uv = [], col = [], c = new THREE.Color(), v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const [g0, m, hex] of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    nm.getNormalMatrix(m); c.set(hex);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      // cheap baked shading: undersides darker, tops lighter
      const k = v.y < -0.5 ? 0.72 : v.y > 0.5 ? 1.06 : 0.92;
      col.push(c.r * k, c.g * k, c.b * k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere(); return g;
}
class BoxBatch {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; }
  add(x0, y0, z0, x1, y1, z1, { tile = 2, c0 = [1, 1, 1], c1 = c0, faces = 'xXyzZ', uvMode = 'world' } = {}) {
    const F = {
      x: [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0]], X: [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0]],
      y: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]], Y: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]], z: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
      Z: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
    };
    for (const f of faces) {
      const [a, b, c, d, n] = F[f];
      const cr = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
      const quad = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0 ? [a, d, c, b] : [a, b, c, d];
      const shade = f === 'y' ? 1.05 : f === 'Y' ? 0.62 : f === 'x' || f === 'X' ? 0.86 : 0.95;
      const uvs = quad.map(([x, y, z]) => {
        if (uvMode === 'face') return (f === 'x' || f === 'X') ? [(z - z0) / (z1 - z0), (y - y0) / (y1 - y0)] : f === 'y' ? [(x - x0) / (x1 - x0), (z - z0) / (z1 - z0)] : [(x - x0) / (x1 - x0), (y - y0) / (y1 - y0)];
        if (f === 'y' || f === 'Y') return [x / tile, z / tile];
        if (f === 'x' || f === 'X') return [z / tile, y / tile];
        return [x / tile, y / tile];
      });
      for (const i of [0, 1, 2, 0, 2, 3]) {
        const [x, y, z] = quad[i]; this.pos.push(x, y, z); this.nor.push(...n); this.uv.push(...uvs[i]);
        const k = (y - y0) / ((y1 - y0) || 1), cc = f === 'y' ? c1 : f === 'Y' ? c0 : c0.map((v, j) => v + (c1[j] - v) * k);
        this.col.push(cc[0] * shade, cc[1] * shade, cc[2] * shade);
      }
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere(); return g;
  }
}
const lam = (o) => new THREE.MeshLambertMaterial({ flatShading: true, ...o });
function addMesh(scene, geo, mat, cast = true, recv = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; scene.add(m); return m; }

// ------------------------------------------------------------------ world
export const ENV = null;
export function buildWorld(root) {
  makeTextures();
  const scene = new THREE.Group(); root.add(scene);
  const TH = MAP.theme; seed = 4242 + MAP.seedOff;
  const sunDir = new THREE.Vector3(0.5, 0.75, -0.42).normalize();
  // sky: clean gradient. Lite uses a small dome (100 m, ~200 triangles) that game.js keeps centred on the camera; it blends into the fog at the horizon.
  const R = GFX.lite ? 100 : 600, skyGeo = new THREE.SphereGeometry(R, GFX.lite ? 12 : 32, GFX.lite ? 8 : 16), col = [], c = new THREE.Color(), p = skyGeo.attributes.position;
  const top = new THREE.Color(GFX.xmas ? 0x7fb0e6 : TH.skyTop), hor = new THREE.Color(GFX.xmas ? 0xe3edf7 : GFX.lite ? TH.fog : TH.skyHor);   // Christmas: a cool bright winter sky
  for (let i = 0; i < p.count; i++) { const t = Math.max(0, p.getY(i) / R); c.copy(hor).lerp(top, Math.pow(t, 0.6)); col.push(c.r, c.g, c.b); }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.position.set(W, 0, H); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  for (let i = 0; i < 884; i++) rnd(); // keeps the decor layout the same as before the unused cloud boxes were removed


  const isOpen = (x, z) => x >= 0 && z >= 0 && x < W && z < H && G[z * W + x] !== '#';
  const blk = (cx, cz) => hAt(cx, cz) > 0.3;
  // ---- floor (2 m pixel tiles, darker in corners next to walls) ----
  const SNOWC = (x, z) => { const v = 0.93 + 0.07 * (((x * 7 + z * 13) % 4) / 3); return [0.96 * v, 0.985 * v, v]; };   // Christmas: every floor tile is a slightly different white
  const fl = new BoxBatch(), st = new BoxBatch();
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (G[z * W + x] === '#') continue;
    const zn = ZONE[z * W + x];
    const cornerAO = (dx, dz) => { let n = 0; for (const [ax, az] of [[dx, 0], [0, dz], [dx, dz]]) if (blk(x + ax, z + az)) n++; return n ? 0.76 : 1; };
    const a00 = cornerAO(-1, -1), a10 = cornerAO(1, -1), a01 = cornerAO(-1, 1), a11 = cornerAO(1, 1);
    const b = zn === 'a' || zn === 'b' ? st : fl, x0 = x * CS, z0 = z * CS;
    const tint = zn === 'T' ? [1.04, 1.0, 0.95] : zn === 'D' ? [0.96, 0.98, 1.02] : [1, 1, 1];
    const verts = [[x0, z0, a00], [x0 + CS, z0, a10], [x0 + CS, z0 + CS, a11], [x0, z0 + CS, a01]];
    for (const i of [0, 2, 1, 0, 3, 2]) {
      const [vx, vz, ao] = verts[i]; b.pos.push(vx, 0, vz); b.nor.push(0, 1, 0); b.uv.push(vx / CS, -vz / CS);
      if (GFX.xmas) { const sn = SNOWC(x, z); b.col.push(ao * tint[0] * sn[0], ao * tint[1] * sn[1], ao * tint[2] * sn[2]); } else b.col.push(ao * tint[0], ao * tint[1], ao * tint[2]);
    }
  }
  addMesh(scene, fl.geometry(), lam({ map: GFX.xmas ? TEX.plain : TEX[TH.floor], vertexColors: true }), false, true);
  addMesh(scene, st.geometry(), lam({ map: GFX.xmas ? TEX.plain : TEX.site, vertexColors: true }), false, true);
  // site letters + hazard borders painted on top
  const PX = 16, pc = cv(W * PX, H * PX), px = pc.getContext('2d', {willReadFrequently:true});
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const ch = ZONE[z * W + x]; if (ch !== 'a' && ch !== 'b') continue;
    const nb = (dx, dz) => ZONE[(z + dz) * W + x + dx];
    for (const [dx, dz, rx, ry, rw, rh] of [[0, -1, 0, 0, PX, 2], [0, 1, 0, PX - 2, PX, 2], [-1, 0, 0, 0, 2, PX], [1, 0, PX - 2, 0, 2, PX]]) {
      if (nb(dx, dz) === ch) continue;
      for (let i = 0; i < Math.max(rw, rh); i += 2) { px.fillStyle = (i / 2 + x + z) % 2 ? '#ffcf2e' : '#2a2a2a'; px.fillRect(x * PX + rx + (rw > rh ? i : 0), z * PX + ry + (rh > rw ? i : 0), rw > rh ? 2 : rw, rh > rw ? 2 : rh); }
    }
  }
  px.font = 'bold 90px "Arial Black", Impact, Arial'; px.textAlign = 'center'; px.textBaseline = 'middle';
  for (const k of ['a', 'b']) { const s = SITES[k]; const x = s.center[0]*PX, y=(s.center[1]+.5)*PX+18;
    px.fillStyle=k==='a'?'#9b4b20':'#33566b'; px.fillRect(x-47,y-45,94,90);
    px.strokeStyle='#eee9d7'; px.lineWidth=2;px.strokeRect(x-42,y-40,84,80);
    px.fillStyle='#fff7e6';px.fillText(s.name,x,y+1); }
  const paintT = staticTexture(pc); paintT.colorSpace = THREE.SRGBColorSpace; paintT.magFilter = THREE.LinearFilter;
  const paint = addMesh(scene, new THREE.PlaneGeometry(W * CS, H * CS), lam({ map: paintT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), false, true);
  paint.rotation.x = -Math.PI / 2; paint.position.set(W, 0.01, H);

  // ---- walls, crates, platforms ----
  // Every wall is a full 3D build: a stone base (plinth), the wall itself with a real block / brick / panel texture, a pillar every 6 m, and a ledge with a little parapet on top.
  // Each piece is a solid box with a textured top, sides, ends and underside (the plinth and pillars are built once per straight run of wall).
  const wb = new BoxBatch(), tops = new BoxBatch(), crates = new BoxBatch(), conc = new BoxBatch(), bags = new BoxBatch(), base = new BoxBatch(), cap = new BoxBatch();
  const snowB = new BoxBatch(), SNOW = [0.97, 0.985, 1];   // Christmas: thin white snow caps on wall tops, ledges, crates and cover
  const WI = new Array(W * H).fill(null);   // for every wall cell that touches open ground: which sides are open, its colour and its height
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const ch = G[z * W + x], h = HG[z * W + x], x0 = x * CS, z0 = z * CS, x1 = x0 + CS, z1 = z0 + CS;
    if (ch === '#') {
      const side = (dx, dz) => { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) return false; return G[nz * W + nx] !== '#'; };   // faces between two wall cells are never seen from the ground (the rock is at least 5 m tall), so only faces next to open ground are built
      let f = ''; if (side(-1, 0)) f += 'x'; if (side(1, 0)) f += 'X'; if (side(0, -1)) f += 'z'; if (side(0, 1)) f += 'Z';
      const palI = (Math.floor(x / 5) * 7 + Math.floor(z / 4) * 13) % TH.walls.length, pal = TH.walls[palI];
      const t = 0.99 + rnd() * 0.02, T = pal.map((v) => v * t);
      if (f) { wb.add(x0, 0, z0, x1, 1.7, z1, { c0: T.map((v) => v * 0.84), c1: T, faces: f }); wb.add(x0, 1.7, z0, x1, h, z1, { c0: T, faces: f }); WI[z * W + x] = { f, palI, h, T }; }
      // A taller wall exposes a riser above its neighbor. These faces are
      // visible from the ground and overhead, even though both cells are '#'.
      // Also close the outer perimeter; only truly buried faces are culled.
      for (const [dx, dz, face] of [[-1, 0, 'x'], [1, 0, 'X'], [0, -1, 'z'], [0, 1, 'Z']]) {
        const nx = x + dx, nz = z + dz;
        const outside = nx < 0 || nz < 0 || nx >= W || nz >= H;
        if (!outside && G[nz * W + nx] !== '#') continue;
        const bottom = outside ? 0 : HG[nz * W + nx];
        if (h > bottom) wb.add(x0, bottom, z0, x1, h, z1, { c0: T, faces: face });
      }
      tops.add(x0, h - 0.01, z0, x1, h, z1, { faces: 'y', c0: T }); if (GFX.xmas) snowB.add(x0, h, z0, x1, h + 0.07, z1, { c0: SNOW, faces: 'y' + f });   // deep rock gets a flat top too (just 2 triangles): the menu camera looks down from above and used to see straight through it to the ground
    } else if (ch === 'C') {
      crates.add(x0 + 0.02, 0, z0 + 0.02, x1 - 0.02, 1.96, z1 - 0.02, TH.crates ? { uvMode: 'face', c0: TH.crates[(Math.floor(x / 3) * 7 + z * 13) % TH.crates.length] } : { uvMode: 'face' }); if (GFX.xmas) snowB.add(x0 + 0.02, 1.96, z0 + 0.02, x1 - 0.02, 2.03, z1 - 0.02, { c0: SNOW, faces: 'xXzZy' });   // maps with shipping containers colour them in runs of 3
    } else if (ch === 'c') {
      for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const t = 0.88 + rnd() * 0.16, pc = TH.crates ? TH.crates[(x * 5 + z * 3) % TH.crates.length] : [1, 1, 1]; crates.add(x0 + a + 0.02, 0, z0 + b + 0.02, x0 + a + 0.98, 0.98, z0 + b + 0.98, { uvMode: 'face', c0: [pc[0] * t, pc[1] * t, pc[2] * t] }); if (GFX.xmas) snowB.add(x0 + a + 0.02, 0.98, z0 + b + 0.02, x0 + a + 0.98, 1.04, z0 + b + 0.98, { c0: SNOW, faces: 'xXzZy' }); }
    } else if ('P123'.includes(ch)) {
      conc.add(x0, 0, z0, x1, h, z1, { c0: [0.8, 0.8, 0.8], c1: [1, 1, 1] });
      if (ch === 'P') conc.add(x0, h, z0, x1, h + 0.04, z1, { c0: [1, 0.85, 0.3], faces: 'y' });
      if (GFX.xmas) snowB.add(x0, h + (ch === 'P' ? 0.04 : 0), z0, x1, h + 0.1, z1, { c0: SNOW, faces: 'xXzZy' });
    } else if (ch === 's') {
      bags.add(x0 + 0.05, 0, z0 + 0.05, x1 - 0.05, 0.9, z1 - 0.05, { tile: 2 });
      if (GFX.xmas) snowB.add(x0 + 0.05, 0.9, z0 + 0.05, x1 - 0.05, 0.96, z1 - 0.05, { c0: SNOW, faces: 'xXzZy' });
    }
  }
  {
    const OPP = { x: 'X', X: 'x', z: 'Z', Z: 'z' }, tint = (T, k) => T.map((v) => v * k);
    // a solid box lying against the face f of a wall: bnd = where that face is, a..b = along the wall, out = how far it sticks out, into = how far it sinks into the wall
    const piece = (batch, f, bnd, a, b, out, into, y0, y1, faces, T, k, eps) => {
      const c0 = tint(T, k);
      if (f === 'x') batch.add(bnd - out, y0, a, bnd + into, y1 + eps, b, { faces, c0 });
      else if (f === 'X') batch.add(bnd - into, y0, a, bnd + out, y1 + eps, b, { faces, c0 });
      else if (f === 'z') batch.add(a, y0, bnd - out, b, y1 + eps, bnd + into, { faces, c0 });
      else batch.add(a, y0, bnd - into, b, y1 + eps, bnd + out, { faces, c0 });
    };
    const emit = (f, line, a, b, cells) => {   // a straight run of wall faces: cells a..b-1 along the wall
      const along = f === 'x' || f === 'X', ends = along ? 'zZ' : 'xX', bnd = (f === 'x' || f === 'z' ? line : line + 1) * CS, eps = 0.0015 * 'xXzZ'.indexOf(f);
      piece(base, f, bnd, a * CS, b * CS, 0.07, 0.12, 0, 0.5, f + 'y' + ends, cells[0].T, 0.64, eps);                        // the stone base
      for (let i = a; i < b; i++) {   // the top of each cell: a ledge with an underside, and (not in Lite) a low parapet
        const c = cells[i - a], A = i * CS, B = A + CS;
        piece(cap, f, bnd, A, B, 0.16, 0.12, c.h - 0.32, c.h, f + 'yY' + ends, c.T, 1.06, eps);   // Complete textured ledge in every quality mode; boxes meet without overlapping tops.
        if (!GFX.lite) piece(cap, f, bnd, A, B, 0.05, 0.5, c.h, c.h + 0.22, f + OPP[f] + 'y' + ends, c.T, 1.0, eps);
        if (GFX.xmas) { piece(snowB, f, bnd, A, B, 0.16, 0.12, c.h, c.h + 0.045, f + 'y' + ends, SNOW, 1, eps); if (!GFX.lite) piece(snowB, f, bnd, A, B, 0.05, 0.5, c.h + 0.22, c.h + 0.27, f + 'y' + ends, SNOW, 1, eps); }   // snow on the ledge and the parapet
        if (!GFX.lite && i > a && (i - a) % 3 === 0) { const p = cells[i - a - 1], hh = Math.min(p.h, c.h) - 0.32; piece(wb, f, bnd, A - 0.26, A + 0.26, 0.14, 0.1, 0.5, hh, f + 'y' + ends, c.T, 1.05, eps); }   // a pillar every 6 m
      }
    };
    for (const f of ['x', 'X', 'z', 'Z']) {
      const along = f === 'x' || f === 'X', lines = along ? W : H, len = along ? H : W;
      for (let l = 0; l < lines; l++) {
        let run = null, start = 0;
        for (let i = 0; i <= len; i++) {
          const info = i < len ? WI[(along ? i : l) * W + (along ? l : i)] : null, ok = info && info.f.includes(f) ? info : null;
          if (run && ok && ok.palI === run[0].palI) { run.push(ok); continue; }
          if (run) emit(f, l, start, i, run);
          run = ok ? [ok] : null; start = i;
        }
      }
    }
  }
  const WT = TEX['wall' + (WALL_STYLE[MAP.id] || 'Blocks')];
  addMesh(scene, wb.geometry(), lam({ map: WT, vertexColors: true }));
  addMesh(scene, base.geometry(), lam({ map: TEX.plinth, vertexColors: true }));
  addMesh(scene, cap.geometry(), lam({ map: TEX.cornice, vertexColors: true }));
  addMesh(scene, tops.geometry(), lam({ map: TEX.wallTop, vertexColors: true }), false, true);
  addMesh(scene, crates.geometry(), lam({ map: TH.crates ? TEX.container : TEX.crate, vertexColors: true }));
  addMesh(scene, conc.geometry(), lam({ map: TEX.concrete, vertexColors: true }));
  addMesh(scene, bags.geometry(), lam({ map: TEX.bag, vertexColors: true }));
  if (GFX.xmas) addMesh(scene, snowB.geometry(), lam({ map: TEX.plain, vertexColors: true }));

  // ---- barrels, decorations ----
  const barrels = [], deco = [], glow = [], plants = [];
  const bcols = [0x9c4a3a, 0x3d5f8c, 0xb8913f, 0x5a6e48];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (G[z * W + x] !== 'o') continue;
    for (const [a, b] of [[0.5, 0.5], [1.5, 0.52], [0.52, 1.5], [1.48, 1.48]]) {
      const cc = bcols[(rnd() * 4) | 0], bx = x * CS + a, bz = z * CS + b;
      barrels.push(pt.cyl(0.42, 1.2, bx, 0.6, bz, cc), pt.cyl(0.43, 0.06, bx, 0.35, bz, 0x2a2a2a), pt.cyl(0.43, 0.06, bx, 0.85, bz, 0x2a2a2a));
    }
  }
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (G[z * W + x] !== '#') continue;
    const h = HG[z * W + x];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!isOpen(x + dx, z + dz)) continue;
      const r = rnd(), fx = x * CS + 1 + dx, fz = z * CS + 1 + dz, ry = Math.atan2(dx, dz);
      const at = (out, side, y) => [fx + dx * out + dz * side, y, fz + dz * out - dx * side];
      if (r < 0.1 && h > 4) { // window
        const [a, b, cc] = at(0.03, 0, 3.4); deco.push([GEO.box, m4(a, b, cc, 1.0, 1.25, 0.1, 0, ry), 0x7a5232]);
        const [a2, b2, c2] = at(0.05, 0, 3.4); deco.push([GEO.box, m4(a2, b2, c2, 0.8, 1.05, 0.1, 0, ry), 0x2d4d6e]);
        const [a3, b3, c3] = at(0.08, 0, 3.4); deco.push([GEO.box, m4(a3, b3, c3, 0.06, 1.05, 0.1, 0, ry), 0x7a5232]);
      } else if (r < 0.16) { // door
        const [a, b, cc] = at(0.03, 0, 1.15); deco.push([GEO.box, m4(a, b, cc, 1.1, 2.3, 0.1, 0, ry), [0x5a8fc7, 0x3f9a4a, 0xb4472f, 0x8a5a32][(rnd() * 4) | 0]]);
        const [a2, b2, c2] = at(0.08, 0.35, 1.1); deco.push([GEO.box, m4(a2, b2, c2, 0.08, 0.08, 0.06, 0, ry), 0xf2c94c]);
      } else if (r < 0.2) { // lamp
        const [a, b, cc] = at(0.16, 0, 2.8); glow.push([GEO.box, m4(a, b, cc, 0.2, 0.26, 0.2, 0, ry), 0xfff1b0]);
        const [a2, b2, c2] = at(0.08, 0, 3.0); deco.push([GEO.box, m4(a2, b2, c2, 0.06, 0.06, 0.16, 0, ry), 0x333333]);
      } else if (r < 0.24) { // striped awning
        const cc = rnd() < 0.5 ? 0xd94f3d : 0x3f86d4;
        const [a, b2, c2] = at(0.5, 0, 3.1); deco.push([GEO.box, new THREE.Matrix4().compose(V(a, b2, c2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, ry, 0, 'YXZ')), new THREE.Vector3(1.8, 0.1, 1.1)), cc]);
        const [a3, b3, c3] = at(1.0, 0, 2.78); deco.push([GEO.box, m4(a3, b3, c3, 1.8, 0.22, 0.05, 0, ry), 0xf4efe6]);
      } else if (r < 0.28 && G[(z + dz) * W + x + dx] === '.') { // planter
        const [a, , cc] = at(0.35, 0.5, 0); deco.push(pt.box(0.6, 0.45, 0.6, a, 0.225, cc, 0x9c5a3a)); plants.push(pt.box(0.5, 0.4, 0.5, a, 0.6, cc, 0xffffff), pt.box(0.3, 0.3, 0.3, a + 0.05, 0.9, cc - 0.05, 0xdfffd0));
      } else if (r < 0.31) { // vent
        const [a, b, cc] = at(0.05, -0.4, 1.4); deco.push([GEO.box, m4(a, b, cc, 0.7, 0.5, 0.12, 0, ry), 0x9aa0a6]);
      }
    }
  }
  addMesh(scene, mergeParts(barrels), lam({ map: TEX.metal, vertexColors: true }));
  addMesh(scene, mergeParts(deco), lam({ map: TEX.plain, vertexColors: true }));
  if (plants.length) addMesh(scene, mergeParts(plants), lam({ map: TEX.grass, vertexColors: true }));
  addMesh(scene, mergeParts(glow), new THREE.MeshBasicMaterial({ vertexColors: true }), false, false);

  // ---- CHRISTMAS: small blocky trees, present piles, snowmen and candy canes tucked into quiet corners, plus strings of coloured lights on a few walls.
  // Plain decoration (nothing solid, nothing in the lanes: only corners where two walls meet and the rest of the area is open). Not in Lite. All merged into 2 meshes. ----
  if (GFX.xmas && !GFX.lite) {
    let ps = ((MAP.seedOff + 7) * 2654435) % 2147483647 || 12345; const pr = () => (ps = (ps * 16807) % 2147483647) / 2147483647;
    const dec = [], bulbs = [], open = (cx, cz) => cx > 0 && cz > 0 && cx < W - 1 && cz < H - 1 && G[cz * W + cx] === '.';
    const put = (list, cx, cz, yaw, sc = 1) => { const s = Math.sin(yaw), c = Math.cos(yaw); for (const [lx, ly, lz, w, h, d, col] of list) dec.push([GEO.box, m4(cx + (lx * c + lz * s) * sc, ly * sc, cz + (-lx * s + lz * c) * sc, w * sc, h * sc, d * sc, 0, yaw), col]); };
    const tree = () => {
      const L = [[0, .3, 0, .26, .6, .26, 0x6b4a2a]], GR = [0x1e6b34, 0x27853f, 0x1e6b34, 0x2a8f46], OC = [0xe53935, 0xffc107, 0x2979ff, 0xd81b60, 0xf6f6f2];
      [[1.5, .8], [1.15, 1.25], [.82, 1.7], [.5, 2.12]].forEach(([w, y], i) => {
        L.push([0, y, 0, w, .46, w, GR[i]], [0, y + .24, 0, w * .86, .06, w * .86, 0xf4f8ff]);   // a tier, with a little snow on it
        const h2 = w / 2 + .02; L.push([h2, y, w * .1, .14, .14, .14, OC[i % 5]], [-h2, y - .05, -w * .2, .14, .14, .14, OC[(i + 2) % 5]], [w * .2, y + .02, h2, .14, .14, .14, OC[(i + 3) % 5]], [-w * .15, y - .06, -h2, .14, .14, .14, OC[(i + 1) % 5]]);   // ornament cubes
      });
      L.push([0, 2.5, 0, .22, .22, .22, 0xffd23f], [0, 2.5, 0, .4, .08, .08, 0xffd23f], [0, 2.5, 0, .08, .4, .08, 0xffd23f]);   // yellow star
      return L;
    };
    const presents = () => { const L = []; [[0, 0, .55, 0xd32f2f, 0xf6f6f2], [.6, .3, .4, 0x2e7d32, 0xe6b422], [-.38, .52, .34, 0xe6b422, 0xd32f2f]].forEach(([x, z, s, c, r]) => { L.push([x, s / 2, z, s, s, s, c], [x, s / 2, z, s + .02, s + .02, .08, r], [x, s / 2, z, .08, s + .02, s + .02, r], [x, s + .05, z, .17, .1, .17, r]); }); return L; };
    const snowman = () => [[0, .35, 0, .95, .7, .95, 0xf6f9fc], [0, .95, 0, .68, .5, .68, 0xf6f9fc], [0, 1.45, 0, .48, .46, .48, 0xf6f9fc], [-.1, 1.52, .25, .07, .07, .05, 0x15151a], [.1, 1.52, .25, .07, .07, .05, 0x15151a], [0, 1.43, .34, .08, .08, .3, 0xff8a2a],
      [0, 1.17, 0, .56, .1, .56, 0xd62828], [0, .95, .35, .08, .08, .04, 0x15151a], [0, .75, .5, .08, .08, .04, 0x15151a], [-.58, 1.0, 0, .62, .05, .05, 0x5a3a1e], [.58, 1.0, 0, .62, .05, .05, 0x5a3a1e], [0, 1.74, 0, .42, .05, .42, 0x15151a], [0, 1.9, 0, .28, .27, .28, 0x15151a], [0, 1.82, 0, .3, .06, .3, 0xd62828]];
    const canes = () => { const L = []; [[-.45, 0, 1], [0, .22, .85], [.45, -.1, 1.1]].forEach(([x, z, s]) => { for (let k = 0; k < 8; k++) L.push([x, (k + .5) * .13 * s, z, .09 * s, .13 * s, .09 * s, k % 2 ? 0xf6f3ee : 0xd62828]); const t = 8 * .13 * s; L.push([x + .06 * s, t + .02, z, .2 * s, .1 * s, .09 * s, 0xf6f3ee], [x + .15 * s, t - .06 * s, z, .09 * s, .14 * s, .09 * s, 0xd62828]); }); return L; };
    const kinds = [tree, tree, presents, snowman, canes, tree, presents, snowman];
    // corner cells: two touching walls, the opposite two sides open, and a clear patch inside
    const cand = [];
    for (let z = 2; z < H - 2; z++) for (let x = 2; x < W - 2; x++) {
      if (G[z * W + x] !== '.' || ZONE[z * W + x] === 'a' || ZONE[z * W + x] === 'b') continue;
      const ws = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => G[(z + dz) * W + x + dx] === '#');
      if (ws.length !== 2) continue;
      const sx = ws[0][0] + ws[1][0], sz = ws[0][1] + ws[1][1]; if (!sx || !sz) continue;
      if (open(x - sx, z - sz) && open(x - sx * 2, z - sz) && open(x - sx, z - sz * 2) && open(x - sx * 2, z - sz * 2)) cand.push([x, z, sx, sz]);
    }
    for (let i = cand.length - 1; i > 0; i--) { const j = (pr() * (i + 1)) | 0; [cand[i], cand[j]] = [cand[j], cand[i]]; }
    const taken = []; let n = 0;
    for (const [x, z, sx, sz] of cand) {
      if (n >= 24) break;
      if (taken.some(([tx, tz]) => (tx - x) * (tx - x) + (tz - z) * (tz - z) < 49)) continue;
      taken.push([x, z]); put(kinds[n % kinds.length](), x * CS + 1 + sx * 0.38, z * CS + 1 + sz * 0.38, Math.atan2(-sx, -sz) + (pr() - 0.5) * 0.7, 0.85 + pr() * 0.3); n++;
    }
    // strings of lights along a few tall walls (emissive little cubes, no real lights)
    const BC = [0xff3b3b, 0xffd23f, 0x2fd36b, 0x3fa7ff]; let strands = 0;
    for (let z = 1; z < H - 1 && strands < 8; z++) for (let x = 1; x < W - 1 && strands < 8; x++) {
      const info = WI[z * W + x]; if (!info || info.h < 4.5 || (x * 31 + z * 17) % 29 !== 0) continue;
      for (const f of 'xXzZ') {
        if (!info.f.includes(f)) continue;
        const along = f === 'x' || f === 'X', nb = WI[(along ? z + 1 : z) * W + (along ? x : x + 1)]; if (!nb || !nb.f.includes(f)) continue;
        const face = f === 'x' ? x * CS - 0.09 : f === 'X' ? (x + 1) * CS + 0.09 : f === 'z' ? z * CS - 0.09 : (z + 1) * CS + 0.09, a0 = along ? z * CS : x * CS;
        for (let k = 0; k <= 8; k++) { const t = k / 8, y = 3.3 - 0.32 * Math.sin(Math.PI * t), p = a0 + t * 4; bulbs.push([GEO.box, along ? m4(face, y, p, 0.14, 0.17, 0.14) : m4(p, y, face, 0.14, 0.17, 0.14), BC[k % 4]]); }
        strands++; break;
      }
    }
    if (dec.length) addMesh(scene, mergeParts(dec), lam({ map: TEX.plain, vertexColors: true }));
    if (bulbs.length) addMesh(scene, mergeParts(bulbs), new THREE.MeshBasicMaterial({ vertexColors: true }), false, false);
  }

  // ---- skyline (skipped in Lite) ----
  const sk = new BoxBatch(), roofs = [], palms = [];
  for (let i = 0; i < (GFX.lite ? 0 : 70); i++) {
    const a = rnd() * Math.PI * 2, r = 66 + Math.max(0, Math.max(W, H) - 44) * CS * 0.5 + rnd() * 80, x = W + Math.cos(a) * r * 1.15, z = H + Math.sin(a) * r;
    const w = 6 + rnd() * 12, d = 6 + rnd() * 12, h = 7 + rnd() * 16;
    sk.add(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, { c0: [0.85, 0.85, 0.85] });
    if (rnd() < 0.3) roofs.push(pt.box(w * 0.5, 2.5, d * 0.5, x, h + 1.25, z, rnd() < 0.5 ? TH.roofs[0] : TH.roofs[1]));
    if (TH.palms && rnd() < 0.5) {
      const px2 = x + w * 0.6 + rnd() * 3, pz = z + d * 0.6, ph = 7 + rnd() * 5;
      palms.push(pt.box(0.5, ph, 0.5, px2, ph / 2, pz, 0x8a6a45));
      for (let k = 0; k < 4; k++) { const an = k / 4 * Math.PI * 2 + 0.4; palms.push([GEO.box, m4(px2 + Math.cos(an) * 1.4, ph, pz + Math.sin(an) * 1.4, 3, 0.25, 1, 0, -an, -0.35), 0x4fa83c]); }
    }
  }
  if (!GFX.lite) {
    addMesh(scene, sk.geometry(), lam({ map: TEX.wall, vertexColors: true }), false, false);
    addMesh(scene, mergeParts(roofs), lam({ map: TEX.plain, vertexColors: true }), false, false);
    addMesh(scene, mergeParts(palms), lam({ map: TEX.plain, vertexColors: true }), false, false);
  }
  // (the outside ground sits well below the floor tiles and is pushed back in depth: the 3 cm gap it used to have made it flash through the floor, green on Ruins, when the menu camera looks down from high up)
  const sand = addMesh(scene, new THREE.PlaneGeometry(1400, 1400), lam({ color: GFX.xmas ? 0xe4ebf3 : TH.ground, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 }), false, false);
  sand.rotation.x = -Math.PI / 2; sand.position.set(W, -0.4, H);

  // signs
  const sign = (cx, cz, dx, dz, text, bg) => {
    const cc = cv(256, 160), x = cc.getContext('2d', {willReadFrequently:true}); x.scale(4,4);
    const siteA = /\bA\b/.test(text), siteB = /\bB\b/.test(text);
    const stripe = siteA ? '#e97b32' : siteB ? '#71afcf' : bg;
    x.fillStyle='#26313a'; x.fillRect(0,0,64,40);
    x.fillStyle=stripe; x.fillRect(0,0,5,40);
    x.fillStyle='#e8e9df'; x.font='bold 6px Arial'; x.textAlign='left';
    x.fillText(siteA || siteB ? 'SITE ROUTE' : 'SECTOR',9,9);
    x.font='bold 24px Arial'; x.textBaseline='middle'; x.fillText(text,9,25,52);
    const t=staticTexture(cc);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), lam({ map: t, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(cx * CS + 1 + dx * 1.01, 2.4, cz * CS + 1 + dz * 1.01); m.rotation.y = Math.atan2(dx, dz); m.receiveShadow = true; scene.add(m);
  };
  for (const [cx, cz, dx, dz, text, bg] of MAP.signs) sign(cx, cz, dx, dz, text, bg);
  return { sunDir, group: scene, sky: GFX.lite ? sky : null };
}
export function disposeWorld(group) {
  const keep = new Set(Object.values(TEX).flat());
  group.parent && group.parent.remove(group);
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) for (const m of [].concat(o.material)) { if (m.map && !keep.has(m.map)) m.map.dispose(); m.dispose(); }
  });
}

// ------------------------------------------------------------------ characters (chunky toy soldiers, kept simple)
// Wide shoulders that taper to the waist, a big head with a plain helmet. Natural uniform colours tell the teams apart:
//   THUGS = dark clothes + tan vest + skull cap (like the terrorists)      OPS = charcoal + black vest + black helmet (like the counter-terrorists)
// plus a tiny team-colour stripe on the cap / helmet. No skin anywhere, no blood.
const SPAL = [
  // THUGS (like the terrorists): charcoal clothes, coyote-tan vest, black balaclava and a dark skull cap
  { shirt: 0x4d4b48, pants: 0x3a3936, vest: 0xa28d5f, pouch: 0x6f6040, helm: 0x2e2e31, helmD: 0x202022, cap: true, team: 0xa28d5f, boot: 0x2a241d, glove: 0x19191a, mask: 0x1b1b1d, maskU: 0x121213, trim: 0x1a1a1b, eye: 0xf2ecd8 },
  // OPS (like the counter-terrorists): charcoal uniform, black vest, black helmet and balaclava
  { shirt: 0x3b414b, pants: 0x2e3238, vest: 0x131418, pouch: 0x15171b, helm: 0x24272d, helmD: 0x17191d, cap: false, team: 0xe8edf2, boot: 0x0e0f11, glove: 0x0c0d0f, mask: 0x111319, maskU: 0x0b0d12, trim: 0x0d0e12, eye: 0xe8edf5 },
];
export const SIDE_SLEEVE = [0x4d4b48, 0x3b414b];
export const charMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
export const lensMats = [];
const solCache = {};
export function soldierParts(side, lite = false) {
  const key = side + (lite ? 'L' : 'F');
  if (solCache[key]) return solCache[key];
  const p = SPAL[side], F = !lite;
  // legs 0-0.62, hips 0.62, chest up to 1.33, head cube 1.37-1.73 (centre 1.55), helmet on top
  const thigh = () => mergeParts([pt.box(0.25, 0.34, 0.27, 0, -0.16, 0, p.pants)]);
  const shin = mergeParts([
    pt.box(0.23, 0.2, 0.25, 0, -0.1, 0, p.pants),
    pt.box(0.2, 0.13, 0.07, 0, 0.0, -0.14, p.trim),                        // knee pad
    pt.box(0.25, 0.1, 0.33, 0, -0.255, -0.04, p.boot), pt.box(0.27, 0.035, 0.36, 0, -0.295, -0.04, 0x151515),   // boot + sole
  ]);
  const torso = mergeParts([
    pt.box(0.5, 0.12, 0.3, 0, 0.67, 0, p.pants),                          // hips
    pt.box(0.54, 0.06, 0.34, 0, 0.745, 0, p.trim),                        // belt
    pt.box(0.52, 0.5, 0.3, 0, 1.03, 0, p.shirt),                          // uniform
    pt.box(0.62, 0.46, 0.4, 0, 1.06, 0, p.vest),                          // kevlar vest: one solid block
    pt.box(0.22, 0.08, 0.22, 0, 1.36, 0, p.mask),                         // neck
    pt.box(0.4, 0.36, 0.16, 0, 1.02, 0.28, p.pouch),                      // backpack
    ...(F ? [pt.box(0.14, 0.15, 0.07, -0.17, 0.97, -0.235, p.pouch), pt.box(0.14, 0.15, 0.07, 0, 0.97, -0.235, p.pouch), pt.box(0.14, 0.15, 0.07, 0.17, 0.97, -0.235, p.pouch)] : []),   // 3 pouches
  ]);
  const head = mergeParts([
    pt.box(0.36, 0.34, 0.36, 0, 0, 0, p.maskU),                           // face mask
    pt.box(0.375, 0.1, 0.375, 0, -0.12, 0, p.mask),                       // lower mask
    ...(p.cap
      ? [pt.box(0.41, 0.14, 0.41, 0, 0.145, 0, p.helm), pt.box(0.36, 0.06, 0.36, 0, 0.245, 0, p.helmD)]                                   // skull cap
      : [pt.box(0.44, 0.17, 0.44, 0, 0.16, 0, p.helm), pt.box(0.38, 0.07, 0.4, 0, 0.27, 0, p.helm), pt.box(0.4, 0.05, 0.07, 0, 0.115, -0.24, p.helmD)]),   // helmet + brim
    // team band: tan (Thugs) or silver-white (Ops) all the way round the cap / helmet, so you can tell the teams apart from any side, even far away
    pt.box(p.cap ? 0.465 : 0.495, 0.065, p.cap ? 0.465 : 0.495, 0, p.cap ? 0.125 : 0.195, 0, p.team),
    // eyes: bright blocks with a dark pupil, big enough to see across the map (they are part of the Lite soldiers too)
    pt.box(0.1, 0.075, 0.03, -0.09, 0.035, -0.19, p.eye), pt.box(0.1, 0.075, 0.03, 0.09, 0.035, -0.19, p.eye),
    pt.box(0.045, 0.065, 0.035, -0.09, 0.035, -0.2, 0x15151a), pt.box(0.045, 0.065, 0.035, 0.09, 0.035, -0.2, 0x15151a),
  ]);
  return (solCache[key] = { thighL: thigh(), thighR: thigh(), shin, torso, head });
}

// ---- what the soldier holds: arms + gun are ONE merged mesh per gun class (arms pose changes with the class) ----
// Classes: rifle, smg, shotgun, sniper, lmg (two hands) · pistol, revolver, mpistol (two hands out front) · knife · nade
const GUNC = { metal: 0x2d2f35, metalL: 0x4a4d55, poly: 0x1b1c20, wood: 0x7a5233, woodD: 0x5a3b25, olive: 0x56603f, steel: 0xdde3ea };
const TP_GUNS = {
  rifle: (x, y) => [pt.box(0.07, 0.13, 0.24, x, y - 0.025, 0.04, GUNC.wood), pt.box(0.085, 0.14, 0.26, x, y, -0.2, GUNC.metal), pt.box(0.05, 0.035, 0.2, x, y + 0.088, -0.2, GUNC.metalL),
    pt.box(0.08, 0.11, 0.24, x, y - 0.005, -0.46, GUNC.woodD), pt.cz(0.022, 0.28, x, y + 0.01, -0.72, GUNC.metalL, 8), pt.cz(0.032, 0.07, x, y + 0.01, -0.9, GUNC.poly, 8),
    pt.box(0.03, 0.07, 0.03, x, y + 0.07, -0.8, GUNC.poly), pt.box(0.035, 0.05, 0.035, x, y + 0.115, -0.12, GUNC.poly),
    pt.box(0.06, 0.2, 0.075, x, y - 0.17, -0.24, GUNC.poly, -0.2), pt.box(0.055, 0.13, 0.07, x, y - 0.14, -0.1, GUNC.poly, 0.35)],
  smg: (x, y) => [pt.box(0.05, 0.05, 0.2, x, y + 0.01, 0.1, GUNC.metalL), pt.box(0.085, 0.14, 0.34, x, y, -0.12, GUNC.metal), pt.box(0.05, 0.03, 0.2, x, y + 0.085, -0.12, GUNC.metalL),
    pt.cz(0.028, 0.2, x, y + 0.01, -0.39, GUNC.poly, 8), pt.box(0.055, 0.26, 0.07, x, y - 0.2, -0.16, GUNC.poly), pt.box(0.055, 0.12, 0.07, x, y - 0.13, -0.02, GUNC.poly, 0.3),
    pt.box(0.05, 0.1, 0.06, x, y - 0.1, -0.33, GUNC.poly)],
  shotgun: (x, y) => [pt.box(0.075, 0.14, 0.3, x, y - 0.02, 0.06, GUNC.wood), pt.box(0.085, 0.13, 0.28, x, y, -0.2, GUNC.metal), pt.cz(0.028, 0.5, x, y + 0.025, -0.6, GUNC.metalL, 8),
    pt.cz(0.03, 0.42, x, y - 0.035, -0.56, GUNC.metal, 8), pt.box(0.09, 0.09, 0.2, x, y - 0.045, -0.52, GUNC.woodD), pt.box(0.03, 0.05, 0.03, x, y + 0.075, -0.84, GUNC.poly),
    pt.box(0.055, 0.12, 0.065, x, y - 0.13, -0.1, GUNC.poly, 0.3)],
  sniper: (x, y) => [pt.box(0.07, 0.15, 0.34, x, y - 0.02, 0.09, GUNC.olive), pt.box(0.075, 0.12, 0.34, x, y, -0.2, GUNC.metal), pt.cz(0.02, 0.6, x, y + 0.005, -0.74, GUNC.metalL, 8),
    pt.cz(0.03, 0.07, x, y + 0.005, -1.06, GUNC.poly, 8), pt.cz(0.04, 0.32, x, y + 0.125, -0.22, GUNC.poly), pt.cz(0.052, 0.06, x, y + 0.125, -0.4, GUNC.poly), pt.cz(0.047, 0.06, x, y + 0.125, -0.04, GUNC.poly),
    pt.box(0.03, 0.04, 0.2, x, y + 0.075, -0.22, GUNC.metalL), pt.box(0.05, 0.03, 0.03, x + 0.055, y + 0.04, -0.1, GUNC.steel),
    pt.box(0.055, 0.12, 0.07, x, y - 0.12, -0.22, GUNC.poly), pt.box(0.055, 0.13, 0.07, x, y - 0.14, -0.08, GUNC.poly, 0.3),
    pt.box(0.02, 0.2, 0.02, x - 0.045, y - 0.1, -0.66, GUNC.metalL, 0.35), pt.box(0.02, 0.2, 0.02, x + 0.045, y - 0.1, -0.66, GUNC.metalL, 0.35)],
  lmg: (x, y) => [pt.box(0.08, 0.15, 0.26, x, y - 0.02, 0.07, GUNC.poly), pt.box(0.1, 0.15, 0.38, x, y, -0.2, GUNC.metal), pt.box(0.08, 0.04, 0.3, x, y + 0.095, -0.2, GUNC.metalL),
    pt.box(0.03, 0.07, 0.1, x, y + 0.15, -0.3, GUNC.poly), pt.box(0.12, 0.15, 0.17, x, y - 0.16, -0.24, GUNC.olive), pt.box(0.09, 0.11, 0.26, x, y, -0.52, GUNC.poly),
    pt.cz(0.028, 0.3, x, y + 0.01, -0.8, GUNC.metalL, 8), pt.cz(0.04, 0.08, x, y + 0.01, -0.98, GUNC.poly, 8),
    pt.box(0.025, 0.22, 0.025, x - 0.06, y - 0.12, -0.72, GUNC.metalL, 0.45), pt.box(0.025, 0.22, 0.025, x + 0.06, y - 0.12, -0.72, GUNC.metalL, 0.45),
    pt.box(0.06, 0.12, 0.07, x, y - 0.14, -0.06, GUNC.poly, 0.3)],
  pistol: (x, y) => [pt.box(0.05, 0.065, 0.24, x, y + 0.04, -0.58, GUNC.metalL), pt.box(0.045, 0.045, 0.2, x, y, -0.56, GUNC.poly), pt.box(0.05, 0.12, 0.07, x, y - 0.07, -0.47, GUNC.poly, 0.25),
    pt.box(0.02, 0.025, 0.02, x, y + 0.085, -0.68, GUNC.steel), pt.box(0.025, 0.02, 0.02, x, y + 0.085, -0.48, GUNC.steel)],
  revolver: (x, y) => [pt.box(0.05, 0.07, 0.22, x, y + 0.035, -0.6, GUNC.metalL), pt.cz(0.042, 0.09, x, y + 0.02, -0.52, GUNC.metal, 8), pt.cz(0.022, 0.2, x, y + 0.04, -0.78, GUNC.metalL, 8),
    pt.box(0.05, 0.13, 0.07, x, y - 0.07, -0.45, GUNC.woodD, 0.3), pt.box(0.02, 0.03, 0.02, x, y + 0.08, -0.88, GUNC.steel)],
  mpistol: (x, y) => [pt.box(0.065, 0.09, 0.26, x, y + 0.03, -0.58, GUNC.metal), pt.cz(0.026, 0.1, x, y + 0.04, -0.76, GUNC.poly, 8), pt.box(0.05, 0.12, 0.07, x, y - 0.07, -0.47, GUNC.poly, 0.25),
    pt.box(0.05, 0.22, 0.06, x, y - 0.14, -0.58, GUNC.poly), pt.box(0.04, 0.03, 0.2, x, y + 0.085, -0.58, GUNC.metalL)],
  sawed: (x, y) => [pt.box(0.07, 0.1, 0.12, x, y, -0.14, GUNC.metal), pt.cz(0.022, 0.3, x - 0.026, y + 0.02, -0.4, GUNC.metalL, 8), pt.cz(0.022, 0.3, x + 0.026, y + 0.02, -0.4, GUNC.metalL, 8),
    pt.box(0.07, 0.035, 0.14, x, y - 0.03, -0.34, GUNC.woodD), pt.box(0.05, 0.11, 0.08, x, y - 0.09, -0.07, GUNC.wood, 0.4)],
  suppressed: (x, y) => [...TP_GUNS.rifle(x, y), pt.cz(0.04, 0.3, x, y + 0.01, -1.05, 0x1b1c20, 8)],
  knife: (x, y) => [pt.box(0.045, 0.05, 0.11, x, y, -0.02, 0x2a2a2a), pt.box(0.015, 0.06, 0.12, x, y + 0.0, -0.12, GUNC.steel, -0.2), pt.box(0.015, 0.05, 0.1, x, y - 0.04, -0.2, GUNC.steel, -0.8), pt.box(0.015, 0.04, 0.07, x, y - 0.1, -0.25, GUNC.steel, -1.3)],
  nade: (x, y) => [pt.box(0.1, 0.12, 0.1, x, y, -0.02, 0x4f7a3a), pt.box(0.05, 0.04, 0.05, x, y + 0.08, -0.02, GUNC.metalL), pt.box(0.015, 0.1, 0.03, x + 0.05, y + 0.03, 0.0, GUNC.steel)],
};
// [gun x, gun y, right hand [x, y, z], left hand [x, y, z] or null]
const TP_HOLD = {
  rifle: [0.2, -0.12, [0.2, -0.27, -0.1], [0.17, -0.21, -0.46]], smg: [0.2, -0.12, [0.2, -0.26, -0.02], [0.2, -0.22, -0.33]], shotgun: [0.2, -0.12, [0.2, -0.26, -0.1], [0.2, -0.21, -0.52]],
  sniper: [0.2, -0.12, [0.2, -0.26, -0.08], [0.2, -0.2, -0.5]], lmg: [0.2, -0.12, [0.2, -0.26, -0.06], [0.2, -0.2, -0.52]],
  pistol: [0.12, -0.04, [0.12, -0.1, -0.47], [0.09, -0.1, -0.5]], revolver: [0.12, -0.04, [0.12, -0.1, -0.45], [0.09, -0.1, -0.48]], mpistol: [0.12, -0.04, [0.12, -0.1, -0.47], [0.09, -0.11, -0.58]],
  sawed: [0.12, -0.04, [0.12, -0.1, -0.4], [0.09, -0.1, -0.44]], suppressed: [0.2, -0.12, [0.2, -0.27, -0.1], [0.17, -0.21, -0.46]],
  knife: [0.24, -0.16, [0.24, -0.16, -0.36], null], nade: [0.2, -0.06, [0.2, -0.06, -0.34], [0.03, -0.1, -0.3]],
};
// where the muzzle flash appears (arms space)
export const TP_MUZ = { rifle: [0.2, -0.11, -0.95], smg: [0.2, -0.11, -0.52], shotgun: [0.2, -0.1, -0.88], sniper: [0.2, -0.115, -1.1], lmg: [0.2, -0.11, -1.02], pistol: [0.12, 0.0, -0.72], revolver: [0.12, 0.0, -0.9], mpistol: [0.12, 0.0, -0.78], knife: [0.24, -0.16, -0.5], nade: [0.2, -0.06, -0.34], sawed: [0.12, 0.0, -0.62], suppressed: [0.2, -0.11, -1.2] };
const armsCache = {};
export function tpArms(side, cls, lite = false, noGun = false) {
  const key = side + cls + (lite ? 'L' : 'F') + (noGun ? 'N' : '');
  if (armsCache[key]) return armsCache[key];
  const p = SPAL[side], F = !lite, hold = TP_HOLD[cls], parts = [];
  const limb = (S, E, Hd, sg) => {
    const m = new THREE.Vector3().addVectors(S, E).multiplyScalar(0.5).lerp(S, 0.25);
    parts.push(pt.seg(S, E, 0.17, 0.17, p.shirt), pt.box(0.16, 0.16, 0.16, E.x, E.y, E.z, p.shirt), pt.seg(E, Hd, 0.15, 0.15, p.shirt),
      pt.box(0.14, 0.14, 0.15, Hd.x, Hd.y, Hd.z, p.glove));   // glove
  };
  const elbow = (S, H, sg) => V((S.x + H.x) / 2 + sg * 0.1, (S.y + H.y) / 2 - 0.15, (S.z + H.z) / 2 + 0.06);
  const SR = V(0.4, 0, 0), SL = V(-0.4, 0, 0), HR = V(...hold[2]);
  limb(SR, elbow(SR, HR, 1), HR, 1);
  if (hold[3]) { const HL = V(...hold[3]); limb(SL, elbow(SL, HL, -1), HL, -1); }
  else limb(SL, V(-0.43, -0.3, 0.02), V(-0.36, -0.5, -0.1), -1);   // free arm hangs down
  if (!noGun) parts.push(...TP_GUNS[cls](hold[0], hold[1]));
  return (armsCache[key] = mergeParts(parts));
}
export function tpGunGeo(cls) { const h = TP_HOLD[cls]; return mergeParts(TP_GUNS[cls](h[0], h[1])); }
// menu pose: both hands hold the gun across the chest (the gun itself is placed + turned by the menu code)
export function tpMenuArms(side, grip, support) {
  const palette = SPAL[side], parts = [];
  function arm(sign, hand) {
    const shoulder = V(sign * .35, -.035, 0);
    // Bend the elbow down and out while keeping both sleeve lengths consistent.
    const reach = hand.clone().sub(shoulder);
    const halfReach = reach.length() * .5;
    reach.normalize();
    const bend = V(sign * .32, -1, .15);
    bend.addScaledVector(reach, -bend.dot(reach)).normalize();
    const elbow = shoulder.clone().lerp(hand, .5)
      .addScaledVector(bend, Math.sqrt(Math.max(0, .31 ** 2 - halfReach ** 2)));
    const wrist = hand.clone().lerp(elbow, .15);
    parts.push(pt.seg(shoulder, elbow, .145, .15, palette.shirt),
      pt.seg(elbow, wrist, .123, .13, palette.shirt),
      pt.seg(wrist, hand, .106, .11, palette.glove),
      pt.box(.108, .104, .11, hand.x, hand.y, hand.z, palette.glove));
  }
  arm(1, grip);
  arm(-1, support || V(-.35, -.56, -.065));
  return mergeParts(parts);
}
export function tpGunMenu(cls) { const h = TP_HOLD[cls], g = mergeParts(TP_GUNS[cls](h[0], h[1])); g.translate(-h[0], -h[1], 0); return g; }

// Lite soldiers: the same look with fewer boxes, glued into 3 meshes (2 legs, body) + the arms/gun mesh.
// Geometry that is already vertex-coloured is moved and joined without touching its colours.
function joinGeo(list) {
  const pos = [], nor = [], uv = [], col = [], v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const [g0, m] of list) {
    const g = g0.index ? g0.toNonIndexed() : g0, p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, c = g.attributes.color;
    nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); col.push(c.getX(i), c.getY(i), c.getZ(i));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere(); return g;
}
const liteCache = {};
export function soldierPartsLite(side) {
  if (liteCache[side]) return liteCache[side];
  const sp = soldierParts(side, true), I = new THREE.Matrix4(), T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  return (liteCache[side] = {
    legL: joinGeo([[sp.thighL, I], [sp.shin, T(0, -0.31, 0)]]), legR: joinGeo([[sp.thighR, I], [sp.shin, T(0, -0.31, 0)]]),
    body: joinGeo([[sp.torso, I], [sp.head, T(0, 1.55, 0)]]),
  });
}

// ------------------------------------------------------------------ the bomb (CS-style C4)
// Four charge bricks round a control box with a keypad and a red countdown display. Origin = middle of the bottom, +y = top (keypad side), long side along x.
// 3 draw calls: the body (vertex colours), the display (a canvas that changes) and a small light on the control box.
export function buildBomb() {
  const body = mergeParts([
    pt.box(0.62, 0.07, 0.36, 0, 0.035, 0, 0x3e4a30),                                         // olive base plate
    ...[-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [pt.box(0.2, 0.1, 0.14, sx * 0.2, 0.12, sz * 0.085, 0xd8caa0), pt.box(0.2, 0.012, 0.14, sx * 0.2, 0.176, sz * 0.085, 0xbba978)])),   // 4 charge bricks
    pt.box(0.03, 0.125, 0.41, -0.2, 0.125, 0, 0x16171a), pt.box(0.03, 0.125, 0.41, 0.2, 0.125, 0, 0x16171a),   // black straps
    pt.box(0.2, 0.12, 0.34, 0, 0.13, 0, 0x2c3037),                                           // control box
    pt.box(0.17, 0.012, 0.075, 0, 0.196, -0.095, 0x0e0f12),                                  // display frame
    pt.box(0.13, 0.01, 0.13, 0, 0.195, 0.07, 0x1a1c20),                                      // keypad plate
    ...[0, 1, 2, 3].flatMap((r) => [0, 1, 2].map((c) => pt.box(0.026, 0.014, 0.022, (c - 1) * 0.035, 0.2, 0.025 + r * 0.032, r === 3 ? (c === 0 ? 0xd9473a : c === 2 ? 0x4ccf6a : 0x9aa0a8) : 0x9aa0a8))),   // 12 keys
    pt.box(0.1, 0.012, 0.012, -0.145, 0.19, -0.09, 0xd9473a), pt.box(0.1, 0.012, 0.012, -0.145, 0.19, 0.0, 0xe6c23a), pt.box(0.1, 0.012, 0.012, -0.145, 0.19, 0.09, 0x3a7ad9),   // wires
    pt.box(0.1, 0.012, 0.012, 0.145, 0.19, -0.09, 0x3a7ad9), pt.box(0.1, 0.012, 0.012, 0.145, 0.19, 0.0, 0x4ccf6a), pt.box(0.1, 0.012, 0.012, 0.145, 0.19, 0.09, 0xd9473a),
  ]);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(body, charMat));
  const cv2 = document.createElement('canvas'); cv2.width = 128; cv2.height = 48; const cx = cv2.getContext('2d', {willReadFrequently:true});
  const tex = new THREE.CanvasTexture(cv2); tex.colorSpace = THREE.SRGBColorSpace;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.056), new THREE.MeshBasicMaterial({ map: tex }));
  disp.rotation.x = -Math.PI / 2; disp.position.set(0, 0.203, -0.095); g.add(disp);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x4a0808 }), led = new THREE.Mesh(GEO.box, ledMat);
  led.scale.set(0.03, 0.012, 0.03); led.position.set(0.075, 0.203, -0.03); g.add(led);   // a flat light on the control box, beside the keys
  const B = { group: g, led, _t: null, _c: null };
  // text on the red display: numbers get a dim "88:88" ghost behind them, like a real LED display
  B.setDisplay = (text, col = '#ff2a1a') => {
    if (B._t === text && B._c === col) return; B._t = text; B._c = col;
    cx.fillStyle = '#140505'; cx.fillRect(0, 0, 128, 48);
    cx.font = 'bold ' + Math.min(38, Math.floor(118 / (text.length * 0.62))) + 'px "Courier New",monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    if (/^[0-9:.\-]+$/.test(text)) { cx.fillStyle = '#3a0c0c'; cx.fillText(text.replace(/[0-9]/g, '8'), 64, 26); }
    cx.shadowColor = col; cx.shadowBlur = 8; cx.fillStyle = col; cx.fillText(text, 64, 26); cx.shadowBlur = 0;
    tex.needsUpdate = true;
  };
  B.setLed = (on, col = 0xff2a2a) => ledMat.color.setHex(on ? col : 0x4a0808);
  B.setDisplay('--:--', '#ff2a1a');
  return B;
}

// ------------------------------------------------------------------ first-person guns (low-poly, round barrels and scopes)
const FPM = {};
export function fpMat(key, acc) {
  const k = key === 'acc' ? 'acc' + acc : key;
  if (FPM[k]) return FPM[k];
  const col = key === 'acc' ? (acc || 0xff8a2a) : 0x34373c;
  return (FPM[k] = new THREE.MeshLambertMaterial({ color: col, flatShading: true }));
}
export const sleeveMat = new THREE.MeshLambertMaterial({ color: 0xd9732e, flatShading: true });
const gunMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const dotMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const glassMat = new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.15, depthWrite: false });
const C = { body: 0x525c64, dark: 0x22292e, metal: 0x818c92, light: 0x9aa1a6, wood: 0x8a5a3a, woodD: 0x6a4228, red: 0xa83a2e, brass: 0xc9a14a, blade: 0xd8dde3, green: 0x4f7f56, lens: 0x3c6d96 };
export let KNIFE_STYLE = 'combat';
export const setKnifeStyle = (v) => { KNIFE_STYLE = v; };
// JUNK GUNS (a wild twist): the same gun, same size, same stats, but built from tin cans, a soda can magazine, a cardboard box, duct tape, a spoon and a battery
export function junkify(b, seed = 1) {
  const m = b.finishMesh, geo = m.geometry; geo.computeBoundingBox(); const bb = geo.boundingBox;
  const L = Math.max(0.2, bb.max.z - bb.min.z), H = Math.max(0.08, bb.max.y - bb.min.y), W = Math.max(0.05, bb.max.x - bb.min.x), yc = bb.min.y + H * 0.7, parts = [];
  let r = seed * 9301 + 49297; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const CANS = [0xc8372d, 0x2b6cb0, 0x2f9e5b, 0xe0a020, 0x8a4fc0], pick2 = (arr) => arr[(rnd() * arr.length) | 0];
  const rad = Math.min(0.05, Math.max(0.024, H * 0.2)), n = Math.max(1, Math.min(3, Math.round(L / 0.32))), cl = (L * 0.5) / n;
  for (let k = 0; k < n; k++) { const z = bb.min.z + (k + 0.5) * cl, c = pick2(CANS); parts.push(pt.cz(rad, cl * 0.96, 0, yc, z, c, 10), pt.cz(rad * 1.03, cl * 0.36, 0, yc, z, 0xf2f2ee, 10)); }   // tin cans with a white label band
  parts.push(pt.cz(rad * 0.4, L * 0.14, 0, yc, bb.min.z + L * 0.02, 0x8a8f96, 8));                                                                                   // a pipe for the muzzle
  const zb = bb.min.z + L * 0.62;
  parts.push(pt.box(W + 0.035, H * 0.55, L * 0.3, 0, yc - H * 0.04, zb, 0xb98a52), pt.box(W + 0.04, H * 0.6, L * 0.05, 0, yc - H * 0.04, zb - L * 0.05, 0xb7bcc2), pt.box(W + 0.04, H * 0.6, L * 0.05, 0, yc - H * 0.04, zb + L * 0.07, 0xb7bcc2));   // cardboard box + duct tape
  if (L > 0.6) parts.push(pt.box(0.03, 0.025, L * 0.22, 0, yc - H * 0.1, bb.max.z - L * 0.1, 0xc9a06a), pt.box(0.07, 0.05, 0.03, 0, yc - H * 0.1, bb.max.z - L * 0.01, 0xc9a06a));   // a wooden spoon for the stock
  parts.push(pt.cyl(0.02, H * 0.55, 0, bb.min.y + H * 0.27, zb + L * 0.13, pick2([0x2f9e5b, 0xe0a020])));                                                              // a battery for the grip
  parts.push(pt.cyl(0.022, H * 0.5, 0, bb.min.y + H * 0.25, zb - L * 0.04, 0xc8372d), pt.cyl(0.023, H * 0.08, 0, bb.min.y + H * 0.5, zb - L * 0.04, 0xd8d8dc));                  // a soda can for the magazine
  parts.push(pt.cyl(0.02, 0.012, 0, bb.max.y + 0.006, bb.min.z + L * 0.14, 0xd8d8dc));                                                                                 // a bottle cap for the sight
  m.geometry = mergeParts(parts);
}
// SANTA HAT (Christmas season): a blocky red hat with a white fur band and a pom-pom that flops over the back. Sits on top of every soldier's head.
let _hat = null;
export function santaHat() {
  if (_hat) return _hat;
  const R1 = 0xd62828, R2 = 0xc01f1f, WH = 0xf6f6f2;
  return (_hat = mergeParts([pt.box(.6, .1, .6, 0, .25, 0, WH), pt.box(.5, .1, .5, 0, .34, .01, R1), pt.box(.41, .1, .41, 0, .43, .05, R2), pt.box(.32, .1, .32, 0, .51, .1, R1), pt.box(.24, .09, .24, 0, .58, .16, R2), pt.box(.18, .08, .18, 0, .625, .24, R1), pt.box(.14, .14, .14, 0, .56, .33, WH)]));
}
// COSTUMES: a body colour + silly bits for the head and the back (ears, horns, tails, fins). Built in the soldier's own head / torso space.
const kitCache = {};
export function costumeKit(id, side = 0) {
  const key = id + side; if (kitCache[key]) return kitCache[key];
  const K = { tint: 0xffffff, head: [], body: [] }, h = (...v) => K.head.push(pt.box(...v)), bd = (...v) => K.body.push(pt.box(...v)), RB = [0xff5c8a, 0xffa14a, 0xffe14a, 0x6bdc7a, 0x4ab4ff, 0xa06bff];
  switch (id) {
    case 'unicorn': K.tint = 0xffe8f4;
      h(.07, .1, .07, 0, .33, -.06, 0xffd24a); h(.055, .09, .055, 0, .42, -.06, 0xfff0a0); h(.035, .07, .035, 0, .49, -.06, 0xffffff); h(.078, .03, .078, 0, .365, -.06, 0xff9ccf);   // golden horn
      h(.07, .11, .05, -.13, .31, .04, 0xffb6d9); h(.07, .11, .05, .13, .31, .04, 0xffb6d9);                                                                              // pink ears
      for (let k = 0; k < 5; k++) h(.1, .11, .07, 0, .25 - k * .11, .2, RB[k]);                                                                                          // rainbow mane
      for (let k = 0; k < 5; k++) bd(.1, .13, .1, 0, .88 - k * .11, .36 + k * .03, RB[(k + 2) % 6]);                                                                       // rainbow tail
      break;
    case 'dino': K.tint = 0x5cc45e;
      h(.06, .09, .09, 0, .33, -.07, 0xf2c14a); h(.06, .1, .09, 0, .34, .05, 0xf2c14a); h(.06, .09, .09, 0, .31, .16, 0xf2c14a);
      for (let k = 0; k < 4; k++) bd(.06, .12, .12, 0, 1.28 - k * .15, .37, 0xf2c14a);
      bd(.16, .14, .22, 0, .72, .38, 0x4aae4c); bd(.12, .11, .2, 0, .7, .57, 0x4aae4c); bd(.08, .08, .18, 0, .68, .74, 0x3f9a42);
      break;
    case 'banana': K.tint = 0xffe14a;
      h(.05, .09, .05, 0, .33, 0, 0x6b4a1e); h(.12, .03, .06, .06, .37, 0, 0x4caf50); h(.1, .03, .06, -.05, .36, .02, 0x4caf50);
      bd(.08, .08, .08, 0, 1.4, 0, 0x6b4a1e); bd(.5, .05, .36, 0, .66, 0, 0xf2cf38);
      break;
    case 'bunny': K.tint = 0xf0e6ef;
      for (const s of [-1, 1]) { h(.08, .32, .05, s * .1, .45, .02, 0xf3e9f1); h(.045, .24, .03, s * .1, .45, -.015, 0xffb6c9); }
      bd(.17, .17, .17, 0, .8, .36, 0xffffff);
      break;
    case 'cow': K.tint = 0xffffff;
      for (const s of [-1, 1]) { h(.05, .11, .05, s * .15, .31, 0, 0xf0e4c0); h(.1, .05, .08, s * .25, .1, .02, 0xffffff); h(.06, .04, .05, s * .255, .1, .02, 0xffb6c9); }
      bd(.2, .18, .02, .1, 1.1, -.205, 0x1a1a1f); bd(.16, .14, .02, -.14, .9, -.205, 0x1a1a1f); bd(.12, .12, .02, .16, .82, -.205, 0x1a1a1f);
      bd(.03, .34, .03, 0, .55, .36, 0x1a1a1f); bd(.07, .1, .07, 0, .36, .36, 0x1a1a1f);
      break;
    case 'shark': K.tint = 0x4a8fd0;
      h(.04, .18, .15, 0, .36, .06, 0x3a7fc0); for (const x of [-.12, -.06, 0, .06, .12]) h(.045, .045, .03, x, -.13, -.205, 0xffffff);
      bd(.04, .3, .2, 0, 1.22, .38, 0x3a7fc0); bd(.04, .22, .18, 0, .7, .42, 0x3a7fc0);
      break;
    case 'elf': K.tint = 0x2fa34a;
      for (const s of [-1, 1]) { h(.05, .1, .15, s * .29, .08, .02, 0xf2c6a0); h(.04, .1, .08, s * .31, .17, .02, 0xf2c6a0); h(.035, .07, .05, s * .32, .25, .02, 0xf2c6a0); }   // long pointy ears
      bd(.52, .07, .4, 0, .66, 0, 0xd62828); bd(.1, .08, .02, 0, .66, -.205, 0xe6b422); bd(.52, .03, .4, 0, .73, 0, 0xf6f6f2);   // red belt, gold buckle, white trim
      break;
    case 'reindeer': K.tint = 0xa86a3a;
      for (const s of [-1, 1]) { h(.04, .2, .04, s * .12, .42, 0, 0x5a3a1e); h(.1, .04, .04, s * .17, .5, 0, 0x5a3a1e); h(.04, .1, .04, s * .22, .55, 0, 0x5a3a1e); h(.07, .1, .05, s * .28, .22, .02, 0x8a5a2a); }   // antlers + ears
      h(.08, .07, .06, 0, -.075, -.262, 0xe53935); bd(.1, .1, .1, 0, .7, .36, 0xf4efe4);   // red nose + fluffy tail
      break;
    case 'snowman': K.tint = 0xf6f9fc;
      h(.06, .06, .18, 0, -.01, -.3, 0xff8a2a);                                            // carrot nose
      for (let k = 0; k < 3; k++) bd(.07, .07, .02, 0, 1.05 - k * .17, -.205, 0x1a1a1f);   // coal buttons
      bd(.54, .1, .42, 0, 1.38, 0, 0xd62828); bd(.1, .3, .05, .16, 1.2, -.2, 0xd62828);    // scarf
      break;
    default: return (kitCache[key] = null);
  }
  const p = SPAL[side]; if (p) h(p.cap ? 0.475 : 0.505, 0.07, p.cap ? 0.475 : 0.505, 0, p.cap ? 0.125 : 0.195, 0, p.team);   // the team band always stays visible
  return (kitCache[key] = { tint: K.tint, head: K.head.length ? mergeParts(K.head) : null, body: K.body.length ? mergeParts(K.body) : null });
}
// Two boxes that overlap AND share a flat face flicker against each other (z-fighting). For every box that does, pull the shared face in by a hair (0.7 mm) so only one of them draws it.
function fixCoplanar(parts, bxs) {
  const E = 1e-4, SH = 0.0007;
  for (let j = 1; j < bxs.length; j++) {
    const [idx, w, h, d, x, y, z, c] = bxs[j], lo = [x - w / 2, y - h / 2, z - d / 2], hi = [x + w / 2, y + h / 2, z + d / 2]; let changed = false;
    for (let i = 0; i < j; i++) {
      const A = bxs[i], alo = [A[4] - A[1] / 2, A[5] - A[2] / 2, A[6] - A[3] / 2], ahi = [A[4] + A[1] / 2, A[5] + A[2] / 2, A[6] + A[3] / 2];
      if ([0, 1, 2].some((k) => Math.min(hi[k], ahi[k]) - Math.max(lo[k], alo[k]) < 2e-4)) continue;   // they do not overlap: nothing to fix
      for (let k = 0; k < 3; k++) { if (Math.abs(lo[k] - alo[k]) < E) { lo[k] += SH; changed = true; } if (Math.abs(hi[k] - ahi[k]) < E) { hi[k] -= SH; changed = true; } }
    }
    if (changed) parts[idx] = pt.box(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2, c);
  }
}
export function buildGun(id, acc) {
  makeTextures();
  const parts = [], extra = [], A = acc, bxs = [];
  const b = (w, h, d, x, y, z, c, rx = 0) => { if (!rx) bxs.push([parts.length, w, h, d, x, y, z, c]); parts.push(pt.box(w, h, d, x, y, z, c, rx)); };
  const cz = (r, len, x, y, z, c, seg = 12) => parts.push(pt.cz(r, len, x, y, z, c, seg));
  const tz = (r1, r2, len, x, y, z, c) => parts.push(pt.tz(r1, r2, len, x, y, z, c));
  let spec;
  switch (id) {
    case 'p9': case 'viper': {
      const v = id === 'viper', s = v ? 1.22 : 1;
      const SIL = v ? 0x7d858b : 0x737b81, FR = 0x25272c, MD = 0x3d4046, GRIP = v ? A : 0x2a2c31;
      const q = (w, h, d, x, y, z, c, rx = 0) => b(w * s, h * s, d * s, x * s, y * s, z * s, c, rx);
      // slide with serrations, ejection port, muzzle
      q(.034, .04, .19, 0, .05, -.075, SIL); q(.014, .004, .17, 0, .072, -.075, MD);
      for (let i = 0; i < 5; i++) q(.0356, .03, .0035, 0, .05, i * .0075, FR);
      for (let i = 0; i < 3; i++) q(.0356, .03, .0035, 0, .05, -.15 + i * .0075, FR);
      q(.0352, .016, .045, 0, .056, -.06, FR); q(.026, .026, .012, 0, .05, -.18, FR);
      // Inset orange witness marks on the slide, behind the front sight.
      for (const z of [-.112,-.102]) q(.035,.018,.004,0,.052,z,0x4f565c);
      // frame, rail, trigger guard, trigger
      q(.032, .022, .17, 0, .016, -.065, FR);
      for (let i = 0; i < 3; i++) q(.0334, .006, .012, 0, .004, -.13 + i * .02, MD);
      q(.022, .006, .05, 0, -.014, -.037, FR); q(.022, .03, .006, 0, 0, -.062, FR); q(.006, .02, .008, 0, 0, -.03, SIL, .3);
      // angled grip with grooves + base plate
      q(.034, .11, .05, 0, -.045, .026, GRIP, -.28);
      // sights with white dots
      q(.008, .012, .012, .0105, .074, .016, FR); q(.008, .012, .012, -.0105, .074, .016, FR); q(.007, .01, .01, 0, .0745, -.162, FR);
      q(.004, .004, .002, .0105, .0735, .0094, 0xffffff); q(.004, .004, .002, -.0105, .0735, .0094, 0xffffff); q(.004, .004, .002, 0, .0745, -.1675, 0xffffff);
      spec = { sy: 0.08 * s, mz: [0, 0.05 * s, -0.19 * s], grip: [0, -0.045 * s, 0.026 * s], ads: [v ? -0.46 : -0.42, 1.2], pistol: true, hs: s }; break;
    }
    case 'buzz':
      b(.07, .095, .38, 0, 0, -.1, C.body); b(.066, .04, .36, 0, .065, -.1, C.dark); b(.074, .05, .16, 0, 0, -.2, A);
      cz(.026, .18, 0, .02, -.38, C.dark); cz(.02, .08, 0, .02, -.5, C.metal, 8);
      b(.04, .2, .058, 0, -.15, -.13, C.dark, .1); b(.044, .09, .052, 0, -.08, .05, C.dark, -.25); cz(.011, .24, .022, .01, .2, C.metal, 8); cz(.011, .24, -.022, .01, .2, C.metal, 8);
      b(.05, .11, .03, 0, -.03, .32, C.dark); b(.04, .1, .045, 0, -.08, -.3, C.dark);
      b(.012, .04, .02, .018, .12, .04, C.dark); b(.012, .04, .02, -.018, .12, .04, C.dark); b(.01, .036, .012, 0, .12, -.24, C.dark);
      spec = { sy: 0.135, mz: [0, 0.02, -0.55], fore: [0, -0.13, -0.3], ads: [-0.46, 1.3] }; break;
    case 'thumper':
      cz(.025, .74, 0, .035, -.34, C.dark); cz(.022, .52, 0, -.02, -.27, C.metal);
      cz(.042, .2, 0, -.022, -.37, C.wood, 8);
      b(.074, .11, .26, 0, 0, 0, C.body); b(.076, .028, .2, 0, .035, 0, A); b(.04, .01, .08, 0, -.068, .04, C.dark);
      b(.064, .12, .34, 0, -.06, .27, C.wood, .15); b(.066, .14, .03, 0, -.088, .44, C.dark, .15);
      for (let i = 0; i < 4; i++) cz(.012, .05, .043, -.005, -.06 + i * .026, C.red, 8);
      b(.012, .014, .012, 0, .068, -.69, C.light); b(.04, .02, .016, 0, .068, -.02, C.dark);
      spec = { sy: 0.08, mz: [0, 0.035, -0.72], fore: [0, -0.08, -0.37], ads: [-0.44, 1.15] }; break;
    case 'raptor':
      b(.076, .105, .42, 0, 0, -.05, C.body); b(.07, .034, .38, 0, .068, -.05, C.light);
      // Stamped ribs, charging slot and selector on the near side of the receiver.
      for (const z of [-.29,-.32,-.35,-.38]) b(.082,.014,.008,0,.012,z,C.woodD);
      b(.004,.015,.135,-.039,.026,-.09,C.dark);
      b(.017,.012,.026,-.046,.025,-.045,C.metal);
      b(.005,.014,.023,-.039,.018,.094,0x4f565c);
      b(.08, .07, .24, 0, -.01, -.38, C.wood); cz(.022, .22, 0, .065, -.38, C.wood, 8);
      cz(.016, .32, 0, .03, -.62, C.dark); b(.032, .07, .03, 0, .07, -.66, C.dark); b(.006, .03, .006, 0, .105, -.66, C.dark);
      cz(.024, .08, 0, .03, -.8, C.dark, 8);
      b(.016, .035, .04, .02, .1, -.25, C.dark); b(.016, .035, .04, -.02, .1, -.25, C.dark); b(.056, .012, .04, 0, .085, -.25, C.dark);
      b(.05, .13, .085, 0, -.12, -.13, C.dark, .15); b(.05, .13, .085, 0, -.23, -.08, C.dark, .45); b(.044, .09, .052, 0, -.085, .05, C.wood, -.3); b(.04, .01, .09, 0, -.065, -.02, C.dark);
      b(.056, .11, .26, 0, -.035, .29, C.wood, .1); b(.06, .125, .028, 0, -.05, .42, C.dark, .1);
      spec = { sy: 0.12, mz: [0, 0.03, -0.85], fore: [0, -0.08, -0.4], ads: [-0.42, 1.45] }; break;
    case 'sentinel':
      b(.07, .09, .3, 0, -.01, 0, C.body); b(.068, .07, .34, 0, .06, -.06, C.body); b(.03, .014, .48, 0, .1, -.12, C.dark);
      cz(.045, .3, 0, .03, -.4, C.light);
      for (const z of [-.49,-.47]) cz(.046,.009,0,.03,z,0x4f565c); cz(.03, .3, 0, .04, -.71, C.dark); cz(.032, .03, 0, .04, -.6, A);
      b(.05, .17, .078, 0, -.13, -.09, C.dark, .12); b(.044, .09, .052, 0, -.08, .08, C.dark, -.3); b(.04, .01, .09, 0, -.065, 0, C.dark);
      cz(.018, .18, 0, .03, .22, C.dark, 8); b(.056, .11, .17, 0, 0, .36, C.body); b(.05, .016, .04, 0, .1, .14, C.dark);
      // round red-dot
      b(.05, .026, .08, 0, .12, -.06, C.dark);
      { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.007, 6, 16), gunMat.clone()); ring.material.vertexColors = false; ring.material.color.setHex(C.dark); ring.position.set(0, 0.165, -0.08); extra.push(ring);
        const gl = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), glassMat); gl.position.set(0, 0.165, -0.08); extra.push(gl);
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.0022, 8), dotMat); d.position.set(0, 0.165, -0.0805); extra.push(d); }
      spec = { sy: 0.165, mz: [0, 0.04, -0.88], fore: [0, -0.07, -0.42], ads: [-0.46, 1.6] }; break;
    case 'longbow':
      // like Krunker's sniper: long round barrel, fat scope with a big front bell
      b(.08, .1, .5, 0, 0, -.06, C.light); b(.07, .05, .2, 0, .06, .22, C.light); b(.074, .14, .3, 0, -.03, .32, A, .05); b(.076, .16, .03, 0, -.05, .48, C.dark, .05);
      cz(.021, .62, 0, .025, -.62, C.dark); tz(.032, .024, .1, 0, .025, -.95, C.dark); cz(.023,.025,0,.025,-.86,0x4f565c);
      cz(.03, .34, 0, .15, -.1, C.dark); tz(.055, .03, .12, 0, .15, -.32, C.dark); cz(.055, .03, 0, .15, -.395, C.dark);
      tz(.03, .045, .07, 0, .15, .1, C.dark); cz(.045, .02, 0, .15, .145, C.dark);
      { const ln = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), new THREE.MeshBasicMaterial({ color: C.lens })); ln.position.set(0, 0.15, -0.411); ln.rotation.y = Math.PI; extra.push(ln); }
      b(.035, .05, .03, 0, .1, -.18, C.metal); b(.035, .05, .03, 0, .1, .0, C.metal); cz(.014, .04, 0, .19, -.1, C.metal, 8); parts[parts.length - 1][1] = m4(0, .19, -.1, .014, .04, .014);
      b(.08, .016, .016, .07, .025, .08, C.light); parts.push([GEO.box, m4(.115, .025, .08, .035, .035, .035), C.light]);
      b(.056, .08, .085, 0, -.09, -.02, C.dark); b(.044, .085, .052, 0, -.08, .11, C.dark, -.3); b(.04, .01, .09, 0, -.06, .05, C.dark);
      spec = { sy: 0.15, mz: [0, 0.025, -1.02], fore: [0, -0.06, -0.36], ads: null }; break;
    case 'tec':
      // Rattler: boxy machine pistol, perforated shroud, long magazine ahead of the grip
      b(.036, .05, .17, 0, .05, -.045, C.body); b(.03, .012, .15, 0, .08, -.045, C.dark); b(.04, .026, .07, 0, .062, 0, C.dark);
      cz(.017, .13, 0, .05, -.17, C.metal); for (let i = 0; i < 4; i++) b(.036, .012, .01, 0, .066, -.125 - i * .026, C.dark);
      cz(.008, .04, 0, .05, -.245, C.dark, 8);
      b(.034, .1, .048, 0, -.036, .024, C.dark, -.25); b(.032, .16, .04, 0, -.072, -.08, A);
      b(.022, .006, .05, 0, -.012, -.04, C.dark); b(.022, .026, .006, 0, 0, -.065, C.dark);
      b(.007, .012, .008, .01, .082, .02, C.dark); b(.007, .012, .008, -.01, .082, .02, C.dark); b(.006, .012, .006, 0, .074, -.2, C.dark);
      spec = { sy: 0.09, mz: [0, 0.05, -0.26], grip: [0, -0.04, 0.024], pistol: true, hs: 1, ads: [-0.42, 1.2] }; break;
    case 'revolver':
      // Peacemaker: six-shooter with a fat cylinder, top rib and wood grip
      cz(.016, .22, 0, .052, -.12, C.metal); cz(.011, .2, 0, .022, -.11, C.dark); b(.014, .014, .2, 0, .075, -.1, C.light);
      cz(.037, .055, 0, .044, -.015, C.light, 12);
      for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2; cz(.007, .058, Math.cos(an) * .023, .044 + Math.sin(an) * .023, -.015, C.dark, 8); }
      b(.034, .075, .1, 0, .03, .02, C.light); b(.012, .034, .016, 0, .083, .065, C.dark, .5);
      b(.036, .115, .052, 0, -.045, .03, C.wood, -.3); b(.022, .006, .05, 0, -.015, -.01, C.dark); b(.006, .02, .006, 0, 0, -.02, C.dark, .25);
      b(.006, .014, .008, 0, .082, -.215, C.dark);
      spec = { sy: 0.092, mz: [0, 0.052, -0.235], grip: [0, -0.045, 0.03], pistol: true, hs: 1.08, ads: [-0.44, 1.2] }; break;
    case 'chopper':
      // Chopper: bullpup PDW with a horizontal top magazine and a thumbhole grip
      b(.07, .1, .34, 0, 0, -.06, C.body); b(.062, .07, .16, 0, -.02, .14, C.body); b(.058, .036, .3, 0, .075, -.07, A); b(.05, .04, .1, 0, .07, .12, C.dark);
      cz(.02, .14, 0, .02, -.29, C.dark); cz(.014, .05, 0, .02, -.39, C.metal, 8);
      b(.052, .09, .06, 0, -.06, -.02, C.dark, .1); b(.012, .05, .012, 0, .1, -.22, C.dark); b(.05, .03, .04, 0, .105, 0, C.dark); b(.044, .07, .044, 0, -.075, .1, C.dark, -.2);
      spec = { sy: 0.13, mz: [0, 0.02, -0.4], grip: [0, -0.07, 0.1], fore: [0, -0.085, -0.1], ads: [-0.36, 1.3] }; break;
    case 'scatter':
      // Scatter: semi-auto combat shotgun, vented heat shield, tube magazine
      cz(.03, .56, 0, .04, -.3, C.dark); cz(.024, .5, 0, -.02, -.28, C.metal);
      b(.07, .065, .2, 0, 0, -.36, C.wood); for (let i = 0; i < 4; i++) b(.074, .014, .03, 0, .05, -.26 - i * .05, C.dark);
      b(.074, .1, .26, 0, 0, 0, C.body); b(.07, .026, .2, 0, .04, 0, A);
      b(.062, .12, .3, 0, -.055, .26, C.wood, .12); b(.064, .14, .03, 0, -.075, .41, C.dark, .12); b(.044, .09, .052, 0, -.075, .05, C.wood, -.3);
      b(.012, .014, .012, 0, .07, -.58, C.light); b(.04, .02, .016, 0, .07, -.02, C.dark);
      spec = { sy: 0.085, mz: [0, 0.04, -0.6], fore: [0, -0.075, -0.36], ads: [-0.42, 1.15] }; break;
    case 'carbine':
      // Carbine: short rail rifle with a collapsible stock and flip-up sights
      b(.07, .095, .3, 0, 0, -.02, C.body); b(.066, .03, .34, 0, .062, -.05, C.metal); b(.074, .075, .26, 0, .01, -.3, C.dark);
      cz(.014, .26, 0, .025, -.56, C.dark); cz(.02, .06, 0, .025, -.7, C.dark, 8); b(.01, .04, .01, 0, .078, -.5, C.dark); b(.012, .03, .02, 0, .095, 0, C.dark);
      b(.048, .13, .06, 0, -.12, -.1, A, .12); b(.046, .09, .052, 0, -.08, .08, C.dark, -.3);
      b(.036, .08, .16, 0, 0, .26, C.metal); b(.056, .1, .05, 0, -.01, .37, C.dark);
      spec = { sy: 0.115, mz: [0, 0.03, -0.72], grip: [0, -0.08, 0.075], fore: [0, -0.075, -0.3], ads: [-0.4, 1.4] }; break;
    case 'ranger':
      const W = 0x4b6a3c;   // olive polymer stock
      // AWP (id 'ranger'): long bolt-action sniper: thumbhole stock with a cheek riser, muzzle brake, big scope with accent rings, box magazine, bolt handle with a knob, folded bipod
      b(.052, .08, .34, 0, 0, -.03, C.body);                                  // receiver
      b(.044, .04, .1, 0, .055, .05, C.body); b(.054, .02, .06, 0, .015, .03, C.dark);   // bolt shroud, ejection port
      cz(.02, .72, 0, .02, -.53, C.dark);                                    // long barrel
      for (let z = -.36; z > -.84; z -= .07) cz(.026, .016, 0, .02, z, C.light, 10);   // barrel fins
      for (let i = 0; i < 3; i++) b(.054, .014, .02, 0, .024, -.15 + i * .04, C.dark);   // receiver vents
      cz(.026, .1, 0, .02, -.93, C.metal, 8); b(.058, .012, .02, 0, .02, -.91, C.dark); b(.058, .012, .02, 0, .02, -.95, C.dark);   // muzzle brake with slots
      b(.056, .07, .34, 0, -.025, -.11, W);                              // forend
      b(.058, .032, .3, 0, .004, .28, W); b(.056, .03, .3, 0, -.075, .28, W); b(.06, .11, .1, 0, -.035, .38, W); b(.05, .03, .18, 0, .035, .3, W); b(.062, .13, .028, 0, -.035, .44, C.dark);   // thumbhole stock (top rail, bottom rail, rear block), cheek riser, butt pad
      b(.044, .085, .052, 0, -.075, .12, W, -.3); b(.014, .014, .09, 0, -.075, .03, C.dark);   // grip, trigger guard
      b(.04, .06, .075, 0, -.085, -.03, C.dark); b(.042, .012, .077, 0, -.1, -.03, A);              // box magazine with an accent band
      b(.01, .01, .24, .034, -.062, -.17, C.metal); b(.01, .01, .24, -.034, -.062, -.17, C.metal);   // folded bipod
      cz(.026, .34, 0, .12, -.05, C.dark); b(.034, .05, .04, 0, .075, -.15, C.metal); b(.034, .05, .04, 0, .075, -.04, C.metal);   // scope tube + mounts
      tz(.04, .026, .09, 0, .12, -.265, C.dark); cz(.043, .014, 0, .12, -.314, A);                   // objective bell + accent lip
      tz(.026, .036, .07, 0, .12, .155, C.dark); cz(.039, .014, 0, .12, .198, C.dark);               // eyepiece
      cz(.0285, .03, 0, .12, -.13, A); cz(.0285, .03, 0, .12, .04, A);                               // accent rings
      b(.028, .03, .028, 0, .155, -.07, C.metal); b(.03, .028, .028, .04, .12, -.07, C.metal);       // turrets
      b(.05, .012, .012, .04, .03, .09, C.metal); cz(.017, .03, .072, .03, .09, C.light, 8);          // bolt handle + knob
      { const ln = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), new THREE.MeshBasicMaterial({ color: C.lens })); ln.position.set(0, 0.12, -0.3215); ln.rotation.y = Math.PI; extra.push(ln); }
      spec = { sy: 0.12, mz: [0, 0.02, -0.99], grip: [0, -0.075, 0.12], fore: [0, -0.05, -0.2], ads: null }; break;
    case 'dmr':
      // Marksman: semi-auto sniper, long fluted barrel, 4x scope
      b(.07, .09, .3, 0, -.01, 0, C.body); b(.068, .07, .34, 0, .06, -.06, C.body); b(.03, .014, .48, 0, .1, -.12, C.dark);
      b(.07, .075, .34, 0, .02, -.4, C.dark); cz(.017, .34, 0, .025, -.7, C.dark); b(.034, .034, .06, 0, .025, -.9, C.dark);
      b(.05, .15, .07, 0, -.12, -.09, A, .12); b(.044, .09, .052, 0, -.08, .09, C.dark, -.3); b(.05, .1, .2, 0, -.01, .28, C.dark);
      cz(.025, .3, 0, .15, -.12, C.dark); tz(.045, .028, .08, 0, .15, -.34, C.dark); cz(.045, .02, 0, .15, .05, C.dark); b(.03, .05, .03, 0, .115, -.2, C.metal); b(.03, .05, .03, 0, .115, -.04, C.metal);
      spec = { sy: 0.15, mz: [0, 0.025, -0.92], grip: [0, -0.08, 0.09], fore: [0, -0.075, -0.42], ads: null }; break;
    case 'lmg':
      // Hammer: belt-fed light machine gun with an ammo box, carry handle and folded bipod
      b(.09, .12, .4, 0, 0, -.05, C.body); b(.08, .04, .34, 0, .08, -.06, C.metal); b(.012, .05, .12, 0, .12, -.1, C.dark); b(.06, .014, .12, 0, .15, -.1, C.dark);
      b(.09, .1, .14, 0, -.1, -.06, A); b(.02, .02, .1, .04, -.04, -.15, C.brass); b(.02, .02, .1, .05, -.06, -.12, C.brass);
      cz(.03, .4, 0, .02, -.45, C.dark); cz(.014, .18, 0, .02, -.75, C.metal); b(.04, .04, .06, 0, .02, -.86, C.dark);
      b(.01, .01, .2, .04, -.03, -.55, C.light); b(.01, .01, .2, -.04, -.03, -.55, C.light); b(.012, .045, .012, 0, .065, -.7, C.dark); b(.04, .03, .04, 0, .1, .05, C.dark);
      b(.07, .12, .3, 0, -.03, .32, C.wood, .08); b(.05, .1, .06, 0, -.09, .08, C.dark, -.3);
      spec = { sy: 0.13, mz: [0, 0.02, -0.9], grip: [0, -0.09, 0.08], fore: [0, -0.09, -0.3], ads: [-0.4, 1.35] }; break;
    case 'trio': {
      // Trio: burst pistol, long slide with three vents in the accent colour and a little foregrip
      const s = 1.08, q = (w, h, d, x, y, z, c, rx = 0) => b(w * s, h * s, d * s, x * s, y * s, z * s, c, rx);
      q(.036, .042, .21, 0, .05, -.09, 0x3a3d42); q(.014, .004, .19, 0, .073, -.09, C.dark);
      for (let i = 0; i < 3; i++) q(.0372, .016, .014, 0, .052, -.07 - i * .035, A);
      q(.033, .022, .19, 0, .016, -.08, C.dark); q(.022, .006, .05, 0, -.014, -.037, C.dark); q(.022, .03, .006, 0, 0, -.062, C.dark);
      q(.022, .07, .026, 0, -.035, -.145, C.dark);
      q(.034, .11, .05, 0, -.045, .026, 0x2a2c31, -.28); q(.034, .028, .05, 0, -.1, .012, A);
      q(.008, .012, .012, .0105, .074, .016, C.dark); q(.008, .012, .012, -.0105, .074, .016, C.dark); q(.007, .01, .01, 0, .0745, -.188, C.dark);
      spec = { sy: .08 * s, mz: [0, .05 * s, -.2 * s], grip: [0, -.045 * s, .026 * s], ads: [-0.42, 1.2], pistol: true, hs: s }; break;
    }
    case 'duster': {
      // Duster: sawed-off double barrel, brass shell rims, break-open hinge, stubby wood grip
      cz(.022, .34, -.024, .03, -.2, C.dark); cz(.022, .34, .024, .03, -.2, C.dark); b(.014, .008, .34, 0, .056, -.2, C.metal);
      b(.074, .075, .13, 0, .015, -.02, C.body); b(.076, .012, .1, 0, .055, -.02, A); b(.078, .03, .02, 0, -.02, -.1, C.light);
      cz(.014, .012, -.024, .03, -.035, C.brass, 8); cz(.014, .012, .024, .03, -.035, C.brass, 8);
      b(.07, .04, .14, 0, -.008, -.18, C.woodD); b(.052, .13, .07, 0, -.07, .04, C.wood, -.35); b(.01, .026, .02, 0, .06, .03, C.dark, .4);
      b(.022, .006, .05, 0, -.025, -.03, C.dark); b(.006, .02, .006, 0, -.012, -.04, C.dark, .25);
      b(.01, .014, .01, 0, .066, -.37, C.light);
      spec = { sy: .1, mz: [0, .03, -.38], grip: [0, -.06, .05], ads: [-0.42, 1.2], pistol: true, hs: 1.1 }; break;
    }
    case 'brute':
      // Brute: heavy SMG, chunky receiver, vented shroud, 40-round magazine, vertical foregrip
      b(.092, .115, .4, 0, 0, -.08, C.body); b(.082, .04, .36, 0, .078, -.08, C.dark); b(.096, .05, .14, 0, -.005, -.18, A);
      cz(.038, .24, 0, .015, -.42, C.dark); for (let i = 0; i < 4; i++) b(.078, .012, .02, 0, .045, -.34 - i * .045, C.metal);
      cz(.016, .08, 0, .015, -.58, C.metal, 8);
      b(.052, .26, .082, 0, -.19, -.08, C.dark, .12); b(.056, .04, .09, 0, -.33, -.07, A, .12);
      b(.046, .1, .056, 0, -.075, .08, C.dark, -.28); b(.04, .012, .08, 0, -.06, -.02, C.dark);
      b(.05, .09, .18, 0, 0, .31, C.body); b(.056, .12, .03, 0, -.01, .41, C.dark); b(.044, .09, .03, 0, -.09, -.35, C.dark);
      b(.012, .04, .02, .02, .108, .02, C.dark); b(.012, .04, .02, -.02, .108, .02, C.dark); b(.01, .036, .012, 0, .1, -.3, C.dark);
      spec = { sy: 0.14, mz: [0, 0.015, -0.62], fore: [0, -0.1, -0.35], ads: [-0.46, 1.3] }; break;
    case 'ghost':
      // Ghost: slim rifle with a long suppressor, slotted handguard, skeleton stock, little red-dot sight
      b(.068, .09, .32, 0, 0, -.04, C.dark); b(.062, .03, .36, 0, .06, -.06, C.metal);
      b(.066, .075, .3, 0, .005, -.36, C.dark); for (let i = 0; i < 3; i++) b(.07, .01, .02, 0, .045, -.28 - i * .05, C.metal);
      cz(.015, .14, 0, .025, -.55, C.dark); cz(.034, .36, 0, .025, -.78, 0x2a2c33); cz(.036, .02, 0, .025, -.6, A); cz(.036, .02, 0, .025, -.96, A);
      b(.05, .15, .06, 0, -.12, -.12, C.dark, .1); b(.046, .09, .052, 0, -.08, .08, C.dark, -.3); b(.04, .01, .09, 0, -.065, 0, C.dark);
      b(.02, .02, .2, .022, .02, .28, C.metal); b(.02, .02, .2, -.022, .02, .28, C.metal); b(.05, .1, .04, 0, 0, .39, C.dark);
      b(.04, .04, .09, 0, .105, -.08, C.dark); b(.034, .034, .01, 0, .105, -.128, C.lens);
      spec = { sy: 0.13, mz: [0, 0.025, -0.98], grip: [0, -0.08, 0.08], fore: [0, -0.07, -0.36], ads: [-0.42, 1.45] }; break;
    case 'breaker':
      // Breaker: black semi-auto shotgun, box magazine, spare shells on the side, accent fore-end
      b(.082, .12, .36, 0, 0, -.02, C.dark); b(.07, .03, .3, 0, .075, -.02, C.metal);
      cz(.03, .5, 0, .035, -.45, C.dark); cz(.026, .46, 0, -.03, -.42, C.metal); b(.08, .07, .18, 0, 0, -.36, A);
      b(.06, .17, .1, 0, -.14, -.06, C.body, .08);
      for (let i = 0; i < 3; i++) cz(.016, .06, .05, .03 - i * .03, -.02, 0x8a3b2a, 8);
      b(.05, .1, .05, 0, -.085, .1, C.dark, -.3); b(.044, .01, .09, 0, -.065, .02, C.dark);
      b(.04, .1, .24, 0, -.01, .3, C.dark); b(.06, .12, .03, 0, -.02, .43, C.metal); b(.012, .014, .012, 0, .07, -.7, C.light);
      spec = { sy: 0.085, mz: [0, 0.035, -0.74], fore: [0, -0.075, -0.36], ads: [-0.42, 1.15] }; break;
    case 'frosty': {
      // FROSTY PISTOL (holiday gun): a white pistol with red candy stripes, a green frame, gold sights and a snowball loaded in the muzzle
      const WT = 0xf6f3ee, RD = 0xd62828, GR = 0x1f8a4c, GD = 0xe6b422;
      b(.034, .04, .19, 0, .05, -.075, WT); b(.036, .012, .19, 0, .059, -.075, RD); b(.0356, .03, .03, 0, .05, -.14, RD); b(.0356, .03, .03, 0, .05, -.03, RD);
      b(.032, .022, .17, 0, .016, -.065, GR); b(.022, .006, .05, 0, -.014, -.037, GR); b(.022, .03, .006, 0, 0, -.062, GR);
      b(.034, .11, .05, 0, -.045, .026, RD, -.28); b(.038, .014, .056, 0, -.098, .044, GD, -.28);
      b(.008, .012, .012, 0, .074, .016, GD); b(.007, .01, .01, 0, .0745, -.162, GD);
      cz(.022, .03, 0, .05, -.19, WT, 10);
      spec = { sy: 0.08, mz: [0, 0.05, -0.2], grip: [0, -0.045, 0.026], ads: [-0.42, 1.2], pistol: true, hs: 1 }; break;
    }
    case 'jingle': {
      // TINSEL BLASTER (holiday gun): a candy-striped automatic shotgun with a green rail, a striped barrel and a gold jingle bell under the fore-end
      const RD = 0xd62828, WT = 0xf6f3ee, GR = 0x1f8a4c, GD = 0xe6b422;
      b(.082, .12, .36, 0, 0, -.02, RD); for (let i = 0; i < 4; i++) b(.086, .124, .035, 0, 0, -.12 + i * .07, WT);
      b(.07, .03, .3, 0, .075, -.02, GR);
      cz(.032, .5, 0, .035, -.45, WT); for (let i = 0; i < 4; i++) cz(.034, .05, 0, .035, -.25 - i * .1, RD);
      cz(.026, .46, 0, -.03, -.42, GR); b(.08, .07, .18, 0, 0, -.36, RD); b(.084, .074, .03, 0, 0, -.31, WT);
      cz(.026, .05, 0, -.07, -.36, GD, 10); b(.012, .02, .012, 0, -.1, -.36, GD);
      b(.06, .17, .1, 0, -.14, -.06, GR, .08); b(.05, .1, .05, 0, -.085, .1, GR, -.3); b(.044, .01, .09, 0, -.065, .02, GR);
      b(.04, .1, .24, 0, -.01, .3, RD); for (let i = 0; i < 2; i++) b(.044, .104, .03, 0, -.01, .22 + i * .09, WT); b(.06, .12, .03, 0, -.02, .43, GR);
      b(.012, .014, .012, 0, .07, -.7, GD);
      spec = { sy: 0.085, mz: [0, 0.035, -0.74], fore: [0, -0.075, -0.36], ads: [-0.42, 1.15] }; break;
    }
    case 'knife': {
      if (KNIFE_STYLE === 'candycane') {
        // CANDY CANE KNIFE: a red + white striped cane. The straight shaft is the blade (it tapers to a point), the curled crook at the back is the handle.
        const CR = 0xd62828, CW = 0xf6f3ee;
        for (let k = 0; k < 9; k++) { const w = Math.max(0.01, 0.036 - k * 0.0032); b(w, w * 1.1, 0.043, 0, -0.004, -0.03 - k * 0.04, k % 2 ? CW : CR); }   // blade: stripes shrinking to a sharp tip
        for (let k = 0; k < 5; k++) b(0.036, 0.04, 0.04, 0, -0.004, 0.018 + k * 0.035, k % 2 ? CR : CW);                                                     // striped grip
        for (let k = 0; k < 6; k++) { const tg = new THREE.TorusGeometry(0.048, 0.019, 6, 3, Math.PI / 6); tg.rotateZ(Math.PI / 2 + k * Math.PI / 6); parts.push([tg, m4(0, -0.004 - 0.048, 0.16, 1, 1, 1, 0, Math.PI / 2), k % 2 ? CW : CR]); }   // the hooked crook
        spec = { sy: 0, mz: [0, -0.004, -0.4], fore: null }; break;
      }
      if (KNIFE_STYLE === 'karambit') {
        // KARAMBIT: finger ring at the back, ringed handle, brass guard, and a blade that sweeps down in a real curved claw
        const kb = new THREE.Shape();
        kb.moveTo(0, 0.03); kb.quadraticCurveTo(0.17, 0.034, 0.27, -0.05); kb.quadraticCurveTo(0.35, -0.13, 0.33, -0.24); kb.quadraticCurveTo(0.25, -0.13, 0.18, -0.05); kb.quadraticCurveTo(0.1, -0.02, 0, -0.026); kb.closePath();
        const kg = new THREE.ExtrudeGeometry(kb, { depth: 0.009, bevelEnabled: true, bevelSegments: 1, bevelSize: .0025, bevelThickness: .0015, steps: 1 }); kg.translate(0, 0, -0.0045);
        parts.push([kg, m4(0, -0.002, -0.012, 1, 1, 1, 0, Math.PI / 2), C.blade]);
        parts.push([new THREE.TorusGeometry(0.032, 0.008, 6, 14), m4(0, -0.004, 0.17, 1, 1, 1, 0, Math.PI / 2), C.metal]);
        b(.034, .048, .13, 0, -.002, .08, A); for (let k = 0; k < 4; k++) b(.037, .051, .012, 0, -.002, .035 + k * .03, C.dark);
        b(.07, .034, .016, 0, -.002, .002, C.brass); b(.04, .055, .02, 0, -.002, .152, C.brass);
        // The bevel follows the curved cutting edge.
        spec = { sy: 0, mz: [0, -0.1, -0.25], fore: null }; break;
      }
      if (KNIFE_STYLE === 'machete' || KNIFE_STYLE === 'dagger') {
        const mc = KNIFE_STYLE === 'machete', sh2 = new THREE.Shape();
        if (mc) { sh2.moveTo(0, 0.028); sh2.lineTo(0.44, 0.036); sh2.quadraticCurveTo(0.53, 0.03, 0.545, -0.012); sh2.lineTo(0.46, -0.036); sh2.lineTo(0, -0.03); }
        else { sh2.moveTo(0, 0.017); sh2.lineTo(0.1, 0.021); sh2.lineTo(0.3, 0); sh2.lineTo(0.1, -0.021); sh2.lineTo(0, -0.017); }
        sh2.closePath();
        const bg2 = new THREE.ExtrudeGeometry(sh2, { depth: mc ? 0.007 : 0.01, bevelEnabled: true, bevelSegments: 1, bevelSize: .0025, bevelThickness: .0015, steps: 1 }); bg2.translate(0, 0, mc ? -0.0035 : -0.005);
        parts.push([bg2, m4(0, -0.004, -0.012, 1, 1, 1, 0, Math.PI / 2), C.blade]);
        if (mc) { b(.01, .006, .4, 0, .03, -.24, C.light); b(.034, .05, .15, 0, -.004, .08, C.wood); for (let k = 0; k < 3; k++) b(.038, .012, .012, 0, -.004, .04 + k * .045, C.metal); b(.038, .056, .02, 0, -.004, .16, C.dark); b(.04, .04, .012, 0, -.004, .0, C.dark); }
        else { b(.011, .008, .26, 0, 0, -.15, C.light); b(.095, .022, .018, 0, -.004, .0, C.brass); b(.03, .042, .12, 0, -.004, .07, A); for (let k = 0; k < 3; k++) b(.033, .045, .01, 0, -.004, .04 + k * .03, C.dark); cz(.022, .03, 0, -.004, .14, C.brass, 8); }
        spec = { sy: 0, mz: [0, -0.05, mc ? -0.48 : -0.28], fore: null }; break;
      }
      {
      // COMBAT KNIFE: straight spine, curved belly, clip-point tip, brass guard, ringed grip, pommel
      const sh = new THREE.Shape();
      sh.moveTo(0, 0.027); sh.lineTo(0.25, 0.027); sh.quadraticCurveTo(0.31, 0.026, 0.345, 0.004);
      sh.quadraticCurveTo(0.3, -0.026, 0.2, -0.028); sh.lineTo(0, -0.027); sh.closePath();
      const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelSegments: 1, bevelSize: .0025, bevelThickness: .0015, steps: 1 }); bg.translate(0, 0, -0.004);
      parts.push([bg, m4(0, -0.004, -0.012, 1, 1, 1, 0, Math.PI / 2), C.blade]);
      b(.012, .006, .25, 0, .02, -.14, C.light);                                   // bright spine
      b(.0095, .007, .22, 0, -.027, -.12, C.light);                                // sharpened edge
      b(.012, .006, .17, 0, .002, -.14, C.metal);                                  // fuller groove
      b(.075, .034, .016, 0, -.004, .002, C.brass); b(.05, .02, .02, 0, -.004, .004, C.dark);   // cross-guard
      b(.034, .046, .13, 0, -.004, .075, A);                                       // grip in the gun's accent colour
      for (let k = 0; k < 4; k++) b(.037, .049, .012, 0, -.004, .035 + k * .03, C.dark);
      b(.04, .054, .022, 0, -.004, .148, C.brass);                                 // pommel
      spec = { sy: 0, mz: [0, -0.05, -0.25], fore: null }; break;
      }
    }
    default:
      if (id === 'molly') {
        parts.push(pt.cyl(0.032, 0.12, 0, -0.01, -0.04, 0xa8742e), pt.cyl(0.016, 0.07, 0, 0.085, -0.04, 0xa8742e), pt.cyl(0.02, 0.012, 0, 0.12, -0.04, 0x3a3a3a));
        b(.03, .06, .02, .005, .155, -.04, 0xece4d0, .25); b(.026, .05, .02, .01, .2, -.04, 0xff9a2a, .25); b(.016, .035, .016, .012, .235, -.04, 0xffd44a, .25);
        spec = { sy: 0, mz: [0, 0, -0.1], fore: null };
      } else if (id === 'he') { parts.push([new THREE.IcosahedronGeometry(1, 1), m4(0, 0, -0.04, 0.05, 0.058, 0.05), A]); }
      else { parts.push(pt.cyl(0.036, 0.13, 0, 0, -0.04, A)); parts.push(pt.cyl(0.038, 0.014, 0, 0.045, -0.04, C.dark), pt.cyl(0.038, 0.014, 0, -0.045, -0.04, C.dark)); }
      if (id !== 'molly') { b(.016, .09, .022, .042, .03, -.04, C.metal); parts.push(pt.cyl(0.016, 0.03, 0, 0.075, -0.04, C.metal)); spec = { sy: 0, mz: [0, 0, -0.1], fore: null }; }
  }
  const g = new THREE.Group();
  // each arm is ONE simple rectangle (team-coloured sleeve) that comes up from the bottom of the screen and holds the gun
  const armBox = (from, dir, w, len) => {
    const d = dir.clone().normalize();
    const s2 = pt.seg(from, from.clone().addScaledVector(d, len), w, w, 0), sm = new THREE.Mesh(GEO.box, sleeveMat);
    sm.matrixAutoUpdate = false; sm.matrix.copy(s2[1]); g.add(sm); return sm;
  };
  let lArm = null;   // the off hand's arm: game.js hides it while the ballistic shield is up (that hand is holding the shield)
  const noHands = ['he', 'flash', 'smoke', 'molly'].includes(id);
  if (id === 'knife') armBox(V(0, -0.005, 0.045), V(0.18, -0.5, 0.5), 0.085, 1.2);
  else if (noHands) armBox(V(0, -0.05, -0.02), V(0.18, -0.5, 0.5), 0.09, 1.2);
  else if (spec.pistol) { armBox(V(0.004 * spec.hs, 0.02 * spec.hs, 0.03 * spec.hs), V(0.12, -0.8, 0.5), 0.092 * spec.hs, 1.3)
    lArm = armBox(V(-0.012 * spec.hs, -0.012 * spec.hs, 0.012 * spec.hs), V(-0.32, -0.8, 0.5), 0.09 * spec.hs, 1.3); }
  else {
    const gp = spec.grip || [0, -0.08, 0.065];
    armBox(V(gp[0], gp[1] + 0.02, gp[2]), V(0.15, -0.6, 0.45), 0.1, 1.2);
    if (spec.fore) lArm = armBox(V(spec.fore[0], spec.fore[1] - 0.012, spec.fore[2]), V(-0.2, -0.6, 0.42), 0.1, 1.2);
  }

  fixCoplanar(parts, bxs);
  const finishMesh = new THREE.Mesh(mergeParts(parts), gunMat); g.add(finishMesh);
  for (const e of extra) g.add(e);
  const mz = new THREE.Object3D(); mz.position.set(...spec.mz); g.add(mz);
  const k = { raptor: 0.8, sentinel: 0.8, buzz: 0.84, thumper: 0.8, longbow: 0.8, chopper: 0.84, scatter: 0.8, carbine: 0.8, ranger: 0.8, dmr: 0.8, lmg: 0.78, brute: 0.84, ghost: 0.8, breaker: 0.8, jingle: 0.8 }[id] || 1;
  if (k !== 1) { g.scale.setScalar(k); spec.sy *= k; }
  return { ...spec, g, mz, lArm, finishMesh };
}
