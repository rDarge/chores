import { Chore, IMPORTANCE_RANK } from '../types/chore';

/**
 * Returns local calendar date formatted as 'YYYY-MM-DD'.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adds N calendar days to a 'YYYY-MM-DD' date string and returns 'YYYY-MM-DD'.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return getLocalDateString(dt);
}

/**
 * Difference in calendar days between targetDate ('YYYY-MM-DD') and todayStr ('YYYY-MM-DD').
 * Negative = overdue, 0 = due today, positive = due in N days.
 */
export function diffCalendarDays(targetDateStr: string, todayStr: string): number {
  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const [cy, cm, cd] = todayStr.split('-').map(Number);
  const targetUTC = Date.UTC(ty, tm - 1, td);
  const currentUTC = Date.UTC(cy, cm - 1, cd);
  return Math.round((targetUTC - currentUTC) / (1000 * 60 * 60 * 24));
}

/**
 * Deterministic 32-bit FNV-1a hash for tie-breaking shuffle with a seed.
 */
export function seededHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Compares two chores according to deck priority rules:
 * 1. Importance tier: Important (0) < Regular (1) < Someday (2)
 * 2. Due date soonness: chores with a dueDate sort before chores without a dueDate;
 *    earlier dueDates sort before later dueDates.
 * 3. Seeded tie-breaker shuffle when both importance and dueDate match.
 */
export function compareChores(a: Chore, b: Chore, shuffleSeed: string): number {
  const rankA = IMPORTANCE_RANK[a.importance] ?? 2;
  const rankB = IMPORTANCE_RANK[b.importance] ?? 2;
  if (rankA !== rankB) {
    return rankA - rankB;
  }

  // Due date comparison: non-null comes before null; earlier date comes first
  if (a.dueDate && b.dueDate) {
    if (a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
  } else if (a.dueDate && !b.dueDate) {
    return -1;
  } else if (!a.dueDate && b.dueDate) {
    return 1;
  }

  // Tie-breaker: deterministic seeded shuffle
  const hashA = seededHash(`${a.id}:${shuffleSeed}`);
  const hashB = seededHash(`${b.id}:${shuffleSeed}`);
  if (hashA !== hashB) {
    return hashA < hashB ? -1 : 1;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Filters open chores excluding ignored IDs and sorts them into the active deck.
 */
export function buildActiveDeck(
  chores: Chore[],
  ignoredIds: Set<string>,
  shuffleSeed: string
): Chore[] {
  return chores
    .filter((c) => c.status === 'open' && !ignoredIds.has(c.id))
    .sort((a, b) => compareChores(a, b, shuffleSeed));
}

export interface DueStatusInfo {
  label: string;
  recurrenceBadge: string | null;
  tone: 'overdue' | 'today' | 'soon' | 'upcoming' | 'none';
}

export function formatDueStatus(chore: Chore, todayStr: string = getLocalDateString()): DueStatusInfo {
  const recurrenceBadge =
    chore.dueType === 'recurring' && chore.intervalDays
      ? chore.intervalDays === 1
        ? 'Every day'
        : `Every ${chore.intervalDays} days`
      : null;

  if (!chore.dueDate || chore.dueType === 'none') {
    return {
      label: 'No due date',
      recurrenceBadge,
      tone: 'none',
    };
  }

  const diff = diffCalendarDays(chore.dueDate, todayStr);
  if (diff < 0) {
    const abs = Math.abs(diff);
    return {
      label: abs === 1 ? 'Overdue by 1 day' : `Overdue by ${abs} days`,
      recurrenceBadge,
      tone: 'overdue',
    };
  }
  if (diff === 0) {
    return {
      label: 'Due today',
      recurrenceBadge,
      tone: 'today',
    };
  }
  if (diff === 1) {
    return {
      label: 'Due tomorrow',
      recurrenceBadge,
      tone: 'soon',
    };
  }
  if (diff <= 7) {
    return {
      label: `Due in ${diff} days`,
      recurrenceBadge,
      tone: 'soon',
    };
  }
  return {
    label: `Due ${formatShortDate(chore.dueDate)}`,
    recurrenceBadge,
    tone: 'upcoming',
  };
}

export function formatShortDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatTimestamp(isoString: string | null): string {
  if (!isoString) return 'Never';
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return isoString;
  return dt.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
