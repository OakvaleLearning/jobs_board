import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck,
  FileSearch,
  Handshake,
  HeartPulse,
  ClipboardList,
  Users,
  BadgeCheck,
  Award,
  Fingerprint,
  Globe,
  ArrowRight,
  Quote,
  type LucideIcon,
} from 'lucide-react';
import { Nav } from '@/components/marketing/Nav';
import { Footer } from '@/components/marketing/Footer';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Hero from '@/components/Hero';

export default function LandingPage() {
  return (
    <main>
      <Nav />

      {/* Hero */}
      <Hero />

      {/* Trust bar — credential chips bridging the hero into the page. */}
      <section aria-label="Credentials" className="relative overflow-hidden bg-brand-800">
        {/* <div className="bg-dot-grid bg-dot-grid-light absolute inset-0 opacity-50" aria-hidden /> */}
        {/* <div
          className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-cream-100"
          aria-hidden
        /> */}
        <div className="relative mx-auto w-4/5 px-6 py-8">
          <p className="text-eyebrow text-center text-cream-200/60">
            Every profile vetted, credentialed and accountable
          </p>
          <div className="stagger mt-5 flex flex-wrap items-center justify-center gap-3">
            <TrustChip icon={Award} label="CPD Accredited" />
            <TrustChip icon={Fingerprint} label="NIN Identity Verified" />
            <TrustChip icon={FileSearch} label="Police Character Cert" />
            <TrustChip icon={ShieldCheck} label="90-day Guarantee" />
            <TrustChip icon={Globe} label="GBP / USD & NGN" />
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="relative overflow-hidden">
        {/* <div className="bg-dot-grid absolute -top-10 left-0 h-72 w-72 opacity-40" aria-hidden /> */}
        <div className="relative mx-auto w-4/5 px-6 py-20 md:py-24">
          <div className="grid items-start gap-10 md:grid-cols-12">
            <div className="md:col-span-7">
              <SectionEyebrow>About Oakvale</SectionEyebrow>
              <h2 className="h-display mt-3 text-3xl leading-tight md:text-5xl">
                A credentialed staffing marketplace.
              </h2>
              <div className="mt-6 border-l-2 border-amber-400/60 pl-5">
                <p className="leading-relaxed text-ink-600">
                  Oakvale Learning connects two employer pipelines, diaspora families in the UK and US
                  caring for loved ones back home, and Nigerian corporates building workplace
                  cr&egrave;ches, with verified, CPD-accredited Nigerian care and childcare workers.
                </p>
                <p className="mt-4 leading-relaxed text-ink-600">
                  We are trust-and-credentials infrastructure layered with a marketplace. Every worker
                  is identity-verified, background-checked and Oakvale-certified before their profile is
                  ever visible, because we measure success by placement quality, not volume.
                </p>
              </div>
            </div>

            {/* Bento stat grid — one large gradient tile + three tinted. */}
            <div className="stagger grid gap-4 sm:grid-cols-2 md:col-span-5">
              <div className="relative overflow-hidden rounded-2xl border border-brand-600/40 bg-brand-700 p-7 text-white sm:col-span-2">
                <Quote className="absolute -right-2 -top-2 h-16 w-16 text-white/10" strokeWidth={1.25} aria-hidden />
                <p className="h-display text-4xl tabular-nums md:text-5xl">90 days</p>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/80">
                  Replacement guarantee on every placement, at no additional fee.
                </p>
              </div>
              <BentoStat variant="sage" value="2" label="Employer pipelines served" />
              <BentoStat variant="amber" value="CPD" label="Accredited worker pool" />
              <BentoStat variant="teal" value="Fully" label="Managed placement lifecycle" className="sm:col-span-2" />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-label="How it works" className="bg-white">
        <div className="mx-auto w-4/5 px-6 py-20 md:py-24">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <SectionEyebrow className="justify-center">How placement works</SectionEyebrow>
            <h2 className="h-display mt-3 text-3xl md:text-4xl">Three steps to a trusted hire.</h2>
            <p className="mt-4 leading-relaxed text-ink-600">
              From first brief to an accountable, tracked placement, our agents run every step.
            </p>
          </div>
          <div className="stagger relative grid gap-6 md:grid-cols-3">
            {/* Connecting dotted line behind the step cards (desktop). */}
            <div
              className="absolute inset-x-[16%] top-14 hidden border-t-2 border-dashed border-brand-200 md:block"
              aria-hidden
            />
            <Step
              number="01"
              icon={ClipboardList}
              accent="brand"
              title="Tell us your need"
              body="Complete a Care Needs Assessment or post a corporate role. We capture exactly who and what you need."
            />
            <Step
              number="02"
              icon={Users}
              accent="teal"
              title="We match & shortlist"
              body="A dedicated agent hand-picks 3–5 verified, Oakvale-certified candidates and facilitates interviews."
            />
            <Step
              number="03"
              icon={BadgeCheck}
              accent="amber"
              title="Placed & tracked"
              body="Contracts drafted, onboarding overseen, and welfare plus CPD compliance monitored monthly."
            />
          </div>
        </div>
      </section>

      {/* Trust pillars — dark band so the coloured tiles glow. */}
      <section id="trust" className="relative overflow-hidden bg-brand-800 text-cream-50">
        <div className="bg-dot-grid bg-dot-grid-light absolute inset-0 opacity-50" aria-hidden />
        <div className="absolute -right-20 top-10 h-96 w-96 rounded-full bg-amber-400/15 blur-3xl" aria-hidden />
        <div className="absolute -left-24 bottom-0 h-96 w-96 rounded-full bg-brand-500/25 blur-3xl" aria-hidden />
        <div className="relative mx-auto w-4/5 px-6 py-20 md:py-24">
          <div className="mb-12 max-w-xl">
            <SectionEyebrow className="text-amber-300">Our readiness to serve</SectionEyebrow>
            <h2 className="h-display mt-3 text-3xl md:text-4xl">We do the heavy lifting.</h2>
            <p className="mt-4 leading-relaxed text-cream-100/80">
              Everything vetted, managed and tracked, so you hire with total confidence.
            </p>
          </div>
          <div className="stagger grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Pillar
              number="01"
              icon={ShieldCheck}
              accent="brand"
              title="Vetted, credentialed pool"
              body="No sifting through unqualified resumes. Only workers holding a valid Oakvale certificate, or actively completing our training to hire pathway, appear as verified."
            />
            <Pillar
              number="02"
              icon={FileSearch}
              accent="teal"
              title="Comprehensive background checks"
              body="Police character certificate, guarantor letter and sworn affidavit, reviewed by Oakvale&rsquo;s team, with a Clear badge displayed on every verified profile."
            />
            <Pillar
              number="03"
              icon={Handshake}
              accent="amber"
              title="Fully managed service"
              body="Account Managers, Liaison Nurses and Recruiters run the whole placement lifecycle, facilitating interviews, drafting tailored contracts, overseeing onboarding."
            />
            <Pillar
              number="04"
              icon={HeartPulse}
              accent="sage"
              title="Compliance & welfare tracking"
              body="CPD compliance is monitored on every placed worker, and routine welfare checks generate monthly reports delivered straight to your inbox."
            />
          </div>
        </div>
      </section>

      {/* Two pipelines split */}
      <section id="employers" className="relative overflow-hidden">
        <div className="bg-dot-grid absolute right-0 top-10 h-72 w-72 opacity-40" aria-hidden />
        <div className="relative mx-auto w-4/5 px-6 py-20 md:py-24">
          <div className="mb-12 max-w-xl">
            <SectionEyebrow>Two employer pipelines</SectionEyebrow>
            <h2 className="h-display mt-3 text-3xl md:text-4xl">One standard of trust, two ways to hire.</h2>
          </div>
          <div className="stagger grid gap-6 md:grid-cols-2">
            <PipelineCard
              gradient="bg-gradient-fresh"
              eyebrow="Nigerian corporates & institutions"
              title="Build your workplace crèche with confidence."
              body="Certified childcare workers trained in early years development, child safeguarding, infant care and SEND awareness. Search, shortlist and hire with self service job posting, or partner annually with a dedicated employer portal and a training to hire pathway via Oakvale's LMS."
              cta="Explore corporate partnership"
              href="/register?type=CORPORATE"
              chips={['Certified childcare workers', 'Self service job posting', 'Training to hire pathway']}
            />
            <PipelineCard
              gradient="bg-gradient-fresh"
              eyebrow="Diaspora families (UK & US)"
              title="Care for your loved ones back home, handled."
              body="Complete a Care Needs Assessment and a dedicated Account Manager matches you with a certified caregiver trained in elderly care, medication management and post surgical support. Pay in GBP or USD and rest easy knowing your family is in safe hands."
              cta="Start a care assessment"
              href="/register?type=INDIVIDUAL_EMPLOYER"
              chips={['High touch managed service', 'GBP / USD payments', 'Monthly welfare reports']}
            />
          </div>
        </div>
      </section>

      {/* 90-day guarantee — full-bleed band with ghost numeral watermark. */}
      <section id="guarantee" className="relative isolate overflow-hidden bg-brand-700 text-cream-50">
        <div className="bg-dot-grid bg-dot-grid-light absolute inset-0 opacity-40" aria-hidden />
        <div className="absolute -right-16 -top-10 h-96 w-96 rounded-full bg-amber-400/20 blur-3xl" aria-hidden />
        <span
          className="h-display pointer-events-none absolute -bottom-16 right-4 select-none text-[14rem] leading-none text-white/[0.06] md:text-[20rem]"
          aria-hidden
        >
          90
        </span>
        <div className="relative mx-auto grid w-4/5 items-center gap-8 px-6 py-16 md:grid-cols-12 md:py-20">
          <div className="space-y-4 md:col-span-8">
            <SectionEyebrow className="text-amber-300">The Oakvale peace of mind guarantee</SectionEyebrow>
            <h2 className="h-display text-3xl leading-tight md:text-5xl">90 day replacement guarantee.</h2>
            <p className="max-w-2xl text-cream-100/90">
              Should a placement not meet your expectations within the first 90 days, our agents
              source a highly qualified replacement at no additional placement fee. Any concerns
              about attendance or performance are triaged by an Oakvale agent within hours.
            </p>
          </div>
          <div className="flex md:col-span-4 md:justify-end">
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-medium text-ink shadow-amberLift">
              <ShieldCheck className="h-4 w-4" strokeWidth={2} />
              Backed on every placement
            </span>
          </div>
        </div>
      </section>

      {/* Testimonial / social proof */}
      <section aria-label="What partners say" className="relative overflow-hidden">
        <div className="relative mx-auto w-4/5 px-6 py-20 md:py-24">
          <Card variant="glass" className="relative overflow-hidden p-8 md:p-14">
            <div className="bg-dot-grid absolute -left-8 -top-8 h-56 w-56 opacity-40" aria-hidden />
            <Quote className="absolute right-6 top-6 h-20 w-20 text-brand-500/10" strokeWidth={1} aria-hidden />
            <div className="relative grid items-center gap-10 md:grid-cols-12">
              <blockquote className="md:col-span-8">
                <SectionEyebrow>What partners say</SectionEyebrow>
                {/* TODO: replace with a real, attributable quote from marketing. */}
                <p className="h-display mt-4 text-2xl italic leading-snug md:text-4xl">
                  &ldquo;Oakvale did the vetting we could never do from abroad. Our caregiver arrived
                  certified, checked, and genuinely prepared, and the monthly welfare reports mean we
                  finally sleep easy.&rdquo;
                </p>
                <footer className="mt-6 flex items-center gap-3 text-sm text-ink-600">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-brand font-medium text-white">
                    AO
                  </span>
                  <span>
                    <span className="block font-medium text-ink">Diaspora family, London</span>
                    <span className="text-muted">Elderly care placement</span>
                  </span>
                </footer>
              </blockquote>
              <dl className="stagger grid grid-cols-3 gap-4 md:col-span-4">
                <ProofStat value="1,184" label="Verified workers" />
                <ProofStat value="247" label="Jobs live" />
                <ProofStat value="2" label="Pipelines" />
              </dl>
            </div>
          </Card>
        </div>
      </section>

      {/* For carers */}
      <section id="workers" className="mx-auto w-4/5 px-6 pb-20">
        <Card variant="gradient" className="relative overflow-hidden p-10 md:p-14">
          <div className="bg-dot-grid bg-dot-grid-light absolute inset-0 opacity-40" aria-hidden />
          <div className="absolute -right-16 -top-16 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" aria-hidden />
          <div className="relative grid items-center gap-10 md:grid-cols-12">
            <div className="space-y-5 md:col-span-7">
              <Badge tone="amber">Live on the Jobs Board</Badge>
              <p className="text-eyebrow text-cream-200/70">For care workers</p>
              <h2 className="h-display text-3xl leading-tight md:text-4xl">
                Get credentialed. Get placed. Get paid in naira.
              </h2>
              <p className="max-w-xl text-cream-100/90">
                Join a curated, high-trust marketplace where your Oakvale certification opens doors
                with diaspora families and corporate cr&egrave;ches alike. Background checked,
                CPD accredited, and visible only when verified, so employers know you mean it.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link href="/register?role=WORKER">
                  <Button size="lg" variant="ghost" className="bg-white text-brand-800 hover:bg-cream-100">
                    Build my profile
                  </Button>
                </Link>
                <Link href="/login" className="self-center text-sm text-white hover:text-cream-50">
                  Already registered &rarr;
                </Link>
              </div>
            </div>
            <div className="relative md:col-span-5">
              <Image
                src="/onboarding.svg"
                alt="Illustration of a caregiver onboarding"
                width={1000}
                height={500}
                className="rounded-2xl object-contain"
              />
              <span className="absolute -bottom-3 -left-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-brand-700 shadow-card">
                <BadgeCheck className="h-4 w-4 text-brand-500" strokeWidth={2} />
                Verified profile
              </span>
            </div>
          </div>
        </Card>
      </section>

      {/* Closing CTA — full-bleed gradient band. */}
      <section className="relative isolate overflow-hidden bg-gradient-brand text-white">
        <div className="bg-dot-grid bg-dot-grid-light absolute inset-0 opacity-40" aria-hidden />
        <div className="absolute -left-16 -top-10 h-96 w-96 rounded-full bg-amber-400/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-16 right-0 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl" aria-hidden />
        <div className="relative mx-auto w-4/5 px-6 py-24 text-center">
          <p className="text-eyebrow text-cream-100/70">Ready when you are</p>
          <h2 className="h-display mx-auto mt-3 max-w-3xl text-3xl md:text-5xl">
            Step into a world of talent today.
          </h2>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-cream-100/90">
            The perfect addition to your care team or corporate facility is waiting, a hiring
            process that is secure, supported, and entirely focused on your success.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="bg-amber-400 text-ink hover:bg-amber-300 shadow-amberLift">
                Register now
              </Button>
            </Link>
            <Link href="/register?type=CORPORATE">
              <Button size="lg" className="bg-white/10 text-white ring-1 ring-inset ring-white/40 hover:bg-white/20">
                Talk to our team
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

/* ---------------------------------------------------------------------------
 * Local presentational helpers. Kept inline (as the previous version did) so
 * the landing page stays self-contained; all styling reuses shared tokens.
 * ------------------------------------------------------------------------- */

function SectionEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-eyebrow flex items-center gap-2 text-sage-600 ${className ?? ''}`}>
      <span className="h-px w-6 bg-gradient-to-r from-amber-400 to-transparent" aria-hidden />
      {children}
    </p>
  );
}

function TrustChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-cream-50 backdrop-blur-md">
      <Icon className="h-4 w-4 text-amber-300" strokeWidth={1.75} />
      {label}
    </span>
  );
}

type TintAccent = 'sage' | 'amber' | 'teal';

const BENTO_TINTS: Record<TintAccent, string> = {
  sage: 'bg-sage-50 border-sage-200 text-sage-600',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  teal: 'bg-teal-50 border-teal-200 text-teal-600',
};

function BentoStat({
  variant,
  value,
  label,
  className,
}: {
  variant: TintAccent;
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${BENTO_TINTS[variant]} ${className ?? ''}`}
    >
      <p className="h-display text-3xl tabular-nums">{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{label}</p>
    </div>
  );
}

function ProofStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-ink/[0.06] bg-white/70 p-4 text-center">
      <dd className="h-display text-2xl tabular-nums text-brand-700">{value}</dd>
      <dt className="text-eyebrow mt-1.5 text-muted">{label}</dt>
    </div>
  );
}

type PillarAccent = 'brand' | 'sage' | 'amber' | 'teal';

const PILLAR_ACCENTS: Record<PillarAccent, { tile: string; bar: string }> = {
  brand: { tile: 'bg-brand-50 text-brand-600', bar: 'bg-brand-500' },
  sage: { tile: 'bg-sage-50 text-sage-600', bar: 'bg-sage-500' },
  amber: { tile: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400' },
  teal: { tile: 'bg-teal-50 text-teal-600', bar: 'bg-teal-500' },
};

function Step({
  number,
  icon: Icon,
  accent,
  title,
  body,
}: {
  number: string;
  icon: LucideIcon;
  accent: PillarAccent;
  title: string;
  body: string;
}) {
  const a = PILLAR_ACCENTS[accent];
  return (
    <Card variant="default" interactive className="relative text-center">
      <span
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${a.tile} ring-4 ring-white`}
      >
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <p className="h-display text-muted-soft mt-4 text-sm tabular-nums">{number}</p>
      <CardTitle className="mt-1 text-ink">{title}</CardTitle>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">{body}</p>
    </Card>
  );
}

function Pillar({
  number,
  icon: Icon,
  accent,
  title,
  body,
}: {
  number: string;
  icon: LucideIcon;
  accent: PillarAccent;
  title: string;
  body: string;
}) {
  const a = PILLAR_ACCENTS[accent];
  return (
    <Card variant="default" interactive className="relative overflow-hidden p-7">
      <span className={`absolute inset-x-0 top-0 h-1 ${a.bar}`} aria-hidden />
      <span
        className="h-display text-muted-soft absolute right-6 top-6 text-lg tabular-nums"
        aria-hidden
      >
        {number}
      </span>
      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${a.tile}`}>
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <CardTitle className="text-ink">{title}</CardTitle>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">{body}</p>
    </Card>
  );
}

function PipelineCard({
  gradient,
  eyebrow,
  title,
  body,
  cta,
  href,
  chips,
}: {
  gradient: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  chips: string[];
}) {
  return (
    <Card variant="default" interactive className="relative overflow-hidden !p-0">
      {/* Gradient header strip distinguishes the two pipelines at a glance. */}
      <div className={`relative h-24 ${gradient}`}>
        <div className="bg-dot-grid bg-dot-grid-light absolute inset-0 opacity-50" aria-hidden />
        <span className="text-eyebrow absolute bottom-4 left-8 text-white/90">{eyebrow}</span>
      </div>
      <div className="p-8 md:p-10">
        <CardTitle className="text-2xl md:text-3xl">{title}</CardTitle>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-600">{body}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {chips.map((c, i) => (
            <Badge key={c} tone={i % 2 === 0 ? 'sage' : 'amber'}>
              {c}
            </Badge>
          ))}
        </div>
        <div className="mt-8">
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-sage-600 transition hover:gap-2.5 hover:text-sage-500"
          >
            {cta} <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </Card>
  );
}
