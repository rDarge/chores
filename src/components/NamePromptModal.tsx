import React, { useState } from 'react';
import { Sparkles, UserCheck } from 'lucide-react';

interface NamePromptModalProps {
  initialName?: string;
  isEditing?: boolean;
  onSave: (name: string) => void;
  onCancel?: () => void;
}

export const NamePromptModal: React.FC<NamePromptModalProps> = ({
  initialName = '',
  isEditing = false,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(initialName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  return (
    <div className="modal-backdrop" onClick={isEditing ? onCancel : undefined}>
      <div
        className="modal-card name-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-modal-title"
      >
        <div className="name-modal-icon">
          <Sparkles size={26} />
        </div>
        <h2 id="name-modal-title" className="modal-title">
          {isEditing ? 'Switch Your Name' : 'Welcome to Chore Deck'}
        </h2>
        <p className="modal-subtitle">
          {isEditing
            ? 'Update the name saved on this device for creating and completing chores.'
            : "Pick a name for this device. We'll remember it locally so we know who created or completed each chore."}
        </p>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="form-label" htmlFor="user-name-input">
            Your Name
          </label>
          <input
            id="user-name-input"
            type="text"
            className="form-input form-input-lg"
            placeholder="e.g., Ryan, Alex, Sam..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={32}
            required
          />
          <div className="modal-actions">
            {isEditing && onCancel && (
              <button type="button" className="btn btn-secondary" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-full" disabled={!name.trim()}>
              <UserCheck size={18} />
              <span>{isEditing ? 'Save Name' : 'Start Dealing Chores'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
