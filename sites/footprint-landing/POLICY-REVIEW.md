# Screenshot-based policy update

The privacy policy and terms were adapted from the screenshots supplied on October 22, 2026. They retain the numbered structure, stated practices, contact information, and principal provisions in readable web copy. They are not word-for-word transcriptions or a legal compliance review.

Source documents are `privacy-content.html` and `terms-content.html`. Run `node create-legal.mjs` to regenerate the published HTML in `dist/`. Avoid editing only the generated pages.

## Items visible in the supplied privacy document

- The summary says no information is collected from third parties, while the social-login sections describe receiving profile information from providers. Both statements have been retained for operator review.
- The twelve-month collection table says No for identifiers, payment information, network activity, and geolocation, while the collection sections describe collecting these types of information. The table is preserved as supplied; confirm whether it describes a prelaunch history or needs correction.
- General privacy inquiries, appeals, and UK complaints use `amp10432@nyu.edu`. The request and final contact sections use `michaelshih2007@gmail.com`. Both addresses are retained in their respective contexts.
- The screenshots show the label for a data subject access request form but do not reveal its URL. Request links therefore lead to the request instructions and an explicitly labeled email request. No form service or submission backend was invented.
- Parts of the original document fall between screenshot boundaries, including the text following the twelve-month collection table's retention introduction. Only visible information was adapted; no missing retention duration was invented.
- Cookie information distinguishes the app's supplied tracking disclosure from the current landing page's separate cookie policy.

## Terms

- The terms screenshots do not show a last-updated date. No effective or update date was invented for the terms page.
- The supplied terms' company registration, address, payment methods, account features, support responsibilities, and legal provisions are represented as user-supplied statements, not independently verified facts.
- The screenshot's AAA link destination is not visible. The terms link to the AAA website without claiming to verify its current rules.

## Other existing launch pages

The data deletion, support, accessibility, and community pages retain their separate launch status. The privacy policy now supplies contact details, but implementation of an authenticated deletion flow and other app functionality has not been verified from this landing-page workspace.
