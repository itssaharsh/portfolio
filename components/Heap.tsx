"use client";

import { useEffect, useRef, useState } from "react";
import { HEAP } from "@/content/data";

type Dir = "up" | "down" | "left" | "right";
const GV: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1.1 }, down: { x: 0, y: 1.1 },
  left: { x: -1.1, y: 0 }, right: { x: 1.1, y: 0 },
};
const PAL = ["#8E8B7D", "#BFBCAC", "#7C7A6D", "#C9C5B4"];

/**
 * The floor of this site is one change. 421 blocks, the exact number of allocations a single
 * run used to make before kubernetes-sigs/resource-state-metrics pull request 102 brought it
 * down to 2.
 *
 * Everything here runs after first paint and nothing on the page depends on it.
 * matter-js is imported inside the effect so it lands in its own chunk.
 */
export default function Heap({ children }: { children?: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState<number>(HEAP.before);
  const [dir, setDir] = useState<Dir>("down");
  const [ready, setReady] = useState(false);
  const api = useRef<{ collect: () => void; allocate: () => void; gravity: (d: Dir) => void } | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const N = coarse ? 150 : HEAP.before;
    const INTERACTIVE = !coarse; // a canvas that grabs drags on a phone steals the scroll
    let stop = false;
    const off: Array<() => void> = [];

    (async () => {
      const M = (await import("matter-js")).default;
      if (stop) return;
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d")!;
      const DPR = Math.min(2, window.devicePixelRatio || 1);
      let W = 0, H = 0;

      const eng = M.Engine.create();
      eng.gravity.y = 1.1;
      eng.enableSleeping = true;

      let walls: Matter.Body[] = [];
      let blocks: (Matter.Body & { __c?: string; __survivor?: boolean; __delay?: number; __dying?: number })[] = [];
      let swept = false;
      let pusher: Matter.Body | null = null;
      let grabbed: Matter.Body | null = null;
      let grabC: Matter.Constraint | null = null;

      function sizeCanvas() {
        W = window.innerWidth; H = window.innerHeight;
        cv!.width = W * DPR; cv!.height = H * DPR;
        cv!.style.width = W + "px"; cv!.style.height = H + "px";
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        walls.forEach((w) => M.Composite.remove(eng.world, w));
        walls = [
          M.Bodies.rectangle(W / 2, H + 30, W * 2, 60, { isStatic: true }),
          M.Bodies.rectangle(W / 2, -30, W * 2, 60, { isStatic: true }), // ceiling, for upward gravity
          M.Bodies.rectangle(-30, H / 2, 60, H * 3, { isStatic: true }),
          M.Bodies.rectangle(W + 30, H / 2, 60, H * 3, { isStatic: true }),
        ];
        M.World.add(eng.world, walls);
      }
      const ceiling = (on: boolean) => { if (walls[1]) walls[1].collisionFilter.mask = on ? 0xffffffff : 0; };

      function allocate() {
        blocks.forEach((b) => M.Composite.remove(eng.world, b));
        blocks = []; swept = false;
        for (let i = 0; i < N; i++) {
          const b = M.Bodies.rectangle(40 + Math.random() * (W - 80), -40 - Math.random() * 900, 14, 14, {
            restitution: 0.16, friction: 0.42, frictionAir: 0.012,
            density: 0.0011, chamfer: { radius: 1 }, sleepThreshold: 70,
          }) as (typeof blocks)[number];
          b.__c = i < HEAP.after ? "#2A2BD6" : PAL[i % PAL.length];
          b.__survivor = i < HEAP.after;
          b.__delay = performance.now() + Math.random() * 900;
          M.Body.setStatic(b, true);
          blocks.push(b); M.World.add(eng.world, b);
        }
        ceiling(false);
        setTimeout(() => ceiling(true), 2600);
        setLive(N);
      }

      function collect() {
        if (swept) return;
        swept = true;
        let i = 0;
        blocks.forEach((b) => {
          if (b.__survivor) return;
          setTimeout(() => {
            M.Body.setStatic(b, false);
            M.Body.applyForce(b, b.position, { x: (Math.random() - 0.5) * 0.004, y: -0.01 - Math.random() * 0.006 });
            b.__dying = performance.now();
          }, i++ * 1.4);
        });
        setTimeout(() => {
          blocks = blocks.filter((b) => { if (b.__survivor) return true; M.Composite.remove(eng.world, b); return false; });
        }, 1400);
        setLive(HEAP.after);
      }

      function gravity(d: Dir) {
        const v = GV[d];
        eng.gravity.x = v.x; eng.gravity.y = v.y;
        // sleeping bodies ignore a gravity change, so wake them and shake them loose
        blocks.forEach((b) => {
          if (b.isStatic) return;
          M.Sleeping.set(b, false);
          M.Body.applyForce(b, b.position, {
            x: v.x * 2.6e-4 + (Math.random() - 0.5) * 8e-5,
            y: v.y * 2.6e-4 + (Math.random() - 0.5) * 8e-5,
          });
        });
      }
      api.current = { collect, allocate, gravity };

      // the cursor carries real velocity, so a fast move shoves instead of tunnelling through
      const px: number[] = [], py: number[] = [], pt: number[] = [];
      let pointerIn = false;
      if (INTERACTIVE) {
        pusher = M.Bodies.circle(-500, -500, 22, { isStatic: true, friction: 0 });
        M.World.add(eng.world, pusher);
        const onMove = (e: PointerEvent) => {
          pointerIn = true;
          px.push(e.clientX); py.push(e.clientY); pt.push(performance.now());
          if (px.length > 3) { px.shift(); py.shift(); pt.shift(); }
        };
        const onDown = (e: PointerEvent) => {
          const p = { x: e.clientX, y: e.clientY };
          const hit = M.Query.point(blocks, p)[0];
          if (!hit) return;
          grabbed = hit;
          M.Body.setStatic(hit, false);
          grabC = M.Constraint.create({
            pointA: p, bodyB: hit,
            pointB: { x: p.x - hit.position.x, y: p.y - hit.position.y },
            stiffness: 0.22, damping: 0.12, length: 0,
          });
          M.World.add(eng.world, grabC);
        };
        const onUp = () => {
          if (grabC) { M.World.remove(eng.world, grabC); grabC = null; }
          if (grabbed && px.length > 1) {
            const dt = Math.max(16, pt[pt.length - 1] - pt[0]);
            M.Body.setVelocity(grabbed, {
              x: ((px[px.length - 1] - px[0]) / dt) * 14,
              y: ((py[py.length - 1] - py[0]) / dt) * 14,
            });
          }
          grabbed = null;
        };
        const onLeave = () => { pointerIn = false; if (pusher) M.Body.setPosition(pusher, { x: -500, y: -500 }); };
        const onKey = (e: KeyboardEvent) => {
          // a shortcut that belongs to the browser is not ours to answer
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          const t = e.target as HTMLElement | null;
          if (t && t.closest("input,textarea,select,[contenteditable]")) return;
          if (e.key === "g" || e.key === "G") collect();
          if (e.key === "r" || e.key === "R") allocate();
          // The arrow keys are left to the browser. They used to turn gravity, which meant the
          // page could not be scrolled from the keyboard. The four buttons in the bar do that job.
        };
        addEventListener("pointermove", onMove, { passive: true });
        addEventListener("pointerdown", onDown);
        addEventListener("pointerup", onUp);
        addEventListener("pointerleave", onLeave);
        addEventListener("keydown", onKey);
        off.push(() => {
          removeEventListener("pointermove", onMove); removeEventListener("pointerdown", onDown);
          removeEventListener("pointerup", onUp); removeEventListener("pointerleave", onLeave);
          removeEventListener("keydown", onKey);
        });
      }

      const onResize = () => sizeCanvas();
      addEventListener("resize", onResize, { passive: true });
      off.push(() => removeEventListener("resize", onResize));

      let running = true;
      let frame = 0;
      // Only ever one frame in flight. Asking for a new one on every return to the tab used to
      // stack a second loop on the first, then a third, and the blocks ran that many times too fast.
      const kick = () => { if (!frame) frame = requestAnimationFrame(loop); };
      const onVis = () => { running = !document.hidden; if (running) kick(); };
      document.addEventListener("visibilitychange", onVis);
      off.push(() => document.removeEventListener("visibilitychange", onVis));

      function loop(t: number) {
        frame = 0;
        if (stop || !running) return;
        for (const b of blocks) if (b.isStatic && b.__delay && t > b.__delay) { M.Body.setStatic(b, false); b.__delay = 0; }
        if (pusher && pointerIn && px.length) {
          const nx = px[px.length - 1], ny = py[py.length - 1];
          const vdt = Math.max(8, pt[pt.length - 1] - pt[0]);
          M.Body.setPosition(pusher, { x: nx, y: ny });
          M.Body.setVelocity(pusher, { x: ((nx - px[0]) / vdt) * 16, y: ((ny - py[0]) / vdt) * 16 });
        }
        if (grabC && px.length) grabC.pointA = { x: px[px.length - 1], y: py[py.length - 1] };
        // the two that survived never sleep. nothing on the page says so.
        for (const b of blocks) if (b.__survivor) {
          M.Sleeping.set(b, false);
          M.Body.applyForce(b, b.position, { x: (Math.random() - 0.5) * 4e-6, y: -1.2e-6 });
        }
        M.Engine.update(eng, 1000 / 60); // 16.667 is a hair over what the library allows, and it says so in the console
        ctx.clearRect(0, 0, W, H);
        for (const b of blocks) {
          if (b.position.y > H + 80 || b.position.y < -1200) continue;
          ctx.save();
          ctx.translate(b.position.x, b.position.y);
          ctx.rotate(b.angle); // per body, so settling angles never snap to a bucket
          if (b.__survivor) { ctx.shadowColor = "#2A2BD6"; ctx.shadowBlur = 9; }
          if (b.__dying) ctx.globalAlpha = Math.max(0, 1 - (t - b.__dying) / 1200);
          ctx.fillStyle = b.__c!;
          ctx.fillRect(-7, -7, 14, 14);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        kick();
      }

      sizeCanvas();
      allocate();
      setReady(true);
      kick();
    })();

    return () => { stop = true; off.forEach((f) => f()); };
  }, []);

  return (
    <>
      <canvas id="heap" ref={canvasRef} aria-hidden="true" />
      <div className="fixed top-0 inset-x-0 z-8 flex items-center gap-3 px-3 h-[34px] border-b border-[#8F8C7E] bg-[rgba(171,168,154,.86)] backdrop-blur-[6px]">
        <a href="#top" aria-label="ST, Saharsh Tibrewala, back to the top"
           className="grid place-items-center size-[22px] shrink-0 rounded-full bg-inkpanel text-cad font-mono text-[9px] leading-none no-underline">ST</a>
        {/* the section links arrive from the server, so they are in the page before any of this runs */}
        {children}
        {/* the gauge is an instrument at the edge of the bar, not a banner across it */}
        <span className="heap-note ml-auto shrink-0 font-mono text-[11px] tracking-[.08em] uppercase text-ink-2 whitespace-nowrap">heap</span>
        <span className="heap-note w-[clamp(3.5rem,16vw,15rem)] h-[9px] bg-[#8F8C7E] relative overflow-hidden">
          <i className="absolute inset-y-0 left-0 bg-ultra transition-[width] duration-300"
             style={{ width: `${(live / HEAP.before) * 100}%` }} />
        </span>
        <span className="heap-note shrink-0 font-mono text-[11px] tracking-[.08em] uppercase text-ink-2 whitespace-nowrap">{live} live</span>
        <span className="heap-note flex gap-[2px] shrink-0" role="group" aria-label="Gravity direction">
          {(["up", "down", "left", "right"] as Dir[]).map((d) => (
            <button key={d} type="button"
              aria-pressed={dir === d}
              title={`Gravity ${d}`}
              disabled={!ready}
              onClick={() => { setDir(d); api.current?.gravity(d); }}
              className="size-6 grid place-items-center border border-[#8F8C7E] bg-chalk text-ink font-mono text-[10px] leading-none cursor-pointer disabled:opacity-40 aria-pressed:bg-inkpanel aria-pressed:text-cad aria-pressed:border-inkpanel">
              {{ up: "↑", down: "↓", left: "←", right: "→" }[d]}
            </button>
          ))}
        </span>
      </div>
    </>
  );
}
