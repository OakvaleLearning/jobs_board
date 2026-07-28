import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

/**
 * Composable table primitives. These standardize the wrapper, header
 * background, header typography, cell padding, and row divider/hover so every
 * table across the app reads identically. Cell content stays fully custom —
 * drop badges, avatars, and icon buttons straight into `<TD>`.
 *
 * Usage:
 *   <Table>
 *     <THead><TR><TH>Name</TH>…</TR></THead>
 *     <TBody>
 *       <TR onClick={…}><TD>…</TD></TR>
 *     </TBody>
 *   </Table>
 */
export function Table({
  className,
  children,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-card">
      <table className={cn('w-full text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function THead({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'bg-cream-50 text-left text-eyebrow text-muted',
        className,
      )}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('divide-y divide-ink/8', className)} {...props}>
      {children}
    </tbody>
  );
}

interface TRProps extends HTMLAttributes<HTMLTableRowElement> {
  /** When true (or an onClick is set), adds pointer + hover affordance. */
  interactive?: boolean;
}

export function TR({ className, interactive, onClick, children, ...props }: TRProps) {
  const clickable = interactive ?? Boolean(onClick);
  return (
    <tr
      onClick={onClick}
      className={cn(clickable && 'cursor-pointer transition hover:bg-cream-50/60', className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TH({
  className,
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn('px-4 py-3 font-medium', className)} {...props}>
      {children}
    </th>
  );
}

interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
  /** Convenience: dim the cell to the muted text tone. */
  muted?: boolean;
}

export function TD({ className, muted, children, ...props }: TDProps) {
  return (
    <td className={cn('px-4 py-3', muted ? 'text-muted' : 'text-ink', className)} {...props}>
      {children}
    </td>
  );
}

/** Full-width empty-state row spanning all columns. */
export function TableEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-center text-muted">
        {children}
      </td>
    </tr>
  );
}
