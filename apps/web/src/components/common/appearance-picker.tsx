'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import { CATEGORY_COLORS, CATEGORY_ICONS } from '@expense/shared';
import { Check } from 'lucide-react';
import { CATEGORY_ICON_MAP } from '@/components/common/category-icon';
import { cn } from '@/lib/utils';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const { t: tr } = useLanguage();
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{tr('Color')}</legend>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={tr('Color {v0}', { v0: c })}
            aria-pressed={value === c}
            className="flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: c }}
          >
            {value === c && <Check className="size-4 text-white" strokeWidth={3} />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function IconPicker({
  value,
  onChange,
  color,
}: {
  value: string;
  onChange: (icon: (typeof CATEGORY_ICONS)[number]) => void;
  /** Background of the selected icon. */
  color: string;
}) {
  const { t: tr } = useLanguage();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{tr('Icon')}</legend>
      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
        {CATEGORY_ICONS.map((name) => {
          const Icon = CATEGORY_ICON_MAP[name]!;
          const selected = value === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              aria-label={name.replace(/-/g, ' ')}
              aria-pressed={selected}
              className={cn(
                'flex aspect-square items-center justify-center rounded-lg border text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
                selected && 'border-transparent text-white',
              )}
              style={selected ? { backgroundColor: color } : undefined}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
