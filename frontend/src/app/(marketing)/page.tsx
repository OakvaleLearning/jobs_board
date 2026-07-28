import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, FileSearch, Handshake, HeartPulse, type LucideIcon } from 'lucide-react';
import { Nav } from '@/components/marketing/Nav';
import { Footer } from '@/components/marketing/Footer';
import { Button } from '@/components/ui/Button';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Hero from '@/components/Hero';

export default function LandingPage() {
  return (
    <main>
      <Nav />

      {/* Hero */}
      <Hero />

      {/* Trust pillars */}
      <section id="trust" className="bg-white">
        <div className="mx-auto w-4/5 px-6 py-20">
        <div className="max-w-xl mb-12">
          <p className="text-eyebrow text-sage-600">Our readiness to serve</p>
          <h2 className="h-display text-3xl md:text-4xl mt-2">We do the heavy lifting.</h2>
          <p className="mt-4 text-ink-600 leading-relaxed">
            Everything vetted, managed and tracked &mdash; so you hire with total confidence.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Pillar
            number="01"
            icon={ShieldCheck}
            accent="brand"
            title="Pre-vetted, credentialed pool"
            body="No sifting through unqualified resumes. Only workers holding a valid Oakvale certificate &mdash; or actively completing our training-to-hire pathway &mdash; appear as verified."
          />
          <Pillar
            number="02"
            icon={FileSearch}
            accent="teal"
            title="Comprehensive background checks"
            body="Police character certificate, guarantor letter and sworn affidavit &mdash; reviewed by Oakvale&rsquo;s team, with a Clear badge displayed on every verified profile."
          />
          <Pillar
            number="03"
            icon={Handshake}
            accent="amber"
            title="End-to-end managed service"
            body="Account Managers, Liaison Nurses and Recruiters run the whole placement lifecycle &mdash; facilitating interviews, drafting tailored contracts, overseeing onboarding."
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
      <section id="employers" className="mx-auto w-4/5 px-6 py-20">
        <div className="grid md:grid-cols-2 gap-6">
          <PipelineCard
            eyebrow="Nigerian corporates & institutions"
            title="Build your workplace crèche with confidence."
            body="Certified childcare workers trained in early-years development, child safeguarding, infant care and SEND awareness. Search, shortlist and hire with self-service job posting, or partner annually with a dedicated employer portal and a training-to-hire pathway via Oakvale's LMS."
            cta="Explore corporate partnership"
            href="/register?type=CORPORATE"
            chips={['Certified childcare workers', 'Self-service job posting', 'Training-to-hire pathway']}
          />
          <PipelineCard
            eyebrow="Diaspora families (UK & US)"
            title="Care for your loved ones back home, handled."
            body="Complete a Care Needs Assessment and a dedicated Account Manager matches you with a certified caregiver trained in elderly care, medication management and post-surgical support. Pay in GBP or USD and rest easy knowing your family is in safe hands."
            cta="Start a care assessment"
            href="/register?type=INDIVIDUAL_EMPLOYER"
            chips={['High-touch managed service', 'GBP / USD payments', 'Monthly welfare reports']}
          />
        </div>
      </section>

      {/* 90-day guarantee */}
      <section id="guarantee" className="mx-auto w-4/5 px-6 py-4">
        <Card className="bg-brand-700 text-cream-50 p-10 md:p-12">
          <div className="grid md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-8 space-y-4">
              <p className="text-eyebrow text-cream-200/70">The Oakvale peace-of-mind guarantee</p>
              <h2 className="h-display text-3xl md:text-4xl leading-tight">
                90-day replacement guarantee.
              </h2>
              <p className="text-cream-100/90 max-w-2xl">
                Should a placement not meet your expectations within the first 90 days, our agents
                source a highly qualified replacement at no additional placement fee. Any concerns
                about attendance or performance are triaged by an Oakvale agent within hours.
              </p>
            </div>
            <div className="md:col-span-4 flex md:justify-end">
              <Badge tone="amber">Backed on every placement</Badge>
            </div>
          </div>
        </Card>
      </section>

      {/* For carers */}
      <section id="workers" className="mx-auto w-4/5 px-6 py-20">
        <Card className="bg-brand-700 text-cream-50 p-10 md:p-14">
          <div className="grid md:grid-cols-12 gap-10 items-center">
            <div className="md:col-span-7 space-y-5">
              <Badge tone="amber">Live on the Jobs Board</Badge>
              <p className="text-eyebrow text-cream-200/70">For care workers</p>
              <h2 className="h-display text-3xl md:text-4xl leading-tight">
                Get credentialed. Get placed. Get paid &mdash; in naira.
              </h2>
              <p className="text-cream-100/90 max-w-xl">
                Join a curated, high-trust marketplace where your Oakvale certification opens doors
                with diaspora families and corporate cr&egrave;ches alike. Background-checked,
                CPD-accredited, and visible only when verified &mdash; so employers know you mean it.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/register?role=WORKER">
                  <Button size="lg" variant="ghost" className='bg-white'>Build my profile</Button>
                </Link>
                <Link href="/login" className="text-sm text-white hover:text-cream-50 self-center">
                  Already registered &rarr;
                </Link>
              </div>
            </div>
            <div className="md:col-span-5 grid grid-cols-2 gap-4">
            <Image src="/onboarding.svg" alt="Photo of a caregiver"  width={1000} height={500} className="rounded-lg object-contain" />
            </div>
          </div>
        </Card>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto w-4/5 px-6 py-24 text-center">
        <p className="text-eyebrow text-sage-600">Ready when you are</p>
        <h2 className="h-display text-3xl md:text-5xl mt-3">Step into a world of talent today.</h2>
        <p className="mx-auto mt-5 max-w-xl text-ink-600 leading-relaxed">
          The perfect addition to your care team or corporate facility is waiting &mdash; a hiring
          process that is secure, supported, and entirely focused on your success.
        </p>
        <div className="mt-8">
          <Link href="/register">
            <Button size="lg" className="bg-amber-400 text-ink hover:bg-amber-300">
              Register now
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}

type PillarAccent = 'brand' | 'sage' | 'amber' | 'teal';

const PILLAR_ACCENTS: Record<PillarAccent, { tile: string; bar: string }> = {
  brand: { tile: 'bg-brand-50 text-brand-600', bar: 'bg-brand-500' },
  sage: { tile: 'bg-sage-50 text-sage-600', bar: 'bg-sage-500' },
  amber: { tile: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400' },
  teal: { tile: 'bg-teal-50 text-teal-600', bar: 'bg-teal-500' },
};

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
        className={`absolute top-6 right-6 h-display text-lg tabular-nums text-muted-soft`}
        aria-hidden
      >
        {number}
      </span>
      <span
        className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${a.tile}`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <CardTitle className="text-ink">{title}</CardTitle>
      <p className="text-sm text-ink-600 leading-relaxed mt-3">{body}</p>
    </Card>
  );
}

function PipelineCard({
  eyebrow,
  title,
  body,
  cta,
  href,
  chips,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  chips: string[];
}) {
  return (
    <Card variant="glass" interactive className="relative overflow-hidden p-8 md:p-10">
      <CardEyebrow className="text-sage-600">{eyebrow}</CardEyebrow>
      <CardTitle className="text-2xl md:text-3xl pr-12">{title}</CardTitle>
      <p className="text-sm text-ink-600 leading-relaxed mt-4 max-w-md">{body}</p>
      <div className="flex flex-wrap gap-2 mt-6">
        {chips.map((c, i) => (
          <Badge key={c} tone={i % 2 === 0 ? 'sage' : 'amber'}>{c}</Badge>
        ))}
      </div>
      <div className="mt-8">
        <Link href={href} className="text-sm font-medium text-sage-600 hover:text-sage-500 transition">
          {cta} &rarr;
        </Link>
      </div>
    </Card>
  );
}
