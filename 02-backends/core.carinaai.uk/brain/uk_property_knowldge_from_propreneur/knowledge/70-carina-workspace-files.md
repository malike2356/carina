# Carina Workspace Files

Carina loads three workspace files at the start of every session. These files give Carina persistent context about you and your portfolio, so you do not need to re-explain your strategy in every conversation.

Files are stored in your tenant workspace at `storage/app/tenants/{slug}/workspace/`. Initial templates are created with `php artisan carina:init-workspace {slug}`. Edit them on the server (SSH or file manager) until the Settings workspace editor is available.

## PROPERTY_PROFILE.md
Who you are as an investor: your strategy, current portfolio, available capital, tax structure, and goals.

## COMPLIANCE_RULES.md
Your active HMO licences, local authority rules, and upcoming compliance deadlines.

## DEAL_CRITERIA.md
What makes a good deal for you: target yield, price range, areas, strategy, and deal breakers.

Keep these files updated. The more accurate they are, the better Carina's deal analysis and advice will be.
