# Oakvale Jobs Portal — Test Cases

**Version 1.0 · June 2026**

Comprehensive test cases for the Oakvale Learning Jobs Portal covering all core workflows, user roles, and business logic.

---

## Test Execution Guidelines

- **Preconditions**: Assume all services are running (backend, frontend, Postgres, Redis)
- **Test Data**: Use realistic Nigerian phone numbers (+234), valid email addresses, and sample documents
- **Environment**: Tests should run in a local/staging environment with test credentials
- **Documentation**: Log test ID, date executed, environment, and result (Pass/Fail/Blocked)

---

## 1. Authentication & Authorization

### TC-AUTH-001: Worker Registration with Phone Number OTP

**Objective:** Verify worker can register with valid phone number and OTP verification

**Preconditions:**
- Worker app is accessible
- No existing account with the phone number

**Steps:**
1. Navigate to worker registration page
2. Enter valid Nigerian phone number (e.g., +234 801 234 5678)
3. Click "Send OTP"
4. Verify SMS OTP is received
5. Enter OTP in the form
6. Set password (minimum 8 characters, mixed case, number)
7. Click "Create Account"

**Expected Results:**
- OTP sent successfully within 30 seconds
- OTP valid for 5 minutes
- Account created and user redirected to profile completion step
- Session established with access token

---

### TC-AUTH-002: Worker Registration — Missing Required Fields

**Objective:** Verify form validation prevents incomplete registration

**Preconditions:**
- Worker app is accessible

**Steps:**
1. Navigate to registration page
2. Enter phone number
3. Verify OTP
4. Leave password field empty
5. Click "Create Account"

**Expected Results:**
- Form shows error: "Password is required"
- Account is not created
- User remains on registration page

---

### TC-AUTH-003: Worker Registration — Invalid Phone Number Format

**Objective:** Verify only valid Nigerian phone numbers are accepted

**Preconditions:**
- Worker app is accessible

**Steps:**
1. Navigate to registration page
2. Enter invalid phone number (e.g., "12345" or "0801234567" without country code)
3. Click "Send OTP"

**Expected Results:**
- Error displayed: "Please enter a valid Nigerian phone number (e.g., +234 801 234 5678)"
- OTP not sent

---

### TC-AUTH-004: Worker Login with Valid Credentials

**Objective:** Verify worker can log in with phone number and password

**Preconditions:**
- Worker account exists with phone: +234 801 234 5678, password: "Test@1234"

**Steps:**
1. Navigate to login page
2. Enter phone number: +234 801 234 5678
3. Enter password: Test@1234
4. Click "Login"

**Expected Results:**
- Login successful
- Access token issued (valid for 15 minutes)
- User redirected to worker dashboard
- Refresh token stored in Redis with 7-day TTL

---

### TC-AUTH-005: Worker Login — Incorrect Password

**Objective:** Verify login fails with incorrect credentials

**Preconditions:**
- Worker account exists

**Steps:**
1. Navigate to login page
2. Enter correct phone number
3. Enter incorrect password
4. Click "Login"

**Expected Results:**
- Error displayed: "Invalid phone number or password"
- Login not successful
- No token issued

---

### TC-AUTH-006: Worker Token Refresh

**Objective:** Verify access token refresh using refresh token

**Preconditions:**
- Worker is logged in with valid refresh token in Redis

**Steps:**
1. Access a protected route after access token expires (>15 min)
2. Backend should automatically attempt token refresh
3. Verify new access token is issued

**Expected Results:**
- New access token issued (valid for 15 minutes)
- Old token invalidated
- User session continues seamlessly

---

### TC-AUTH-007: Access Control — Suspended Worker

**Objective:** Verify suspended workers cannot access portal

**Preconditions:**
- Worker account exists and is marked with suspension flag
- Worker attempts to log in

**Steps:**
1. Navigate to login page
2. Enter valid credentials for suspended worker
3. Click "Login"

**Expected Results:**
- Login fails
- Error displayed: "Your account has been suspended. Please contact Oakvale support."
- No token issued

---

### TC-AUTH-008: Role-Based Access — Worker Cannot Access Employer Portal

**Objective:** Verify role-based access control prevents cross-role access

**Preconditions:**
- Worker account exists
- Worker is logged in

**Steps:**
1. Attempt to access employer portal URL directly (e.g., /employer/dashboard)
2. Or attempt to call employer-only API endpoint

**Expected Results:**
- Access denied
- User redirected to worker dashboard
- Or API returns 403 Forbidden error

---

### TC-AUTH-009: Employer Registration — Diaspora Family

**Objective:** Verify diaspora family can register with proof of residency

**Preconditions:**
- Employer registration page accessible

**Steps:**
1. Navigate to employer registration
2. Select "Diaspora Family (UK/US)" option
3. Enter: name, UK address, email
4. Upload proof of residency document (utility bill / council tax)
5. Upload UK identity document
6. Click "Submit Registration"

**Expected Results:**
- Registration submitted successfully
- Status: "Pending Verification"
- Employer receives confirmation email
- Oakvale agent receives notification to review
- Expected approval within 2 working days

---

### TC-AUTH-010: Employer Registration — Corporate

**Objective:** Verify corporate employer can register with CAC details

**Preconditions:**
- Employer registration page accessible

**Steps:**
1. Navigate to employer registration
2. Select "Nigerian Corporate (Crèche)" option
3. Enter: company name, sector, CAC registration number, address, contact email
4. Click "Submit Registration"

**Expected Results:**
- CAC format validated
- Registration submitted
- Status: "Pending Verification"
- Automated email sent to company domain confirming verification
- Agent completes verification within 2 working days

---

---

## 2. Worker Profile Management

### TC-PROFILE-001: Worker Profile Completion — Multi-Session Save

**Objective:** Verify profile changes are saved across sessions

**Preconditions:**
- Worker is logged in
- Worker is on the profile completion page

**Steps:**
1. Navigate to Step 2: Personal Information
2. Fill in: first name, last name, date of birth
3. Click "Next" or "Save & Continue"
4. Log out and close the application
5. Log back in
6. Navigate to profile completion

**Expected Results:**
- Previously entered data is retained
- Personal information fields show the saved data
- Profile completion percentage shows progress

---

### TC-PROFILE-002: Worker Profile Completion Percentage Calculation

**Objective:** Verify profile completion % is calculated correctly

**Preconditions:**
- New worker account created

**Steps:**
1. View worker dashboard
2. Note initial profile completion percentage
3. Complete Step 1: Account Creation (already done)
4. Complete Step 2: Personal Information
5. Complete Step 3: Identity Verification
6. Do not complete remaining steps
7. Observe profile completion percentage

**Expected Results:**
- Completion % updates dynamically as sections are filled
- Formula: (Completed Sections / Total Sections) × 100
- After 3 of 12 sections: ≈ 25% completion
- Minimum 70% required before profile becomes searchable

---

### TC-PROFILE-003: Identity Document Upload

**Objective:** Verify document upload and validation

**Preconditions:**
- Worker is on Step 3: Identity Verification

**Steps:**
1. Click "Upload Identity Document"
2. Select file type: NIN, Passport, Voter's Card
3. Upload document (PDF, JPG, PNG)
4. Verify file size < 10MB
5. Submit

**Expected Results:**
- File uploaded to R2 storage
- Pre-signed URL stored in database
- BullMQ job enqueued for document scanning
- Document metadata extracted (OCR attempted for NIN)
- Verification status set to "Pending"

---

### TC-PROFILE-004: Document Upload — File Size Exceeds Limit

**Objective:** Verify file size validation

**Preconditions:**
- Worker is on identity verification step

**Steps:**
1. Click "Upload Identity Document"
2. Select file > 10MB (e.g., 15MB high-res scan)
3. Attempt to upload

**Expected Results:**
- Upload rejected
- Error displayed: "File size must not exceed 10MB"
- File not stored

---

### TC-PROFILE-005: Background Check Consent & Trigger

**Objective:** Verify background check workflow is initiated

**Preconditions:**
- Worker has completed Step 3: Identity Verification
- Identity documents approved by agent

**Steps:**
1. Navigate to Step 4: Background Check Consent
2. Read consent checkbox: "I consent to a background check via Sterling BackCheck Nigeria"
3. Check the checkbox
4. Click "Submit & Request Background Check"

**Expected Results:**
- Consent recorded with timestamp
- BullMQ job enqueued: `background-checks` queue
- Background check status set to "Pending"
- Worker receives SMS/email: "Your background check has been submitted and will be completed within 5–10 working days"
- Badge on profile: "Background Check: Pending"

---

### TC-PROFILE-006: Background Check Status Update — Clear

**Objective:** Verify webhook updates background check status

**Preconditions:**
- Background check submitted to Sterling
- Mock Sterling webhook payload prepared

**Steps:**
1. Simulate Sterling webhook with `status: CLEAR`
2. Webhook payload signed with Sterling secret key

**Expected Results:**
- Webhook signature validated
- Background check status updated to "CLEAR"
- Badge on profile: "Background Check: Clear ✓"
- Worker profile now eligible for employer search (if 70%+ complete and identity verified)

---

### TC-PROFILE-007: Background Check Status Update — Flagged

**Objective:** Verify flagged background check triggers agent review

**Preconditions:**
- Background check submitted

**Steps:**
1. Simulate Sterling webhook with `status: FLAGGED` and risk details

**Expected Results:**
- Status updated to "FLAGGED"
- Agent notification queued
- Worker profile hidden from employer search pending review
- Worker receives SMS: "Your background check requires review. An Oakvale agent will contact you within 48 hours"

---

### TC-PROFILE-008: Oakvale Certificate Validation

**Objective:** Verify real-time certificate number validation

**Preconditions:**
- Worker is on Compliance & Certifications section

**Steps:**
1. Enter valid Oakvale certificate number (e.g., "OAK-CCW-2024-001234")
2. Click "Validate Certificate"
3. Certificate exists in LMS database with status "Graduated"

**Expected Results:**
- Certificate validated against LMS
- Auto-populated fields:
  - Programme: "Certified Childcare Worker (Early Years)"
  - Completion date: "2024-06-15"
  - CPD hours: 120
- Profile badge: "Oakvale Verified ✓"
- Worker profile now eligible for employer search

---

### TC-PROFILE-009: Oakvale Certificate — Invalid Number

**Objective:** Verify validation fails for invalid certificate numbers

**Preconditions:**
- Worker on certificate entry step

**Steps:**
1. Enter invalid certificate number: "INVALID-123"
2. Click "Validate Certificate"

**Expected Results:**
- Error: "Certificate not found or invalid"
- Fields not auto-populated
- No verification badge applied

---

### TC-PROFILE-010: Worker Profile Hidden Until Verification Complete

**Objective:** Verify visibility gate: profile only visible with 70%+ completion + verified identity + Oakvale cert

**Preconditions:**
- Worker profile is 50% complete
- Identity verification pending
- No Oakvale certificate linked

**Steps:**
1. Employer attempts to search for this worker
2. Employer views worker list

**Expected Results:**
- Worker does not appear in search results
- Profile is internal-only (visible to agent, not employer)

---

---

## 3. Employer Portal & Job Posting

### TC-EMPLOYER-001: Corporate Employer Job Posting

**Objective:** Verify corporate employer can post a job

**Preconditions:**
- Corporate employer verified and logged in

**Steps:**
1. Navigate to "Post a Job"
2. Fill job details:
   - Role title: "Childcare Worker - Morning Shift"
   - Workforce category: "Certified Childcare Worker"
   - Location: "Lagos, Lekki"
   - Employment type: "Part-time"
   - Salary: "₦80,000/month"
   - Description: "Seeking experienced childcare worker..."
3. Check: "Oakvale certification required"
4. Check: "Background check required"
5. Set visibility: "Public"
6. Click "Submit for Review"

**Expected Results:**
- Job post saved as Draft
- Oakvale agent notified for review
- Status: "Pending Review"
- Employer receives confirmation email

---

### TC-EMPLOYER-002: Job Posting Review & Approval

**Objective:** Verify agent reviews and approves job postings

**Preconditions:**
- Job posting submitted for review

**Steps:**
1. Agent logs into admin dashboard
2. Navigate to "Job Postings Pending Review"
3. Open job posting
4. Review details (appropriateness, language, salary reasonableness)
5. Click "Approve"

**Expected Results:**
- Job status updated to "Active"
- Job visible to all eligible workers
- Employer receives email: "Your job posting is now live"
- Job appears in worker search with visibility filter

---

### TC-EMPLOYER-003: Job Posting — Discriminatory Language Detected

**Objective:** Verify job posts with inappropriate content are flagged

**Preconditions:**
- Job posting contains discriminatory language

**Steps:**
1. Agent reviews job posting with inappropriate content (e.g., age/gender bias)
2. Agent flags as "Revision Required"
3. Adds comment: "Please remove references to age/gender"

**Expected Results:**
- Job remains in Draft
- Employer notified with revision request
- Job not published until revised

---

### TC-EMPLOYER-004: Diaspora Family Needs Assessment (No Self-Service Job Posting)

**Objective:** Verify diaspora families don't post jobs; use needs assessment instead

**Preconditions:**
- Diaspora family verified and logged in

**Steps:**
1. Diaspora family navigates to employer portal
2. Attempts to access "Post a Job" section

**Expected Results:**
- Section not visible or disabled
- Instead, prompt: "Our account manager will help you find the right caregiver. Complete a Care Needs Assessment to get started."

---

---

## 4. Worker Search & Talent Discovery

### TC-SEARCH-001: Employer Search — Filter by Workforce Category

**Objective:** Verify search filters return correct worker subsets

**Preconditions:**
- Multiple verified workers in system with different certifications
- Employer logged in

**Steps:**
1. Navigate to "Search Workers"
2. Filter: Workforce Category = "Certified Childcare Worker"
3. Click "Search"

**Expected Results:**
- Results show only workers with Certified Childcare Worker certification
- Each result card displays:
  - Name and photo
  - Certification badge
  - Location
  - Top 3 skills
  - "Save to Shortlist" button

---

### TC-SEARCH-002: Employer Search — Filter by Background Check Status

**Objective:** Verify only clear background check status returned

**Preconditions:**
- Multiple workers with different background check statuses

**Steps:**
1. Navigate to "Search Workers"
2. Filter: Background Check Status = "Clear"
3. Click "Search"

**Expected Results:**
- Only workers with "Clear" background check status displayed
- Workers with "Pending", "Flagged", or uncompleted background checks are excluded

---

### TC-SEARCH-003: Employer Search — Filter by Location

**Objective:** Verify location-based search

**Preconditions:**
- Multiple workers across different Nigerian states

**Steps:**
1. Navigate to "Search Workers"
2. Filter: Location = "Lagos"
3. Click "Search"

**Expected Results:**
- Results show workers in Lagos State
- Can select multiple states for OR logic

---

### TC-SEARCH-004: Employer Search — Multiple Filters (AND Logic)

**Objective:** Verify multiple filters work together

**Preconditions:**
- Diverse worker pool exists

**Steps:**
1. Apply filters:
   - Workforce Category: "Certified Caregiver"
   - Location: "Abuja"
   - Experience Level: "Experienced (3+ years)"
2. Click "Search"

**Expected Results:**
- Results match ALL criteria (AND logic)
- Narrow result set returned

---

### TC-SEARCH-005: Search Results Caching

**Objective:** Verify search results are cached for performance

**Preconditions:**
- Complex search query executed

**Steps:**
1. Execute search with multiple filters
2. Wait and observe response time (should be < 500ms)
3. Re-execute same search immediately

**Expected Results:**
- First search takes ~500ms
- Cached result (Redis key: `search:workers:{hash}`) with 5-minute TTL
- Second search returns within 100ms

---

### TC-SEARCH-006: Worker Profile View — Privacy Rules Enforced

**Objective:** Verify personal contact details are never shown to employers

**Preconditions:**
- Employer viewing worker profile

**Steps:**
1. Navigate to worker search
2. Click on worker profile
3. View full profile details

**Expected Results:**
- Visible fields:
  - Name, photo, certification
  - Skills, experience, education
  - Video introduction
  - Placement history (anonymised)
- Hidden fields:
  - Phone number
  - Email address
  - Personal address
- "Request Interview" and "Save to Shortlist" buttons present

---

---

## 5. Shortlisting & Engagement

### TC-SHORTLIST-001: Save Worker to Shortlist

**Objective:** Verify worker can be saved to shortlist

**Preconditions:**
- Employer viewing worker profile

**Steps:**
1. Click "Save to Shortlist"
2. Select or create shortlist: "Childcare Workers - June 2026"
3. Click "Save"

**Expected Results:**
- Worker added to shortlist
- Confirmation message: "Worker added to shortlist"
- Shortlist appears in employer's "My Shortlists" section

---

### TC-SHORTLIST-002: Request Interview from Shortlist

**Objective:** Verify interview request workflow

**Preconditions:**
- Worker in employer's shortlist

**Steps:**
1. Navigate to shortlist
2. Click on worker
3. Click "Request Interview"
4. Fill form:
   - Interview format: "Video Call"
   - Proposed date/time: "2024-06-20, 2:00 PM"
   - Additional notes: "Please prepare examples of your experience"
5. Click "Send Interview Request"

**Expected Results:**
- Request saved to database
- Worker receives SMS + in-app notification with interview details
- Worker can Accept or Propose Alternative Time
- Shortlist status updated to "Interview Requested"

---

### TC-SHORTLIST-003: Worker Interview Response

**Objective:** Verify worker can respond to interview request

**Preconditions:**
- Worker received interview request notification

**Steps:**
1. Worker opens notification (SMS or in-app)
2. Reviews interview details
3. Clicks "Accept Interview"
4. Confirms availability

**Expected Results:**
- Response recorded in database
- Employer notified: "Worker has accepted your interview request"
- Interview appears on both parties' dashboards with confirmed date/time
- Oakvale agent notified

---

### TC-SHORTLIST-004: In-Platform Messaging — Message Sent

**Objective:** Verify employer-worker messaging

**Preconditions:**
- Worker and employer in active shortlist/interview flow

**Steps:**
1. Employer clicks "Message" on worker profile
2. Types message: "Hi, looking forward to speaking with you tomorrow"
3. Clicks "Send"

**Expected Results:**
- Message sent to worker
- Worker receives notification (SMS optional, in-app required)
- Message logged with timestamp and user ID
- Oakvale agent can read conversation
- Personal contact details not disclosed in message system

---

### TC-SHORTLIST-005: Messaging — Automated Filtering of Contact Details

**Objective:** Verify personal contact details cannot be shared via messages

**Preconditions:**
- Employer trying to share phone number in message

**Steps:**
1. Employer types message containing phone number: "Call me at +234 801 234 5678"
2. Clicks "Send"

**Expected Results:**
- Message detected as containing phone number
- Flagged and not sent, or sent with number masked
- User notified: "Personal contact details cannot be shared via messages. Please wait until contract signing when details will be officially released."

---

---

## 6. Offers & Hiring

### TC-OFFER-001: Make Offer to Worker

**Objective:** Verify offer creation and submission

**Preconditions:**
- Employer has shortlisted worker and completed interview

**Steps:**
1. Navigate to shortlist
2. Click on worker
3. Click "Make Offer"
4. Fill offer details:
   - Role title: "Full-time Childcare Worker"
   - Start date: "2024-07-01"
   - Employment type: "Full-time"
   - Salary: "₦150,000/month"
   - Location: "Lagos HQ Crèche"
   - Working hours: "8:00 AM - 5:00 PM, Monday-Friday"
   - Additional conditions: "Subject to successful background check completion"
5. Click "Submit for Review"

**Expected Results:**
- Offer saved as Draft
- Oakvale agent notified for fairness review
- Status: "Pending Review"

---

### TC-OFFER-002: Offer Review by Agent

**Objective:** Verify agent reviews offer fairness

**Preconditions:**
- Offer submitted for review

**Steps:**
1. Agent logs into admin dashboard
2. Navigate to "Offers Pending Review"
3. Review offer terms (salary, hours, start date reasonable)
4. Click "Approve"

**Expected Results:**
- Offer status: "Approved"
- Offer sent to worker
- Worker receives SMS + in-app notification
- Shortlist status: "Offer Made"

---

### TC-OFFER-003: Worker Accepts Offer

**Objective:** Verify offer acceptance workflow

**Preconditions:**
- Offer sent to worker and received

**Steps:**
1. Worker opens notification
2. Navigates to "My Offers"
3. Clicks "View Offer"
4. Reviews terms
5. Clicks "Accept Offer"

**Expected Results:**
- Offer status: "Accepted"
- Triggers workflow:
  - Contract generation (Worker Placement Agreement)
  - Invoice generation for employer (placement fee)
  - Account manager assignment
  - Oakvale agent notification
- Worker sees: "Congratulations! Your offer has been accepted. You will receive your contract shortly for digital signing."

---

### TC-OFFER-004: Worker Declines Offer

**Objective:** Verify offer decline workflow

**Preconditions:**
- Offer sent to worker

**Steps:**
1. Worker opens notification
2. Clicks "Decline Offer"
3. Optional: provides reason

**Expected Results:**
- Offer status: "Declined"
- Employer notified: "Worker has declined your offer"
- Shortlist status: "Rejected"
- Employer can request interviews from other workers in shortlist

---

### TC-OFFER-005: Worker Negotiates Offer Terms

**Objective:** Verify offer negotiation flow

**Preconditions:**
- Offer sent to worker

**Steps:**
1. Worker clicks "Negotiate"
2. Provides counter-proposal:
   - Requested salary: "₦160,000/month"
   - Additional request: "Allow flexible start date - prefer July 8"
3. Clicks "Send Counter-Proposal"

**Expected Results:**
- Negotiation recorded
- Employer notified with counter-proposal details
- Shortlist status: "On Hold - Negotiating"
- Agent notified to facilitate discussion

---

---

## 7. Contracts Management

### TC-CONTRACT-001: Contract Generation — Worker Placement Agreement

**Objective:** Verify contract is generated from template and populated correctly

**Preconditions:**
- Worker has accepted offer

**Steps:**
1. System generates contract from template
2. Variables populated:
   - {{worker.full_name}}: "Chioma Okonkwo"
   - {{worker.certificate_number}}: "OAK-CCW-2024-001234"
   - {{employer.name}}: "Techcorp Nigeria Ltd"
   - {{placement.role_title}}: "Childcare Worker"
   - {{placement.start_date}}: "2024-07-01"
   - {{placement.salary}}: "₦150,000/month"
   - {{guarantee.replacement_days}}: "90"
3. Contract stored as PDF

**Expected Results:**
- All variables correctly substituted
- Contract reflects offer details accurately
- Contract versioned (e.g., v1.0)
- Stored in database and accessible via S3

---

### TC-CONTRACT-002: Digital Signing — Worker Signs Contract

**Objective:** Verify worker can sign contract digitally

**Preconditions:**
- Contract generated and sent to worker

**Steps:**
1. Worker receives notification: "Your contract is ready for signature"
2. Worker navigates to "My Contracts"
3. Clicks on contract
4. Reads contract (can scroll through full PDF)
5. Scrolls to bottom, finds signature section
6. Checks checkbox: "I have read and agree to the terms"
7. Clicks "Sign & Accept"
8. Authentication confirmed (password re-entry or 2FA)

**Expected Results:**
- Signature recorded with:
  - Timestamp
  - User account confirmation
  - Explicit consent checkbox
- Contract status: "Signed by Worker - Awaiting Employer"
- Employer receives notification: "Worker has signed contract. Please review and sign."

---

### TC-CONTRACT-003: Digital Signing — Employer Signs Contract

**Objective:** Verify employer can sign contract digitally

**Preconditions:**
- Worker has signed; contract awaiting employer

**Steps:**
1. Employer receives notification
2. Navigates to "My Contracts"
3. Views contract
4. Checks signature checkbox
5. Clicks "Sign & Accept"

**Expected Results:**
- Signature recorded with timestamp and authentication
- Contract status: "Fully Executed"
- Both parties receive signed PDF copy
- Placement record status updated to "Active"
- Triggers:
  - Invoice sent to employer
  - Pre-placement briefing sent to worker
  - Account manager assigned
  - Placement record created

---

### TC-CONTRACT-004: Contract Signing — 48-Hour Reminder

**Objective:** Verify reminder sent if contract unsigned after 48 hours

**Preconditions:**
- Contract sent to worker 48+ hours ago, not yet signed

**Steps:**
1. Cron job runs: "check unsigned contracts"
2. BullMQ job enqueued to send reminder

**Expected Results:**
- Worker receives SMS + in-app reminder: "Your contract is waiting for your signature. Please sign within 24 hours."
- Reminder timestamp recorded

---

### TC-CONTRACT-005: Contract Amendment

**Objective:** Verify contract can be amended and re-signed

**Preconditions:**
- Active placement with signed contract
- Need to change salary due to promotion

**Steps:**
1. Agent initiates amendment: Change salary from "₦150,000" to "₦170,000"
2. System generates amended contract (v2.0)
3. Both parties notified
4. Both parties re-sign amended contract

**Expected Results:**
- Amended contract generated with updated salary
- Previous version (v1.0) archived
- Both parties sign v2.0
- Amendment logged with date, initiator, and changes made
- Only v2.0 is active for the placement

---

---

## 8. Placement Management

### TC-PLACEMENT-001: Placement Record Creation

**Objective:** Verify placement record is created upon contract signing

**Preconditions:**
- Worker and employer have signed contract

**Steps:**
1. Contract status: "Fully Executed"
2. System creates placement record

**Expected Results:**
- Placement record contains:
  - Worker ID: 12345
  - Employer ID: 67890
  - Role: "Childcare Worker"
  - Start date: 2024-07-01
  - Guarantee expires at: 2024-09-30 (90 days)
  - Account manager assigned
  - Status: "Active"
- Placement visible in both worker and employer dashboards

---

### TC-PLACEMENT-002: Welfare Check — Diaspora Pipeline (Monthly Report)

**Objective:** Verify monthly welfare check workflow for diaspora placements

**Preconditions:**
- Active diaspora placement (caregiver in Nigeria, family in UK)

**Steps:**
1. Placement start date: 2024-07-01
2. July 15 (2 weeks in): Account manager calls worker
3. Agent logs welfare check:
   - Date: 2024-07-15
   - Method: Phone call
   - Worker attendance: Yes
   - Care recipient wellbeing: Green (satisfied)
   - Issues flagged: None
4. System generates welfare report

**Expected Results:**
- Welfare check logged in placement record
- Welfare report PDF generated from template
- Report emailed to diaspora family
- Next scheduled check: 2024-08-15
- Notification queued: "Welfare check scheduled for next month"

---

### TC-PLACEMENT-003: Welfare Check — Amber Status (Escalation)

**Objective:** Verify escalation when welfare check indicates concerns

**Preconditions:**
- Active placement

**Steps:**
1. Agent logs welfare check with status: Amber
2. Issue: "Worker reports care recipient health decline, increased support needed"
3. Submits

**Expected Results:**
- Status recorded as "Amber"
- Automatic escalation to senior agent
- Agent assigned for follow-up within 24 hours
- Employer (diaspora family) notified: "There are concerns with your placement. An Oakvale agent will call to discuss."
- Log message in placement record for audit trail

---

### TC-PLACEMENT-004: CPD Compliance — Tracking & Alerts

**Objective:** Verify CPD expiry tracking and alert notifications

**Preconditions:**
- Worker with Childcare Worker certification
- CPD due date: 2025-06-15

**Steps:**
1. System runs daily CPD check
2. Current date: 2025-05-16 (60 days before due)
3. BullMQ job `cpd-reminders` enqueued

**Expected Results:**
- Worker receives SMS: "Your CPD is due in 60 days (June 15, 2025). Please refresh your certification to continue working."
- Employer receives email: "Caregiver's CPD is due for renewal in 60 days."
- Placement CPD status: "Current"

---

### TC-PLACEMENT-005: CPD Compliance — Overdue Status

**Objective:** Verify overdue CPD triggers profile suspension

**Preconditions:**
- Worker CPD was due 2025-06-15
- Current date: 2025-07-16 (30+ days overdue)
- Worker has not completed renewal

**Steps:**
1. Daily CPD check identifies overdue status
2. Worker profile status updated

**Expected Results:**
- Profile badge: "CPD Overdue"
- Worker cannot be shortlisted for new roles
- Employer (if active placement) notified: "Caregiver's CPD is overdue. Urgent renewal required."
- Agent notification queued for follow-up
- Worker receives SMS: "Your CPD is overdue. You cannot accept new placements until renewed. Please contact Oakvale."

---

### TC-PLACEMENT-006: Replacement Workflow — Within 90-Day Guarantee Window

**Objective:** Verify replacement is sourced at no additional fee within guarantee window

**Preconditions:**
- Placement active for 45 days (within 90-day window)
- Employer requests replacement (worker resigned)

**Steps:**
1. Employer or agent raises replacement request
2. Reason: "Worker resigned due to personal reasons"
3. Request submitted

**Expected Results:**
- Replacement request logged with timestamp
- Guarantee window calculated: Yes, within 90 days
- Replacement fee: £0 (no additional charge)
- Agent generates new shortlist (matching tool)
- Employer reviews and selects replacement
- New placement record created
- Original placement closed and linked to replacement

---

### TC-PLACEMENT-007: Replacement Workflow — Outside Guarantee Window

**Objective:** Verify replacement fee charged after guarantee window

**Preconditions:**
- Placement active for 100 days (outside 90-day window)
- Employer requests replacement

**Steps:**
1. Agent raises replacement request
2. Request submitted

**Expected Results:**
- Replacement fee: charged (e.g., ₦50,000)
- Invoice generated for employer
- Employer notified of fee
- Employer must approve before replacement sourced

---

### TC-PLACEMENT-008: Placement Suspension Due to Safeguarding Flag

**Objective:** Verify misconduct/safeguarding flag suspends placement immediately

**Preconditions:**
- Active placement exists
- Complaint filed: "Worker reported for physical abuse"

**Steps:**
1. Complaint severity: "SAFEGUARDING"
2. Agent reviews and creates flag: "Safeguarding - Physical Abuse Allegation"
3. Flag creation event emitted

**Expected Results:**
- Background job triggered: Suspend all active placements for this worker
- Placement status: "Suspended"
- Worker and employer notified immediately
- Agent assigned for investigation
- All future shortlisting blocked until cleared

---

---

## 9. Complaints & Resolution Management

### TC-COMPLAINT-001: File Complaint — Worker vs Employer

**Objective:** Verify complaint submission workflow

**Preconditions:**
- Worker in active placement

**Steps:**
1. Worker navigates to "File a Complaint"
2. Fills form:
   - Category: "Employer unfair treatment of worker"
   - Related placement: Auto-linked
   - Date of incident: "2024-07-20"
   - Description: "Employer demanded I work weekends without additional pay, contrary to our agreement."
   - Preferred resolution: "Renegotiate hours to match contract"
3. Clicks "Submit"

**Expected Results:**
- Complaint created with unique reference: "COMP-2024-001234"
- Status: "Submitted"
- Acknowledgement email/SMS sent to worker with reference number and 48-hour response target
- Assigned agent notified
- Placement flagged for review

---

### TC-COMPLAINT-002: Complaint Investigation & Resolution

**Objective:** Verify complaint investigation workflow

**Preconditions:**
- Complaint filed

**Steps:**
1. Agent reviews complaint details
2. Agent contacts both parties (worker and employer)
3. Gathers evidence
4. After investigation:
   - Determines violation: Yes, employer breached contract
   - Resolution: Salary adjustment (₦10,000/month for weekend flexibility)
5. Documents decision
6. Updates complaint status: "Resolved"

**Expected Results:**
- Investigation logged with timestamps and communications
- Resolution documented
- Both parties notified: "Your complaint has been resolved. Placement terms will be adjusted as follows..."
- New amendment contract generated and signed
- Placement updated with new terms

---

### TC-COMPLAINT-003: Complaint Escalation — Safeguarding Issue

**Objective:** Verify critical complaints escalate to senior management

**Preconditions:**
- Critical safeguarding complaint filed

**Steps:**
1. Worker files complaint: "Employer physically abused me"
2. Severity: "CRITICAL - SAFEGUARDING"
3. Submitted

**Expected Results:**
- Complaint immediately escalated to Platform Admin
- Placement suspended (see TC-PLACEMENT-008)
- Response target: Immediate (within 2 hours)
- Senior agent + Admin notified
- Law enforcement referral consideration documented

---

### TC-COMPLAINT-004: High-Priority Complaint — Payment Dispute

**Objective:** Verify high-priority complaints get 24-hour SLA

**Preconditions:**
- Worker has not received payment

**Steps:**
1. Worker files complaint: "Employer non-payment"
2. Date: 2024-07-31 (payment due date)
3. Submitted: 2024-08-01 10:00 AM

**Expected Results:**
- Urgency: HIGH
- Response target: 24 hours (by 2024-08-02 10:00 AM)
- Agent contacts employer immediately
- If payment confirmed, complaint closed
- If payment not made, escalation to finance/legal team

---

### TC-COMPLAINT-005: Complaint History in Placement Record

**Objective:** Verify all complaints linked to placement appear in history

**Preconditions:**
- Multiple complaints filed for same placement

**Steps:**
1. View placement record as agent
2. Scroll to "Complaints History"

**Expected Results:**
- All complaints for this placement listed:
  - COMP-2024-001234: "Employer unfair treatment" - Resolved
  - COMP-2024-001235: "Hours dispute" - Open
- Timeline view shows complaint dates and resolutions
- Linked to worker and employer records

---

---

## 10. Admin Console & Configuration

### TC-ADMIN-001: Add New Workforce Category

**Objective:** Verify Platform Admin can add new workforce category without code changes

**Preconditions:**
- Platform Admin logged into Admin Console

**Steps:**
1. Navigate to "Configuration > Workforce Categories"
2. Click "Add New Category"
3. Fill form:
   - Category name: "Care Coordinator"
   - Description: "Coordinates care planning and multi-agency liaison"
   - Required certification(s): Link to "Care Coordinator" LMS programme
   - Skills menu: [Care Planning, Assessments, Safeguarding, Multi-agency Coordination, etc.]
   - Placement settings: Clinic, Hospital, NGO, Corporate
   - Employment types: Full-time, Part-time, Contract
   - Compliance fields required: Professional registration, CPD
   - Active: Yes
4. Click "Save"

**Expected Results:**
- Category created and stored in database
- Immediately available in worker profile dropdown
- Immediately available in employer job posting form
- No code deployment required

---

### TC-ADMIN-002: Add New Employer Type

**Objective:** Verify Platform Admin can add new employer type

**Preconditions:**
- Admin Console accessible

**Steps:**
1. Navigate to "Configuration > Employer Types"
2. Click "Add New Type"
3. Fill form:
   - Type name: "Private Hospital"
   - Description: "Private healthcare facility"
   - Registration fields: Company name, Hospital registration number, sector
   - Verification method: CAC number + Hospital license
   - Pricing model: Per-placement fee
   - Service model: Self-service job posting
   - Worker categories: [Liaison Nurse, Clinical Assistant, Hospital Administrator]
   - Payment gateways: Paystack (NGN)
4. Click "Save"

**Expected Results:**
- Employer type created
- Available in employer registration flow
- Verification workflow configured
- Job posting enabled for this type

---

### TC-ADMIN-003: Edit Contract Template

**Objective:** Verify Platform Admin can update contract templates

**Preconditions:**
- Admin Console accessible

**Steps:**
1. Navigate to "Configuration > Contract Templates"
2. Select: "Worker Placement Agreement"
3. Click "Edit"
4. Modify text (e.g., add new clause about data privacy)
5. Preview rendered contract with sample variables
6. Click "Save as v2.0"

**Expected Results:**
- Template versioned (previous version archived)
- New placements use v2.0
- Existing placements retain their signed version (v1.0)
- Change log recorded

---

### TC-ADMIN-004: View KPI Dashboard

**Objective:** Verify admin can view platform KPIs

**Preconditions:**
- Admin logged in

**Steps:**
1. Navigate to "Analytics > KPI Dashboard"
2. View metrics:
   - Total workers registered
   - Workers verified (identity + background check clear)
   - Employers registered and verified
   - Active placements
   - Completed placements (last 30 days)
   - Placement success rate (%)
   - Average placement duration
   - Replacement rate (%)
   - CPD compliance rate (%)
3. Select date range: Last 90 days

**Expected Results:**
- All metrics calculated and displayed correctly
- Charts render properly
- Data updates daily
- CSV export available

---

### TC-ADMIN-005: Agent Role Permissions

**Objective:** Verify role-based permissions for agents

**Preconditions:**
- Different agent roles created

**Steps:**
1. Create three agents:
   - Agent A: Role = "Recruiter"
   - Agent B: Role = "Liaison Nurse"
   - Agent C: Role = "Account Manager"
2. Test access:
   - Recruiter attempts to view financial reports
   - Liaison Nurse views CPD compliance fields
   - Account Manager views assigned employer/worker records

**Expected Results:**
- Recruiter: Blocked from financial reports (403 Forbidden)
- Liaison Nurse: Can view CPD fields; blocked from financial data
- Account Manager: Can view assigned records only; blocked from other employer accounts

---

---

## 11. Payment & Billing

### TC-PAYMENT-001: Invoice Generation for Placement Fee

**Objective:** Verify invoice generated upon placement activation

**Preconditions:**
- Worker and employer have signed contract
- Placement status: "Active"

**Steps:**
1. System generates invoice for placement fee
2. Invoice details:
   - Invoice number: 2024-0001234
   - Invoice date: 2024-07-01
   - Employer: "Techcorp Nigeria Ltd"
   - Service: "Placement Fee - Childcare Worker"
   - Amount: ₦50,000
   - Due date: 2024-08-01 (30-day net terms)

**Expected Results:**
- Invoice stored in database
- PDF generated and emailed to employer
- Invoice visible in employer billing portal
- Payment gateway ready (Paystack for NGN)

---

### TC-PAYMENT-002: Payment Processing — Successful

**Objective:** Verify successful payment processing

**Preconditions:**
- Invoice issued
- Employer initiates payment

**Steps:**
1. Employer navigates to "Pay Invoice"
2. Selects invoice: INV-2024-0001234
3. Clicks "Pay Now"
4. Redirected to Paystack payment gateway
5. Enters card details and completes payment
6. Paystack processes payment successfully

**Expected Results:**
- Paystack webhook received with `status: SUCCESS`
- Webhook signature validated
- Payment recorded in database
- Invoice marked as "Paid"
- Placement remains "Active" (no suspension)
- Employer receives payment confirmation email

---

### TC-PAYMENT-003: Payment Processing — Failed

**Objective:** Verify failed payment is handled

**Preconditions:**
- Invoice issued

**Steps:**
1. Employer attempts payment with invalid card
2. Paystack returns error

**Expected Results:**
- Error message: "Payment failed. Please try again with a valid card."
- Invoice remains "Unpaid"
- Employer receives email: "Payment unsuccessful. Please retry or contact support."

---

### TC-PAYMENT-004: Payment Overdue

**Objective:** Verify overdue payment escalation

**Preconditions:**
- Invoice due date: 2024-08-01
- Current date: 2024-08-15
- Payment not received

**Steps:**
1. Daily job checks for overdue payments
2. Invoice is 14 days overdue

**Expected Results:**
- Payment reminder email sent to employer
- Agent notified of overdue account
- Escalation: After 30 days overdue, placement at risk of suspension

---

---

## 12. Integration Tests

### TC-INTEGRATION-001: End-to-End Worker Registration → Placement

**Objective:** Verify complete workflow from registration to active placement

**Duration:** ~15-20 minutes (simulated timeline)

**Preconditions:**
- All services running

**Steps:**
1. **Worker Registration**
   - Register with phone: +234 801 234 5678
   - Verify OTP
   - Set password
2. **Profile Completion**
   - Complete 70% of profile sections
   - Upload identity documents
   - Trigger background check
3. **Identity Verification** (Simulate)
   - Agent reviews documents
   - Approves verification
4. **Background Check** (Simulate)
   - Sterling webhook: status = CLEAR
5. **Oakvale Certificate Validation**
   - Enter certificate number: OAK-CCW-2024-001234
   - Validate against LMS
   - Profile marked "Oakvale Verified"
6. **Worker Searchable**
   - Employer searches and finds worker
7. **Shortlist & Interview**
   - Employer saves to shortlist
   - Requests interview
   - Worker accepts
8. **Offer & Hiring**
   - Employer makes offer
   - Agent reviews and approves
   - Worker accepts offer
9. **Contract Signing**
   - Contract generated
   - Worker signs
   - Employer signs
10. **Placement Active**
    - Placement record created
    - Invoice generated
    - Employer pays
    - Placement status: "Active"

**Expected Results:**
- All steps complete successfully
- Timeline: Registration to Active Placement ≤ 7 calendar days
- All notifications sent (SMS, email, in-app)
- All records created in database
- No errors in logs

---

### TC-INTEGRATION-002: End-to-End Complaint → Resolution

**Objective:** Verify complete complaint workflow

**Preconditions:**
- Active placement exists

**Steps:**
1. Worker files complaint (TC-COMPLAINT-001)
2. Agent receives notification
3. Agent investigates (TC-COMPLAINT-002)
4. Agent resolves (contract amendment if needed)
5. Both parties notified of resolution
6. Placement updated

**Expected Results:**
- Complaint resolved within SLA (48 hours for standard)
- Resolution documented and logged
- Both parties satisfied
- Audit trail complete

---

### TC-INTEGRATION-003: System Availability Under Load

**Objective:** Verify system performance during typical load

**Preconditions:**
- Backend, database, Redis running

**Steps:**
1. Simulate 50 concurrent employer searches
2. Each employer searching with multiple filters
3. Run for 5 minutes

**Expected Results:**
- All searches complete < 1 second
- No dropped requests
- Database queries < 200ms
- Cache hits for repeated queries
- No memory leaks
- Logs show no errors

---

---

## 13. Security & Data Privacy Tests

### TC-SECURITY-001: SQL Injection Prevention

**Objective:** Verify SQL injection attacks are prevented

**Preconditions:**
- API endpoint with search filter accessible

**Steps:**
1. Send search request with malicious SQL:
   ```
   filter=name' OR '1'='1
   ```
2. Send via API

**Expected Results:**
- Query sanitized by ORM (Drizzle)
- No results returned for malicious query
- No system error exposed
- Attempt logged for security audit

---

### TC-SECURITY-002: XSS Prevention (DOM-based)

**Objective:** Verify DOM-based XSS is prevented

**Preconditions:**
- Worker profile form with user-generated content

**Steps:**
1. Worker enters name: `<script>alert('XSS')</script>`
2. Saves profile
3. Employer views worker profile

**Expected Results:**
- Script tags stripped or escaped
- No alert box executed
- Name displayed as sanitized text: `<script>alert('XSS')</script>` (visible, not executed)
- Content Security Policy headers prevent inline script execution

---

### TC-SECURITY-003: CSRF Protection

**Objective:** Verify CSRF tokens prevent cross-site request forgery

**Preconditions:**
- User logged into platform
- User visits malicious third-party site

**Steps:**
1. Malicious site attempts to POST request to platform API
   ```
   POST /api/v1/placements/123/terminate
   ```
2. Request lacks valid CSRF token

**Expected Results:**
- Request rejected: 403 Forbidden
- No state change occurs
- Error logged

---

### TC-SECURITY-004: Password Hashing

**Objective:** Verify passwords are hashed securely

**Preconditions:**
- Worker registered with password

**Steps:**
1. Query database directly
2. Attempt to read stored password

**Expected Results:**
- Password is hashed (bcrypt or similar)
- Plain-text password not stored
- Hash cannot be reversed to retrieve plain password

---

### TC-SECURITY-005: Sensitive Data Not Logged

**Objective:** Verify sensitive data (passwords, tokens) not in logs

**Preconditions:**
- Worker registration and login events

**Steps:**
1. Register worker with password: "SecureP@ss123"
2. Log in
3. Review application logs

**Expected Results:**
- Logs do not contain plain-text password
- Logs do not contain full access tokens
- Logs contain:
   - "User registration attempt from IP: 192.168.1.1"
   - "Login successful for user: +234 801 234 5678"
   - No sensitive PII or credentials

---

### TC-SECURITY-006: Rate Limiting on Login

**Objective:** Verify rate limiting prevents brute-force attacks

**Preconditions:**
- API rate limiting configured

**Steps:**
1. Attempt login 10 times in 1 minute with wrong password
2. Each attempt: +234 801 234 5678 / wrong_password

**Expected Results:**
- After 5 failed attempts: account temporarily locked
- Response: 429 Too Many Requests
- Lockout duration: 15 minutes
- User notified: "Too many failed login attempts. Please try again in 15 minutes."

---

### TC-SECURITY-007: NDPA Compliance — Data Residency

**Objective:** Verify Nigeria user data stays in Nigeria

**Preconditions:**
- Data stored in Nigeria-based Postgres instance

**Steps:**
1. Create worker account in Nigeria
2. Query database location

**Expected Results:**
- All worker data stored in Nigeria database
- No replication to UK/US servers (except encrypted backups)
- NDPA compliance documented

---

### TC-SECURITY-008: GDPR Compliance — Diaspora User Right to Deletion

**Objective:** Verify UK-based diaspora users can request data deletion

**Preconditions:**
- Diaspora family account exists

**Steps:**
1. Diaspora user submits data deletion request via "My Account > Privacy"
2. Specifies scope: "All personal data"

**Expected Results:**
- Deletion request logged and queued
- Acknowledgement sent: "Your deletion request has been received. We will process it within 30 days per GDPR Article 17."
- Data anonymized or deleted within 30-day window
- Audit trail retained for compliance

---

---

## 14. Performance & Load Tests

### TC-PERF-001: Page Load Time — Worker Dashboard

**Objective:** Verify worker dashboard loads quickly on mobile connection

**Preconditions:**
- Worker logged in
- Simulated 3G connection (1 Mbps download, 0.5 Mbps upload)

**Steps:**
1. Navigate to worker dashboard
2. Measure time to First Contentful Paint (FCP)
3. Measure time to Largest Contentful Paint (LCP)

**Expected Results:**
- FCP: < 1.5 seconds
- LCP: < 2.5 seconds
- No layout shift (CLS < 0.1)
- Image assets compressed (webp format, < 100KB per image)

---

### TC-PERF-002: Search Performance with Large Result Set

**Objective:** Verify search returns results quickly with 10,000+ workers

**Preconditions:**
- Database contains 10,000+ verified workers
- Search with multiple filters

**Steps:**
1. Execute search: Category=Childcare, Location=Lagos, Experience=3+
2. Measure response time

**Expected Results:**
- Response time: < 500ms
- Results cached in Redis for 5 minutes
- Subsequent identical searches: < 100ms

---

### TC-PERF-003: Contract PDF Generation Time

**Objective:** Verify contract PDF generates quickly

**Preconditions:**
- Contract template stored
- Placement data ready

**Steps:**
1. Trigger contract generation
2. Measure generation time

**Expected Results:**
- PDF generated within 2 seconds
- File size < 500KB
- PDF accessible immediately for download

---

---

## 15. Accessibility & Localization

### TC-A11Y-001: Mobile Responsiveness — Profile Form

**Objective:** Verify profile form is fully functional on mobile

**Preconditions:**
- Worker on low-end Android device (360px width)
- Intermittent connectivity

**Steps:**
1. Start profile completion form
2. Fill in each section on mobile
3. Navigate between sections
4. Attempt document upload on mobile

**Expected Results:**
- Form readable without horizontal scroll
- Touch targets >= 48px
- Form inputs accessible with mobile keyboard
- Document upload works with camera or file picker
- Progress persists if connection drops

---

### TC-A11Y-002: Bilingual Support — Hausa Interface

**Objective:** Verify Hausa translation is complete and accurate

**Preconditions:**
- Hausa language selected in settings

**Steps:**
1. Select "Hausa" from language menu
2. Navigate through worker dashboard
3. Check all key sections:
   - Profile form labels
   - Buttons and CTAs
   - Error messages
   - Notifications

**Expected Results:**
- All text translated to Hausa
- No English text remaining (except proper nouns: Oakvale, Lagos, etc.)
- RTL (right-to-left) layout if required
- Translations contextually appropriate

---

### TC-A11Y-003: Screen Reader Compatibility

**Objective:** Verify key workflows work with screen readers

**Preconditions:**
- Screen reader enabled (NVDA or JAWS)

**Steps:**
1. Navigate worker dashboard
2. Fill out profile form
3. Interact with shortlist

**Expected Results:**
- All page sections announced by screen reader
- Form labels correctly associated with inputs
- Buttons have descriptive labels (not "Click Here")
- Images have alt text
- Alerts are announced to screen reader users

---

---

## Summary & Sign-Off

**Total Test Cases:** 115+  
**Coverage Areas:** Auth, Profile, Search, Placements, Contracts, Payments, Admin, Security, Performance, Accessibility

**Recommended Testing Order:**
1. Authentication tests (TC-AUTH-*)
2. Profile & onboarding (TC-PROFILE-*)
3. Employer features (TC-EMPLOYER-*)
4. Search & discovery (TC-SEARCH-*)
5. Hiring workflow (TC-SHORTLIST-*, TC-OFFER-*)
6. Contracts (TC-CONTRACT-*)
7. Placements (TC-PLACEMENT-*)
8. Complaints (TC-COMPLAINT-*)
9. Admin (TC-ADMIN-*)
10. Integration tests (TC-INTEGRATION-*)
11. Security tests (TC-SECURITY-*)
12. Performance tests (TC-PERF-*)
13. Accessibility tests (TC-A11Y-*)

**Testing Responsibility:**
- **Happy path (Pass tests)**: QA team, manual testing
- **Edge cases & error scenarios**: QA + developer pairing
- **Performance & load tests**: DevOps + backend team
- **Security tests**: Security audit + developer review

---

**Document Version:** 1.0  
**Last Updated:** June 2026  
**Status:** Ready for Testing
