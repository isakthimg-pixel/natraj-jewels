// Makes the printable customer information form:
//   customer-form-A5.pdf      one form per A5 page
//   customer-form-2-on-A4.pdf two forms side by side on an A4 sheet (cut down the middle)
// Run: node forms/make-pdf.js [output folder]   (needs Playwright with Chromium)
const path = require('path');
const fs = require('fs');
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { ({chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright')); }

(async () => {
  const out = process.argv[2] || __dirname;
  const src = 'file://' + path.join(__dirname, 'customer-form.html');
  const b = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? {executablePath: '/opt/pw-browsers/chromium'} : {});
  const p = await b.newPage();
  await p.goto(src); await p.evaluate(() => document.fonts.ready);
  await p.pdf({path: path.join(out, 'customer-form-A5.pdf'), format: 'A5', printBackground: true, margin: {top: 0, right: 0, bottom: 0, left: 0}});
  await p.screenshot({path: path.join(out, 'customer-form-preview.png'), fullPage: true});
  // two copies on one landscape A4
  await p.evaluate(() => {
    const s = document.querySelector('.sheet'); s.after(s.cloneNode(true)); document.body.classList.add('two-up');
    const st = document.createElement('style'); st.textContent = '@page{size:297mm 210mm;margin:0}'; document.head.appendChild(st);
  });
  await p.pdf({path: path.join(out, 'customer-form-2-on-A4.pdf'), preferCSSPageSize: true, printBackground: true});
  await b.close();
  console.log('made the PDFs in', out);
})();
