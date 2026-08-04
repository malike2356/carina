# Area Investment Scoring Metrics

## Purpose

Before sourcing deals in any town or city, systematically score areas across four dimensions:
1. **Income** - rental yields, room rates, nightly SA rates
2. **Supply & Demand** - rental market depth, competition, vacancy signals
3. **Growth** - planned development, infrastructure, job market
4. **Strategy Fit** - which investment strategies work in this area

---

## The Area Identification Framework

### Step 1 - Basic Area Numbers

Collect the following data points for each candidate area:

| Data Point | Source | Notes |
|---|---|---|
| Population | ONS / Local authority | Min. 100,000 for viable HMO demand |
| Average income | ONS / NOMIS | Determines affordability and room rate ceilings |
| Demographic profile | ONS | Average age, professional/student split |
| Average purchase price | Rightmove / Zoopla / Land Registry | Sets entry cost |
| AST monthly rent | Rightmove / local agents | Single let income |
| HMO room rate (ensuite) | SpareRoom / local HMO agents | Premium room income |
| HMO room rate (non-ensuite) | SpareRoom | Standard room income |
| SA nightly rate (weekday) | AirDNA | Contractor/SA market |
| SA nightly rate (weekend) | AirDNA | Tourist/leisure market |
| SA average occupancy % | AirDNA | Key for SA viability check |

### Step 2 - Income Yield Calculation per Strategy

```
AST Yield (%) = (AST Annual Income / Average Purchase Price) × 100

HMO Yield (3-bed, %) = (HMO Room Rate × 3 × 12 / Average Purchase Price) × 100
HMO Yield (4-bed, %) = (HMO Room Rate × 4 × 12 / Average Purchase Price) × 100
HMO Yield (5-bed, %) = (HMO Room Rate × 5 × 12 / Average Purchase Price) × 100

SA Monthly Income = Nightly Rate × 30 × Occupancy %
SA Annual Income = SA Monthly Income × 12
SA Yield (%) = (SA Annual Income / Average Purchase Price) × 100
```

### Example: Three-City Comparison

| Metric | Bedford | Cheltenham | Gloucester |
|---|---|---|---|
| Population | 185,225 | 119,400 | 138,000 |
| Average Income | £34,000 | £37,000 | £33,000 |
| Avg. Purchase Price | £250,000+ | £333,000 | £232,000 |
| AST Monthly Rent | £1,250 | £1,210 | £1,066 |
| AST Annual Income | £15,000 | £14,520 | £12,792 |
| AST Yield | 6.0% | 4.4% | 5.5% |
| HMO Room Rate | £750 | £650 | N/A |
| HMO 3-bed Annual | £27,000 | £23,400 | N/A |
| HMO 3-bed Yield | 10.8% | 7.0% | N/A |
| SA Nightly Rate | £140 | £125 | N/A |
| SA Occupancy | 62% | 96% | N/A |
| SA Monthly Income | £2,604 | £2,912 | N/A |
| SA Annual Income | £31,248 | £34,944 | N/A |

---

## Area Scoring Criteria

### 1. Yield Score (0-10)

| Gross Yield Range | Score |
|---|---|
| Below 5% | 1-2 |
| 5-6% | 3-4 |
| 6-8% | 5-6 |
| 8-10% | 7-8 |
| 10%+ | 9-10 |

### 2. Demand Score (0-10)

Measure rental demand using SpareRoom:

| Signal | Low Demand | High Demand |
|---|---|---|
| Rentals on market | 400+ (oversupply) | Under 200 (tight) |
| HMO rooms for rent | 150+ | Under 75 |
| HMO rooms wanted | Under 50 | 70+ |

Demand Ratio = HMO Rooms Wanted / HMO Rooms For Rent
- Ratio > 0.5: healthy demand
- Ratio > 0.8: very strong demand

### 3. SA Market Score (0-10)

| SA Signal | Poor | Good | Excellent |
|---|---|---|---|
| AirDNA occupancy | <50% | 60-75% | 80%+ |
| Number of Airbnb listings | <100 | 200-500 | 500+ |
| Average daily rate | <£60 | £80-£150 | £150+ |
| Booking.com listings | <30 | 50-100 | 100+ |
| 10% rule pass | No | Marginal | Yes |

**10% Rule:** Monthly SA income (at 50% occupancy) > 10% of purchase price per year

### 4. Growth Score (0-10)

| Growth Indicator | Score Weight |
|---|---|
| Major infrastructure project announced | +3 |
| New employer / large company relocating | +2 |
| University expansion | +2 |
| Transport link improvement | +2 |
| Government regeneration zone | +2 |
| Starbucks expansion into area (proxy for gentrification) | +1 |
| Historical average price growth 5yr > 10% | +2 |
| Expected 5yr growth above 15% | +3 |

**"What is Starbucks doing?"** - Starbucks conducts extensive market research before opening. Their presence in an area signals strong population growth and spending power.

### 5. Regulatory Risk Score (0-10, higher = lower risk)

| Risk Factor | Impact |
|---|---|
| Article 4 Direction for HMO | -3 (limits HMO conversions) |
| SA planning restrictions (some councils) | -2 |
| High council tax for HMOs | -1 |
| Selective licensing scheme | -1 |
| No Article 4, no additional licensing | +3 |
| Strong HMO licensing team (signals established market) | +1 |

---

## Reference Area Profiles

### High-Yield Northern Cities

| Area | Strategy Fit | Avg. PP | HMO Yield | Notes |
|---|---|---|---|---|
| Hull | HMO, BTL | £130,000 | ~10% | High yield, lower area quality, significant industrial growth |
| Wolverhampton | BTL, HMO | £120,000 | 7-9% | Stable rental yield, lower entry costs |
| Manchester / Failsworth | HMO, BRR, SA | £232,000+ | 8-12% | Strong HMO and SA demand, contractor market |

### Mid-Market

| Area | Strategy Fit | Avg. PP | HMO Yield | Notes |
|---|---|---|---|---|
| Bedford | HMO, Contractor SA | £250,000+ | 8-10% | Disney Studios effect - major growth expected |
| Northampton | HMO | N/A | 6-8% | Alternative to Cambridge, strong HMO demand |
| Cheltenham | SA, BTL | £333,000 | 7% | Exceptional SA occupancy (96%), festivals |

### Higher Entry / Lower Yield

| Area | Strategy Fit | Avg. PP | HMO Yield | Notes |
|---|---|---|---|---|
| Cambridge | HMO (careful) | £460,000-£550,000 | 4-7% | Article 4 limits conversion, high demand |

---

## Area Due Diligence Checklist

### Online Research (Day 1)
- [ ] Rightmove / Zoopla: average purchase prices for target property type
- [ ] Rightmove / Zoopla: number of properties for sale (supply) and time on market
- [ ] SpareRoom: AST rentals on market, HMO rooms for rent, HMO rooms wanted
- [ ] AirDNA (or AllTheRooms): average daily rate, occupancy %, number of listings
- [ ] Google: major employers, planned developments, regeneration news
- [ ] Local council website: HMO licensing scheme, Article 4 directions
- [ ] UpMyStreet / Crime Rate: crime statistics, schools ratings

### On-the-Ground Research (Day 2)
- [ ] Drive the target postcodes - assess street-by-street property condition
- [ ] Visit local estate agents - build relationships, ask about off-market stock
- [ ] Speak to local letting agents - vacancy rates, tenant demand
- [ ] Visit local employers (hospitals, universities, industrial estates) - assess demand
- [ ] Note high street quality - Starbucks, Greggs, Pret, Costa presence = positive signal
- [ ] Check for planning notices on properties (potential deals or area changes)

---

## Quick Viability Decision Matrix

| Score | Recommendation |
|---|---|
| Combined score 35+ / 50 | Strong buy - make this your primary patch |
| Combined score 25-34 | Investigate further - could work for right strategy |
| Combined score 15-24 | Marginal - only proceed with exceptional deal |
| Combined score below 15 | Avoid - insufficient fundamentals |

---

## Strategy Selection by Area Profile

| Area Profile | Best Strategy |
|---|---|
| Low purchase price + high room rates | HMO (plain or BRR to HMO) |
| Low purchase price + strong AST demand | Single let / BTL |
| Low purchase price + fixer-upper stock | BRR to BTL or BRR to HMO |
| High SA occupancy + tourist/contractor mix | Buy-to-SA or R2R-to-SA |
| High prices + below-market deals only | BRR (add value to justify price) |
| Landlord fatigue area | R2R (approach reluctant landlords) |

---

## UK City Case Studies - Investment Snapshots

### Manchester

**Key indicators:**
- Substantial population growth, particularly young professionals and students
- Major universities create strong HMO demand
- Thriving economy: multinational companies, technology, finance, creative industries
- Well-connected: international airport, excellent rail links
- Northern Powerhouse Rail planned to further improve connectivity
- Strong rental market: city centre apartments, student accommodation, family homes
- Competitive rental yields for investors

**Best strategies:** HMO, BRR to HMO, SA (city centre), BTL (family areas)
**Note:** Manchester has implemented Article 4 direction in key areas - verify current postcodes before planning HMO conversion.

---

### Birmingham

**Key indicators:**
- Central UK location; affordable relative to London
- Strong population growth from domestic and international migration
- Major business and financial centre: professional services, banking, legal
- Growing technology and innovation sectors
- HS2 high-speed rail: significantly enhances connectivity to London and other cities
- Digbeth and Smithfield Quarter regeneration ongoing
- Strong rental market for city centre apartments and family homes

**Best strategies:** HMO (near universities), BRR to BTL, SA (city centre near HS2 station), BTL

---

### Bristol

**Key indicators:**
- Strong reputation as a vibrant, livable city
- Diverse economy: aerospace, creative industries, media, finance, technology
- Prestigious universities and research institutions; skilled workforce
- MetroBus expansion and ongoing infrastructure improvements
- Temple Quarter regeneration (major city centre project)
- Strong rental demand from students, young professionals, and families
- Higher property prices than northern cities; yields are lower but capital growth is strong

**Best strategies:** BTL (family homes), HMO (student areas), SA (city centre and waterfront)

---

## Risk Factors to Monitor

### 1. Market Volatility and Economic Uncertainty

- Changes in interest rates directly impact mortgage costs (see property-finance-explained.md)
- Property price fluctuations affect BRR refinance valuations
- Economic downturns reduce rental demand and increase void periods
- **Mitigation:** Always use conservative rental figures, not best-case projections; maintain 3-6 months of cash reserves

### 2. Regulatory Changes and Government Policies

- Tax law changes (Section 24 mortgage interest relief limitation is permanent and ongoing)
- Housing regulations and planning permission changes
- Article 4 directions restricting HMO conversion (monitor council planning portals)
- EPC minimum standard increases (planned increase to EPC Band C for rental properties)
- Renters Rights Act 2025 - changes to tenancy terms and eviction process
- **Mitigation:** Stay informed on policy changes; subscribe to NRLA, ARLA, and PropertyData updates

### 3. Local Area Risk Factors

| Risk Factor | What to Check | Sources |
|---|---|---|
| Oversupply | SpareRoom supply vs demand ratio; HMO rooms available vs wanted | SpareRoom, PropertyData |
| High crime rates | Area crime map data | Check My Street, PropertyWizz, Police.uk |
| Poor infrastructure | Planned transport improvements stalled or cancelled | Local council planning portal |
| Flood risk | EA flood zone rating; insurance costs | Environment Agency flood map |
| Environmental factors | Proximity to industrial sites, contaminated land | Planning portal, EA |
| Stalled regeneration | Plans exist but no groundwork started | Local council, planning portal |
| Over-concentration | Too many investors in same area | SpareRoom saturation ratio below 3.0 |

### 4. Assessing Future Regeneration Plans

When evaluating regeneration projects:
- Check if planning applications have been submitted (not just announced)
- Verify funding is secured (government or private)
- Confirm timelines are realistic (not just aspirational)
- Look for crane activity, planning notices, and groundwork as confirmation signals
