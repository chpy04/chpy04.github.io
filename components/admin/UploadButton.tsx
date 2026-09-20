'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useSite } from '@/components/SiteProvider';
import { ALLOWED_UPLOAD_TYPES, acceptAttribute } from '@/lib/storage/media';

interface UploadButtonProps {
  /** The control's own name: "Upload a PDF". */
  label: string;
  /** Called with the public URL once the file is in the bucket. */
  onUploaded: (url: string) => void;
  accept?: readonly string[];
}

/**
 * An upload control for an `AdminStrip`, for a file with nothing on the page
 * to drop it onto — the resume PDF is a download button, not a picture.
 *
 * `UploadZone` is the one to use anywhere there *is* an image: dropping on
 * the thing you are replacing is the better gesture, and it needs no strip.
 * This takes a drop too, but its point is the click.
 */
export default function UploadButton({
  label,
  onUploaded,
  accept = ALLOWED_UPLOAD_TYPES,
}: UploadButtonProps) {
  const { uploadMedia } = useSite();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

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

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttribute(accept)}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          void take(files);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded border px-2 py-0.5 text-edit-ink transition-colors ${
          dragging ? 'border-edit bg-edit/20' : 'border-edit/40 hover:border-edit hover:bg-edit/10'
        }`}
      >
        {busy ? 'Uploading…' : label}
      </button>
    </>
  );
}
