'use client';

import { useState } from 'react';
import Button from '@/components/portfolio/Button';

export const SECTIONS = [
  { id: 'projects', label: 'Projects' },
  { id: 'about', label: 'About' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'resume', label: 'Resume' },
];

const ICON_BUTTON =
  'rounded-lg p-2 text-ink transition-colors hover:bg-surface-2/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/70';

function HomeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 7h16M4 12h16M4 17h16'}
      />
    </svg>
  );
}

function HomeLink() {
  return (
    <a href="#top" aria-label="Back to top" className={ICON_BUTTON}>
      <HomeIcon />
    </a>
  );
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-ink/5 bg-canvas/60 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto max-w-7xl px-[5%]">
        {/* Desktop */}
        <div className="hidden items-center justify-between py-2 tablet:flex">
          <HomeLink />
          <div className="flex items-center gap-1">
            {SECTIONS.map((section) => (
              <Button key={section.id} href={`#${section.id}`}>
                {section.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Mobile */}
        <div className="tablet:hidden">
          <div className="flex items-center justify-between py-2">
            <HomeLink />
            <button
              type="button"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className={ICON_BUTTON}
            >
              <MenuIcon open={menuOpen} />
            </button>
          </div>

          {menuOpen ? (
            <div className="pb-3 motion-safe:animate-menu-in">
              <div className="flex flex-col rounded-xl border border-line bg-surface/95 p-2">
                {SECTIONS.map((section) => (
                  <Button
                    key={section.id}
                    href={`#${section.id}`}
                    onClick={() => setMenuOpen(false)}
                    className="justify-start"
                  >
                    {section.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
