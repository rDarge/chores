import React, { useRef, useState } from 'react';
import { Calendar, CheckCircle2, Clock, EyeOff, Repeat, User } from 'lucide-react';
import { Chore, IMPORTANCE_LABELS, WEIGHT_LABELS } from '../types/chore';
import { formatDueStatus } from '../utils/deck';

interface SwipeableChoreCardProps {
  chore: Chore;
  stackIndex: number; // 0, 1, or 2
  totalChoreCards: number;
  todayStr: string;
  onComplete: (chore: Chore) => void;
  onIgnore: (chore: Chore) => void;
  onSelect: (chore: Chore) => void;
}

const SWIPE_THRESHOLD = 88;

export const SwipeableChoreCard: React.FC<SwipeableChoreCardProps> = ({
  chore,
  stackIndex,
  todayStr,
  onComplete,
  onIgnore,
  onSelect,
}) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);

  const pointerStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const lockedHorizontalRef = useRef(false);

  const dueInfo = formatDueStatus(chore, todayStr);
  const weightInfo = WEIGHT_LABELS[chore.weight];

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (exitDirection) return;
    // Only primary mouse button or touch
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    lockedHorizontalRef.current = false;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start || exitDirection) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (!lockedHorizontalRef.current) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.1) {
        lockedHorizontalRef.current = true;
        try {
          e.currentTarget.setPointerCapture(start.pointerId);
        } catch {
          // Ignore pointer capture errors
        }
      } else if (Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx)) {
        // User is scrolling vertically; cancel horizontal drag
        pointerStartRef.current = null;
        setIsDragging(false);
        setDragX(0);
        return;
      }
    }

    if (lockedHorizontalRef.current) {
      setDragX(dx);
    }
  };

  const finishGesture = (clientX: number, clientY: number) => {
    const start = pointerStartRef.current;
    if (!start) return;
    pointerStartRef.current = null;
    setIsDragging(false);

    const dx = clientX - start.x;
    const dy = clientY - start.y;
    const totalDist = Math.hypot(dx, dy);

    if (!lockedHorizontalRef.current && totalDist < 10) {
      setDragX(0);
      onSelect(chore);
      return;
    }

    if (dx >= SWIPE_THRESHOLD) {
      setExitDirection('right');
      setDragX(420);
      setTimeout(() => {
        onComplete(chore);
      }, 210);
    } else if (dx <= -SWIPE_THRESHOLD) {
      setExitDirection('left');
      setDragX(-420);
      setTimeout(() => {
        onIgnore(chore);
      }, 210);
    } else {
      setDragX(0);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    finishGesture(e.clientX, e.clientY);
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
    lockedHorizontalRef.current = false;
    setIsDragging(false);
    setDragX(0);
  };

  const progress = Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1);
  const swipeRightOpacity = dragX > 20 ? Math.min((dragX - 20) / (SWIPE_THRESHOLD - 15), 1) : 0;
  const swipeLeftOpacity = dragX < -20 ? Math.min((-dragX - 20) / (SWIPE_THRESHOLD - 15), 1) : 0;
  const rotation = (dragX / 28) * 1.2;

  return (
    <div
      className={`stack-card chore-card importance-${chore.importance} stack-pos-${stackIndex} ${
        isDragging ? 'is-dragging' : ''
      } ${exitDirection ? `exiting-${exitDirection}` : ''}`}
      style={{
        transform: `translate3d(${dragX}px, 0, 0) rotate(${rotation}deg)`,
        zIndex: (10 + stackIndex) + (isDragging && Math.abs(dragX) > 8 ? 20 : 0),
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      role="button"
      tabIndex={0}
      aria-label={`${chore.title}, ${IMPORTANCE_LABELS[chore.importance]}, ${dueInfo.label}. Tap for details, swipe right to complete, swipe left to ignore.`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(chore);
        }
      }}
    >
      {/* Visual Swipe Feedback Overlays */}
      {swipeRightOpacity > 0 && (
        <div
          className="swipe-badge swipe-badge-complete"
          style={{ opacity: swipeRightOpacity, transform: `scale(${0.85 + progress * 0.15})` }}
        >
          <CheckCircle2 size={20} />
          <span>COMPLETE</span>
        </div>
      )}
      {swipeLeftOpacity > 0 && (
        <div
          className="swipe-badge swipe-badge-ignore"
          style={{ opacity: swipeLeftOpacity, transform: `scale(${0.85 + progress * 0.15})` }}
        >
          <EyeOff size={20} />
          <span>IGNORE</span>
        </div>
      )}

      {/* Top row: Rank number, Importance pill, Weight pill, Due pill */}
      <div className="card-header-row">
        <div className="card-badges-left">
          <span className="card-rank-pill">#{stackIndex + 1}</span>
          <span className={`importance-pill importance-pill-${chore.importance}`}>
            {IMPORTANCE_LABELS[chore.importance]}
          </span>
          <span className={`weight-pill weight-pill-${chore.weight}`} title={weightInfo.full}>
            <Clock size={12} />
            <span>{weightInfo.short}</span>
          </span>
        </div>

        <div className="card-badges-right">
          {dueInfo.recurrenceBadge && (
            <span className="recurrence-pill" title={`Repeats: ${dueInfo.recurrenceBadge}`}>
              <Repeat size={11} />
              <span>{dueInfo.recurrenceBadge}</span>
            </span>
          )}
          <span className={`due-pill due-tone-${dueInfo.tone}`}>
            <Calendar size={12} />
            <span>{dueInfo.label}</span>
          </span>
        </div>
      </div>

      {/* Main Title & Description preview */}
      <div className="card-body">
        <h3 className="card-title">{chore.title}</h3>
        {chore.description ? (
          <p className="card-description">{chore.description}</p>
        ) : (
          <p className="card-description card-description-empty">Tap card to view or edit details</p>
        )}
      </div>

      {/* Footer Metadata & Swipe Hint */}
      <div className="card-footer">
        <div className="card-meta-mini">
          <User size={12} />
          <span>
            {chore.lastCompletedBy
              ? `Last done by ${chore.lastCompletedBy}`
              : `Added by ${chore.createdBy}`}
          </span>
        </div>
        <div className="card-gesture-hints">
          <span className="hint-ignore">← Ignore</span>
          <span className="hint-dot">•</span>
          <span className="hint-tap">Tap to zoom</span>
          <span className="hint-dot">•</span>
          <span className="hint-complete">Done →</span>
        </div>
      </div>
    </div>
  );
};
