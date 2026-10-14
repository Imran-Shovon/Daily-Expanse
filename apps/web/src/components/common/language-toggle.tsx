'use client';

import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/language-provider';

/** Both language names remain readable regardless of the current selection. */
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1.5 px-2"
      onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
      aria-label={language === 'en' ? 'Switch to Bangla' : 'Switch to English'}
      title={language === 'en' ? 'বাংলায় দেখুন' : 'View in English'}
    >
      <Languages className="size-4" aria-hidden />
      <span lang={language === 'en' ? 'bn' : 'en'}>{language === 'en' ? 'বাংলা' : 'English'}</span>
    </Button>
  );
}
