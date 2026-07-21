import { and, eq } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { db } from './client.js';
import {
  certifications,
  complianceFlags,
  corporateNeedsAssessments,
  cpdRecords,
  individualEmployerNeedsAssessments,
  employerContacts,
  employerTypes,
  employers,
  jobPostings,
  placementEvents,
  placements,
  shortlists,
  users,
  verificationRequests,
  workerEducation,
  workerExperience,
  workerIdentityDocs,
  workerPersonalInfo,
  workers,
  workforceCategories,
} from './schema.js';
import { loadEnv } from '../config/env.js';
import { logger } from '../logger/logger.js';

/**
 * End-to-end test-data seed (workers, employers, job postings, placements).
 *
 * Idempotent: every account uses a deterministic `*@seed.oakvale.local` email and
 * is skipped if it already exists, so re-running never duplicates rows. Depends on
 * the config seeds having run first — workforce categories (CERTIFIED_CAREGIVER,
 * CERTIFIED_CHILDCARE_WORKER), employer types (INDIVIDUAL_EMPLOYER, CORPORATE) and the agent
 * user (agent@oakvale.local). Bails out with a clear message if any are missing.
 */

const WORKER_COUNT = 50;
const INDIVIDUAL_EMPLOYER_COUNT = 6;
const CORPORATE_EMPLOYER_COUNT = 4;
const SHARED_PASSWORD = process.env.SEED_TEST_PASSWORD ?? 'Seed123!';
const AGENT_EMAIL = process.env.SEED_AGENT_EMAIL ?? 'agent@oakvale.local';

const FIRST_NAMES = [
  'Adaeze', 'Chinedu', 'Ngozi', 'Emeka', 'Folake', 'Ibrahim', 'Yetunde', 'Tunde',
  'Aisha', 'Obinna', 'Halima', 'Kelechi', 'Funmilayo', 'Suleiman', 'Chiamaka',
  'Olumide', 'Zainab', 'Uche', 'Blessing', 'Abdul', 'Temitope', 'Ifeoma',
  'Bashir', 'Amara', 'Segun',
] as const;

const LAST_NAMES = [
  'Okafor', 'Adeyemi', 'Eze', 'Bello', 'Okonkwo', 'Abubakar', 'Williams',
  'Ogunleye', 'Mohammed', 'Nwankwo', 'Balogun', 'Ojo', 'Ibrahim', 'Chukwu',
  'Adewale', 'Yusuf', 'Obi', 'Lawal', 'Onyeka', 'Danjuma',
] as const;

const STATES = [
  ['Lagos', 'Ikeja'], ['Oyo', 'Ibadan North'], ['Kano', 'Nassarawa'],
  ['Rivers', 'Port Harcourt'], ['Enugu', 'Enugu East'], ['Kaduna', 'Kaduna North'],
  ['Anambra', 'Awka South'], ['Abuja', 'Municipal Area Council'],
] as const;

type Bucket = 'VISIBLE' | 'PENDING' | 'DRAFT';

interface WorkerSpec {
  index: number;
  email: string;
  fullName: string;
  categorySlug: 'CERTIFIED_CAREGIVER' | 'CERTIFIED_CHILDCARE_WORKER';
  bucket: Bucket;
}

/** Deterministic spec for worker `i` (1-based) — used in both create and link steps. */
function workerSpec(i: number): WorkerSpec {
  const first = FIRST_NAMES[i % FIRST_NAMES.length] as string;
  const last = LAST_NAMES[i % LAST_NAMES.length] as string;
  const mod = i % 10;
  const bucket: Bucket = mod < 6 ? 'VISIBLE' : mod < 8 ? 'PENDING' : 'DRAFT';
  return {
    index: i,
    email: `worker${String(i).padStart(3, '0')}@seed.oakvale.local`,
    fullName: `${first} ${last}`,
    categorySlug: i % 2 === 0 ? 'CERTIFIED_CHILDCARE_WORKER' : 'CERTIFIED_CAREGIVER',
    bucket,
  };
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

async function getRequiredCategoryId(slug: string): Promise<string> {
  const row = await db.query.workforceCategories.findFirst({
    where: eq(workforceCategories.slug, slug),
  });
  if (!row) {
    throw new Error(
      `Missing workforce category "${slug}". Run "npm run db:seed-categories" first.`,
    );
  }
  return row.id;
}

async function getRequiredEmployerTypeId(slug: string): Promise<string> {
  const row = await db.query.employerTypes.findFirst({ where: eq(employerTypes.slug, slug) });
  if (!row) {
    throw new Error(
      `Missing employer type "${slug}". Run "npm run db:seed-employer-types" first.`,
    );
  }
  return row.id;
}

async function main(): Promise<void> {
  loadEnv();

  // --- Prerequisites -------------------------------------------------------
  const agent = await db.query.users.findFirst({ where: eq(users.email, AGENT_EMAIL) });
  if (!agent) {
    logger.error(
      { email: AGENT_EMAIL },
      'Agent user not found. Run "npm run db:seed-agent" before seeding test data.',
    );
    process.exit(1);
  }
  const caregiverCatId = await getRequiredCategoryId('CERTIFIED_CAREGIVER');
  const childcareCatId = await getRequiredCategoryId('CERTIFIED_CHILDCARE_WORKER');
  const individualEmployerTypeId = await getRequiredEmployerTypeId('INDIVIDUAL_EMPLOYER');
  const corporateTypeId = await getRequiredEmployerTypeId('CORPORATE');

  const passwordHash = await hash(SHARED_PASSWORD);
  const now = new Date();

  // --- Workers -------------------------------------------------------------
  let workersCreated = 0;
  for (let i = 1; i <= WORKER_COUNT; i += 1) {
    const spec = workerSpec(i);
    const existing = await db.query.users.findFirst({ where: eq(users.email, spec.email) });
    if (existing) continue;

    const [user] = await db
      .insert(users)
      .values({
        email: spec.email,
        passwordHash,
        fullName: spec.fullName,
        phone: `+23480${String(10000000 + i).slice(0, 8)}`,
        role: 'WORKER',
        emailVerifiedAt: now,
        isActive: true,
      })
      .returning({ id: users.id });
    if (!user) continue;

    const isVisible = spec.bucket === 'VISIBLE';
    const completion = isVisible ? 85 + (i % 15) : spec.bucket === 'PENDING' ? 60 + (i % 15) : 10 + (i % 25);
    const categoryId = spec.categorySlug === 'CERTIFIED_CAREGIVER' ? caregiverCatId : childcareCatId;

    const [worker] = await db
      .insert(workers)
      .values({
        userId: user.id,
        workforceCategoryId: categoryId,
        oakvaleAgentId: agent.id,
        profileCompletionPct: completion,
        cpdTotalHours: isVisible ? 20 + (i % 30) : i % 10,
        experienceTotalMonths: 12 + (i % 96),
        visibilityStatus:
          spec.bucket === 'VISIBLE' ? 'APPROVED' : spec.bucket === 'PENDING' ? 'PENDING_REVIEW' : 'DRAFT',
        submittedAt: spec.bucket === 'DRAFT' ? null : now,
      })
      .returning({ id: workers.id });
    if (!worker) continue;

    const [state, lga] = STATES[i % STATES.length] as readonly [string, string];
    await db.insert(workerPersonalInfo).values({
      workerId: worker.id,
      fullName: spec.fullName,
      dob: dateStr(new Date(1985 + (i % 18), i % 12, ((i * 7) % 27) + 1)),
      gender: i % 3 === 0 ? 'MALE' : 'FEMALE',
      nationality: 'Nigerian',
      stateOfOrigin: state,
      lga,
      address: `${i} Care Avenue, ${state}`,
      phone: `+23480${String(20000000 + i).slice(0, 8)}`,
      emergencyContact: { name: `${spec.fullName} (NOK)`, phone: `+23481${String(30000000 + i).slice(0, 8)}` },
    });

    await db.insert(workerIdentityDocs).values({
      workerId: worker.id,
      idType: 'NIN',
      idNumber: String(10000000000 + i * 137),
      verificationStatus: isVisible ? 'VERIFIED' : 'PENDING',
    });

    await db.insert(workerExperience).values({
      workerId: worker.id,
      jobTitle: spec.categorySlug === 'CERTIFIED_CAREGIVER' ? 'Home Care Assistant' : 'Nanny / Early Years Assistant',
      employerName: `${LAST_NAMES[(i + 3) % LAST_NAMES.length]} Family`,
      sector: spec.categorySlug === 'CERTIFIED_CAREGIVER' ? 'ELDERLY_CARE' : 'CHILDCARE_NANNY',
      natureOfRole: spec.categorySlug === 'CERTIFIED_CAREGIVER' ? 'ELDERLY_CARE' : 'CHILDCARE_NANNY',
      startDate: dateStr(addDays(now, -(365 * 3 + i * 5))),
      endDate: dateStr(addDays(now, -30)),
      isCurrent: false,
      duties: 'Personal care, companionship, daily living support.',
    });

    await db.insert(workerEducation).values({
      workerId: worker.id,
      level: 'SSCE',
      course: spec.categorySlug === 'CERTIFIED_CAREGIVER' ? 'Health & Social Care' : 'Early Childhood Education',
      institution: `${state} Community College`,
      country: 'Nigeria',
      startDate: dateStr(new Date(2005 + (i % 10), 8, 1)),
      endDate: dateStr(new Date(2008 + (i % 10), 6, 1)),
      grade: 'Credit',
    });

    if (isVisible) {
      // Active Oakvale certification — satisfies the certified half of the gate.
      await db.insert(certifications).values({
        workerId: worker.id,
        certType: 'OAKVALE_FOUNDATION',
        certNumber: `OAK-${String(1000 + i)}`,
        issuedBy: 'Oakvale Learning',
        issuedAt: dateStr(addDays(now, -120)),
        expiresAt: dateStr(addDays(now, 365 - (i % 30) * 10)),
        isOakvaleCert: true,
      });

      await db.insert(verificationRequests).values({
        workerId: worker.id,
        requestType: 'IDENTITY',
        status: 'VERIFIED',
        submittedAt: addDays(now, -10),
        reviewedAt: addDays(now, -8),
        reviewedBy: agent.id,
      });

      // A handful of near-expiry CPD records to exercise reminders.
      await db.insert(cpdRecords).values({
        workerId: worker.id,
        courseName: 'Safeguarding Refresher',
        provider: 'Oakvale Learning',
        completedAt: dateStr(addDays(now, -300)),
        expiresAt: dateStr(addDays(now, i % 6 === 0 ? 30 : 200)),
        hoursCompleted: '8',
        verifiedByOakvale: true,
        verifiedAt: addDays(now, -290),
      });
    } else if (spec.bucket === 'PENDING') {
      await db.insert(verificationRequests).values({
        workerId: worker.id,
        requestType: 'IDENTITY',
        status: 'SUBMITTED',
        submittedAt: addDays(now, -2),
      });
    }

    // A couple of visible workers carry an unresolved non-SAFEGUARDING flag
    // (display test; does NOT trip the safeguarding suspension rule or the gate).
    if (isVisible && (i === 5 || i === 25)) {
      await db.insert(complianceFlags).values({
        workerId: worker.id,
        flagType: 'CONDUCT',
        severity: 'LOW',
        raisedBy: agent.id,
        details: 'Minor punctuality note raised during a routine welfare check.',
      });
    }

    workersCreated += 1;
  }
  logger.info({ workersCreated }, 'Seeded workers');

  // --- Employers -----------------------------------------------------------
  let employersCreated = 0;
  const totalEmployers = INDIVIDUAL_EMPLOYER_COUNT + CORPORATE_EMPLOYER_COUNT;
  for (let i = 1; i <= totalEmployers; i += 1) {
    const isCorporate = i > INDIVIDUAL_EMPLOYER_COUNT;
    const email = `employer${String(i).padStart(2, '0')}@seed.oakvale.local`;
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) continue;

    const orgName = isCorporate
      ? `${LAST_NAMES[i % LAST_NAMES.length]} Industries Ltd`
      : `${LAST_NAMES[i % LAST_NAMES.length]} Family (Diaspora)`;

    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        fullName: isCorporate ? `${orgName} HR` : `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`,
        phone: `+44790${String(1000000 + i).slice(0, 7)}`,
        role: 'EMPLOYER',
        emailVerifiedAt: now,
        isActive: true,
      })
      .returning({ id: users.id });
    if (!user) continue;

    const [employer] = await db
      .insert(employers)
      .values({
        userId: user.id,
        employerTypeId: isCorporate ? corporateTypeId : individualEmployerTypeId,
        orgName,
        sector: isCorporate ? 'Manufacturing' : 'Private household',
        regNumber: isCorporate ? `RC${String(1000000 + i)}` : null,
        address: isCorporate ? `${i} Industrial Road, Lagos` : `${i} High Street, London, UK`,
        website: isCorporate ? `https://example-corp-${i}.test` : null,
        verificationStatus: 'APPROVED',
        verificationSubmittedAt: addDays(now, -20),
        verificationReviewedAt: addDays(now, -18),
        verificationReviewedBy: agent.id,
        accountManagerId: agent.id,
        onboardingCompletedAt: addDays(now, -18),
        // NDPA consent is mandatory before corporate worker data may be shown (Rule 9).
        ndpaConsentGiven: isCorporate,
        ndpaConsentTimestamp: isCorporate ? addDays(now, -18) : null,
        ndpaConsentedBy: isCorporate ? user.id : null,
      })
      .returning({ id: employers.id });
    if (!employer) continue;

    const contactName = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`;
    await db.insert(employerContacts).values({
      employerId: employer.id,
      name: isCorporate ? `${orgName} HR Lead` : contactName,
      position: isCorporate ? 'HR Manager' : 'Primary contact',
      email,
      phone: `+44790${String(2000000 + i).slice(0, 7)}`,
      isPrimary: true,
    });

    if (isCorporate) {
      await db.insert(corporateNeedsAssessments).values({
        employerId: employer.id,
        numStaffRequired: 2 + (i % 3),
        ageRangesServed: ['0-1', '1-3', '3-5'],
        hoursOfOperation: '08:00 - 18:00, Mon-Fri',
        existingStaffCount: i % 4,
        specificSkillsNeeded: ['Early years development', 'Paediatric first aid'],
        budgetParameters: 'NGN 150,000 - 250,000 / month per worker',
        siteAssessmentNotes: 'On-site crèche, capacity 25 children.',
      });

      for (let j = 1; j <= 2; j += 1) {
        await db.insert(jobPostings).values({
          employerId: employer.id,
          title: `Certified Childcare Worker (Crèche) #${j}`,
          description: 'Care for staff children in the corporate crèche; CPD-certified early-years worker required.',
          duties: 'Supervision, feeding, play-based learning, safeguarding.',
          country: 'NIGERIA',
          workLocation: 'Lagos',
          schedule: 'Full-time, weekdays',
          salaryCurrency: 'NGN',
          salaryRange: '₦150,000 – ₦250,000',
          benefits: ['Pension', 'Health cover'],
          openings: 1 + (j % 2),
          deadline: dateStr(addDays(now, 45)),
          // One posting per employer awaits review so the admin job-review queue is populated.
          status: j === 2 ? 'PENDING_REVIEW' : 'OPEN',
          workforceCategoryId: childcareCatId,
          backgroundCheckRequired: true,
        });
      }
    } else {
      await db.insert(individualEmployerNeedsAssessments).values({
        employerId: employer.id,
        careRecipientName: `${FIRST_NAMES[(i + 5) % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`,
        age: 68 + (i % 20),
        relationship: 'Parent',
        conditions: 'Hypertension; reduced mobility',
        mobilityLevel: i % 2 === 0 ? 'ASSISTED' : 'INDEPENDENT',
        medicationNeeds: 'Daily blood-pressure medication reminders',
        preferredLanguage: 'Yoruba / English',
        culturalRequirements: 'Familiar with Nigerian cuisine and customs',
        dietaryRequirements: 'Low-salt diet',
        accommodationType: i % 2 === 0 ? 'LIVE_IN' : 'LIVE_OUT',
        urgencyLevel: i % 3 === 0 ? 'URGENT' : 'STANDARD',
        additionalNotes: 'Recipient based in Ibadan; family in the UK.',
      });
    }

    employersCreated += 1;
  }
  logger.info({ employersCreated }, 'Seeded employers');

  // --- Placements & shortlists (small, lifecycle-spanning) -----------------
  // Pair visible workers (matched by category) with employers of the same pipeline.
  const placementPlan: Array<{
    employerEmail: string;
    workerIndex: number;
    pipeline: 'INDIVIDUAL_EMPLOYER' | 'CORPORATE';
    status: 'PENDING_PAYMENT' | 'ACTIVE' | 'COMPLETED';
  }> = [
    { employerEmail: 'employer01@seed.oakvale.local', workerIndex: 1, pipeline: 'INDIVIDUAL_EMPLOYER', status: 'ACTIVE' },
    { employerEmail: 'employer02@seed.oakvale.local', workerIndex: 11, pipeline: 'INDIVIDUAL_EMPLOYER', status: 'PENDING_PAYMENT' },
    { employerEmail: 'employer03@seed.oakvale.local', workerIndex: 21, pipeline: 'INDIVIDUAL_EMPLOYER', status: 'COMPLETED' },
    { employerEmail: 'employer07@seed.oakvale.local', workerIndex: 2, pipeline: 'CORPORATE', status: 'ACTIVE' },
    { employerEmail: 'employer08@seed.oakvale.local', workerIndex: 12, pipeline: 'CORPORATE', status: 'PENDING_PAYMENT' },
  ];

  let placementsCreated = 0;
  for (const plan of placementPlan) {
    const employerUser = await db.query.users.findFirst({
      where: eq(users.email, plan.employerEmail),
    });
    const workerUser = await db.query.users.findFirst({
      where: eq(users.email, workerSpec(plan.workerIndex).email),
    });
    if (!employerUser || !workerUser) continue;

    const employerRow = await db.query.employers.findFirst({
      where: eq(employers.userId, employerUser.id),
    });
    const workerRow = await db.query.workers.findFirst({
      where: eq(workers.userId, workerUser.id),
    });
    if (!employerRow || !workerRow) continue;

    const alreadyPlaced = await db.query.placements.findFirst({
      where: and(eq(placements.employerId, employerRow.id), eq(placements.workerId, workerRow.id)),
    });
    if (alreadyPlaced) continue;

    const placedAt = plan.status === 'PENDING_PAYMENT' ? null : addDays(now, -20);
    const [placement] = await db
      .insert(placements)
      .values({
        employerId: employerRow.id,
        workerId: workerRow.id,
        pipelineType: plan.pipeline,
        status: plan.status,
        placedAt,
        activatedAt: plan.status === 'PENDING_PAYMENT' ? null : addDays(now, -19),
        guaranteeExpiresAt: placedAt ? addDays(placedAt, 90) : null,
        endedAt: plan.status === 'COMPLETED' ? addDays(now, -1) : null,
        endReason: plan.status === 'COMPLETED' ? 'COMPLETED' : null,
        notes: 'Seeded test placement.',
      })
      .returning({ id: placements.id });
    if (!placement) continue;

    await db.insert(shortlists).values({
      employerId: employerRow.id,
      requestType: plan.pipeline,
      // Stored as MatchedCandidate[] (matches matchWorkers output), not bare ids.
      workerIds: [
        {
          workerId: workerRow.id,
          score: 0,
          breakdown: { skills: 0, experience: 0, certification: 0, rating: 0 },
        },
      ],
      createdBy: agent.id,
      selectedWorkerId: workerRow.id,
      viewedAt: addDays(now, -22),
      decidedAt: addDays(now, -21),
    });

    if (plan.status !== 'PENDING_PAYMENT') {
      await db.insert(placementEvents).values({
        placementId: placement.id,
        eventType: 'ACTIVATED',
        actorId: agent.id,
        metadata: { seeded: true },
      });
    }

    placementsCreated += 1;
  }
  logger.info({ placementsCreated }, 'Seeded placements');

  logger.info(
    { workersCreated, employersCreated, placementsCreated },
    'Test-data seed complete',
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to seed test data');
  process.exit(1);
});
