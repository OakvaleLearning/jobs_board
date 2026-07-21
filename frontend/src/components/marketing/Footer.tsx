import { Lockup } from '@/components/brand/Lockup';

export function Footer() {
  return (
    <footer className="border-t border-ink/8 mt-32">
      <div className="mx-auto w-4/5 px-6 py-12 flex flex-col md:flex-row gap-8 md:items-end md:justify-between">
        <div className="space-y-4">
          <Lockup size="md" href="" />
          <p className="text-sm text-muted max-w-sm">
            A credentialed care marketplace. Trust, accountability, and placement quality —
            engineered into every step.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-ink-600">
          <span className="text-eyebrow text-muted col-span-2">Oakvale Learning Ltd</span>
          <span>Lagos · London</span>
          <span>contact@oakvaleltd.com</span>
          <span className="col-span-2 text-xs text-muted mt-4">© {new Date().getFullYear()} Oakvale Learning Ltd. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
