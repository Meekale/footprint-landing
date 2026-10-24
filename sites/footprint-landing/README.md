# Footprint landing page

Static, responsive landing page. Serve `dist/` with any static web server. Run `node create-legal.mjs` after changing legal page content. Hosting configuration is in `.openai/hosting.json`.

The app screenshots, route statistics, squad members, and event are illustrative. Store buttons and social buttons open clear coming-soon notices until verified URLs are supplied. Update `dist/app.js` and the landing page buttons with official URLs before launch.

Privacy and terms now use copy adapted from the supplied screenshots. Edit `privacy-content.html` and `terms-content.html`, then regenerate with `node create-legal.mjs`. See `POLICY-REVIEW.md` for source inconsistencies and the missing request-form destination. Community guidelines remain a draft. The website does not directly process data requests; privacy requests use the supplied email contact.

The landing page loads fonts from Google Fonts and a landscape photo from Unsplash; the cookie information page discloses these requests. The page itself uses no analytics, browser storage, or forms.
