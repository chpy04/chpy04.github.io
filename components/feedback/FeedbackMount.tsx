'use client';

import FeedbackWidget from '@/components/feedback/FeedbackWidget';
import { useSite } from '@/components/SiteProvider';

interface FeedbackMountProps {
  /** Decided on the server — see `lib/feedback/enabled.ts`. */
  enabled: boolean;
}

/**
 * Two conditions have to hold before the feedback button appears, and they
 * are checked in different places, which is why this exists.
 *
 * `enabled` is about the *deployment*: the widget ships locally and not on
 * the public site. `canEdit` is about the *visitor*: filing a report needs
 * a resolved session, so offering the button to a reader would be offering
 * a button that can only fail.
 */
export default function FeedbackMount({ enabled }: FeedbackMountProps) {
  const { canEdit } = useSite();
  if (!enabled || !canEdit) return null;
  return <FeedbackWidget />;
}
