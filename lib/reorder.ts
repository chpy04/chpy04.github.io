/**
 * Reordering a list of ids, as pure functions.
 *
 * The API takes a whole ordered list (`PUT /api/projects`), so every gesture
 * — dragging a card onto another, nudging one along with a button — is the
 * same operation underneath: produce the new full order, send it.
 *
 * The subtlety these exist to contain is that the list the user sees is not
 * the list being reordered. Archived rows are hidden but still hold a
 * position, so "move this one right" means "past the next *visible* one",
 * which is not the next one in the array. Getting that wrong looks like a
 * card that refuses to move.
 */

/** Index of `id`, or -1. Exported for the callers that need to test membership. */
function indexOf(ids: readonly string[], id: string): number {
  return ids.indexOf(id);
}

/**
 * Moves `id` to where `targetId` currently sits, shifting the rest along.
 * Returns `ids` unchanged if either id is absent or they are the same.
 *
 * This is the drop gesture: the dragged card takes the target's slot, and
 * whether that pushes the target left or right falls out of the direction
 * of travel rather than needing to be decided.
 */
export function moveTo(ids: readonly string[], id: string, targetId: string): string[] {
  const from = indexOf(ids, id);
  const to = indexOf(ids, targetId);
  if (from === -1 || to === -1 || from === to) return [...ids];

  const next = [...ids];
  const [moved] = next.splice(from, 1);
  // `moved` cannot be undefined — `from` came from indexOf — but the splice
  // signature does not know that.
  if (moved === undefined) return [...ids];
  next.splice(to, 0, moved);
  return next;
}

/**
 * Moves `id` one slot in `delta`'s direction **as the user sees the list**,
 * skipping anything not in `visible`.
 *
 * Returns the list unchanged at either end, which is what makes the caller
 * able to disable the button without duplicating the edge cases.
 */
export function nudge(
  ids: readonly string[],
  visible: readonly string[],
  id: string,
  delta: 1 | -1,
): string[] {
  const positionInVisible = indexOf(visible, id);
  if (positionInVisible === -1) return [...ids];

  const neighbour = visible[positionInVisible + delta];
  if (neighbour === undefined) return [...ids];

  return moveTo(ids, id, neighbour);
}

/** Whether `nudge` would do anything — the button's `disabled`. */
export function canNudge(visible: readonly string[], id: string, delta: 1 | -1): boolean {
  const position = indexOf(visible, id);
  return position !== -1 && visible[position + delta] !== undefined;
}
