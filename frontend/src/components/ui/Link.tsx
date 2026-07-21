import NextLink, { type LinkProps } from 'next/link';
import type { AnchorHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Canonical inline-link styling. Use `linkClass` directly on a bare `<a>` or
 * external link; use the `TextLink` wrapper for internal `next/link` navigation.
 */
export const linkClass =
  'text-ink underline underline-offset-4 decoration-ink/30 hover:decoration-ink transition';

type TextLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;

export function TextLink({ className, children, ...props }: TextLinkProps) {
  return (
    <NextLink className={cn(linkClass, className)} {...props}>
      {children}
    </NextLink>
  );
}
