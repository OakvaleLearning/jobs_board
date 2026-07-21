import type { ReactNode } from 'react';
import { Lockup } from '@/components/brand/Lockup';
import Link from 'next/link';
import Image from 'next/image';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div
        className="hidden md:flex flex-col items-center justify-between p-10 lg:p-14 text-cream-50 relative overflow-hidden bg-brand-500"
        // style={{
        //   backgroundImage: 'url(/auth-image.png)',
        //   backgroundSize: 'cover',
        //   backgroundPosition: 'center',
        //   backgroundRepeat: 'no-repeat',
        // }}
      >
        {/* <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(28,26,23,0.78) 0%, rgba(28,26,23,0.55) 55%, rgba(67,57,184,0.55) 100%),' +
              'radial-gradient(800px 400px at 80% 20%, rgba(108,99,255,0.30) 0%, transparent 90%),' +
              'radial-gradient(600px 400px at 10% 90%, rgba(92,107,90,0.30) 0%, transparent 90%)',
          }}
          aria-hidden
        /> */}
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="h-display text-2xl text-cream-50">Oakvale</span>
            <span className="h-5 w-px bg-cream-200/30" aria-hidden />
            <span className="text-label text-cream-200/70">jobs portal</span>
          </Link>
        </div>

        <div className="relative space-y-6 max-w-xl">
          {/* <p className="text-eyebrow text-cream-200/60">A note from us</p>
          <h2 className="h-display text-3xl lg:text-4xl leading-snug">
            &ldquo;Every profile here is checked, certified, and accountable. That&rsquo;s the whole product.&rdquo;
          </h2>
          <p className="text-sm text-cream-200/80">Dr Funke Onamusi &middot; Founder, Oakvale Learning</p> */}
          <Image src="/auth-image.svg" alt="Illustration of a caregiver and a family" width={1000} height={500} className="relative z-10 rounded-lg" />
        </div>
        <div className="relative text-xs text-cream-200/60">
          NDPA 2023 compliant &middot; Document-verified &middot; CPD accredited
        </div>
      </div>

      <div className="flex flex-col">
        <div className="md:hidden p-6 border-b border-ink/8">
          <Lockup size="md" />
        </div>
        <div className="flex-1 flex items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
