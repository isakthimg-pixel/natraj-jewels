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

/* ---------- the shop: 20 x 80 ft drawn shorter, gate at the front (+z), U of counters, alcoves on the left wall ---------- */
const HX = 3.4, ZB = -7, ZF = 7, WH = 3;

// the ground: dots and tufts around the shop
let g = '';
for(let i = 0; i < 380; i++){
  const x = rr(-5, 6.5), z = rr(-9, 11.5);
  if(x > -HX - .3 && x < HX + .3 && z > ZB - .3 && z < ZF + .4) continue;
  if(Math.abs(x) < 1 && z > 7 && z < 10.6) continue;
  if(x < -HX - .4 && z < 6) continue;   // hidden behind the left wall anyway
  if(z < ZB - .4 && x < 4) continue;
  const p = P(x, 0, z); g += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + rr(.35, .7).toFixed(2) + '" fill="' + INK + '" fill-opacity=".55"/>';
}
for(let i = 0; i < 16; i++){
  const x = rr(3.9, 6), z = rr(-6, 10); const p = P(x, 0, z);
  g += lines([[p[0] - 2, p[1]], [p[0] - 1, p[1] - 4]], .6) + lines([[p[0], p[1]], [p[0] + .5, p[1] - 5]], .6) + lines([[p[0] + 2, p[1]], [p[0] + 2.5, p[1] - 3.5]], .6);
}
add(-100, g);

// the path to the gate: edges and stepping slabs
{
  let s = '';
  s += lines([P(-.95, 0, 7.4), P(-1.05, 0, 9), P(-.9, 0, 10.8)], .8) + lines([P(.95, 0, 7.4), P(1.05, 0, 9), P(.9, 0, 10.8)], .8);
  for(let z = 7.7; z < 10.6; z += .62) s += poly([P(-.7, 0, z), P(.7, 0, z), P(.7, 0, z + .42), P(-.7, 0, z + .42)], '#F1EBDF') + lines([P(-.7, 0, z), P(.7, 0, z), P(.7, 0, z + .42), P(-.7, 0, z + .42), P(-.7, 0, z)], .7);
  add(-90, s);
}

// the floor: a raised plinth with tiles
{
  let s = box(-HX - .25, HX + .25, -.25, 0, ZB - .25, ZF + .3, {hatchFront: false, w: 1.1});
  for(let z = ZB + 1; z < ZF; z += 1) s += stroke(P(-HX, 0, z), P(HX, 0, z), .45, INK, .45);
  for(let x = -HX + 1.2; x < HX; x += 1.2) s += stroke(P(x, 0, ZB), P(x, 0, ZF), .45, INK, .45);
  // plinth front edge shading
  for(let x = -HX; x < HX + .2; x += .28) s += stroke(P(x, -.22, ZF + .3), P(x + .14, -.03, ZF + .3), .45, INK, .5);
  add(-80, s);
}
// the maroon carpet runner down the aisle, with a border and a diamond pattern
{
  let s = poly([P(-.65, .01, -5.1), P(.65, .01, -5.1), P(.65, .01, ZF + .3), P(-.65, .01, ZF + .3)], '#F6F1E7');
  s += lines([P(-.65, .01, -5.1), P(.65, .01, -5.1), P(.65, .01, ZF + .3)], .8) + lines([P(-.65, .01, -5.1), P(-.65, .01, ZF + .3)], .8);
  s += lines([P(-.5, .01, -4.95), P(.5, .01, -4.95), P(.5, .01, ZF + .3)], .5) + lines([P(-.5, .01, -4.95), P(-.5, .01, ZF + .3)], .5);
  for(let z = -4.4; z < ZF; z += 1.1) s += lines([P(0, .01, z - .3), P(.25, .01, z), P(0, .01, z + .3), P(-.25, .01, z), P(0, .01, z - .3)], .5);
  add(-70, s);
}

// back wall, with the shop sign
longX(-HX - .25, HX + .25, 0, WH, ZB - .25, ZB, 1.4, {hatchFront: false, k: -.5}, (a, b) => {
  let s = '';
  for(let y = .5; y < WH; y += .5) s += stroke(P(Math.max(a, -HX), y, ZB), P(b, y, ZB), .4, INK, .35);   // courses of the wall
  return s;
});
{
  const x0 = -1.9, x1 = 1.9, y0 = 1.8, y1 = 2.55, z = ZB + .06;
  let s = box(x0, x1, y0, y1, ZB, z, {w: 1.1});
  s += lines([P(x0 + .08, y1 - .08, z), P(x1 - .08, y1 - .08, z), P(x1 - .08, y0 + .08, z), P(x0 + .08, y0 + .08, z), P(x0 + .08, y1 - .08, z)], .6);
  const o = P(0, (y0 + y1) / 2, z);
  s += '<text transform="matrix(' + C.toFixed(3) + ' .5 0 1 ' + f1(o[0]) + ' ' + f1(o[1]) + ')" text-anchor="middle" dominant-baseline="central" font-family="Georgia,serif" font-size="8" letter-spacing=".8" fill="' + INK + '">NATRAJ JEWELS</text>';
  add(-5.5, s);
}
// the left wall: tall, with arched alcoves, banners and little lamps between them
longZ(-HX - .25, -HX, 0, WH, ZB, ZF, 2, {k: -.3}, (a, b, i) => {
  const x = -HX, c = (a + b) / 2, v = (z, y) => P(x, y, z);
  let s = '';
  if(i >= 1 && i <= 5){
    const w = .62, y0 = .85, y1 = 2.05;
    const arch = [v(c - w, y0), v(c - w, y1), ...arcPts(c, y1, w, Math.PI, 0, 8, (zz, yy) => v(zz, y1 + (yy - y1) * -1 + 0)).slice(0), v(c + w, y0)];
    // the arch: straight sides, a round top
    const top = arcPts(0, 0, w, Math.PI, 0, 10, (u, t) => v(c + u, y1 + Math.abs(t)));
    s += poly([v(c - w, y0), ...top, v(c + w, y0)], '#F3EDE2') + lines([v(c - w, y0), ...top, v(c + w, y0)], .9) + lines([v(c - w, y0), v(c + w, y0)], .9);
    // the banner with a pointed foot and three rings
    const bw = .2, by0 = 1.05, by1 = 2.25;
    s += lines([v(c - bw, by1), v(c - bw, by0 + .15), v(c, by0), v(c + bw, by0 + .15), v(c + bw, by1)], .7);
    for(const yy of [1.45, 1.75, 2.05]){ const p = v(c, yy); s += '<ellipse cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" rx="2" ry="2.4" fill="none" stroke="' + INK + '" stroke-width=".6"/>'; }
  }
  for(let y = .5; y < WH; y += .5) s += stroke(v(a, y), v(a + .18, y), .4, INK, .3);
  return s;
});
// the right wall and the front walls are cut away low so the inside shows
longZ(HX, HX + .25, 0, .55, ZB, ZF + .3, 1.6, {hatchSide: true, k: .2});
longX(-HX - .25, -1.55, 0, .55, ZF, ZF + .3, 1, {hatchFront: true, k: .2});
longX(1.55, HX, 0, .55, ZF, ZF + .3, 1, {hatchFront: true, k: .2});

// the counters: a U along both sides and across the back, glass tops with jewellery on show
const jewels = (x0, x1, z0, z1, y) => {
  let s = '';
  const glass = [P(x0 + .08, y, z0 + .08), P(x1 - .08, y, z0 + .08), P(x1 - .08, y, z1 - .08), P(x0 + .08, y, z1 - .08)];
  s += lines([...glass, glass[0]], .45, INK, .6);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // a necklace and a couple of rings
  const n = arcPts(0, 0, .22, 0, Math.PI, 8, (u, t) => P(cx + u * .8, y, cz - .1 + t));
  s += lines(n, .6);
  for(const d of [-.35, .35]){ const p = P(cx + .12, y, cz + d); s += '<ellipse cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" rx="1.6" ry="1" fill="none" stroke="' + INK + '" stroke-width=".6"/>'; }
  return s;
};
const panels = (x1, z0, z1, y) => stroke(P(x1, .08, (z0 + z1) / 2), P(x1, y - .12, (z0 + z1) / 2), .5, INK, .7);
longZ(-2.6, -1.8, 0, .9, -5.2, 4.6, 1.4, {}, (a, b) => jewels(-2.6, -1.8, a, b, .9) + panels(-1.8, a, b, .9));
longZ(1.8, 2.6, 0, .9, -5.2, 4.2, 1.4, {hatchSide: true}, (a, b) => jewels(1.8, 2.6, a, b, .9));
longX(-2.6, 2.6, 0, .9, -6, -5.2, 1.3, {hatchFront: true}, (a, b) => jewels(a, b, -6, -5.2, .9));

// a billing desk with a computer, just inside the gate on the right
add(2.6 + 5.7, box(2.15, 2.95, 0, .75, 5.2, 6.2, {hatchFront: true}) + box(2.45, 2.55, .75, 1.2, 5.45, 5.95, {w: .9}) + stroke(P(2.4, .76, 5.25), P(2.4, .76, 5.4), .7));

// people: simple sketched figures
function person(x, z, o = {}){
  const p = P(x, o.sit ? .62 : 0, z), h = (o.sit ? .95 : 1.55) * S, hr = 3.2;
  const top = p[1] - h;
  let s = '';
  s += '<circle cx="' + f1(p[0]) + '" cy="' + f1(top + hr) + '" r="' + hr + '" fill="' + PAPER + '" stroke="' + INK + '" stroke-width=".9"/>';
  const sh = top + hr * 2 + 1.5, hip = top + h * (o.sit ? .62 : .55);
  s += '<path d="M' + f1(p[0] - 4.2) + ' ' + f1(hip) + 'C' + f1(p[0] - 4.6) + ' ' + f1(sh + 4) + ' ' + f1(p[0] - 3.5) + ' ' + f1(sh) + ' ' + f1(p[0]) + ' ' + f1(sh) + 'C' + f1(p[0] + 3.5) + ' ' + f1(sh) + ' ' + f1(p[0] + 4.6) + ' ' + f1(sh + 4) + ' ' + f1(p[0] + 4.2) + ' ' + f1(hip) + 'Z" fill="' + (o.dark ? '#5A524B' : PAPER) + '" stroke="' + INK + '" stroke-width=".9"/>';
  if(o.sit) s += lines([[p[0] - 2, hip], [p[0] + 3, hip + 2], [p[0] + 3.5, p[1] + 9]], .9) + lines([[p[0] + 1, hip], [p[0] + 5, hip + 1.5], [p[0] + 5.5, p[1] + 9]], .9);
  else s += lines([[p[0] - 1.8, hip], [p[0] - 2.2, p[1]]], 1) + lines([[p[0] + 1.8, hip], [p[0] + 2.4, p[1]]], 1);
  return s;
}
function stool(x, z){
  const t = P(x, .62, z), r = .2 * S * 1.22, ry = .2 * S * .7;
  let s = '<ellipse cx="' + f1(t[0]) + '" cy="' + f1(t[1]) + '" rx="' + f1(r) + '" ry="' + f1(ry) + '" fill="' + PAPER + '" stroke="' + INK + '" stroke-width=".9"/>';
  const b = P(x, 0, z);
  s += lines([[t[0] - r * .7, t[1] + 1], [b[0] - r * .8, b[1]]], .8) + lines([[t[0] + r * .7, t[1] + 1], [b[0] + r * .8, b[1]]], .8) + lines([[t[0], t[1] + ry], [b[0], b[1] + 2]], .8);
  return s;
}
for(const [x, z, who] of [[-1.4, -3.2, 1], [-1.4, -.6, 0], [-1.4, 2, 1], [1.4, -2, 0], [1.4, .8, 1], [0, -4.55, 0], [-.9, -4.55, 1]]){
  add(x + z + .05, stool(x, z) + (who ? person(x, z, {sit: true}) : ''));
}
// staff behind the counters, and a family walking in
add(-3 + -1.6 + .01, person(-3, -1.6, {dark: true}));
add(-3 + 2.6 + .01, person(-3, 2.6, {dark: true}));
add(3 + -2.6 + .01, person(3, -2.6, {dark: true}));
add(.6 + -6.5 + .01, person(.6, -6.5, {dark: true}));
add(-.25 + 8.6, person(-.25, 8.6) + person(.35, 8.9));

// the gate: two pillars, an arch board with the name, and the two doors folded open
add(-1.3 + 7.2 + .3, box(-1.55, -1.1, 0, 3.15, 7, 7.45, {hatchFront: true}));
add(1.3 + 7.2 + .3, box(1.1, 1.55, 0, 3.15, 7, 7.45, {hatchFront: true}));
{
  let s = box(-1.8, 1.8, 3.15, 3.75, 6.95, 7.5, {w: 1.15});
  const o = P(0, 3.45, 7.5);
  s += '<text transform="matrix(' + C.toFixed(3) + ' .5 0 1 ' + f1(o[0]) + ' ' + f1(o[1]) + ')" text-anchor="middle" dominant-baseline="central" font-family="Georgia,serif" font-size="6.4" letter-spacing=".5" fill="' + INK + '">NATRAJ JEWELS</text>';
  // a little dome on top
  const d = arcPts(0, 0, .55, Math.PI, 0, 10, (u, t) => P(u, 3.75 + Math.abs(t) * 1.1, 7.22));
  s += poly(d, PAPER) + lines(d, 1);
  const tip = P(0, 4.35, 7.22); s += lines([tip, [tip[0], tip[1] - 6]], .9) + '<circle cx="' + f1(tip[0]) + '" cy="' + f1(tip[1] - 7) + '" r="1.3" fill="' + INK + '"/>';
  add(7.9 + .5, s);
}
for(const side of [-1, 1]){
  const hx = side * 1.1, hz = 7.45, ang = 70 * Math.PI / 180, ex = hx - side * Math.cos(ang) * 1, ez = hz + Math.sin(ang) * 1, h = 2.7;
  const q = [P(hx, 0, hz), P(ex, 0, ez), P(ex, h, ez), P(hx, h, hz)];
  let s = poly(q) + lines([...q, q[0]], 1);
  const m = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const ip = [m(q[0], q[1], .18), m(q[0], q[1], .82)], it = [m(q[3], q[2], .18), m(q[3], q[2], .82)];
  s += lines([[ip[0][0], ip[0][1] - 8], [ip[1][0], ip[1][1] - 8], [it[1][0], it[1][1] + 8], [it[0][0], it[0][1] + 8], [ip[0][0], ip[0][1] - 8]], .6);
  add((hx + ex) / 2 + (hz + ez) / 2 + .6, s);
}
// lamps along the path and pointed shrubs (like cypress) around the shop
function lamp(x, z){
  const b = P(x, 0, z), t = P(x, 1.5, z);
  return lines([b, t], 1) + '<path d="M' + f1(t[0] - 3) + ' ' + f1(t[1]) + 'h6l-1 -6h-4z" fill="' + PAPER + '" stroke="' + INK + '" stroke-width=".8"/>' + lines([[t[0] - 2.5, t[1] - 6], [t[0], t[1] - 9], [t[0] + 2.5, t[1] - 6]], .8);
}
add(-1.5 + 9.6, lamp(-1.5, 9.6)); add(1.5 + 9.6, lamp(1.5, 9.6));
function shrub(x, z, h){
  const b = P(x, 0, z), w = 5 + h * 1.4, top = b[1] - h * S;
  return '<path d="M' + f1(b[0]) + ' ' + f1(top) + 'C' + f1(b[0] + w) + ' ' + f1(top + h * S * .45) + ' ' + f1(b[0] + w * .9) + ' ' + f1(b[1] - 2) + ' ' + f1(b[0]) + ' ' + f1(b[1]) + 'C' + f1(b[0] - w * .9) + ' ' + f1(b[1] - 2) + ' ' + f1(b[0] - w) + ' ' + f1(top + h * S * .45) + ' ' + f1(b[0]) + ' ' + f1(top) + 'Z" fill="' + PAPER + '" stroke="' + INK + '" stroke-width=".9"/>' + stroke([b[0] + 1, b[1] - 3], [b[0] + 1, top + 8], .5, INK, .6);
}
for(const [x, z, h] of [[4.4, -5.5, 1.6], [4.7, -2, 1.2], [4.5, 1.6, 1.8], [4.6, 5, 1.3], [2.6, 8.8, 1.1], [-2.6, 8.6, 1.4], [-4.4, 7.6, 1.7]]) add(x + z + .1, shrub(x, z, h));
// potted plants either side of the gate
for(const x of [-2, 2]){
  add(x + 7.9, box(x - .22, x + .22, 0, .4, 7.65, 8.05, {hatchFront: true}) + shrub(x, 7.85, .9).replace(/d="M([\d.-]+) ([\d.-]+)/, (m0, a, b) => 'd="M' + a + ' ' + (parseFloat(b)).toFixed(1)));
}

items.sort((a, b) => a.key - b.key);
let art = items.map(i => i.svg).join('\n');

/* ---------- the orange notes, the sun and the arrows ---------- */
const note = (target, dx, dy, text, anchor = 'start', bend = 10) => {
  const t = Array.isArray(target) ? target : target;
  const lx = t[0] + dx, ly = t[1] + dy;
  const mx = (t[0] + lx) / 2 + (dy > 0 ? -bend : bend), my = (t[1] + ly) / 2;
  const end = [lx - (anchor === 'start' ? 3 : anchor === 'end' ? -3 : 0), ly + 1];
  return '<path d="M' + f1(t[0]) + ' ' + f1(t[1]) + 'Q' + f1(mx) + ' ' + f1(my) + ' ' + f1(end[0]) + ' ' + f1(end[1]) + '" fill="none" stroke="' + OR + '" stroke-width=".9"/>' +
    '<circle cx="' + f1(t[0]) + '" cy="' + f1(t[1]) + '" r="1.4" fill="' + OR + '"/>' +
    text.split('\n').map((l, i) => '<text x="' + f1(lx) + '" y="' + f1(ly + 4 + i * 12) + '" text-anchor="' + anchor + '" class="njsk-hand">' + l + '</text>').join('');
};
let notes = '';
notes += note(P(0, 2.55, ZB), 30, -34, 'our sign on\nthe back wall');
notes += note(P(-2.2, .9, -1.5), -98, -44, 'gold &amp; silver\ncounters, glass tops', 'end');
notes += note(P(-HX, 1.6, -3), -40, -46, 'arched alcoves\nwith banners', 'end');
notes += note(P(1.4, .62, .8), 104, 128, 'stools for\ncustomers');
notes += note(P(0, 3.75, 7.5), -96, 6, 'the main gate,\ndoors open wide', 'end');
notes += note(P(2.55, 1.2, 5.7), 46, 76, 'billing desk');
notes += note(P(3, 1.5, -2.6), 108, -72, 'staff behind\nthe counters');
notes += note(P(.1, 1.5, 8.8), -118, 66, 'welcome in!');

// the bounds of the drawing
const nums = [...art.matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)].map(m => [parseFloat(m[1]), parseFloat(m[2])]);
let minX = Math.min(...nums.map(p => p[0])), maxX = Math.max(...nums.map(p => p[0])), minY = Math.min(...nums.map(p => p[1])), maxY = Math.max(...nums.map(p => p[1]));
const padX = 120, padT = 60, padB = 40;
const vx = minX - padX, vy = minY - padT, vw = maxX - minX + padX * 2, vh = maxY - minY + padT + padB;

// sun with its path arcs, top left; a turning arrow round the bottom right, like site notes
const sx = vx + 52, sy = vy + 52;
notes += '<circle cx="' + f1(sx) + '" cy="' + f1(sy) + '" r="6" fill="none" stroke="' + OR + '" stroke-width="1.1"/><circle cx="' + f1(sx) + '" cy="' + f1(sy) + '" r="1.8" fill="' + OR + '"/>';
notes += '<path d="M' + f1(sx + 20) + ' ' + f1(sy - 26) + 'A34 34 0 0 1 ' + f1(sx + 30) + ' ' + f1(sy + 18) + '" fill="none" stroke="' + INK + '" stroke-width=".9"/>';
notes += '<path d="M' + f1(sx - 22) + ' ' + f1(sy + 26) + 'A34 34 0 0 1 ' + f1(sx - 30) + ' ' + f1(sy - 16) + '" fill="none" stroke="' + INK + '" stroke-width=".9"/>';
const ax = vx + vw - 70, ay = vy + vh - 70;
notes += '<path d="M' + f1(ax + 38) + ' ' + f1(ay - 30) + 'A46 46 0 0 1 ' + f1(ax - 20) + ' ' + f1(ay + 40) + '" fill="none" stroke="' + INK + '" stroke-width=".9"/><path d="M' + f1(ax - 13) + ' ' + f1(ay + 33) + 'L' + f1(ax - 21) + ' ' + f1(ay + 40.5) + 'L' + f1(ax - 11) + ' ' + f1(ay + 43) + '" fill="none" stroke="' + INK + '" stroke-width=".9"/>';
notes += '<circle cx="' + f1(ax + 18) + '" cy="' + f1(ay + 14) + '" r="5" fill="none" stroke="' + OR + '" stroke-width="1"/><circle cx="' + f1(ax + 18) + '" cy="' + f1(ay + 14) + '" r="1.5" fill="' + OR + '"/>';
notes += '<text x="' + f1(vx + 22) + '" y="' + f1(vy + vh - 18) + '" class="njsk-hand" font-size="15">Natraj Jewels · Eswaran Kovil St, Tiruppur</text>';

// paper with masking tape at the top corners
const paper = '<rect x="' + f1(vx + 4) + '" y="' + f1(vy + 4) + '" width="' + f1(vw - 8) + '" height="' + f1(vh - 8) + '" fill="' + PAPER + '" stroke="#E6DED0" stroke-width="1"/>';
const tape = (x, y, r) => '<rect x="' + f1(x - 26) + '" y="' + f1(y - 9) + '" width="52" height="18" fill="#E9DFC8" fill-opacity=".78" transform="rotate(' + r + ' ' + f1(x) + ' ' + f1(y) + ')"/>';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [vx, vy, vw, vh].map(f1).join(' ') + '" role="img" aria-label="A pen sketch of the Natraj Jewels shop: the gate, the counters along both sides and the back, the alcoves, stools and the sign">\n' +
  '<style>.njsk-hand{font-family:Caveat,"Segoe Print","Bradley Hand","Comic Sans MS",cursive;font-size:14px;fill:' + OR + ';paint-order:stroke;stroke:' + PAPER + ';stroke-width:4px;stroke-linejoin:round}</style>\n' +
  paper + '\n<g fill="none" stroke-linecap="round" stroke-linejoin="round">\n' + art + '\n</g>\n' + notes + '\n' + tape(vx + 30, vy + 10, -24) + tape(vx + vw - 30, vy + 10, 22) + '\n</svg>\n';
fs.writeFileSync(process.argv[2], svg);
console.log('ok', Math.round(vw), Math.round(vh), (svg.length / 1024).toFixed(0) + ' KB');
