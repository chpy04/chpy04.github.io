/**
 * Orchestrates one feedback submission, and decides where it lands.
 *
 * Two sinks. If `GITHUB_TOKEN`/`GITHUB_REPO` are configured it becomes a
 * GitHub issue — the real destination, and the one the agent skills read
 * from. If they are not, the report is written to `feedback/` as markdown
 * (`local-sink.ts`) instead of being refused.
 *
 * That fallback is deliberate and is not a silent degradation: the widget
 * tells the user which of the two happened, and this module only ever
 * reaches for it when the *configuration* is absent. A configured token
 * that GitHub then rejects still fails loudly, because that is a broken
 * setup rather than an unfinished one.
 */

import { createIssue, readGitHubConfig, uploadScreenshot, FeedbackConfigError } from './github.ts';
import { writeLocalReport } from './local-sink.ts';
import {
  extensionForMimeType,
  issueBody,
  issueLabels,
  issueTitle,
  screenshotPath,
  type FeedbackKind,
} from './issue.ts';

export interface ScreenshotUpload {
  bytes: Uint8Array;
  mimeType: string;
}

export interface FeedbackSubmission {
  kind: FeedbackKind;
  description: string;
  url: string;
  viewport?: string | null;
  userAgent?: string | null;
  screenshot?: ScreenshotUpload | null;
}

export interface FeedbackResult {
  /** Which sink took it. The widget words its confirmation from this. */
  target: 'github' | 'local';
  /** Human-facing handle: `#42` for an issue, the file path for a report. */
  reference: string;
  /** Somewhere to click, or null — a local file has no useful href. */
  url: string | null;
  /** False when a screenshot was attached but couldn't be stored. */
  screenshotUploaded: boolean;
}

export async function fileFeedback(submission: FeedbackSubmission): Promise<FeedbackResult> {
  try {
    return await fileToGitHub(submission);
  } catch (err) {
    // Only an *unconfigured* deployment falls back. A misconfigured one —
    // a bad token, a repo that does not exist — throws on out of here and
    // surfaces as a 502, which is the honest answer.
    if (!(err instanceof FeedbackConfigError)) throw err;
    console.warn(`[feedback] ${err.message} Writing to ./feedback instead.`);
    return fileLocally(submission);
  }
}

async function fileToGitHub(submission: FeedbackSubmission): Promise<FeedbackResult> {
  const config = readGitHubConfig();
  const submittedAt = new Date();

  let screenshotUrl: string | null = null;
  let screenshotError: string | null = null;

  if (submission.screenshot) {
    const extension = extensionForMimeType(submission.screenshot.mimeType) ?? 'png';
    const path = screenshotPath(extension, submittedAt, crypto.randomUUID());
    try {
      screenshotUrl = await uploadScreenshot(
        config,
        submission.screenshot.bytes,
        path,
        `feedback: screenshot for ${path}`,
      );
    } catch (err) {
      // The description is the part worth keeping. File the issue anyway and
      // say what happened, rather than making the user retype everything.
      screenshotError = err instanceof Error ? err.message : String(err);
      console.error('[feedback] screenshot upload failed:', screenshotError);
    }
  }

  const issue = await createIssue(config, {
    title: issueTitle(submission.kind, submission.description),
    body: issueBody({
      kind: submission.kind,
      description: submission.description,
      url: submission.url,
      viewport: submission.viewport,
      userAgent: submission.userAgent,
      screenshotUrl,
      screenshotError,
      submittedAt,
    }),
    labels: issueLabels(submission.kind),
  });

  return {
    target: 'github',
    reference: `#${issue.number}`,
    url: issue.url,
    screenshotUploaded: screenshotError === null,
  };
}

async function fileLocally(submission: FeedbackSubmission): Promise<FeedbackResult> {
  const report = await writeLocalReport(submission);
  return {
    target: 'local',
    reference: report.path,
    url: null,
    screenshotUploaded: submission.screenshot ? report.screenshotPath !== null : true,
  };
}
