'use client';

import EditableText from '@/components/admin/EditableText';
import Markdown from '@/components/portfolio/Markdown';
import Section from '@/components/portfolio/Section';
import { useSite } from '@/components/SiteProvider';

export default function About() {
  const { content, saveProfile } = useSite();
  const { about } = content.profile;

  return (
    <Section id="about" title="About">
      <EditableText
        as="div"
        multiline
        value={about}
        onSave={(next) => saveProfile({ about: next })}
        placeholder="Write a paragraph about yourself."
        className="max-w-4xl text-base text-ink-soft tablet:text-lg laptop:text-xl"
      >
        {/* Stored as markdown, edited as markdown, rendered as HTML. The
            `prose` sizing is the section's, not the default, so the
            paragraph keeps the same measure it had as plain text. */}
        <Markdown compact className="prose-p:text-ink-soft">
          {about}
        </Markdown>
      </EditableText>
    </Section>
  );
}
