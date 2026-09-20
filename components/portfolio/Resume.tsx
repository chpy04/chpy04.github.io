'use client';

import Image from 'next/image';
import AdminField from '@/components/admin/AdminField';
import AdminStrip from '@/components/admin/AdminStrip';
import Button from '@/components/portfolio/Button';
import Section from '@/components/portfolio/Section';
import { useSite } from '@/components/SiteProvider';

export default function Resume() {
  const { content, saveProfile } = useSite();
  const { resumeImagePath, resumePdfPath } = content.profile;

  return (
    <Section
      id="resume"
      title="Resume"
      action={
        resumePdfPath ? (
          <Button href={resumePdfPath} download variant="primary">
            Download Resume
          </Button>
        ) : null
      }
    >
      <div className="relative mx-auto w-full max-w-4xl">
        <div
          aria-hidden="true"
          className="absolute -inset-8 rounded-lg bg-gradient-to-r from-glow-pink/40 to-glow-indigo/30 opacity-30 blur-3xl"
        />
        {resumeImagePath ? (
          <Image
            src={resumeImagePath}
            alt="Resume"
            width={1200}
            height={1600}
            sizes="(max-width: 1024px) 100vw, 896px"
            className="relative h-auto w-full rounded-lg shadow-lg"
          />
        ) : (
          <div className="relative aspect-[3/4] w-full rounded-lg border border-dashed border-line" />
        )}
      </div>

      <AdminStrip className="mx-auto max-w-4xl">
        <AdminField
          label="Image"
          value={resumeImagePath}
          placeholder="/images/resume.png"
          onCommit={(next) => saveProfile({ resumeImagePath: next })}
        />
        <AdminField
          label="PDF"
          value={resumePdfPath}
          placeholder="/Chris-Pyle-CV.pdf"
          onCommit={(next) => saveProfile({ resumePdfPath: next })}
        />
      </AdminStrip>
    </Section>
  );
}
