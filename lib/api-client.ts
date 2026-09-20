/**
 * Typed client for the routes documented in `docs/API.md`. This is the only
 * module that knows URL shapes — every component calls through here so the
 * URLs, request bodies, and response parsing live in exactly one place.
 * ESLint blocks bare `fetch` under `components/**` and `app/**` to keep it
 * that way.
 *
 * Note what is *not* here: a public read. The portfolio is server-rendered
 * from `lib/queries/content.ts`, so a reader never calls this module at
 * all. Everything below is either the session probe or an edit — which is
 * why every request goes through `authedFetch`.
 */

import { authedFetch } from './auth-client.ts';
import type { FeedbackKind } from './feedback/issue.ts';
import type {
  Project,
  ProjectCategory,
  SessionInfo,
  SiteContent,
  SiteProfile,
  SocialLink,
  TimelineEntry,
  TimelineKind,
} from './types.ts';

const JSON_HEADERS = { 'content-type': 'application/json' } as const;

/** Thrown for any non-2xx response. Carries the server's `{ error }` message
 *  when present, so a component can show it rather than a blank screen. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body && typeof body.error === 'string' && body.error.length > 0) {
      return body.error;
    }
  } catch {
    // Body wasn't JSON (or was empty) — fall through to a generic message.
  }
  return `Request failed with status ${response.status}`;
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await authedFetch(input, init);
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response));
  }
  // 204 No Content has no body to parse.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function jsonBody(method: 'POST' | 'PATCH' | 'PUT', body: unknown): RequestInit {
  return { method, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * `POST /api/auth` — the one request made before a token exists, so it is
 * also the one that cannot use `authedFetch`'s 401 handling: a wrong
 * password is the expected outcome, not an expired session. Returns the
 * minted token, or `null` when the password was rejected.
 */
export async function login(password: string): Promise<string | null> {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ password }),
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response));
  }
  const body = (await response.json()) as { token: string };
  return body.token;
}

/**
 * `GET /api/session` — who the server thinks we are, and whether that
 * account owns the portfolio on screen. Throws `ApiError` with status 401
 * when there is no session, which for this app is the ordinary case: a
 * reader is anonymous and simply gets no edit layer.
 */
export async function getSession(): Promise<SessionInfo> {
  return requestJson<SessionInfo>('/api/session');
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/** `GET /api/content` — the whole page including archived rows. The admin
 *  layer calls this once, after confirming a session, to pick up the rows
 *  the server-rendered public HTML left out. */
export async function getContent(): Promise<SiteContent> {
  return requestJson<SiteContent>('/api/content');
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export type ProfilePatch = Partial<Omit<SiteProfile, 'id'>>;

export async function updateProfile(patch: ProfilePatch): Promise<SiteProfile> {
  return requestJson<SiteProfile>('/api/profile', jsonBody('PATCH', patch));
}

// ---------------------------------------------------------------------------
// Social links
// ---------------------------------------------------------------------------

export async function createSocial(label: string, url: string): Promise<SocialLink> {
  return requestJson<SocialLink>('/api/socials', jsonBody('POST', { label, url }));
}

export async function updateSocial(
  id: string,
  patch: Partial<{ label: string; url: string; isArchived: boolean }>,
): Promise<SocialLink> {
  return requestJson<SocialLink>(`/api/socials/${id}`, jsonBody('PATCH', patch));
}

/** Archiving is how content is removed here; there is no DELETE. */
export async function archiveSocial(id: string): Promise<SocialLink> {
  return updateSocial(id, { isArchived: true });
}

export async function reorderSocials(ids: string[]): Promise<SocialLink[]> {
  return requestJson<SocialLink[]>('/api/socials', jsonBody('PUT', { ids }));
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export type ProjectPatch = Partial<{
  title: string;
  subtitle: string;
  imagePath: string;
  externalUrl: string | null;
  writeup: string;
  isArchived: boolean;
}>;

export async function createProject(title: string): Promise<Project> {
  return requestJson<Project>('/api/projects', jsonBody('POST', { title }));
}

export async function updateProject(id: string, patch: ProjectPatch): Promise<Project> {
  return requestJson<Project>(`/api/projects/${id}`, jsonBody('PATCH', patch));
}

export async function archiveProject(id: string): Promise<Project> {
  return updateProject(id, { isArchived: true });
}

export async function reorderProjects(ids: string[]): Promise<Project[]> {
  return requestJson<Project[]>('/api/projects', jsonBody('PUT', { ids }));
}

export async function createProjectCategory(
  projectId: string,
  label: string,
): Promise<ProjectCategory> {
  return requestJson<ProjectCategory>(`/api/projects/${projectId}`, jsonBody('POST', { label }));
}

export async function updateProjectCategory(
  categoryId: string,
  patch: Partial<{ label: string; isArchived: boolean }>,
): Promise<ProjectCategory> {
  return requestJson<ProjectCategory>(
    `/api/project-categories/${categoryId}`,
    jsonBody('PATCH', patch),
  );
}

export async function archiveProjectCategory(categoryId: string): Promise<ProjectCategory> {
  return updateProjectCategory(categoryId, { isArchived: true });
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export type TimelinePatch = Partial<{
  organization: string;
  title: string;
  description: string;
  startsOn: string;
  endsOn: string | null;
  kind: TimelineKind;
  thumbnailPath: string;
  isArchived: boolean;
}>;

export interface NewTimelineEntry {
  organization: string;
  title: string;
  startsOn: string;
  kind: TimelineKind;
}

export async function createTimelineEntry(entry: NewTimelineEntry): Promise<TimelineEntry> {
  return requestJson<TimelineEntry>('/api/timeline', jsonBody('POST', entry));
}

export async function updateTimelineEntry(
  id: string,
  patch: TimelinePatch,
): Promise<TimelineEntry> {
  return requestJson<TimelineEntry>(`/api/timeline/${id}`, jsonBody('PATCH', patch));
}

export async function archiveTimelineEntry(id: string): Promise<TimelineEntry> {
  return updateTimelineEntry(id, { isArchived: true });
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export interface FeedbackResult {
  /** Which sink took it — a GitHub issue, or a file under `feedback/`. */
  target: 'github' | 'local';
  /** `#42`, or the path of the written report. */
  reference: string;
  /** Somewhere to click, or null for a local file. */
  url: string | null;
  /** False if the report was filed but its screenshot could not be stored. */
  screenshotUploaded: boolean;
}

export interface FeedbackInput {
  kind: FeedbackKind;
  description: string;
  url: string;
  viewport?: string;
  userAgent?: string;
  screenshot?: File | null;
}

/**
 * `POST /api/feedback`. Multipart, not JSON, because a screenshot rides
 * along and base64-in-JSON would inflate it ~33% against the host's
 * request-body ceiling. Deliberately sets no `content-type` so the browser
 * writes the multipart boundary itself.
 *
 * `404` means this deployment ships without the widget (see
 * `lib/feedback/enabled.ts`); `502` means GitHub itself refused.
 */
export function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const form = new FormData();
  form.set('kind', input.kind);
  form.set('description', input.description);
  form.set('url', input.url);
  if (input.viewport) form.set('viewport', input.viewport);
  if (input.userAgent) form.set('userAgent', input.userAgent);
  if (input.screenshot) form.set('screenshot', input.screenshot, input.screenshot.name);

  return requestJson<FeedbackResult>('/api/feedback', { method: 'POST', body: form });
}
