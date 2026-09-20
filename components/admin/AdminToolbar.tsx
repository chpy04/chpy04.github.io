'use client';

import { useSite } from '@/components/SiteProvider';

/**
 * The owner's control strip: turn the edit layer on or off, reveal archived
 * rows, and see the one place a failed save is reported.
 *
 * Bottom-left, because bottom-right is the feedback button. Rendered only
 * for the site owner — a reader's page has no trace of it.
 *
 * Save errors surface here rather than beside the field that failed. With
 * every string on the page editable, a per-field error slot would be a
 * hundred slots that are empty a hundred percent of the time, and the one
 * that isn't would be off-screen as often as not.
 */
export default function AdminToolbar() {
  const { canEdit, editing, setEditing, showArchived, setShowArchived, error, dismissError } =
    useSite();

  if (!canEdit) return null;

  return (
    // `bottom-16`, not `bottom-4`: Next's dev-tools badge sits in the
    // bottom-left corner and would cover the toggle for the whole of local
    // development, which is the only place this has ever been seen.
    <div className="fixed bottom-16 left-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2">
      {error ? (
        <div className="flex items-center gap-3 rounded-lg border border-danger-line/50 bg-danger-surface/90 px-3 py-2 text-sm text-danger-ink shadow-lg backdrop-blur">
          <span>{error}</span>
          <button
            type="button"
            onClick={dismissError}
            className="rounded-md border border-danger-line-strong px-2 py-0.5 text-xs text-danger-ink-strong hover:bg-danger-line/40"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-1 rounded-full border border-line bg-surface/90 px-2 py-1.5 shadow-lg backdrop-blur">
        <Toggle
          label={editing ? 'Editing' : 'Edit'}
          active={editing}
          onClick={() => setEditing(!editing)}
          hint={
            editing
              ? 'Double-click any text to edit it. Turn off to browse the site normally.'
              : 'Turn on inline editing'
          }
        />
        {editing ? (
          <Toggle
            label={showArchived ? 'Hiding nothing' : 'Show archived'}
            active={showArchived}
            onClick={() => setShowArchived(!showArchived)}
            hint="Reveal archived entries so they can be restored"
          />
        ) : null}
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  active: boolean;
  onClick: () => void;
  hint: string;
}

function Toggle({ label, active, onClick, hint }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-edit text-canvas' : 'text-ink-faint hover:bg-surface-2 hover:text-ink'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-canvas' : 'bg-ink-faintest'}`}
      />
      {label}
    </button>
  );
}
