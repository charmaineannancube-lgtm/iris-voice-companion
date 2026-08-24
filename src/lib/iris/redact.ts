import type { LogEntry } from "./useIris";

export interface RedactionOptions {
  redactEmails: boolean;
  redactNumbers: boolean;
  redactNotes: boolean;
}

export interface RedactionHit {
  field: string;
  kind: string;
  before: string;
  after: string;
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const LONG_NUMBER = /\b\d[\d\s-]{4,}\b/g;

export function redactValue(
  value: string,
  field: string,
  opts: RedactionOptions,
  hits: RedactionHit[],
): string {
  let out = value;
  if (opts.redactEmails && EMAIL.test(out)) {
    const before = out;
    out = out.replace(EMAIL, "[email redacted]");
    hits.push({ field, kind: "email", before, after: out });
  }
  if (opts.redactNumbers && LONG_NUMBER.test(out)) {
    const before = out;
    out = out.replace(LONG_NUMBER, "[number redacted]");
    hits.push({ field, kind: "number sequence", before, after: out });
  }
  return out;
}

export interface RedactedLog {
  at: string;
  level: string;
  event: string;
  detail: string;
}

export function redactLogs(
  logs: LogEntry[],
  opts: RedactionOptions,
): { rows: RedactedLog[]; hits: RedactionHit[] } {
  const hits: RedactionHit[] = [];
  const rows = logs.map((l) => {
    let detail = l.detail ?? "";
    if (opts.redactNotes && l.event.startsWith("skill.notes")) {
      if (detail) {
        hits.push({ field: l.event, kind: "note body", before: detail, after: "[note redacted]" });
        detail = "[note redacted]";
      }
    } else if (detail) {
      detail = redactValue(detail, l.event, opts, hits);
    }
    return { at: l.at, level: l.level, event: l.event, detail };
  });
  return { rows, hits };
}

export function toCSV(rows: RedactedLog[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const head = "timestamp,level,event,detail";
  return [head, ...rows.map((r) => [r.at, r.level, r.event, r.detail].map(esc).join(","))].join(
    "\n",
  );
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
