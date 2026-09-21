'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useSite } from '@/components/SiteProvider';
import { ALLOWED_IMAGE_TYPES, acceptAttribute } from '@/lib/storage/media';

interface UploadZoneProps {
  /** Called with the public URL once the file is in the bucket. The caller
   *  saves it to whichever field this zone sits on. */
  onUploaded: (url: string) => void;
  /** What is being replaced, for the button's label: "project image". */
  label: string;
  /** Defaults to images; the resume PDF passes the wider list. */
  accept?: readonly string[];
  /** For a zone too small for a word — a timeline thumbnail is 64px. */
  compact?: boolean;
  /** Match a circular image (the headshot) rather than a rounded rectangle. */
  round?: boolean;
}

/**
 * The drop target that sits on top of an image while editing: drag a file
 * onto it, or click it to pick one.
 *
 * **Render it inside the image's own `relative` wrapper**, as a sibling of
 * the `<Image>`. It covers that wrapper rather than replacing it, so the
 * card's layout is the same whether the edit layer is on or off, and an
 * empty slot (no image yet) is just as droppable as a filled one.
 *
 * Three states, because an affordance nobody can see is not one:
 *
 *   - **at rest**, while editing: a small chip in the corner, enough to say
 *     this picture is a slot and takes a file. Not the full overlay — every
 *     image wearing a panel would make the edit layer the design;
 *   - **armed**, the moment a file crosses the window (`fileDragging`):
 *     every slot on the page outlines itself, so the answer to "where can I
 *     drop this?" arrives before the aiming does;
 *   - **hot**, under the cursor or mid-upload: filled, and it says so.
 *
 * It is a `<button>`, not a bare div, because drag-and-drop is a gesture a
 * keyboard cannot make: tabbing to it and pressing Enter opens the same file
 * picker. That is the same reason the project cards have move arrows next to
 * a drag handle.
 */
export default function UploadZone({
  onUploaded,
  label,
  accept = ALLOWED_IMAGE_TYPES,
  compact = false,
  round = false,
}: UploadZoneProps) {
  const { editing, fileDragging, uploadMedia } = useSite();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!editing) return null;

  async function take(files: readonly File[]): Promise<void> {
    setDragging(false);
    setBusy(true);
    const url = await uploadMedia(files, accept);
    setBusy(false);
    if (url) onUploaded(url);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>): void {
    event.preventDefault();
    void take(Array.from(event.dataTransfer.files));
  }

  // `dragover` has to be cancelled on every tick or the browser refuses the
  // drop — cancelling `dragenter` alone is not enough.
  function handleDragOver(event: DragEvent<HTMLButtonElement>): void {
    event.preventDefault();
    setDragging(true);
  }

  const hot = dragging || busy;
  const armed = fileDragging && !hot;

  return (
    <>
      {/* Outside the button: a file input nested in a button is a click loop. */}
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttribute(accept)}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Cleared so that choosing the same file twice still fires.
          event.target.value = '';
          void take(files);
        }}
      />
      <button
        type="button"
        aria-label={`Replace the ${label}`}
        title={`Drop a file here, or click to choose one — replaces the ${label}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`absolute inset-0 z-10 border-2 border-dashed transition-colors duration-150 focus:outline-none ${
          round ? 'rounded-full' : 'rounded-lg'
        } ${
          hot
            ? 'border-edit bg-edit-surface/80'
            : armed
              ? 'border-edit/70 bg-edit-surface/50'
              : 'border-transparent hover:border-edit/60 hover:bg-edit-surface/30 focus-visible:border-edit/60 focus-visible:bg-edit-surface/30'
        }`}
      >
        {/* The always-on half: small, cornered, and the only part a reader
            would ever have to not see — this whole component is unmounted
            for them. */}
        <span
          className={`pointer-events-none absolute flex items-center gap-1 rounded-md bg-edit-surface/90 px-1.5 py-1 text-edit-ink shadow-sm ${
            // A circle's corner is empty space: the chip would float beside
            // the photograph rather than sit on it.
            round ? 'bottom-3 left-1/2 -translate-x-1/2' : 'top-1 right-1'
          }`}
        >
          <UploadIcon />
          {compact ? null : <span className="text-[11px] font-medium">Replace</span>}
        </span>

        {/* The rest of the message, once there is room for it to matter. */}
        {hot || armed ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-2">
            {/* On its own background, not floating over the picture: the
                images underneath are photographs, and half of them are
                pale enough to swallow light text. */}
            <span className="rounded-md bg-edit-surface/90 px-2 py-1 text-center text-xs font-medium text-edit-ink">
              {busy ? 'Uploading…' : compact ? '' : dragging ? 'Drop to replace' : 'Drop a file'}
            </span>
          </span>
        ) : null}
      </button>
    </>
  );
}

function UploadIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4"
      />
    </svg>
  );
}
