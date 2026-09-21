'use client';

import Image from 'next/image';
import EditableText from '@/components/admin/EditableText';
import AdminField from '@/components/admin/AdminField';
import AdminStrip from '@/components/admin/AdminStrip';
import UploadZone from '@/components/admin/UploadZone';
import Socials from '@/components/portfolio/Socials';
import { SHELL } from '@/components/portfolio/Section';
import { useSite } from '@/components/SiteProvider';

export default function Hero() {
  const { content, saveProfile } = useSite();
  const { profile } = content;

  return (
    <section className={`${SHELL} pt-20 tablet:pt-28`}>
      <div className="flex flex-col-reverse items-center gap-8 laptop:flex-row laptop:items-center laptop:justify-between laptop:gap-12">
        <div className="hero-stagger w-full laptop:flex-1">
          <EditableText
            as="p"
            value={profile.taglineLead}
            onSave={(taglineLead) => saveProfile({ taglineLead })}
            placeholder="Hey there, this is"
            className="text-sm text-ink-dim tablet:text-base"
          />
          <EditableText
            as="h1"
            value={profile.taglineName}
            onSave={(taglineName) => saveProfile({ taglineName })}
            placeholder="Your name"
            className="mt-1 text-4xl leading-tight font-bold tablet:text-6xl tablet:leading-none laptop:text-7xl laptopl:text-8xl"
          />
          <EditableText
            as="p"
            value={profile.taglineRole}
            onSave={(taglineRole) => saveProfile({ taglineRole })}
            placeholder="What you do"
            className="mt-3 text-xl tablet:text-3xl laptop:text-4xl"
          />
          <EditableText
            as="p"
            value={profile.taglineOrg}
            onSave={(taglineOrg) => saveProfile({ taglineOrg })}
            placeholder="Where you do it"
            className="text-xl tablet:text-3xl laptop:text-4xl"
          />
          <Socials className="mt-6" />
        </div>

        <div className="relative w-40 shrink-0 tablet:w-56 laptop:w-[30vw] laptop:max-w-md">
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-full bg-gradient-to-r from-glow-pink/40 to-glow-indigo/30 opacity-30 blur-2xl"
          />
          {profile.headshotPath ? (
            <Image
              src={profile.headshotPath}
              alt={`${profile.name}, portrait`}
              width={1000}
              height={1000}
              sizes="(max-width: 768px) 160px, (max-width: 1024px) 224px, 30vw"
              className="relative h-auto w-full rounded-full shadow-lg"
              priority
            />
          ) : (
            <div className="relative aspect-square w-full rounded-full border border-dashed border-line" />
          )}
          <UploadZone
            round
            label="headshot"
            onUploaded={(headshotPath) => saveProfile({ headshotPath })}
          />
        </div>
      </div>

      <AdminStrip>
        <AdminField
          label="Headshot"
          value={profile.headshotPath}
          placeholder="drop a file on the photo, or paste a URL"
          onCommit={(headshotPath) => saveProfile({ headshotPath })}
        />
        <AdminField
          label="Name"
          value={profile.name}
          placeholder="Used in the page title"
          onCommit={(name) => saveProfile({ name })}
        />
        <AdminField
          label="Meta description"
          value={profile.metaDescription}
          onCommit={(metaDescription) => saveProfile({ metaDescription })}
          className="flex-1"
        />
      </AdminStrip>
    </section>
  );
}
