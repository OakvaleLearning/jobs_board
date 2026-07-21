import { Lock } from 'lucide-react';
import { cn } from '@/lib/cn';

type AvatarSize = 'md' | 'lg';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
};

// Deterministic palette pick from the name so the same worker always gets the
// same colour. Uses the brand/sage/terracotta tones from the design system.
const PALETTE = [
  'bg-brand-100 text-brand-700',
  'bg-sage-500/15 text-sage-600',
  'bg-terracotta-500/15 text-terracotta-700',
  'bg-ink/8 text-ink',
];

function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

function hueFor(name?: string | null): string {
  if (!name) return PALETTE[PALETTE.length - 1] as string;
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length] as string;
}

export function Avatar({
  src,
  name,
  blurred = false,
  size = 'md',
  className,
}: {
  src?: string | null;
  name?: string | null;
  blurred?: boolean;
  size?: AvatarSize;
  className?: string;
}) {
  const base = cn(
    'relative shrink-0 overflow-hidden rounded-2xl border border-ink/8',
    SIZE_CLASSES[size],
    className,
  );

  if (!src) {
    return (
      <div className={cn(base, 'flex items-center justify-center font-semibold', hueFor(name))}>
        {initials(name)}
      </div>
    );
  }

  return (
    <div className={base}>
      {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL, not a static asset */}
      <img
        src={src}
        alt={name ? `${name}` : 'Worker photo'}
        className={cn('h-full w-full object-cover', blurred && 'scale-110')}
        loading="lazy"
      />
      {blurred ? (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/10 backdrop-blur-[1px]">
          <Lock className="h-4 w-4 text-cream-50 drop-shadow" aria-hidden />
          <span className="sr-only">Photo unlocks after engagement</span>
        </div>
      ) : null}
    </div>
  );
}
