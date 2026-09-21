/**
 * zod request-body schemas. Every route handler parses its body through one
 * of these and returns `400 { error }` on failure — see docs/API.md.
 *
 * Schemas live here, not next to the handler, so the whole request surface
 * of the app is readable in one file.
 */
import { z } from 'zod';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from './storage/media.ts';
import { TIMELINE_KINDS } from './types.ts';

const uuid = z.string().uuid();
const nonEmpty = z.string().trim().min(1);
/** Free text that is allowed to be blank but not unbounded. Editable fields
 *  come from a contenteditable element, where a stuck key is a real way to
 *  produce a megabyte of one character. */
const text = z.string().max(20_000, 'is too long');
/** 'YYYY-MM-DD'. `z.iso.date()` rejects '2024-13-01' as well as the shape,
 *  which a bare regex would let through into a Postgres range error. */
const isoDate = z.iso.date();

/** A PATCH with no fields is a caller bug, not a no-op: it almost always
 *  means a typo'd key that would otherwise be silently ignored. */
function atLeastOneField<T extends z.ZodTypeAny>(schema: T, fields: string) {
  return schema.refine((body) => Object.keys(body as object).length > 0, {
    message: `at least one of ${fields} is required`,
  });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Messages are spelled out because `parseJsonBody` renders them as
 *  `<field>: <message>`, and zod's default "Too small" wording is useless
 *  to a caller. */
export const loginSchema = z.object({
  password: z.string('is required').min(1, 'is required'),
});

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export const feedbackSchema = z.object({
  kind: z.enum(['bug', 'feature'], 'must be "bug" or "feature"'),
  description: nonEmpty.max(20_000, 'is too long'),
  url: z.string('is required').min(1, 'is required'),
  viewport: z.string().optional(),
  userAgent: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

/**
 * Describes a file that is *about* to be uploaded — the bytes themselves go
 * straight from the browser to Supabase and never pass through here (D-027).
 *
 * So this is a claim, not a measurement: a caller could understate `bytes`
 * or lie about `contentType`. The bucket's own `file_size_limit` and
 * `allowed_mime_types` are what actually hold, and they are set to the same
 * numbers. What this schema buys is the good error — told at the drop rather
 * than after a 50 MB upload.
 */
export const createUploadSchema = z.object({
  filename: nonEmpty.max(300, 'is too long'),
  contentType: z
    .string('is required')
    .refine(
      (value) => ALLOWED_UPLOAD_TYPES.includes(value.toLowerCase()),
      `must be one of ${ALLOWED_UPLOAD_TYPES.join(', ')}`,
    ),
  bytes: z
    .number('is required')
    .int('must be a whole number of bytes')
    .positive('must not be empty')
    .max(MAX_UPLOAD_BYTES, `is over the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit`),
});

// ---------------------------------------------------------------------------
// Site profile
// ---------------------------------------------------------------------------

const PROFILE_FIELDS =
  'name, metaDescription, taglineLead, taglineName, taglineRole, taglineOrg, about, headshotPath, resumeImagePath, resumePdfPath';

export const patchProfileSchema = atLeastOneField(
  z.object({
    name: text.optional(),
    metaDescription: text.optional(),
    taglineLead: text.optional(),
    taglineName: text.optional(),
    taglineRole: text.optional(),
    taglineOrg: text.optional(),
    about: text.optional(),
    headshotPath: text.optional(),
    resumeImagePath: text.optional(),
    resumePdfPath: text.optional(),
  }),
  PROFILE_FIELDS,
);

// ---------------------------------------------------------------------------
// Social links
// ---------------------------------------------------------------------------

export const createSocialSchema = z.object({
  label: nonEmpty,
  url: nonEmpty,
});

export const patchSocialSchema = atLeastOneField(
  z.object({
    label: nonEmpty.optional(),
    url: nonEmpty.optional(),
    isArchived: z.boolean().optional(),
  }),
  'label, url or isArchived',
);

export const reorderSchema = z.object({
  ids: z.array(uuid),
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/** `null` is meaningful and distinct from omitted: it clears the link and
 *  turns the card back into a write-up button. */
const externalUrl = z.string().trim().min(1).nullable();

export const createProjectSchema = z.object({
  title: nonEmpty,
  subtitle: text.optional(),
  imagePath: text.optional(),
  externalUrl: externalUrl.optional(),
  writeup: text.optional(),
});

export const patchProjectSchema = atLeastOneField(
  z.object({
    title: nonEmpty.optional(),
    subtitle: text.optional(),
    imagePath: text.optional(),
    externalUrl: externalUrl.optional(),
    writeup: text.optional(),
    isArchived: z.boolean().optional(),
  }),
  'title, subtitle, imagePath, externalUrl, writeup or isArchived',
);

export const createProjectCategorySchema = z.object({
  label: nonEmpty,
});

export const patchProjectCategorySchema = atLeastOneField(
  z.object({
    label: nonEmpty.optional(),
    isArchived: z.boolean().optional(),
  }),
  'label or isArchived',
);

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

const timelineKind = z.enum(TIMELINE_KINDS, `must be one of ${TIMELINE_KINDS.join(', ')}`);

export const createTimelineSchema = z
  .object({
    organization: nonEmpty,
    title: nonEmpty,
    description: text.optional(),
    startsOn: isoDate,
    endsOn: isoDate.nullable().optional(),
    kind: timelineKind,
    thumbnailPath: text.optional(),
  })
  .refine((body) => !body.endsOn || body.endsOn >= body.startsOn, {
    message: 'endsOn must not be before startsOn',
    path: ['endsOn'],
  });

/**
 * No cross-field `endsOn >= startsOn` check here, unlike on create: a PATCH
 * that moves only one of the two dates has nothing to compare against, and
 * comparing against the value already in the row would need a read the
 * validation layer has no business doing. `ck_timeline_entry_dates` catches
 * it in the database, which is the only place that sees both values.
 */
export const patchTimelineSchema = atLeastOneField(
  z.object({
    organization: nonEmpty.optional(),
    title: nonEmpty.optional(),
    description: text.optional(),
    startsOn: isoDate.optional(),
    endsOn: isoDate.nullable().optional(),
    kind: timelineKind.optional(),
    thumbnailPath: text.optional(),
    isArchived: z.boolean().optional(),
  }),
  'organization, title, description, startsOn, endsOn, kind, thumbnailPath or isArchived',
);
