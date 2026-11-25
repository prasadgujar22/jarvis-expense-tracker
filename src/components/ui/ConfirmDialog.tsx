import { Modal } from './Modal';
import { Button } from './Button';

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', danger = true }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      testId="confirm-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} data-autofocus>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            data-testid="confirm-dialog-confirm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
