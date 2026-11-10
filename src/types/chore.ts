export type Importance = 'important' | 'regular' | 'someday';
export type Weight = 'light' | 'medium' | 'heavy';
export type DueType = 'none' | 'specific' | 'recurring';
export type ChoreStatus = 'open' | 'completed';

export interface Chore {
  id: string;
  title: string;
  description: string;
  importance: Importance;
  weight: Weight;
  dueType: DueType;
  /**
   * ISO date string 'YYYY-MM-DD' when dueType is 'specific' or 'recurring', or null when 'none'.
   * For recurring chores:
   * - While status === 'open', dueDate represents when this cycle was/is due.
   * - While status === 'completed', dueDate represents the next reopen date (lastCompletedDate + intervalDays).
   */
  dueDate: string | null;
  /**
   * Number of days between recurrences when dueType === 'recurring', otherwise null.
   */
  intervalDays: number | null;
  status: ChoreStatus;
  createdAt: string;
  createdBy: string;
  lastCompletedAt: string | null;
  lastCompletedBy: string | null;
}

export interface CreateChorePayload {
  title: string;
  description?: string;
  importance?: Importance;
  weight?: Weight;
  dueType?: DueType;
  dueDate?: string | null;
  intervalDays?: number | null;
  createdBy: string;
}

export interface UpdateChorePayload {
  title?: string;
  description?: string;
  importance?: Importance;
  weight?: Weight;
  dueType?: DueType;
  dueDate?: string | null;
  intervalDays?: number | null;
  status?: ChoreStatus;
}

export interface CompleteChoreResponse {
  chore: Chore;
  previousSnapshot: Chore;
}

export const IMPORTANCE_LABELS: Record<Importance, string> = {
  important: 'Important',
  regular: 'Regular',
  someday: 'Someday',
};

export const IMPORTANCE_RANK: Record<Importance, number> = {
  important: 0,
  regular: 1,
  someday: 2,
};

export const WEIGHT_LABELS: Record<Weight, { short: string; full: string; minutes: string }> = {
  light: { short: 'Light', full: 'Light (5–30m)', minutes: '5–30 mins' },
  medium: { short: 'Medium', full: 'Medium (30–60m)', minutes: '30–60 mins' },
  heavy: { short: 'Heavy', full: 'Heavy (>60m)', minutes: '>60 mins' },
};
