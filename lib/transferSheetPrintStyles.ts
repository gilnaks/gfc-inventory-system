/**
 * Print styles tuned for dot matrix / impact printers: Courier (10–12 CPI style),
 * bold weight, pure black, no font smoothing, thicker borders.
 */
export const TRANSFER_SHEET_PRINT_STYLES = `
  * { box-sizing: border-box; }

  body,
  .receipt-container {
    font-family: Courier, 'Courier New', 'Liberation Mono', 'DejaVu Sans Mono', Consolas, monospace;
    font-size: 12px;
    font-weight: 700;
    -webkit-font-smoothing: none;
    -moz-osx-font-smoothing: unset;
    font-smooth: never;
    text-rendering: geometricPrecision;
  }

  body {
    margin: 0;
    padding: 10px 0.25in 8px 8px;
    background: #fff;
    color: #000;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .receipt-container {
    max-width: 100%;
    width: 100%;
    margin: 0;
    background: #fff;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .header {
    text-align: center;
    padding: 10px 12px;
    background: #fff;
    color: #000;
    border-bottom: 1px solid #000;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .company-name {
    font-size: 26px;
    font-weight: 900;
    color: #000;
  }

  .receipt-title {
    font-size: 17px;
    font-weight: 900;
    color: #000;
    text-transform: uppercase;
  }

  .generated-date {
    font-size: 12px;
    font-weight: 700;
    color: #000;
    text-align: center;
    flex: 1;
  }

  .order-info {
    padding: 8px 12px;
    background: #fff;
    border-bottom: 1px solid #000;
  }

  .info-grid {
    display: grid;
    gap: 6px 12px;
    align-items: start;
  }

  /* One header row: wider location column, no auto-wrap to second grid row */
  .info-grid-cols-4 {
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1fr) minmax(0, 2.2fr) minmax(0, 0.85fr);
  }

  .info-grid-cols-5 {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 0.95fr) minmax(0, 1.6fr) minmax(0, 1.2fr) minmax(0, 0.8fr);
  }

  .info-item {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .info-item-location .info-value {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .info-label {
    font-weight: 900;
    color: #000;
    font-size: 13px;
    text-transform: uppercase;
    margin-bottom: 2px;
  }

  .info-value {
    font-weight: 700;
    color: #000;
    font-size: 15px;
  }

  .status-badge {
    display: inline-block;
    padding: 2px 6px;
    border: 1px solid #000;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .status-pending,
  .status-approved,
  .status-cancelled {
    background: #fff;
    color: #000;
  }

  .status-fulfilled {
    background: #000;
    color: #fff;
  }

  .items,
  .items-section {
    padding: 8px 12px;
    flex: 1 1 auto;
    background: #fff;
  }

  .items.items-multi-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    align-items: start;
  }

  .items-multi-column > .items-column {
    display: flex;
    flex-direction: column;
    min-width: 0;
    width: 100%;
  }

  .items-title {
    font-size: 15px;
    font-weight: 900;
    margin-bottom: 6px;
    color: #000;
    text-transform: uppercase;
  }

  .items-header {
    display: grid;
    gap: 6px;
    padding: 6px 0;
    border-bottom: 1px solid #000;
    margin-bottom: 4px;
    background: #fff;
    font-weight: 900;
    font-size: 13px;
    color: #000;
    text-transform: uppercase;
  }

  /* Single column: checkbox | item | sku | qty */
  .items:not(.items-multi-column) .items-header,
  .items:not(.items-multi-column) .item-row {
    grid-template-columns: 24px 2fr 1fr 0.9fr;
  }

  /* Single column with price columns */
  .items.items--with-prices:not(.items-multi-column) .items-header,
  .items.items--with-prices:not(.items-multi-column) .item-row {
    grid-template-columns: 24px 2fr 1fr 0.9fr 0.85fr 0.85fr;
  }

  /* Two columns (>15 items): fixed tracks so headers align with row cells */
  .items-multi-column .items-header,
  .items-multi-column .item-row {
    width: 100%;
    grid-template-columns: 22px minmax(0, 1fr) 42px;
    column-gap: 6px;
  }

  .items.items--with-prices.items-multi-column .items-header,
  .items.items--with-prices.items-multi-column .item-row {
    /* Fixed width for price/total; item column takes only remaining space */
    grid-template-columns: 20px minmax(0, 1fr) 32px 74px 80px;
    column-gap: 4px;
  }

  .items.items--with-prices.items-multi-column .header-price,
  .items.items--with-prices.items-multi-column .header-total,
  .items.items--with-prices.items-multi-column .item-unit-price,
  .items.items--with-prices.items-multi-column .item-price {
    white-space: nowrap;
  }

  .items-multi-column .header-checkbox,
  .items-multi-column .item-checkbox {
    justify-self: center;
  }

  .items-multi-column .header-item,
  .items-multi-column .item-name-cell {
    justify-self: stretch;
    min-width: 0;
  }

  .items-multi-column .header-qty,
  .items-multi-column .item-quantity {
    justify-self: center;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .items-multi-column .header-price,
  .items-multi-column .item-unit-price {
    justify-self: center;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .items-multi-column .header-total,
  .items-multi-column .item-price {
    justify-self: end;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .items-multi-column .item-name {
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .header-cell {
    font-size: 13px;
    font-weight: 900;
    color: #000;
    text-transform: uppercase;
  }

  .header-checkbox { text-align: center; }
  .header-item { text-align: left; }
  .header-sku { text-align: left; font-weight: 900; }
  .header-qty { text-align: center; }
  .header-price { text-align: center; }
  .header-total { text-align: right; }

  .item-checkbox {
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .checkbox {
    width: 12px;
    height: 12px;
    border: 1px solid #000;
    background: #fff;
  }

  .items-section .item-checkbox {
    width: 14px;
    height: 14px;
    border: 1px solid #000;
    background: #fff;
    flex-shrink: 0;
  }

  .item-row {
    display: grid;
    gap: 6px;
    align-items: center;
    padding: 3px 0;
    font-size: 13px;
    font-weight: 900;
    min-height: 20px;
    color: #000;
  }

  .item-name-cell {
    min-width: 0;
  }

  .item-name {
    font-weight: 900;
    color: #000;
    font-size: 14px;
  }

  .item-sku-col {
    font-size: 14px;
    font-weight: 900;
    color: #000;
    word-break: break-all;
  }

  .items .header-sku,
  .items .item-sku-col {
    font-weight: 900;
  }

  .item-quantity,
  .item-qty {
    text-align: center;
    font-weight: 900;
    color: #000;
    font-size: 15px;
  }

  .items-multi-column .item-quantity {
    min-width: 0;
    padding: 0 2px;
  }

  .item-unit-price {
    text-align: center;
    font-weight: 900;
    color: #000;
    font-size: 14px;
  }

  .item-price {
    text-align: right;
    font-weight: 900;
    color: #000;
    font-size: 14px;
  }

  .header-cell.header-qty {
    font-weight: 900;
  }

  .total-section {
    padding: 8px 12px;
    background: #fff;
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
    font-weight: 900;
    margin-top: auto;
    flex-shrink: 0;
  }

  .total-section-two-col {
    display: grid;
    grid-template-columns: 1fr minmax(220px, 40%);
    gap: 12px 20px;
    align-items: start;
  }

  .total-section-three-col {
    display: grid;
    grid-template-columns: 1fr minmax(220px, 34%) minmax(132px, 20%);
    gap: 12px 16px;
    align-items: stretch;
  }

  .total-section-breakdown {
    min-width: 0;
  }

  .total-section-grand {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    border-left: 1px solid #000;
    padding-left: 16px;
    min-width: 220px;
    width: 100%;
  }

  .total-section-qr {
    border-left: 1px solid #000;
    padding-left: 12px;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    min-width: 0;
  }

  .total-qr-box {
    width: 100%;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    text-align: center;
  }

  .total-qr-image {
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;
    max-width: 100%;
    object-fit: contain;
    object-position: center top;
    display: block;
    border: 1px solid #000;
    background: #fff;
    flex: 0 0 auto;
  }

  .total-qr-caption {
    margin-top: 4px;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .total-qr-empty {
    font-size: 11px;
    text-transform: uppercase;
    color: #000;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .total-grand-block {
    text-align: right;
    margin-bottom: 10px;
  }

  .total-grand-label {
    font-weight: 900;
    color: #000;
    font-size: 14px;
    text-transform: uppercase;
    margin-bottom: 4px;
    display: block;
  }

  .total-grand-value {
    font-weight: 900;
    color: #000;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    display: block;
  }

  .total-remarks-box {
    width: 100%;
    margin-top: 4px;
    flex: 1;
  }

  .total-remarks-area {
    border: 1px solid #000;
    min-height: 88px;
    padding: 6px 8px;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .total-remarks-label {
    font-weight: 900;
    color: #000;
    font-size: 12px;
    text-transform: uppercase;
    margin-bottom: 6px;
    flex-shrink: 0;
  }

  .total-remarks-text {
    font-weight: 700;
    color: #000;
    font-size: 13px;
    line-height: 1.35;
    word-break: break-word;
    overflow-wrap: anywhere;
    flex: 1;
    min-height: 48px;
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
    font-weight: 900;
    color: #000;
  }

  .total-label {
    font-weight: 900;
    color: #000;
    font-size: 14px;
  }

  .total-value {
    font-weight: 900;
    color: #000;
    font-size: 14px;
  }

  .grand-total {
    border-top: 1px solid #000;
    padding-top: 6px;
    margin-top: 6px;
  }

  .grand-total .total-label {
    font-size: 16px;
    font-weight: 900;
  }

  .grand-total .total-value {
    font-size: 17px;
    font-weight: 900;
    color: #000;
  }

  .footer {
    text-align: center;
    padding: 8px 12px;
    background: #000;
    color: #fff;
    margin-top: auto;
    font-weight: 900;
  }

  .footer-text {
    font-size: 13px;
    font-weight: 900;
    margin-bottom: 2px;
  }

  .footer-date {
    font-size: 12px;
    font-weight: 700;
  }

  .notes {
    padding: 8px 12px;
    background: #fff;
    border: 1px solid #000;
    margin: 0 12px 8px;
  }

  .notes-title {
    font-weight: 900;
    color: #000;
    margin-bottom: 4px;
    font-size: 14px;
    text-transform: uppercase;
    border-bottom: 1px solid #000;
    padding-bottom: 4px;
  }

  .notes-text {
    color: #000;
    font-size: 13px;
    font-weight: 700;
  }

  .signatories {
    flex-shrink: 0;
    margin-top: 0;
    padding: 32px 12px 4px;
  }

  .signatories-row {
    display: grid;
    gap: 12px;
    margin-bottom: 12px;
  }

  /* Cols 1–2: prepared/checked/delivered/received; cols 3–4: departure/arrival/time/empty pans */
  .signatories-row-top,
  .signatories-row-bottom {
    grid-template-columns: 1fr 1fr 0.5fr 0.5fr;
  }

  .signatories-row .signatory-item:nth-child(3) {
    margin-left: 20px;
  }

  .signatories-row-bottom:last-child {
    margin-bottom: 0;
  }

  .signatory-item {
    text-align: center;
  }

  .signatory-label {
    font-size: 13px;
    color: #000;
    margin-bottom: 20px;
    font-weight: 900;
  }

  .signatory-line {
    border-bottom: 1px solid #000;
    height: 20px;
    margin-bottom: 4px;
  }

  .signatory-name {
    font-size: 12px;
    color: #000;
    font-weight: 700;
  }

  @page {
    margin: 10px 0.25in 0 0;
    size: auto;
  }

  @media print {
    html,
    body {
      margin: 0 !important;
      padding: 10px 0.25in 8px 8px !important;
      height: 100%;
      font-family: Courier, 'Courier New', 'Liberation Mono', 'DejaVu Sans Mono', Consolas, monospace !important;
      -webkit-font-smoothing: none !important;
      font-smooth: never !important;
    }

    .receipt-container {
      box-shadow: none;
      min-height: calc(100vh - 16px);
      min-height: calc(100% - 16px);
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      -webkit-font-smoothing: none !important;
    }
  }
`

/**
 * Wait for QR/images to decode before opening the print dialog, then close after print/cancel.
 * Fixes blank QR on the first Print Transfer Sheet click.
 */
export const TRANSFER_SHEET_PRINT_SCRIPT = `
  window.addEventListener('afterprint', function () {
    window.close();
  });
  function waitForImages() {
    var imgs = Array.prototype.slice.call(document.images || []);
    if (!imgs.length) return Promise.resolve();
    return Promise.all(imgs.map(function (img) {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(function (resolve) {
        img.onload = function () { resolve(); };
        img.onerror = function () { resolve(); };
      });
    }));
  }
  window.addEventListener('load', function () {
    waitForImages().then(function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 50);
    });
  });
`
