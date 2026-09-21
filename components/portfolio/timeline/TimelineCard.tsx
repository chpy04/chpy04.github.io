'use client';

import Image from 'next/image';
import AdminField from '@/components/admin/AdminField';
import AdminStrip from '@/components/admin/AdminStrip';
import ArchiveToggle from '@/components/admin/ArchiveToggle';
import EditableText from '@/components/admin/EditableText';
import UploadZone from '@/components/admin/UploadZone';
import Markdown from '@/components/portfolio/Markdown';
import { badgeClass } from './kindStyles';
import { useSite } from '@/components/SiteProvider';
import { formatDateRange } from '@/lib/timeline';
import { TIMELINE_KINDS, type TimelineEntry, type TimelineKind } from '@/lib/types';

interface TimelineCardProps {
  entry: TimelineEntry;
  className?: string;
}

export default function TimelineCard({ entry, className = '' }: TimelineCardProps) {
  const { saveTimelineEntry } = useSite();

  return (
    <article
      className={`rounded-2xl border border-line/60 bg-surface/80 p-4 shadow-lg backdrop-blur-sm tablet:p-6 ${
        entry.isArchived ? 'opacity-50' : ''
      } ${className}`}
    >
      <div className="flex items-start gap-3 tablet:gap-4">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg tablet:h-16 tablet:w-16">
          {entry.thumbnailPath ? (
            <Image src={entry.thumbnailPath} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <div className="h-full w-full rounded-lg border border-dashed border-line" />
          )}
          <UploadZone
            compact
            label="timeline thumbnail"
            onUploaded={(thumbnailPath) => saveTimelineEntry(entry.id, { thumbnailPath })}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 tablet:flex-row tablet:items-start tablet:justify-between tablet:gap-4">
          <div className="min-w-0">
            <EditableText
              as="h3"
              value={entry.title}
              onSave={(title) => saveTimelineEntry(entry.id, { title })}
              placeholder="Role or milestone"
              className="text-lg leading-tight font-bold text-ink-bright tablet:text-2xl tablet:leading-8"
            />
            <p className="text-sm text-ink-faint tablet:text-base">
              <EditableText
                value={entry.organization}
                onSave={(organization) => saveTimelineEntry(entry.id, { organization })}
                placeholder="Organization"
              />
              {' · '}
              {formatDateRange(entry.startsOn, entry.endsOn)}
            </p>
          </div>
          <span
            className={`w-fit shrink-0 rounded-full border px-3 py-1 text-xs capitalize tablet:text-sm ${badgeClass(
              entry.kind,
            )}`}
          >
            {entry.kind}
          </span>
        </div>
      </div>

      <EditableText
        as="div"
        multiline
        value={entry.description}
        onSave={(description) => saveTimelineEntry(entry.id, { description })}
        placeholder="What happened here?"
        className="mt-3 text-sm text-ink-dim tablet:mt-4 tablet:text-base"
      >
        <Markdown compact>{entry.description}</Markdown>
      </EditableText>

      <AdminStrip>
        <AdminField
          label="From"
          type="date"
          value={entry.startsOn}
          onCommit={(startsOn) => saveTimelineEntry(entry.id, { startsOn })}
        />
        <AdminField
          label="To"
          type="date"
          value={entry.endsOn ?? ''}
          onCommit={(next) =>
            saveTimelineEntry(entry.id, { endsOn: next.length > 0 ? next : null })
          }
        />
        <label className="flex items-center gap-1.5">
          <span className="text-edit-ink/70">Kind</span>
          <select
            value={entry.kind}
            onChange={(event) =>
              saveTimelineEntry(entry.id, { kind: event.target.value as TimelineKind })
            }
            className="rounded border border-edit/30 bg-canvas/60 px-1.5 py-0.5 text-ink outline-none focus:border-edit"
          >
            {TIMELINE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <AdminField
          label="Thumbnail"
          value={entry.thumbnailPath}
          placeholder="drop a file on the thumbnail, or paste a URL"
          onCommit={(thumbnailPath) => saveTimelineEntry(entry.id, { thumbnailPath })}
        />
        <ArchiveToggle
          isArchived={entry.isArchived}
          onArchive={() => saveTimelineEntry(entry.id, { isArchived: true })}
          onRestore={() => saveTimelineEntry(entry.id, { isArchived: false })}
          label={entry.title}
        />
      </AdminStrip>
    </article>
  );
}
