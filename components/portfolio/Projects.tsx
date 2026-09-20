'use client';

import { useState, type DragEvent } from 'react';
import AddButton from '@/components/admin/AddButton';
import ProjectCard from '@/components/portfolio/ProjectCard';
import Section from '@/components/portfolio/Section';
import { useSite } from '@/components/SiteProvider';

/**
 * The grid, and the owner's reordering of it.
 *
 * Drag-and-drop is the native HTML5 kind — `draggable` plus the four
 * events — rather than a library. The whole gesture is "which card was
 * picked up, which card was it dropped on", and the arithmetic that
 * follows lives in `lib/reorder.ts` with tests. A drag library would be a
 * dependency for the part that is already free.
 *
 * `dataTransfer` carries the id as `text/plain` even though `draggedId`
 * state would be enough: without setting *some* data, Firefox refuses to
 * start the drag at all. It deliberately carries no files, which is what
 * keeps the feedback widget's screenshot dropzone from lighting up
 * (`lib/feedback/drag.ts`).
 */
export default function Projects() {
  const { content, editing, showArchived, addProject, moveProjectTo } = useSite();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const visible = content.projects.filter((project) => showArchived || !project.isArchived);

  function handleDragStart(event: DragEvent<HTMLLIElement>, id: string): void {
    setDraggedId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>, id: string): void {
    if (!draggedId || draggedId === id) return;
    // Without preventDefault the browser treats this as "not a drop target"
    // and the drop event never fires.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetId(id);
  }

  function handleDrop(event: DragEvent<HTMLLIElement>, id: string): void {
    event.preventDefault();
    const moved = draggedId;
    setDraggedId(null);
    setDropTargetId(null);
    if (moved && moved !== id) moveProjectTo(moved, id);
  }

  function endDrag(): void {
    setDraggedId(null);
    setDropTargetId(null);
  }

  return (
    <Section id="projects" title="Projects">
      {editing ? (
        <p className="mb-4 text-sm text-edit-ink/70">
          Drag a card to reorder, or use the arrows on each one.
        </p>
      ) : null}

      <ul className="grid grid-cols-1 gap-5 tablet:grid-cols-2 laptop:grid-cols-3 laptop:gap-6">
        {visible.map((project) => (
          <li
            key={project.id}
            draggable={editing}
            onDragStart={(event) => handleDragStart(event, project.id)}
            onDragOver={(event) => handleDragOver(event, project.id)}
            onDragLeave={() =>
              setDropTargetId((current) => (current === project.id ? null : current))
            }
            onDrop={(event) => handleDrop(event, project.id)}
            onDragEnd={endDrag}
            className={`flex transition-opacity ${editing ? 'cursor-grab active:cursor-grabbing' : ''} ${
              draggedId === project.id ? 'opacity-40' : ''
            } ${
              dropTargetId === project.id
                ? 'rounded-xl ring-2 ring-edit ring-offset-2 ring-offset-canvas'
                : ''
            }`}
          >
            <ProjectCard project={project} visibleIds={visible.map((row) => row.id)} />
          </li>
        ))}
      </ul>

      <AddButton label="Project" onClick={addProject} className="mt-5" />
    </Section>
  );
}
