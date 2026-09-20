/**
 * Shared wire types. The API speaks camelCase; the database speaks snake_case;
 * Drizzle maps between them. See docs/API.md.
 *
 * These are the shapes the browser sees. They are deliberately narrower than
 * the table rows — no `userId`, no `createdAt`/`updatedAt` unless a client
 * actually renders it — and `toWire()` in each query module is what enforces
 * that.
 */

/** The authenticated account. Everything else in this file belongs to exactly
 *  one of these. No password/credential fields — auth is external. */
export interface User {
  id: string;
  email: string;
  name: string | null;
}

/** `GET /api/session` — who the browser is talking as, and how it got there. */
export interface SessionInfo {
  user: User;
  /** 'dev' means the app auto-logged in as the seeded user; see lib/auth-mode.ts. */
  mode: 'dev' | 'password' | 'supabase';
  /** True when this session owns the portfolio being displayed, i.e. may edit
   *  it. Distinct from "is signed in": a second account is signed in but is
   *  not the site owner, and the page must stay read-only for it. */
  isSiteOwner: boolean;
}

// ---------------------------------------------------------------------------
// Portfolio content
// ---------------------------------------------------------------------------

/** The page's singular fields. Every one is inline-editable. */
export interface SiteProfile {
  id: string;
  name: string;
  metaDescription: string;
  taglineLead: string;
  taglineName: string;
  taglineRole: string;
  taglineOrg: string;
  about: string;
  headshotPath: string;
  resumeImagePath: string;
  resumePdfPath: string;
}

/** Which `SiteProfile` fields a PATCH may touch — every one of them. Named
 *  so the route, the client and the editable components agree on the set. */
export type SiteProfileField = Exclude<keyof SiteProfile, 'id'>;

export interface SocialLink {
  id: string;
  label: string;
  url: string;
  isArchived: boolean;
}

export interface ProjectCategory {
  id: string;
  label: string;
  isArchived: boolean;
}

export interface Project {
  id: string;
  title: string;
  subtitle: string;
  imagePath: string;
  /** Null renders the card as a details-modal button instead of a link. */
  externalUrl: string | null;
  /** Markdown; empty means the card has no write-up to open. */
  writeup: string;
  isArchived: boolean;
  /** Ordered by `sort_order`; archived categories are included, see docs/API.md. */
  categories: ProjectCategory[];
}

export const TIMELINE_KINDS = ['employment', 'education', 'extracurricular', 'award'] as const;

export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export interface TimelineEntry {
  id: string;
  organization: string;
  title: string;
  /** Markdown. Rendered sanitized, never as raw HTML. */
  description: string;
  /** 'YYYY-MM-DD'. A calendar date, not an instant — see docs/SCHEMA.md. */
  startsOn: string;
  /** Null means "to the present". */
  endsOn: string | null;
  kind: TimelineKind;
  thumbnailPath: string;
  isArchived: boolean;
}

/**
 * Everything the page renders, in one payload.
 *
 * The public page is server-rendered from this, so one round trip produces a
 * complete page rather than four waterfalled fetches — and the admin layer
 * then patches individual resources rather than re-reading the whole thing.
 */
export interface SiteContent {
  profile: SiteProfile;
  socials: SocialLink[];
  projects: Project[];
  timeline: TimelineEntry[];
}
