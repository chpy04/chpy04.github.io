/**
 * The timeline axis, as pure functions over plain data.
 *
 * All of it lives here rather than in the components because every
 * interesting case is arithmetic — a gap long enough to collapse, two
 * entries on the same day, a year label that falls inside a collapsed gap —
 * and those are far cheaper to pin down in a unit test than in a browser
 * one. `timeline.test.ts` is the specification; the components only place
 * the numbers this returns.
 *
 * No React, no DOM, no database.
 */

const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;
const YEAR_MS = 12 * MONTH_MS;

/**
 * A gap between two entries longer than this is drawn as a visual break
 * instead of eating a proportional slice of the axis.
 */
const GAP_THRESHOLD_MS = YEAR_MS;
/** Axis width a broken gap is given, expressed in real time units. */
const COMPRESSED_GAP_MS = 4 * MONTH_MS;
/** Trailing room after the last entry so "Present" items aren't flush to the edge. */
const DOMAIN_PADDING_MS = 2 * MONTH_MS;

/** The fields of a timeline entry this module needs. Deliberately not
 *  `TimelineEntry`: nothing here depends on the rest of the row. */
export interface DatedEntry {
  startsOn: string;
  endsOn: string | null;
}

/**
 * `new Date('2024-05-01')` is parsed as UTC midnight and then rendered in
 * the viewer's local zone, which shows "April" anywhere west of Greenwich.
 * Parsing the parts by hand keeps the date in local time.
 */
export function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function shortMonth(date: Date): string {
  return date.toLocaleString('en-US', { month: 'short' });
}

/** `Jun 2025 - Present`, `Jun - Sep 2024`, or `May 2023` for a single moment. */
export function formatDateRange(start: string, end?: string | null): string {
  const from = parseDate(start);
  if (!end) return `${shortMonth(from)} ${from.getFullYear()} - Present`;

  const to = parseDate(end);
  const sameYear = from.getFullYear() === to.getFullYear();

  // Single-moment entries (graduations, awards) store the same start and end.
  if (sameYear && from.getMonth() === to.getMonth()) {
    return `${shortMonth(from)} ${from.getFullYear()}`;
  }
  if (sameYear) {
    return `${shortMonth(from)} - ${shortMonth(to)} ${from.getFullYear()}`;
  }
  return `${shortMonth(from)} ${from.getFullYear()} - ${shortMonth(to)} ${to.getFullYear()}`;
}

export interface ScaleSegment {
  startMs: number;
  endMs: number;
  startPct: number;
  endPct: number;
  compressed: boolean;
}

export interface YearTick {
  year: number;
  pct: number;
}

/**
 * Builds a piecewise-linear time -> percentage scale. Long empty stretches
 * are collapsed so a single 2010 entry doesn't squash everything after 2022
 * into a sliver of the axis.
 */
export function buildScale(entries: DatedEntry[]): ScaleSegment[] {
  const starts = entries.map((entry) => parseDate(entry.startsOn).getTime());
  const ends = entries
    .filter((entry) => entry.endsOn)
    .map((entry) => parseDate(entry.endsOn as string).getTime());

  if (starts.length === 0) {
    const now = Date.now();
    return [{ startMs: now, endMs: now, startPct: 0, endPct: 100, compressed: false }];
  }

  const domainEnd = Math.max(...starts, ...ends) + DOMAIN_PADDING_MS;
  const breakpoints = Array.from(new Set([...starts, domainEnd])).sort((a, b) => a - b);

  const first = breakpoints[0] as number;
  if (breakpoints.length < 2) {
    return [{ startMs: first, endMs: first, startPct: 0, endPct: 100, compressed: false }];
  }

  const weights = breakpoints.slice(0, -1).map((startMs, index) => {
    const gap = (breakpoints[index + 1] as number) - startMs;
    const compressed = gap > GAP_THRESHOLD_MS;
    return { weight: compressed ? COMPRESSED_GAP_MS : gap, compressed };
  });

  const total = weights.reduce((sum, w) => sum + w.weight, 0) || 1;

  let consumed = 0;
  return weights.map(({ weight, compressed }, index) => {
    const startPct = (consumed / total) * 100;
    consumed += weight;
    return {
      startMs: breakpoints[index] as number,
      endMs: breakpoints[index + 1] as number,
      startPct,
      endPct: (consumed / total) * 100,
      compressed,
    };
  });
}

/** Where a moment sits on the axis, as a percentage. */
export function project(ms: number, segments: ScaleSegment[]): number {
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (!first || !last) return 0;
  if (ms <= first.startMs) return first.startPct;
  if (ms >= last.endMs) return last.endPct;

  const segment = segments.find((s) => ms >= s.startMs && ms <= s.endMs) ?? first;
  const span = segment.endMs - segment.startMs;
  const ratio = span === 0 ? 0 : (ms - segment.startMs) / span;
  return segment.startPct + ratio * (segment.endPct - segment.startPct);
}

/**
 * Year labels for the axis. Years that fall inside a collapsed gap are
 * dropped, and each collapsed gap instead contributes the year it resumes
 * in.
 */
export function yearTicks(segments: ScaleSegment[]): YearTick[] {
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (!first || !last) return [];

  const domainStart = first.startMs;
  const domainEnd = last.endMs;
  const ticks: YearTick[] = [{ year: new Date(domainStart).getFullYear(), pct: 0 }];

  for (const segment of segments) {
    if (segment.compressed) {
      ticks.push({ year: new Date(segment.endMs).getFullYear(), pct: segment.endPct });
    }
  }

  const firstYear = new Date(domainStart).getFullYear() + 1;
  const lastYear = new Date(domainEnd).getFullYear();
  for (let year = firstYear; year <= lastYear; year += 1) {
    const ms = new Date(year, 0, 1).getTime();
    if (ms < domainStart || ms > domainEnd) continue;

    const segment = segments.find((s) => ms >= s.startMs && ms <= s.endMs);
    if (!segment) continue;
    // Hidden inside a break — the break already contributed its resume year.
    if (segment.compressed && ms > segment.startMs && ms < segment.endMs) continue;

    ticks.push({ year, pct: project(ms, segments) });
  }

  // Keep the left-most occurrence of each year.
  const seen = new Map<number, YearTick>();
  for (const tick of ticks.sort((a, b) => a.pct - b.pct)) {
    if (!seen.has(tick.year)) seen.set(tick.year, tick);
  }
  return Array.from(seen.values()).sort((a, b) => a.pct - b.pct);
}

function pushRight(positions: number[], minGap: number): number[] {
  const out = positions.slice();
  for (let i = 1; i < out.length; i += 1) {
    out[i] = Math.max(out[i] as number, (out[i - 1] as number) + minGap);
  }
  return out;
}

function pushLeft(positions: number[], minGap: number): number[] {
  const out = positions.slice();
  for (let i = out.length - 2; i >= 0; i -= 1) {
    out[i] = Math.min(out[i] as number, (out[i + 1] as number) - minGap);
  }
  return out;
}

/**
 * Nudges already-sorted positions apart so entries sharing a start date (or
 * sitting a few days apart) render as distinct dots instead of one blob.
 *
 * Resolving the collisions in one direction only would drag a whole cluster
 * off its real date, so this averages a left-to-right and a right-to-left
 * pass. Both passes satisfy the minimum gap, and so does their midpoint.
 */
export function spreadPositions(
  positions: number[],
  minGap: number,
  min: number,
  max: number,
): number[] {
  if (positions.length < 2) return positions.slice();

  const right = pushRight(positions, minGap);
  const left = pushLeft(positions, minGap);
  const spread = positions.map((_, i) => ((right[i] as number) + (left[i] as number)) / 2);

  const low = spread[0] as number;
  const high = spread[spread.length - 1] as number;
  const span = high - low;

  // Only rescale when the spread genuinely cannot fit; rescaling otherwise
  // would stretch the dots off the axis mapping the year ticks use.
  if (span > max - min) {
    return spread.map((p) => min + ((p - low) / (span || 1)) * (max - min));
  }

  const shift = low < min ? min - low : high > max ? max - high : 0;
  return spread.map((p) => p + shift);
}

export interface AxisGap {
  /** Stable key for React; the gap's start in real time. */
  key: number;
  from: number;
  to: number;
}

export interface Axis {
  /** One percentage per entry, in the order they were passed in. */
  positions: number[];
  ticks: YearTick[];
  /** Collapsed stretches, drawn as a break in the line. */
  gaps: AxisGap[];
}

/**
 * The whole axis in one call: dot positions, year labels and collapsed
 * gaps, all mapped into `[trackMin, trackMax]`.
 *
 * They go through one shared mapping on purpose — computing the three
 * separately is how a dot ends up on the wrong side of its own year label.
 *
 * `entries` must already be sorted oldest-first; `spreadPositions` assumes
 * it and produces nonsense otherwise.
 */
export function buildAxis(
  entries: DatedEntry[],
  bounds: {
    trackMin: number;
    trackMax: number;
    minDotGap: number;
  },
): Axis {
  const { trackMin, trackMax, minDotGap } = bounds;
  const segments = buildScale(entries);
  const toTrack = (pct: number): number => trackMin + (pct / 100) * (trackMax - trackMin);

  const raw = entries.map((entry) =>
    toTrack(project(parseDate(entry.startsOn).getTime(), segments)),
  );

  return {
    positions: spreadPositions(raw, minDotGap, trackMin, trackMax),
    ticks: yearTicks(segments).map((tick) => ({ ...tick, pct: toTrack(tick.pct) })),
    gaps: segments
      .filter((segment) => segment.compressed)
      .map((segment) => ({
        key: segment.startMs,
        from: toTrack(segment.startPct),
        to: toTrack(segment.endPct),
      })),
  };
}

/**
 * The stretches of axis line to actually draw — everything except the
 * collapsed gaps, so a gap reads as a real break in the line rather than a
 * patch laid over it.
 */
export function lineRuns(gaps: AxisGap[]): { from: number; to: number }[] {
  const runs: { from: number; to: number }[] = [];
  let cursor = 0;
  for (const gap of gaps) {
    runs.push({ from: cursor, to: gap.from });
    cursor = gap.to;
  }
  runs.push({ from: cursor, to: 100 });
  return runs;
}
