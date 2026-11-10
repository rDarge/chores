import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  EyeOff,
  Repeat,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  Chore,
  IMPORTANCE_LABELS,
  UpdateChorePayload,
  WEIGHT_LABELS,
} from '../types/chore';
import { formatDueStatus, formatShortDate, formatTimestamp } from '../utils/deck';
import { ChoreFormModal } from './ChoreFormModal';

interface ChoreDetailModalProps {
  chore: Chore;
  currentUser: string;
  todayStr: string;
  onClose: () => void;
  onComplete: (chore: Chore) => void;
  onIgnore: (chore: Chore) => void;
  onUpdate: (id: string, payload: UpdateChorePayload) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const ChoreDetailModal: React.FC<ChoreDetailModalProps> = ({
  chore,
  currentUser,
  todayStr,
  onClose,
  onComplete,
  onIgnore,
  onUpdate,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (isEditing) {
    return (
      <ChoreFormModal
        mode="edit"
        initialChore={chore}
        currentUser={currentUser}
        todayStr={todayStr}
        onClose={() => setIsEditing(false)}
        onUpdate={async (id, payload) => {
          await onUpdate(id, payload);
          setIsEditing(false);
        }}
      />
    );
  }

  const dueInfo = formatDueStatus(chore, todayStr);
  const weightInfo = WEIGHT_LABELS[chore.weight];

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(chore.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-card detail-modal importance-border-${chore.importance}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-chore-title"
      >
        <div className="modal-header">
          <div className="detail-badges">
            <span className={`importance-pill importance-pill-${chore.importance}`}>
              {IMPORTANCE_LABELS[chore.importance]}
            </span>
            <span className={`weight-pill weight-pill-${chore.weight}`}>
              <Clock size={13} />
              <span>{weightInfo.full}</span>
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close chore details"
          >
            <X size={20} />
          </button>
        </div>

        <h2 id="detail-chore-title" className="detail-title">
          {chore.title}
        </h2>

        <div className="detail-schedule-row">
          <span className={`due-pill due-tone-${dueInfo.tone}`}>
            <Calendar size={13} />
            <span>{dueInfo.label}</span>
            {chore.dueDate && ` (${formatShortDate(chore.dueDate)})`}
          </span>
          {dueInfo.recurrenceBadge && (
            <span className="recurrence-pill">
              <Repeat size={13} />
              <span>{dueInfo.recurrenceBadge}</span>
            </span>
          )}
        </div>

        <div className="detail-description-box">
          {chore.description ? (
            <p className="detail-description-text">{chore.description}</p>
          ) : (
            <p className="detail-description-empty">No additional description provided.</p>
          )}
        </div>

        {/* Metadata Section */}
        <div className="detail-metadata-grid">
          <div className="metadata-item">
            <span className="metadata-label">Created</span>
            <span className="metadata-value">
              <User size={13} />
              <span>
                By <strong>{chore.createdBy}</strong> on {formatTimestamp(chore.createdAt)}
              </span>
            </span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Last Completed</span>
            <span className="metadata-value">
              <CheckCircle2 size={13} />
              <span>
                {chore.lastCompletedAt && chore.lastCompletedBy ? (
                  <>
                    By <strong>{chore.lastCompletedBy}</strong> on{' '}
                    {formatTimestamp(chore.lastCompletedAt)}
                  </>
                ) : (
                  'Never completed yet'
                )}
              </span>
            </span>
          </div>
        </div>

        {/* Primary Deck Actions (Complete / Ignore) */}
        {chore.status === 'open' && (
          <div className="detail-primary-actions">
            <button
              type="button"
              className="btn btn-ignore"
              onClick={() => {
                onIgnore(chore);
                onClose();
              }}
            >
              <EyeOff size={17} />
              <span>Ignore for Today</span>
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={() => {
                onComplete(chore);
                onClose();
              }}
            >
              <CheckCircle2 size={17} />
              <span>Mark Complete</span>
            </button>
          </div>
        )}

        {/* Secondary Edit & Delete Actions */}
        <div className="detail-secondary-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsEditing(true)}
          >
            <Edit3 size={16} />
            <span>Edit Chore</span>
          </button>

          {!confirmingDelete ? (
            <button
              type="button"
              className="btn btn-danger-outline"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          ) : (
            <div className="delete-confirm-group">
              <span className="delete-confirm-text">Delete permanently?</span>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
