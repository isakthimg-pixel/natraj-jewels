// Draws the Natraj Jewels shop as a pen sketch on paper (isometric cutaway, ink lines, orange notes).
// node make-sketch.js out.svg
const fs = require('fs');
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + (b - a) * rnd();

const S = 21, C = Math.cos(Math.PI / 6);
const P = (x, y, z) => [(x - z) * C * S, (x + z) * .5 * S - y * S];
const INK = '#2A2623', PAPER = '#FBF8F1', OR = '#E0662F';
const f1 = n => n.toFixed(1);

// one hand-drawn stroke: a slight bow and a little overshoot at the ends
function stroke(a, b, w = 1, col = INK, op = 1){
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const o1 = rr(0, Math.min(1.6, L * .06)), o2 = rr(0, Math.min(1.8, L * .07));
  const p = [a[0] - ux * o1, a[1] - uy * o1], q = [b[0] + ux * o2, b[1] + uy * o2];
  const bow = rr(-.5, .5) * Math.min(1.4, L / 30), m = [(p[0] + q[0]) / 2 - uy * bow, (p[1] + q[1]) / 2 + ux * bow];
  return '<path d="M' + f1(p[0]) + ' ' + f1(p[1]) + 'Q' + f1(m[0]) + ' ' + f1(m[1]) + ' ' + f1(q[0]) + ' ' + f1(q[1]) + '" stroke="' + col + '" stroke-width="' + w + '"' + (op < 1 ? ' stroke-opacity="' + op + '"' : '') + '/>';
}
const poly = (pts, fill = PAPER) => '<path d="M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L') + 'Z" fill="' + fill + '" stroke="none"/>';

const items = [];   // {key, svg}
const add = (key, svg) => items.push({key, svg});

// a box seen from the front-right: top, right (+x) and front (+z) faces
// cut: skip the edges on the x=x0 or z=z0 side (where the box carries on from a neighbouring piece)
function box(x0, x1, y0, y1, z0, z1, o = {}){
  const v = (x, y, z) => P(x, y, z);
  const top = [v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1)];
  const rx = [v(x1, y0, z0), v(x1, y0, z1), v(x1, y1, z1), v(x1, y1, z0)];
  const fz = [v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)];
  let s = poly(top, o.top || PAPER) + poly(rx, o.side || PAPER) + poly(fz, o.front || PAPER);
  const w = o.w || 1.05, E = [];
  if(!o.cutZ) E.push([v(x0, y1, z0), v(x1, y1, z0)], [v(x1, y0, z0), v(x1, y1, z0)]);
  if(!o.cutX) E.push([v(x0, y1, z0), v(x0, y1, z1)], [v(x0, y0, z1), v(x0, y1, z1)]);
  E.push([v(x1, y1, z0), v(x1, y1, z1)], [v(x0, y1, z1), v(x1, y1, z1)], [v(x1, y0, z1), v(x1, y1, z1)], [v(x1, y0, z0), v(x1, y0, z1)], [v(x0, y0, z1), v(x1, y0, z1)]);
  s += E.map(e => stroke(e[0], e[1], w)).join('');
  // light hatching on one face, like pencil shade
  if(o.hatchFront){ const n = Math.max(2, Math.round((x1 - x0) / .16)); for(let i = 1; i < n; i++){ const x = x0 + (x1 - x0) * i / n; s += stroke(v(x, y0 + .04, z1), v(x, y1 - rr(.05, (y1 - y0) * .5), z1), .5, INK, .55); } }
  if(o.hatchSide){ const n = Math.max(2, Math.round((z1 - z0) / .16)); for(let i = 1; i < n; i++){ const z = z0 + (z1 - z0) * i / n; s += stroke(v(x1, y0 + .04, z), v(x1, y1 - rr(.05, (y1 - y0) * .5), z), .5, INK, .55); } }
  return s;
}
// long boxes are cut into pieces so the near/far order stays right
function longZ(x0, x1, y0, y1, z0, z1, step, o = {}, extra){
  const n = Math.ceil((z1 - z0) / step);
  for(let i = 0; i < n; i++){
    const a = z0 + (z1 - z0) * i / n, b = z0 + (z1 - z0) * (i + 1) / n;
    add((x0 + x1) / 2 + (a + b) / 2 + (o.k || 0), box(x0, x1, y0, y1, a, b, {...o, cutZ: i > 0}) + (extra ? extra(a, b, i) : ''));
  }
}
function longX(x0, x1, y0, y1, z0, z1, step, o = {}, extra){
  const n = Math.ceil((x1 - x0) / step);
  for(let i = 0; i < n; i++){
    const a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n;
    add((a + b) / 2 + (z0 + z1) / 2 + (o.k || 0), box(a, b, y0, y1, z0, z1, {...o, cutX: i > 0}) + (extra ? extra(a, b, i) : ''));
  }
}
const lines = (pts, w = .8, col = INK, op = 1) => pts.slice(1).map((p, i) => stroke(pts[i], p, w, col, op)).join('');
const arcPts = (cx, cy, r, a0, a1, n, map) => Array.from({length: n + 1}, (_, i) => { const a = a0 + (a1 - a0) * i / n; return map(cx + Math.cos(a) * r, cy + Math.sin(a) * r); });

/* ---------- the shop: 20 x 80 ft, gate at the front (+z), a U of glass showcase counters, alcoves on the left wall ---------- */
const HX = 3.4, ZB = -9.5, ZF = 9.5, WH = 3.1, GZ = ZF + .45;
const LIGHT = '#ECE6DA', MID = '#D9D1C4', DARK = '#57504A';
const onX = x => (z, y) => P(x, y, z), onZ = z => (x, y) => P(x, y, z);
const rect = (f, a0, b0, a1, b1, w = .6, op = 1) => lines([f(a0, b0), f(a1, b0), f(a1, b1), f(a0, b1), f(a0, b0)], w, INK, op);
const dot = (p, r = .8, fill = INK) => '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + r + '" fill="' + fill + '"/>';
// pencil shade on the floor: short diagonal strokes over a strip
function floorShade(x0, x1, z0, z1, step = .12){
  let s = '';
  for(let z = z0; z < z1; z += step) s += stroke(P(x0, .005, z), P(x1, .005, Math.min(z1, z + (x1 - x0) * .8)), .4, INK, .5);
  return s;
}
function floorShadeX(x0, x1, z0, z1, step = .12){
  let s = '';
  for(let x = x0; x < x1; x += step) s += stroke(P(x, .005, z0), P(Math.min(x1, x + (z1 - z0) * .8), .005, z1), .4, INK, .5);
  return s;
}
const blob = (x, z, r = .28) => { const p = P(x, .005, z); return '<ellipse cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" rx="' + f1(r * S * 1.1) + '" ry="' + f1(r * S * .55) + '" fill="' + INK + '" fill-opacity=".12"/>'; };

// the ground: dots and tufts around the shop
let g = '';
for(let i = 0; i < 520; i++){
  const x = rr(-5.5, 7), z = rr(-11.5, 14);
  if(x > -HX - .3 && x < HX + .3 && z > ZB - .3 && z < ZF + .5) continue;
  if(Math.abs(x) < 1.1 && z > ZF && z < 13.4) continue;
  if(x < -HX - .4 && z < ZF - 1) continue;
  if(z < ZB - .4 && x < 4) continue;
  const p = P(x, 0, z); g += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + rr(.35, .7).toFixed(2) + '" fill="' + INK + '" fill-opacity=".5"/>';
}
for(let i = 0; i < 22; i++){
  const x = rr(3.9, 6.5), z = rr(-8, 13); const p = P(x, 0, z);
  g += lines([[p[0] - 2, p[1]], [p[0] - 1, p[1] - 4]], .6) + lines([[p[0], p[1]], [p[0] + .5, p[1] - 5]], .6) + lines([[p[0] + 2, p[1]], [p[0] + 2.5, p[1] - 3.5]], .6);
}
add(-100, g);

// the path to the gate: a step, edges and stone slabs
{
  let s = '';
  s += lines([P(-1.05, 0, GZ + .4), P(-1.15, 0, 11.8), P(-1, 0, 13.4)], .8) + lines([P(1.05, 0, GZ + .4), P(1.15, 0, 11.8), P(1, 0, 13.4)], .8);
  for(let z = GZ + .55; z < 13.2; z += .6) s += poly([P(-.75, 0, z), P(.75, 0, z), P(.75, 0, z + .42), P(-.75, 0, z + .42)], '#F1EBDF') + lines([P(-.75, 0, z), P(.75, 0, z), P(.75, 0, z + .42), P(-.75, 0, z + .42), P(-.75, 0, z)], .7);
  add(-90, s);
}

// the floor: a raised plinth with marble tiles and a few veins
{
  let s = box(-HX - .25, HX + .25, -.25, 0, ZB - .25, GZ, {w: 1.1});
  for(let z = ZB + 1; z < ZF; z += 1) s += stroke(P(-HX, 0, z), P(HX, 0, z), .45, INK, .42);
  for(let x = -HX + 1.13; x < HX; x += 1.13) s += stroke(P(x, 0, ZB), P(x, 0, ZF), .45, INK, .42);
  for(let i = 0; i < 26; i++){ const x = rr(-HX + .2, HX - .4), z = rr(ZB + .2, ZF - .4); s += lines([P(x, 0, z), P(x + rr(.1, .3), 0, z + rr(.15, .35)), P(x + rr(.25, .5), 0, z + rr(.3, .6))], .35, INK, .35); }
  for(let x = -HX; x < HX + .2; x += .26) s += stroke(P(x, -.22, GZ), P(x + .13, -.03, GZ), .45, INK, .5);
  for(let z = ZB; z < GZ; z += .26) s += stroke(P(HX + .25, -.22, z), P(HX + .25, -.03, z + .13), .45, INK, .5);
  // a step up at the gate
  s += box(-1.1, 1.1, -.25, -.12, GZ, GZ + .35, {w: .9});
  add(-80, s);
}
// the carpet runner down the aisle, a border and a diamond pattern
{
  const z0 = -7.1, z1 = GZ;
  let s = poly([P(-.65, .01, z0), P(.65, .01, z0), P(.65, .01, z1), P(-.65, .01, z1)], '#F3EDE2');
  s += lines([P(-.65, .01, z0), P(.65, .01, z0), P(.65, .01, z1)], .8) + lines([P(-.65, .01, z0), P(-.65, .01, z1)], .8);
  s += lines([P(-.5, .01, z0 + .15), P(.5, .01, z0 + .15), P(.5, .01, z1)], .45) + lines([P(-.5, .01, z0 + .15), P(-.5, .01, z1)], .45);
  for(let z = z0 + .6; z < z1 - .3; z += .9) s += lines([P(0, .01, z - .28), P(.24, .01, z), P(0, .01, z + .28), P(-.24, .01, z), P(0, .01, z - .28)], .45);
  // shadows the counters cast on the floor
  s += floorShade(-1.8, -1.45, -7.2, 6.2) + floorShade(2.6, 2.95, -7.2, 5.6) + floorShadeX(-1.8, 1.8, -7.2, -6.85) + floorShade(-3.4, -3.15, ZB, ZF, .16);
  add(-70, s);
}

// back wall, with the shop sign and lit display cabinets either side
longX(-HX - .25, HX + .25, 0, WH, ZB - .25, ZB, 1.4, {k: -.5}, (a, b) => {
  let s = '';
  for(let y = .45; y < WH; y += .45) s += stroke(P(Math.max(a, -HX), y, ZB), P(b, y, ZB), .35, INK, .3);
  return s;
});
{
  const x0 = -1.85, x1 = 1.85, y0 = 1.95, y1 = 2.7, z = ZB + .06, f = onZ(z);
  let s = box(x0, x1, y0, y1, ZB, z, {w: 1.1});
  s += rect(f, x0 + .08, y0 + .08, x1 - .08, y1 - .08, .55);
  const o = P(0, (y0 + y1) / 2, z);
  s += '<text transform="matrix(' + C.toFixed(3) + ' .5 0 1 ' + f1(o[0]) + ' ' + f1(o[1]) + ')" text-anchor="middle" dominant-baseline="central" font-family="Georgia,serif" font-size="8" letter-spacing=".8" fill="' + INK + '">NATRAJ JEWELS</text>';
  // two spot lights over the sign
  for(const x of [-1.1, 1.1]){ const p = P(x, 2.95, z + .1); s += lines([P(x, WH, ZB + .02), p], .6) + '<path d="M' + f1(p[0] - 2) + ' ' + f1(p[1]) + 'l4 0l-1 3h-2z" fill="' + PAPER + '" stroke="' + INK + '" stroke-width=".6"/>'; }
  add(-6.6, s);
}
function cabinet(x0, x1){
  const z0 = ZB, z1 = ZB + .5, y1 = 2.45, f = onZ(z1);
  let s = box(x0, x1, 0, y1, z0, z1, {w: 1});
  s += rect(f, x0 + .1, .55, x1 - .1, y1 - .12, .6);                       // glass doors
  s += stroke(f((x0 + x1) / 2, .55), f((x0 + x1) / 2, y1 - .12), .5, INK, .7);
  for(const y of [1.05, 1.5, 1.95]) s += stroke(f(x0 + .1, y), f(x1 - .1, y), .5, INK, .75);   // shelves
  for(const y of [1.05, 1.5, 1.95]) for(let x = x0 + .3; x < x1 - .2; x += .32){            // pieces on the shelves
    const p = f(x, y); s += '<path d="M' + f1(p[0] - 2) + ' ' + f1(p[1]) + 'q2 -4 4 0" fill="none" stroke="' + INK + '" stroke-width=".55"/>' + dot([p[0], p[1] - 1.5], .5);
  }
  s += stroke(f(x0 + .25, y1 - .25), f(x0 + .6, y1 - .6), .5, INK, .45) + stroke(f(x0 + .35, y1 - .2), f(x0 + .75, y1 - .6), .5, INK, .45);   // glass shine
  for(let x = x0 + .1; x < x1 - .05; x += .12) s += stroke(f(x, .06), f(x, .48), .4, INK, .55);   // base shade
  return s;
}
add(-3.3 + ZB + .2, cabinet(-3.35, -2.05));
add(2.05 + ZB + .2, cabinet(2.05, 3.35));

// the left wall: tall, with arched alcoves holding banners and necklaces on busts
longZ(-HX - .25, -HX, 0, WH, ZB, ZF, 1.9, {k: -.3}, (a, b, i) => {
  const x = -HX, c = (a + b) / 2, v = onX(x);
  let s = '';
  if(i >= 1 && i <= 8){
    const w = .55, y0 = .9, y1 = 2.1;
    const top = arcPts(0, 0, w, Math.PI, 0, 10, (u, t) => v(c + u, y1 + Math.abs(t)));
    s += poly([v(c - w, y0), ...top, v(c + w, y0)], LIGHT) + lines([v(c - w, y0), ...top, v(c + w, y0)], .9) + lines([v(c - w, y0), v(c + w, y0)], .9);
    s += lines([v(c - w - .06, y0 - .04), v(c + w + .06, y0 - .04)], .7);   // sill
    if(i % 2){
      // a banner with a pointed foot and three rings
      const bw = .19, by0 = 1.1, by1 = 2.35;
      s += lines([v(c - bw, by1), v(c - bw, by0 + .15), v(c, by0), v(c + bw, by0 + .15), v(c + bw, by1)], .7);
      for(const yy of [1.5, 1.8, 2.1]){ const p = v(c, yy); s += '<ellipse cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" rx="1.9" ry="2.3" fill="none" stroke="' + INK + '" stroke-width=".55"/>'; }
    } else {
      // a necklace on a bust
      const bust = [v(c - .3, y0), v(c - .24, y0 + .35), v(c - .1, y0 + .48), v(c - .06, y0 + .75), v(c + .06, y0 + .75), v(c + .1, y0 + .48), v(c + .24, y0 + .35), v(c + .3, y0)];
      s += poly(bust, PAPER) + lines(bust, .7);
      const n = arcPts(0, 0, .17, 0, Math.PI, 8, (u, t) => v(c + u, y0 + .52 - Math.abs(t) * .9));
      s += lines(n, .6) + dot(v(c, y0 + .34), 1.1);
    }
    // a small brass lamp on the wall between alcoves
    const l = v(a + .04, 2.55);
    s += '<path d="M' + f1(l[0] - 2) + ' ' + f1(l[1] - 3) + 'h4l-.8 4h-2.4z" fill="' + PAPER + '" stroke="' + INK + '" stroke-width=".6"/>';
  }
  for(let y = .45; y < WH; y += .45) s += stroke(v(a, y), v(a + .14, y), .35, INK, .3);
  return s;
});
// the right wall and the front walls are cut away low so the inside shows
longZ(HX, HX + .25, 0, .55, ZB, GZ, 1.6, {hatchSide: true, k: .2});
longX(-HX - .25, -1.55, 0, .55, ZF, GZ, 1, {hatchFront: true, k: .2});
longX(1.55, HX, 0, .55, ZF, GZ, 1, {hatchFront: true, k: .2});

// the counters: glass showcases, necklaces on busts behind the glass, trays of rings on the glass tops
function topTrays(x0, x1, z0, z1, y){
  let s = '';
  const glass = [P(x0 + .07, y, z0 + .07), P(x1 - .07, y, z0 + .07), P(x1 - .07, y, z1 - .07), P(x0 + .07, y, z1 - .07)];
  s += lines([...glass, glass[0]], .45, INK, .55);
  if(rnd() < .55){
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, tw = .2, tl = .3;
    const tray = [P(cx - tw, y, cz - tl), P(cx + tw, y, cz - tl), P(cx + tw, y, cz + tl), P(cx - tw, y, cz + tl)];
    s += poly(tray, LIGHT) + lines([...tray, tray[0]], .55);
    for(let k = -1; k <= 1; k++) s += dot(P(cx, y, cz + k * .17), .7);
  }
  return s;
}
function glassFront(f, a, b, step){
  let s = '';
  s += stroke(f(a, .9), f(b, .9), .5);                                    // the top lip
  for(let u = a + .04; u < b; u += .1) s += stroke(f(u, .03), f(u, .16), .4, INK, .6);   // plinth shade
  s += stroke(f(a, .18), f(b, .18), .5);
  s += rect(f, a + .07, .26, b - .07, .82, .55);                            // the glass
  for(let c = a + step / 2; c < b - .1; c += step){
    const bust = [f(c - .16, .27), f(c - .12, .5), f(c - .05, .57), f(c - .04, .7), f(c + .04, .7), f(c + .05, .57), f(c + .12, .5), f(c + .16, .27)];
    s += poly(bust, PAPER) + lines(bust, .55);
    s += lines(arcPts(0, 0, .1, 0, Math.PI, 6, (u, t) => f(c + u, .6 - Math.abs(t) * .9)), .5) + dot(f(c, .5), .8);
  }
  s += stroke(f(a + .15, .78), f(a + .35, .4), .45, INK, .45) + stroke(f(a + .25, .8), f(a + .45, .42), .45, INK, .45);   // shine on the glass
  return s;
}
function drawers(f, a, b){
  let s = stroke(f(a, .9), f(b, .9), .5);
  for(const [y0, y1] of [[.12, .45], [.5, .83]]){
    s += rect(f, a + .06, y0, b - .06, y1, .5);
    s += dot(f((a + b) / 2, (y0 + y1) / 2), .7);
  }
  return s;
}
longZ(-2.6, -1.8, 0, .95, -7.2, 6.2, 1.34, {}, (a, b) => topTrays(-2.6, -1.8, a, b, .95) + glassFront(onX(-1.8), a, b, .45));
longZ(1.8, 2.6, 0, .95, -7.2, 5.6, 1.36, {}, (a, b) => topTrays(1.8, 2.6, a, b, .95) + drawers(onX(2.6), a, b));
longX(-2.6, 2.6, 0, .95, -8, -7.2, 1.3, {}, (a, b) => topTrays(a, b, -8, -7.2, .95) + glassFront(onZ(-7.2), a, b, .45));

// ceiling fans and chandeliers hanging on rods (the ceiling itself is cut away)
function fan(x, z){
  const y = 2.75, hub = P(x, y, z);
  let s = lines([P(x, 3.3, z), hub], .8);
  for(const deg of [25, 145, 265]){
    const a = deg * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a), px = -uz, pz = ux;
    const q = [P(x + ux * .12 + px * .05, y, z + uz * .12 + pz * .05), P(x + ux * .78 + px * .08, y, z + uz * .78 + pz * .08), P(x + ux * .8 - px * .07, y, z + uz * .8 - pz * .07), P(x + ux * .12 - px * .05, y, z + uz * .12 - pz * .05)];
    s += poly(q, LIGHT) + lines([...q, q[0]], .6);
  }
  s += '<ellipse cx="' + f1(hub[0]) + '" cy="' + f1(hub[1]) + '" rx="3.2" ry="2" fill="' + PAPER + '" stroke="' + INK + '" stroke-width=".8"/>';
  return s;
}
function chandelier(x, z){
  const y = 2.62, r = .42;
  let s = lines([P(x, 3.3, z), P(x, y + .25, z)], .7);
  const ring = arcPts(0, 0, r, 0, Math.PI * 2, 24, (u, t) => P(x + u, y, z + t));
  for(let k = 0; k < 6; k++){ const a = k / 6 * Math.PI * 2; s += lines([P(x, y + .25, z), P(x + Math.cos(a) * r, y, z + Math.sin(a) * r)], .4, INK, .7); }
  s += lines(ring, .8);
  for(let k = 0; k < 8; k++){ const a = k / 8 * Math.PI * 2, p = P(x + Math.cos(a) * r, y, z + Math.sin(a) * r); s += lines([p, [p[0], p[1] + 4]], .5) + dot([p[0], p[1] + 4.8], .8); }
  return s;
}
for(const [z, what] of [[-6, fan], [-3, chandelier], [0, fan], [3, chandelier], [6, fan]]){
  add(z + 1.5, what(0, z));
}

// people, drawn simply but with real proportions: women in sarees, men in shirts, staff in darker uniforms
function hair(cx, cy, r, bun){
  return '<path d="M' + f1(cx - r) + ' ' + f1(cy + .4) + 'a' + r + ' ' + r + ' 0 0 1 ' + f1(r * 2) + ' 0q-' + f1(r) + ' -1.3 -' + f1(r * 2) + ' 0z" fill="' + INK + '"/>' + (bun ? dot([cx + r * .95, cy + .4], 1.4) : '');
}
function standing(x, z, o = {}){
  const p = P(x, 0, z), X = p[0], Y = p[1], fill = o.staff ? DARK : (o.saree ? MID : LIGHT), ink = ' stroke="' + INK + '" stroke-width=".8"';
  let s = blob(x, z, .22);
  const head = [X, Y - 31.5];
  if(o.saree){
    s += '<path d="M' + f1(X - 3.4) + ' ' + f1(Y - 17) + 'L' + f1(X - 5.6) + ' ' + f1(Y) + 'L' + f1(X + 5.6) + ' ' + f1(Y) + 'L' + f1(X + 3.4) + ' ' + f1(Y - 17) + 'Z" fill="' + fill + '"' + ink + '/>';
    for(const d of [-1, .3, 1.6]) s += stroke([X + d, Y - 13], [X + d * 1.4, Y - .5], .45, o.staff ? '#FBF8F1' : INK, .7);
  } else {
    s += '<path d="M' + f1(X - 3.2) + ' ' + f1(Y - 16) + 'L' + f1(X - 3) + ' ' + f1(Y) + 'L' + f1(X - .6) + ' ' + f1(Y) + 'L' + f1(X) + ' ' + f1(Y - 10) + 'L' + f1(X + .6) + ' ' + f1(Y) + 'L' + f1(X + 3) + ' ' + f1(Y) + 'L' + f1(X + 3.2) + ' ' + f1(Y - 16) + 'Z" fill="' + (o.staff ? '#3A3430' : '#C9C0B2') + '"' + ink + '/>';
  }
  // body and arms
  s += '<path d="M' + f1(X - 3.6) + ' ' + f1(Y - 16) + 'C' + f1(X - 4.4) + ' ' + f1(Y - 22) + ' ' + f1(X - 5) + ' ' + f1(Y - 26.4) + ' ' + f1(X - 2) + ' ' + f1(Y - 27) + 'L' + f1(X + 2) + ' ' + f1(Y - 27) + 'C' + f1(X + 5) + ' ' + f1(Y - 26.4) + ' ' + f1(X + 4.4) + ' ' + f1(Y - 22) + ' ' + f1(X + 3.6) + ' ' + f1(Y - 16) + 'Z" fill="' + fill + '"' + ink + '/>';
  if(o.saree) s += stroke([X - 2.6, Y - 26.5], [X + 3.4, Y - 17.5], .7, o.staff ? '#FBF8F1' : INK, .8) + stroke([X - 1.2, Y - 27], [X + 3.9, Y - 19.5], .5, o.staff ? '#FBF8F1' : INK, .6);
  s += lines([[X - 4.3, Y - 25], [X - 5.2, Y - 19], [X - 4.6, Y - 14.5]], .9) + lines([[X + 4.3, Y - 25], [X + 5.2, Y - 19], [X + 4.6, Y - 14.5]], .9);
  s += lines([[X, Y - 27], [X, Y - 28.6]], 1.2);
  s += '<ellipse cx="' + f1(head[0]) + '" cy="' + f1(head[1]) + '" rx="2.8" ry="3.2" fill="' + PAPER + '"' + ink + '/>' + hair(head[0], head[1] - .6, 2.9, o.saree);
  return s;
}
// sitting on a chair; face says which way the knees point on the page: 'ul' up-left, 'dr' down-right, 'ur' up-right
function sitting(x, z, face, o = {}){
  const p = P(x, .5, z), X = p[0], Y = p[1], fill = o.saree ? MID : LIGHT, ink = ' stroke="' + INK + '" stroke-width=".8"';
  const k = {ul: [-6, -2.5, -6.5, 9.5], dr: [5.5, 3, 6, 13], ur: [6, -2.5, 6.5, 9.5]}[face];
  let s = '';
  s += '<path d="M' + f1(X - 2) + ' ' + f1(Y - 1) + 'L' + f1(X + k[0] - 1) + ' ' + f1(Y + k[1] - 1.2) + 'L' + f1(X + k[0] + 1.2) + ' ' + f1(Y + k[1] + 1.4) + 'L' + f1(X + 2) + ' ' + f1(Y + 1) + 'Z" fill="' + (o.saree ? MID : '#C9C0B2') + '"' + ink + '/>';
  s += lines([[X + k[0], Y + k[1]], [X + k[2], Y + k[3]]], 1.3);
  s += '<path d="M' + f1(X - 3.4) + ' ' + f1(Y) + 'C' + f1(X - 4.3) + ' ' + f1(Y - 6) + ' ' + f1(X - 4.8) + ' ' + f1(Y - 10.4) + ' ' + f1(X - 1.9) + ' ' + f1(Y - 11) + 'L' + f1(X + 1.9) + ' ' + f1(Y - 11) + 'C' + f1(X + 4.8) + ' ' + f1(Y - 10.4) + ' ' + f1(X + 4.3) + ' ' + f1(Y - 6) + ' ' + f1(X + 3.4) + ' ' + f1(Y) + 'Z" fill="' + fill + '"' + ink + '/>';
  if(o.saree) s += stroke([X - 2.4, Y - 10.5], [X + 3.2, Y - 1.5], .7, INK, .8);
  s += lines([[X - 4, Y - 9], [X - 4.6 + k[0] * .2, Y - 4], [X - 2 + k[0] * .35, Y - 2.5]], .9) + lines([[X + 4, Y - 9], [X + 4.6 + k[0] * .2, Y - 4], [X + 2 + k[0] * .35, Y - 2.5]], .9);
  s += lines([[X, Y - 11], [X, Y - 12.6]], 1.2);
  s += '<ellipse cx="' + f1(X) + '" cy="' + f1(Y - 15.5) + '" rx="2.8" ry="3.2" fill="' + PAPER + '"' + ink + '/>' + hair(X, Y - 16.1, 2.9, o.saree);
  return s;
}
// a cushioned chair; the back sits on the side away from the counter
function chair(x, z, back){
  const r = .2, y = .48;
  const seat = box(x - r, x + r, y - .07, y, z - r, z + r, {w: .7, top: LIGHT});
  const legs = [[x + r - .03, z - r + .03], [x + r - .03, z + r - .03], [x - r + .03, z + r - .03]].map(([lx, lz]) => lines([P(lx, y - .07, lz), P(lx, 0, lz)], .7)).join('');
  const bk = {px: box(x + r - .05, x + r, y, 1.02, z - r, z + r, {w: .7}), nx: box(x - r, x - r + .05, y, 1.02, z - r, z + r, {w: .7}), pz: box(x - r, x + r, y, 1.02, z + r - .05, z + r, {w: .7})}[back];
  return {seat: blob(x, z, .26) + legs + seat, back: bk};
}
// customers at the left counter (facing it), at the right counter and at the back counter
const seats = [
  [-1.35, -5.4, 'px', 'ul', {saree: true}], [-1.35, -3.6, 'px', 'ul', null], [-1.35, -1.6, 'px', 'ul', {saree: true}], [-1.35, .6, 'px', 'ul', {}], [-1.35, 2.8, 'px', 'ul', null], [-1.35, 4.8, 'px', 'ul', {saree: true}],
  [1.35, -4.6, 'nx', 'dr', {}], [1.35, -2.4, 'nx', 'dr', null], [1.35, -.2, 'nx', 'dr', {saree: true}], [1.35, 2.2, 'nx', 'dr', null], [1.35, 4.2, 'nx', 'dr', {saree: true}],
  [-1.1, -6.75, 'pz', 'ur', {saree: true}], [.2, -6.75, 'pz', 'ur', {}], [1.3, -6.75, 'pz', 'ur', null]
];
for(const [x, z, back, face, who] of seats){
  const c = chair(x, z, back), k = x + z;
  add(k, c.seat);
  if(who) add(k + .01, sitting(x, z, face, who));
  add(k + (back === 'nx' ? -.02 : .02), c.back);
}
// staff behind the counters
for(const [x, z, o] of [[-3, -4.6, {saree: true}], [-3, -1, {}], [-3, 2.6, {saree: true}], [3.05, -3.4, {}], [3.05, .2, {saree: true}], [3.05, 3.4, {}], [-1.3, -8.6, {saree: true}], [.9, -8.6, {}]]) add(x + z - .05, standing(x, z, {...o, staff: true}));

// the billing desk by the gate: a computer, a printer and the cashier
add(2.55 + 7.1, box(2.15, 2.95, 0, .8, 6.6, 7.6, {hatchFront: true}) + box(2.4, 2.5, .8, 1.25, 6.85, 7.35, {w: .8}) + box(2.25, 2.45, .8, .86, 6.9, 7.3, {w: .6}) + box(2.6, 2.85, .8, .95, 7.2, 7.5, {w: .6}));
{ const c = chair(3.15, 7.1, 'px'); add(3.15 + 7.1 - .2, c.seat + sitting(3.15, 7.1, 'ul', {}) + c.back); }

// the gate: two pillars, an arch board with the name, a little dome, and the doors folded open
add(-1.3 + ZF + .3, box(-1.55, -1.1, 0, 3.2, ZF, GZ, {hatchFront: true}));
add(1.3 + ZF + .3, box(1.1, 1.55, 0, 3.2, ZF, GZ, {hatchFront: true}));
{
  let s = box(-1.8, 1.8, 3.2, 3.8, ZF - .05, GZ + .05, {w: 1.15});
  const o = P(0, 3.5, GZ + .05);
  s += '<text transform="matrix(' + C.toFixed(3) + ' .5 0 1 ' + f1(o[0]) + ' ' + f1(o[1]) + ')" text-anchor="middle" dominant-baseline="central" font-family="Georgia,serif" font-size="6.4" letter-spacing=".5" fill="' + INK + '">NATRAJ JEWELS</text>';
  const d = arcPts(0, 0, .55, Math.PI, 0, 10, (u, t) => P(u, 3.8 + Math.abs(t) * 1.1, ZF + .22));
  s += poly(d, PAPER) + lines(d, 1);
  const tip = P(0, 4.42, ZF + .22); s += lines([tip, [tip[0], tip[1] - 6]], .9) + dot([tip[0], tip[1] - 7], 1.3);
  add(ZF + 1, s);
}
for(const side of [-1, 1]){
  const hx = side * 1.1, hz = GZ, ang = 70 * Math.PI / 180, ex = hx - side * Math.cos(ang) * 1, ez = hz + Math.sin(ang) * 1, h = 2.75;
  const q = [P(hx, 0, hz), P(ex, 0, ez), P(ex, h, ez), P(hx, h, hz)];
  let s = poly(q) + lines([...q, q[0]], 1);
  const m = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for(const [t0, t1] of [[.12, .45], [.55, .88]]){
    const a0 = m(q[0], q[3], t0), a1 = m(q[0], q[3], t1), b0 = m(q[1], q[2], t0), b1 = m(q[1], q[2], t1);
    const i0 = m(a0, b0, .15), i1 = m(a0, b0, .85), i2 = m(a1, b1, .85), i3 = m(a1, b1, .15);
    s += lines([i0, i1, i2, i3, i0], .55);
  }
  add((hx + ex) / 2 + (hz + ez) / 2 + .6, s);
}
// lamps by the path, potted plants at the gate, pointed shrubs round the shop, and a family walking in
function lamp(x, z){
  const b = P(x, 0, z), t = P(x, 1.5, z);
  return blob(x, z, .15) + lines([b, t], 1) + '<path d="M' + f1(t[0] - 3) + ' ' + f1(t[1]) + 'h6l-1 -6h-4z" fill="' + PAPER + '" stroke="' + INK + '" stroke-width=".8"/>' + lines([[t[0] - 2.5, t[1] - 6], [t[0], t[1] - 9], [t[0] + 2.5, t[1] - 6]], .8);
}
add(-1.6 + 12.1, lamp(-1.6, 12.1)); add(1.6 + 12.1, lamp(1.6, 12.1));
function shrub(x, z, h){
  const b = P(x, 0, z), w = 5 + h * 1.4, top = b[1] - h * S;
  let s = blob(x, z, .3) + '<path d="M' + f1(b[0]) + ' ' + f1(top) + 'C' + f1(b[0] + w) + ' ' + f1(top + h * S * .45) + ' ' + f1(b[0] + w * .9) + ' ' + f1(b[1] - 2) + ' ' + f1(b[0]) + ' ' + f1(b[1]) + 'C' + f1(b[0] - w * .9) + ' ' + f1(b[1] - 2) + ' ' + f1(b[0] - w) + ' ' + f1(top + h * S * .45) + ' ' + f1(b[0]) + ' ' + f1(top) + 'Z" fill="' + PAPER + '" stroke="' + INK + '" stroke-width=".9"/>';
  for(let k = 0; k < 6; k++){ const yy = top + (b[1] - top) * (.3 + k * .11); s += stroke([b[0] + 1, yy], [b[0] + w * .55, yy - 3], .45, INK, .55); }
  return s;
}
for(const [x, z, h] of [[4.4, -7.5, 1.7], [4.7, -4, 1.2], [4.5, -.4, 1.9], [4.6, 3.4, 1.3], [4.4, 7, 1.6], [2.8, 11.6, 1.1], [-2.8, 11.4, 1.4], [-4.5, 10.4, 1.8]]) add(x + z + .1, shrub(x, z, h));
for(const x of [-2, 2]) add(x + GZ + .4, box(x - .22, x + .22, 0, .4, GZ + .2, GZ + .6, {hatchFront: true}) + shrub(x, GZ + .4, .9));
add(-.2 + 11.3, standing(-.3, 11.2, {saree: true}) + standing(.35, 11.5, {}));

items.sort((a, b) => a.key - b.key);
let art = items.map(i => i.svg).join('\n');

/* ---------- the orange notes, the sun and the arrows ---------- */
const note = (target, dx, dy, text, anchor = 'start', bend = 10) => {
  const t = Array.isArray(target) ? target : target;
  const lx = t[0] + dx, ly = t[1] + dy;
  const mx = (t[0] + lx) / 2 + (dy > 0 ? -bend : bend), my = (t[1] + ly) / 2;
  const end = [lx - (anchor === 'start' ? 3 : anchor === 'end' ? -3 : 0), ly + 1];
  return '<path d="M' + f1(t[0]) + ' ' + f1(t[1]) + 'Q' + f1(mx) + ' ' + f1(my) + ' ' + f1(end[0]) + ' ' + f1(end[1]) + '" fill="none" stroke="' + OR + '" stroke-width=".9"/>' +
    text.split('\n').map((l, i) => '<text x="' + f1(lx) + '" y="' + f1(ly + 4 + i * 12) + '" text-anchor="' + anchor + '" class="njsk-hand">' + l + '</text>').join('');
};
let notes = '';
notes += note(P(0, 2.7, ZB), 30, -34, 'our sign on\nthe back wall');
notes += note(P(-2.7, 2.1, ZB + .5), -50, -72, 'glass cabinets on\nthe back wall', 'end');
notes += note(P(-1.8, .55, -2.6), -112, -60, 'gold &amp; silver showcases,\nnecklaces behind glass', 'end');
notes += note(P(-HX, 1.7, -6.5), -40, -46, 'arched alcoves\nwith banners', 'end');
notes += note(P(.6, 2.75, -6), 110, -50, 'ceiling fans &amp;\nchandeliers');
notes += note(P(1.35, .9, 2.2), 120, 120, 'chairs for\ncustomers');
notes += note(P(0, 3.8, GZ), -100, 6, 'the main gate,\ndoors open wide', 'end');
notes += note(P(2.5, 1.25, 7.1), 50, 80, 'billing desk');
notes += note(P(3.05, 1.5, .2), 120, -40, 'staff behind\nthe counters');
notes += note(P(0, 1.5, 11.3), -120, 60, 'welcome in!');

// the bounds of the drawing
const nums = [...art.matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)].map(m => [parseFloat(m[1]), parseFloat(m[2])]);
let minX = Math.min(...nums.map(p => p[0])), maxX = Math.max(...nums.map(p => p[0])), minY = Math.min(...nums.map(p => p[1])), maxY = Math.max(...nums.map(p => p[1]));
const padX = 120, padT = 60, padB = 40;
const vx = minX - padX, vy = minY - padT, vw = maxX - minX + padX * 2, vh = maxY - minY + padT + padB;

// the shop's name and street along the bottom
notes += '<text x="' + f1(vx + 22) + '" y="' + f1(vy + vh - 18) + '" class="njsk-hand" font-size="15">Natraj Jewels · Eswaran Kovil St, Tiruppur</text>';

// paper with masking tape at the top corners
const paper = '<rect x="' + f1(vx + 4) + '" y="' + f1(vy + 4) + '" width="' + f1(vw - 8) + '" height="' + f1(vh - 8) + '" fill="' + PAPER + '" stroke="#E6DED0" stroke-width="1"/>';
const tape = (x, y, r) => '<rect x="' + f1(x - 26) + '" y="' + f1(y - 9) + '" width="52" height="18" fill="#E9DFC8" fill-opacity=".78" transform="rotate(' + r + ' ' + f1(x) + ' ' + f1(y) + ')"/>';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [vx, vy, vw, vh].map(f1).join(' ') + '" role="img" aria-label="A pen sketch of the Natraj Jewels shop: the gate, the counters along both sides and the back, the alcoves, stools and the sign">\n' +
  '<style>.njsk-hand{font-family:Caveat,"Segoe Print","Bradley Hand","Comic Sans MS",cursive;font-size:14px;fill:' + OR + ';paint-order:stroke;stroke:' + PAPER + ';stroke-width:4px;stroke-linejoin:round}</style>\n' +
  paper + '\n<g fill="none" stroke-linecap="round" stroke-linejoin="round">\n' + art + '\n</g>\n' + notes + '\n' + tape(vx + 30, vy + 10, -24) + tape(vx + vw - 30, vy + 10, 22) + '\n</svg>\n';
fs.writeFileSync(process.argv[2], svg);
console.log('ok', Math.round(vw), Math.round(vh), (svg.length / 1024).toFixed(0) + ' KB');
