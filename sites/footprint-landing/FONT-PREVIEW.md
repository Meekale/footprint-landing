# Newspaper-style font preview

The website is previewing Newsreader across headings, body text, buttons, the wordmark, and feature previews. This is a newspaper-style serif interpretation, not a typeface named Newspaper.

Newsreader by Production Type is available under the SIL Open Font License: https://github.com/productiontype/Newsreader

The original DM Sans / Manrope font declarations remain unchanged in `dist/style.css`. The trial is isolated in `dist/font-trial.css`.

To restore the original fonts, remove the `font-trial.css` stylesheet link from `website.html`, `dist/*.html`, and the HTML templates in `create-legal.mjs`. No layout rollback is needed.
