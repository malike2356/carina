# Property Area Research Prompt Frameworks for Carina

## Purpose

These prompt frameworks are designed for Carina's property research mode. They can be used by Carina when conducting AI-assisted area analysis, or provided to users as starting points for their own research using AI tools.

All prompts are structured to extract practical investment intelligence, not generic commentary.

---

## Prompt Framework 1 - Overall Area Investment Analysis

**Use when:** Starting research on a new target town or city for property investment.

```
I am a UK property market research specialist advising a professional investor.

Analyse [AREA NAME] from a property investment perspective for buy-to-let, 
rent-to-rent, HMOs, and serviced accommodation.

Please provide:

1. Population & Demographics - total population, working-age profile (25-55), 
   and household types relevant to rental demand.

2. Income & Employment - typical earnings, key employment sectors, and overall 
   economic stability.

3. Rental Demand - tenant types, average rent for a 3-bed terraced AST, and 
   which strategies perform best locally (BTL, HMO, R2R, SA).

4. Property Prices - average purchase price for a 3-bed terrace, typical price 
   ranges, and yield implications.

5. Investor Verdict - strengths, risks, and which investor profiles this area suits.

Use UK data sources where possible and focus on practical investment insight, 
not generic commentary.
```

### Output to Expect
- Population figure and age profile
- Top 3 employment sectors and major employers
- Average BTL rent (3-bed AST)
- Average HMO room rate (where applicable)
- Average purchase price range for target property types
- Which strategies work best in this area (BTL/HMO/R2R/SA)
- Key risks (Article 4, Article 4 direction, oversupply, planning restrictions)

---

## Prompt Framework 2 - Historical and Projected Growth Analysis

**Use when:** You've identified an area and want to see growth trajectory and future prospects.

```
You are a property research expert. I'd like your help with further research 
about the statistical growth of [AREA NAME].

Please provide:
1. Growth statistics for rental prices and average house prices year by year 
   since 2020, through to today.
2. Your best projections for the next 5 years, with reasoning.
3. Any planned government investment, regeneration schemes, or funding in 
   the area.
4. Future employment opportunities - planned businesses, major employers 
   relocating, new industries.
5. University expansion or new educational institutions.
6. Major infrastructure projects planned or under construction.
```

### What to Look For in the Response
- Year-on-year price growth since 2020 (strong areas: 3-8%+ pa consistently)
- Projected growth above UK average (signals above-average returns)
- Named government or private regeneration schemes
- New employers or major business relocations into the area
- Transport infrastructure improvements

---

## Prompt Framework 3 - Commercial Chain Expansion Research ("What Is Starbucks Doing?")

**Use when:** You want to validate an area's growth trajectory using corporate expansion as a proxy signal.

**Background:** Major retail and hospitality chains conduct extensive market research before opening new locations. They plan 5-10 years ahead. If chains like Starbucks, Pret, Greggs, or Premier Inn are expanding into an area, it is a strong signal of planned population and footfall growth.

```
I'm looking to invest and build a property business in [AREA NAME] and I want 
to understand what major chains and companies are doing in the area.

1. Are companies like Starbucks, Wetherspoons, Pret a Manger, McDonald's, 
   or Costa expanding their presence in [AREA NAME]? List any new openings 
   or planned expansions in the last 2 years.

2. What are major hotel chains doing in the area? Are there any plans to 
   develop or build new hotels (Premier Inn, Travelodge, Holiday Inn, 
   CitizenM, IHG, Hilton)?

3. Are there any large retail or commercial developments planned for 
   [AREA NAME] - new shopping centres, retail parks, business parks, 
   or commercial zones?

4. What does the commercial development pipeline say about where growth 
   is headed in this area over the next 5-10 years?

Focus on concrete evidence of commercial confidence in the area. These companies 
plan based on demographic and footfall data - their investment signals long-term 
area growth.
```

### Why This Matters for Property Investment
- Coffee shops and fast-food chains signal strong pedestrian footfall and demographics
- Hotel chains signal demand for short-stay accommodation → validates SA strategy
- New retail or business parks signal employment growth → supports rental demand
- All of these signal an area that will attract more residents → upward pressure on rents and prices

---

## Prompt Framework 4 - Quick Deal Area Validation

**Use when:** You have a specific deal and want to quickly validate whether the area supports the investment strategy.

```
I'm evaluating a property investment in [POSTCODE/AREA].

Property type: [3-bed terraced house / 5-bed HMO / flat etc.]
Proposed strategy: [BTL / HMO / SA / R2R / BRR to HMO]
Asking price: £[Amount]
Expected rent: £[Amount] per month

Please help me validate:
1. Is the proposed rent realistic for this area and property type? What do 
   comparable properties rent for?
2. Is there genuine rental demand in this postcode/area?
3. Are there any regulatory risks I should be aware of (Article 4 for HMO, 
   SA planning restrictions, selective licensing)?
4. What is the typical vacancy rate for rentals in this area?
5. Is the proposed strategy (BTL/HMO/SA) well-suited to this location?
```

---

## Prompt Framework 5 - HMO-Specific Area Research

**Use when:** Considering an HMO strategy in a new area.

```
I am researching [AREA NAME] for HMO property investment.

Please provide:
1. Is there a selective licensing scheme in [COUNCIL NAME] for HMOs? 
   What are the current licensing fees and requirements?
2. Has [COUNCIL NAME] implemented an Article 4 direction restricting 
   HMO conversions (C4 to sui generis)? If so, which postcodes or areas?
3. What is the typical HMO room rate for:
   - Standard room (non-ensuite)
   - Ensuite room
   - Premium/luxury room
4. Who are the typical HMO tenants in this area - young professionals, 
   students, contractors, or mixed?
5. What is the current HMO supply and demand? How many HMO rooms are 
   advertised on SpareRoom vs how many are wanted?
6. Which postcodes within [AREA NAME] are best for HMO demand?
```

---

## Prompt Framework 6 - Serviced Accommodation Market Research

**Use when:** Considering SA or R2R-to-SA strategy in an area.

```
I am researching the serviced accommodation market in [AREA NAME].

Please provide:
1. What is the average daily rate (ADR) for serviced accommodation in 
   [AREA NAME] on Airbnb and Booking.com?
2. What is the average occupancy rate for SA properties in this area?
3. Is the demand primarily:
   - Leisure / tourist
   - Corporate / contractor
   - Mixed
4. Are there major employers, hospitals, universities, or industries 
   nearby that drive contractor/corporate demand?
5. Are there any local council restrictions on short-term letting 
   in [AREA NAME] that I should be aware of?
6. What is the typical minimum stay preference in this market?
7. Based on average ADR and occupancy, what monthly revenue could a 
   3-bed property expect at 50%, 65%, and 80% occupancy?
```

---

## How Carina Should Use These Frameworks

When a user asks Carina to research an area for investment, Carina should:

1. Use Framework 1 for an initial broad overview
2. Follow up with Framework 2 for growth trajectory
3. Use Framework 3 to validate corporate expansion signals
4. Use Framework 5 or 6 depending on the strategy being considered

Carina should present area research in a structured format:
- Headline verdict first (is this area suitable for the stated strategy?)
- Population, income, and employment context
- Rental market data with specific numbers
- Purchase price ranges and yield calculations
- Regulatory risks (Article 4, licensing)
- Recommended strategy or strategies
- Growth signals and commercial investment evidence
