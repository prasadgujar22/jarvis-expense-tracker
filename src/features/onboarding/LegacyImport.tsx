import { useEffect, useState } from 'react';
import { HardDriveUpload } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { clearLegacyData, hasLegacyData, loadLegacyData, type LegacyData } from '../../store/persist';
import { useStore } from '../../store/store';
import { useSync } from '../../sync/sync';
import { useUI } from '../../store/ui';

const DISMISS_KEY = 'kosh:legacy-dismissed';

/**
 * One-time offer to upload data saved by the pre-account version of Kosh (localStorage kosh:v1:*) into the
 * signed-in account. "Not now" asks again next session; "Discard" deletes it from this device.
 */
export function LegacyImport() {
  const ready = useSync((s) => s.phase === 'ready' && s.fromServer);
  const [legacy, setLegacy] = useState<LegacyData | null>(null);
  const [open, setOpen] = useState(false);
  const toast = useUI((s) => s.toast);

  useEffect(() => {
    if (!ready) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* ignore */
    }
    if (!hasLegacyData()) return;
    const data = loadLegacyData();
    if (!data) {
      clearLegacyData();
      return;
    }
    setLegacy(data);
    setOpen(true);
  }, [ready]);

  if (!legacy) return null;
  const c = legacy.counts;
  const parts = [
    [c.transactions, 'transaction'],
    [c.accounts, 'account'],
    [c.budgets, 'budget'],
    [c.recurring, 'recurring rule'],
    [c.goals, 'goal'],
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, w]) => n + ' ' + w + ((n as number) === 1 ? '' : 's'));

  const doImport = () => {
    const s = useStore.getState().settings;
    const settings = s.onboarded
      ? { onboarded: true }
      : { onboarded: true, name: legacy.settings.name, currency: legacy.settings.currency, theme: legacy.settings.theme, lastAccountId: legacy.settings.lastAccountId };
    useStore.getState().mergeData(legacy.data, settings);
    clearLegacyData();
    setOpen(false);
    toast({ message: 'Imported ' + (parts.join(', ') || 'your data') + ' into your account', tone: 'success', duration: 6000 });
  };
  const notNow = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };
  const discard = () => {
    clearLegacyData();
    setOpen(false);
    toast({ message: 'Removed the old data from this device' });
  };

  return (
    <Modal
      open={open}
      onClose={notNow}
      title="Import data from this device?"
      description="This browser has Kosh data saved before you had an account."
      size="sm"
      testId="legacy-import"
      footer={
        <>
          <Button variant="ghost" className="mr-auto text-danger hover:text-danger" onClick={discard} data-testid="legacy-discard">Discard</Button>
          <Button variant="ghost" onClick={notNow} data-testid="legacy-not-now">Not now</Button>
          <Button variant="primary" onClick={doImport} data-testid="legacy-import-confirm" data-autofocus>Import</Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2 p-4">
        <HardDriveUpload className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
        <div className="text-sm">
          <p className="font-medium" data-testid="legacy-summary">{parts.length ? parts.join(' · ') : 'Your categories and preferences'}</p>
          {legacy.demoSkipped > 0 && <p className="mt-1 text-xs text-muted" data-testid="legacy-demo-note">The sample data that came with the old version is left out.</p>}
          <p className="mt-1 text-muted">Import uploads it to your account so it syncs everywhere, then removes the local copy. Items that already exist in your account with the same id are replaced.</p>
        </div>
      </div>
    </Modal>
  );
}
