# Modified IRR: A More Realistic Way to Calculate Property Returns

Published: Wed, 25 Aug 2027 09:00:00 +0000
Category: Calculations
Slug: modified-irr-a-more-realistic-way-to-calculate-property-returns

---

MIRR addresses the main weakness of IRR. IRR assumes you reinvest interim cashflows at the IRR rate. If the IRR is 12%, it assumes you reinvest your annual cashflows at 12%, which is often unrealistic. MIRR lets you specify a separate reinvestment rate and finance rate, giving a more realistic return.\n\nFor our BTL example, the IRR might be 9.5%. But you can only reinvest annual cashflows at 5%, and your cost of finance is 6%. Using these rates, the MIRR might be 7.8%. That is lower than the IRR because the reinvestment rate assumption is more realistic.\n\nMIRR is particularly useful for flipping and development, where cashflows are uneven. A flip with a large cash outflow at the start, no income for six months, and a large cash inflow at the end has an IRR that depends heavily on timing. MIRR gives a more conservative and realistic picture.\n
When presenting investment returns to a partner or lender, consider using MIRR instead of IRR. It is more conservative and more realistic. A good MIRR is one that exceeds your cost of capital by a meaningful margin.

**The formula**

```
MIRR = (FV(positive CFs at reinvestment rate) / PV(negative CFs at finance rate))^(1/n) - 1
```

**Why this matters**

MIRR is more realistic than IRR because it uses a separate reinvestment rate. For most property investments, MIRR will be 1% to 3% lower than IRR. Use it for a conservative assessment.

Running these calculations before you buy is the difference between a good investment and an expensive lesson. Xelox Properties can help you evaluate any deal.

---
*Calculation post #134 of 174*