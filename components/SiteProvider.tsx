'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ApiError,
  createProject,
  createProjectCategory,
  createSocial,
  createTimelineEntry,
  getContent,
  getSession,
  updateProfile,
  updateProject,
  updateProjectCategory,
  reorderProjects,
  updateSocial,
  updateTimelineEntry,
  type ProfilePatch,
  type ProjectPatch,
  type TimelinePatch,
} from '@/lib/api-client';
import { AUTH_EXPIRED_EVENT } from '@/lib/auth-client';
import { moveTo, nudge } from '@/lib/reorder';
import type { Project, SiteContent, SocialLink, TimelineEntry } from '@/lib/types';

/**
 * The container for the whole page: it owns the content, the admin state,
 * and **every network call**. Everything below it is presentational and
 * edits through the callbacks here.
 *
 * It is a context rather than props because the alternative is threading a
 * save callback through five levels to reach a timeline card's job title,
 * and a page whose entire purpose is that every string is editable would be
 * mostly prop plumbing.
 *
 * Two things arrive from two different places on purpose. `initialContent`
 * is server-rendered and public — archived rows already stripped — so the
 * page paints complete with no spinner and no fetch. Then, and only if the
 * session turns out to own this site, it re-reads `GET /api/content` for
 * the full set including archived rows, which a reader is never sent.
 */

/** Persisted so the owner is not toggling this on every page load. */
const EDITING_KEY = 'portfolio.editing';

interface SiteContextValue {
  content: SiteContent;
  /** This session owns the site on screen and may edit it. */
  canEdit: boolean;
  /** Edit affordances are live. Never true unless `canEdit`. */
  editing: boolean;
  setEditing: (on: boolean) => void;
  showArchived: boolean;
  setShowArchived: (on: boolean) => void;
  /** The last failed save. Surfaced once, by the toolbar. */
  error: string | null;
  dismissError: () => void;

  saveProfile: (patch: ProfilePatch) => void;
  addSocial: () => void;
  saveSocial: (id: string, patch: Partial<Omit<SocialLink, 'id'>>) => void;
  addProject: () => void;
  saveProject: (id: string, patch: ProjectPatch) => void;
  /** Drops `id` into `targetId`'s slot. The drag gesture. */
  moveProjectTo: (id: string, targetId: string) => void;
  /** Moves `id` one slot as displayed, skipping hidden rows. The buttons. */
  nudgeProject: (id: string, delta: 1 | -1) => void;
  addCategory: (projectId: string) => void;
  saveCategory: (id: string, patch: Partial<{ label: string; isArchived: boolean }>) => void;
  addTimelineEntry: () => void;
  saveTimelineEntry: (id: string, patch: TimelinePatch) => void;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function useSite(): SiteContextValue {
  const value = useContext(SiteContext);
  if (!value) throw new Error('useSite must be used inside <SiteProvider>');
  return value;
}

/** Entries are ordered by start date, so an edit to a date moves the entry.
 *  Re-sorting here keeps the client in step with what the server would
 *  return without paying for a refetch. Ties break on id, as in SQL. */
function byStart(a: TimelineEntry, b: TimelineEntry): number {
  if (a.startsOn !== b.startsOn) return a.startsOn < b.startsOn ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

/** Today as 'YYYY-MM-DD' in local time — `toISOString()` would be UTC and
 *  hand tomorrow's date to anyone east of Greenwich after their evening. */
function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

interface SiteProviderProps {
  initialContent: SiteContent;
  children: ReactNode;
}

export default function SiteProvider({ initialContent, children }: SiteProviderProps) {
  const [content, setContent] = useState(initialContent);
  const [canEdit, setCanEdit] = useState(false);
  const [editingPreference, setEditingPreference] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ask the server who we are. A 401 is the ordinary case here — the
  // portfolio is public — so it is not an error state, just "no edit layer".
  useEffect(() => {
    let cancelled = false;

    async function check(): Promise<void> {
      try {
        const session = await getSession();
        if (cancelled || !session.isSiteOwner) return;
        setCanEdit(true);
        // Only now pick up the archived rows the public payload omits.
        setContent(await getContent());
      } catch {
        if (!cancelled) setCanEdit(false);
      }
    }

    void check();

    function handleExpired(): void {
      setCanEdit(false);
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    };
  }, []);

  // Read the stored preference after mount, never during render: the server
  // has no localStorage, and branching on it in the initial state would
  // hydrate a different tree than was sent.
  useEffect(() => {
    setEditingPreference(window.localStorage.getItem(EDITING_KEY) !== 'false');
  }, []);

  const setEditing = useCallback((on: boolean) => {
    setEditingPreference(on);
    window.localStorage.setItem(EDITING_KEY, String(on));
  }, []);

  /**
   * Runs one save. Every mutator below goes through this so the error
   * handling is written once: `ApiError` carries the server's own message,
   * anything else is a network failure and gets a generic one. Never a
   * blank screen, and never a silently dropped edit.
   */
  const save = useCallback(async function save<T>(
    request: () => Promise<T>,
    apply: (result: T) => void,
    fallback: string,
  ): Promise<void> {
    try {
      apply(await request());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    }
  }, []);

  const value = useMemo<SiteContextValue>(() => {
    const replaceSocial = (updated: SocialLink) =>
      setContent((current) => ({
        ...current,
        socials: current.socials.map((row) => (row.id === updated.id ? updated : row)),
      }));

    const replaceProject = (updated: Project) =>
      setContent((current) => ({
        ...current,
        projects: current.projects.map((row) => (row.id === updated.id ? updated : row)),
      }));

    const projectIds = content.projects.map((row) => row.id);
    const visibleProjectIds = content.projects
      .filter((row) => showArchived || !row.isArchived)
      .map((row) => row.id);

    /**
     * Applies a new order optimistically, then confirms it with the server.
     *
     * Optimistic here and nowhere else in this file: a reorder is direct
     * manipulation, and a card that snaps back for a round trip before
     * landing reads as the drag having failed. It does not go through
     * `save()` because it is the one mutation that needs a rollback — the
     * others have nothing to roll back to, since the screen only changes
     * once the server has answered.
     */
    const applyProjectOrder = (ids: string[]) => {
      const byId = new Map(content.projects.map((row) => [row.id, row]));
      const reordered = ids.map((id) => byId.get(id)).filter((row): row is Project => Boolean(row));
      // A short list would drop rows on the floor; `nudge`/`moveTo` return
      // the list unchanged rather than a partial one, so this is a guard
      // against a future caller, not a case that happens today.
      if (reordered.length !== content.projects.length) return;

      const previous = content.projects;
      setContent((current) => ({ ...current, projects: reordered }));

      void (async () => {
        try {
          const projects = await reorderProjects(ids);
          setContent((current) => ({ ...current, projects }));
          setError(null);
        } catch (err) {
          // Put the old order back: leaving the optimistic one on screen
          // would show an order the database does not have.
          setContent((current) => ({ ...current, projects: previous }));
          setError(err instanceof ApiError ? err.message : 'Could not save that order.');
        }
      })();
    };

    const replaceEntry = (updated: TimelineEntry) =>
      setContent((current) => ({
        ...current,
        timeline: current.timeline
          .map((row) => (row.id === updated.id ? updated : row))
          .sort(byStart),
      }));

    return {
      content,
      canEdit,
      editing: canEdit && editingPreference,
      setEditing,
      showArchived,
      setShowArchived,
      error,
      dismissError: () => setError(null),

      saveProfile: (patch) =>
        void save(
          () => updateProfile(patch),
          (profile) => setContent((current) => ({ ...current, profile })),
          'Could not save that.',
        ),

      addSocial: () =>
        void save(
          () => createSocial('New link', 'https://example.com'),
          (created) =>
            setContent((current) => ({ ...current, socials: [...current.socials, created] })),
          'Could not add a link.',
        ),

      saveSocial: (id, patch) =>
        void save(() => updateSocial(id, patch), replaceSocial, 'Could not save that link.'),

      addProject: () =>
        void save(
          () => createProject('New project'),
          (created) =>
            setContent((current) => ({ ...current, projects: [...current.projects, created] })),
          'Could not add a project.',
        ),

      saveProject: (id, patch) =>
        void save(() => updateProject(id, patch), replaceProject, 'Could not save that project.'),

      moveProjectTo: (id, targetId) => applyProjectOrder(moveTo(projectIds, id, targetId)),

      nudgeProject: (id, delta) =>
        applyProjectOrder(nudge(projectIds, visibleProjectIds, id, delta)),

      addCategory: (projectId) =>
        void save(
          () => createProjectCategory(projectId, 'New tag'),
          (created) =>
            setContent((current) => ({
              ...current,
              projects: current.projects.map((row) =>
                row.id === projectId ? { ...row, categories: [...row.categories, created] } : row,
              ),
            })),
          'Could not add a tag.',
        ),

      saveCategory: (id, patch) =>
        void save(
          () => updateProjectCategory(id, patch),
          (updated) =>
            setContent((current) => ({
              ...current,
              projects: current.projects.map((row) => ({
                ...row,
                categories: row.categories.map((c) => (c.id === updated.id ? updated : c)),
              })),
            })),
          'Could not save that tag.',
        ),

      addTimelineEntry: () =>
        void save(
          () =>
            createTimelineEntry({
              organization: 'New organization',
              title: 'New entry',
              startsOn: todayIso(),
              kind: 'employment',
            }),
          (created) =>
            setContent((current) => ({
              ...current,
              timeline: [...current.timeline, created].sort(byStart),
            })),
          'Could not add a timeline entry.',
        ),

      saveTimelineEntry: (id, patch) =>
        void save(() => updateTimelineEntry(id, patch), replaceEntry, 'Could not save that entry.'),
    };
  }, [content, canEdit, editingPreference, setEditing, showArchived, error, save]);

  return <SiteContext value={value}>{children}</SiteContext>;
}
