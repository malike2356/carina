# Labyrinth Magister -- Comprehensive Implementation Plan

**Date:** 2026-06-19
**Status:** PLANNING -- Ready for phased implementation
**Product:** Labyrinth Magister -- AI-Powered Cybersecurity Academy
**Instructor:** Carina (AI agent)
**Tools:** 72 cyber tools (recon, vuln, exploit, web, wireless, forensic, traffic, privacy)
**Certification:** AI-issued, AI-assessed, AI-graded

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Where It Fits in the Ecosystem](#2-where-it-fits)
3. [Architecture](#3-architecture)
4. [Database Schema](#4-database-schema)
5. [Carina as Teacher -- The Coaching Engine](#5-carina-as-teacher)
6. [Course Structure](#6-course-structure)
7. [Assessment and Grading](#7-assessment-and-grading)
8. [Certification](#8-certification)
9. [Student Experience](#9-student-experience)
10. [Admin Experience](#10-admin-experience)
11. [Implementation Phases](#11-implementation-phases)
12. [Revenue Model](#12-revenue-model)
13. [Success Metrics](#13-success-metrics)

---

## 1. Product Vision

Labyrinth Magister is not a video course platform with an AI chatbot bolted on. It is an AI teacher that runs a cybersecurity academy. Carina is the instructor, the assessor, and the certifier. The 72 cyber tools are the lab. Students learn by doing, are assessed by results, and are certified by an AI that watched their every command.

The difference from every other cybersecurity course:

| Traditional Course | Labyrinth Magister |
|---|---|
| Pre-recorded videos | Live AI conversation tailored to the student |
| Multiple-choice quizzes | Real-world tool challenges assessed by AI |
| Human grading (slow, inconsistent) | AI grading (instant, consistent, auditable) |
| Certificate: "completed course" | Certificate: "Carina verified you can run a forensic investigation" |
| No tools after course | 72 tools included, same tools used in production |
| $500-$5000 per course | TBD pricing model |

---

## 2. Where It Fits in the Ecosystem

```
                         ┌──────────────────────┐
                         │    Labyrinth Scout    │  Paid security product
                         │    (governance)       │
                         └──────────┬───────────┘
                                    │ protects
              ┌─────────────────────┼─────────────────────┐
              │                     │                      │
    ┌─────────▼──────┐    ┌────────▼───────┐    ┌────────▼──────────┐
    │  Carina Free   │    │  Incident Blog  │    │  Labyrinth Magister│
    │  (adoption)    │    │  (fear driver)  │    │  (education)       │
    └────────┬───────┘    └────────────────┘    └────────┬───────────┘
             │                                            │
             │ uses                                       │ teaches + certifies
             │                                            │
    ┌────────▼────────────────────────────────────────────▼───────────┐
    │                        72 Cyber Tools                           │
    │  (recon · vuln · exploit · web · wireless · forensic · traffic) │
    └─────────────────────────────────────────────────────────────────┘
```

**The flywheel:**

1. Free Carina brings developers in
2. The incident blog proves weekly why cybersecurity skills matter
3. Magister teaches them those skills using the 72 tools they will use in production
4. Students graduate with a Carina-verified certificate
5. They deploy Carina + Scout in their workplace because they already trust the tools
6. Some become paying Scout customers
7. The blog documents incidents that prove the training was necessary

---

## 3. Architecture

Magister lives as a product surface within the Carina codebase. It is NOT a separate codebase. It is a new surface type, like "hosted" or "private" -- `magister`.

### 3.1 Code Locations

```
core.carinaai.uk/
├── src/
│   ├── magister/                    NEW: Magister module
│   │   ├── types.ts                 Course, Module, Lesson, Student, Assessment, Certificate
│   │   ├── store.ts                 CRUD for all entities
│   │   ├── coaching-engine.ts       Carina-as-teacher prompt engine
│   │   ├── assessment-engine.ts     Automated grading logic
│   │   ├── certification.ts         Certificate generation and verification
│   │   ├── curriculum/              Course content definitions
│   │   │   ├── cybersecurity-101.ts
│   │   │   ├── reconnaissance.ts
│   │   │   ├── exploitation.ts
│   │   │   ├── forensics.ts
│   │   │   └── red-team-ops.ts
│   │   └── templates/               Certificate HTML/CSS templates
│   ├── tools/
│   │   └── magister.ts              Carina tools for teaching operations
│   ├── cli/commands/
│   │   └── magister.ts              CLI: carina magister ...
│   └── api/
│       └── magister-api.ts          REST API for student portal
│
├── infrastructure/migrations/
│   └── 006-magister.sql             Magister database schema
│
ops.carinaai.uk/
├── src/routes/
│   └── magister-admin.ts            Admin CRUD for courses, students, certificates
├── src/views/
│   └── magister/                    EJS templates for admin
│
app.carinaai.uk/                      NEXT.JS STUDENT PORTAL
├── src/app/magister/                Student-facing learning interface
│   ├── page.tsx                     Dashboard: enrolled courses, progress
│   ├── course/[slug]/               Course view: lessons, assessments
│   ├── lab/                         Hands-on cyber tool lab
│   ├── certificate/[id]/            Certificate view + verification
│   └── profile/                     Student profile, grades, history
│
labyrinthscout.com/
├── magister/                        Public landing page for Magister
│   └── index.html                   Marketing page, course catalog, pricing
```

### 3.2 Product Surface Registration

Magister gets registered as a Carina product surface alongside hosted, private, and ops. The student portal at `app.carinaai.uk/magister` serves the learning interface. The admin lives in `ops.carinaai.uk`.

### 3.3 Deployment

- Core Magister engine: runs inside Carina (same Node.js process)
- Student portal: Next.js app at `app.carinaai.uk/magister`
- Admin: Express/EJS at `ops.carinaai.uk/magister`
- Public site: static HTML at `labyrinthscout.com/magister`

---

## 4. Database Schema

### 4.1 Courses

```sql
CREATE TABLE magister_courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  subtitle      TEXT,
  description   TEXT NOT NULL,
  category      TEXT NOT NULL,              -- 'cybersecurity', 'forensics', 'red-team', 'ai-security'
  difficulty    TEXT NOT NULL,              -- 'beginner', 'intermediate', 'advanced', 'expert'
  duration_hours INTEGER,                   -- estimated completion hours
  tool_count    INTEGER DEFAULT 0,          -- how many of the 72 tools used
  prerequisites TEXT[],                     -- course slugs recommended before taking
  skills_gained TEXT[],                     -- skills the student acquires
  price_cents   INTEGER DEFAULT 0,          -- 0 = free
  status        TEXT DEFAULT 'draft',       -- draft, published, archived
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Modules (within a course)

```sql
CREATE TABLE magister_modules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES magister_courses(id),
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  order_index   INTEGER NOT NULL,
  estimated_minutes INTEGER DEFAULT 30,
  tools_used    TEXT[],                     -- cyber tool names used in this module
  UNIQUE(course_id, slug),
  UNIQUE(course_id, order_index)
);
```

### 4.3 Lessons (within a module)

```sql
CREATE TABLE magister_lessons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     UUID NOT NULL REFERENCES magister_modules(id),
  title         TEXT NOT NULL,
  lesson_type   TEXT NOT NULL,              -- 'lecture', 'lab', 'quiz', 'challenge', 'assessment'
  content_json  JSONB NOT NULL,             -- The lesson content, structured for Carina
  order_index   INTEGER NOT NULL,
  estimated_minutes INTEGER DEFAULT 15,
  passing_score INTEGER,                    -- For quizzes/assessments
  max_attempts  INTEGER DEFAULT 3,          -- Max attempts for assessed lessons
  UNIQUE(module_id, order_index)
);
```

### 4.4 Students

```sql
CREATE TABLE magister_students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT UNIQUE,                -- Links to Carina user account, null for anonymous
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  enrolled_at   TIMESTAMPTZ DEFAULT NOW(),
  status        TEXT DEFAULT 'active',      -- active, completed, paused, dropped
  total_xp      INTEGER DEFAULT 0,          -- Gamification: experience points
  current_rank  TEXT DEFAULT 'novice',      -- novice, apprentice, practitioner, expert, master
  last_active   TIMESTAMPTZ,
  metadata      JSONB DEFAULT '{}'
);
```

### 4.5 Enrollments

```sql
CREATE TABLE magister_enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES magister_students(id),
  course_id     UUID NOT NULL REFERENCES magister_courses(id),
  enrolled_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  progress_pct  INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'enrolled',    -- enrolled, in_progress, completed, dropped
  grade         TEXT,                       -- A, B, C, D, F, Pass, Fail
  score         DECIMAL(5,2),               -- 0.00 - 100.00
  UNIQUE(student_id, course_id)
);
```

### 4.6 Assessment Attempts

```sql
CREATE TABLE magister_assessments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES magister_enrollments(id),
  lesson_id     UUID NOT NULL REFERENCES magister_lessons(id),
  attempt_number INTEGER DEFAULT 1,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  submitted_at  TIMESTAMPTZ,
  score         DECIMAL(5,2),
  passed        BOOLEAN,
  answers_json  JSONB,                      -- Student's submitted answers/tool outputs
  feedback_json JSONB,                      -- Carina's feedback: what was right/wrong, why
  graded_by     TEXT DEFAULT 'carina',      -- 'carina' | 'human'
  grade_notes   TEXT                        -- Carina's narrative feedback
);
```

### 4.7 Certificates

```sql
CREATE TABLE magister_certificates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number  TEXT NOT NULL UNIQUE,   -- MG-2026-00001
  enrollment_id       UUID NOT NULL REFERENCES magister_enrollments(id),
  student_id          UUID NOT NULL REFERENCES magister_students(id),
  course_id           UUID NOT NULL REFERENCES magister_courses(id),
  issued_at           TIMESTAMPTZ DEFAULT NOW(),
  grade               TEXT NOT NULL,
  score               DECIMAL(5,2) NOT NULL,
  skills_verified     TEXT[],                -- Specific skills Carina verified
  tools_demonstrated  TEXT[],                -- Which 72 tools the student used successfully
  verification_hash   TEXT NOT NULL,         -- SHA256 hash for online verification
  verification_url    TEXT NOT NULL,         -- labyrinthscout.com/magister/verify/MG-2026-00001
  metadata_json       JSONB DEFAULT '{}'     -- Full assessment data for verification
);
```

### 4.8 Conversation Sessions (teaching context)

```sql
CREATE TABLE magister_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES magister_enrollments(id),
  student_id    UUID NOT NULL REFERENCES magister_students(id),
  lesson_id     UUID REFERENCES magister_lessons(id),
  carina_persona TEXT DEFAULT 'instructor',  -- instructor, coach, assessor, mentor
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  tool_calls    INTEGER DEFAULT 0,           -- How many cyber tools the student ran
  summary       TEXT                         -- Carina's post-session summary
);
```

---

## 5. Carina as Teacher -- The Coaching Engine

This is the core of Magister. Carina is not a chatbot answering questions about a course. She IS the course.

### 5.1 Teaching Personas

Carina switches personas based on the lesson type:

| Persona | When | Behavior |
|---------|------|----------|
| **Instructor** | Lectures | Explains concepts, demonstrates tools, answers questions. Didactic but conversational. |
| **Coach** | Labs | Guides the student through hands-on exercises. "Try running nmap on 127.0.0.1. What ports do you see?" Waits for the student to run the tool. Corrects mistakes. |
| **Assessor** | Quizzes, challenges | Sets the challenge, evaluates the result. "You have 30 minutes. Recon this target. Show me what you found." Grades automatically. |
| **Mentor** | Review, feedback | Reviews what the student learned. "You struggled with SQL injection but your nmap scans were solid. Let me show you what you missed on the web layer." |

### 5.2 Teaching System Prompt

Carina's system prompt is extended for Magister mode:

```
You are Carina, the Magister of Labyrinth Academy. You teach cybersecurity, forensic IT, and AI technology.

Your students learn by DOING, not watching. Every concept is followed by hands-on practice with real tools.

TEACHING RULES:
1. Never give the answer before the student tries. Guide, do not solve.
2. Praise effort and accuracy specifically. "Good catch on port 443 -- that is where the vulnerability is."
3. Correct mistakes constructively. "You used -sV but forgot -p- to scan all ports. Missing ports means missing vulnerabilities."
4. Track what the student struggles with. If they fail SQL injection twice, spend extra time on it.
5. Celebrate when they succeed. "You just completed your first forensic investigation. 4 artifacts recovered. Grade: A."
6. Never be condescending. The student is here to learn. You are here to teach.
7. Keep the student safe. If a command could damage their system, warn them first. This IS production training.

TOOLS YOU HAVE:
- All 72 cyber tools. You can demonstrate any of them.
- Student progress tracking. You know what they have completed, their scores, and their weak areas.
- Assessment engine. You grade lab results, quiz answers, and challenge completions.

The student earns a certificate when they complete the course. Every certificate says "Verified by Carina."
```

### 5.3 Coaching Engine Implementation

Create `src/magister/coaching-engine.ts`:

```typescript
// buildTeachingPrompt(enrollment, lesson) -> string
// Generates Carina's teaching prompt for a specific lesson.
// Includes: student progress, lesson content, teaching persona, assessment criteria.

// evaluateStudentResponse(lesson, studentAction, toolOutput) -> Feedback
// After the student runs a tool or answers a question, evaluate it.
// Returns: { correct: boolean, score: number, feedback: string, nextStep: string }

// getAdaptiveDifficulty(student) -> difficulty
// Analyzes student performance and adjusts lesson difficulty.
// Stronger students get harder challenges. Struggling students get more guidance.

// generateSessionSummary(session) -> string
// After each teaching session, summarize what was learned.
// Includes: concepts covered, tools used, strengths, weaknesses, next lesson recommendation.
```

---

## 6. Course Structure

### 6.1 Course Catalog (Phase 1)

**Course 1: Cybersecurity Foundations (Beginner)**
- Modules: 6, Lessons: 18, Duration: 12 hours
- Tools used: 8 (nmap, amass, theHarvester, nikto, whatweb, gobuster, sqlmap, wireshark)
- Skills: recon basics, vulnerability scanning, web enumeration, traffic analysis
- Assessment: 2 practical labs + 1 final challenge
- Price: Free (top of funnel)

**Course 2: Reconnaissance and OSINT (Intermediate)**
- Modules: 5, Lessons: 15, Duration: 10 hours
- Tools used: 12 (nmap, amass, theHarvester, recon-ng, spiderfoot, sherlock, maltego, dmitry, metagoofil, cewl, whatweb, shodan)
- Skills: passive recon, active recon, OSINT, target profiling
- Assessment: 3 practical challenges + 1 capture-the-flag
- Price: Paid

**Course 3: Vulnerability Assessment and Exploitation (Intermediate)**
- Modules: 6, Lessons: 20, Duration: 16 hours
- Tools used: 18 (nuclei, nikto, wpscan, sqlmap, metasploit, hydra, john, hashcat, crackmapexec, burpsuite, ffuf, dirsearch, feroxbuster, gobuster, arjun, sstimap, impacket, mimikatz)
- Skills: vulnerability scanning, exploitation, password attacks, web application testing
- Assessment: 4 practical challenges + 1 full penetration test
- Price: Paid

**Course 4: Digital Forensics and Incident Response (Advanced)**
- Modules: 5, Lessons: 15, Duration: 12 hours
- Tools used: 16 (autopsy, volatility3, dc3dd, sleuthkit, binwalk, ghidra, bulk-extractor, yara, guymager, rekall, foremost, plasmo, hashdeep, wireshark, tshark, tcpdump)
- Skills: disk forensics, memory forensics, malware analysis, timeline reconstruction
- Assessment: 2 forensic investigations + 1 incident response scenario
- Price: Paid

**Course 5: Red Team Operations (Expert)**
- Modules: 6, Lessons: 18, Duration: 18 hours
- Tools used: 24 (all exploit + wireless + traffic tools)
- Skills: full-chain attacks, C2 operations, lateral movement, exfiltration, evasion
- Assessment: Full red team exercise against a simulated corporate network
- Price: Paid (highest tier)

**Course 6: AI Security and Agent Governance (Expert)**
- Modules: 4, Lessons: 12, Duration: 8 hours
- Skills: prompt injection defense, agent security architecture, Scout deployment, compliance
- Assessment: Security audit of a live AI agent + governance report
- Price: Paid

### 6.2 Lesson Content Format

Each lesson is a structured JSON object that Carina reads and delivers:

```json
{
  "type": "lecture",
  "title": "Introduction to Network Reconnaissance",
  "concepts": ["OSI model", "TCP handshake", "port scanning", "service detection"],
  "narrative": "Carina explains the concept in a conversational manner...",
  "key_points": [
    "Port scanning is the first step in any security assessment",
    "TCP SYN scan (-sS) is stealthier than TCP Connect scan (-sT)",
    "Service version detection (-sV) identifies running software"
  ],
  "demonstration": {
    "tool": "nmap",
    "command": "nmap -sS -sV 192.168.1.1",
    "explanation": "Watch as I scan this target. Notice the open ports..."
  },
  "student_exercise": {
    "instruction": "Run nmap on scanme.nmap.org. Identify all open ports and services.",
    "expected_output": "Ports 22, 80, 443, 9929 open. SSH, HTTP, HTTPS, Nping echo.",
    "evaluation_criteria": ["All 4 ports identified", "Services correctly named", "Scan type appropriate"]
  }
}
```

---

## 7. Assessment and Grading

### 7.1 Assessment Types

| Type | How It Works | Graded By |
|------|-------------|-----------|
| **Quiz** | Multiple choice or short answer. Carina asks questions, student answers in conversation. | Carina (answer key) |
| **Tool Lab** | Student runs a cyber tool. Carina evaluates the output against expected results. | Carina (output comparison + heuristics) |
| **Challenge** | Carina sets up a scenario. "There is a vulnerable service on port 8080. Find and exploit it." Student has free rein. | Carina (goal completion + methodology evaluation) |
| **Capture the Flag** | Multi-step attack/defense scenario. Student must chain multiple tools. | Carina (flag capture + tool chain correctness) |
| **Forensic Investigation** | Carina provides a disk image or memory dump. Student must find artifacts. | Carina (artifact discovery + timeline accuracy) |
| **Final Assessment** | Comprehensive exam covering the entire course. Mix of all types. | Carina (cumulative scoring) |

### 7.2 Grading Logic

Create `src/magister/assessment-engine.ts`:

```typescript
// gradeLabResult(lesson, toolOutput, expectedOutput) -> LabGrade
// Compares student's tool output against expected results.
// Handles: exact matches, partial matches, creative correct answers

// gradeQuizAnswer(lesson, studentAnswer) -> QuizGrade
// Compares against answer key. Supports fuzzy matching for open-ended answers.

// gradeChallenge(lesson, studentActions, finalState) -> ChallengeGrade
// Evaluates: Did they achieve the goal? Was their methodology sound? How efficient?

// calculateCourseGrade(enrollment) -> CourseGrade
// Weighted average of all assessment scores.
// Weights: labs 30%, quizzes 10%, challenges 40%, final 20%

// generateGradeReport(enrollment) -> GradeReport
// Full breakdown: scores per module, strengths, weaknesses, recommendations
```

### 7.3 Grading Scale

| Score | Grade | Meaning |
|-------|-------|---------|
| 90-100 | A | Mastery. Ready for production. |
| 80-89 | B | Proficient. Minor gaps. |
| 70-79 | C | Competent. Needs more practice. |
| 60-69 | D | Basic understanding. Significant gaps. |
| Below 60 | F | Did not meet requirements. Retake recommended. |

---

## 8. Certification

### 8.1 Certificate Design

The certificate is a single-page HTML document, rendered as PDF, with:

- **Header:** Labyrinth Magister logo, "Certificate of Completion"
- **Body:** "Carina, the Magister AI, hereby certifies that [Student Name] has completed [Course Name] with a grade of [Grade] ([Score]%). [Skills verified]. [Tools demonstrated]. This certificate is verifiable at labyrinthscout.com/magister/verify/[Certificate Number]."
- **Footer:** Verification hash (SHA256), issue date, certificate number (MG-2026-00001)

The certificate PDF is generated server-side (puppeteer or similar) and stored. The student can download it from their portal.

### 8.2 Certificate Verification

Public verification page at `labyrinthscout.com/magister/verify/MG-2026-00001`:

- Shows: student name, course, grade, issue date, skills verified, tools demonstrated
- Shows: "Verified by Carina AI" with a green checkmark
- Technical verification: SHA256 hash of the certificate data stored on-chain? Or at minimum, stored in the database and verifiable via API.

### 8.3 Certificate as Scout Marketing

Every certificate includes:
- "This student used Carina and 72 cyber tools to complete their training."
- "Protect your AI agents with Labyrinth Scout. From GBP 49/mo."
- Link to labyrinthscout.com

The certificate IS a Scout ad. Every graduate carries it.

---

## 9. Student Experience

### 9.1 Student Journey

```
1. Land on labyrinthscout.com/magister
2. Browse course catalog
3. Enroll (create account or sign in)
4. Enter student portal at app.carinaai.uk/magister
5. Dashboard shows enrolled courses, progress, XP, rank
6. Click into a course -> see modules and lessons
7. Start a lesson -> Carina conversation begins
8. Carina teaches the concept
9. Carina demonstrates the tool (runs it, shows output)
10. Student runs the tool in the lab (sandboxed terminal)
11. Carina evaluates the output, gives feedback
12. Student progresses through modules
13. Assessments appear at key milestones
14. Final assessment unlocks after all modules complete
15. Carina grades the final assessment
16. Certificate is issued automatically
17. Student downloads certificate, shares it on LinkedIn
```

### 9.2 Student Portal (Next.js)

The student portal at `app.carinaai.uk/magister`:

- **Dashboard:** "Welcome back, [Name]." Courses in progress. Completion percentages. XP bar. Rank badge. Upcoming assessments.
- **Course View:** Module list with completion checkmarks. Current lesson highlighted. "Continue where you left off" button.
- **Lesson View:** Chat interface with Carina. Left panel: lesson content. Right panel: Carina conversation + terminal. Student types commands, Carina responds.
- **Lab Terminal:** Embedded xterm.js terminal. Sandboxed. Pre-configured with the tools needed for the lesson.
- **Assessment View:** Carina presents the challenge. Timer (if timed). Student works. Carina grades when submitted.
- **Certificate View:** Certificate preview, download PDF button, share button.

### 9.3 Gamification

- **XP (Experience Points):** Earned for completing lessons, passing assessments, running tools correctly
- **Ranks:** Novice (0 XP) -> Apprentice (500) -> Practitioner (2000) -> Expert (5000) -> Master (10000)
- **Achievements:** Badges for milestones: "First Scan," "Shell Obtained," "Forensic Investigator," "Red Team Operator"
- **Streaks:** Days active. Consecutive days of learning.

---

## 10. Admin Experience

### 10.1 Admin Panel

At `ops.carinaai.uk/magister`:

- **Course Management:** Create, edit, publish, archive courses. Add modules and lessons. Configure assessments.
- **Student Management:** View all students. Progress per student. Grades. Certificates issued.
- **Assessment Review:** Spot-check Carina's grading. Override grades if needed.
- **Certificate Management:** Issue certificates manually. Revoke. View verification logs.
- **Analytics:** Enrollment numbers. Completion rates. Average scores. Most popular courses. Drop-off points.
- **Content Editor:** Edit lesson content JSON. Preview how Carina will deliver it.

### 10.2 Carina Admin Commands

```bash
carina magister course create     # Interactive course creation
carina magister course publish    # Publish a course
carina magister student list      # List all students
carina magister student show      # Show student progress
carina magister certificate issue # Manually issue a certificate
carina magister certificate revoke # Revoke a certificate
carina magister analytics         # Show dashboard stats
```

---

## 11. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Deliverable:** Database schema, Carina coaching engine, one course, basic student portal.

- Database migration (all tables)
- Magister types, store, coaching engine
- Course 1 content (Cybersecurity Foundations -- free)
- Basic student portal: dashboard, course list, course view
- Carina teaching system prompt
- Assessment engine (quiz + lab grading)
- `carina magister` CLI commands

**Agent:** Claude Code
**Estimated:** 2 prompts, 4-5 days

### Phase 2: Student Experience (Week 3-4)

**Deliverable:** Full student portal, lab terminal, certification.

- Lab terminal (xterm.js embedded in Next.js)
- Sandboxed tool execution for students
- Full student portal UI: lesson view, assessment view, progress tracking
- Certificate generation (HTML -> PDF)
- Certificate verification page
- Gamification: XP, ranks, achievements, streaks

**Agent:** Cursor (Next.js) + Claude Code (backend)
**Estimated:** 3 prompts, 6-8 days

### Phase 3: Additional Courses (Week 5-6)

**Deliverable:** Courses 2-4 content, admin panel.

- Course 2: Reconnaissance and OSINT
- Course 3: Vulnerability Assessment and Exploitation
- Course 4: Digital Forensics
- Admin panel: course management, student management, analytics
- Payment integration (Stripe) for paid courses

**Agent:** Claude Code (content) + Cursor (admin UI)
**Estimated:** 4 prompts, 5-7 days

### Phase 4: Advanced and Launch (Week 7-8)

**Deliverable:** Courses 5-6, public site, launch.

- Course 5: Red Team Operations
- Course 6: AI Security and Agent Governance
- Public landing page at labyrinthscout.com/magister
- Marketing: course catalog, pricing, testimonials (from beta students)
- SEO optimization for course pages
- Launch: free course available, paid courses with early-bird pricing

**Agent:** Claude Code (content) + Cursor (landing page)
**Estimated:** 3 prompts, 4-5 days

**Total estimated: 8 weeks to full launch.**

---

## 12. Revenue Model

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | GBP 0 | Course 1 (Cybersecurity Foundations) + 8 tools + certificate |
| **Magister Pro** | GBP 29/mo | All courses + all 72 tools + advanced certificates + priority grading |
| **Magister Team** | GBP 99/mo (up to 5 seats) | Everything + team progress dashboard + admin controls |
| **Enterprise** | Quote | Custom courses, private instance, SSO, white-label certificates |

**Conversion path:**
1. Free Course 1 gets students in the door
2. To continue to Courses 2-6, they subscribe to Magister Pro
3. Teams that train together use Magister Team
4. Enterprises that want private training instances go Enterprise

**Scout integration:** Every Magister Pro+ subscription includes a Scout Monitor trial. Students learn with Scout running. They see what it catches. They buy it for production.

---

## 13. Success Metrics

| Metric | Target (Month 3) | Target (Month 6) |
|--------|------------------|-------------------|
| Free course enrollments | 500 | 2,000 |
| Paid subscribers (Pro) | 50 | 200 |
| Paid subscribers (Team) | 5 | 25 |
| Course completion rate | 40% | 50% |
| Certificate shares on LinkedIn | 100 | 500 |
| Scout trial conversions | 10% | 15% |
| Monthly recurring revenue | GBP 1,450 | GBP 8,975 |
| NPS score | 60+ | 60+ |

---

## Reference Files

- `core.carinaai.uk/src/tools/cyber/index.ts` -- 72 cyber tools index (all exist)
- `core.carinaai.uk/src/tools/cyber/factory.ts` -- factory pattern for tool creation
- `app.carinaai.uk/` -- Next.js student portal base
- `ops.carinaai.uk/` -- Express/EJS admin panel base
- `instructions/product/LABYRINTH_SCOUT_OVERVIEW.md` -- Scout product context
- `instructions/prompts/the_Ultimate_Carina_Upgrade/gap-10-incident-blog/README.md` -- Incident blog context (flywheel partner)
