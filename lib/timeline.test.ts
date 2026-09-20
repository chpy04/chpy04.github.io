import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAxis,
  buildScale,
  formatDateRange,
  lineRuns,
  parseDate,
  project,
  spreadPositions,
  yearTicks,
  type DatedEntry,
} from './timeline.ts';

function entry(startsOn: string, endsOn: string | null = null): DatedEntry {
  return { startsOn, endsOn };
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

test('a date string is parsed in local time, not UTC', () => {
  // The bug this exists to prevent: `new Date('2024-05-01')` is UTC
  // midnight, which renders as 30 April anywhere west of Greenwich.
  const date = parseDate('2024-05-01');
  assert.equal(date.getFullYear(), 2024);
  assert.equal(date.getMonth(), 4);
  assert.equal(date.getDate(), 1);
});

test('an open-ended range reads as Present', () => {
  assert.equal(formatDateRange('2025-09-01', null), 'Sep 2025 - Present');
  assert.equal(formatDateRange('2025-09-01'), 'Sep 2025 - Present');
});

test('a single-moment entry collapses to one month', () => {
  // Graduations and awards store the same start and end.
  assert.equal(formatDateRange('2023-05-01', '2023-05-01'), 'May 2023');
});

test('a range inside one year names the year once', () => {
  assert.equal(formatDateRange('2024-05-01', '2024-08-01'), 'May - Aug 2024');
});

test('a range spanning years names both', () => {
  assert.equal(formatDateRange('2022-08-01', '2023-09-01'), 'Aug 2022 - Sep 2023');
});

// ---------------------------------------------------------------------------
// The scale
// ---------------------------------------------------------------------------

test('the scale spans the full width', () => {
  const segments = buildScale([entry('2023-01-01'), entry('2024-01-01')]);
  assert.equal(segments[0]?.startPct, 0);
  assert.equal(segments[segments.length - 1]?.endPct, 100);
});

test('a gap longer than a year is compressed, a shorter one is not', () => {
  const segments = buildScale([entry('2010-01-01'), entry('2023-01-01'), entry('2023-06-01')]);

  const thirteenYears = segments.find((s) => s.startMs === parseDate('2010-01-01').getTime());
  assert.equal(thirteenYears?.compressed, true);

  const fiveMonths = segments.find((s) => s.startMs === parseDate('2023-01-01').getTime());
  assert.equal(fiveMonths?.compressed, false);
});

test('compressing a long gap keeps the recent entries legible', () => {
  // Without compression a 2010 entry would squeeze everything after 2023
  // into a sliver. The test of that is how much axis the recent stretch
  // gets, not the internals of the scale.
  const segments = buildScale([entry('2010-01-01'), entry('2023-01-01'), entry('2024-01-01')]);
  const recent = 100 - project(parseDate('2023-01-01').getTime(), segments);
  assert.ok(recent > 50, `recent stretch got only ${recent.toFixed(1)}% of the axis`);
});

test('projection is clamped at both ends of the domain', () => {
  const segments = buildScale([entry('2023-01-01'), entry('2024-01-01')]);
  assert.equal(project(parseDate('1990-01-01').getTime(), segments), 0);
  assert.equal(project(parseDate('2099-01-01').getTime(), segments), 100);
});

test('projection is monotonic', () => {
  const segments = buildScale([entry('2022-01-01'), entry('2023-06-01'), entry('2024-03-01')]);
  const points = ['2022-01-01', '2022-09-01', '2023-06-01', '2024-01-01', '2024-03-01'];
  const projected = points.map((p) => project(parseDate(p).getTime(), segments));
  for (let i = 1; i < projected.length; i += 1) {
    assert.ok(
      (projected[i] as number) >= (projected[i - 1] as number),
      `${points[i]} projected before ${points[i - 1]}`,
    );
  }
});

test('an empty timeline still produces a usable scale', () => {
  const segments = buildScale([]);
  assert.equal(segments.length, 1);
  assert.equal(segments[0]?.startPct, 0);
  assert.equal(segments[0]?.endPct, 100);
});

test('a single entry still produces a usable scale', () => {
  const segments = buildScale([entry('2024-01-01')]);
  assert.equal(segments[0]?.startPct, 0);
  assert.equal(segments[segments.length - 1]?.endPct, 100);
});

// ---------------------------------------------------------------------------
// Year labels
// ---------------------------------------------------------------------------

test('year labels are unique and left to right', () => {
  const segments = buildScale([entry('2022-01-01'), entry('2023-06-01'), entry('2024-03-01')]);
  const ticks = yearTicks(segments);

  const years = ticks.map((t) => t.year);
  assert.deepEqual(years, [...new Set(years)], 'a year was labelled twice');
  for (let i = 1; i < ticks.length; i += 1) {
    assert.ok((ticks[i]?.pct as number) >= (ticks[i - 1]?.pct as number));
  }
});

test('years hidden inside a compressed gap are not labelled', () => {
  const segments = buildScale([entry('2010-01-01'), entry('2023-01-01')]);
  const years = yearTicks(segments).map((t) => t.year);

  // 2015 is inside the collapsed stretch and has nowhere to sit.
  assert.ok(!years.includes(2015));
  // The gap still contributes the year it resumes in, so the axis is not
  // unlabelled on the far side of the break.
  assert.ok(years.includes(2023));
});

// ---------------------------------------------------------------------------
// Dot collision handling
// ---------------------------------------------------------------------------

test('dots closer than the minimum gap are pushed apart', () => {
  const spread = spreadPositions([50, 50, 50], 2.4, 3, 97);
  for (let i = 1; i < spread.length; i += 1) {
    assert.ok(
      (spread[i] as number) - (spread[i - 1] as number) >= 2.4 - 1e-9,
      `gap ${i} was ${(spread[i] as number) - (spread[i - 1] as number)}`,
    );
  }
});

test('spreading a cluster keeps it centred on its real date', () => {
  // A one-directional pass would drag the whole cluster to the right; the
  // midpoint of both passes keeps its centre of mass where the dates say.
  const spread = spreadPositions([50, 50, 50], 2.4, 3, 97);
  const mean = spread.reduce((sum, p) => sum + p, 0) / spread.length;
  assert.ok(Math.abs(mean - 50) < 0.001, `cluster drifted to ${mean}`);
});

test('already-separated dots are left exactly where they were', () => {
  const positions = [10, 40, 80];
  assert.deepEqual(spreadPositions(positions, 2.4, 3, 97), positions);
});

test('dots are kept inside the track', () => {
  const spread = spreadPositions([2, 2, 2, 98, 98], 2.4, 3, 97);
  for (const p of spread) {
    assert.ok(p >= 3 - 1e-9 && p <= 97 + 1e-9, `${p} is off the track`);
  }
});

test('fewer than two dots need no spreading', () => {
  assert.deepEqual(spreadPositions([], 2.4, 3, 97), []);
  assert.deepEqual(spreadPositions([50], 2.4, 3, 97), [50]);
});

// ---------------------------------------------------------------------------
// The assembled axis
// ---------------------------------------------------------------------------

const BOUNDS = { trackMin: 3, trackMax: 97, minDotGap: 2.4 };

test('the axis maps dots, ticks and gaps through one scale', () => {
  const entries = [entry('2010-01-01'), entry('2023-01-01'), entry('2024-06-01')];
  const axis = buildAxis(entries, BOUNDS);

  assert.equal(axis.positions.length, entries.length);
  for (const p of axis.positions) {
    assert.ok(p >= 3 - 1e-9 && p <= 97 + 1e-9);
  }
  for (const tick of axis.ticks) {
    assert.ok(tick.pct >= 3 - 1e-9 && tick.pct <= 97 + 1e-9);
  }

  // The regression this catches: computing dots and ticks from separate
  // scales, which lands a 2023 dot to the left of the "2023" label.
  const tick2023 = axis.ticks.find((t) => t.year === 2023);
  assert.ok(tick2023);
  assert.ok((axis.positions[1] as number) >= tick2023.pct - 1e-9);
});

test('the line is drawn around the gaps, not over them', () => {
  const axis = buildAxis([entry('2010-01-01'), entry('2023-01-01')], BOUNDS);
  assert.equal(axis.gaps.length, 1);

  const runs = lineRuns(axis.gaps);
  assert.equal(runs.length, 2);
  assert.equal(runs[0]?.from, 0);
  assert.equal(runs[0]?.to, axis.gaps[0]?.from);
  assert.equal(runs[1]?.from, axis.gaps[0]?.to);
  assert.equal(runs[1]?.to, 100);
});

test('with no gaps the line is one unbroken run', () => {
  assert.deepEqual(lineRuns([]), [{ from: 0, to: 100 }]);
});
