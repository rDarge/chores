import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChoreDatabase } from '../server/db';
import {
  addDaysToDateString,
  buildActiveDeck,
  compareChores,
  diffCalendarDays,
} from '../src/utils/deck';
import { Chore } from '../src/types/chore';

function makeMockChore(overrides: Partial<Chore> & { id: string; title: string }): Chore {
  return {
    id: overrides.id,
    title: overrides.title,
    description: overrides.description ?? '',
    importance: overrides.importance ?? 'someday',
    weight: overrides.weight ?? 'light',
    dueType: overrides.dueType ?? 'none',
    dueDate: overrides.dueDate ?? null,
    intervalDays: overrides.intervalDays ?? null,
    status: overrides.status ?? 'open',
    createdAt: overrides.createdAt ?? '2026-11-09T12:00:00.000Z',
    createdBy: overrides.createdBy ?? 'Ryan',
    lastCompletedAt: overrides.lastCompletedAt ?? null,
    lastCompletedBy: overrides.lastCompletedBy ?? null,
  };
}

describe('Deck Sorting & Shuffle Engine', () => {
  it('sorts strictly by Importance tier: Important > Regular > Someday', () => {
    const somedayChore = makeMockChore({
      id: 'c1',
      title: 'Clean garage',
      importance: 'someday',
      dueType: 'specific',
      dueDate: '2026-11-01', // Even if overdue, Someday comes after Regular & Important
    });
    const regularChore = makeMockChore({
      id: 'c2',
      title: 'Vacuum rug',
      importance: 'regular',
    });
    const importantChore = makeMockChore({
      id: 'c3',
      title: 'Take out trash',
      importance: 'important',
    });

    const deck = buildActiveDeck(
      [somedayChore, regularChore, importantChore],
      new Set(),
      'seed-1'
    );
    assert.deepEqual(
      deck.map((c) => c.id),
      ['c3', 'c2', 'c1']
    );
  });

  it('sorts by soonest due date within the same Importance tier, placing no-due-date last', () => {
    const noDue = makeMockChore({
      id: 'c1',
      title: 'No due date',
      importance: 'important',
      dueDate: null,
    });
    const dueLater = makeMockChore({
      id: 'c2',
      title: 'Due Nov 15',
      importance: 'important',
      dueType: 'specific',
      dueDate: '2026-11-15',
    });
    const dueToday = makeMockChore({
      id: 'c3',
      title: 'Due Nov 09',
      importance: 'important',
      dueType: 'specific',
      dueDate: '2026-11-09',
    });
    const overdue = makeMockChore({
      id: 'c4',
      title: 'Overdue Nov 05',
      importance: 'important',
      dueType: 'specific',
      dueDate: '2026-11-05',
    });

    const deck = buildActiveDeck([noDue, dueLater, dueToday, overdue], new Set(), 'seed-1');
    assert.deepEqual(
      deck.map((c) => c.id),
      ['c4', 'c3', 'c2', 'c1']
    );
  });

  it('excludes ignored chores and restores them when un-ignored (redeal / midnight reset)', () => {
    const c1 = makeMockChore({ id: 'c1', title: 'Task 1', importance: 'important' });
    const c2 = makeMockChore({ id: 'c2', title: 'Task 2', importance: 'regular' });
    const c3 = makeMockChore({ id: 'c3', title: 'Task 3', importance: 'someday' });

    const ignored = new Set(['c1']);
    const deckIgnored = buildActiveDeck([c1, c2, c3], ignored, 'seed-1');
    assert.deepEqual(
      deckIgnored.map((c) => c.id),
      ['c2', 'c3']
    );

    const deckRedealt = buildActiveDeck([c1, c2, c3], new Set(), 'seed-2');
    assert.deepEqual(
      deckRedealt.map((c) => c.id),
      ['c1', 'c2', 'c3']
    );
  });

  it('shuffles ties deterministically for a given seed and changes tie order across seeds', () => {
    const tiedChores = Array.from({ length: 8 }, (_, idx) =>
      makeMockChore({
        id: `tie-${idx}`,
        title: `Tied Chore ${idx}`,
        importance: 'regular',
        dueDate: null,
      })
    );

    const orderA1 = buildActiveDeck(tiedChores, new Set(), 'seed-alpha').map((c) => c.id);
    const orderA2 = buildActiveDeck(tiedChores, new Set(), 'seed-alpha').map((c) => c.id);
    const orderB = buildActiveDeck(tiedChores, new Set(), 'seed-beta').map((c) => c.id);

    assert.deepEqual(orderA1, orderA2, 'Same seed should produce identical tie order');
    assert.notDeepEqual(orderA1, orderB, 'Different seed should shuffle tied chores');
  });
});

describe('SQLite Database & Recurring Chore Lifecycle', () => {
  it('handles creation, completion, recurring interval calculation, automatic reopening, and undo restore', () => {
    const db = new ChoreDatabase(':memory:');

    // 1. Create a one-off chore with defaults
    const oneOff = db.createChore(
      {
        title: 'Wipe kitchen counters',
        createdBy: 'Ryan',
      },
      '2026-11-09'
    );
    assert.equal(oneOff.importance, 'someday');
    assert.equal(oneOff.weight, 'light');
    assert.equal(oneOff.dueType, 'none');
    assert.equal(oneOff.status, 'open');

    // 2. Create a recurring chore (every 3 days)
    const recurring = db.createChore(
      {
        title: 'Water ferns',
        description: 'Living room and porch',
        importance: 'important',
        weight: 'medium',
        dueType: 'recurring',
        intervalDays: 3,
        createdBy: 'Ryan',
      },
      '2026-11-09'
    );
    assert.equal(recurring.status, 'open');
    assert.equal(recurring.dueDate, '2026-11-09');
    assert.equal(recurring.intervalDays, 3);

    // 3. Complete the recurring chore on 2026-11-09
    const completedRes = db.completeChore(
      recurring.id,
      'Alex',
      '2026-11-09',
      '2026-11-09T18:30:00.000Z'
    );
    assert.ok(completedRes);
    assert.equal(completedRes.chore.status, 'completed');
    assert.equal(completedRes.chore.lastCompletedBy, 'Alex');
    assert.equal(completedRes.chore.dueDate, '2026-11-12'); // 2026-11-09 + 3 days

    // 4. On 2026-11-11 (before interval elapses), recurring chore stays sleeping ('completed')
    const listNov11 = db.listChores('2026-11-11');
    const recNov11 = listNov11.find((c) => c.id === recurring.id)!;
    assert.equal(recNov11.status, 'completed');

    // 5. On 2026-11-12 (when interval elapses), recurring chore automatically reopens!
    const listNov12 = db.listChores('2026-11-12');
    const recNov12 = listNov12.find((c) => c.id === recurring.id)!;
    assert.equal(recNov12.status, 'open');
    assert.equal(recNov12.dueDate, '2026-11-12');
    assert.equal(recNov12.lastCompletedBy, 'Alex');

    // 6. Test Undo snapshot restoration on one-off chore
    const oneOffCompleted = db.completeChore(oneOff.id, 'Ryan', '2026-11-09')!;
    assert.equal(oneOffCompleted.chore.status, 'completed');

    const restored = db.restoreChoreSnapshot(oneOffCompleted.previousSnapshot)!;
    assert.equal(restored.status, 'open');
    assert.equal(restored.lastCompletedBy, null);

    db.close();
  });

  it('calculates date arithmetic accurately across month boundaries', () => {
    assert.equal(addDaysToDateString('2026-11-29', 3), '2026-12-02');
    assert.equal(diffCalendarDays('2026-11-09', '2026-11-09'), 0);
    assert.equal(diffCalendarDays('2026-11-07', '2026-11-09'), -2);
    assert.equal(diffCalendarDays('2026-11-12', '2026-11-09'), 3);
  });
});
