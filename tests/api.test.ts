import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/index';

describe('Express REST API Integration', () => {
  it('supports full chore lifecycle over HTTP endpoints', async () => {
    const { app, db } = createApp(':memory:');
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      // 1. Create a chore
      const createRes = await fetch(`${baseUrl}/api/chores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Clean espresso machine',
          description: 'Backflush with Cafiza',
          importance: 'important',
          weight: 'medium',
          dueType: 'recurring',
          intervalDays: 2,
          createdBy: 'Ryan',
          today: '2026-11-09',
        }),
      });
      assert.equal(createRes.status, 201);
      const { chore } = await createRes.json();
      assert.equal(chore.title, 'Clean espresso machine');
      assert.equal(chore.importance, 'important');
      assert.equal(chore.weight, 'medium');
      assert.equal(chore.dueDate, '2026-11-09');

      // 2. Edit the chore
      const patchRes = await fetch(`${baseUrl}/api/chores/${chore.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Deep clean espresso machine',
          weight: 'heavy',
          today: '2026-11-09',
        }),
      });
      assert.equal(patchRes.status, 200);
      const patched = await patchRes.json();
      assert.equal(patched.chore.title, 'Deep clean espresso machine');
      assert.equal(patched.chore.weight, 'heavy');

      // 3. Complete the chore
      const completeRes = await fetch(`${baseUrl}/api/chores/${chore.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedBy: 'Ryan',
          today: '2026-11-09',
        }),
      });
      assert.equal(completeRes.status, 200);
      const completedData = await completeRes.json();
      assert.equal(completedData.chore.status, 'completed');
      assert.equal(completedData.chore.dueDate, '2026-11-11'); // +2 days

      // 4. Query on 2026-11-11 -> automatically reopens!
      const listRes = await fetch(`${baseUrl}/api/chores?today=2026-11-11`);
      assert.equal(listRes.status, 200);
      const listData = await listRes.json();
      assert.equal(listData.chores.length, 1);
      assert.equal(listData.chores[0].status, 'open');

      // 5. Delete the chore
      const delRes = await fetch(`${baseUrl}/api/chores/${chore.id}`, {
        method: 'DELETE',
      });
      assert.equal(delRes.status, 200);

      const finalRes = await fetch(`${baseUrl}/api/chores?today=2026-11-11`);
      const finalData = await finalRes.json();
      assert.equal(finalData.chores.length, 0);
    } finally {
      server.close();
      db.close();
    }
  });
});
