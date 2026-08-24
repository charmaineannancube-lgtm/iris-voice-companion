import { useEffect, useRef } from "react";
import type { IrisState } from "@/lib/iris/useIris";

interface P {
  // home position on the head (3D)
  hx: number;
  hy: number;
  hz: number;
  // current screen position
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  bright: number;
  seed: number;
  feature: number; // 0 = skin, 1 = feature line (eyes/lips/brow)
}

interface Star {
  x: number;
  y: number;
  z: number;
  s: number;
  t: number;
}

const COUNT = 2600;
const STARS = 320;

/** Signed helper: is a point on the ellipsoid inside a facial cavity? */
function classify(x: number, y: number, z: number): number | null {
  // y: -1 top of head, +1 chin. x: -1 left, +1 right. z: +1 towards viewer.
  const front = z > -0.1;
  if (!front) return 0;

  const ax = Math.abs(x);

  // eye sockets
  const ex = ax - 0.36;
  const ey = y + 0.12;
  if (ex * ex * 3.2 + ey * ey * 12 < 0.1) return 1;

  // brows
  const bx = ax - 0.36;
  const by = y + 0.29;
  if (bx * bx * 2.4 + by * by * 46 < 0.09) return 1;

  // lips
  const lx = x;
  const ly = y - 0.42;
  if (lx * lx * 5.2 + ly * ly * 70 < 0.1) return 1;

  // nose ridge + tip
  if (ax < 0.075 && y > -0.16 && y < 0.26) return 1;
  const nx = x;
  const ny = y - 0.24;
  if (nx * nx * 24 + ny * ny * 55 < 0.09) return 1;

  return 0;
}

export function ParticleAvatar({ state, mouth }: { state: IrisState; mouth: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  const mouthRef = useRef(mouth);
  stateRef.current = state;
  mouthRef.current = mouth;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ---- build head point cloud on an ellipsoid ----
    const pts: P[] = [];
    let i = 0;
    let guard = 0;
    while (i < COUNT && guard < COUNT * 40) {
      guard++;
      // fibonacci-ish sphere sampling
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      let x = r * Math.cos(theta);
      let y = u;
      let z = r * Math.sin(theta);

      // sculpt: narrower jaw, taller cranium, flatter back
      const jaw = 1 - Math.max(0, y) * 0.42;
      x *= 0.74 * jaw;
      z *= 0.78 * jaw;
      y *= 1.02;
      if (z < 0) z *= 0.8;

      const kind = classify(x, y, z);
      if (kind === null) continue;
      // thin out the back of the head so the face reads
      if (z < -0.2 && Math.random() > 0.35) continue;

      pts.push({
        hx: x,
        hy: y,
        hz: z,
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0,
        vy: 0,
        size: kind === 1 ? 1.5 : 0.9 + Math.random() * 0.7,
        bright: kind === 1 ? 1 : 0.35 + Math.random() * 0.45,
        seed: Math.random() * Math.PI * 2,
        feature: kind,
      });
      i++;
    }

    // shoulders / neck haze
    for (let k = 0; k < 420; k++) {
      const t = Math.random();
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side * (0.15 + t * 1.15);
      const y = 1.25 + Math.pow(t, 1.6) * 0.75 + Math.random() * 0.1;
      pts.push({
        hx: x,
        hy: y,
        hz: (Math.random() - 0.5) * 0.5,
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0,
        vy: 0,
        size: 0.7 + Math.random() * 0.6,
        bright: 0.18 + Math.random() * 0.22,
        seed: Math.random() * Math.PI * 2,
        feature: 0,
      });
    }

    // ---- background galaxy ----
    const stars: Star[] = Array.from({ length: STARS }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: Math.random() * 0.9 + 0.1,
      s: Math.random() * 1.3 + 0.2,
      t: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    let time = 0;
    let assembled = 0; // 0 scattered -> 1 formed

    const render = () => {
      raf = requestAnimationFrame(render);
      time += 0.016;
      const s = stateRef.current;
      const visible = s !== "hidden" && s !== "muted";
      const target = visible ? 1 : 0;
      assembled += (target - assembled) * (visible ? 0.085 : 0.06);

      ctx.clearRect(0, 0, w, h);

      // galaxy nebula wash
      const neb = ctx.createRadialGradient(w * 0.5, h * 0.46, 10, w * 0.5, h * 0.5, h * 0.85);
      neb.addColorStop(0, `rgba(120, 40, 90, ${0.16 + assembled * 0.12})`);
      neb.addColorStop(0.45, "rgba(40, 22, 60, 0.10)");
      neb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, w, h);

      // drifting stars with parallax
      for (const st of stars) {
        st.x += 0.00008 * st.z;
        if (st.x > 1) st.x -= 1;
        st.t += 0.01 + st.z * 0.02;
        const tw = 0.45 + Math.sin(st.t) * 0.35;
        const px = st.x * w;
        const py = (st.y + Math.sin(time * 0.05 + st.t) * 0.004) * h;
        ctx.globalAlpha = tw * (0.35 + st.z * 0.55);
        ctx.fillStyle = st.z > 0.75 ? "#f4dbe8" : "#b9a6c9";
        ctx.beginPath();
        ctx.arc(px, py, st.s * st.z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // head transform
      const scale = Math.min(w, h) * 0.34;
      const cx = w / 2;
      const cy = h * 0.46;
      const yaw = Math.sin(time * 0.28) * 0.22 + (s === "thinking" ? Math.sin(time * 0.9) * 0.06 : 0);
      const pitch = Math.sin(time * 0.19) * 0.05 + (s === "thinking" ? 0.07 : 0);
      const breathe = Math.sin(time * 0.9) * 0.006;
      const speak = s === "speaking" ? mouthRef.current : 0;
      const pulse = s === "listening" ? 1 + Math.sin(time * 2.1) * 0.012 : 1;

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      ctx.globalCompositeOperation = "lighter";

      for (const p of pts) {
        let { hx, hy, hz } = p;

        // jaw drop for speech
        if (hy > 0.3) {
          const infl = Math.min(1, (hy - 0.3) / 0.8);
          hy += speak * 0.11 * infl;
          hz += speak * 0.02 * infl;
        }
        hy += breathe;

        // rotate Y then X
        const rx = hx * cosY + hz * sinY;
        const rz = -hx * sinY + hz * cosY;
        const ry = hy * cosP - rz * sinP;
        const rz2 = hy * sinP + rz * cosP;

        const persp = 1 / (1 + (0.55 - rz2) * 0.28);
        const tx = cx + rx * scale * persp * pulse;
        const ty = cy + ry * scale * persp * pulse;

        // scattered origin drifts through the galaxy
        const scatterR = Math.min(w, h) * 0.9;
        const sx = cx + Math.cos(p.seed + time * 0.12) * scatterR * (0.35 + (p.seed % 1) * 0.9);
        const sy = cy + Math.sin(p.seed * 1.7 + time * 0.1) * scatterR * (0.3 + (p.seed % 1) * 0.7);

        const ease = assembled * assembled * (3 - 2 * assembled);
        const gx = sx + (tx - sx) * ease;
        const gy = sy + (ty - sy) * ease;

        // subtle jitter so it never looks like a static mesh
        const j = s === "listening" ? 0.9 : s === "speaking" ? 1.5 : 0.6;
        const jx = Math.sin(time * 1.7 + p.seed * 3.1) * j;
        const jy = Math.cos(time * 1.5 + p.seed * 2.3) * j;

        p.vx += (gx + jx - p.x) * 0.14;
        p.vy += (gy + jy - p.y) * 0.14;
        p.vx *= 0.62;
        p.vy *= 0.62;
        p.x += p.vx;
        p.y += p.vy;

        const depth = 0.45 + (rz2 + 1) * 0.32;
        let alpha = p.bright * depth * (0.25 + ease * 0.75);
        if (p.feature === 1) alpha *= s === "listening" || s === "speaking" ? 1.25 : 1;

        const err = s === "error";
        const warm = p.feature === 1;
        ctx.fillStyle = err
          ? `rgba(255, 120, 110, ${alpha})`
          : warm
            ? `rgba(255, 186, 214, ${alpha})`
            : `rgba(214, 130, 175, ${alpha * 0.82})`;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * persp * (0.7 + ease * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }

      // eye light
      if (assembled > 0.5) {
        const glow = (s === "thinking" ? 0.5 + Math.sin(time * 4) * 0.35 : 0.75) * assembled;
        for (const side of [-1, 1]) {
          const ex = 0.36 * side;
          const ey = -0.12;
          const rx = ex * cosY;
          const rz = -ex * sinY + 0.62 * cosY;
          const ry = ey * cosP - rz * sinP;
          const rz2 = ey * sinP + rz * cosP;
          const persp = 1 / (1 + (0.55 - rz2) * 0.28);
          const px = cx + rx * scale * persp;
          const py = cy + ry * scale * persp;
          const g = ctx.createRadialGradient(px, py, 0, px, py, scale * 0.13);
          const c = s === "error" ? "255,120,110" : "255,175,205";
          g.addColorStop(0, `rgba(${c}, ${0.55 * glow})`);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, scale * 0.13, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = "source-over";
    };

    render();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative h-[520px] w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[10px] uppercase tracking-[0.45em] text-iris-dim">
        {state === "hidden" ? "always listening" : state}
      </div>
    </div>
  );
}
