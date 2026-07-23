# Anytime Anywhere Mobile Notary Services LLC, Website

A complete, premium, static website for a Metro Atlanta mobile notary business. It is built with plain HTML, CSS, and vanilla JavaScript, so it runs anywhere and hosts free on GitHub Pages. No build step and no paid frameworks are required.

## What is included

```
/
  index.html            Home
  services.html         Services
  service-areas.html    Service Areas
  pricing.html          Pricing
  faq.html              FAQs (with FAQ structured data)
  about.html            About Malika
  contact.html          Contact and appointment request form
  privacy.html          Privacy Policy and Accessibility Statement
  terms.html            Terms and Conditions
  404.html              Not-found page
  robots.txt
  sitemap.xml
  CNAME                 Custom domain for GitHub Pages
  README.md             This file
  /assets
    /css/styles.css     All styling
    /js/script.js       Mobile menu, auto copyright year
    /images
      logo.png            Your logo, optimized PNG fallback (already placed)
      logo.webp           Your logo, WebP (served to modern browsers)
      malika-headshot.png Your headshot, optimized PNG fallback (already placed)
      malika-headshot.webp Your headshot, WebP (served to modern browsers)
```

Navigation order: Home, Services, Service Areas, Pricing, FAQs, About, Contact, plus a Request an Appointment button.

---

## What is already set and what to check before launch

The earlier placeholders are now resolved. This is a short verification list, not a build list.

1. **Domain is set to `anytimenotarize.com`.** Every file (CNAME, canonical, Open Graph and Twitter URLs, `robots.txt`, `sitemap.xml`, and the email `malika@anytimenotarize.com`) uses this spelling. If you ever need to change it, do a find-and-replace across the project for `anytimenotarize.com`.

2. **Appointment form is a live Tally embed.** `contact.html` embeds your Tally form (`https://tally.so/embed/2EgR0D`) directly on the page under the Request an Appointment heading. Build out the form fields inside your Tally account and set email notifications to `malika@anytimenotarize.com`, then submit one test request to confirm it reaches you. See "Verify the appointment form" below.

3. **Google buttons are live.** The home page shows two buttons: View Our Google Business Profile (`https://share.google/ujK10B4cPxwi4Aszf`) and Leave a Review (`https://g.page/r/CTGr5maW50xMEAI/review`). Both open in a new tab.

4. **Prices** (optional edits). Starting prices are filled in on `pricing.html`. To change any figure, edit that one page. The Georgia notarial act fee is shown as $2 per act; that is the state maximum, keep it separated from your travel and convenience charges.

5. **Business hours** (optional edits). Hours on `contact.html` match your Google listing: Monday to Friday 9:00 to 5:00, Saturday 9:00 to 2:00, Sunday closed. Keep them matching Google.

6. **Reviews.** The home page reads "Client Reviews Coming Soon." Leave it until you have genuine Google reviews. Do not add invented reviews.

The copyright year updates automatically.

---

## Test the site locally

You do not need any special software. Two options:

- **Simplest:** double-click `index.html` to open it in your browser and click through every page.
- **Closer to production** (recommended): open a terminal in the project folder and run one of these, then visit `http://localhost:8000`:
  - `python3 -m http.server 8000`
  - or `npx serve`

Click every navigation link, the Call, Text, and Email buttons, the FAQ toggles, and submit the form with empty fields to confirm the validation messages appear.

## Check mobile responsiveness

In your browser, open Developer Tools (F12 or right-click, Inspect), then toggle the device toolbar (the phone/tablet icon). Try a narrow width such as 390 pixels. Confirm the hamburger menu opens and closes, the buttons stack, and text stays readable.

---

## Deploy to GitHub Pages

1. Create a new repository on GitHub (for a custom domain, any repository name is fine).
2. Upload every file and folder from this project, keeping the structure exactly as-is. The `index.html` must sit at the top level of the repository, not inside a subfolder.
3. In the repository, go to **Settings**, then **Pages**.
4. Under **Build and deployment**, set **Source** to "Deploy from a branch," choose your `main` branch and the `/ (root)` folder, then **Save**.
5. Wait a minute or two. GitHub will show your temporary address, usually `https://YOUR-USERNAME.github.io/YOUR-REPO/`. Open it and test.

## Connect your custom domain and turn on HTTPS

1. The included `CNAME` file already contains your domain. Confirm it shows the correct, verified domain.
2. At your domain registrar (where you bought the domain), add DNS records pointing to GitHub Pages:
   - Four `A` records for the root domain to: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - One `CNAME` record for `www` pointing to `YOUR-USERNAME.github.io`
3. Back in **Settings, Pages**, enter your domain in **Custom domain** and save. GitHub will verify it.
4. Once verified, check **Enforce HTTPS**. It can take a little time for the certificate to be issued. GitHub's own Pages documentation has current, detailed steps if a record format ever changes.

---

## Verify the appointment form

The Contact page embeds your Tally form directly on the page. It resizes to fit its content and shows no internal scroll bars. Before launch:

1. In your Tally account, open form `2EgR0D` and finish building the fields (contact details, appointment date and time, urgency, ZIP code, location type, service needed, signers, notarial acts, witnesses, printing, document type, a "How did you hear about us?" question, the "do not submit confidential information" warning, and a consent checkbox).
2. In Tally, go to Settings, then Emails, and turn on a notification to `malika@anytimenotarize.com` for every new submission. Optionally connect a Google Sheet so leads collect automatically.
3. Publish the form, then open the live Contact page and submit one test request. Confirm it reaches your email.

The on-page note asks visitors not to submit Social Security numbers, account numbers, ID images, medical records, or confidential documents. Keep an equivalent warning inside the Tally form itself as well.

## Add Google reviews later

Once you have genuine reviews:
1. Replace the "Client Reviews Coming Soon" text on `index.html` with real review quotes and the reviewer's first name and last initial, or embed a Google reviews widget.
2. The View Our Google Business Profile and Leave a Review buttons are already wired to your real links, so visitors can read and leave reviews now.

Use only real reviews. Do not add invented names, testimonials, or star ratings.

---

## Launch checklist

- [ ] Confirmed the domain reads `anytimenotarize.com` everywhere
- [ ] Logo and headshot display correctly on every page
- [ ] All navigation links, the mobile menu, and footer links work
- [ ] Call, Text, and Email buttons open the phone, messaging, and mail apps on a real phone
- [ ] FAQ toggles open and close
- [ ] Tally form built out, notifications sent to your email, and a test submission received
- [ ] Tally form displays on the Contact page with no horizontal scroll or cut-off fields on a phone
- [ ] Google Business Profile and Leave a Review buttons both open in a new tab
- [ ] Prices and hours reviewed and match your Google listing
- [ ] Reviewed all wording for accuracy; removed anything you cannot currently support
- [ ] Deployed to GitHub Pages and tested the temporary address
- [ ] Custom domain connected and HTTPS enforced
- [ ] Tested the live site on a phone

---

Notes on integrity: this site does not include invented reviews, fake credentials, license numbers, or seals. It states clearly that the business is not a law firm and does not provide legal advice. Loan signings are described only as attorney-supervised where legally permitted in Georgia. Please display only the credentials you currently hold, and keep every claim accurate.
