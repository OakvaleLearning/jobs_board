import type { MouseEventHandler } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'default' | 'primary' | 'danger';

const TONES: Record<Tone, string> = {
  default: 'text-muted hover:text-ink hover:bg-ink/5',
  primary: 'text-brand-700 hover:bg-brand-50',
  danger: 'text-terracotta-700 hover:bg-terracotta-50',
};

interface IconButtonProps {
  icon: LucideIcon;
  /** Accessible name — used for both `aria-label` and the native `title` tooltip. */
  label: string;
  tone?: Tone;
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  disabled?: boolean;
  className?: string;
}

/** Compact icon-only action for table rows. Renders a Next `Link` when `href` is set, else a button. */
export function IconButton({
  icon: Icon,
  label,
  tone = 'default',
  href,
  onClick,
  disabled = false,
  className,
}: IconButtonProps) {
  const classes = cn(
    'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30',
    TONES[tone],
    disabled && 'pointer-events-none opacity-50',
    className,
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} onClick={onClick} className={classes}>
        <Icon className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(classes, 'disabled:cursor-not-allowed')}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
