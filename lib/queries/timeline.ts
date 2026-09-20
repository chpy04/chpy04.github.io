/**
 * `timeline_entry`: the dots on the timeline axis.
 *
 * The one content module with no `sort_order`. Order here is a fact about
 * the data, not a preference — it is `starts_on`, ascending — so there is no
 * reorder endpoint and editing a date is what moves an entry. Ties still
 * break on `id`: several entries share a start date in the real data.
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { timelineEntry } from '../db/schema.ts';
import type { TimelineEntry, TimelineKind } from '../types.ts';
import { NotFoundError } from './errors.ts';

type EntryRow = typeof timelineEntry.$inferSelect;

function toWire(row: EntryRow): TimelineEntry {
  return {
    id: row.id,
    organization: row.organization,
    title: row.title,
    description: row.description,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    // `kind` is a plain `text` column with a check constraint, so Drizzle
    // types it as string. The constraint is what makes this cast safe.
    kind: row.kind as TimelineKind,
    thumbnailPath: row.thumbnailPath,
    isArchived: row.isArchived,
  };
}

/**
 * Every entry the caller owns, oldest first, archived ones included —
 * hiding them is the UI's decision, and a caller that cannot see an archived
 * row also cannot un-archive it.
 */
export async function listTimeline(userId: string): Promise<TimelineEntry[]> {
  const rows = await db
    .select()
    .from(timelineEntry)
    .where(eq(timelineEntry.userId, userId))
    .orderBy(asc(timelineEntry.startsOn), asc(timelineEntry.id));
  return rows.map(toWire);
}

export interface NewTimelineEntry {
  organization: string;
  title: string;
  description?: string;
  startsOn: string;
  endsOn?: string | null;
  kind: TimelineKind;
  thumbnailPath?: string;
}

export async function createTimelineEntry(
  userId: string,
  data: NewTimelineEntry,
): Promise<TimelineEntry> {
  const [row] = await db
    .insert(timelineEntry)
    .values({
      userId,
      organization: data.organization,
      title: data.title,
      description: data.description ?? '',
      startsOn: data.startsOn,
      endsOn: data.endsOn ?? null,
      kind: data.kind,
      thumbnailPath: data.thumbnailPath ?? '',
    })
    .returning();
  if (!row) throw new Error('failed to create timeline entry');
  return toWire(row);
}

export type TimelineEntryPatch = Partial<{
  organization: string;
  title: string;
  description: string;
  startsOn: string;
  endsOn: string | null;
  kind: TimelineKind;
  thumbnailPath: string;
  isArchived: boolean;
}>;

/** `NotFoundError` for both "no such entry" and "somebody else's entry" — a
 *  403 would confirm the id is real. */
export async function updateTimelineEntry(
  userId: string,
  id: string,
  patch: TimelineEntryPatch,
): Promise<TimelineEntry> {
  const [row] = await db
    .update(timelineEntry)
    .set(patch)
    .where(and(eq(timelineEntry.id, id), eq(timelineEntry.userId, userId)))
    .returning();
  if (!row) throw new NotFoundError(`timeline entry ${id} not found`);
  return toWire(row);
}

/** The whole of "delete" — see .claude/rules/data-access.md. */
export async function archiveTimelineEntry(userId: string, id: string): Promise<TimelineEntry> {
  return updateTimelineEntry(userId, id, { isArchived: true });
}
