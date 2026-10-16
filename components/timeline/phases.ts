export type PhaseStatus = "complete" | "active" | "upcoming";

export type Phase = {
  title: string;
  summary?: string;
  /** First day, as YYYY-MM-DD in Sri Lanka time. Omit while the date is TBD. */
  start?: string;
  /** Last day, inclusive. Omit for single-day phases. */
  end?: string;
  /**
   * Set by hand as the event runs. "complete" joins the span to the next one;
   * "active" marks the stage in progress. Defaults to "upcoming".
   */
  status?: Exclude<PhaseStatus, "upcoming">;
};

export const PHASES: Phase[] = [
  { title: "Workshop 1", summary: "Online", start: "2026-10-06", status: "complete" },
  { title: "Workshop 2", summary: "Online", start: "2026-10-11", status: "complete" },
  { title: "Workshop 3", summary: "Online", start: "2026-10-19" },
  { title: "Initial Round", summary: "Online", start: "2026-10-24" },
  { title: "Final Hackathon", summary: "Online / Physical", start: "2026-10-29" },
];

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function statusOf(k: number): PhaseStatus {
  return PHASES[k].status ?? "upcoming";
}

/** "TBD", "03 OCT", "04 – 17 OCT" or "28 SEP – 04 OCT". */
export function formatDates({ start, end }: Phase) {
  if (!start) return "TBD";
  const [, sm, sd] = start.split("-");
  if (!end) return `${sd} ${MONTHS[+sm - 1]}`;
  const [, em, ed] = end.split("-");
  if (sm === em) return `${sd} – ${ed} ${MONTHS[+em - 1]}`;
  return `${sd} ${MONTHS[+sm - 1]} – ${ed} ${MONTHS[+em - 1]}`;
}
