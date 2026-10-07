# Printable forms

- `customer-form.html` — the customer information form (A5, English and Tamil). Its questions match
  **Customers → Enter a form** in the app, in the same order.
- `customer-form-A5.pdf` — one form per A5 page.
- `customer-form-2-on-A4.pdf` — two forms side by side on a landscape A4 sheet; cut down the middle.
- To remake the PDFs after editing the HTML: `node forms/make-pdf.js` (needs Playwright and Chromium).
- Fonts (Noto Sans, Noto Sans Tamil, Playfair Display) are in `fonts/` under the SIL Open Font License.
