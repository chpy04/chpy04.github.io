import type { ReactNode } from 'react';

/** The page's horizontal rhythm. Every band of content is inside one of
 *  these, so the hero, the grid and the timeline all line up. */
export const SHELL = 'mx-auto w-full max-w-7xl px-5 tablet:px-8';

interface SectionProps {
  /** Doubles as the anchor the header's nav links scroll to. */
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export default function Section({ id, title, action, children }: SectionProps) {
  return (
    <section id={id} className={`${SHELL} mt-20 tablet:mt-28`}>
      <div className="mb-6 flex flex-col gap-4 tablet:mb-8 tablet:flex-row tablet:items-center tablet:justify-between">
        <h2 className="text-3xl font-bold tablet:text-4xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
