'use client';

import { usePathname, useRouter, useParams } from 'next/navigation';
import { Globe } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' },
];

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en';

  const switchLanguage = (nextLocale: string) => {
    if (!pathname) return;
    
    const segments = pathname.split('/');
    if (segments.length > 1) {
      segments[1] = nextLocale;
      const newPath = segments.join('/');
      // Preserve any existing query parameters (e.g. ?next=... or filters)
      const search = typeof window !== 'undefined' ? window.location.search : '';
      router.push(newPath + search);
    }
  };

  return (
    <div className="flex items-center">
      <Select value={locale} onValueChange={switchLanguage}>
        <SelectTrigger className="h-8 border-none bg-transparent shadow-none hover:bg-secondary/50 focus:ring-0 gap-2 px-2 text-sm font-medium text-foreground outline-none">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {LOCALES.map((loc) => (
            <SelectItem key={loc.code} value={loc.code} className="cursor-pointer">
              {loc.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
