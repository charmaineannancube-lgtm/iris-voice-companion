import type { IrisState } from "@/lib/iris/useIris";

const SHARDS = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  return { x: Math.cos(a) * 180, y: Math.sin(a) * 180, d: i * 12 };
});

export function Avatar({ state, mouth }: { state: IrisState; mouth: number }) {
  const visible = state !== "hidden" && state !== "muted";
  const isError = state === "error";
  const stroke = isError ? "var(--color-destructive)" : "var(--color-iris-glow)";

  return (
    <div className="relative flex h-[420px] w-full items-center justify-center">
      {/* ambient floor glow */}
      <div
        className="pointer-events-none absolute h-64 w-64 rounded-full blur-3xl transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle, ${isError ? "var(--color-destructive)" : "var(--color-iris-deep)"} 0%, transparent 70%)`,
          opacity: visible ? (state === "speaking" ? 0.55 : 0.32) : 0.08,
        }}
      />

      {!visible && (
        <p className="relative text-xs uppercase tracking-[0.4em] text-muted-foreground">
          {state === "muted" ? "asleep" : "say the wake word"}
        </p>
      )}

      {visible && (
        <div
          key={state === "building" ? "build" : "live"}
          className="relative"
          style={{ animation: state === "building" ? "var(--animate-build-in)" : undefined }}
        >
          {state === "building" &&
            SHARDS.map((s, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full"
                style={
                  {
                    background: "var(--color-iris-glow)",
                    "--sx": `${s.x}px`,
                    "--sy": `${s.y}px`,
                    animation: `shard-in 420ms ${s.d}ms ease-out both`,
                  } as React.CSSProperties
                }
              />
            ))}

          <svg
            width="260"
            height="340"
            viewBox="0 0 260 340"
            className="relative"
            style={{
              animation: state === "listening" ? "var(--animate-breathe)" : undefined,
              filter: `drop-shadow(0 0 22px ${isError ? "oklch(0.6 0.2 25 / 0.5)" : "oklch(0.62 0.22 350 / 0.45)"})`,
            }}
          >
            {/* shoulders */}
            <path
              d="M40 340 C 50 250, 100 225, 130 225 C 160 225, 210 250, 220 340 Z"
              fill="oklch(0.2 0.05 350)"
              stroke={stroke}
              strokeWidth="1.5"
            />
            {/* neck */}
            <rect x="118" y="196" width="24" height="36" rx="10" fill="oklch(0.24 0.07 350)" stroke={stroke} strokeWidth="1" />
            {/* head */}
            <ellipse cx="130" cy="130" rx="66" ry="80" fill="oklch(0.18 0.04 350)" stroke={stroke} strokeWidth="2" />
            {/* head contour lines */}
            <path d="M64 130 C 90 108, 170 108, 196 130" fill="none" stroke={stroke} strokeOpacity="0.35" strokeWidth="1" />
            <path d="M130 50 L130 210" stroke={stroke} strokeOpacity="0.18" strokeWidth="1" />
            {/* eyes */}
            <g>
              <ellipse
                cx="104"
                cy="126"
                rx="12"
                ry={state === "thinking" ? 3 : 7}
                fill={stroke}
                style={{ animation: state === "thinking" ? "var(--animate-think)" : undefined }}
              />
              <ellipse
                cx="156"
                cy="126"
                rx="12"
                ry={state === "thinking" ? 3 : 7}
                fill={stroke}
                style={{ animation: state === "thinking" ? "var(--animate-think)" : undefined }}
              />
            </g>
            {/* mouth — amplitude driven */}
            <rect
              x={130 - 26}
              y={172 - (state === "speaking" ? mouth * 12 : 1)}
              width="52"
              height={state === "speaking" ? 4 + mouth * 24 : 3}
              rx="8"
              fill={stroke}
              opacity={0.9}
            />
            {/* halo ring */}
            <circle
              cx="130"
              cy="130"
              r="96"
              fill="none"
              stroke={stroke}
              strokeOpacity={state === "listening" ? 0.5 : 0.2}
              strokeDasharray="6 12"
              strokeWidth="1.5"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 130 130"
                to="360 130 130"
                dur={state === "thinking" ? "5s" : "24s"}
                repeatCount="indefinite"
              />
            </circle>
          </svg>
        </div>
      )}

      <div className="absolute bottom-0 text-[11px] uppercase tracking-[0.35em] text-iris-dim">
        {state}
      </div>
    </div>
  );
}
