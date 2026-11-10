import React, { useRef, useState } from 'react';
import { History, Layers, RefreshCw, Sparkles } from 'lucide-react';
import { Chore } from '../types/chore';
import { SwipeableChoreCard } from './SwipeableChoreCard';

interface ChoreStackProps {
  activeDeck: Chore[];
  allOpenChoresCount: number;
  ignoredCount: number;
  completedCount: number;
  sleepingRecurringCount: number;
  todayStr: string;
  isRedealing: boolean;
  onCompleteChore: (chore: Chore) => void;
  onIgnoreChore: (chore: Chore) => void;
  onSelectChore: (chore: Chore) => void;
  onRedeal: () => void;
  onOpenHistory: () => void;
}

export const ChoreStack: React.FC<ChoreStackProps> = ({
  activeDeck,
  allOpenChoresCount,
  ignoredCount,
  completedCount,
  sleepingRecurringCount,
  todayStr,
  isRedealing,
  onCompleteChore,
  onIgnoreChore,
  onSelectChore,
  onRedeal,
  onOpenHistory,
}) => {
  // Up to 3 visible chore cards in the stack + the 4th summary card at the bottom
  const visibleChores = activeDeck.slice(0, 3);
  const choresLeftCount = activeDeck.length;

  // Breakdown of remaining active deck by importance
  const importantCount = activeDeck.filter((c) => c.importance === 'important').length;
  const regularCount = activeDeck.filter((c) => c.importance === 'regular').length;
  const somedayCount = activeDeck.filter((c) => c.importance === 'someday').length;

  // Double-tap & non-swipe rubber-band behavior for the 4th (bottommost) card
  const lastTapTimeRef = useRef<number>(0);
  const summaryPointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const [summaryNudgeX, setSummaryNudgeX] = useState(0);
  const [showSwipeLockHint, setShowSwipeLockHint] = useState(false);

  const handleSummaryPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore clicks on the History button inside the summary card
    if ((e.target as HTMLElement).closest('button')) return;
    summaryPointerStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleSummaryPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = summaryPointerStartRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 12) {
      // Heavy resistance — cannot swipe the 4th card
      const damped = Math.sign(dx) * Math.min(Math.abs(dx) * 0.15, 16);
      setSummaryNudgeX(damped);
      if (Math.abs(dx) > 40 && !showSwipeLockHint) {
        setShowSwipeLockHint(true);
      }
    }
  };

  const handleSummaryPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const start = summaryPointerStartRef.current;
    summaryPointerStartRef.current = null;
    setSummaryNudgeX(0);

    if (showSwipeLockHint) {
      setTimeout(() => setShowSwipeLockHint(false), 1400);
    }

    if (start) {
      const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (dist < 14) {
        const now = Date.now();
        if (now - lastTapTimeRef.current < 360) {
          lastTapTimeRef.current = 0;
          onRedeal();
        } else {
          lastTapTimeRef.current = now;
        }
      }
    }
  };

  return (
    <div className={`chore-stack-container ${isRedealing ? 'is-redealing' : ''}`}>
      <div className="chore-stack">
        {visibleChores.map((chore, idx) => (
          <SwipeableChoreCard
            key={chore.id}
            chore={chore}
            stackIndex={idx}
            totalChoreCards={visibleChores.length}
            todayStr={todayStr}
            onComplete={onCompleteChore}
            onIgnore={onIgnoreChore}
            onSelect={onSelectChore}
          />
        ))}

        {/* 4th Bottommost Card: Summary + Double-Tap to Redeal */}
        <div
          className={`stack-card summary-card stack-pos-${visibleChores.length} ${
            visibleChores.length === 0 ? 'summary-card-empty-deck' : ''
          }`}
          style={{
            transform: `translate3d(${summaryNudgeX}px, 0, 0)`,
            zIndex: 10 + visibleChores.length,
          }}
          onPointerDown={handleSummaryPointerDown}
          onPointerMove={handleSummaryPointerMove}
          onPointerUp={handleSummaryPointerUp}
          onPointerCancel={() => {
            summaryPointerStartRef.current = null;
            setSummaryNudgeX(0);
          }}
          aria-label={`${choresLeftCount} chores left. Double-tap to redeal chores from highest priority.`}
        >
          <div className="summary-card-top">
            <div className="summary-count-block">
              <div className="summary-icon-badge">
                {choresLeftCount === 0 ? <Sparkles size={20} /> : <Layers size={20} />}
              </div>
              <div>
                <div className="summary-chores-left" data-testid="chores-left-text">
                  {choresLeftCount} {choresLeftCount === 1 ? 'chore' : 'chores'} left
                </div>
                <div className="summary-subtitle">
                  {choresLeftCount === 0 && ignoredCount > 0
                    ? `All remaining chores ignored (${ignoredCount} ignored) — double-tap to redeal!`
                    : choresLeftCount === 0 && allOpenChoresCount === 0
                    ? 'All caught up! Use + in the bottom-left to add a chore.'
                    : visibleChores.length < choresLeftCount
                    ? `Showing top ${visibleChores.length} of ${choresLeftCount} in deck`
                    : `All ${choresLeftCount} open ${
                        choresLeftCount === 1 ? 'chore is' : 'chores are'
                      } in view`}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="summary-history-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenHistory();
              }}
              title="View sleeping recurring chores & completed history"
            >
              <History size={15} />
              <span>
                History
                {sleepingRecurringCount + completedCount > 0
                  ? ` (${sleepingRecurringCount + completedCount})`
                  : ''}
              </span>
            </button>
          </div>

          {/* Breakdown pills */}
          <div className="summary-stats-row">
            {importantCount > 0 && (
              <span className="summary-stat-pill stat-important">
                {importantCount} Important
              </span>
            )}
            {regularCount > 0 && (
              <span className="summary-stat-pill stat-regular">
                {regularCount} Regular
              </span>
            )}
            {somedayCount > 0 && (
              <span className="summary-stat-pill stat-someday">
                {somedayCount} Someday
              </span>
            )}
            {ignoredCount > 0 && (
              <span className="summary-stat-pill stat-ignored">
                {ignoredCount} Ignored today
              </span>
            )}
            {sleepingRecurringCount > 0 && (
              <span className="summary-stat-pill stat-sleeping">
                {sleepingRecurringCount} Scheduled recurring
              </span>
            )}
          </div>

          {/* Bottom Redeal Instruction Bar */}
          <div className="summary-redeal-bar">
            <RefreshCw size={14} className={isRedealing ? 'spin-icon' : ''} />
            <span>
              {showSwipeLockHint
                ? 'Summary card cannot be swiped — double-tap to redeal!'
                : 'Double-tap this card to shuffle & redeal from highest priority (resets daily at 12:00 AM)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
