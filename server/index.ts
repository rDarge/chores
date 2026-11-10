import express, { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { ChoreDatabase } from './db';
import { getLocalDateString } from '../src/utils/deck';

export function createApp(dbPath?: string) {
  const db = new ChoreDatabase(dbPath);
  const app = express();
  app.use(express.json());

  // Connected SSE clients
  const sseClients = new Set<Response>();

  function broadcastUpdate(reason: string) {
    const payload = JSON.stringify({ type: 'chores-updated', reason, timestamp: Date.now() });
    for (const client of sseClients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // Periodically check if any sleeping recurring chores have crossed midnight and reopened
  const reopenTimer = setInterval(() => {
    try {
      const reopenedCount = db.reopenDueRecurringChores(getLocalDateString());
      if (reopenedCount > 0) {
        broadcastUpdate('recurring-reopened');
      }
    } catch (err) {
      console.error('Error reopening due recurring chores:', err);
    }
  }, 30_000);
  reopenTimer.unref();

  // SSE stream endpoint
  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25_000);
    heartbeat.unref();

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // List all chores (also reopens any recurring chores due today or earlier)
  app.get('/api/chores', (req: Request, res: Response) => {
    try {
      const clientToday =
        typeof req.query.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.today)
          ? req.query.today
          : getLocalDateString();
      const chores = db.listChores(clientToday);
      res.json({ chores });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? 'Failed to fetch chores' });
    }
  });

  // Create a new chore
  app.post('/api/chores', (req: Request, res: Response) => {
    try {
      const { title, description, importance, weight, dueType, dueDate, intervalDays, createdBy, today } =
        req.body ?? {};
      if (!title || typeof title !== 'string' || !title.trim()) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }
      const todayStr =
        typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : getLocalDateString();
      const chore = db.createChore(
        {
          title,
          description,
          importance,
          weight,
          dueType,
          dueDate,
          intervalDays,
          createdBy,
        },
        todayStr
      );
      broadcastUpdate('chore-created');
      res.status(201).json({ chore });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? 'Failed to create chore' });
    }
  });

  // Edit / update an existing chore
  app.patch('/api/chores/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { title, description, importance, weight, dueType, dueDate, intervalDays, status, today } =
        req.body ?? {};
      const todayStr =
        typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : getLocalDateString();
      const updated = db.updateChore(
        id,
        {
          title,
          description,
          importance,
          weight,
          dueType,
          dueDate,
          intervalDays,
          status,
        },
        todayStr
      );
      if (!updated) {
        res.status(404).json({ error: 'Chore not found' });
        return;
      }
      broadcastUpdate('chore-updated');
      res.json({ chore: updated });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? 'Failed to update chore' });
    }
  });

  // Mark a chore complete
  app.post('/api/chores/:id/complete', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { completedBy, today } = req.body ?? {};
      const todayStr =
        typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : getLocalDateString();
      const result = db.completeChore(id, completedBy || 'Household Member', todayStr);
      if (!result) {
        res.status(404).json({ error: 'Chore not found' });
        return;
      }
      broadcastUpdate('chore-completed');
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? 'Failed to complete chore' });
    }
  });

  // Restore a chore snapshot (Undo completion or reopen from history)
  app.post('/api/chores/:id/restore', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const snapshot = req.body?.snapshot;
      if (!snapshot || snapshot.id !== id) {
        res.status(400).json({ error: 'Valid chore snapshot is required' });
        return;
      }
      const restored = db.restoreChoreSnapshot(snapshot);
      if (!restored) {
        res.status(404).json({ error: 'Chore not found' });
        return;
      }
      broadcastUpdate('chore-restored');
      res.json({ chore: restored });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? 'Failed to restore chore' });
    }
  });

  // Delete a chore
  app.delete('/api/chores/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const ok = db.deleteChore(id);
      if (!ok) {
        res.status(404).json({ error: 'Chore not found' });
        return;
      }
      broadcastUpdate('chore-deleted');
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? 'Failed to delete chore' });
    }
  });

  // Serve built frontend in production if dist/ exists
  const distPath = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return { app, db };
}

// Start server if invoked directly
const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase().endsWith(path.join('server', 'index.ts').toLowerCase());

if (isDirectRun) {
  const port = Number(process.env.PORT) || 8001;
  const host = process.env.HOST || '0.0.0.0';
  const { app } = createApp(process.env.DB_PATH);
  app.listen(port, host, () => {
    console.log(`Home Chore Deck server running on http://${host}:${port}`);
  });
}
