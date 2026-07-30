import { Lockup } from '@/components/brand/Lockup';

export function Footer() {
  return (
    <footer className="bg-[#0F3D2E] text-cream-100 border-t border-white/10 mt-32">
      <div className="mx-auto w-4/5 px-6 py-12 flex flex-col md:flex-row gap-8 md:items-end md:justify-between">
        <div className="space-y-4">
          <Lockup size="md" href="" tone="light" />
          <p className="text-sm text-cream-200/80 max-w-sm">
            A credentialed care marketplace. Trust, accountability, and placement quality,
            engineered into every step.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-cream-100/90">
          <span className="text-eyebrow text-cream-200/70 col-span-2">Oakvale Learning Ltd</span>
          <span>Lagos · London</span>
          <span>contact@oakvaleltd.com</span>
          <span className="col-span-2 text-xs text-cream-200/60 mt-4">© {new Date().getFullYear()} Oakvale Learning Ltd. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
