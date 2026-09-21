'use client';

import Image from 'next/image';
import AdminField from '@/components/admin/AdminField';
import AdminStrip from '@/components/admin/AdminStrip';
import UploadButton from '@/components/admin/UploadButton';
import UploadZone from '@/components/admin/UploadZone';
import Button from '@/components/portfolio/Button';
import Section from '@/components/portfolio/Section';
import { useSite } from '@/components/SiteProvider';
import { ALLOWED_DOCUMENT_TYPES, downloadUrl } from '@/lib/storage/media';

export default function Resume() {
  const { content, saveProfile } = useSite();
  const { resumeImagePath, resumePdfPath } = content.profile;

  return (
    <Section
      id="resume"
      title="Resume"
      action={
        resumePdfPath ? (
          <Button href={downloadUrl(resumePdfPath)} download variant="primary">
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
        <UploadZone
          label="resume image"
          onUploaded={(next) => saveProfile({ resumeImagePath: next })}
        />
      </div>

      <AdminStrip className="mx-auto max-w-4xl">
        <AdminField
          label="Image"
          value={resumeImagePath}
          placeholder="drop a file on the image, or paste a URL"
          onCommit={(next) => saveProfile({ resumeImagePath: next })}
        />
        <AdminField
          label="PDF"
          value={resumePdfPath}
          placeholder="the file the download button serves"
          onCommit={(next) => saveProfile({ resumePdfPath: next })}
          className="flex-1"
        />
        {/* The PDF is the one piece of content with nothing on the page to
            drop a file onto — the download button is a link, not a preview. */}
        <UploadButton
          label="Upload a PDF"
          accept={ALLOWED_DOCUMENT_TYPES}
          onUploaded={(next) => saveProfile({ resumePdfPath: next })}
        />
      </AdminStrip>
    </Section>
  );
}
