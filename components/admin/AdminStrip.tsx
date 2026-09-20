'use client';

import type { ReactNode } from 'react';
import { useSite } from '@/components/SiteProvider';

interface AdminStripProps {
  children: ReactNode;
  className?: string;
}

/**
 * The row of controls attached to one editable item: its dates, its link,
 * its archive button.
 *
 * Not everything that belongs to a project or a timeline entry appears on
 * the page as text — an image path and a start date have no span to
 * double-click — so those get a strip like this instead. Rendered only
 * while editing, and deliberately styled as an obvious overlay rather than
 * as part of the design, so the page underneath still reads as the page.
 */
export default function AdminStrip({ children, className = '' }: AdminStripProps) {
  const { editing } = useSite();
  if (!editing) return null;

  return (
    <div
      className={`mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-edit/30 bg-edit-surface/40 px-2.5 py-2 text-xs ${className}`}
    >
      {children}
    </div>
  );
}
