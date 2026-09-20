/**
 * Where a report goes when there is no GitHub repo to file it into.
 *
 * The widget is a local tool (`lib/feedback/enabled.ts`), and locally the
 * common case early in a project is that no repo exists yet — or that the
 * token to write to it does not. Dropping the report on the floor there
 * would make the widget useless exactly when it is most wanted, so it
 * writes a markdown file to `feedback/` instead, in the same format the
 * GitHub issue would have had, with the screenshot beside it.
 *
 * That directory is gitignored and is meant to be read by whoever (or
 * whatever) is working on the code — it is a drop box, not a record.
 *
 * Node-only: `node:fs`. Never import this from the Edge runtime or the
 * browser.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extensionForMimeType, issueBody, issueTitle } from './issue.ts';
import type { FeedbackSubmission } from './submit.ts';

/** Relative to the process cwd, which for `next dev` is the repo root. */
export const LOCAL_FEEDBACK_DIR = 'feedback';

/** `[Bug] Timeline dots overlap` -> `bug-timeline-dots-overlap`. */
function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'report'
  );
}

export interface LocalReport {
  /** Path of the markdown file, relative to the repo root. */
  path: string;
  screenshotPath: string | null;
}

export async function writeLocalReport(
  submission: FeedbackSubmission,
  submittedAt: Date = new Date(),
  dir: string = LOCAL_FEEDBACK_DIR,
): Promise<LocalReport> {
  const title = issueTitle(submission.kind, submission.description);
  // Colons are legal in a filename on macOS and shown as slashes in Finder;
  // stripping them keeps the name the same everywhere.
  const stamp = submittedAt.toISOString().replace(/[:.]/g, '-');
  const base = `${stamp}-${slugify(title)}`;

  await mkdir(dir, { recursive: true });

  const { screenshot } = submission;
  let screenshotPath: string | null = null;
  let screenshotHref: string | null = null;
  if (screenshot) {
    const name = `${base}.${extensionForMimeType(screenshot.mimeType) ?? 'png'}`;
    screenshotPath = join(dir, name);
    // A sibling-relative link, so the file renders with its screenshot in
    // any markdown preview rather than only from the repo root.
    screenshotHref = `./${name}`;
    await writeFile(screenshotPath, screenshot.bytes);
  }

  const markdownPath = join(dir, `${base}.md`);
  const body = issueBody({
    kind: submission.kind,
    description: submission.description,
    url: submission.url,
    viewport: submission.viewport,
    userAgent: submission.userAgent,
    screenshotUrl: screenshotHref,
    submittedAt,
  });

  await writeFile(markdownPath, `# ${title}\n\n${body}\n`, 'utf8');

  return { path: markdownPath, screenshotPath };
}
