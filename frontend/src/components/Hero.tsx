import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const stats = [
  { value: '247', label: 'Jobs live' },
  { value: '1,184', label: 'Verified workers' },
  { value: '90-day', label: 'Replacement guarantee' },
];

const Hero = () => {
  return (
    <section className="relative isolate overflow-hidden bg-brand-800">
      {/*
        Full-bleed hero background. Marketing supplies a real photo of an Oakvale
        caregiver at work / a jobseeker applying — drop it in at /landing-hero.png
        (this one path is the only swap point). A green→gold gradient sits over it
        so text stays legible and the Oakvale brand reads through any photo.
      */}
      <div className="absolute inset-0 -z-20 bg-[url('/landing-hero.png')] bg-cover bg-center bg-no-repeat" />
      <div className="absolute inset-0 -z-[15] bg-black/60" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-900/95 via-brand-700/85 to-amber-700/45" />
      <div className="mx-auto max-w-5xl px-6 pt-24 md:pt-32 pb-24 text-left">
        <Badge tone="amber" className="uppercase tracking-widish animate-fade-in">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Nigeria&rsquo;s first credentialed care-work marketplace
        </Badge>

        <h1 className="h-display mt-8 text-5xl md:text-7xl leading-[1.04] text-white tracking-tight animate-fade-up">
          Trusted care work.
          <span className="block italic text-amber-300">Trusted care workers.</span>
        </h1>

        <p className="mt-7 max-w-2xl text-lg md:text-xl text-white/90 leading-relaxed animate-fade-in [animation-delay:200ms]">
          Oakvale connects Nigerian corporates and diaspora families with certified,
          background-checked caregivers &mdash; and gives care workers a credentialed
          profile that gets them hired. Every placement checked, certified, and accountable.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-start gap-3 animate-fade-in [animation-delay:300ms]">
          <Link href="/register?role=WORKER" className="sm:w-auto">
            <Button size="lg" className="w-full bg-amber-400 text-ink hover:bg-amber-300">
              Find care work
            </Button>
          </Link>
          <Link href="/register?type=INDIVIDUAL_EMPLOYER" className="sm:w-auto">
            <Button size="lg" className="w-full bg-white text-brand-800 hover:bg-cream-100">
              Hire trusted staff
            </Button>
          </Link>
        </div>

        <dl className="mt-16 flex max-w-2xl items-stretch justify-start divide-x divide-white/15 animate-fade-up [animation-delay:400ms]">
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
