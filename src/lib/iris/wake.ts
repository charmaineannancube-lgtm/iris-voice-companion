/** Wake-word scoring: normalized similarity between heard speech and the wake phrase. */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n] ?? n;
}

export interface WakeScore {
  /** 0..1 — how confident we are the wake phrase was spoken */
  score: number;
  /** best matching window from the heard phrase */
  matched: string;
  /** remaining speech after the wake phrase, if any */
  remainder: string;
}

/**
 * Slides a window of wake-word length across the heard phrase and keeps the
 * best match. Exact substring hits score 1; near-misses degrade smoothly, so a
 * sensitivity threshold can trade false positives against missed wakes.
 */
export function scoreWake(heard: string, wakeWord: string): WakeScore {
  const h = normalize(heard);
  const w = normalize(wakeWord);
  if (!h || !w) return { score: 0, matched: "", remainder: "" };

  if (h.includes(w)) {
    const idx = h.indexOf(w);
    return { score: 1, matched: w, remainder: h.slice(idx + w.length).trim() };
  }

  const words = h.split(" ");
  const wLen = w.split(" ").length;
  let best = 0;
  let bestIdx = 0;
  let bestLen = wLen;

  for (let size = Math.max(1, wLen - 1); size <= wLen + 1; size++) {
    for (let i = 0; i + size <= words.length; i++) {
      const window = words.slice(i, i + size).join(" ");
      const dist = levenshtein(window, w);
      const sim = 1 - dist / Math.max(window.length, w.length);
      if (sim > best) {
        best = sim;
        bestIdx = i;
        bestLen = size;
      }
    }
  }

  return {
    score: Math.max(0, best),
    matched: words.slice(bestIdx, bestIdx + bestLen).join(" "),
    remainder: words.slice(bestIdx + bestLen).join(" ").trim(),
  };
}

/** sensitivity 0 (strict) -> threshold 0.95; sensitivity 1 (permissive) -> 0.55 */
export function thresholdFor(sensitivity: number): number {
  return 0.95 - Math.max(0, Math.min(1, sensitivity)) * 0.4;
}
