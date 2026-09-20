'use client';

import { useEffect, useRef } from 'react';
import EditableText from '@/components/admin/EditableText';
import Markdown from '@/components/portfolio/Markdown';
import type { Project } from '@/lib/types';

interface ProjectModalProps {
  project: Project;
  open: boolean;
  onClose: () => void;
  onSaveWriteup: (writeup: string) => void;
}

/**
 * A project's write-up, over the page.
 *
 * A native `<dialog>` opened with `showModal()`: the focus trap, the
 * Escape-to-close, the backdrop, and marking the rest of the page inert are
 * all things the element does. A div with `role="dialog"` would need every
 * one of them reimplemented, and the reimplementation is where modals go
 * wrong.
 *
 * The write-up is markdown and is edited as markdown — the one place on the
 * page where the editable value and the rendered value genuinely differ, so
 * `EditableText` takes the source and renders the output as children.
 */
export default function ProjectModal({ project, open, onClose, onSaveWriteup }: ProjectModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // `open` as a prop rather than the `open` attribute: setting the
  // attribute directly shows a non-modal dialog, with no backdrop, no focus
  // trap and no inert page. Only `showModal()` gives the modal behaviour.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // `close` fires for Escape and for `close()` alike, so the parent's
      // state is kept in step with dismissals we never hear about.
      onClose={onClose}
      // A click that starts on the element itself landed on the backdrop —
      // the panel inside is what receives clicks anywhere else.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby={`project-title-${project.id}`}
      className="m-auto w-full max-w-4xl rounded-xl border border-line bg-surface text-ink shadow-2xl backdrop:bg-canvas/70"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-t-xl border-b border-line bg-surface/95 px-4 py-3 backdrop-blur tablet:px-6">
        <h2
          id={`project-title-${project.id}`}
          className="truncate text-base font-medium text-ink-bright tablet:text-lg"
        >
          {project.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-lg p-1 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="px-4 py-5 tablet:px-6">
        <EditableText
          as="div"
          multiline
          value={project.writeup}
          onSave={onSaveWriteup}
          placeholder="Write this project up in markdown."
          className="font-mono text-xs leading-relaxed"
        >
          <Markdown>{project.writeup}</Markdown>
        </EditableText>
      </div>
    </dialog>
  );
}
