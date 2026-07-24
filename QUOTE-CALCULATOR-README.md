# Quote Calculator, setup and usage

Private internal tool for Anytime Anywhere Mobile Notary Services LLC.

## Files added

| File | Purpose |
|---|---|
| `quote-calculator.html` | The tool itself |
| `assets/css/quote-calculator.css` | Styling, built on your existing brand tokens |
| `assets/js/pricing-config.js` | **Every price lives here.** Single source of truth |
| `assets/js/quote-engine.js` | The calculation logic. Contains no prices |
| `assets/js/quote-calculator.js` | Form, saved quotes, dashboard, settings panel |

No existing page, stylesheet, script, image, favicon, sitemap entry, or navigation link was changed. All five files above are new.

## Test it locally

1. Unzip the folder somewhere on your computer.
2. Open a terminal in that folder and run one of these:
   - `python3 -m http.server 8000`
   - or `npx serve`
3. Visit `http://localhost:8000/quote-calculator.html`

You can also just double click `quote-calculator.html` to open it in a browser. Everything works that way except the browser may restrict local storage on some setups, so the local server method is more reliable for testing saved quotes.

## Upload to GitHub

1. Copy all five new files into your repository, keeping the same folder structure.
2. Commit and push:

```
git add quote-calculator.html assets/css/quote-calculator.css assets/js/pricing-config.js assets/js/quote-engine.js assets/js/quote-calculator.js
git commit -m "Add private notary quote calculator"
git push
```

Commit message, 35 characters: `Add private notary quote calculator`

GitHub Pages will publish it within a minute or two.

## Reaching the private page

Go directly to:

```
https://anytimenotarize.com/quote-calculator.html
```

It is not linked from any menu, it carries a `noindex, nofollow` tag, and it is not in your sitemap. Bookmark it, or add it to your phone home screen so it opens like an app.

### About security, read this part

**GitHub Pages cannot protect a private page.** Everything published to GitHub Pages is served publicly to anyone who requests the URL. A hidden or unlinked address is obscurity, not security. Anyone who learns the URL can open the page.

What this does and does not mean:

- Your **client data is not exposed by the URL.** Saved quotes live only in your own browser's local storage on your own device. They are never uploaded. Someone opening the URL sees an empty calculator, not your records.
- Your **pricing is visible** to anyone who finds the URL, since `pricing-config.js` is a public file.

The code is structured so real login protection can be added later without rewriting anything: the calculation, storage, and rendering layers are already separate from the page. When you want real protection, the practical options are moving this page to a host that supports password protection (Netlify, Cloudflare Pages, or Vercel all offer this), or putting it behind a small serverless login. Ask for this as a follow up when you are ready.

## Everything you can edit later

Open the tool and go to the **Pricing Settings** tab. Every item below has an editable amount and an on and off switch.

- Base service prices for all 25 services
- Travel zones, per mile rate, included miles, minimum trip charge
- Additional notarial act, additional signer, additional document charges
- Facility and location premiums
- Evening, weekend, holiday and custom timing prices
- Same day, rush, emergency and within two hours charges
- Waiting time rates, 15 minute and 30 minute blocks, and the included appointment time
- Witness coordination and per witness rates
- Printing rates for letter, legal and color, second copies, scanbacks, faxing, packaging, shipping labels, drop offs, pickups, returns and courier stops
- Apostille facilitation fees, additional document fees, rush handling, pickup, drop off, translation, certified copies
- Government apostille fees, kept separate from your income
- Loan signing additions, additional signers, additional properties, combinations, trust documents, faxbacks, re-signs, no print adjustments
- I-9 prices, additional employees, separate locations, portal handling, rush
- All seven discount types
- All fourteen cancellation and return trip charges
- Deposit defaults, tax rate, card processing adjustment
- Quote expiration period, pricing schedule version, effective date, home base address
- Every disclaimer paragraph

Press **Save pricing settings** when done. Use **Export pricing as JSON** to keep a backup, and **Import pricing JSON** to restore it or copy it to another device.

## Your data

- Quotes are saved in this browser on this device only.
- Nothing is transmitted to any server.
- Clearing your browser data, switching devices, or using private browsing will hide or erase saved quotes.
- Export a backup regularly from the Saved Quotes tab.
- The tool does not store and you should never enter identification numbers, Social Security numbers, passport numbers, document images, or financial account information.


## Version 2.0, approval gate

The calculator will not produce a client ready total unless every rate it needs is approved.

### Four pricing statuses

| Status | May create a client ready total? |
|---|---|
| Published and approved | Yes. Taken from your live pricing page |
| Approved internal rate | Yes. An approved $0.00 is an intentional zero and does not block |
| Proposed and awaiting approval | No. Shows as an internal estimate only |
| Custom quote required | No. Blocked until you enter an amount |

### What happens when something is missing

The quote shows **Incomplete quote** and **Final total unavailable**, lists every missing rate, and disables Copy total, Copy text quote, Copy email quote, Print or save as PDF, and Save quote. The text and email drafts produce an internal message instead of a customer message:

> Internal estimate incomplete. The following rates still require approval: [list].

Each missing rate appears with a box where you can type an amount **for that one appointment**. That unlocks the quote immediately and never changes your saved rate sheet.

Options you did not select never block a quote. Parking, tolls, valet, shipping, courier, and government costs are amounts you type per appointment and never block.

### First $2 statutory notarial fee

This is deliberately unset, so the calculator blocks every quote until you choose one of:

- **Included in the base appointment price.** A one act local appointment quotes $65.00
- **Added separately to the base appointment price.** The same appointment quotes $67.00

Set it once in Pricing Settings under Global rules.

### Estate, power of attorney, and business documents

These no longer carry their own $65 rate. Each defaults to the approved general mobile notary price, and each has its own setting: use the general mobile base price, use a separate approved price, or require a custom quote every time.

### Pricing Settings

Every row now shows the rate name, amount, enabled switch, pricing status, source, effective date, and notes, all editable. Use the **Show rates** filter for Needs approval, Custom quote required, Approved, Published, or All.

Current counts: 29 published and approved, 32 approved internal, 1 proposed, 95 custom quote required.
