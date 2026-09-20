'use client';

import AddButton from '@/components/admin/AddButton';
import AdminField from '@/components/admin/AdminField';
import ArchiveToggle from '@/components/admin/ArchiveToggle';
import EditableText from '@/components/admin/EditableText';
import Button from '@/components/portfolio/Button';
import { useSite } from '@/components/SiteProvider';

interface SocialsProps {
  className?: string;
}

export default function Socials({ className = '' }: SocialsProps) {
  const { content, editing, showArchived, addSocial, saveSocial } = useSite();

  const visible = content.socials.filter((social) => showArchived || !social.isArchived);

  return (
    <div className={`flex flex-wrap items-start gap-2 ${className}`}>
      {visible.map((social) =>
        editing ? (
          // While editing these are spans, not links: a double-click on an
          // anchor still fires the click that navigates away first, which
          // would make the label the one string on the page you cannot edit.
          <div
            key={social.id}
            className={`flex flex-col gap-1 rounded-lg border border-edit/30 p-1.5 ${
              social.isArchived ? 'opacity-50' : ''
            }`}
          >
            <EditableText
              value={social.label}
              onSave={(label) => saveSocial(social.id, { label })}
              placeholder="Label"
              className="px-1.5 text-sm tablet:text-base"
            />
            <div className="flex items-center gap-1.5 text-xs">
              <AdminField
                label="URL"
                type="url"
                value={social.url}
                onCommit={(url) => saveSocial(social.id, { url })}
              />
              <ArchiveToggle
                isArchived={social.isArchived}
                onArchive={() => saveSocial(social.id, { isArchived: true })}
                onRestore={() => saveSocial(social.id, { isArchived: false })}
                label={social.label}
              />
            </div>
          </div>
        ) : (
          <Button key={social.id} href={social.url} external={!social.url.startsWith('mailto:')}>
            {social.label}
          </Button>
        ),
      )}

      <AddButton label="Link" onClick={addSocial} className="py-1.5 text-sm" />
    </div>
  );
}
