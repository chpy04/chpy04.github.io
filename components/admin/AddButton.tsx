'use client';

import { useSite } from '@/components/SiteProvider';

interface AddButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
}

/**
 * "Add a project" and friends. Creates a row of placeholder text rather
 * than opening a form: the page is the editor, so the fastest path to a new
 * entry is one that puts something on screen to double-click.
 */
export default function AddButton({ label, onClick, className = '' }: AddButtonProps) {
  const { editing } = useSite();
  if (!editing) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border border-dashed border-edit/50 px-3 py-2 text-sm text-edit-ink transition-colors hover:border-edit hover:bg-edit/10 ${className}`}
    >
      + {label}
    </button>
  );
}
