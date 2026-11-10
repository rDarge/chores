import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  Chore,
  ChoreStatus,
  CompleteChoreResponse,
  CreateChorePayload,
  DueType,
  Importance,
  UpdateChorePayload,
  Weight,
} from '../src/types/chore';
import { addDaysToDateString, getLocalDateString } from '../src/utils/deck';

interface ChoreRow {
  id: string;
  title: string;
  description: string;
  importance: string;
  weight: string;
  due_type: string;
  due_date: string | null;
  interval_days: number | null;
  status: string;
  created_at: string;
  created_by: string;
  last_completed_at: string | null;
  last_completed_by: string | null;
}

function normalizeImportance(val?: string): Importance {
  if (val === 'important' || val === 'urgent') return 'important';
  if (val === 'regular') return 'regular';
  return 'someday';
}

function normalizeWeight(val?: string): Weight {
  if (val === 'medium') return 'medium';
  if (val === 'heavy') return 'heavy';
  return 'light';
}

function normalizeDueType(val?: string): DueType {
  if (val === 'specific') return 'specific';
  if (val === 'recurring') return 'recurring';
  return 'none';
}

function rowToChore(row: ChoreRow): Chore {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    importance: normalizeImportance(row.importance),
    weight: normalizeWeight(row.weight),
    dueType: normalizeDueType(row.due_type),
    dueDate: row.due_date ?? null,
    intervalDays: row.interval_days ?? null,
    status: row.status === 'completed' ? 'completed' : 'open',
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastCompletedAt: row.last_completed_at ?? null,
    lastCompletedBy: row.last_completed_by ?? null,
  };
}

export class ChoreDatabase {
  private db: DatabaseSync;

  constructor(dbPath: string = path.resolve(process.cwd(), 'data', 'chores.db')) {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS chores (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        importance TEXT NOT NULL DEFAULT 'someday',
        weight TEXT NOT NULL DEFAULT 'light',
        due_type TEXT NOT NULL DEFAULT 'none',
        due_date TEXT NULL,
        interval_days INTEGER NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        last_completed_at TEXT NULL,
        last_completed_by TEXT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chores_status ON chores(status);
      CREATE INDEX IF NOT EXISTS idx_chores_due ON chores(due_type, due_date);
    `);
  }

  /**
   * Automatically transitions any sleeping recurring chores whose next due_date
   * has arrived (due_date <= todayStr) back to status = 'open'.
   */
  public reopenDueRecurringChores(todayStr: string = getLocalDateString()): number {
    const stmt = this.db.prepare(`
      UPDATE chores
      SET status = 'open'
      WHERE status = 'completed'
        AND due_type = 'recurring'
        AND due_date IS NOT NULL
        AND due_date <= ?
    `);
    const result = stmt.run(todayStr);
    return Number(result.changes ?? 0);
  }

  public listChores(todayStr: string = getLocalDateString()): Chore[] {
    this.reopenDueRecurringChores(todayStr);
    const stmt = this.db.prepare(`
      SELECT * FROM chores
      ORDER BY created_at DESC
    `);
    const rows = stmt.all() as unknown as ChoreRow[];
    return rows.map(rowToChore);
  }

  public getChore(id: string): Chore | null {
    const stmt = this.db.prepare(`SELECT * FROM chores WHERE id = ?`);
    const row = stmt.get(id) as unknown as ChoreRow | undefined;
    return row ? rowToChore(row) : null;
  }

  public createChore(
    payload: CreateChorePayload,
    todayStr: string = getLocalDateString(),
    nowIso: string = new Date().toISOString()
  ): Chore {
    const id = crypto.randomUUID();
    const title = payload.title.trim();
    if (!title) {
      throw new Error('Title is required');
    }
    const description = (payload.description ?? '').trim();
    const importance = normalizeImportance(payload.importance);
    const weight = normalizeWeight(payload.weight);
    const dueType = normalizeDueType(payload.dueType);
    const createdBy = (payload.createdBy ?? 'Household Member').trim() || 'Household Member';

    let dueDate: string | null = null;
    let intervalDays: number | null = null;
    let status: ChoreStatus = 'open';

    if (dueType === 'specific') {
      dueDate = payload.dueDate || todayStr;
    } else if (dueType === 'recurring') {
      const parsedInterval = Number(payload.intervalDays);
      intervalDays = Number.isFinite(parsedInterval) && parsedInterval >= 1 ? Math.floor(parsedInterval) : 2;
      dueDate = payload.dueDate || todayStr;
      // If user chose a future start date for a recurring chore, keep it sleeping until that date
      if (dueDate > todayStr) {
        status = 'completed';
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO chores (
        id, title, description, importance, weight,
        due_type, due_date, interval_days, status,
        created_at, created_by, last_completed_at, last_completed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
    `);

    stmt.run(
      id,
      title,
      description,
      importance,
      weight,
      dueType,
      dueDate,
      intervalDays,
      status,
      nowIso,
      createdBy
    );

    return this.getChore(id)!;
  }

  public updateChore(
    id: string,
    payload: UpdateChorePayload,
    todayStr: string = getLocalDateString()
  ): Chore | null {
    const existing = this.getChore(id);
    if (!existing) return null;

    const title = payload.title !== undefined ? payload.title.trim() : existing.title;
    if (!title) {
      throw new Error('Title cannot be empty');
    }
    const description =
      payload.description !== undefined ? payload.description.trim() : existing.description;
    const importance =
      payload.importance !== undefined ? normalizeImportance(payload.importance) : existing.importance;
    const weight = payload.weight !== undefined ? normalizeWeight(payload.weight) : existing.weight;
    const dueType = payload.dueType !== undefined ? normalizeDueType(payload.dueType) : existing.dueType;

    let dueDate: string | null = existing.dueDate;
    let intervalDays: number | null = existing.intervalDays;
    let status: ChoreStatus = payload.status !== undefined ? payload.status : existing.status;

    if (dueType === 'none') {
      dueDate = null;
      intervalDays = null;
    } else if (dueType === 'specific') {
      intervalDays = null;
      dueDate = payload.dueDate !== undefined ? payload.dueDate : existing.dueDate || todayStr;
    } else if (dueType === 'recurring') {
      const rawInterval =
        payload.intervalDays !== undefined ? Number(payload.intervalDays) : existing.intervalDays ?? 2;
      intervalDays = Number.isFinite(rawInterval) && rawInterval >= 1 ? Math.floor(rawInterval) : 2;
      dueDate = payload.dueDate !== undefined ? payload.dueDate || todayStr : existing.dueDate || todayStr;
      if (payload.status === undefined && dueDate <= todayStr) {
        status = 'open';
      }
    }

    const stmt = this.db.prepare(`
      UPDATE chores
      SET title = ?,
          description = ?,
          importance = ?,
          weight = ?,
          due_type = ?,
          due_date = ?,
          interval_days = ?,
          status = ?
      WHERE id = ?
    `);

    stmt.run(title, description, importance, weight, dueType, dueDate, intervalDays, status, id);
    return this.getChore(id);
  }

  public completeChore(
    id: string,
    completedBy: string,
    todayStr: string = getLocalDateString(),
    nowIso: string = new Date().toISOString()
  ): CompleteChoreResponse | null {
    const existing = this.getChore(id);
    if (!existing) return null;

    const user = (completedBy || 'Household Member').trim();
    let nextDueDate = existing.dueDate;
    const status: ChoreStatus = 'completed';

    if (existing.dueType === 'recurring' && existing.intervalDays && existing.intervalDays > 0) {
      nextDueDate = addDaysToDateString(todayStr, existing.intervalDays);
    }

    const stmt = this.db.prepare(`
      UPDATE chores
      SET status = ?,
          due_date = ?,
          last_completed_at = ?,
          last_completed_by = ?
      WHERE id = ?
    `);

    stmt.run(status, nextDueDate, nowIso, user, id);
    const updated = this.getChore(id)!;
    return {
      chore: updated,
      previousSnapshot: existing,
    };
  }

  public restoreChoreSnapshot(snapshot: Chore): Chore | null {
    const existing = this.getChore(snapshot.id);
    if (!existing) return null;

    const stmt = this.db.prepare(`
      UPDATE chores
      SET title = ?,
          description = ?,
          importance = ?,
          weight = ?,
          due_type = ?,
          due_date = ?,
          interval_days = ?,
          status = ?,
          last_completed_at = ?,
          last_completed_by = ?
      WHERE id = ?
    `);

    stmt.run(
      snapshot.title,
      snapshot.description,
      snapshot.importance,
      snapshot.weight,
      snapshot.dueType,
      snapshot.dueDate,
      snapshot.intervalDays,
      snapshot.status,
      snapshot.lastCompletedAt,
      snapshot.lastCompletedBy,
      snapshot.id
    );

    return this.getChore(snapshot.id);
  }

  public deleteChore(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM chores WHERE id = ?`);
    const res = stmt.run(id);
    return Number(res.changes ?? 0) > 0;
  }

  public close(): void {
    this.db.close();
  }
}
