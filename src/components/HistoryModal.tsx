import React, { useState } from 'react';
import { Calendar, CheckCircle2, Repeat, RotateCcw, Trash2, X } from 'lucide-react';
import { Chore, IMPORTANCE_LABELS, WEIGHT_LABELS } from '../types/chore';
import { formatShortDate, formatTimestamp } from '../utils/deck';

interface HistoryModalProps {
  chores: Chore[];
  onClose: () => void;
  onSelectChore: (chore: Chore) => void;
  onReopenChore: (chore: Chore) => Promise<void>;
  onDeleteChore: (id: string) => Promise<void>;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  chores,
  onClose,
  onSelectChore,
  onReopenChore,
  onDeleteChore,
}) => {
  const [tab, setTab] = useState<'recurring' | 'completed'>('recurring');

  const sleepingRecurring = chores
    .filter((c) => c.status === 'completed' && c.dueType === 'recurring')
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

  const completedHistory = chores
    .filter((c) => c.status === 'completed' && c.dueType !== 'recurring')
    .sort((a, b) => (b.lastCompletedAt ?? '').localeCompare(a.lastCompletedAt ?? ''));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card history-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
      >
        <div className="modal-header">
          <h2 id="history-modal-title" className="modal-title">
            Scheduled & Completed Chores
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close history modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="segmented-control history-tabs">
          <button
            type="button"
            className={`segment-btn ${tab === 'recurring' ? 'active' : ''}`}
            onClick={() => setTab('recurring')}
          >
            <Repeat size={14} />
            <span>Sleeping Recurring ({sleepingRecurring.length})</span>
          </button>
          <button
            type="button"
            className={`segment-btn ${tab === 'completed' ? 'active' : ''}`}
            onClick={() => setTab('completed')}
          >
            <CheckCircle2 size={14} />
            <span>Completed One-Offs ({completedHistory.length})</span>
          </button>
        </div>

        <div className="history-list">
          {tab === 'recurring' && sleepingRecurring.length === 0 && (
            <div className="history-empty">
              No sleeping recurring chores right now. When you complete a recurring chore, it rests here until its next due date!
            </div>
          )}

          {tab === 'recurring' &&
            sleepingRecurring.map((chore) => (
              <div key={chore.id} className="history-item">
                <div
                  className="history-item-main"
                  onClick={() => {
                    onClose();
                    onSelectChore(chore);
                  }}
                >
                  <div className="history-item-top">
                    <span className="history-item-title">{chore.title}</span>
                    <span className={`importance-pill importance-pill-${chore.importance}`}>
                      {IMPORTANCE_LABELS[chore.importance]}
                    </span>
                    <span className="weight-pill">{WEIGHT_LABELS[chore.weight].short}</span>
                  </div>
                  <div className="history-item-meta">
                    <span>
                      <Repeat size={12} /> Every {chore.intervalDays}d • Reopens{' '}
                      <strong>{chore.dueDate ? formatShortDate(chore.dueDate) : 'soon'}</strong>
                    </span>
                    {chore.lastCompletedBy && (
                      <span>
                        Last done by <strong>{chore.lastCompletedBy}</strong> (
                        {formatTimestamp(chore.lastCompletedAt)})
                      </span>
                    )}
                  </div>
                </div>
                <div className="history-item-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    title="Wake up and put back into today's open deck now"
                    onClick={() => onReopenChore(chore)}
                  >
                    <RotateCcw size={14} />
                    <span>Wake Now</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger-outline"
                    title="Delete chore"
                    onClick={() => onDeleteChore(chore.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

          {tab === 'completed' && completedHistory.length === 0 && (
            <div className="history-empty">No completed one-off chores yet.</div>
          )}

          {tab === 'completed' &&
            completedHistory.map((chore) => (
              <div key={chore.id} className="history-item">
                <div
                  className="history-item-main"
                  onClick={() => {
                    onClose();
                    onSelectChore(chore);
                  }}
                >
                  <div className="history-item-top">
                    <span className="history-item-title">{chore.title}</span>
                    <span className={`importance-pill importance-pill-${chore.importance}`}>
                      {IMPORTANCE_LABELS[chore.importance]}
                    </span>
                  </div>
                  <div className="history-item-meta">
                    <span>
                      Completed by <strong>{chore.lastCompletedBy ?? 'Unknown'}</strong> on{' '}
                      {formatTimestamp(chore.lastCompletedAt)}
                    </span>
                    {chore.dueDate && (
                      <span>
                        <Calendar size={12} /> Was due {formatShortDate(chore.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="history-item-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    title="Reopen chore"
                    onClick={() => onReopenChore(chore)}
                  >
                    <RotateCcw size={14} />
                    <span>Reopen</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger-outline"
                    title="Delete permanently"
                    onClick={() => onDeleteChore(chore.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
