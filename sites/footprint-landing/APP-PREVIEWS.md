# Interactive feature previews

The five landing-page cards contain live interactive previews. The screenshot tabs, captured-image views, and screenshot zoom dialog were removed at the user's request.

Each preview uses a compact canvas that automatically fits its phone placeholder. The fit updates when the viewport, tab, font, or content height changes, so the full demo and its controls are visible without inner scrolling.

Controls stay inside each phone. The external control panels were removed at the user's request. In-phone buttons now have larger labels and tap areas, brighter primary actions, clearer selected states and keyboard focus, a visible Pet Pip cue, and a larger comparison-slider handle. Decorative visuals are slightly more compact to preserve the no-scroll fit. File inputs remain local and are keyboard-accessible.

## Archived captures (not displayed on the website)

Screens in `dist/assets/app-screens/` were captured from the existing local Expo application in `C:/Users/shihc/footprint-1`, using its built-in sample account. They are not screenshots of a real user's activity or evidence of fitness results.

- Country quest creation: the app's Japan border setup.
- Push-up battle: the actual battle setup. This preview environment has no connected camera or rep server, so the source capture displays that setup state.
- Nutrition pet: the real Pip screen and sample diary.
- Gym ranks and badges: the actual profile section. Captures exclude development overlays and browser scrollbars. An overlapping decorative background circle in the web rank view was hidden for the rank capture; rank artwork and data were not changed.
- Photo comparison: the app's A/B gallery with its pre-existing sample photos.

The app source was not modified. Expo writes only its ordinary development caches during preview.

## Browser demos

`dist/demos/` implements small, self-contained demonstrations rather than embedding the entire authenticated app. Its artwork is rendered from the original `NutritionPetArtwork`, `MuscleRankArtwork`, `BoxingFocusMitt`, and `CountryBorderMap` components. The rank ladder and country geometry come from the same app source. Sample comparison images are the public images already referenced in the app's demo data.

- Games: explore country routes or hit timed boxing targets.
- Reps: simulate counted push-ups, rival reps, the ten-rep win condition, and resetting a battle.
- Nutrition: log sample meals or rub Pip's head.
- Progress: choose body parts, explore the actual rank ladder, and inspect badge descriptions.
- Metrics: drag the A/B split or select images from the visitor's device.

The demos have no sign-in, location tracking, camera access, or backend connection. Selected photos remain object URLs in the browser and are never uploaded. Sample progress is not saved to an account. Background timers pause when previews leave view. Engaging a preview stops the parent slideshow's autoplay.

Serve the workspace over HTTP, then open `/website.html`, or serve `dist/` and open `/index.html`. The previews fetch a local artwork file, so opening an HTML file directly with `file://` is not supported for the interactive portions.

## Validation

Checked in desktop Chrome: all five demos, country progress, timed boxing hits, rep wins/reset, pet logging/head rubs, rank selection, badge details, photo slider/reset, and the five-slide boundary. A 390px viewport was checked for page overflow. Browser runtime checks found no errors in the website or its demos.

The fitted layouts were checked at 1440px, 390px, and 320px viewport widths, including both game modes and both progress tabs. All canvases and visible controls remained within their iframe bounds.

