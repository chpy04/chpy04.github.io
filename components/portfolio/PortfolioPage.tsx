'use client';

import AdminToolbar from '@/components/admin/AdminToolbar';
import FeedbackMount from '@/components/feedback/FeedbackMount';
import About from '@/components/portfolio/About';
import Header from '@/components/portfolio/Header';
import Hero from '@/components/portfolio/Hero';
import Projects from '@/components/portfolio/Projects';
import Resume from '@/components/portfolio/Resume';
import Timeline from '@/components/portfolio/timeline/Timeline';
import SiteProvider from '@/components/SiteProvider';
import type { SiteContent } from '@/lib/types';

interface PortfolioPageProps {
  /** Server-rendered, public (archived rows already stripped). The provider
   *  re-reads the full set only if the visitor turns out to own the site. */
  initialContent: SiteContent;
  /** Decided on the server by `lib/feedback/enabled.ts` and passed down, so
   *  the browser never has to ask which kind of deployment it is on. */
  feedbackEnabled: boolean;
}

export default function PortfolioPage({ initialContent, feedbackEnabled }: PortfolioPageProps) {
  return (
    <SiteProvider initialContent={initialContent}>
      <div className="gradient-circle" />
      <div className="gradient-circle-middle" />

      <Header />

      <main id="top" className="relative pb-24">
        <Hero />
        <Projects />
        <About />
        <Timeline />
        <Resume />
      </main>

      <AdminToolbar />
      <FeedbackMount enabled={feedbackEnabled} />
    </SiteProvider>
  );
}
