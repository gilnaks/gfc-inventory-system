# GFC Factory Rollout — Operating SOP (Consolidated Books)

## Entity roles

| Brand | Role | Use for |
|-------|------|---------|
| **GFC Main** | Company / plant / **sole legal ledger** | Accounting, Payroll, Procurement, Factory, Attendance, Fleet; all GL journals |
| **Gelatofilipino, MyChoice, Mang Sorbetes** | Retail / franchise (ops only) | Products, orders, branches, logistics, DSIR, transfer sheets, store reports |

Legal name on all books: **GILNAKS FOOD CORPORATION** (GFC Main ledger).

Franchise brands are **performance segments**, not separate books. Journals carry `franchise_brand_id` so HQ can filter franchise P&L / AR / payroll / POs.

## Module access

| Module | Where |
|--------|--------|
| Accounting / Payroll / Procurement | **GFC Main only** |
| Factory / Attendance / Fleet | **GFC Main only** |
| Inventory / Orders / Logistics / DSIR / Reports / Branches | Retail franchise brands |

## Parallel cutover rules

1. **New** plant materials and purchase orders → **GFC** (or franchise-tagged under GFC Procurement filter)
2. Legacy plant materials on consumer brands are **read-only** (stock visible, depletes naturally)
3. Production schedules use the **GFC product catalog**; each line tags the **destination consumer brand** (`for_brand_id`)
4. Finished goods inventory and production journals stay on **GFC**; franchise tag = destination brand when applicable
5. BOM lines on GFC products reference **GFC materials**
6. **Prospective books cutover:** new journals post to GFC Main with `franchise_brand_id`. Historical retail-brand journals remain frozen/hidden.

## Brand selector guide

- **Accounting / Payroll / Procurement / Factory** → select **GFC Main**, then use the **Franchise** filter inside the module
- **Products / Orders / DSIR / Branches / store ops** → select the franchise brand

### Production schedule (GFC-only)

1. Open **Factory** → pick destination brand subtab (Gelato / MyChoice / Mang Sorbetes)
2. Add **GFC SKUs** to the schedule for that brand
3. Print stickers (product_id = GFC product) → floor scan increases **GFC** `production` only
4. Batch complete posts a **production journal on GFC** (franchise tag = `for_brand_id` when set)
5. Ship FG to a brand via **Intercompany transfer** (mapping resolves retail SKU)

## Intercompany transfer posting (consolidated)

Policy for **new** cost transfers: **single journal on GFC Main**, tagged with the receiving franchise.

| Line | Account | Dr | Cr |
|------|---------|----|----|
| 1 | Intercompany COGS (5510) | Cost | |
| 2 | Inventory (1200) | | Cost |

Ops transfer rows (`intercompany_transfers`) still record from/to brands. There is **no second retail ledger journal**.

Legacy markup transfers may still settle Due from / cash on GFC Receivables (Transfer receivables panel).

## Cycle counts

- **Materials cycle count** → GFC books (HQ)
- **Product cycle count** → posts to GFC books with franchise tag from the product’s operational brand

## Payroll

All accruals and payments post to **GFC Main** books.

- Factory floor staff (`is_factory_floor`) → franchise tag null / HQ
- Store / branch staff → `franchise_brand_id` = location’s retail brand (`payroll_run_brand_totals.brand_id`)

Use the Franchise filter on Payroll to review brand performance.

## Sales / customer orders

Order fulfillment and cash collection post revenue / AR / COGS / cash on **GFC Main**, with:

- `franchise_brand_id` = order’s retail brand
- `location_id` on journal lines when available

Receivables on GFC shows **Customer orders** and **Franchise transfer receivables**, both filterable by franchise.
