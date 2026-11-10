import React from 'react';
import { RotateCcw, X } from 'lucide-react';

export interface UndoAction {
  id: string;
  message: string;
  onUndo: () => void;
}

interface UndoToastProps {
  action: UndoAction | null;
  onDismiss: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({ action, onDismiss }) => {
  if (!action) return null;

  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span className="undo-toast-message">{action.message}</span>
      <div className="undo-toast-buttons">
        <button
          type="button"
          className="undo-toast-btn"
          onClick={() => {
            action.onUndo();
            onDismiss();
          }}
        >
          <RotateCcw size={15} />
          <span>Undo</span>
        </button>
        <button
          type="button"
          className="undo-toast-close"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
