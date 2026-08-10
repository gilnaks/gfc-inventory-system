# Intercompany Delivery Playbook — Cost + Margin

Use this for the **first documented end-to-end transfer** (Phase 3) and as reference until the **Accounting → Intercompany** module is used for all transfers.

## Prerequisites

- GFC brand exists with intercompany COA (1111–1113, 4510, 5510, 4520)
- Destination brand has Due to GFC (2115) and Inventory (1200)
- FG physically packed and counted at plant
- Transfer price sheet agreed (e.g. 15% markup on cost)

## Step 1 — Physical shipment

1. Pick FG from GFC finished goods
2. Record qty per SKU on a delivery note
3. Note unit **cost** (from production / BOM rollup) per line

## Step 2 — Calculate transfer price

For each line:

```
Transfer price = Unit cost × (1 + Markup %)
Line total price = Qty × Transfer price
Line total cost = Qty × Unit cost
```

Example: 100 pcs @ ₱50 cost, 15% markup → ₱57.50 transfer price → ₱5,750 price / ₱5,000 cost.

## Step 3 — GFC books (manual JE or Intercompany module)

**Date:** shipment date  
**Memo:** `ICT to [Brand] — [delivery note #]`

| Account | Debit | Credit |
|---------|-------|--------|
| Due from [Brand] | Line totals (price) | |
| Intercompany Sales | | Line totals (price) |
| Intercompany COGS | Line totals (cost) | |
| Inventory | | Line totals (cost) |

## Step 4 — Brand books

**Date:** receipt date (same or +1 day per policy)  
**Memo:** `Receipt from GFC — [delivery note #]`

| Account | Debit | Credit |
|---------|-------|--------|
| Inventory | Line totals (price) | |
| Due to GFC | | Line totals (price) |

## Step 5 — Inventory

- Reduce GFC product `production` (or FG pool) by shipped qty
- Increase destination brand product `production` by received qty
- *(Automated when using Accounting → Intercompany → Post transfer)*

## Step 6 — Settlement

When brand pays GFC:

**Brand:** Dr Due to GFC / Cr Cash  
**GFC:** Dr Cash / Cr Due from [Brand]

Or net monthly across brands.

## Reconciliation (monthly)

- Sum **Due from [each brand]** on GFC = Sum **Due to GFC** on each brand (before settlement)
- Investigate any imbalance before closing the period

## First transfer sign-off

| Item | Date | Initials |
|------|------|----------|
| Physical count | | |
| GFC JE # | | |
| Brand JE # | | |
| Inventory updated | | |
