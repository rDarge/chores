import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Plus, User, Wifi, WifiOff } from 'lucide-react';
import {
  Chore,
  CompleteChoreResponse,
  CreateChorePayload,
  UpdateChorePayload,
} from './types/chore';
import { buildActiveDeck, getLocalDateString } from './utils/deck';
import { NamePromptModal } from './components/NamePromptModal';
import { ChoreStack } from './components/ChoreStack';
import { ChoreFormModal } from './components/ChoreFormModal';
import { ChoreDetailModal } from './components/ChoreDetailModal';
import { HistoryModal } from './components/HistoryModal';
import { UndoAction, UndoToast } from './components/UndoToast';

const USER_NAME_STORAGE_KEY = 'chore_deck_user_name';
const DECK_STATE_STORAGE_KEY = 'chore_deck_local_state';

interface LocalDeckState {
  date: string;
  ignoredIds: string[];
  shuffleSeed: string;
}

function makeSeed(dateStr: string): string {
  return `${dateStr}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadDeckState(todayStr: string): LocalDeckState {
  try {
    const raw = localStorage.getItem(DECK_STATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalDeckState>;
      // If saved state is from today, keep ignoredIds and shuffleSeed
      if (parsed.date === todayStr && Array.isArray(parsed.ignoredIds) && parsed.shuffleSeed) {
        return {
          date: todayStr,
          ignoredIds: parsed.ignoredIds,
          shuffleSeed: parsed.shuffleSeed,
        };
      }
    }
  } catch {
    // Fallback to fresh daily state
  }
  const fresh: LocalDeckState = {
    date: todayStr,
    ignoredIds: [],
    shuffleSeed: makeSeed(todayStr),
  };
  try {
    localStorage.setItem(DECK_STATE_STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // Ignore storage errors
  }
  return fresh;
}

export const App: React.FC = () => {
  const [todayStr, setTodayStr] = useState<string>(() => getLocalDateString());
  const [userName, setUserName] = useState<string>(() => {
    try {
      return localStorage.getItem(USER_NAME_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [isEditingName, setIsEditingName] = useState(false);

  const [deckState, setDeckState] = useState<LocalDeckState>(() =>
    loadDeckState(getLocalDateString())
  );

  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(true);
  const [isRedealing, setIsRedealing] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedChoreId, setSelectedChoreId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Undo Toast
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const showUndo = useCallback((action: UndoAction) => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }
    setUndoAction(action);
    undoTimerRef.current = window.setTimeout(() => {
      setUndoAction(null);
    }, 5500);
  }, []);

  // Persist deckState changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(DECK_STATE_STORAGE_KEY, JSON.stringify(deckState));
    } catch {
      // Ignore storage write errors
    }
  }, [deckState]);

  // Fetch chores from server
  const fetchChores = useCallback(async (currentDayStr: string = getLocalDateString()) => {
    try {
      const res = await fetch(`/api/chores?today=${encodeURIComponent(currentDayStr)}`);
      if (!res.ok) throw new Error('Failed to load chores');
      const data = await res.json();
      if (Array.isArray(data.chores)) {
        setChores(data.chores);
        // Prune any ignoredIds that are no longer open chores
        const openIds = new Set(
          (data.chores as Chore[]).filter((c) => c.status === 'open').map((c) => c.id)
        );
        setDeckState((prev) => {
          const filtered = prev.ignoredIds.filter((id) => openIds.has(id));
          if (filtered.length === prev.ignoredIds.length) return prev;
          return { ...prev, ignoredIds: filtered };
        });
      }
    } catch (err) {
      console.error('Error fetching chores:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if local date has rolled past 12:00 AM midnight
  const checkMidnightRollover = useCallback(() => {
    const nowDay = getLocalDateString();
    setTodayStr(nowDay);
    setDeckState((prev) => {
      if (prev.date !== nowDay) {
        const resetState: LocalDeckState = {
          date: nowDay,
          ignoredIds: [],
          shuffleSeed: makeSeed(nowDay),
        };
        fetchChores(nowDay);
        return resetState;
      }
      return prev;
    });
  }, [fetchChores]);

  // Initial load + visibility/focus sync + SSE live updates
  useEffect(() => {
    fetchChores(getLocalDateString());

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkMidnightRollover();
        fetchChores(getLocalDateString());
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // Connect SSE stream
    const es = new EventSource('/api/events');
    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);
    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'chores-updated') {
          fetchChores(getLocalDateString());
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      es.close();
    };
  }, [fetchChores, checkMidnightRollover]);

  // Schedule exact timer for 12:00 AM midnight reset
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      1,
      0
    );
    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());

    const timer = window.setTimeout(() => {
      checkMidnightRollover();
    }, msUntilMidnight);

    return () => window.clearTimeout(timer);
  }, [todayStr, checkMidnightRollover]);

  const handleSaveName = (name: string) => {
    setUserName(name);
    setIsEditingName(false);
    try {
      localStorage.setItem(USER_NAME_STORAGE_KEY, name);
    } catch {
      // Ignore storage errors
    }
  };

  // Active deck calculation
  const ignoredSet = useMemo(() => new Set(deckState.ignoredIds), [deckState.ignoredIds]);
  const activeDeck = useMemo(
    () => buildActiveDeck(chores, ignoredSet, deckState.shuffleSeed),
    [chores, ignoredSet, deckState.shuffleSeed]
  );

  const openChoresCount = useMemo(
    () => chores.filter((c) => c.status === 'open').length,
    [chores]
  );
  const sleepingRecurringCount = useMemo(
    () => chores.filter((c) => c.status === 'completed' && c.dueType === 'recurring').length,
    [chores]
  );
  const completedOneOffCount = useMemo(
    () => chores.filter((c) => c.status === 'completed' && c.dueType !== 'recurring').length,
    [chores]
  );

  const selectedChore = useMemo(
    () => chores.find((c) => c.id === selectedChoreId) ?? null,
    [chores, selectedChoreId]
  );

  // Actions
  const handleCreateChore = async (payload: CreateChorePayload) => {
    const res = await fetch('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, today: getLocalDateString() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create chore');
    }
    await fetchChores(getLocalDateString());
  };

  const handleUpdateChore = async (id: string, payload: UpdateChorePayload) => {
    const res = await fetch(`/api/chores/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, today: getLocalDateString() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update chore');
    }
    await fetchChores(getLocalDateString());
  };

  const handleCompleteChore = async (chore: Chore) => {
    // Optimistically remove from current open list while request completes
    setChores((prev) =>
      prev.map((c) => (c.id === chore.id ? { ...c, status: 'completed' } : c))
    );

    try {
      const res = await fetch(`/api/chores/${chore.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedBy: userName || 'Household Member',
          today: getLocalDateString(),
        }),
      });
      if (!res.ok) throw new Error('Failed to complete chore');
      const data = (await res.json()) as CompleteChoreResponse;
      await fetchChores(getLocalDateString());

      showUndo({
        id: `complete-${chore.id}-${Date.now()}`,
        message:
          chore.dueType === 'recurring'
            ? `Completed "${chore.title}" (next due ${data.chore.dueDate})`
            : `Completed "${chore.title}"`,
        onUndo: async () => {
          await fetch(`/api/chores/${chore.id}/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ snapshot: data.previousSnapshot }),
          });
          await fetchChores(getLocalDateString());
        },
      });
    } catch (err) {
      console.error('Error completing chore:', err);
      await fetchChores(getLocalDateString());
    }
  };

  const handleIgnoreChore = (chore: Chore) => {
    setDeckState((prev) => {
      if (prev.ignoredIds.includes(chore.id)) return prev;
      return {
        ...prev,
        ignoredIds: [...prev.ignoredIds, chore.id],
      };
    });

    showUndo({
      id: `ignore-${chore.id}-${Date.now()}`,
      message: `Ignored "${chore.title}" for today`,
      onUndo: () => {
        setDeckState((prev) => ({
          ...prev,
          ignoredIds: prev.ignoredIds.filter((id) => id !== chore.id),
        }));
      },
    });
  };

  const handleRedeal = () => {
    setIsRedealing(true);
    const nowDay = getLocalDateString();
    setDeckState({
      date: nowDay,
      ignoredIds: [],
      shuffleSeed: makeSeed(nowDay),
    });
    setTimeout(() => {
      setIsRedealing(false);
    }, 420);
  };

  const handleReopenFromHistory = async (chore: Chore) => {
    await handleUpdateChore(chore.id, {
      status: 'open',
      dueDate: chore.dueType === 'recurring' ? getLocalDateString() : chore.dueDate,
    });
  };

  const handleDeleteChore = async (id: string) => {
    const res = await fetch(`/api/chores/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error('Failed to delete chore');
    }
    setDeckState((prev) => ({
      ...prev,
      ignoredIds: prev.ignoredIds.filter((item) => item !== id),
    }));
    await fetchChores(getLocalDateString());
  };

  return (
    <div className="app-shell">
      {/* Top Bar */}
      <header className="top-bar">
        <div className="brand-group">
          <div className="brand-logo">
            <Layers size={20} />
          </div>
          <div>
            <h1 className="brand-title">Chore Deck</h1>
            <span className="brand-date">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>

        <div className="header-right">
          <span
            className={`sync-indicator ${sseConnected ? 'online' : 'offline'}`}
            title={sseConnected ? 'Live household sync active' : 'Reconnecting...'}
          >
            {sseConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          </span>

          {userName && (
            <button
              type="button"
              className="user-pill"
              onClick={() => setIsEditingName(true)}
              title="Tap to switch or edit your name on this device"
            >
              <User size={15} />
              <span>{userName}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area: Vertical Overlapping Stack of up to 4 Cards */}
      <main className="main-stage">
        {loading ? (
          <div className="loading-state">Dealing your chore deck...</div>
        ) : (
          <ChoreStack
            activeDeck={activeDeck}
            allOpenChoresCount={openChoresCount}
            ignoredCount={deckState.ignoredIds.length}
            completedCount={completedOneOffCount}
            sleepingRecurringCount={sleepingRecurringCount}
            todayStr={todayStr}
            isRedealing={isRedealing}
            onCompleteChore={handleCompleteChore}
            onIgnoreChore={handleIgnoreChore}
            onSelectChore={(chore) => setSelectedChoreId(chore.id)}
            onRedeal={handleRedeal}
            onOpenHistory={() => setIsHistoryOpen(true)}
          />
        )}
      </main>

      {/* Floating Action Button in the Bottom Left */}
      <button
        type="button"
        className="fab-bottom-left"
        onClick={() => setIsCreateModalOpen(true)}
        aria-label="Create new chore"
        title="Add a new chore"
      >
        <Plus size={24} />
        <span className="fab-label">New Chore</span>
      </button>

      {/* Undo Toast */}
      <UndoToast action={undoAction} onDismiss={() => setUndoAction(null)} />

      {/* First-Time Device Name Prompt (or Switch Name Modal) */}
      {(!userName || isEditingName) && (
        <NamePromptModal
          initialName={userName}
          isEditing={isEditingName}
          onSave={handleSaveName}
          onCancel={isEditingName ? () => setIsEditingName(false) : undefined}
        />
      )}

      {/* New Chore Modal */}
      {isCreateModalOpen && (
        <ChoreFormModal
          mode="create"
          currentUser={userName || 'Household Member'}
          todayStr={todayStr}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateChore}
        />
      )}

      {/* Zoomed-in Chore Detail & Edit/Delete Modal */}
      {selectedChore && (
        <ChoreDetailModal
          chore={selectedChore}
          currentUser={userName || 'Household Member'}
          todayStr={todayStr}
          onClose={() => setSelectedChoreId(null)}
          onComplete={handleCompleteChore}
          onIgnore={handleIgnoreChore}
          onUpdate={handleUpdateChore}
          onDelete={handleDeleteChore}
        />
      )}

      {/* Sleeping Recurring & Completed History Modal */}
      {isHistoryOpen && (
        <HistoryModal
          chores={chores}
          onClose={() => setIsHistoryOpen(false)}
          onSelectChore={(chore) => setSelectedChoreId(chore.id)}
          onReopenChore={handleReopenFromHistory}
          onDeleteChore={handleDeleteChore}
        />
      )}
    </div>
  );
};
