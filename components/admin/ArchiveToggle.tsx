'use client';

interface ArchiveToggleProps {
  isArchived: boolean;
  onArchive: () => void;
  onRestore: () => void;
  /** What is being archived, for the button's accessible name. */
  label: string;
}

/**
 * Archive, never delete: the row stays and simply stops being shown
 * (D-003). Which is also why the restore half is not optional — an archived
 * row the owner cannot find again has been deleted in every way that
 * matters.
 */
export default function ArchiveToggle({
  isArchived,
  onArchive,
  onRestore,
  label,
}: ArchiveToggleProps) {
  return (
    <button
      type="button"
      onClick={isArchived ? onRestore : onArchive}
      className="rounded border border-edit/40 px-2 py-0.5 text-edit-ink transition-colors hover:border-edit hover:bg-edit/10"
    >
      {isArchived ? 'Restore' : 'Archive'}
      <span className="sr-only"> {label}</span>
    </button>
  );
}
