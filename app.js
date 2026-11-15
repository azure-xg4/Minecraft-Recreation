// BlockWorld: dependency-free voxel sandbox. TypeScript source; app.js is the browser build.
const $ = (id) => document.getElementById(id);
const canvas = $('game'), gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
if (!gl)
    throw new Error('This game needs a browser with WebGL 2 support.');
const W = 64, D = 64, H = 36, SIZE = W * D * H, idx = (x, y, z) => (y * D + z) * W + x;
const B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, LOG: 4, LEAVES: 5, SAND: 6, PLANKS: 7, GLASS: 8, WATER: 9, COAL: 10, IRON: 11, DUST: 12, LEVER: 13, TORCH: 14, LAMP: 15, REPEATER: 16, COMPARATOR: 17, PISTON: 18, STICKY: 19, OBSERVER: 20, REDSTONE: 21, BRICKS: 22, SNOW: 23, CACTUS: 24 };
const blockNames = ['Air', 'Grass Block', 'Dirt', 'Stone', 'Oak Log', 'Leaves', 'Sand', 'Oak Planks', 'Glass', 'Water', 'Coal Ore', 'Iron Ore', 'Redstone Dust', 'Lever', 'Redstone Torch', 'Redstone Lamp', 'Repeater', 'Comparator', 'Piston', 'Sticky Piston', 'Observer', 'Redstone Block', 'Bricks', 'Snow', 'Cactus'];
const hotbar = [1, 2, 3, 4, 5, 6, 7, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 8, 22, 23, 24];
const world = new Uint8Array(SIZE), power = new Uint8Array(SIZE), facing = new Uint8Array(SIZE), heightMap = new Int16Array(W * D), biomeMap = new Array(W * D);
const rs = new Set(), observerState = new Map();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (x, z) => { let h = Math.imul(x, 374761393) + Math.imul(z, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const smooth = (t) => t * t * (3 - 2 * t);
function noise(x, z) { const X = Math.floor(x), Z = Math.floor(z), u = smooth(x - X), v = smooth(z - Z); const a = hash(X, Z), b = hash(X + 1, Z), c = hash(X, Z + 1), d = hash(X + 1, Z + 1); return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; }
function fbm(x, z) { let sum = 0, amp = 1, f = 1, n = 0; for (let i = 0; i < 4; i++) {
    sum += noise(x * f, z * f) * amp;
    n += amp;
    amp *= .5;
    f *= 2;
} return sum / n; }
function get(x, y, z) { if (x < 0 || z < 0 || x >= W || z >= D || y < 0)
    return B.STONE; if (y >= H)
    return 0; return world[idx(x, y, z)]; }
const solid = (b) => b !== 0 && b !== B.WATER && b !== B.DUST && b !== B.TORCH && b !== B.LEVER && b !== B.REPEATER && b !== B.COMPARATOR;
function genWorld(seed = 20261111) {
    world.fill(0);
    rs.clear();
    for (let x = 0; x < W; x++)
        for (let z = 0; z < D; z++) {
            const climate = fbm(x / 35 + seed * .0001, z / 35), wet = fbm(x / 21 + seed * .0002, z / 21), ridge = Math.abs(fbm(x / 17 + 13, z / 17 + 7) - .5);
            let biome = climate < .23 ? 'SNOWY TAIGA' : climate > .76 ? (wet < .38 ? 'DESERT' : wet > .68 ? 'SAVANNA' : 'SAVANNA') : wet < .22 ? 'DESERT' : wet > .78 ? 'SWAMP' : wet > .58 ? 'FOREST' : 'PLAINS';
            if (ridge > .20 && climate > .25 && climate < .7)
                biome = 'MOUNTAINS';
            if (fbm(x / 48 + 21, z / 48 + 37) < .16)
                biome = 'OCEAN';
            let h = Math.floor(12 + (fbm(x / 22, z / 22) - .5) * 12 + (biome === 'MOUNTAINS' ? ridge * 24 : 0));
            if (biome === 'SWAMP')
                h = 10 + Math.floor(fbm(x / 13, z / 13) * 2);
            if (biome === 'OCEAN')
                h = 6;
            h = clamp(h, 5, H - 9);
            heightMap[x * D + z] = h;
            biomeMap[x * D + z] = biome;
            for (let y = 0; y <= h; y++) {
                let b = B.STONE;
                if (y === h)
                    b = biome === 'DESERT' || biome === 'SAVANNA' ? B.SAND : biome === 'SNOWY TAIGA' ? B.SNOW : B.GRASS;
                else if (y > h - 4)
                    b = biome === 'DESERT' || biome === 'SAVANNA' ? B.SAND : B.DIRT;
                world[idx(x, y, z)] = b;
            }
            if (biome === 'OCEAN')
                for (let y = h + 1; y < 10; y++)
                    world[idx(x, y, z)] = B.WATER;
            if (biome === 'SWAMP' && h < 12)
                world[idx(x, h + 1, z)] = B.WATER;
        }
    // ores, trees and cacti
    for (let x = 2; x < W - 2; x++)
        for (let z = 2; z < D - 2; z++) {
            const h = heightMap[x * D + z], bio = biomeMap[x * D + z], r = hash(x * 9 + seed, z * 7 - seed);
            for (let y = 2; y < h - 2; y++) {
                const q = hash(x * 13 + y * 7, z * 11 - y * 3);
                if (q > .986)
                    world[idx(x, y, z)] = B.COAL;
                else if (y < 16 && q > .978)
                    world[idx(x, y, z)] = B.IRON;
            }
            if (bio === 'DESERT' && r > .984) {
                for (let y = 1; y <= 2 + Math.floor(r * 3); y++)
                    world[idx(x, h + y, z)] = B.CACTUS;
            }
            else if ((bio === 'FOREST' || bio === 'SNOWY TAIGA' || bio === 'PLAINS' || bio === 'SAVANNA') && r > (bio === 'FOREST' ? .955 : .992)) {
                const tall = bio === 'SAVANNA' ? 5 : 4 + Math.floor(r * 3);
                for (let y = 1; y <= tall; y++)
                    world[idx(x, h + y, z)] = B.LOG;
                for (let dx = -2; dx <= 2; dx++)
                    for (let dz = -2; dz <= 2; dz++)
                        for (let dy = tall - 2; dy <= tall + 1; dy++)
                            if (Math.abs(dx) + Math.abs(dz) + (dy === tall + 1 ? 1 : 0) < 4) {
                                const xx = x + dx, zz = z + dz, yy = h + dy;
                                if (xx > 0 && zz > 0 && xx < W && zz < D && !world[idx(xx, yy, zz)])
                                    world[idx(xx, yy, zz)] = B.LEAVES;
                            }
            }
        }
}
genWorld();
// A small redstone teaching rig near the starting point.
const sx0 = Math.floor(W / 2), sz0 = Math.floor(D / 2), sy0 = heightMap[sx0 * D + sz0];
for (let x = sx0 - 3; x <= sx0 + 3; x++)
    for (let z = sz0 - 9; z <= sz0 - 7; z++)
        world[idx(x, sy0, z)] = B.PLANKS;
for (let y = sy0 + 1; y <= sy0 + 3; y++)
    for (let x = sx0 - 3; x <= sx0 + 3; x++)
        for (let z = sz0 - 9; z <= sz0 - 7; z++)
            world[idx(x, y, z)] = 0;
const demoLever = idx(sx0 - 2, sy0 + 1, sz0 - 8);
world[demoLever] = B.LEVER;
power[demoLever] = 1;
rs.add(demoLever);
for (let k = 1; k <= 4; k++) {
    const i = idx(sx0 - 2 + k, sy0 + 1, sz0 - 8);
    world[i] = B.DUST;
    rs.add(i);
}
const demoLamp = idx(sx0 + 3, sy0 + 1, sz0 - 8);
world[demoLamp] = B.LAMP;
rs.add(demoLamp);
const demoTorch = idx(sx0 + 2, sy0 + 1, sz0 - 6);
world[demoTorch] = B.TORCH;
power[demoTorch] = 1;
rs.add(demoTorch);
const demoDust = idx(sx0 + 3, sy0 + 1, sz0 - 6);
world[demoDust] = B.DUST;
rs.add(demoDust);
const demoLamp2 = idx(sx0 + 3, sy0 + 1, sz0 - 5);
world[demoLamp2] = B.LAMP;
rs.add(demoLamp2);
const vertex = `#version 300 es\nin vec2 aPos;out vec2 vUv;void main(){vUv=aPos*.5+.5;gl_Position=vec4(aPos,0.,1.);}`;
const fragment = `#version 300 es\nprecision highp float;precision highp int;in vec2 vUv;out vec4 outColor;uniform highp usampler2D uWorld;uniform vec3 uPos,uForward,uRight,uUp;uniform float uAspect,uTan,uTime;uniform int uW,uD,uH;\nvec3 palette(int b,ivec3 c){float n=fract(sin(dot(vec3(c),vec3(12.9898,78.233,37.719)))*43758.5453)*.12+.94; if(b==1)return vec3(.28,.62,.16)*n;if(b==2)return vec3(.43,.27,.13)*n;if(b==3)return vec3(.43,.45,.46)*n;if(b==4)return vec3(.35,.21,.10)*n;if(b==5)return vec3(.12,.39,.10)*n;if(b==6)return vec3(.79,.70,.42)*n;if(b==7)return vec3(.62,.40,.20)*n;if(b==8)return vec3(.55,.78,.86)*n;if(b==9)return vec3(.10,.34,.69)*n;if(b==10)return vec3(.16,.16,.17)*n;if(b==11)return vec3(.65,.48,.32)*n;if(b==12)return vec3(.85,.04,.04)*n;if(b==13)return vec3(.57,.39,.18)*n;if(b==14)return vec3(1.,.55,.12)*n;if(b==15)return vec3(1.,.79,.32)*n;if(b==16)return vec3(.57,.54,.49)*n;if(b==17)return vec3(.65,.65,.60)*n;if(b==18||b==19)return vec3(.56,.56,.58)*n;if(b==20)return vec3(.39,.48,.49)*n;if(b==21)return vec3(.55,.02,.02)*n;if(b==22)return vec3(.48,.23,.17)*n;if(b==23)return vec3(.9,.94,1.)*n;if(b==24)return vec3(.15,.48,.13)*n;return vec3(1.);}\nvoid main(){vec2 s=(vUv*2.-1.);vec3 rd=normalize(uForward+uRight*s.x*uAspect*uTan+uUp*s.y*uTan);vec3 ro=uPos;ivec3 cell=ivec3(floor(ro));ivec3 stepv=ivec3(sign(rd));vec3 inv=1./max(abs(rd),vec3(.00001));vec3 delta=inv;vec3 side=(vec3(cell)+step(vec3(0.),rd)-ro)*inv;side=abs(side);float t=0.;int block=0;int face=0;ivec3 hit=cell;for(int i=0;i<110;i++){if(cell.x<0||cell.z<0||cell.x>=uW||cell.z>=uD||cell.y<0||cell.y>=uH)break;block=int(texelFetch(uWorld,ivec2(cell.x+cell.z*uW,cell.y),0).r);if(block!=0){hit=cell;break;}if(side.x<side.y&&side.x<side.z){t=side.x;side.x+=delta.x;cell.x+=stepv.x;face=stepv.x>0?0:1;}else if(side.y<side.z){t=side.y;side.y+=delta.y;cell.y+=stepv.y;face=stepv.y>0?2:3;}else{t=side.z;side.z+=delta.z;cell.z+=stepv.z;face=stepv.z>0?4:5;}if(t>70.)break;}\n float daylight=clamp(sin(uTime*6.28318)*.65+.55,.10,1.);vec3 sky=mix(vec3(.018,.027,.065),vec3(.34,.65,.94),daylight);if(block==0){outColor=vec4(sky,1.);return;}vec3 base=palette(block,hit);float shade=face==2?1.0:face==3?.48:(face<2?.76:.65);float fog=exp(-t*.012);vec3 lit=base*shade*(.36+.64*daylight);if(block==14||block==15||block==21)lit+=base*.55;vec3 col=mix(sky,lit,fog);outColor=vec4(col,1.);}`;
function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) || 'Shader error'); return s; }
const prog = gl.createProgram();
gl.attachShader(prog, shader(gl.VERTEX_SHADER, vertex));
gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fragment));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog) || 'Link error');
gl.useProgram(prog);
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const ap = gl.getAttribLocation(prog, 'aPos');
gl.enableVertexAttribArray(ap);
gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
const tex = gl.createTexture();
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, tex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
const gpu = new Uint8Array(SIZE * 4);
function upload() { for (let i = 0; i < SIZE; i++) {
    const b = world[i], o = i * 4;
    gpu[o] = b;
    gpu[o + 1] = power[i];
    gpu[o + 2] = facing[i];
    gpu[o + 3] = 255;
} gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, W * D, H, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, gpu); }
upload();
const U = (n) => gl.getUniformLocation(prog, n);
const uniforms = { pos: U('uPos'), forward: U('uForward'), right: U('uRight'), up: U('uUp'), aspect: U('uAspect'), tan: U('uTan'), time: U('uTime'), w: U('uW'), d: U('uD'), h: U('uH'), world: U('uWorld') };
gl.uniform1i(uniforms.world, 0);
gl.uniform1i(uniforms.w, W);
gl.uniform1i(uniforms.d, D);
gl.uniform1i(uniforms.h, H);
const spawn = { x: W / 2 + .5, z: D / 2 + .5 };
let player = { x: spawn.x, y: heightMap[Math.floor(spawn.x) * D + Math.floor(spawn.z)] + 2, z: spawn.z, vy: 0, yaw: 0, pitch: 0, ground: false, health: 20, food: 20 };
let mode = 'survival', selected = 0, playing = false, chatOpen = false, debug = false, dayTime = .25, worldName = 'My World', seed = 20261111;
const keys = {};
let last = performance.now(), toastTimer = 0, redstoneClock = 0;
let inventory = new Map();
for (const b of hotbar)
    inventory.set(b, 64);
const hotbarEl = $('hotbar'), toastEl = $('toast'), chat = $('chat'), cmd = $('command'), messages = $('messages');
function toast(s) { toastEl.textContent = s; toastEl.classList.add('show'); toastTimer = 2.2; }
function message(s) { const d = document.createElement('div'); d.textContent = s; messages.appendChild(d); while (messages.children.length > 8)
    messages.firstChild?.remove(); }
function renderBar() { hotbarEl.innerHTML = ''; for (let i = 0; i < 9; i++) {
    const b = hotbar[(selected + i) % hotbar.length], el = document.createElement('div');
    el.className = 'slot' + (i === 0 ? ' active' : '');
    el.innerHTML = `<span class="num">${i + 1}</span><b>${blockNames[b]}</b>`;
    hotbarEl.appendChild(el);
} }
function setMode(m) { mode = m; $('modeLabel').textContent = m.toUpperCase(); toast('Gamemode: ' + m); }
function biomeAt(x, z) { return biomeMap[clamp(Math.floor(x), 0, W - 1) * D + clamp(Math.floor(z), 0, D - 1)] || 'PLAINS'; }
function playerCollides(x, y, z) { for (let xx = Math.floor(x - .28); xx <= Math.floor(x + .28); xx++)
    for (let yy = Math.floor(y); yy <= Math.floor(y + 1.8); yy++)
        for (let zz = Math.floor(z - .28); zz <= Math.floor(z + .28); zz++)
            if (solid(get(xx, yy, zz)))
                return true; return false; }
const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function raycast(max = 6) { const cp = { x: player.x, y: player.y + 1.62, z: player.z }, cpit = Math.cos(player.pitch), dir = { x: -Math.sin(player.yaw) * cpit, y: Math.sin(player.pitch), z: -Math.cos(player.yaw) * cpit }; let x = Math.floor(cp.x), y = Math.floor(cp.y), z = Math.floor(cp.z), px = x, py = y, pz = z; const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z), dx = Math.abs(1 / (dir.x || 1e-9)), dy = Math.abs(1 / (dir.y || 1e-9)), dz = Math.abs(1 / (dir.z || 1e-9)); let tx = (sx > 0 ? x + 1 - cp.x : cp.x - x) * dx, ty = (sy > 0 ? y + 1 - cp.y : cp.y - y) * dy, tz = (sz > 0 ? z + 1 - cp.z : cp.z - z) * dz, face = 0; for (let i = 0; i < 80; i++) {
    if (get(x, y, z) !== 0)
        return { x, y, z, px, py, pz, face };
    px = x;
    py = y;
    pz = z;
    if (tx < ty && tx < tz) {
        if (tx > max)
            return null;
        x += sx;
        tx += dx;
        face = sx > 0 ? 1 : 0;
    }
    else if (ty < tz) {
        if (ty > max)
            return null;
        y += sy;
        ty += dy;
        face = sy > 0 ? 3 : 2;
    }
    else {
        if (tz > max)
            return null;
        z += sz;
        tz += dz;
        face = sz > 0 ? 5 : 4;
    }
} return null; }
function updateBlock(x, y, z, b, fd = 0, doUpload = true) { if (x < 0 || z < 0 || x >= W || z >= D || y < 0 || y >= H)
    return; const i = idx(x, y, z); world[i] = b; power[i] = 0; facing[i] = fd; if ([12, 13, 14, 15, 16, 17, 18, 19, 20].includes(b))
    rs.add(i);
else
    rs.delete(i); if (doUpload)
    upload(); }
function mine() { const h = raycast(); if (!h)
    return; const i = idx(h.x, h.y, h.z), b = world[i]; if (mode === 'survival' && b !== 0)
    inventory.set(b, (inventory.get(b) || 0) + 1); updateBlock(h.x, h.y, h.z, 0); redstoneTick(); toast('Mined ' + blockNames[b]); }
function place() { const h = raycast(); if (!h)
    return; const b = hotbar[selected]; if (mode === 'survival' && (inventory.get(b) || 0) <= 0) {
    toast('No ' + blockNames[b] + ' left');
    return;
} if (get(h.px, h.py, h.pz) !== 0)
    return; const dir = dirs[h.face], fd = Math.abs(player.x - (h.px + .5)) > Math.abs(player.z - (h.pz + .5)) ? (player.x > h.px ? 1 : 0) : (player.z > h.pz ? 5 : 4); if ([13, 16, 17, 18, 19, 20].includes(b))
    updateBlock(h.px, h.py, h.pz, b, fd);
else
    updateBlock(h.px, h.py, h.pz, b); if (playerCollides(player.x, player.y, player.z)) {
    updateBlock(h.px, h.py, h.pz, 0);
    return;
} if (mode === 'survival')
    inventory.set(b, (inventory.get(b) || 1) - 1); redstoneTick(); }
function poweredBlock(x, y, z) { for (const d of dirs) {
    const xx = x + d[0], yy = y + d[1], zz = z + d[2], b = get(xx, yy, zz);
    if (inBounds(xx, yy, zz) && ((b === 13 || b === 14 || b === 12 || b === 16 || b === 17) && power[idx(xx, yy, zz)] > 0 || b === 21))
        return true;
} return false; }
function redstoneTick() {
    const dust = [];
    for (const i of rs)
        if (world[i] === 12)
            dust.push(i);
    const levels = new Map();
    for (const i of dust) {
        const x = i % W, y = Math.floor(i / (W * D)), z = Math.floor(i / W) % D;
        let v = 0;
        for (const d of dirs) {
            const xx = x + d[0], yy = y + d[1], zz = z + d[2];
            if (get(xx, yy, zz) === 13 && power[idx(xx, yy, zz)] || get(xx, yy, zz) === 14 && power[idx(xx, yy, zz)] || get(xx, yy, zz) === 21)
                v = 15;
        }
        levels.set(i, v);
    }
    for (let step = 0; step < 15; step++) {
        let changed = false;
        for (const i of dust) {
            const x = i % W, y = Math.floor(i / (W * D)), z = Math.floor(i / W) % D;
            let v = levels.get(i) || 0;
            for (const d of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
                const xx = x + d[0], yy = y + d[1], zz = z + d[2];
                if (get(xx, yy, zz) === 12) {
                    const ni = idx(xx, yy, zz), nv = Math.max(0, (levels.get(ni) || 0) - 1);
                    if (nv > v)
                        v = nv;
                }
            }
            if (v !== levels.get(i)) {
                levels.set(i, v);
                changed = true;
            }
        }
        if (!changed)
            break;
    }
    for (const i of dust)
        power[i] = levels.get(i) || 0;
    for (const i of rs) {
        const b = world[i], x = i % W, y = Math.floor(i / (W * D)), z = Math.floor(i / W) % D;
        if (b === 15) {
            power[i] = 0;
            for (const d of dirs) {
                const xx = x + d[0], yy = y + d[1], zz = z + d[2];
                if (get(xx, yy, zz) === 12 && power[idx(xx, yy, zz)] > 0 || get(xx, yy, zz) === 13 && power[idx(xx, yy, zz)])
                    power[i] = 1;
            }
        }
        else if (b === 18 || b === 19) {
            const on = poweredBlock(x, y, z);
            if (on && !power[i]) {
                const d = dirs[facing[i]];
                const tx = x + d[0], ty = y + d[1], tz = z + d[2];
                if (get(tx, ty, tz) === 0)
                    updateBlock(tx, ty, tz, 3);
            }
            else if (!on && power[i]) {
                const d = dirs[facing[i]], tx = x + d[0], ty = y + d[1], tz = z + d[2];
                if (get(tx, ty, tz) === 3)
                    updateBlock(tx, ty, tz, 0);
            }
            power[i] = on ? 1 : 0;
        }
        else if (b === 20) {
            const d = dirs[facing[i]], v = get(x + d[0], y + d[1], z + d[2]);
            const sig = v * 31 + (inBounds(x + d[0], y + d[1], z + d[2]) ? power[idx(x + d[0], y + d[1], z + d[2])] : 0), old = observerState.get(i);
            if (old !== undefined && old !== sig)
                power[i] = 3;
            observerState.set(i, sig);
            if (power[i] > 0)
                power[i]--;
        }
    }
    upload();
}
function inBounds(x, y, z) { return x >= 0 && z >= 0 && x < W && z < D && y >= 0 && y < H; }
function runCommand(raw) {
    const a = raw.trim().replace(/^\//, '').split(/\s+/), c = a[0]?.toLowerCase();
    const num = (s) => Number(s);
    try {
        switch (c) {
            case 'help':
                message('Commands: /gamemode survival|creative, /time set day|night|<0-24000>, /weather clear|rain, /tp x y z, /give block [amount], /setblock x y z block, /fill x1 y1 z1 x2 y2 z2 block, /seed, /spawn');
                break;
            case 'gamemode':
                if (a[1] === 'creative' || a[1] === 'survival')
                    setMode(a[1]);
                else
                    message('Usage: /gamemode survival|creative');
                break;
            case 'time':
                if (a[1] === 'set') {
                    dayTime = a[2] === 'day' ? .25 : a[2] === 'night' ? .75 : ((num(a[2]) || 0) % 24000) / 24000;
                    toast('Time updated');
                }
                break;
            case 'weather':
                toast('Weather: ' + (a[1] || 'clear') + ' (visual preview)');
                break;
            case 'tp':
                if (a.length >= 4) {
                    player.x = clamp(num(a[1]), 1, W - 2);
                    player.y = clamp(num(a[2]), 2, H - 3);
                    player.z = clamp(num(a[3]), 1, D - 2);
                    toast('Teleported');
                }
                else
                    message('Usage: /tp x y z');
                break;
            case 'give': {
                const b = resolveBlock(a[1]);
                if (!b) {
                    message('Unknown block: ' + a[1]);
                    break;
                }
                const n = clamp(num(a[2]) || 64, 1, 999);
                inventory.set(b, (inventory.get(b) || 0) + n);
                message(`Given ${n} ${blockNames[b]}`);
                break;
            }
            case 'setblock': {
                const [x, y, z] = a.slice(1, 4).map(num), b = resolveBlock(a[4]);
                if (!b || ![x, y, z].every(Number.isFinite)) {
                    message('Usage: /setblock x y z block');
                    break;
                }
                updateBlock(x, y, z, b);
                redstoneTick();
                break;
            }
            case 'fill': {
                const v = a.slice(1, 7).map(num), b = resolveBlock(a[7]);
                if (v.length !== 6 || !b) {
                    message('Usage: /fill x1 y1 z1 x2 y2 z2 block');
                    break;
                }
                let count = 0;
                for (let x = Math.min(v[0], v[3]); x <= Math.max(v[0], v[3]) && count < 12000; x++)
                    for (let y = Math.min(v[1], v[4]); y <= Math.max(v[1], v[4]) && count < 12000; y++)
                        for (let z = Math.min(v[2], v[5]); z <= Math.max(v[2], v[5]) && count < 12000; z++) {
                            updateBlock(x, y, z, b, 0, false);
                            count++;
                        }
                upload();
                message(`Filled ${count} blocks`);
                redstoneTick();
                break;
            }
            case 'seed':
                message('Seed: ' + seed);
                break;
            case 'spawn':
                player.x = spawn.x;
                player.z = spawn.z;
                player.y = heightMap[Math.floor(spawn.x) * D + Math.floor(spawn.z)] + 2;
                toast('Back at spawn');
                break;
            default: message('Unknown command. Try /help');
        }
    }
    catch {
        message('Command could not be completed');
    }
}
function resolveBlock(s) { if (!s)
    return 0; const q = s.toLowerCase().replace(/_/g, ' '); const byName = blockNames.findIndex(n => n.toLowerCase() === q); if (byName >= 0)
    return byName; const k = Object.keys(B).find(k => k.toLowerCase() === q); return k ? B[k] : Number.isFinite(Number(q)) ? clamp(Number(q), 0, 24) : 0; }
function look() { const cp = Math.cos(player.pitch), forward = [-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp], right = [Math.cos(player.yaw), 0, -Math.sin(player.yaw)], up = [-Math.sin(player.yaw) * Math.sin(player.pitch), Math.cos(player.pitch), -Math.cos(player.yaw) * Math.sin(player.pitch)]; return { forward, right, up }; }
function resize() { const w = Math.max(320, Math.floor(innerWidth * .72)), h = Math.max(180, Math.floor(innerHeight * .72)); canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
addEventListener('resize', resize);
resize();
function render(now) {
    const dt = Math.min(.04, (now - last) / 1000);
    last = now;
    redstoneClock += dt;
    if (playing && redstoneClock > .16) {
        redstoneClock = 0;
        redstoneTick();
    }
    dayTime = (dayTime + dt / 240) % 1;
    const sun = Math.max(.08, Math.sin(dayTime * 6.283) * .5 + .5);
    const v = look();
    gl.useProgram(prog);
    gl.uniform3f(uniforms.pos, player.x, player.y + 1.62, player.z);
    gl.uniform3f(uniforms.forward, v.forward[0], v.forward[1], v.forward[2]);
    gl.uniform3f(uniforms.right, v.right[0], v.right[1], v.right[2]);
    gl.uniform3f(uniforms.up, v.up[0], v.up[1], v.up[2]);
    gl.uniform1f(uniforms.aspect, canvas.width / canvas.height);
    gl.uniform1f(uniforms.tan, Math.tan(70 * Math.PI / 360));
    gl.uniform1f(uniforms.time, dayTime);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (playing && !chatOpen) {
        const f = keys.KeyW ? 1 : 0, s = keys.KeyS ? 1 : 0, r = keys.KeyD ? 1 : 0, l = keys.KeyA ? 1 : 0, spd = (keys.ShiftLeft ? 7 : 4.5), dx = (-Math.sin(player.yaw) * (f - s) + Math.cos(player.yaw) * (r - l)) * spd, dz = (-Math.cos(player.yaw) * (f - s) - Math.sin(player.yaw) * (r - l)) * spd;
        if (keys.Space && player.ground) {
            player.vy = 9;
            player.ground = false;
        }
        player.x += dx * dt;
        if (playerCollides(player.x, player.y, player.z))
            player.x -= dx * dt;
        player.z += dz * dt;
        if (playerCollides(player.x, player.y, player.z))
            player.z -= dz * dt;
        player.vy -= 24 * dt;
        player.y += player.vy * dt;
        if (playerCollides(player.x, player.y, player.z)) {
            player.y -= player.vy * dt;
            if (player.vy < 0)
                player.ground = true;
            player.vy = 0;
        }
        if (player.y < -5) {
            player.x = spawn.x;
            player.z = spawn.z;
            player.y = heightMap[Math.floor(spawn.x) * D + Math.floor(spawn.z)] + 2;
        }
    }
    const b = biomeAt(player.x, player.z);
     player.y += player.vy * dt;
        if (playerCollides(player.x, player.y, player.z)) {
            player.y -= player.vy * dt;
            if (player.vy < 0)
                player.ground = true;
            player.vy = 0;
        }
        if (player.y < -5) {
            player.x = spawn.x;
            player.z = spawn.z;
            player.y = heightMap[Math.floor(spawn.x) * D + Math.floor(spawn.z)] + 2;
        }
    }
    const b = biomeAt(player.x, player.z);
    $('biomeLabel').textContent = b;
    $('stats').innerHTML = `♥ ${mode === 'creative' ? '∞' : player.health}　◆ ${mode === 'creative' ? '∞' : player.food}　 <span id="modeLabel">${mode.toUpperCase()}</span>　${b}`;
    const hit = raycast();
    $('target').textContent = hit ? blockNames[world[idx(hit.x, hit.y, hit.z)]] + ' · ' + hit.x + ', ' + hit.y + ', ' + hit.z : '';
    if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0)
            toastEl.classList.remove('show');
    }
    if (debug)
        $('debug').textContent = `BlockWorld prototype\nXYZ ${player.x.toFixed(2)} ${player.y.toFixed(2)} ${player.z.toFixed(2)}\nBiome ${b}\nMode ${mode}\nRedstone components ${rs.size}\nFPS ${(1 / dt).toFixed(0)}\nSeed ${seed}`;
    requestAnimationFrame(render);
    $('stats').innerHTML = `♥ ${mode === 'creative' ? '∞' : player.health}　◆ ${mode === 'creative' ? '∞' : player.food}　 <span id="modeLabel">${mode.toUpperCase()}</span>　${b}`;
    const hit = raycast();
    $('target').textContent = hit ? blockNames[world[idx(hit.x, hit.y, hit.z)]] + ' · ' + hit.x + ', ' + hit.y + ', ' + hit.z : '';
    if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0)
            toastEl.classList.remove('show');
    }
    if (debug)
        $('debug').textContent = `BlockWorld prototype\nXYZ ${player.x.toFixed(2)} ${player.y.toFixed(2)} ${player.z.toFixed(2)}\nBiome ${b}\nMode ${mode}\nRedstone components ${rs.size}\nFPS ${(1 / dt).toFixed(0)}\nSeed ${seed}`;
    requestAnimationFrame(render);
}
requestAnimationFrame(render);
// UI and input
function start() { worldName = $('worldName').value || 'My World'; playing = true; $('menu').classList.add('hidden'); $('pause').classList.add('hidden'); $('hud').classList.remove('hidden'); canvas.requestPointerLock(); toast('Welcome to ' + worldName); }
$('play').addEventListener('click', start);
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('chosen')); b.classList.add('chosen'); setMode(b.dataset.mode); });
$('resume').onclick = () => { $('pause').classList.add('hidden'); canvas.requestPointerLock(); };
$('backMenu').onclick = () => { playing = false; $('pause').classList.add('hidden'); $('hud').classList.add('hidden'); $('menu').classList.remove('hidden'); document.exitPointerLock(); };
document.addEventListener('pointerlockchange', () => { if (playing && !document.pointerLockElement && !chatOpen)
    $('pause').classList.remove('hidden'); });
document.addEventListener('mousemove', e => { if (!document.pointerLockElement || chatOpen)
    return; player.yaw -= e.movementX * .0022; player.pitch = clamp(player.pitch - e.movementY * .0022, -1.5, 1.5); });
document.addEventListener('keydown', e => { if (e.code === 'Escape' && chatOpen) {
    chatOpen = false;
    chat.classList.remove('open');
    if (playing)
        canvas.requestPointerLock();
    return;
} if (e.code === 'KeyT' || e.code === 'Slash') {
    if (playing && !chatOpen) {
        e.preventDefault();
        chatOpen = true;
        chat.classList.add('open');
        cmd.value = e.code === 'Slash' ? '/' : '';
        cmd.focus();
        document.exitPointerLock();
    }
    return;
} if (chatOpen)
    return; keys[e.code] = true; if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= 9) {
        selected = (selected + n - 1) % hotbar.length;
        renderBar();
    }
} if (e.code === 'F3') {
    debug = !debug;
    $('debug').classList.toggle('hidden', !debug);
} if (e.code === 'KeyE') {
    selected = (selected + 1) % hotbar.length;
    renderBar();
} if (e.code === 'KeyQ') {
    selected = (selected + hotbar.length - 1) % hotbar.length;
    renderBar();
} });
document.addEventListener('keyup', e => keys[e.code] = false);
document.addEventListener('mousedown', e => { if (!playing || !document.pointerLockElement || chatOpen)
    return; if (e.button === 0)
    mine(); if (e.button === 2) {
    const h = raycast();
    if (h) {
        const b = world[idx(h.x, h.y, h.z)];
        if (b === 13) {
            const i = idx(h.x, h.y, h.z);
            power[i] = power[i] ? 0 : 1;
            redstoneTick();
        }
        else
            place();
    }
} });
document.addEventListener('contextmenu', e => e.preventDefault());
cmd.addEventListener('keydown', e => { if (e.key === 'Enter') {
    const line = cmd.value.trim();
    if (line) {
        message('> ' + line);
        runCommand(line);
    }
    cmd.value = '';
    chatOpen = false;
    chat.classList.remove('open');
    canvas.requestPointerLock();
}
else if (e.key === 'Escape') {
    chatOpen = false;
    chat.classList.remove('open');
    canvas.requestPointerLock();
} e.stopPropagation(); });
renderBar();
message('Welcome! Type /help for commands. Redstone demo blocks are scattered near spawn.');
