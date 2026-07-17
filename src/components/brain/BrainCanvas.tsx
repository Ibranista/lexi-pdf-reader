import type { ExpoWebGLRenderingContext } from 'expo-gl';

import type { PanResponderInstance } from 'react-native';

import { GLView } from 'expo-gl';
import { useEffect, useRef, useState } from 'react';
import { PanResponder } from 'react-native';
import * as THREE from 'three';

import { Box } from '@/components/atoms';

interface BrainCanvasProps {
  readonly booksDone: number;
  readonly onMilestone?: (label: string) => void;
  readonly onPct?: (pct: number) => void;
  readonly target: number;
}

interface Ctl {
  booksDone: number;
  target: number;
  onPct?: (pct: number) => void;
  onMilestone?: (label: string) => void;
  rotY: number;
  rotX: number;
  velY: number;
  drag: boolean;
  pct: number;
  stopped: boolean;
  dispose?: () => void;
}

const MILESTONE_TOASTS: Record<number, string> = {
  10: 'Milestone unlocked · Spark',
  25: 'Milestone unlocked · Foundation',
  50: 'Milestone unlocked · Momentum',
  75: 'Milestone unlocked · Scholar',
  100: 'Incredible — your brain is fully charged 🧠',
};

function brainShape(n: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  const M = THREE.MathUtils;
  const u = n.x * 5.5 + 1.4 * Math.sin(n.y * 4 + n.z * 3);
  const v = n.y * 5.5 + 1.4 * Math.sin(n.z * 4 + n.x * 3);
  const w = n.z * 5.5 + 1.4 * Math.sin(n.x * 4 + n.y * 3);
  const field =
    Math.sin(u + 1.6 * Math.sin(v)) * Math.cos(v + 1.4 * Math.sin(w)) + 0.5 * Math.sin(w * 1.7 + u);
  const ridge = 1 - Math.abs(Math.sin(field * 2.2));
  let r = 1 + 0.11 * (ridge - 0.5);
  const fis = Math.exp(-(n.x * n.x) / 0.006) * M.smoothstep(n.y, -0.2, 0.55);
  r -= 0.11 * fis;
  r += 0.03 * Math.abs(n.x); // hemisphere fullness
  out.set(n.x * r * 0.86, n.y * r * 0.74, n.z * r * 1.08);
  const tl =
    Math.exp(-Math.pow((out.y + 0.28) / 0.22, 2)) *
    Math.exp(-Math.pow((out.z - 0.25) / 0.55, 2)) *
    M.smoothstep(Math.abs(out.x), 0.25, 0.6);
  out.x += Math.sign(n.x) * 0.1 * tl;
  out.y -= 0.06 * tl;
  if (out.y < -0.42) out.y = -0.42 + (out.y + 0.42) * 0.35; // flat underside
  return out;
}

function makeDotTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - 31.5, y - 31.5) / 32;
      const a = d <= 0.3 ? 1 - 0.15 * (d / 0.3) : Math.max(0, 0.85 * (1 - (d - 0.3) / 0.7));
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.needsUpdate = true;
  return tex;
}

function createScene(gl: ExpoWebGLRenderingContext, ctl: Ctl) {
  THREE.ColorManagement.enabled = false;

  const W = gl.drawingBufferWidth;
  const H = gl.drawingBufferHeight;

  const canvasShim = {
    width: W,
    height: H,
    clientWidth: W,
    clientHeight: H,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
  };

  const renderer = new THREE.WebGLRenderer({
    canvas: canvasShim as unknown as HTMLCanvasElement,
    context: gl as unknown as WebGL2RenderingContext,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.useLegacyLights = true;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(34, W / H, 0.1, 60);
  cam.position.set(0, 0.15, 4.55);
  const group = new THREE.Group();
  scene.add(group);

  const tmp = new THREE.Vector3();
  const nv = new THREE.Vector3();

  const brainGeo = new THREE.SphereGeometry(1, 150, 110);
  const bPos = brainGeo.attributes.position as THREE.BufferAttribute;
  const bCount = bPos.count;
  for (let i = 0; i < bCount; i++) {
    nv.fromBufferAttribute(bPos, i).normalize();
    brainShape(nv, tmp);
    bPos.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  bPos.needsUpdate = true;
  brainGeo.computeVertexNormals();
  brainGeo.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(bCount).fill(0.5), 1));

  const cbGeo = new THREE.SphereGeometry(1, 56, 40);
  {
    const pa = cbGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) {
      nv.fromBufferAttribute(pa, i).normalize();
      const w = Math.abs(Math.sin(nv.y * 14 + 0.6 * Math.sin(nv.x * 6)));
      const r = 1 + 0.06 * (w - 0.5);
      pa.setXYZ(i, nv.x * r * 0.42, nv.y * r * 0.26, nv.z * r * 0.36);
    }
    pa.needsUpdate = true;
    cbGeo.computeVertexNormals();
  }
  const stemGeo = new THREE.CapsuleGeometry(0.09, 0.4, 6, 12);
  for (const gm of [cbGeo, stemGeo]) {
    gm.setAttribute(
      'aAO',
      new THREE.BufferAttribute(new Float32Array(gm.attributes.position.count).fill(0.5), 1),
    );
  }

  scene.add(new THREE.AmbientLight(0x30355f, 1.1));
  const dl = new THREE.DirectionalLight(0x9fb4ff, 1.4);
  dl.position.set(2.5, 3, 4);
  scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0x5b3fd4, 0.7);
  dl2.position.set(-3, -1, -2);
  scene.add(dl2);

  const fluidMat = new THREE.ShaderMaterial({
    uniforms: {
      uColA: { value: new THREE.Color('#4C3FD4') },
      uColB: { value: new THREE.Color('#58C8FF') },
      uFill: { value: -0.75 },
      uTime: { value: 0 },
      uGlow: { value: 1 },
    },
    vertexShader:
      'varying vec3 vW;varying vec3 vN;void main(){vec4 wp=modelMatrix*vec4(position,1.0);vW=wp.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*wp;}',
    fragmentShader: [
      'uniform vec3 uColA;uniform vec3 uColB;uniform float uFill;uniform float uTime;uniform float uGlow;',
      'varying vec3 vW;varying vec3 vN;',
      'void main(){',
      'float wave=0.028*sin(vW.x*9.0+uTime*2.2)+0.022*sin(vW.z*8.0-uTime*1.7)+0.012*sin((vW.x+vW.z)*14.0+uTime*3.1);',
      'float lvl=uFill+wave;',
      'if(vW.y>lvl) discard;',
      'float band=smoothstep(lvl-0.4,lvl,vW.y);',
      'float dep=smoothstep(-0.9,1.0,vW.y);',
      'vec3 vd=normalize(cameraPosition-vW);',
      'float fres=pow(1.0-abs(dot(normalize(vN),vd)),1.6);',
      'vec3 c=mix(uColA,uColB,band*0.8+dep*0.2);',
      'c+=uColB*fres*0.45;',
      'c*=(0.55+0.75*band)*uGlow;',
      'float men=smoothstep(0.05,0.0,abs(vW.y-lvl));',
      'c+=uColB*men*1.3;',
      'float flick=0.95+0.05*sin(uTime*7.0+vW.x*20.0);',
      'gl_FragColor=vec4(c*flick,0.82+men*0.18);}',
    ].join('\n'),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const glassMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color('#9B8CFF') } },
    vertexShader:
      'attribute float aAO;varying vec3 vN;varying vec3 vV;varying float vAO;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;vAO=aAO;gl_Position=projectionMatrix*mv;}',
    fragmentShader:
      'uniform vec3 uCol;varying vec3 vN;varying vec3 vV;varying float vAO;void main(){vec3 N=normalize(vN);vec3 V=normalize(vV);float f=pow(1.0-abs(dot(N,V)),2.2);vec3 L=normalize(vec3(0.45,0.85,0.55));float dif=pow(max(dot(N,L),0.0),1.6);float crev=0.12+0.88*smoothstep(0.28,0.78,vAO);vec3 c=uCol*(f*1.35+0.05)+uCol*dif*0.36*crev;gl_FragColor=vec4(c,(f*0.72+0.06+dif*0.24)*(0.45+0.55*crev));}',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0x39406e,
    roughness: 0.42,
    metalness: 0.1,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });

  const addPair = (geo: THREE.BufferGeometry, pos?: THREE.Vector3, rx?: number) => {
    const fl = new THREE.Mesh(geo, fluidMat);
    fl.scale.setScalar(0.965);
    fl.renderOrder = 1;
    const sh = new THREE.Mesh(geo, shadeMat);
    sh.renderOrder = 2;
    const gm = new THREE.Mesh(geo, glassMat);
    gm.renderOrder = 3;
    for (const m of [fl, sh, gm]) {
      if (pos) m.position.copy(pos);
      if (rx) m.rotation.x = rx;
      group.add(m);
    }
  };
  addPair(brainGeo);
  addPair(cbGeo, new THREE.Vector3(0, -0.46, -0.6)); // tucked under the occipital lobe
  addPair(stemGeo, new THREE.Vector3(0, -0.54, -0.22), 0.45);

  const pl = new THREE.PointLight(0x58c8ff, 0, 3.5);
  scene.add(pl);

  interface BrainPath {
    dirs: THREE.Vector3[];
    pts: THREE.Vector3[];
    line: THREE.Line;
    mat: THREE.LineBasicMaterial;
  }
  const paths: BrainPath[] = [];
  for (let i = 0; i < 26; i++) {
    const a = new THREE.Vector3().randomDirection();
    const b = a
      .clone()
      .applyAxisAngle(new THREE.Vector3().randomDirection(), 0.7 + Math.random() * 1.0)
      .normalize();
    const perp = new THREE.Vector3().crossVectors(a, b).normalize();
    const ph = Math.random() * 6.28;
    const am = 0.05 + Math.random() * 0.07;
    const dirs: THREE.Vector3[] = [];
    for (let k = 0; k < 48; k++) {
      const f = k / 47;
      const d = a.clone().lerp(b, f).normalize();
      d.addScaledVector(perp, am * Math.sin(f * 9 + ph) * Math.sin(Math.PI * f)).normalize();
      dirs.push(d);
    }
    const mat = new THREE.LineBasicMaterial({
      color: '#9B8CFF',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pts = dirs.map((d) => brainShape(d, tmp).clone().multiplyScalar(1.022));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
    line.renderOrder = 4;
    group.add(line);
    paths.push({ dirs, pts, line, mat });
  }

  const dotTex = makeDotTexture();
  interface Pulse {
    segs: { s: THREE.Sprite; m: THREE.SpriteMaterial }[];
    active: boolean;
    path: number;
    t: number;
    sp: number;
    boost: boolean;
  }
  const sprites: Pulse[] = [];
  for (let i = 0; i < 14; i++) {
    const segs: Pulse['segs'] = [];
    for (let k = 0; k < 4; k++) {
      const m = new THREE.SpriteMaterial({
        map: dotTex,
        color: '#9DB4FF',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const s = new THREE.Sprite(m);
      s.scale.setScalar(0.05);
      s.renderOrder = 5;
      s.visible = false;
      group.add(s);
      segs.push({ s, m });
    }
    sprites.push({ segs, active: false, path: 0, t: 0, sp: 0.6, boost: false });
  }

  const NPT = 240;
  const posArr = new Float32Array(NPT * 3);
  const seedArr = new Float32Array(NPT);
  for (let i = 0; i < NPT; i++) {
    nv.randomDirection();
    brainShape(nv, tmp);
    tmp.multiplyScalar(0.9 * Math.cbrt(Math.random()));
    posArr[i * 3] = tmp.x;
    posArr[i * 3 + 1] = tmp.y;
    posArr[i * 3 + 2] = tmp.z;
    seedArr[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seedArr, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOp: { value: 0 },
      uFill: { value: -0.75 },
      uCol: { value: new THREE.Color('#58C8FF') },
    },
    vertexShader:
      'attribute float aSeed;uniform float uTime;varying float vS;varying float vY;void main(){vec3 p=position;p.y=-0.8+mod(p.y+0.8+uTime*(0.04+0.05*aSeed),1.7);vec4 wp=modelMatrix*vec4(p,1.0);vY=wp.y;vec4 mv=viewMatrix*wp;gl_Position=projectionMatrix*mv;vS=aSeed;gl_PointSize=(9.0*(0.3+0.7*aSeed))*(3.0/max(1.0,-mv.z));}',
    fragmentShader:
      'uniform vec3 uCol;uniform float uOp;uniform float uFill;varying float vS;varying float vY;void main(){float d=length(gl_PointCoord-0.5);float a=smoothstep(0.5,0.05,d)*uOp*(0.35+0.65*vS)*smoothstep(uFill+0.03,uFill-0.2,vY);gl_FragColor=vec4(uCol,a);}',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.renderOrder = 2;
  group.add(points);

  const B = { fill: 0, boost: 0, spT: 0, waveT: 0, armed: false };

  const spawnPulse = (boost: boolean) => {
    const free = sprites.find((x) => !x.active);
    if (!free) return;
    const lit = Math.max(1, Math.floor(B.fill * paths.length + 1));
    free.path = Math.floor(Math.random() * Math.min(lit, paths.length));
    free.t = 0;
    free.sp = 0.5 + Math.random() * 0.7;
    free.active = true;
    free.boost = boost;
    for (const x of free.segs) {
      x.s.visible = true;
      x.m.opacity = 0;
    }
  };

  const tick = (t: number, dt: number) => {
    const M = THREE.MathUtils;
    const target = Math.min(1, ctl.booksDone / Math.max(1, ctl.target));
    B.fill += (target - B.fill) * Math.min(1, dt * 1.1);
    if (Math.abs(target - B.fill) < 0.0006) {
      B.fill = target;
      B.armed = true;
    }
    const fill = B.fill;
    const p = Math.floor(fill * 100 + 0.002);
    if (p !== ctl.pct) {
      for (const m of [10, 25, 50, 75, 100]) {
        if (ctl.pct < m && p >= m) {
          B.boost = 1;
          for (let i = 0; i < 8; i++) spawnPulse(true);
          if (B.armed) ctl.onMilestone?.(MILESTONE_TOASTS[m]);
        }
      }
      ctl.pct = p;
      ctl.onPct?.(p);
    }
    B.boost *= Math.exp(-dt * 1.6);
    const full = fill >= 0.999;
    const breathe = full ? 0.22 * (0.5 + 0.5 * Math.sin(t * 2.2)) : 0;
    const lvlY = fill <= 0.001 ? -1.2 : -0.5 + fill * 1.3; // fluid rises through the cerebrum
    fluidMat.uniforms.uTime.value = t;
    fluidMat.uniforms.uFill.value = lvlY;
    fluidMat.uniforms.uGlow.value = 0.9 + 0.35 * fill + B.boost * 0.9 + breathe;
    pMat.uniforms.uTime.value = t;
    pMat.uniforms.uFill.value = lvlY;
    pMat.uniforms.uOp.value = fill * 0.85 + B.boost * 0.3;
    pl.position.set(0, lvlY + 0.1, 0.3);
    pl.intensity = fill * 1.6 + B.boost * 2 + breathe;
    paths.forEach((pa, i) => {
      const thr = (i / paths.length) * 0.92;
      let tgt = fill > thr ? Math.min(1, (fill - thr) * 5) * (0.2 + 0.4 * fill) : 0;
      if (full) tgt = 0.45 + 0.3 * Math.sin(t * 2.2 + i * 0.7);
      pa.mat.opacity += (tgt - pa.mat.opacity) * Math.min(1, dt * 2.5);
    });
    B.spT += dt;
    const iv = fill < 0.02 ? 1e9 : M.lerp(1.6, 0.22, fill);
    if (B.spT > iv) {
      B.spT = 0;
      spawnPulse(false);
    }
    if (full) {
      B.waveT += dt;
      if (B.waveT > 1.1) {
        B.waveT = 0;
        for (let i = 0; i < 4; i++) spawnPulse(true);
      }
    }
    for (const sp of sprites) {
      if (!sp.active) continue;
      sp.t += sp.sp * dt;
      if (sp.t >= 1.14) {
        sp.active = false;
        for (const x of sp.segs) {
          x.s.visible = false;
          x.m.opacity = 0;
        }
        continue;
      }
      const pts = paths[sp.path].pts;
      const n = pts.length;
      sp.segs.forEach((seg, k) => {
        const tt = sp.t - k * 0.035;
        if (tt < 0 || tt > 1) {
          seg.m.opacity = 0;
          return;
        }
        const fi = tt * (n - 1);
        const i0 = Math.floor(fi);
        seg.s.position.copy(pts[i0]).lerp(pts[Math.min(n - 1, i0 + 1)], fi - i0);
        const env = Math.sin(tt * Math.PI);
        seg.m.opacity = env * (sp.boost ? 1 : 0.8) * [1, 0.45, 0.22, 0.1][k];
        seg.s.scale.setScalar((0.04 + 0.032 * env) * [1, 0.78, 0.58, 0.42][k]);
      });
    }
    if (!ctl.drag) {
      ctl.rotY += dt * 0.1 + ctl.velY;
      ctl.velY *= Math.exp(-dt * 2.5);
    }
    group.rotation.y = ctl.rotY;
    group.rotation.x = ctl.rotX + 0.03 * Math.sin(t * 0.9);
    group.position.y = 0.03 * Math.sin(t * 1.3);
    group.scale.setScalar(1 + 0.05 * B.boost);
  };

  let raf = 0;
  let last = typeof performance === 'undefined' ? Date.now() : performance.now();
  const loop = (now: number) => {
    if (ctl.stopped) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tick(now / 1000, dt);
    renderer.render(scene, cam);
    gl.endFrameEXP();
  };
  raf = requestAnimationFrame(loop);

  ctl.dispose = () => {
    cancelAnimationFrame(raf);
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of mats) {
        const mapped = m as THREE.Material & { map?: THREE.Texture };
        if (mapped.map) mapped.map.dispose();
        m.dispose();
      }
    });
    renderer.dispose();
  };
}

export function BrainCanvas({ booksDone, onMilestone, onPct, target }: BrainCanvasProps) {
  const ctlRef = useRef<Ctl>({
    booksDone,
    target,
    onPct,
    onMilestone,
    rotY: 0.55,
    rotX: 0.05,
    velY: 0,
    drag: false,
    pct: 0,
    stopped: false,
  });

  useEffect(() => {
    const ctl = ctlRef.current;
    ctl.booksDone = booksDone;
    ctl.target = target;
    ctl.onPct = onPct;
    ctl.onMilestone = onMilestone;
  });

  useEffect(() => {
    const ctl = ctlRef.current;
    ctl.stopped = false;
    return () => {
      ctl.stopped = true;
      ctl.dispose?.();
    };
  }, []);

  const [pan, setPan] = useState<PanResponderInstance | null>(null);

  useEffect(() => {
    setPan(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          ctlRef.current.drag = true;
        },
        onPanResponderMove: (_e, g) => {
          const ctl = ctlRef.current;
          ctl.rotY += g.vx * 0.11;
          ctl.velY = g.vx * 0.055;
          ctl.rotX = Math.max(-0.5, Math.min(0.7, ctl.rotX + g.vy * 0.08));
        },
        onPanResponderRelease: () => {
          ctlRef.current.drag = false;
        },
        onPanResponderTerminate: () => {
          ctlRef.current.drag = false;
        },
      }),
    );
  }, []);

  return (
    <Box style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} {...(pan?.panHandlers ?? {})}>
      <GLView
        onContextCreate={(gl: ExpoWebGLRenderingContext) => {
          if (ctlRef.current.stopped) return;
          createScene(gl, ctlRef.current);
        }}
        style={{ flex: 1 }}
      />
    </Box>
  );
}
