import type { TimelineKind } from '@/lib/types';

/**
 * The colour each timeline kind reads as, as Tailwind utility strings.
 *
 * These live beside the components rather than in `lib/` because they are
 * presentation, not logic — there is nothing here a unit test could
 * meaningfully assert. The tokens themselves are in `app/globals.css`.
 *
 * The `other` entry is unreachable while `ck_timeline_entry_kind` holds; it
 * exists so that relaxing that constraint degrades to a grey badge rather
 * than to `undefined` in a `className`.
 */
const BADGE: Record<TimelineKind, string> = {
  employment: 'bg-kind-employment/15 text-kind-employment-ink border-kind-employment/30',
  education: 'bg-kind-education/15 text-kind-education-ink border-kind-education/30',
  extracurricular:
    'bg-kind-extracurricular/15 text-kind-extracurricular-ink border-kind-extracurricular/30',
  award: 'bg-kind-award/15 text-kind-award-ink border-kind-award/30',
};

const DOT: Record<TimelineKind, string> = {
  employment: 'bg-kind-employment',
  education: 'bg-kind-education',
  extracurricular: 'bg-kind-extracurricular',
  award: 'bg-kind-award',
};

export function badgeClass(kind: string): string {
  return BADGE[kind as TimelineKind] ?? 'bg-kind-other/15 text-kind-other-ink border-kind-other/30';
}

export function dotClass(kind: string): string {
  return DOT[kind as TimelineKind] ?? 'bg-kind-other';
}
