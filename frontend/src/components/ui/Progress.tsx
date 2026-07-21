import { cn } from '@/lib/cn';

export function Progress({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 w-full rounded-full bg-ink/8 overflow-hidden', className)}>
      <div
        className="h-full rounded-full bg-brand-500 transition-[width] duration-500"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
