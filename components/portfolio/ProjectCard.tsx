'use client';

import Image from 'next/image';
import { useState } from 'react';
import AdminField from '@/components/admin/AdminField';
import AdminStrip from '@/components/admin/AdminStrip';
import ArchiveToggle from '@/components/admin/ArchiveToggle';
import EditableText from '@/components/admin/EditableText';
import ProjectModal from '@/components/portfolio/ProjectModal';
import { useSite } from '@/components/SiteProvider';
import { canNudge } from '@/lib/reorder';
import type { Project } from '@/lib/types';

interface ProjectCardProps {
  project: Project;
  /** The ids currently on screen, in order — what the move arrows step
   *  through. Archived rows are excluded, so the arrows skip them. */
  visibleIds: string[];
}

function GithubIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DetailsIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

const CARD =
  'group relative flex h-full w-full flex-col rounded-xl border border-line-soft bg-ink/[0.02] p-3 text-left transition-colors duration-200 hover:border-line-hover hover:bg-ink/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/70';

/**
 * One card in the grid. It renders as three different things depending on
 * the data and the mode:
 *
 *   - a link, when the project has an `externalUrl`;
 *   - a button opening the write-up modal, when it has a `writeup`;
 *   - a plain div while editing, so a double-click on the title reaches the
 *     title rather than navigating away.
 *
 * That last one is the reason the edit layer has an on/off switch at all.
 */
export default function ProjectCard({ project, visibleIds }: ProjectCardProps) {
  const { editing, saveProject, addCategory, saveCategory, nudgeProject } = useSite();
  const [modalOpen, setModalOpen] = useState(false);

  const hasWriteup = project.writeup.trim().length > 0;
  const action = project.externalUrl ? 'View on GitHub' : 'View project details';

  const body = (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <EditableText
          as="h3"
          value={project.title}
          onSave={(title) => saveProject(project.id, { title })}
          placeholder="Project title"
          className="text-xl font-medium laptop:text-2xl"
        />
        {project.externalUrl || hasWriteup ? (
          <span
            title={action}
            className="shrink-0 rounded-full border border-line-strong bg-surface p-2 text-ink transition-colors duration-200 group-hover:border-ink-faint group-hover:bg-surface-2"
          >
            {project.externalUrl ? <GithubIcon /> : <DetailsIcon />}
            <span className="sr-only">{action}</span>
          </span>
        ) : null}
      </div>

      <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
        {project.imagePath ? (
          <Image
            alt=""
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
            src={project.imagePath}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="h-full w-full rounded-lg border border-dashed border-line" />
        )}
      </div>

      <EditableText
        as="p"
        value={project.subtitle}
        onSave={(subtitle) => saveProject(project.id, { subtitle })}
        placeholder="One line about it"
        className="mt-3 text-sm text-ink-dim"
      />

      <ul className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        {project.categories.map((category) => (
          <li
            key={category.id}
            className={`flex items-center gap-1 rounded-full border border-tag/20 bg-tag/10 px-2 py-0.5 text-xs text-tag-ink/80 ${
              category.isArchived ? 'opacity-40' : ''
            }`}
          >
            <EditableText
              value={category.label}
              onSave={(label) => saveCategory(category.id, { label })}
              placeholder="Tag"
            />
            {editing ? (
              <button
                type="button"
                onClick={() => saveCategory(category.id, { isArchived: !category.isArchived })}
                aria-label={
                  category.isArchived
                    ? `Restore tag ${category.label}`
                    : `Archive tag ${category.label}`
                }
                className="text-edit-ink hover:text-edit"
              >
                {category.isArchived ? '+' : '×'}
              </button>
            ) : null}
          </li>
        ))}
        {editing ? (
          <li>
            <button
              type="button"
              onClick={() => addCategory(project.id)}
              className="rounded-full border border-dashed border-edit/50 px-2 py-0.5 text-xs text-edit-ink hover:border-edit"
            >
              + tag
            </button>
          </li>
        ) : null}
      </ul>
    </>
  );

  return (
    <div className={`flex w-full flex-col ${project.isArchived ? 'opacity-50' : ''}`}>
      {editing ? (
        <div className={CARD}>{body}</div>
      ) : project.externalUrl ? (
        <a href={project.externalUrl} target="_blank" rel="noopener noreferrer" className={CARD}>
          {body}
        </a>
      ) : hasWriteup ? (
        <button type="button" onClick={() => setModalOpen(true)} className={CARD}>
          {body}
        </button>
      ) : (
        <div className={CARD}>{body}</div>
      )}

      <AdminStrip>
        {/* The keyboard path to the same thing dragging does. A grid that
            can only be reordered by dragging cannot be reordered at all by
            anyone using a keyboard or a screen reader. */}
        <div className="flex items-center gap-1">
          <MoveButton
            direction={-1}
            title={project.title}
            disabled={!canNudge(visibleIds, project.id, -1)}
            onClick={() => nudgeProject(project.id, -1)}
          />
          <MoveButton
            direction={1}
            title={project.title}
            disabled={!canNudge(visibleIds, project.id, 1)}
            onClick={() => nudgeProject(project.id, 1)}
          />
        </div>
        <AdminField
          label="Image"
          value={project.imagePath}
          placeholder="/images/projects/x.png"
          onCommit={(imagePath) => saveProject(project.id, { imagePath })}
          className="flex-1"
        />
        <AdminField
          label="Link"
          type="url"
          value={project.externalUrl ?? ''}
          placeholder="blank opens the write-up"
          onCommit={(next) =>
            saveProject(project.id, { externalUrl: next.trim().length > 0 ? next : null })
          }
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded border border-edit/40 px-2 py-0.5 text-edit-ink transition-colors hover:border-edit hover:bg-edit/10"
        >
          {hasWriteup ? 'Edit write-up' : 'Add write-up'}
        </button>
        <ArchiveToggle
          isArchived={project.isArchived}
          onArchive={() => saveProject(project.id, { isArchived: true })}
          onRestore={() => saveProject(project.id, { isArchived: false })}
          label={project.title}
        />
      </AdminStrip>

      {/* Mounted only while open so a grid of eleven cards is not eleven
          dialogs and eleven markdown renderers in the DOM at rest. */}
      {modalOpen ? (
        <ProjectModal
          project={project}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaveWriteup={(writeup) => saveProject(project.id, { writeup })}
        />
      ) : null}
    </div>
  );
}

interface MoveButtonProps {
  direction: 1 | -1;
  title: string;
  disabled: boolean;
  onClick: () => void;
}

function MoveButton({ direction, title, disabled, onClick }: MoveButtonProps) {
  const word = direction === -1 ? 'earlier' : 'later';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Move ${title} ${word}`}
      className="rounded border border-edit/40 px-1.5 py-0.5 text-edit-ink transition-colors hover:border-edit hover:bg-edit/10 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {direction === -1 ? '\u2190' : '\u2192'}
    </button>
  );
}
