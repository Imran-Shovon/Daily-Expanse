'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  type Category,
  type TransactionType,
} from '@expense/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ColorPicker, IconPicker } from '@/components/common/appearance-picker';
import { CategoryIcon } from '@/components/common/category-icon';
import { FieldError } from '@/components/common/field-error';
import { TransactionTypeToggle } from '@/components/transactions/transaction-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';
import { useSaveCategory } from '@/lib/api/hooks';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(50, 'Keep the name under 50 characters'),
  type: z.enum(['INCOME', 'EXPENSE']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.enum(CATEGORY_ICONS),
});
type Values = z.infer<typeof schema>;

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  defaultType = 'EXPENSE',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category;
  defaultType?: TransactionType;
}) {
  const { t: tr } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? tr('Edit category') : tr('New category')}</DialogTitle>
          <DialogDescription>
            {tr('Pick a name, color and icon so it is easy to spot in lists and charts.')}{' '}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <CategoryForm
            key={category?.id ?? 'new'}
            category={category}
            defaultType={defaultType}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  category,
  defaultType,
  onDone,
}: {
  category?: Category;
  defaultType: TransactionType;
  onDone: () => void;
}) {
  const { t: tr } = useLanguage();
  const save = useSaveCategory();
  const { register, control, handleSubmit, formState, setError } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? '',
      type: category?.type ?? defaultType,
      color: category?.color ?? CATEGORY_COLORS[0],
      icon: (category?.icon as Values['icon']) ?? 'circle-ellipsis',
    },
  });
  const [name, color, icon] = useWatch({ control, name: ['name', 'color', 'icon'] });
  const typeLocked = Boolean(category && category.transactionCount > 0);

  const submit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: category?.id, input: values });
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        setError('name', { message: error.message });
    }
  });

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
        <CategoryIcon icon={icon} color={color} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-medium">{name || tr('Category name')}</p>
          <p className="text-xs text-muted-foreground">{tr('Preview')}</p>
        </div>
      </div>

      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <div className="space-y-1.5">
            <Label>{tr('Type')}</Label>
            {typeLocked ? (
              <p className="text-sm text-muted-foreground">
                {field.value === 'EXPENSE' ? tr('Expense') : tr('Income')}{' '}
                {tr("— can't change while transactions use this category.")}{' '}
              </p>
            ) : (
              <TransactionTypeToggle value={field.value} onChange={field.onChange} />
            )}
          </div>
        )}
      />

      <div className="space-y-1.5">
        <Label htmlFor="c-name">{tr('Name')}</Label>
        <Input id="c-name" autoFocus aria-invalid={!!formState.errors.name} {...register('name')} />
        <FieldError message={formState.errors.name?.message} />
      </div>

      <Controller
        control={control}
        name="color"
        render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
      />

      <Controller
        control={control}
        name="icon"
        render={({ field }) => (
          <IconPicker value={field.value} onChange={field.onChange} color={color} />
        )}
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone}>
          {tr('Cancel')}{' '}
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          {category ? tr('Save changes') : tr('Create category')}
        </Button>
      </div>
    </form>
  );
}
