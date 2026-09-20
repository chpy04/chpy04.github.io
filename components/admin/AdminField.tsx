'use client';

import { useEffect, useState, type ChangeEvent } from 'react';

interface AdminFieldProps {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  type?: 'text' | 'url' | 'date';
  placeholder?: string;
  className?: string;
}

/**
 * A labelled input inside an `AdminStrip`, for the parts of an item that
 * are not text on the page — an image path, a link, a date.
 *
 * Locally controlled, committed on blur (and on change for a date, where
 * the picker's "done" is a change and there may never be a blur). Writing
 * straight through to the provider on every keystroke would be one request
 * per character.
 */
export default function AdminField({
  label,
  value,
  onCommit,
  type = 'text',
  placeholder,
  className = '',
}: AdminFieldProps) {
  const [draft, setDraft] = useState(value);

  // Re-sync when the saved value changes underneath — after a save the
  // server's version is authoritative, and it may differ (a trim, say).
  useEffect(() => setDraft(value), [value]);

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    setDraft(event.target.value);
    if (type === 'date') onCommit(event.target.value);
  }

  return (
    <label className={`flex items-center gap-1.5 ${className}`}>
      <span className="text-edit-ink/70">{label}</span>
      <input
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={handleChange}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
        className="min-w-0 rounded border border-edit/30 bg-canvas/60 px-1.5 py-0.5 text-ink outline-none focus:border-edit"
      />
    </label>
  );
}
