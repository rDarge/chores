import React, { useState } from 'react';
import { Calendar, Clock, Flag, Plus, Repeat, Save, X } from 'lucide-react';
import {
  Chore,
  CreateChorePayload,
  DueType,
  Importance,
  UpdateChorePayload,
  Weight,
} from '../types/chore';

interface ChoreFormModalProps {
  mode: 'create' | 'edit';
  initialChore?: Chore;
  currentUser: string;
  todayStr: string;
  onClose: () => void;
  onCreate?: (payload: CreateChorePayload) => Promise<void>;
  onUpdate?: (id: string, payload: UpdateChorePayload) => Promise<void>;
}

const INTERVAL_PRESETS = [
  { label: 'Every day', days: 1 },
  { label: 'Every 2 days', days: 2 },
  { label: 'Every 3 days', days: 3 },
  { label: 'Weekly (7d)', days: 7 },
  { label: 'Biweekly (14d)', days: 14 },
  { label: 'Monthly (30d)', days: 30 },
];

export const ChoreFormModal: React.FC<ChoreFormModalProps> = ({
  mode,
  initialChore,
  currentUser,
  todayStr,
  onClose,
  onCreate,
  onUpdate,
}) => {
  const [title, setTitle] = useState(initialChore?.title ?? '');
  const [description, setDescription] = useState(initialChore?.description ?? '');
  const [importance, setImportance] = useState<Importance>(
    initialChore?.importance ?? 'someday'
  );
  const [weight, setWeight] = useState<Weight>(initialChore?.weight ?? 'light');
  const [dueType, setDueType] = useState<DueType>(initialChore?.dueType ?? 'none');
  const [dueDate, setDueDate] = useState<string>(initialChore?.dueDate ?? todayStr);
  const [intervalDays, setIntervalDays] = useState<number>(
    initialChore?.intervalDays ?? 2
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a chore title.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const resolvedDueDate =
        dueType === 'none' ? null : dueDate || todayStr;
      const resolvedInterval =
        dueType === 'recurring' ? Math.max(1, Math.floor(Number(intervalDays) || 2)) : null;

      if (mode === 'create' && onCreate) {
        await onCreate({
          title: title.trim(),
          description: description.trim(),
          importance,
          weight,
          dueType,
          dueDate: resolvedDueDate,
          intervalDays: resolvedInterval,
          createdBy: currentUser,
        });
      } else if (mode === 'edit' && initialChore && onUpdate) {
        await onUpdate(initialChore.id, {
          title: title.trim(),
          description: description.trim(),
          importance,
          weight,
          dueType,
          dueDate: resolvedDueDate,
          intervalDays: resolvedInterval,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save chore');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card chore-form-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chore-form-title"
      >
        <div className="modal-header">
          <h2 id="chore-form-title" className="modal-title">
            {mode === 'create' ? 'New Chore' : 'Edit Chore'}
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="form-error">{error}</div>}

          {/* Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="chore-title-input">
              Title <span className="required-star">*</span>
            </label>
            <input
              id="chore-title-input"
              type="text"
              className="form-input"
              placeholder="e.g., Vacuum living room, Water plants..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              maxLength={100}
              required
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="chore-desc-input">
              Description
            </label>
            <textarea
              id="chore-desc-input"
              className="form-textarea"
              placeholder="Any specific details, supplies needed, or instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Importance Selector */}
          <div className="form-group">
            <label className="form-label">
              <Flag size={14} />
              <span>Importance</span>
            </label>
            <div className="segmented-control">
              {(
                [
                  { value: 'important', label: 'Important' },
                  { value: 'regular', label: 'Regular' },
                  { value: 'someday', label: 'Someday' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`segment-btn segment-importance-${opt.value} ${
                    importance === opt.value ? 'active' : ''
                  }`}
                  onClick={() => setImportance(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Weight Selector */}
          <div className="form-group">
            <label className="form-label">
              <Clock size={14} />
              <span>Weight (Effort)</span>
            </label>
            <div className="segmented-control">
              {(
                [
                  { value: 'light', label: 'Light', sub: '5–30m' },
                  { value: 'medium', label: 'Medium', sub: '30–60m' },
                  { value: 'heavy', label: 'Heavy', sub: '>60m' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`segment-btn segment-weight-${opt.value} ${
                    weight === opt.value ? 'active' : ''
                  }`}
                  onClick={() => setWeight(opt.value)}
                >
                  <span className="segment-main">{opt.label}</span>
                  <span className="segment-sub">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Due Date / Recurrence */}
          <div className="form-group">
            <label className="form-label">
              <Calendar size={14} />
              <span>Due Date / Schedule (Optional)</span>
            </label>
            <div className="segmented-control">
              {(
                [
                  { value: 'none', label: 'No Due Date' },
                  { value: 'specific', label: 'Specific Day' },
                  { value: 'recurring', label: 'Recurring' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`segment-btn ${dueType === opt.value ? 'active' : ''}`}
                  onClick={() => setDueType(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {dueType === 'specific' && (
              <div className="due-subpanel">
                <label className="form-sublabel" htmlFor="specific-due-date">
                  Due on date:
                </label>
                <input
                  id="specific-due-date"
                  type="date"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
            )}

            {dueType === 'recurring' && (
              <div className="due-subpanel">
                <div className="preset-chips">
                  {INTERVAL_PRESETS.map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      className={`preset-chip ${
                        intervalDays === preset.days ? 'active' : ''
                      }`}
                      onClick={() => setIntervalDays(preset.days)}
                    >
                      <Repeat size={12} />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>

                <div className="recurring-inputs-row">
                  <div className="recurring-field">
                    <label className="form-sublabel" htmlFor="interval-days-input">
                      Repeat every (days):
                    </label>
                    <input
                      id="interval-days-input"
                      type="number"
                      min={1}
                      max={365}
                      className="form-input"
                      value={intervalDays}
                      onChange={(e) =>
                        setIntervalDays(Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                      required
                    />
                  </div>
                  <div className="recurring-field">
                    <label className="form-sublabel" htmlFor="recurring-start-date">
                      Next due date:
                    </label>
                    <input
                      id="recurring-start-date"
                      type="date"
                      className="form-input"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {mode === 'create' ? <Plus size={18} /> : <Save size={18} />}
              <span>
                {submitting
                  ? 'Saving...'
                  : mode === 'create'
                  ? 'Create Chore'
                  : 'Save Changes'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
