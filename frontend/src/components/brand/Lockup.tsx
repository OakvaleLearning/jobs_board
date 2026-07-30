import Link from 'next/link';
import { cn } from '@/lib/cn';

interface LockupProps {
  href?: string;
  tagline?: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'light';
  className?: string;
}

const SIZES = {
  sm: { mark: 'text-lg', tagline: 'text-[10px]' },
  md: { mark: 'text-xl', tagline: 'text-[11px]' },
  lg: { mark: 'text-2xl md:text-3xl', tagline: 'text-xs' },
} as const;

export function Lockup({ href = '/', tagline = 'jobs portal', size = 'md', tone = 'default', className }: LockupProps) {
  const s = SIZES[size];
  const light = tone === 'light';
  const inner = (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <span className={cn('h-display font-medium', light ? 'text-cream-50' : 'text-ink', s.mark)}>Oakvale</span>
      <span className={cn('h-5 w-px', light ? 'bg-cream-50/25' : 'bg-ink/15')} aria-hidden />
      <span
        className={cn(
          'font-sans uppercase tracking-widish',
          light ? 'text-cream-200/70' : 'text-muted',
          s.tagline,
        )}
      >
        {tagline}
      </span>
    </span>
  );
  return href ? (
    <Link href={href} className="inline-flex">
      {inner}
    </Link>
  ) : (
    inner
  );
}
