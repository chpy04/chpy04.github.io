import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary';

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  /** Renders an anchor instead of a button. */
  href?: string;
  /** Opens the link in a new tab with safe rel attributes. */
  external?: boolean;
  download?: boolean;
  onClick?: () => void;
  className?: string;
}

const BASE =
  'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 tablet:text-base';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-canvas hover:bg-ink-soft',
  secondary: 'text-ink hover:bg-surface-2/70',
};

export default function Button({
  children,
  variant = 'secondary',
  href,
  external,
  download,
  onClick,
  className = '',
}: ButtonProps) {
  const classes = `${BASE} ${VARIANTS[variant]} ${className}`;

  if (href) {
    return (
      <a
        href={href}
        onClick={onClick}
        download={download}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className={classes}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
