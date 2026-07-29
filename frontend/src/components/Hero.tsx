'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const stats = [
  { value: '247', label: 'Jobs live' },
  { value: '1,184', label: 'Verified workers' },
  { value: '90 day', label: 'Replacement guarantee' },
];

// Auto-rotating hero slides. Each slide swaps the full-bleed background photo and
// the accompanying copy together, alternating the two care specialisms Oakvale
// serves — childcare and elderly care. Marketing supplies the photos at the paths
// below; the green→gold gradient overlay keeps text legible over any image.
const slides = [
  {
    image: '/hero-image2.png',
    eyebrow: 'Certified childcare experts',
    heading: 'Childcare experts.',
    accent: 'Ready when your family is.',
    body: 'Hire CPD-certified, background-checked nannies and crèche staff. Every childcare placement checked, certified, and accountable.',
  },
  {
    image: '/landing-hero.png',
    eyebrow: 'Compassionate, credentialed elderly care',
    heading: 'Trusted elderly care.',
    accent: 'The dignity your loved ones deserve.',
    body: 'Match with verified caregivers trained in elderly and companion care, backed by welfare checks and a 90-day replacement guarantee.',
  },
];

const ROTATE_MS = 6000;

const Hero = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, ROTATE_MS);

    return () => window.clearInterval(id);
  }, []);

  const slide = slides[active]!;

  return (
    <section className="relative isolate overflow-hidden bg-brand-800">
      {/* Crossfading background photos — one stacked layer per slide. */}
      {slides.map((s, i) => (
        <div
          key={s.image}
          className={`absolute inset-0 -z-20 bg-cover bg-center bg-no-repeat border-b border-brand-700/50 transition-opacity duration-1000 ease-out ${
            i === active ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ backgroundImage: `url('${s.image}')` }}
          aria-hidden={i !== active}
        />
      ))}
      <div className="absolute inset-0 -z-[15] bg-black/40" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-900/95 via-brand-700/85 to-amber-700/45" />
      {/* Dotted-grid texture layer for depth over the photo. */}
      <div className="bg-dot-grid bg-dot-grid-light absolute inset-0 -z-[11] opacity-60" aria-hidden />
      {/* Soft amber aura top-right + emerald aura bottom-left, and a fade into the page below. */}
      <div
        className="absolute -top-24 -right-24 -z-[9] h-96 w-96 rounded-full bg-amber-400/25 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -bottom-32 -left-24 -z-[9] h-[28rem] w-[28rem] rounded-full bg-brand-500/25 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 -z-[8] h-32 bg-gradient-to-b from-transparent to-cream-50"
        aria-hidden
      />
      <div className="mx-auto max-w-[80%] px-6 pt-24 md:pt-32 pb-24 text-left">
        {/* Rotating copy — keyed on the active slide so the entrance animations replay. */}
        <div key={active}>
          <Badge tone="amber" className="uppercase tracking-widish animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            {slide.eyebrow}
          </Badge>

          <h1 className="h-display mt-8 text-5xl md:text-7xl leading-[1.04] text-white tracking-tight animate-fade-up">
            {slide.heading}
            <span className="block italic text-amber-300">{slide.accent}</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg md:text-xl text-white/90 leading-relaxed animate-fade-in [animation-delay:200ms]">
            {slide.body}
          </p>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-start gap-3 animate-fade-in [animation-delay:300ms]">
          <Link href="/register?role=WORKER" className="sm:w-auto">
            <Button size="lg" className="w-full bg-amber-400 text-ink hover:bg-amber-300 shadow-amberLift">
              Find care work
            </Button>
          </Link>
          <Link href="/register?type=INDIVIDUAL_EMPLOYER" className="sm:w-auto">
            <Button size="lg" className="w-full bg-white text-brand-800 hover:bg-cream-100">
              Hire trusted staff
            </Button>
          </Link>
        </div>

        <p className="mt-5 flex items-center gap-2 text-sm text-white/70 animate-fade-in [animation-delay:350ms]">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-300" />
          Trusted by diaspora families across the UK &amp; US and Nigerian corporate crèches.
        </p>

        {/* Slide indicators — also allow manual navigation. */}
        <div className="mt-10 flex items-center gap-2.5" role="tablist" aria-label="Hero slides">
          {slides.map((s, i) => (
            <button
              key={s.image}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={s.heading}
              onClick={() => setActive(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? 'w-8 bg-amber-400' : 'w-3 bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>

        <dl className="mt-16 flex max-w-2xl items-stretch justify-start divide-x divide-white/15 rounded-2xl border border-white/15 bg-white/10 px-2 py-5 backdrop-blur-xl shadow-glass animate-fade-up [animation-delay:400ms]">
          {stats.map(({ value, label }) => (
            <div key={label} className="flex-1 px-4 md:px-8">
              <dd className="h-display text-3xl md:text-4xl text-white tabular-nums">{value}</dd>
              <dt className="text-eyebrow mt-2 text-white/60">{label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

export default Hero;
