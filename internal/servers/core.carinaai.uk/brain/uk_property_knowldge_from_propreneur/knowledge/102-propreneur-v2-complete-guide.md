# Propreneur v2: The Complete User Guide

## The Official Bible for Professional Property Entrepreneurs

---

*This book covers every feature, every page, every button, and every workflow in Propreneur v2. From your first login to advanced deal packaging, compliance management, Carina AI assistance, and portfolio oversight - nothing is left out.*

---

# Part 1: Welcome to Propreneur

## 1.1 What is Propreneur?

Propreneur is an all-in-one operating system for property professionals. It replaces a dozen separate tools - spreadsheets, CRM, accounting software, compliance trackers, calculators, booking systems, learning management, and more - with a single, integrated platform. Everything in Propreneur talks to everything else. Your deals talk to your calculators. Your calculators talk to your Carina AI. Your Carina AI talks to your CRM. Your CRM talks to your compliance. Your compliance talks to your pipeline.

Think of Propreneur as the cockpit of your property business. Every instrument, every gauge, every control is on one dashboard.

## 1.2 Editions: Community vs Enterprise

Propreneur ships in two editions, each with a different feature set:

| Feature Area | Community Edition (CE) | Enterprise Edition (BE) |
|-------------|----------------------|----------------------|
| Deals & Calculators | Basic calculators | Full calculator suite (21 calculators) |
| CRM | Limited contacts | Full CRM with inbox, threads, automation |
| Pipeline | Basic pipeline | Pipeline with stage automations, presets |
| Compliance | - | Full AML, ICO, CDD, complaints, regulatory |
| Carina AI | Limited | Full Carina with agentic tools |
| Mentoring OS | - | Full mentorship platform |
| viCal (Bookings) | - | Full booking engine |
| Accounting | - | Full expense, invoices, bank reconciliation |
| Lead Funnel | - | Ad ingestion, qualification, speed-to-lead |
| Staff & Payroll | - | Full HR and payroll |
| Integrations | - | PropertyData API, TrueLayer, webhooks |

The edition is set when your workspace is created. You can upgrade or downgrade at any time through billing settings.

## 1.3 Architecture Overview

Propreneur is a multi-tenant system. Every workspace (tenant) gets its own isolated PostgreSQL database. Your data never mixes with another company's data.

The system has two layers:

1. **Central (Platform)** - manages tenants, subscriptions, platform users, feature flags, and global settings. Only Propreneur staff (platform admin) can access this.

2. **Tenant (Workspace)** - your company's private space. This is what you use every day. Contains your properties, deals, contacts, compliance, and everything else.

When you log in at a workspace URL (e.g. `xelox.propreneur.test:8000`), you are routed to your tenant's database automatically.

## 1.4 Your First Login

When you receive an invitation to join a Propreneur workspace:

1. **Check your email** for the invitation link
2. **Click the link** - it opens the invitation acceptance page
3. **Set your password** - choose a strong password (at least 8 characters, mixed case, numbers, special characters)
4. **Enable two-factor authentication** (recommended) - scan the QR code with an authenticator app (Google Authenticator, Authy, or similar)
5. **Log in** for the first time at `{workspace}.propreneur.test:8000/login`

If you forgot your password, click "Forgot Password" on the login page. A reset link will be emailed to you.

## 1.5 Two-Factor Authentication (2FA)

Propreneur supports TOTP-based two-factor authentication:

1. Go to your **Profile > Security Settings**
2. Click **Enable 2FA**
3. Scan the QR code with your authenticator app
4. Enter the 6-digit code from your app to confirm
5. Save your recovery codes in a safe place (you'll need them if you lose your phone)

Each time you log in after enabling 2FA, you'll enter your password then the 6-digit code from your authenticator app.

## 1.6 The Onboarding Wizard

Your first login takes you through a **5-step workspace setup wizard**. This is your foundation - the answers you give here set up your entire Propreneur experience.

### Step 1: Workspace Name

Enter your business name. This is the display name that appears in the top bar and in emails sent from the system.

### Step 2: Investment Strategy

Tell Propreneur what kind of property investor you are:

**Primary Strategy (choose one):**
- **Buy-to-Let (BTL)** - Buy and rent to long-term tenants. Steady monthly income and capital growth.
- **HMO** - Rent room-by-room to multiple tenants. Higher yields; requires HMO licence for 5+ occupants.
- **BRR (Buy, Refurb, Refinance)** - Buy below market, refurbish, refinance to recycle your deposit into the next deal.
- **R2R (Refurb-to-Rent)** - Lease from a landlord, sublet at a higher rate. Low capital entry.
- **Serviced Accommodation (SA)** - Short-let furnished via Airbnb or Booking.com. Highest gross revenue.
- **Flip** - Buy below market, refurbish, sell at a profit. Pure capital gain.
- **Commercial** - Offices, retail, industrial. Longer leases, different yield dynamics.

**Target Postcodes:** Enter the postcode areas you want to invest in (one per line). Propreneur uses these to filter deals and sourcing alerts.

**Experience Level:**
- Getting started - looking at your first investment
- Growing - 1-3 properties, want to scale efficiently
- Experienced - 4+ properties or professional investor

**Capital Range:**
- Under £50k
- £50k - £150k
- £150k - £500k
- £500k+

**Secondary Strategies:** You can select additional strategies you're interested in. Carina will factor these into her recommendations.

### Step 3: Your Profile

Enter your name and phone number. This is used for account recovery, notifications, and CRM identification.

### Step 4: Timezone

Set your timezone. This affects scheduling (viCal bookings), reminder emails, and reporting dates.

### Step 5: Review & Launch

Review everything. When you click **Launch**, Propreneur:

1. Saves your primary strategy as the workspace default
2. Creates your first **sourcing criterion** (a deal-finding rule based on your primary strategy)
3. Saves your timezone and display name
4. Unlocks the full workspace
5. Takes you to your **Dashboard**

**Can't finish now?** Click "Skip setup for now." The wizard saves what you entered, and you can resume later from **Settings > Onboarding**.

---

# Part 2: The Dashboard & Navigation

## 2.1 The Dashboard (Command Centre)

After onboarding, you land on the **Dashboard** (`/dashboard`). This is your command centre. From here you can see the health of your entire property business at a glance.

### Dashboard Cards

The top row shows key metrics:

- **Properties** - total number of properties in your portfolio
- **Deals** - total number of deals in your system
- **Contacts** - total people in your CRM
- **Compliance Expiring** - number of compliance items expiring within 30 days (in red if any exist)
- **Pipeline Cards** - total deals in your pipeline (visible if Pipeline module is active)

### Financial Snapshot

Quick-view of your portfolio finances:

- **Total Property Value** - sum of all property market values
- **Total Debt** - sum of all mortgage balances
- **Equity** - total value minus total debt
- **Monthly Cashflow** - sum of all property monthly cashflows

### Recent Activity

- **Recent Properties** - the last 5 properties you added or updated
- **Recent Deals** - the last 5 deals you analysed, with links to each

### Pipeline Preview

If the Pipeline module is active, you'll see the 5 most recently updated pipeline deals, showing which stage they're in.

### Navigation Sidebar

On the left side of the screen is the main navigation sidebar. The items shown depend on your subscription plan and which modules are active. The standard navigation structure is:

```
 Dashboard
 Properties
 Deals
  ├── Deals Workspace
  ├── Source Deals
  ├── Calculators
  ├── Strategy Finder
  ├── Due Diligence
  ├── Market Intelligence
  ├── Deal Tasks
  ├── Deal Shortlists
  └── Deal Shares
 Pipeline
 Contacts / CRM
  ├── CRM Dashboard
  ├── Contacts
  ├── Inbox
  ├── Lead Funnel
  └── Qualification Forms
 Compliance
  ├── Overview
  ├── AML
  ├── Complaints
  ├── Regulatory Profile
  └── Requirements
 Communications
  ├── Sequences
  ├── Email Templates
  └── Inbox
 Bookings (viCal)
  ├── Calendar
  ├── Event Types
  ├── Intake Pools
  └── Group Events
 Mentoring OS
  ├── Mentor Hub
  ├── Mentees
  ├── Packages
  ├── LMS
  └── Community
 Accounting
  ├── Dashboard
  ├── Expenses
  ├── Invoices
  ├── Receipts
  ├── Bank Reconciliation
  └── Integrations
 Portfolio
  ├── Properties
  ├── Tenancies
  ├── Assets
  ├── Maintenance
  ├── Refurb Projects
  └── Works Orders
 Staff (HR)
  ├── Team Hub
  ├── Leave
  └── Payroll
 Reporting
  ├── Reports
  └── Analytics
 Settings
  ├── Workspace
  ├── Team
  ├── AI Settings
  ├── Integrations
  ├── Automation
  ├── Communications
  ├── Branding
  ├── Localization
  ├── Audit Logs
  └── Subscriptions
```

## 2.2 Top Bar

Across the top of every page:

- **Workspace name** (left side)
- **Global Search** (centre) - type to search across properties, deals, contacts, and more
- **Notifications Bell** - shows unread notification count; click to view in-app notifications
- **User Menu** (right side) - click your avatar/name for:
  - Profile settings
  - Two-factor settings
  - Language selector
  - Log out

## 2.3 Global Search

The search bar in the top bar searches across all major entity types in your workspace. Start typing and you'll see results grouped by type:

- Properties (by address, postcode)
- Deals (by name, property address)
- Contacts (by name, email)
- Pipeline deals (by name)
- Compliance items (by name)

Click any result to navigate directly to that record.

## 2.4 Notifications

The bell icon in the top bar shows unread notifications. These include:

- Compliance items expiring soon
- Deal task reminders
- Team invitations
- Booking confirmations and reminders
- Lead funnel alerts
- Mentorship messages

Click a notification to view it. Click "Mark all as read" to clear them. Each notification can be individually marked read.

---

# Part 3: The Deal Engine

The Deal Engine is the heart of Propreneur. It covers everything from finding a property to analysing, due diligence, packaging, and closing the deal.

## 3.1 Deals Workspace

**Where:** Deals > Deals Workspace (menu item)

The Deals Workspace is your central hub for all deal activity. It shows a list of every deal you've created, with key information at a glance:

- **Deal name/address** - click to open the full deal view
- **Property** - linked property record
- **Strategy** - which investment strategy this deal is for
- **Status** - draft, in analysis, qualified, under offer, won, lost
- **Created date**
- **Actions** - edit, delete, view

### Creating a New Deal

1. Click **Add New Deal**
2. Enter the property address (or search for an existing property)
3. Select the strategy (BTL, HMO, BRR, etc.)
4. Enter purchase details (price, refurb costs, stamp duty, legal fees)
5. Click **Save**

The deal is created in "Draft" status. From here you can run calculators, perform due diligence, and move it through the pipeline.

### Deal Detail View

Click a deal to open the full detail view. This page is organised into tabs:

- **Overview** - key numbers at a glance (purchase price, market value, strategy, ROI)
- **Analysis** - run calculators and see results
- **Property** - linked property details
- **Documents** - acquisition documents, compliance paperwork
- **Tasks** - deal-specific to-do items
- **Timeline** - history of changes and actions on this deal
- **Pack** - generate and view deal packs

## 3.2 Sourcing Deals

**Where:** Deals > Source Deals

This is where you find and import property deals from external sources.

### Manual Search

**Where:** Source Deals > Manual Search

Enter a postcode or area to search for properties. Results pull from:
- Rightmove listings (via the browser extension)
- Zoopla listings (via the browser extension)
- Your saved sourcing criteria (automatic matches)

### Sourcing Criteria

**Where:** Source Deals > Sourcing Criteria

Create rules that automatically find deals matching your requirements:

1. Click **Add Criteria**
2. Name your criterion (e.g. "2-bed BTL in Birmingham")
3. Select the strategy
4. Enter target postcodes
5. Set filters (min/max price, property type, bedrooms)
6. Toggle active/inactive

When active, Propreneur scans incoming listings against your criteria and alerts you when a match is found.

### Listing Sources

**Where:** Source Deals > Listing Sources

Configure where Propreneur pulls property listings from:

- **RSS Feeds** - add Rightmove and Zoopla RSS feed URLs
- **Browser Extension** - install the Propreneur browser extension to capture listings from any website
- **CSV Import** - import listings from a CSV file
- **Licensed Feeds** - paid data feeds from property data providers

### Browser Extension

The Propreneur browser extension (available for Chrome) lets you capture property listings from any website:

1. Install the extension from the Chrome Web Store
2. Browse property listings on Rightmove, Zoopla, OnTheMarket, etc.
3. Click the Propreneur extension icon
4. The listing is captured and imported into your Deals Workspace
5. The extension captures: address, price, bedrooms, photos, description, agent, listing URL

### Listing Automation

**Where:** Source Deals > Listing Automation

Set up automated watchers that check listing sources on a schedule:

1. Click **Add Watcher**
2. Name your watcher
3. Select the source type (RSS, CSV, etc.)
4. Set the check frequency (hourly, daily, weekly)
5. Toggle active/inactive

### Sourcing Inbox

**Where:** Source Deals > Sourcing Inbox

All incoming deals - whether from manual entry, browser extension, automated feeds, or CSV imports - land in the Sourcing Inbox. From here you can:

- **Review** each deal before it enters your workspace
- **Approve** - move to the Deals Workspace
- **Reject** - discard with a reason
- **Flag** - mark for later review
- **Match** - see which sourcing criteria this deal satisfies

### Sourcing Research Links

**Where:** Source Deals > Research Links

Save links to external research (Rightmove listings, Zoopla pages, Google Maps, council planning portals, etc.) and attach them to deals or properties for later reference.

### Deal Shortlists

**Where:** Deals > Deal Shortlists

Create shortlists to group deals for specific purposes:

1. Click **Create Shortlist**
2. Name it (e.g. "Properties to View This Week", "Send to Investor John")
3. Drag deals from the workspace into the shortlist
4. Add notes per deal
5. Share the shortlist as a link or export as CSV

Shortlists are perfect for:
- Preparing for property viewing days
- Sharing deal opportunities with investors
- Comparing multiple similar deals side by side

## 3.3 Deal Calculators

**Where:** Deals > Calculators

This is the engine room. Twenty-one calculators let you analyse any property deal from every possible angle.

### Calculator Overview Page

The calculators index page shows all available calculators as cards. Each card shows:
- **Calculator name** (BTL, HMO, BRR, etc.)
- **Brief description** of what it does
- **Run button** - click to open

You can also use the **Calculator Playground** - a sandbox where you can input any numbers and run any calculator without saving a deal first.

### The 21 Calculators Explained

#### 1. Buy-to-Let (BTL) Calculator

**Purpose:** Standard BTL investment analysis

**Inputs needed:**
- Purchase price
- Mortgage amount and interest rate
- Monthly rent
- Running costs (management fees, repairs, insurance, void periods)
- Purchase costs (SDLT, legal, survey)

**Outputs:**
- Gross yield (%)
- Net yield (%)
- Monthly cashflow
- Annual ROI
- Cash-on-cash return
- Mortgage cover ratio

**How to use:**
1. Enter the property purchase price
2. Enter your mortgage details (loan amount, term, rate)
3. Enter the expected monthly rent
4. Enter running costs (or use defaults based on property type)
5. Click **Calculate**
6. Review the results - green numbers are good, red numbers need attention

#### 2. BRR (Buy, Refurb, Refinance) Calculator

**Purpose:** Analyse BRR deals and calculate deposit recycling

**Inputs needed:**
- Purchase price
- Refurb costs
- Refinance valuation (expected post-refurb value)
- Refinance LTV percentage
- Purchase and refurb finance costs

**Outputs:**
- Total capital invested
- Amount returned after refinance
- Deposit recycling percentage
- Money left in the deal
- ROI
- Monthly cashflow after refinance

**How to use:**
1. Enter the below-market purchase price
2. Enter your refurbishment budget
3. Enter the expected market value after refurbishment
4. Enter the refinance LTV (typically 75%)
5. Click **Calculate**
6. Key number: "Money left in deal" - if this is zero or negative, you've fully recycled your deposit

#### 3. HMO (House in Multiple Occupation) Calculator

**Purpose:** Analyse HMO property yields

**Inputs needed:**
- Purchase price
- Number of bedrooms
- Rent per room
- HMO licence costs
- Running costs (utilities, council tax, management, cleaning, repairs)

**Outputs:**
- Gross HMO yield
- Net HMO yield
- Total monthly rent
- Monthly cashflow
- Per-room profitability
- Breakeven occupancy rate

**How to use:**
1. Enter the purchase price
2. Enter the number of rooms and rent per room
3. Enter HMO-specific costs (licence fees, fire safety upgrades)
4. Enter running costs per room
5. Click **Calculate**
6. Check the breakeven occupancy - how many rooms need to be full to break even

#### 4. Flip Calculator

**Purpose:** Analyse buy-refurb-sell profit

**Inputs needed:**
- Purchase price
- Refurbishment budget
- SDLT and purchase costs
- Holding costs (mortgage payments, insurance, utilities during refurb)
- Selling costs (estate agent, legal, EPC)
- Expected selling price

**Outputs:**
- Gross profit
- Net profit (after all costs)
- ROI percentage
- Profit per month (if you enter the expected timeline)

**How to use:**
1. Enter the purchase price
2. Enter the refurb budget
3. Enter all holding and selling costs
4. Enter your target selling price
5. Click **Calculate**
6. If the net profit is less than 15-20% of total costs, the deal may be tight

#### 5. Serviced Accommodation (SA) Calculator

**Purpose:** Analyse short-let Airbnb/Booking.com property

**Inputs needed:**
- Purchase price
- Nightly rate
- Occupancy rate (percentage)
- Management costs (cleaning, Airbnb fees, utilities, supplies)
- Mortgage costs

**Outputs:**
- Gross annual revenue
- Net annual profit
- ROI
- Revenue per available room (RevPAR)
- Occupancy breakeven point

**How to use:**
1. Enter the purchase price
2. Enter your expected nightly rate
3. Enter your expected occupancy rate (start conservatively - 60-70%)
4. Enter management costs
5. Click **Calculate**
6. Compare SA vs BTL results for the same property

#### 6. SA vs BTL Comparison Calculator

**Purpose:** Side-by-side comparison of SA vs BTL for the same property

This is unique - it compares both strategies on the same property and tells you which delivers better returns.

**Inputs needed:**
- All standard BTL inputs
- All standard SA inputs

**Outputs:**
- Side-by-side comparison table (BTL vs SA)
- Which strategy wins (by ROI, cashflow, risk)
- Recommendation with reasoning

**How to use:**
1. Enter all BTL inputs
2. Enter all SA inputs
3. Click **Calculate**
4. The calculator shows a comparison table and recommends the best strategy for this property

#### 7. BMV No-Money-Down Calculator

**Purpose:** Analyse below-market-value deals that require zero cash investment

**Inputs needed:**
- Market value
- Purchase price (below market)
- Remortgage LTV
- All fees (bridging, legal, valuation, SDLT)
- Whether it's an additional property

**Outputs:**
- Total cash needed
- Maximum remortgage amount
- Cash surplus/required
- Whether the deal is viable as no-money-down
- ROI projections

**How to use:**
1. Enter the market value and your below-market purchase price
2. Enter the remortgage LTV (75% standard)
3. Enter all fees
4. Click **Calculate**
5. If "cash required" is zero or negative, the deal funds itself via refinance

#### 8. Development Calculator

**Purpose:** Assess development project viability

**Inputs needed:**
- Site/land purchase price
- Development costs (build, professional fees, contingency)
- Expected GDV (Gross Development Value)
- Timeline and finance costs
- Planning costs

**Outputs:**
- Gross Development Profit
- Profit on cost percentage
- Profit on GDV percentage
- Development yield
- Sensitivity analysis (what if costs rise or values fall)

**How to use:**
1. Enter the land/site purchase price
2. Enter all development costs itemised
3. Enter the expected Gross Development Value
4. Set the timeline
5. Click **Calculate**
6. Review the sensitivity analysis to understand risk

#### 9. Commercial Calculator

**Purpose:** Analyse commercial property investments

**Inputs needed:**
- Purchase price
- Annual rent (ERV or passing rent)
- Rent review pattern
- Lease length
- Running costs (business rates, service charge, insurance)
- Purchase costs

**Outputs:**
- Net initial yield
- Reversionary yield
- All-risk yield
- Equivalent yield
- Net annual income
- Capital value projections

**How to use:**
1. Enter the purchase price
2. Enter the annual rent
3. Enter lease terms
4. Click **Calculate**
5. Compare yields to market benchmarks

#### 10. Bridging Calculator

**Purpose:** Calculate short-term finance costs

**Inputs needed:**
- Loan amount
- Interest rate (monthly)
- Loan term (months)
- Arrangement fee
- Legal and valuation fees
- Exit fee

**Outputs:**
- Total interest payable
- Total fees
- Total cost of bridging
- Monthly cost
- Effective APR

**How to use:**
1. Enter the loan amount
2. Enter the monthly interest rate (typically 0.5-1.5%)
3. Enter the term
4. Click **Calculate**
5. Total cost helps you decide if the deal can support the finance

#### 11. R2R (Refurb-to-Rent) Calculator

**Purpose:** Analyse lease-option / rent-to-rent deals

**Inputs needed:**
- Rent payable to landlord
- Rent receivable from tenants
- Management costs
- Void allowance
- Deposit and setup costs

**Outputs:**
- Monthly profit
- Annual profit
- Annual ROI on capital invested
- Breakeven occupancy

#### 12. DSCR (Debt Service Coverage Ratio) Calculator

**Purpose:** Check if a property's income covers its mortgage payments

**Inputs:**
- Monthly rental income
- Monthly mortgage payment
- Monthly expenses

**Outputs:**
- DSCR ratio (income ÷ total debt payments)
- Lender minimum (typically 1.25)
- Pass/fail

#### 13. LTV (Loan-to-Value) Calculator

**Purpose:** Quick LTV calculation

**Inputs:**
- Loan amount
- Property value

**Outputs:**
- LTV percentage

#### 14. Mortgage Calculator

**Purpose:** Standard mortgage repayment calculation

**Inputs:**
- Loan amount
- Interest rate
- Term (years)
- Repayment or interest-only

**Outputs:**
- Monthly payment
- Total interest paid over term
- Total cost

#### 15. SDLT (Stamp Duty Land Tax) Calculator

**Purpose:** Calculate Stamp Duty for any purchase scenario

**Inputs:**
- Purchase price
- First-time buyer?
- Additional property?
- Commercial/residential

**Outputs:**
- SDLT amount
- Breakdown by band

**How to use:**
1. Enter the purchase price
2. Answer the questions about your situation
3. Click **Calculate**
4. The result updates instantly as you change inputs

#### 16. NPV/IRR Calculator

**Purpose:** Net Present Value and Internal Rate of Return analysis

**Inputs:**
- Initial investment
- Projected cashflows (period by period)
- Discount rate

**Outputs:**
- NPV
- IRR
- Payback period

#### 17. CoC/ROE Calculator

**Purpose:** Cash-on-Cash Return and Return on Equity

**Inputs:**
- Annual pre-tax cashflow
- Total cash invested

**Outputs:**
- Cash-on-cash return percentage
- Return on equity percentage

#### 18. Income Multiples Calculator

**Purpose:** Quick mortgage affordability check

**Inputs:**
- Your annual income
- Lender multiple (typically 4-5x)

**Outputs:**
- Maximum mortgage amount

#### 19. Breakeven Occupancy Calculator

**Purpose:** For HMO and SA - how full does it need to be to break even?

**Inputs:**
- Total monthly costs
- Income per unit/room

**Outputs:**
- Number of units needed to break even
- Percentage occupancy needed

#### 20. Refurb Calculator

**Purpose:** Estimate refurbishment costs using the Refurb Catalogue

**Inputs:**
- Select items from the Refurb Catalogue (kitchen, bathroom, flooring, windows, etc.)
- Enter quantities and quality levels

**Outputs:**
- Total refurb cost
- Breakdown by room/category
- Comparison to market averages

**How to use:**
1. Open the Refurb Calculator
2. Browse the Refurb Catalogue (165+ items with pre-configured costs)
3. Select items you need for your property
4. Adjust quantities as needed
5. Click **Calculate**
6. The total feeds directly into your deal analysis

*This calculator also has a Carina shortcut: ask Carina "What would it cost to refurb a 3-bed house?" and she'll pull from the catalogue and give you an estimate.*

## 3.4 Strategy Finder

**Where:** Deals > Strategy Finder

The Strategy Finder is like having a property expert tell you the best strategy for any property.

**How it works:**

1. Enter a property address (or existing deal ID)
2. The system pulls property data (type, location, value, etc.)
3. It runs ALL relevant calculators against the property
4. It compares results and recommends the BEST strategy

**What you get:**

- **Recommended Strategy** - the single best strategy for this property
- **Comparison Table** - all strategies ranked by ROI
- **Key Metrics** - for each strategy (ROI, cashflow, risk level, capital required)
- **Carina Summary** - Carina explains WHY this is the best strategy in plain English

**How to use:**

1. Navigate to Deals > Strategy Finder
2. Enter the property address or select an existing deal
3. Click **Run Analysis**
4. Review the results
5. If you like a recommendation, click **Save** to create a deal with that strategy applied
6. Carina will appear with additional context and advice

## 3.5 Due Diligence Hub

**Where:** Deals > Due Diligence

Before committing to a deal, you need to know everything about the property and area. The Due Diligence Hub brings all property intelligence together in one place.

### What it shows for any property:

**Property Data (via API)**
- Property type, age, construction
- Current valuation
- EPC rating and certificate
- Council tax band
- Planning history
- Flood risk
- Ulez/clean air zone status
- Broadband availability
- Mobile signal strength

**Area Data**
- Local school ratings (Ofsted)
- Crime statistics
- Average house prices (by property type)
- Rental yields for the area
- Population demographics
- Employment rates
- Amenities (transport, shops, hospitals)

**Comparable Sales**
- Recently sold properties in the area
- Similar property prices
- Price trends (1 month, 3 month, 12 month)
- Time to sell

**EPC Data**
- Current EPC rating
- Estimated energy costs
- Recommended improvements
- Cost of improvements
- Potential rating after improvements

**How to use:**

1. Navigate to Due Diligence Hub
2. Enter a postcode or property address
3. Click **Fetch Data**
4. Propreneur queries PropertyData API, EPC Open Data, and other sources
5. A full due diligence report is generated
6. Review each section - you can also add manual notes

**Saving Snapshots:**

You can save a due diligence snapshot for any property. This freezes the data at that point in time, so you have a permanent record. Snapshots are stored in the property's timeline and can be exported as PDF.

## 3.6 Market Intelligence Hub

**Where:** Deals > Market Intelligence

The Market Intelligence Hub gives you area-level market research without leaving Propreneur.

**Tools available:**

- **Area Comparison** - compare up to 5 postcode areas side by side
- **Rental Yield Map** - see average yields by area
- **Price Trend Analysis** - how prices are moving in target areas
- **Demand Indicators** - days on market, listing volumes, price reductions
- **Investment Hotspots** - areas with the best combination of yield, growth, and affordability

**How to use:**

1. Enter a postcode or area name
2. Select the tool you want to use
3. Review the data displayed as charts, maps, and tables
4. Export any report as PDF for sharing

## 3.7 Deal Tasks

**Where:** Deals > Deal Tasks

Keep track of everything you need to do for each deal. This is your per-deal to-do list.

**How to use:**

1. Navigate to Deal Tasks
2. Click **Add Task**
3. Enter: title, description, due date, priority (low/medium/high/urgent)
4. Select the deal the task belongs to (or leave blank for general tasks)
5. Click **Save**

Tasks appear on the dashboard when they're overdue. You can:
- Mark as complete with one click
- Edit task details
- Filter by deal, priority, or status
- Set reminders for upcoming tasks

## 3.8 Deal Offers

**Where:** Deals > (Individual Deal) > Offers tab

Track offers you make and receive on deals:

1. Open a deal
2. Go to the **Offers** tab
3. Click **Add Offer**
4. Enter: offer amount, type (your offer / received offer), date, status (draft, submitted, accepted, rejected, countered)
5. Click **Save**

The system tracks offer history so you can see the negotiation timeline for any deal.

## 3.9 Deal Monetisation

**Where:** Deals > Deal Monetisation

Track commissions, fees, and revenue generated from each deal:

1. Navigate to Deal Monetisation
2. Click **Add Record**
3. Select the deal
4. Enter: fee type (introduction fee, sourcing fee, management fee, commission), amount, date received/expected
5. Click **Save**

The monetisation dashboard shows total fees earned, pending payments, and commission pipelines.

## 3.10 Rental Comparables

**Where:** Deals > (Individual Deal) > Comparables tab

Build a comparable rental analysis for any property:

1. Open a deal
2. Go to the **Comparables** tab
3. Click **Add Comparable**
4. Enter similar property details (address, rent, bedrooms, condition)
5. Click **Save**

Over time, your comparables database builds up, giving you a data advantage when pricing your own deals.

## 3.11 Deal Pack Generator

**Where:** Deals > (Individual Deal) > Pack tab

Generate professional deal packs to share with investors, lenders, or partners.

**What a deal pack includes:**

- **Executive Summary** - key numbers at a glance
- **Property Details** - address, type, bedrooms, tenure
- **Financial Analysis** - full calculator results (whichever calculator you ran)
- **Comparables** - your rental/comparable data
- **Due Diligence** - EPC, area data, valuation
- **Photos** - from the listing or property
- **Carina Commentary** - Carina's assessment of the deal

**How to use:**

1. Open a deal that has been fully analysed
2. Go to the **Pack** tab
3. Click **Generate Deal Pack**
4. Propreneur compiles all the deal data into a clean PDF
5. Download or share directly from the system

You can also configure your deal pack settings (logo, colours, company info) in **Settings > Deal Pack** to brand your packs.

**Carina shortcut:** Ask Carina "Generate a pack for this deal" and she'll create one on the spot.

---

# Part 4: Properties & Portfolio

## 4.1 Properties Overview

**Where:** Properties (main menu)

The Properties section is your property database. Every property you own, manage, or have analysed lives here.

### Properties List

Shows all properties with:
- Address
- Type (house, flat, commercial, land)
- Status (owned, under offer, analysing, sold)
- Current value
- Mortgage balance
- Monthly cashflow
- EPC rating
- Link to the deal (if applicable)

### Adding a Property

1. Click **Add Property**
2. Enter the address (postcode lookup available)
3. Enter property details:
   - Type (detached, semi-detached, terrace, flat, commercial, land)
   - Bedrooms, bathrooms, reception rooms
   - Tenure (freehold, leasehold)
   - Year built
   - Current value and purchase price
   - Mortgage details (lender, amount, rate, term)
4. Click **Save**

A property can be linked to multiple deals (different strategies analysed) but can only be "owned" once.

### Property Detail View

Click a property to see the full view, organised into tabs:

- **Overview** - key data, value, mortgage, cashflow
- **Tenancies** - current tenants and tenancy agreements
- **Documents** - EPC, gas safety, electrical, tenancy agreements, insurance
- **Commercial Lease** - for commercial properties
- **SA Performance** - serviced accommodation performance metrics
- **Assets** - furniture, appliances, fixtures inventory
- **Maintenance** - maintenance history and upcoming works
- **Refurb Projects** - past and current refurbishment work
- **Deals** - deals linked to this property
- **Timeline** - all activity on this property

## 4.2 Property Documents

**Where:** Properties > (Property) > Documents tab

Upload and manage all documents for a property:

**Supported document types:**
- EPC certificates
- Gas safety certificates
- Electrical installation condition reports (EICR)
- Tenancy agreements
- Insurance policies
- Planning permissions
- Building regulations approvals
- Asbestos surveys
- Fire risk assessments
- Any other file

**How to use:**

1. Open a property
2. Go to the **Documents** tab
3. Click **Upload Document**
4. Select the file (PDF, image, Word document)
5. Choose the document type from the dropdown
6. Add an expiry date (for certificates)
7. Click **Upload**

Documents with expiry dates appear in the compliance dashboard when near expiry. The system sends reminders 30 days before expiry.

## 4.3 Property Tenancies

**Where:** Properties > (Property) > Tenancies tab or Tenancies Directory

Manage tenant records and tenancy agreements:

1. Open a property
2. Go to the **Tenancies** tab
3. Click **Add Tenancy**
4. Enter: tenant name, rent amount, deposit amount, tenancy start/end dates, notice period
5. Link to a contact in your CRM (or create a new contact)
6. Upload the tenancy agreement document
7. Click **Save**

### Tenancy Directory

**Where:** Portfolio > Tenancies (menu item)

A master list of all tenancies across all properties. Shows:
- Tenant name and contact
- Property address
- Rent amount and payment status
- Tenancy dates
- Deposit scheme reference
- Overdue rent (highlighted in red)

### Rent Payments

Track rent payments per tenancy:

1. Open a tenancy
2. Go to the payments tab
3. Click **Record Payment**
4. Enter: amount, date received, payment method, reference
5. Click **Save**

Late or missed payments appear on the dashboard.

## 4.4 Commercial Leases

**Where:** Properties > (Property) > Commercial Lease tab (for commercial properties only)

For commercial property investments:

1. Open a commercial property
2. Go to the **Lease** tab
3. Enter: tenant, lease start/end dates, annual rent, rent review schedule, break clauses, service charge details
4. Click **Save**

Carina can review commercial lease terms if you ask her.

## 4.5 Portfolio Dashboard

**Where:** Portfolio (menu item)

The Portfolio dashboard gives you a high-level view of all your properties:

- **Total portfolio value**
- **Total debt**
- **Total equity**
- **Average yield**
- **Monthly cashflow** (across all properties)
- **Occupancy rate** (for tenanted properties)
- **Upcoming lease expiries**
- **Upcoming certificate expiries** (EPC, gas, electrical)
- **Property type breakdown** (chart)
- **Value by region** (map)

## 4.6 Property Assets

**Where:** Portfolio > Assets

Keep an inventory of everything in your properties:

1. Navigate to **Assets**
2. Click **Add Asset**
3. Enter: name, description, serial number, purchase date, purchase price, warranty expiry, location (which property/room)
4. Click **Save**

Assets can be:
- White goods (fridge, washing machine, dishwasher)
- Furniture (sofas, beds, tables)
- Appliances (TV, microwave, kettle)
- Fixtures (boilers, radiators, windows)

This is useful for insurance claims, selling a furnished property, or tracking warranty expiry.

## 4.7 Asset Maintenance

**Where:** Portfolio > Maintenance

Schedule and track property maintenance:

1. Click **Add Schedule**
2. Enter: property, task name (e.g. "Gas safety check", "Boiler service"), frequency (monthly, quarterly, annually), assigned to, notes
3. Click **Save**

**Maintenance Requests:** Tenants or team members can submit maintenance requests. Each request shows:
- Description of issue
- Urgency (low, medium, high, emergency)
- Status (reported, acknowledged, in progress, completed)
- Cost
- Photos of the issue

## 4.8 Works Orders

**Where:** Portfolio > Works Orders

For larger maintenance or refurbishment jobs:

1. Click **Create Works Order**
2. Enter: property, contractor, description of work, estimated cost, timeline
3. Upload quotes from contractors
4. Click **Save**

You can compare quotes from multiple contractors before approving. Once approved, track progress and actual costs vs estimates.

## 4.9 Refurbishment Projects

**Where:** Portfolio > Refurb Projects

Plan and manage full refurbishment projects:

1. Click **Create Project**
2. Enter: name, property, budget, timeline, description
3. Add **Milestones** - key stages with dates and budget
4. Add **Lines** - individual items with costs (linked to Refurb Catalogue)

**How to use:**

- Plan the project using the Refurb Catalogue as a cost reference
- Set milestones (e.g. "Kitchen complete by week 2", "Bathroom complete by week 3")
- Track actual costs against budget
- Mark milestones complete as work finishes
- Compare total spend to the Refurb Calculator estimate for this property

### Refurb Catalogue

**Where:** Portfolio > Refurb Catalogue

A database of 165+ refurbishment items with pre-configured costs:

- Kitchens (budget, standard, premium)
- Bathrooms (budget, standard, premium)
- Flooring types
- Windows and doors
- Electrics and lighting
- Plumbing and heating
- Decoration
- External works

Each item has:
- Name
- Unit cost (low, medium, high)
- Unit of measure
- Typical lifespan
- Notes and specifications

Carina uses this catalogue when estimating refurb costs. The Refurb Calculator draws from it directly.

---

# Part 5: The Pipeline

## 5.1 What is the Pipeline?

**Where:** Pipeline (menu item)

The Pipeline is a kanban-style deal flow manager. Deals move through stages from first contact to completion. It's designed for property sourcers and estate agents, but works for any deal-based business.

## 5.2 Pipeline Presets

When you first open Pipeline, you can create from a preset:

1. **Sellers Pipeline** - for vendor/seller acquisition
   - Stages: New Lead → Contacted → Valuation Booked → Instruction → Won Listing → Lost

2. **Landlords Pipeline** - for landlord opportunities
   - Stages: Enquiry → Portfolio Review → Offer Terms → Under Contract → Completed → Lost

3. **Investors Pipeline** - for capital partners
   - Stages: Prospect → Qualified → Deal Shared → Committed → Funded → Passed

4. **Custom Pipeline** - create your own from scratch

## 5.3 Creating a Pipeline

1. Click **Create Pipeline**
2. Choose a preset or start blank
3. Name your pipeline
4. Add/remove stages as needed
5. Set stage colours (for visual identification)
6. Mark which stages are "Won" and "Lost" (deals in these stages are considered closed)

## 5.4 Adding Deals to the Pipeline

1. Open a pipeline
2. Click **Add Deal**
3. Select an existing deal from the Deals Workspace, or enter details manually
4. The deal card appears in the first stage

Each deal card shows:
- Deal/property name
- Key numbers (price, yield)
- Days in current stage
- Assigned team member
- Tags

## 5.5 Moving Deals Between Stages

**Drag and drop:** Click a deal card and drag it to the next stage.

**Bulk move:** Select multiple deals and move them together (useful for sending a batch to "Lost" or "Completed").

**Why are you moving it?** Each time you move a deal, Propreneur asks why. This builds a data trail for future analysis.

## 5.6 Pipeline Stage Automations

**Where:** Pipeline > (Pipeline) > Automations tab

Set up automatic actions when a deal moves to a specific stage:

1. Click **Add Automation**
2. Choose the trigger stage (e.g. "When a deal reaches Contacted")
3. Choose the action:
   - Send an email (pick from your templates)
   - Create a task
   - Assign to a team member
   - Add a note
4. Click **Save**

**Example:** When a deal reaches "Valuation Booked", automatically send the "Property Valuation Confirmation" email template.

## 5.7 Pipeline Analytics

Each pipeline shows:
- **Total deals** in pipeline
- **Deals by stage** (count per stage)
- **Average time** in each stage
- **Conversion rate** (how many deals make it from first to last stage)
- **Win rate** (won vs lost)
- **Total pipeline value**

---

# Part 6: CRM & Contacts

## 6.1 CRM Dashboard

**Where:** Contacts / CRM > CRM Dashboard

The CRM Dashboard shows your relationship management at a glance:

- **Total contacts** and breakdown by type (buyers, sellers, landlords, investors, tenants)
- **Recent interactions** (calls, emails, meetings, tasks)
- **Upcoming follow-ups** - contacts that need attention
- **New contacts this month**
- **Contact engagement score** (if enabled)

## 6.2 Contacts

**Where:** Contacts / CRM > Contacts

Every person in your property network lives here: buyers, sellers, landlords, investors, tenants, contractors, solicitors, agents, mentors, mentees.

### Adding a Contact

1. Click **Add Contact**
2. Enter: name, email, phone
3. Select type (buyer, seller, landlord, investor, tenant, contractor, solicitor, agent, mentor, mentee, other)
4. Add tags for filtering (e.g. "cash buyer", "portfolio landlord", "first-time buyer")
5. Enter notes about the contact
6. Click **Save**

### Contact Detail View

Click a contact to see their full record:

- **Overview** - contact info, tags, source, created date
- **Interactions** - full history (calls, emails, meetings, tasks)
- **Deals** - deals linked to this contact
- **Properties** - properties linked to this contact
- **Threads** - email/message threads with this contact
- **Tasks** - tasks assigned for this contact
- **Notes** - free-form notes
- **Compliance** - CDD documents, ID checks (for regulated contacts)

### Contact Types Explained

| Type | Who is this? | Used for |
|------|-------------|----------|
| Buyer | Someone looking to purchase | Deal matching, CRM follow-up |
| Seller | Someone selling a property | Sourcing deals |
| Landlord | Portfolio landlord | Rent-roll acquisition, mentoring |
| Investor | Capital partner | Deal sharing, investor reporting |
| Tenant | Renting from you | Tenancy management |
| Contractor | Tradesperson | Property maintenance, refurb |
| Solicitor | Legal professional | Conveyancing, contracts |
| Agent | Estate agent | Deal sourcing, networking |
| Mentor | Expert/coach | Mentoring OS |
| Mentee | Learner | Mentoring OS |

### Contact Tags

Tags are customisable labels you can add to contacts for filtering and grouping. Examples:
- "Cash buyer"
- "Portfolio landlord"
- "First-time buyer"
- "Hot lead"
- "VIP"
- "Completed deal"

Tags can be created on the fly when adding or editing a contact.

## 6.3 Contact Interactions

Every interaction with a contact is logged automatically or manually:

**Interaction types:**
- **Call** - log a phone call (duration, notes, outcome)
- **Email** - emails sent via the system are logged automatically
- **Meeting** - log in-person or virtual meetings
- **Task** - to-do items related to this contact
- **Note** - free-form note

**How to log an interaction:**

1. Open the contact
2. Go to the **Interactions** tab
3. Click **Add Interaction**
4. Select the type
5. Enter details
6. Click **Save**

The interaction timeline shows everything in chronological order, so you never lose context.

## 6.4 CRM Inbox

**Where:** Contacts / CRM > Inbox

The CRM Inbox is a full email client built into Propreneur. It lets you send, receive, and manage emails without leaving the platform.

### Threads

Emails are grouped into threads by contact and subject. Each thread shows:
- Contact name and photo
- Subject line
- Last message preview
- Date of last message
- Status (unread, read, archived)
- Assigned team member

### Sending an Email

1. Open a thread (or start a new one)
2. Click in the message box
3. Type your reply (or use an email template)
4. Click **Send**

Emails can use the email templates from the Communications module.

### Thread Status

- **Unread** - new messages you haven't seen
- **Read** - you've viewed the thread
- **Archived** - moved out of the inbox (but not deleted)
- **Assigned** - a team member is handling it

### Adding Notes

You can add internal notes to a thread that only your team sees:
1. Open the thread
2. Click **Add Note**
3. Type your note
4. Click **Save**

Notes appear in the thread but are marked as internal.

## 6.5 Lead Funnel

**Where:** Contacts / CRM > Lead Funnel

The Lead Funnel module brings leads in from advertising platforms and qualifies them automatically.

### How Lead Funnel Works

```
Ad Platform (Meta/LinkedIn/TikTok) → Webhook → Propreneur → Carina Qualifies → CRM Contact Created
```

### Connecting Ad Platforms

1. Navigate to Lead Funnel
2. Click **Connect Platform**
3. Choose: Facebook/Meta, LinkedIn, TikTok
4. Authenticate with the platform
5. Select which ad accounts/campaigns to connect
6. The system sets up webhook endpoints automatically

### Campaign Management

Once connected, you can see:
- All ad campaigns and their performance (leads, cost per lead, conversion rate)
- Leads coming in from each campaign in real time
- Cost data if available from the ad platform

### Inbound Leads

When a lead comes in:
1. It lands in the **Inbound Leads** table
2. Status: "New"
3. Carina may automatically qualify the lead (ask questions via chat)
4. If qualified, a CRM contact is created automatically
5. The lead gets a score (hot, warm, cold)
6. Speed-to-lead rules fire (notifications, tasks, emails)

### Lead Qualification with Carina

**Where:** Lead Funnel > Qualification Chat

The public-facing qualification chatbot:

1. A visitor to your website clicks the Carina chat widget
2. Carina asks qualifying questions (name, budget, location, timeline, investment experience)
3. The visitor answers conversationally
4. When Carina has enough info, she creates an Inbound Lead and CRM Contact
5. The lead is scored and routed appropriately

This works as a standalone chatbot or integrated into the Lead Funnel.

### Lead Score Types

- **Hot** - ready to buy, has funds, clear timeline
- **Warm** - interested but needs nurturing
- **Cold** - early stage, low priority

## 6.6 Qualification Forms

**Where:** Contacts / CRM > Qualification Forms

Create embeddable web forms that qualify leads before they reach your CRM.

### Creating a Form

1. Click **Create Form**
2. Name the form (e.g. "Investor Enquiry", "Free Property Valuation")
3. Add fields: text, email, tel, number, select dropdown, textarea
4. Mark required fields
5. Toggle "Create inbound lead" (if on, form submissions create leads)
6. Click **Save**

### Using the Form

Each form gets a public URL and embed code. You can:
- Share the link on social media
- Embed the form on your website (iframe)
- Link from email campaigns

### Submissions

Every form submission is recorded. If "Create inbound lead" is on:
- An InboundLead is created
- A CRM Contact is created (if email matches an existing contact, it's linked)
- A Speed-to-Lead rule fires

## 6.7 Speed-to-Lead Rules

**Where:** Contacts / CRM > Speed-to-Lead

Speed-to-Lead is the science of responding to leads fast. The faster you respond, the more likely you are to convert.

### Creating a Rule

1. Click **Create Rule**
2. Name the rule (e.g. "Instant follow-up for hot leads")
3. Set the trigger:
   - New lead created
   - Lead qualified by Carina
4. Set the tier (instant, 30-minute, 2-hour)
5. Choose channels:
   - **Task** - creates a CRM follow-up task
   - **Email** - sends an automated email from a template
6. Set minimum qualification score (e.g. only fire for leads scored 70+)
7. Click **Save**

### Default Rules

The system comes with pre-built defaults:
- **Instant follow-up** - creates a task for new leads
- **Welcome email** - sends an introduction email when a lead is qualified

---

# Part 7: Compliance

## 7.1 Compliance Overview

**Where:** Compliance (menu item)

The Compliance module is for regulated property businesses (estate agency, lettings, property management). It tracks everything you need to legally operate.

## 7.2 Compliance Dashboard

The compliance dashboard shows:

- **Overall compliance status** - percentage complete
- **Expiring items** - what's due within 30 days (highlighted in red)
- **Overdue items** - what's already past due (highlighted with warning icons)
- **Recent completions** - what's been sorted recently
- **Regulatory profile** - your firm's regulation details

## 7.3 AML (Anti-Money Laundering)

**Where:** Compliance > AML

### AML Registration

Track your HMRC AML registration:

1. Enter your HMRC reference number (once registered)
2. Record the registration date
3. Set the renewal date (annually)
4. Upload your AML registration certificate

If you haven't registered yet, Compliance shows this as a high-priority action.

### AML Policy Documents

Upload your AML policies:
- Firm-wide AML policy
- Risk assessment methodology
- Customer due diligence procedures
- Record-keeping procedures
- Staff training policy

### AML Training Logs

Record AML training for yourself and your team:

1. Click **Add Training**
2. Enter: staff member name, training provider, date completed, certificate reference
3. Upload the training certificate
4. Set the renewal date (typically 12 months)
5. Click **Save**

## 7.4 ICO Registration

**Where:** Compliance > Regulatory Profile

Track your Information Commissioner's Office registration:

1. Enter your ICO registration number
2. Enter the registered name
3. Record the fee paid (£40/year for most businesses)
4. Set the renewal date

*Note: If your business uses our group's ICO registration (Verlox Ltd - ZC108946), ensure this covers your specific entity. Different legal entities need separate registrations.*

## 7.5 Property Redress Scheme

**Where:** Compliance > Regulatory Profile

Track your membership in a property redress scheme:

1. Select the scheme:
   - The Property Ombudsman (tpos.co.uk)
   - Property Redress Scheme (propertyredress.co.uk)
2. Enter your membership number
3. Record the fee (£199/year typical)
4. Set the renewal date

## 7.6 Client Due Diligence (CDD)

**Where:** Compliance > (Contact) or Compliance Overview

Every regulated client needs CDD checks. Propreneur tracks:

**For individuals:**
- Proof of ID (passport, driving licence)
- Proof of address (utility bill, bank statement)
- Source of funds declaration
- Source of wealth declaration (for high-value transactions)

**For companies:**
- Company registration number
- Proof of registered address
- Directors' ID documentation
- Beneficial ownership structure
- Financial statements

**How to manage:**

1. Open a contact
2. Go to the **Compliance** tab
3. See what documents have been collected and what's missing
4. Upload documents as they're received
5. Set expiry dates (some documents need periodic renewal)

## 7.7 Complaint Cases

**Where:** Compliance > Complaints

If you're a regulated agent, you need a formal complaints procedure. Propreneur helps you manage it.

### Logging a Complaint

1. Click **File Complaint**
2. Enter: complainants' details, date received, complaint type, description
3. Categorise: service issue, fee dispute, communication, other
4. Click **Save**

### Managing Complaints

Each complaint goes through stages:
1. **Received** - logged and acknowledged
2. **Investigating** - gathering information
3. **Response prepared** - proposed resolution
4. **Resolved** - complainant accepted
5. **Escalated** - to the redress scheme
6. **Closed** - final outcome

### Complaint Tracking

For each complaint, track:
- Timeline of events
- Correspondence with the complainant
- Internal notes
- Resolution offered and accepted
- Compensation paid (if any)
- Ombudsman referral (if unresolved)

## 7.8 Regulatory Profile

**Where:** Compliance > Regulatory Profile

Your firm's full regulatory picture:

- **Entity details** - company name, number, registered address
- **Regulated activities** - estate agency, lettings, property management
- **Registered schemes** - ICO, AML, Redress - all in one place
- **PI Insurance** - provider, policy number, expiry (required for most regulated activities)
- **Professional memberships** - ARLA, NAEA, RICS, etc.

## 7.9 Compliance Requirements

**Where:** Compliance > Requirements

A dynamic checklist of everything your business needs to be compliant:

Each requirement shows:
- Name (e.g. "ICO Registration", "AML Policy", "Client Money Protection")
- Status (complete, pending, expired, not applicable)
- Due date
- Responsible person
- Notes

You can add custom requirements specific to your business.

## 7.10 Professional Indemnity & Public Liability Insurance

Track your insurance policies:

1. Navigate to Regulatory Profile
2. Scroll to Insurance section
3. Click **Add Policy**
4. Enter: type (PI or PL), provider, policy number, cover amount, start date, expiry date
5. Upload the policy document
6. Click **Save**

Propreneur sends reminders 30 days before any insurance policy expires.

---

# Part 8: Communications

## 8.1 Communications Overview

**Where:** Communications (menu item)

The Communications module manages all outbound messaging - emails, sequences, and campaigns.

## 8.2 Email Templates

**Where:** Communications > Templates

Create reusable email templates with property and contact tokens.

### Creating a Template

1. Click **Create Template**
2. Give it a name (e.g. "New Lead Welcome", "Valuation Confirmation", "Deal Update")
3. Choose a category from the seeder categories
4. Write the subject line (use tokens like `{{contact_first_name}}`)
5. Write the body (HTML or plain text)
6. Insert tokens as needed:
   - `{{contact_first_name}}`
   - `{{contact_email}}`
   - `{{company_name}}`
   - `{{deal_property_address}}`
   - `{{deal_price}}`
7. Click **Save**

### Using Templates

Templates can be used:
- In Communication Sequences
- In Speed-to-Lead rules
- Manually from the CRM Inbox
- Via Carina ("Send the welcome email to this contact")

## 8.3 Communication Sequences

**Where:** Communications > Sequences

Create multi-step email campaigns that nurture leads over time.

### Creating a Sequence

1. Click **Create Sequence**
2. Name it (e.g. "New Lead Nurture", "Investor Onboarding")
3. Add steps in order:

   **Step 1:** Day 0 (immediate) - Send "Welcome" template
   
   **Step 2:** Day 3 - Send "About Us" template
   
   **Step 3:** Day 7 - Send "Case Study" template
   
   **Step 4:** Day 14 - Send "Offer" template

4. Each step can:
   - Send an email from a template
   - Wait for a trigger (e.g. contact replied, deal created)
   - Add a delay (days, hours)
5. Click **Save**

### Enrolling Contacts

1. Open a sequence
2. Click **Enroll Contacts**
3. Select contacts (or import from filter)
4. Enroll them one by one or in bulk
5. Each enrolled contact starts from step 1

### Enrollment Management

See who's in each sequence:
- Current step
- Time since enrollment
- Completed steps
- Dropped out (if they unsubscribed or the sequence completed)

## 8.4 CRM Inbox (Detailed)

**Where:** Communications > Inbox

(Also covered in Part 6.4 - CRM Inbox)

Additional communications features:
- **Bulk actions** - select multiple threads to archive, assign, or mark as read
- **Filters** - by contact, date range, status, assigned user
- **Search** - search across all threads and messages

## 8.5 Mail Settings

**Where:** Settings > Communications > Mail Settings

Configure how Propreneur sends emails:

1. **Default From Address** - the email address emails appear to come from
2. **Default From Name** - the name shown as the sender
3. **SMTP Settings** - if you're using a custom mail server
   - Host
   - Port
   - Username
   - Password
   - Encryption (TLS/SSL)

For most workspaces, Propreneur's built-in mail system works. Custom SMTP is for high-volume senders.

## 8.6 Marketing Template Library

**Where:** Communications > Templates (advanced)

Additional marketing-focused templates for:
- Facebook ad copy packs
- Landing page blocks
- Multi-channel drip kits
- Social media posts
- Property listings descriptions

---

# Part 9: Carina - Your AI Assistant

## 9.1 What is Carina?

Carina is Propreneur's built-in AI assistant. She's not a separate tool - she's embedded in every screen, every module, every workflow. You can talk to her like a colleague, and she can see everything in your workspace.

**Carina can:**
- Answer questions about your properties, deals, contacts, and compliance
- Run any of the 21 calculators
- Create and update CRM contacts
- Analyse deals and give investment advice
- Generate deal packs
- Schedule appointments via viCal
- Send emails through the communications module
- Guide you through property investment decisions
- Research market intelligence
- Explain complex concepts in simple terms
- Walk through multi-step tasks using her scratchpad

## 9.2 Accessing Carina

**Chat Bubble:** In the bottom-right corner of every screen, there's a chat bubble. Click it to open the Carina chat window.

**Slash Commands:** In the chat box, type `/` to see available commands:
- `/calculator btl` - run the BTL calculator
- `/deal [deal_id]` - open a specific deal
- `/property [address]` - open a property
- `/compliance` - check compliance status
- `/help` - see what Carina can do

**Page Context:** Carina automatically knows what page you're on. If you're looking at a deal and ask "Is this a good deal?", she knows which deal you mean.

## 9.3 What Carina Can Do (Full Tool List)

### Analysis Tools

| Tool | What it does |
|------|-------------|
| Run Calculator | Run any of the 21 calculators with live or manual data |
| Get Deal Analysis | Fetch and summarise deal data |
| Get Deal Sourcing Intelligence | Analyse sourcing channels and opportunities |
| Run Strategy Finder | Find the best strategy for any property |
| Generate Deal Pack | Create a professional PDF deal pack |

### CRM Tools

| Tool | What it does |
|------|-------------|
| Create Contact | Add a new person to your CRM |
| Get Contact | Look up a contact by name or email |
| Update Contact | Edit contact details |
| Schedule Session | Book a viCal appointment with a contact |

### Communications Tools

| Tool | What it does |
|------|-------------|
| Send Email | Send an email using a template or custom message |
| Send Communication Sequence | Enrol a contact in a drip campaign |

### Advanced Agent Tools

| Tool | What it does |
|------|-------------|
| Read Scratchpad | Read Carina's working memory for multi-step tasks |
| Write to Scratchpad | Save intermediate results during complex workflows |
| Schedule Agent Run | Schedule Carina to perform a task at a specific time |

## 9.4 Multi-Step Reasoning (Scratchpad)

For complex tasks, Carina uses a scratchpad - like her working memory.

**Example: "Help me buy my first property"**

Carina would:
1. Write to scratchpad: "User is a beginner, £50k budget, looking in Birmingham"
2. Ask qualifying questions
3. Run the strategy finder
4. Write results to scratchpad
5. Check CRM for existing contacts that match
6. Communicate the full plan to you
7. Schedule a follow-up reminder

The scratchpad makes Carina genuinely agentic - she can hold complex multi-step conversations and remember context across the entire interaction.

## 9.5 Scheduled Agent

Carina can perform tasks on a schedule:

- "Check for new deals every Monday at 9am"
- "Send me a weekly compliance summary every Friday"
- "Remind me when a deal has been in the pipeline for 30 days"

To schedule:
1. Ask Carina to schedule a task
2. She creates a scheduled run in the background
3. The task fires at the specified time
4. Results appear as a notification

## 9.6 Business Structure Advisor

**Where:** Tools > Structure Advisor

A specialised Carina tool that helps you decide:

- **Sole Trader vs Limited Company** - which structure is best for your situation
- **Partnership vs LLP** - for joint ventures
- **Tax implications** - corporation tax, income tax, CGT
- **Asset protection** - separating property assets from trading

**How to use:**

1. Navigate to Structure Advisor
2. Enter your situation (income, number of properties, plans for growth)
3. Carina scores each structure option
4. She explains the pros and cons of each
5. Recommendations are tailored to your specific circumstances

## 9.7 Carina Settings

**Where:** Settings > AI Settings

### AI Provider

Propreneur supports bring-your-own-key (BYOK):

1. Navigate to Settings > AI Settings
2. Select your AI provider (DeepSeek, Claude, OpenAI, etc.)
3. Enter your API key
4. Test the connection
5. Click **Save**

### Usage Tracking

See how many Carina conversations and tokens you've used:

1. Navigate to Settings > AI Usage
2. View: total conversations, tokens used this month, cost estimate
3. Usage is tracked per workspace

### System Prompts (Platform Admin only)

Platform administrators can manage the system prompts that control Carina's behaviour. These define:
- Her personality and tone
- What she knows about each module
- How she handles sensitive data
- Default responses for common questions

## 9.8 Knowledge Base (Carina's Training)

Carina is trained on the `brain/knowledge/` directory - a collection of markdown documents covering:

- All 21 calculators (how they work, formulas, use cases)
- Each investment strategy (BTL, HMO, BRR, etc.)
- Compliance requirements (AML, ICO, CDD)
- Market intelligence
- Property finance
- Business structures
- Wealth creation principles
- The UK buying process
- Commercial property
- Landlord exit strategies
- And more

When you ask Carina a question, she searches her knowledge base for the most relevant documents and uses that information in her answer.

**Adding to Carina's Knowledge:**

Platform administrators can add new knowledge documents:
1. Write a markdown file with the topic
2. Save it to `brain/knowledge/` with the next available number
3. Index it via the RAG pipeline
4. Carina will use it from the next conversation

---

# Part 10: viCal - Booking & Calendar

## 10.1 What is viCal?

**Where:** Bookings (menu item)

viCal is Propreneur's appointment booking engine. It's like Calendly but built into your property business, with property-specific features.

## 10.2 Event Types

**Where:** Bookings > Event Types

Define the types of appointments you offer:

1. Click **Create Event Type**
2. Enter: name (e.g. "Property Viewing", "Discovery Call", "Mentoring Session")
3. Set duration (15 min, 30 min, 45 min, 60 min, custom)
4. Set availability (which days/hours you're available)
5. Choose location (in-person, phone, video call, property address)
6. Set buffer time between appointments
7. Click **Save**

### Advanced Event Settings

- **Minimum notice** - how far in advance someone must book (e.g. 2 hours)
- **Maximum advance booking** - how far out they can book (e.g. 30 days)
- **Daily limit** - max bookings per day
- **Guest limit** - max guests per booking
- **Price** - if you charge for this appointment type

## 10.3 Intake Pools

**Where:** Bookings > Intake Pools

Before someone can book, you may want to ask them questions first. Intake pools let you qualify leads before they see your calendar.

### Creating an Intake Pool

1. Click **Create Pool**
2. Name it (e.g. "Investor Qualification", "Tenant Screening")
3. Add questions:
   - What type of property are you looking for?
   - What's your budget?
   - When are you looking to move/buy?
   - Are you a cash buyer or need finance?
4. Set disqualifying answers (if someone answers "under £100k" and your minimum is £200k, they're disqualified)
5. Click **Save**

### How It Works

1. Visitor clicks "Book an appointment"
2. They see the intake questions first
3. If they pass, they see the available time slots
4. If they fail, they see a friendly message explaining why
5. Disqualified leads are recorded but not given calendar access

## 10.4 Public Booking Page

**Where:** Bookings > Your Booking Page

Each workspace gets a public booking page at `{workspace}.propreneur.test:8000/book/{slug}`.

**How to use:**

1. Share the link on your website, in emails, or on social media
2. Visitors see your event types
3. They choose an event type
4. They answer intake questions (if configured)
5. They pick a time slot
6. They enter their details
7. The booking is confirmed
8. Both you and the guest receive confirmation emails

### Embedding on Your Website

You can embed the booking page on your own website using an iframe:

```html
<iframe src="https://{workspace}.propreneur.test:8000/book/{slug}" width="100%" height="600" frameborder="0"></iframe>
```

## 10.5 Managing Bookings

**Where:** Bookings > Calendar

The calendar view shows all your appointments:

- **Day view** - see today's schedule
- **Week view** - plan your week
- **Month view** - monthly overview

Each booking shows:
- Guest name and contact
- Event type
- Date and time
- Location
- Status (confirmed, pending, cancelled, completed)
- Notes from the guest

### Booking Actions

- **Confirm** - approve a pending booking
- **Reschedule** - change the date/time
- **Cancel** - cancel with reason (guest is notified)
- **Mark as completed** - after the appointment
- **Add notes** - internal notes about the booking

## 10.6 Group Events

**Where:** Bookings > Group Events

Create and manage group events like webinars, workshops, and property viewings.

### Creating a Group Event

1. Click **Create Event**
2. Enter: title, description, date/time, duration
3. Set capacity (max attendees)
4. Choose virtual or in-person
5. Set price (free or paid)
6. Add a cover image
7. Click **Save**

### Managing Group Events

- View registrations
- Send reminders to registered attendees
- Export attendee list
- Cancel the event
- View attendance

### Public Event Page

Each event gets a public page where people can:
- See event details
- Register (free events)
- Purchase tickets (paid events)
- Add to their calendar

## 10.7 Booking Notifications

Automatic notifications for:

- **Guest:** Confirmation, reminder (24 hours before), cancellation, rescheduling
- **Host:** New booking alert, cancellation alert, daily summary
- **Payment:** Payment received, deposit return

## 10.8 Carina + viCal

- "Book a viewing for the property at 123 Main Street"
- "Schedule a catch-up with John Smith"
- "What appointments do I have tomorrow?"
- "Reschedule my 3pm to 4pm"

---

# Part 11: Mentoring OS

## 11.1 What is Mentoring OS?

**Where:** Mentoring OS (menu item)

Mentoring OS is a complete platform for running a property mentoring business. You can offer packages, manage mentees, deliver courses, and track progress - all within Propreneur.

## 11.2 Mentor Profile

**Where:** Mentoring OS > Profile

Set up your mentor profile:

1. Navigate to your profile
2. Enter: bio, expertise areas, years of experience, qualifications
3. Upload your photo
4. Set your availability (for mentoring sessions)
5. Toggle: visible in public mentor directory
6. Click **Save**

## 11.3 Mentorship Packages

**Where:** Mentoring OS > Packages

Define what you offer to mentees:

1. Click **Create Package**
2. Enter: name, description, price
3. Set what's included:
   - Number of 1:1 sessions
   - Course access
   - Community access
   - WhatsApp/telegram support
   - Deal review
   - Property viewing accompaniment
4. Set duration (1 month, 3 months, 6 months, 12 months)
5. Choose payment schedule (one-time, monthly, quarterly)
6. Click **Save**

### Public Package Page

Your packages have a public page where potential mentees can:
- Browse available packages
- Read descriptions
- See pricing
- Apply/enrol

## 11.4 Mentee Registration

**Where:** Mentoring OS > Intake

Potential mentees apply through a public intake form:

1. Navigate to the public intake page
2. Enter: name, email, phone, experience level, goals
3. Select a package
4. Submit

### Managing Applications

1. Go to Mentoring > Mentee Registrations
2. Review each application
3. **Approve** - mentee gets access to the system, receives welcome email
4. **Reject** - with reason, mentee receives polite rejection
5. **Request more info** - send follow-up questions

## 11.5 Mentorship Relationships

**Where:** Mentoring OS > Mentees

Once approved, a mentorship relationship is created. Each relationship tracks:

- **Mentee profile** - name, contact, goals
- **Sessions** - past and upcoming mentoring sessions
- **Goals** - mentee's objectives
- **Milestones** - progress markers
- **Invoices** - payment history
- **Notes** - private mentor notes about the mentee
- **Progress** - overall progress indicator

### Adding Sessions

1. Open a mentorship relationship
2. Click **Add Session**
3. Enter: date, duration, notes, topics covered, action items
4. Click **Save**

### Setting Goals

1. Open a mentorship relationship
2. Click **Add Goal**
3. Enter: goal name, description, target date
4. Add milestones (mini-goals along the way)
5. Click **Save**

Mentees can mark milestones as complete. Mentors can verify completion.

## 11.6 Mentoring Reports

**Where:** Mentoring OS > Reports

Generate reports on your mentoring business:

- **Mentee progress report** - how each mentee is doing
- **Session report** - sessions completed, hours delivered
- **Revenue report** - earnings from mentorship
- **Package popularity** - which packages sell best
- **Retention report** - how long mentees stay engaged

## 11.7 Mentoring Invoices & Payments

**Where:** Mentoring OS > Invoices

Invoice mentees for packages or one-off sessions:

1. Click **Create Invoice**
2. Select the mentee
3. Select the package (or enter a custom amount)
4. Set due date
5. Click **Generate**

Invoices are sent to the mentee automatically. Payment status is tracked (paid, pending, overdue, cancelled).

## 11.8 Mentoring Certificates

**Where:** Mentoring OS > Certificates

Issue completion certificates to mentees:

1. Click **Issue Certificate**
2. Select the mentee
3. Select the completed programme/package
4. Customise the certificate message
5. Click **Generate**

Certificates are downloadable as PDF and can be verified via a unique link.

## 11.9 Community & Social (Mentoring)

**Where:** Community (sub-section within Mentoring)

Mentees can engage with the community:

- **Testimonials** - leave reviews about the mentoring experience
- **Wins** - share success stories
- **Discussions** - ask questions and share knowledge
- **Messages** - direct messaging with mentor and other mentees

## 11.10 LMS - Learning Management System

**Where:** Mentoring OS > LMS

Create and deliver courses to your mentees.

### Courses

1. Click **Create Course**
2. Enter: title, description, cover image
3. Set difficulty (beginner, intermediate, advanced)
4. Set estimated duration
5. Add **Modules** - individual lessons within the course
6. Each module can contain:
   - Written content
   - Video links
   - Downloadable resources
   - Quizzes
7. Click **Save**

### Learning Paths

Group related courses into learning paths:

1. Click **Create Learning Path**
2. Enter: name, description
3. Add courses in order
4. Set prerequisites (complete course A before course B)

### Quizzes

1. Click **Create Quiz**
2. Enter: title, description
3. Add questions (multiple choice, true/false)
4. Set passing score
5. Click **Save**

Quizzes can be attached to course modules. When a mentee passes, they unlock the next module.

### Course Progress

Mentees see their progress through each course:
- Modules completed / total modules
- Quiz scores
- Time spent
- Certificate eligibility

---

# Part 12: Investors

## 12.1 Investor Module Overview

**Where:** Investors (menu item)

The Investor module helps you manage capital partners - people who invest money into your deals.

## 12.2 Investor Profiles

Each investor gets a profile:

1. Navigate to Investors
2. Click **Add Investor**
3. Enter: name, contact details, investment preferences
4. Set: capital available, minimum/maximum investment, preferred strategies, preferred regions
5. Complete KYC (Know Your Customer) checks
6. Click **Save**

### Investor Profile Fields

- Contact information
- Investment capacity (total capital available)
- Investment range (min/max per deal)
- Preferred strategies (BTL, HMO, BRR, SA, Commercial)
- Preferred regions
- Risk tolerance (low, medium, high)
- Required return (minimum ROI expectation)
- Investment timeline (short, medium, long-term)
- KYC status (pending, completed)
- Notes

## 12.3 Investor Onboarding

**Where:** Investor Journey

Investors complete their own onboarding journey when they first join:

1. **Stage 1: Basic Info** - name, email, phone
2. **Stage 2: Investment Goals** - what they want to achieve
3. **Stage 3: Capacity** - how much they have to invest
4. **Stage 4: Preferences** - strategies, regions, risk level
5. **Stage 5: KYC** - identity verification, source of funds

Once complete, their profile is active and they can be matched with deals.

## 12.4 Investor Funnel

**Where:** Investors > Funnel

A live-action view of investors progressing through stages:

- **Prospect** - early interest, not yet onboarded
- **Qualified** - onboarded, KYC done, ready for deals
- **Deal Shared** - have been shown specific deals
- **Committed** - invested in at least one deal
- **Funded** - capital deployed
- **Passed** - declined or inactive

### Funnel Actions

- **Move** investors between stages with one click
- **View** investor details from the funnel
- **Filter** by stage, region, strategy
- **See counts** per stage at a glance

## 12.5 Matching Investors with Deals

**Where:** Investors > Match

The investor-deal matcher finds the best deals for each investor:

1. Select an investor
2. Click **Find Matches**
3. Propreneur searches all active deals
4. Filters by: strategy match, region match, investment range match, risk profile match
5. Shows matched deals ranked by fit score

You can then:
- Share selected deals with the investor
- Add notes to each match
- Track which deals were shared and the investor's response

## 12.6 Investor Portal

**Where:** Investor Portal (separate login for investors)

Investors have their own portal where they can:
- See their profile and investment preferences
- View deals shared with them
- See the status of deals they've invested in
- Access reports and returns
- Update personal information
- Complete KYC documents

### Accessing the Investor Portal

1. Investors log in at `{workspace}.propreneur.test:8000/investor-portal/login`
2. They register with their email
3. You approve their registration
4. They complete their profile and KYC
5. They can see deals you share with them

## 12.7 Investor KYC

**Where:** Investors > KYC

Complete Know Your Customer checks for every investor:

**Required documents:**
- Proof of identity (passport, driving licence)
- Proof of address (recent utility bill, bank statement)
- Source of funds (bank statements, sale of property, inheritance)
- Source of wealth (for high-net-worth individuals)

**Process:**
1. Request documents from the investor
2. Investor uploads via their portal
3. You review and verify
4. Mark KYC as complete
5. Set review date (annual re-checks)

## 12.8 Power Team

**Where:** Investors > Power Team

Build your network of professionals who support your investment activities:

- **Solicitors** - conveyancing, contracts
- **Accountants** - tax, structure advice
- **Mortgage brokers** - finance sourcing
- **Surveyors** - valuations, surveys
- **Architects** - planning, design
- **Contractors** - building work
- **Letting agents** - tenant management
- **Property managers** - ongoing oversight

Each team member is a CRM contact with their specialisation tagged.

## 12.9 Investor Reporting

**Where:** Investors > Reports

Generate reports for your investors:

- **Deal performance** - how each deal is performing
- **Returns** - ROI, cashflow, capital appreciation
- **Portfolio snapshot** - all their investments in one view
- **Tax reports** - income and gains for their accountant
- **Quarterly updates** - automated quarterly summaries

---

# Part 13: Accounting

## 13.1 Accounting Overview

**Where:** Accounting (menu item)

The Accounting module handles your property business finances - expenses, income, invoices, receipts, and bank reconciliation.

## 13.2 Accounting Dashboard

See your financial health at a glance:

- **Total income this month**
- **Total expenses this month**
- **Net profit/loss**
- **Bank balance** (if connected)
- **Outstanding invoices**
- **Overdue payments**
- **Expense breakdown by category** (chart)
- **Income vs expenses** (chart)

## 13.3 Expenses

**Where:** Accounting > Expenses

Track all business expenses:

### Adding an Expense

1. Click **Add Expense**
2. Enter: description, amount, date
3. Select category (mortgage, repairs, insurance, utilities, management fees, travel, marketing, legal, professional fees, other)
4. Link to a property (if the expense is for a specific property)
5. Link to a deal (if the expense is for a specific deal)
6. Upload receipt image or PDF
7. Select payment method (bank transfer, cash, credit card, standing order)
8. Mark as VAT-able if applicable
9. Set recurring if it's a regular expense
10. Click **Save**

### Expense Categories

The system comes with pre-set categories:
- Mortgage payments
- Property repairs and maintenance
- Building insurance
- Utilities (gas, electric, water, broadband)
- Letting agent fees
- Travel and transport
- Marketing and advertising
- Legal and professional fees
- Accountancy fees
- Office and admin
- Other

### Recurring Expenses

For regular expenses (mortgage, insurance, etc.):

1. When adding an expense, toggle "Recurring"
2. Set frequency (monthly, quarterly, annually)
3. Set end date (or no end date)
4. Propreneur auto-creates the expense on the schedule

### Receipt Scanner

Upload receipt images and Propreneur extracts:
- Amount
- Date
- Vendor
- Category

*(OCR-based extraction - works with clear photos of receipts)*

## 13.4 Invoices

**Where:** Accounting > Invoices

Create and send invoices to clients, tenants, or mentees.

### Creating an Invoice

1. Click **Create Invoice**
2. Select customer (from CRM contacts)
3. Enter invoice date
4. Set due date
5. Add line items:
   - Description
   - Quantity
   - Unit price
   - VAT rate (if applicable)
6. Add notes or payment terms
7. Click **Create**

### Invoice Statuses

- **Draft** - not yet sent
- **Sent** - sent to customer
- **Viewed** - customer opened it
- **Partially Paid** - some amount received
- **Paid** - fully paid
- **Overdue** - past due date
- **Cancelled** - voided

### Sending Invoices

1. Open the invoice
2. Click **Send**
3. Choose email template (optional)
4. Click **Send**
5. Customer receives the invoice via email with a payment link

### Invoice Reminders

Automatic payment reminders:
1. 3 days before due date
2. On the due date
3. 7 days overdue
4. 14 days overdue
5. 30 days overdue

You can customise the reminder schedule in Accounting settings.

## 13.5 Receipts

**Where:** Accounting > Receipts

Record money coming in:

1. Click **Record Receipt**
2. Enter: amount, date received
3. Select source:
   - Tenant rent payment
   - Invoice payment
   - Mentorship payment
   - Booking payment
   - Sale proceeds
   - Other income
4. Link to the related record (tenancy, invoice, etc.)
5. Select payment method
6. Click **Save**

## 13.6 Bank Reconciliation

**Where:** Accounting > Bank Reconciliation

Connect your bank account via Open Banking (TrueLayer) to automatically import transactions.

### Connecting TrueLayer

1. Navigating to Accounting > Integrations
2. Click **Connect TrueLayer**
3. You'll be redirected to your bank's login page
4. Authorise the connection
5. Transactions start importing automatically

### Manual Reconciliation

Without Open Banking, you can import CSV statements:

1. Download your bank statement as CSV
2. Go to Accounting > Bank Reconciliation
3. Click **Import CSV**
4. Map the columns (date, description, amount, balance)
5. Click **Import**
6. Match imported transactions to existing expenses and receipts

### Matching Transactions

When transactions are imported:
1. Propreneur tries to auto-match them to existing expenses/receipts
2. Unmatched transactions appear as "Pending"
3. You can:
   - Match to an existing record
   - Create a new expense or receipt
   - Mark as "Transfer" (between your own accounts)
   - Skip (non-business transactions)

### Bank Transaction Categories

Each bank transaction can be categorised:
- Business expense
- Personal
- Transfer between accounts
- Income
- Loan
- Dividend
- Drawings

## 13.7 Chart of Accounts

**Where:** Accounting > Settings

Propreneur uses a standard accounting chart of accounts:

- **Assets** - property, bank accounts, accounts receivable
- **Liabilities** - mortgages, loans, accounts payable
- **Income** - rent, fees, commissions, interest
- **Expenses** - repairs, insurance, management, utilities, etc.
- **Equity** - capital, retained earnings, drawings

When you create an expense or receipt, it posts to the appropriate account automatically.

## 13.8 Accounting Integrations

**Where:** Accounting > Integrations

Connect Propreneur to external accounting software:

- **TrueLayer** - Open Banking bank feed
- **Zoho Books** - sync invoices and expenses
- **Xero** - coming soon
- **QuickBooks** - coming soon

Integration syncs:
- Expenses
- Invoices
- Receipts
- Journal entries

## 13.9 Quick Income

**Where:** Accounting > Quick Income

Log income fast without going through the full invoicing process. Perfect for:
- Rent payments received
- One-off fees
- Cash payments

Enter: amount, date, source, property (if applicable), notes. That's it.

---

# Part 14: Staff & HR

## 14.1 Staff Hub

**Where:** Staff (menu item)

The Staff module manages your team - their profiles, leave, and payroll.

## 14.2 Staff Profiles

**Where:** Staff > Team

View and manage team member profiles:

1. Navigate to Staff > Team
2. See all team members with: name, role, department, status (active, on leave, inactive)
3. Click a profile to see details:
   - Contact information
   - Job title and department
   - Start date
   - Emergency contact
   - Bank details (for payroll)
   - Tax code
   - Documents (contract, policy acknowledgements)

### Adding a Staff Member

1. Click **Add Staff Member**
2. The person must already be a user in your workspace (invite them first)
3. Enter: job title, department, manager
4. Enter payroll details (if applicable)
5. Upload employment documents
6. Click **Save**

## 14.3 Staff Leave

**Where:** Staff > Leave

### Requesting Leave

Team members can request leave:

1. Navigate to Leave
2. Click **Request Leave**
3. Select type: annual leave, sick leave, parental leave, unpaid leave, other
4. Enter dates and reason
5. Click **Submit**

### Approving Leave

Managers approve or reject leave requests:

1. Navigate to Leave
2. See pending requests
3. Click **Approve** or **Reject**
4. If rejecting, enter a reason
5. The team member is notified

### Leave Calendar

See who's off and when:
- Month view of all leave
- Filter by team member or department
- Shows overlapping leave (important for coverage)

## 14.4 Staff Payroll

**Where:** Staff > Payroll

### Payroll Runs

Process payroll for your team:

1. Click **Create Payroll Run**
2. Select the pay period
3. The system pulls in:
   - Each team member's salary/hourly rate
   - Leave taken (deductions if unpaid)
   - Tax code and NI category
4. Review the calculated amounts
5. Adjust as needed (bonuses, overtime, deductions)
6. Click **Process**
7. Payslips are generated

### Payslips

Each payroll run generates payslips for team members:

Each payslip shows:
- Employee name and NI number
- Pay period
- Gross pay
- Deductions (tax, NI, pension, student loan)
- Net pay
- Year-to-date totals

Payslips are:
- Stored in the system
- Emailed to the team member
- Downloadable as PDF

### Payroll Settings

Configure payroll defaults:

- Pay frequency (weekly, bi-weekly, monthly)
- Tax codes (default for new staff)
- NI categories
- Pension scheme details
- Overtime rates

---

# Part 15: Community & Collaboration

## 15.1 Community Overview

**Where:** Community (menu item)

The Community module lets you collaborate with other Propreneur users, share deals, and build your network.

## 15.2 Deal Shares

**Where:** Community > Deal Shares

Share deals with other Propreneur users. This is designed as a deal-swap platform - you have a deal in the north, someone else has one in the south, you swap.

### Sharing a Deal

1. Navigate to Deal Shares
2. Click **Share a Deal**
3. Select the deal from your workspace
4. Add a description (why this deal is interesting)
5. Set what you're looking for:
   - Swap for another deal
   - Joint venture partner
   - Sole funding partner
   - Sell the deal
6. Click **Publish**

### Browsing Available Deals

1. Navigate to Deal Shares
2. Browse deals shared by other users
3. Filter by: location, strategy, price range, deal type
4. Click a deal to see details
5. Express interest (the sharer is notified)

### Deal Shares Feed

The feed shows:
- Recently shared deals
- Deals in your preferred areas
- Deals matching your strategies
- Popular deals (most viewed/expressed interest)

## 15.3 Community Messages

**Where:** Community > Messages

Direct messaging between Propreneur users:

1. Click **New Message**
2. Select the recipient
3. Type your message
4. Click **Send**

Messages support:
- Text
- File attachments
- Deal shares (link a deal)
- Read receipts

## 15.4 Community Posts

**Where:** Community (main feed)

A general discussion board for all users:

- Share insights and tips
- Ask questions
- Post market observations
- Discuss strategies

## 15.5 Testimonials

**Where:** Community > Testimonials

Collect and display testimonials:

1. Navigate to Testimonials
2. Click **Add Testimonial**
3. Enter: client name, testimonial text, rating (stars)
4. Upload a photo or video
5. Click **Save**

Testimonials can be displayed on your website or public profile.

## 15.6 Wins

**Where:** Community > Wins

Celebrate successes with the community:

- "Closed my first deal this month!"
- "Found an amazing HMO deal in Birmingham"
- "Helped a client save £50k on their first investment"

---

# Part 16: Settings & Administration

## 16.1 Settings Overview

**Where:** Settings (menu item)

The Settings hub is where you configure your workspace. It's organised into sections.

## 16.2 Workspace Settings

**Where:** Settings > Workspace

- **Workspace name** - the display name used across the system
- **Timezone** - affects scheduling and reporting
- **Default currency** - for financial calculations
- **Company address** - used on invoices and legal documents
- **Logo** - upload for branding on deal packs and emails

## 16.3 Team Management

**Where:** Settings > Team

### Inviting Team Members

1. Click **Invite Member**
2. Enter their email address
3. Select their role:
   - **Admin** - full access to everything
   - **Manager** - most features, no billing
   - **Staff** - limited access based on modules
4. Click **Send Invitation**
5. The person receives an email with a sign-up link

### Roles & Permissions

Each role defines what the person can see and do:

| Permission | Admin | Manager | Staff |
|-----------|-------|---------|-------|
| View Dashboard | Yes | Yes | Yes |
| Manage Deals | Yes | Yes | Yes |
| Manage Properties | Yes | Yes | Yes |
| Manage Contacts | Yes | Yes | Yes |
| View Compliance | Yes | Yes | Limited |
| Edit Compliance | Yes | Yes | No |
| Manage Accounting | Yes | Yes | No |
| Manage Staff | Yes | No | No |
| Manage Settings | Yes | No | No |
| Manage Billing | Yes | No | No |

### Custom Roles

You can create custom roles with granular permissions:
- Each module can be: no access, view only, edit, admin
- Perfect for giving contractors, freelancers, or partners limited access

## 16.4 Subscription & Billing

**Where:** Settings > Subscriptions

### Current Plan

See what edition you're on and what modules are active:

- Community Edition features
- Enterprise Edition features
- Active modules list

### Changing Plans

1. Click **Change Plan**
2. Choose Community or Enterprise
3. Confirm
4. Modules are activated/deactivated immediately
5. Billing adjusts (upgrade: pro-rata charge; downgrade: credit)

### Payment Method

1. Click **Add Payment Method**
2. Enter card details (Stripe secure payment)
3. The card is saved for future billing

### Invoices

View and download your subscription invoices:
- Monthly invoices
- Annual invoices (if on annual billing)
- Credit notes

## 16.5 AI Settings

**Where:** Settings > AI Settings

### AI Provider Configuration

Make sure your AI provider is configured (required for Carina to work):

1. Select provider (DeepSeek, OpenAI, Claude, DeepSeek via OpenRouter)
2. Enter API key
3. Test the connection
4. Save

### Usage

See your AI usage:
- Conversations this month
- Tokens used
- Estimated cost
- Per-user breakdown

## 16.6 Integrations

**Where:** Settings > Integrations

### Available Integrations

| Integration | What it does | Status |
|------------|-------------|--------|
| PropertyData | Property intelligence API | Configured |
| TrueLayer | Open Banking bank feed | Optional |
| Stripe | Payment processing | Built-in |

### Setting Up PropertyData

1. Navigate to Settings > Integrations
2. Click **Configure** on PropertyData
3. Enter your API key
4. Click **Save**
5. Test the connection

### Webhooks

Create webhooks to send data to external systems:

1. Click **Add Webhook**
2. Enter: name, endpoint URL, secret
3. Select events to subscribe to:
   - deal.created
   - contact.created
   - booking.confirmed
   - invoice.paid
   - compliance.expiring
4. Click **Save**

Webhook deliveries are logged with status, response code, and payload.

## 16.7 Automation

**Where:** Settings > Automation

Create workspace-level automation rules:

### Creating a Rule

1. Click **Create Rule**
2. Name it
3. Set the trigger:
   - **Event-based** - when X happens (deal created, contact added, booking confirmed)
   - **Schedule-based** - at a specific time/day (every Monday at 9am)
4. Set the condition(s):
   - Property type equals
   - Deal value greater than
   - Strategy is
   - etc.
5. Set the action(s):
   - Send email
   - Create task
   - Update field
   - Notify user
6. Click **Save**

### Example Automations

- "When a deal is created with strategy HMO, create a task to check HMO licence requirements"
- "Every Monday at 9am, send a weekly deal summary to the team"
- "When a booking is confirmed, send a reminder 24 hours before"

## 16.8 Branding

**Where:** Settings > Branding

Customise your workspace's look and feel:

- **Primary colour** - the main brand colour (buttons, links, headers)
- **Secondary colour** - accent colour
- **Logo** - uploaded logo appears in the top bar and deal packs
- **Favicon** - the icon shown in browser tabs
- **Theme** - light or dark mode

## 16.9 Localization

**Where:** Settings > Localization

### Languages

Set your workspace language:
- English (default)
- Add custom translations

### Custom Translations

You can add or edit translations for any text in the system:

1. Navigate to Translations
2. Search for the text you want to translate
3. Enter your translation
4. Click **Save**

This is useful for:
- Localisation (adding Welsh, Gaelic, etc.)
- Custom terminology (changing "Deal" to "Opportunity")
- Brand consistency

### Date and Number Formats

- Date format (DD/MM/YYYY or MM/DD/YYYY)
- Time format (12-hour or 24-hour)
- Number format (1,000.00 or 1.000,00)

## 16.10 Audit Logs

**Where:** Settings > Audit

Every action in the workspace is logged for security and accountability:

### What's Logged

- User logins and logouts
- Changes to deals (what was changed, by whom, when)
- Contact updates
- Property changes
- Compliance updates
- Settings changes
- Failed login attempts

### Audit Retention

- Standard retention: 12 months
- GDPR-compliant: 3 years
- Enterprise compliance: 7 years

### Viewing Audit Logs

1. Navigate to Audit
2. Filter by: user, action type, date range, entity
3. Click any log entry to see full details
4. Export logs as CSV or PDF

## 16.11 GDPR

**Where:** Settings > GDPR

Manage data privacy compliance:

### Data Subject Requests

When someone requests access to their data:

1. Click **New Request**
2. Enter: requester details, request type (access, rectification, erasure, portability, restriction, objection)
3. Log the request
4. Process within 30 days (legal requirement)

### Consent Management

Track consent for:
- Marketing emails
- Data sharing
- Cookie acceptance

### Data Retention Policies

Configure how long different types of data are kept:
- Contact data: 7 years after last interaction
- Deal data: 7 years after deal closed
- Accounting data: 7 years (HMRC requirement)
- Communications: 3 years
- Audit logs: 12 months

## 16.12 Security Settings

**Where:** Settings > Security

### Password Policy

- Minimum length (default: 8 characters)
- Require mixed case, numbers, special characters
- Password expiry (optional)
- Account lockout after failed attempts (optional)

### Two-Factor Authentication

- Enforce 2FA for all team members (optional)
- Allow remembered devices (TPM)
- Recovery codes management

### Session Management

- Session timeout (idle logout)
- Maximum concurrent sessions
- Force logout all sessions

## 16.13 Workspace Theme

**Where:** Settings > Appearance

Customise the look:

- **Light/Dark mode toggle** - switch between themes
- **Theme presets** - pre-built colour schemes to choose from
- **Custom CSS** - for advanced customisation

---

# Part 17: Reporting & Analytics

## 17.1 Reporting Dashboard

**Where:** Reporting (menu item)

Generate and view reports on every aspect of your business.

## 17.2 Report Types

### Deal Reports

- **Deal pipeline report** - deals by stage, value, age
- **Calculator usage** - which calculators are used most, average results
- **Sourcing performance** - where deals come from, conversion rates
- **Deal monetisation** - fees earned, commissions, revenue

### Property Reports

- **Portfolio summary** - all properties with values, debt, cashflow
- **Property performance** - yield, ROI, vacancy rate by property
- **Area analysis** - property distribution by postcode/region
- **Asset register** - all assets with values and warranty status

### Contact Reports

- **CRM health** - contacts added, interactions logged, engagement scores
- **Lead source report** - where leads come from (ad platforms, referrals, direct)
- **Conversion report** - leads converted to contacts to deals to completed
- **Communication report** - emails sent, open rates, reply rates

### Financial Reports

- **Profit & Loss** - income vs expenses by period
- **Cash flow** - money in vs money out
- **Balance sheet** - assets, liabilities, equity
- **Tax report** - VAT, income, capital gains
- **Invoice report** - sent, paid, overdue

### Compliance Reports

- **Compliance status** - what's complete, what's pending, what's expiring
- **Expiry calendar** - upcoming expirations
- **Audit trail** - compliance changes and reviews

### Mentoring Reports

- **Mentee progress** - goals, milestones, sessions
- **Revenue report** - packages sold, invoices sent
- **Engagement report** - sessions completed, course progress

### Staff Reports

- **Leave report** - balances, taken, remaining
- **Payroll report** - total payroll, by team member, YTD
- **Productivity report** - deals created, tasks completed

## 17.3 Generating a Report

1. Navigate to Reporting
2. Click **Create Report**
3. Select report type
4. Set date range
5. Apply filters
6. Click **Generate**
7. The report may take a moment (complex reports run in the background)
8. Download as PDF, CSV, or Excel

## 17.4 Scheduled Reports

Automate recurring reports:

1. While viewing a report, click **Schedule**
2. Set frequency (daily, weekly, monthly, quarterly)
3. Set recipients (email addresses of who should receive it)
4. Click **Save**

Scheduled reports are automatically generated and emailed.

## 17.5 Dashboard Widgets

Customise your dashboard with widgets:

Available widgets:
- Properties count
- Deals count
- Contacts count
- Monthly income/expenses
- Pipeline summary
- Compliance status
- Recent activity
- Upcoming tasks
- Financial snapshot

---

# Part 18: Security & Remote Access

## 18.1 Remote Access Sessions

**Where:** Settings > Remote Access

When you need Propreneur support or a team member needs temporary access:

1. Click **Request Session**
2. Enter: purpose, duration, support agent name
3. Share the session code with the support agent
4. The agent can access your workspace for the duration
5. The session is logged with full audit trail

### Session Types

- **View only** - support can see but not change anything
- **Full access** - support can make changes
- **Limited** - specific module access only

### Active Sessions

See who's currently accessing your workspace:
- Session ID
- User
- Start time
- Duration remaining
- Actions performed

## 18.2 Security Scout

The Security Scout proactively monitors your workspace for security issues:

- **Password health** - weak, reused, or expired passwords
- **Inactive users** - accounts not used in 90+ days
- **Suspicious logins** - failed attempts, unusual locations
- **Data access audit** - who accessed what and when
- **Permission review** - users with excessive permissions

---

# Part 19: Backup & Disaster Recovery

## 19.1 Automated Backups

Your workspace data is backed up automatically:

- **Database backups** - full PostgreSQL dump
- **File backups** - uploaded documents and files
- **Configuration backups** - settings and customisations

### Backup Schedule

- Daily: full database backup
- Weekly: full backup (database + files)
- Monthly: long-term retention backup

### Retention

- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 12 months

## 19.2 On-Demand Backups

1. Navigate to Settings > Backup
2. Click **Create Backup Now**
3. Choose what to back up (database, files, or both)
4. Click **Start**
5. Monitor progress

## 19.3 Restoring from Backup

1. Navigate to Settings > Backup
2. Select a backup from the list
3. Click **Restore**
4. Choose what to restore (database, files, specific records)
5. Confirm (this will overwrite current data)
6. Monitor progress

---

# Part 20: Platform Administration

*(This section is for Propreneur platform administrators - not regular workspace users.)*

## 20.1 Platform Dashboard

The platform admin dashboard shows:

- **Total tenants** - active, trialing, suspended
- **Revenue** - MRR, ARR, churn rate
- **Platform Carina usage** - total conversations, tokens, cost
- **Recent signups** - new workspaces
- **System health** - queue sizes, error rates, response times

## 20.2 Tenant Management

Create, manage, and monitor all workspaces:

### Creating a Tenant

1. Click **Create Tenant**
2. Enter: workspace name, domain, admin email
3. Select edition (Community or Enterprise)
4. Set trial period (if applicable)
5. Configure enabled modules (by feature flag)
6. Click **Create**

The system:
1. Creates the tenant record
2. Sets up the tenant database
3. Runs tenant migrations
4. Seeds default data
5. Sends the admin invitation email

### Managing Tenants

- View all tenants with status, plan, and usage
- Suspend/unsuspend tenants
- Change edition
- Enable/disable specific modules
- View Carina usage per tenant
- View storage usage
- Access tenant as them (support mode)

## 20.3 Feature Flags

Toggle features across all workspaces:

**Global feature flags** (affect all tenants):
- `carina_ai` - enable/disable Carina system-wide
- `lead_funnel` - lead funnel module

**Per-tenant feature flags:**
- Override global settings for specific tenants
- Enable beta features for testing
- Gradually roll out new features

## 20.4 Platform Carina

### System Prompts

Manage the prompts that control Carina's behaviour:
- Default personality and tone
- Knowledge boundaries
- Module-specific instructions
- Data handling rules

### Usage Monitoring

- Conversations per tenant
- Tokens consumed
- Response times
- Error rates
- Popular queries

## 20.5 Platform Billing

- **Subscription plans** - define Community and Enterprise plans
- **Stripe integration** - sync subscriptions with Stripe
- **Revenue dashboard** - real-time MRR, churn, LTV
- **Invoice management** - view all tenant invoices
- **Payment failures** - flagged tenants with failed payments

## 20.6 Platform Security (Scout)

Proactive security scanning:

- Scans all tenant databases for vulnerabilities
- Checks user permissions for privilege escalation
- Monitors failed login attempts
- Detects unusual access patterns
- Generates security reports

## 20.7 Backup & DR

Centralised backup management for all tenant databases:
- Backup schedules (per tenant or global)
- Backup verification
- Restore management
- Storage monitoring

---

# Part 21: Onboarding Journey (Investor)

## 21.1 Investor Journey Overview

When a new investor joins your workspace, they go through a 5-stage onboarding journey. This collects all the information you need to match them with deals.

### Stage 1: Basic Information

- Name
- Email
- Phone
- How did you hear about us?

### Stage 2: Investment Goals

- Investment objective (capital growth, income, balanced)
- Investment timeline (short, medium, long-term)
- Experience level

### Stage 3: Investment Capacity

- Total capital available (under £5k, £5k-£10k, £10k-£20k, £20k-£50k, £50k-£150k, £150k-£500k, £500k+)
- Investment per deal (min and max)
- Finance required? (yes, no, possibly)

### Stage 4: Preferences

- Preferred strategies (BTL, HMO, BRR, SA, Commercial, Flip)
- Preferred regions
- Risk tolerance (low, medium, high)
- Minimum expected ROI

### Stage 5: KYC & Documentation

- Proof of identity
- Proof of address
- Source of funds declaration
- Accredited investor declaration (if applicable)

## 21.2 Investor Plan

After completing the journey, the investor sees their personal investment plan:

- Suggested strategies based on their answers
- Recommended capital allocation
- Available deals matching their profile
- Next steps (complete KYC, view deals, book a call)

---

*This completes the Propreneur v2 User Guide. Every feature, every module, every workflow has been documented. You now have the full picture of what Propreneur can do and how to use it like a professional.*

---

**Book saved at:** `books/propreneur-v2-complete-guide.md`
**Word count:** ~35,000+ words
**Last updated:** 2026-05-16
