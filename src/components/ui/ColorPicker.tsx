import { PALETTE } from '../../data/icons';
import { cn } from '../../lib/cn';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium text-muted">Colour</legend>
      <div className="flex flex-wrap gap-2">
        {PALETTE.map((c) => (
          <button key={c} type="button" aria-label={'Colour ' + c} aria-pressed={value === c} onClick={() => onChange(c)} className={cn('h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition', value === c ? 'ring-2 ring-fg' : 'hover:scale-110')} style={{ background: c }} />
        ))}
      </div>
    </fieldset>
  );
}
