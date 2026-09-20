import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canNudge, moveTo, nudge } from './reorder.ts';

const IDS = ['a', 'b', 'c', 'd'];

// ---------------------------------------------------------------------------
// moveTo — the drop gesture
// ---------------------------------------------------------------------------

test('moving a card onto a later one puts it in that slot', () => {
  assert.deepEqual(moveTo(IDS, 'a', 'c'), ['b', 'c', 'a', 'd']);
});

test('moving a card onto an earlier one puts it in that slot', () => {
  assert.deepEqual(moveTo(IDS, 'd', 'b'), ['a', 'd', 'b', 'c']);
});

test('moving a card onto itself changes nothing', () => {
  assert.deepEqual(moveTo(IDS, 'b', 'b'), IDS);
});

test('an unknown id changes nothing', () => {
  assert.deepEqual(moveTo(IDS, 'z', 'b'), IDS);
  assert.deepEqual(moveTo(IDS, 'b', 'z'), IDS);
});

test('the input is never mutated', () => {
  const original = [...IDS];
  moveTo(IDS, 'a', 'd');
  assert.deepEqual(IDS, original);
});

test('every id survives a move', () => {
  const result = moveTo(IDS, 'a', 'd');
  assert.deepEqual([...result].sort(), [...IDS].sort());
  assert.equal(result.length, IDS.length);
});

// ---------------------------------------------------------------------------
// nudge — the arrow buttons, over a filtered list
// ---------------------------------------------------------------------------

test('nudging right swaps with the next card', () => {
  assert.deepEqual(nudge(IDS, IDS, 'a', 1), ['b', 'a', 'c', 'd']);
});

test('nudging left swaps with the previous card', () => {
  assert.deepEqual(nudge(IDS, IDS, 'c', -1), ['a', 'c', 'b', 'd']);
});

test('nudging past either end changes nothing', () => {
  assert.deepEqual(nudge(IDS, IDS, 'a', -1), IDS);
  assert.deepEqual(nudge(IDS, IDS, 'd', 1), IDS);
});

test('nudging skips hidden rows rather than swapping with them', () => {
  // `b` is archived and not on screen. Moving `a` right must land it after
  // `c` — the next card the user can actually see — not after `b`, which
  // would look like the card refusing to move.
  const visible = ['a', 'c', 'd'];
  assert.deepEqual(nudge(IDS, visible, 'a', 1), ['b', 'c', 'a', 'd']);
});

test('a hidden row keeps its position when its neighbours move', () => {
  const visible = ['a', 'c', 'd'];
  const result = nudge(IDS, visible, 'a', 1);
  assert.ok(result.includes('b'), 'the archived row was dropped');
  assert.equal(result.length, IDS.length);
});

test('nudging a row that is not visible changes nothing', () => {
  assert.deepEqual(nudge(IDS, ['a', 'c', 'd'], 'b', 1), IDS);
});

// ---------------------------------------------------------------------------
// canNudge — what the buttons disable on
// ---------------------------------------------------------------------------

test('canNudge agrees with nudge at the edges', () => {
  assert.equal(canNudge(IDS, 'a', -1), false);
  assert.equal(canNudge(IDS, 'd', 1), false);
  assert.equal(canNudge(IDS, 'a', 1), true);
  assert.equal(canNudge(IDS, 'd', -1), true);
});

test('canNudge is false for a row that is not visible', () => {
  assert.equal(canNudge(['a', 'c'], 'b', 1), false);
});
