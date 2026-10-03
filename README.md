# Vincent van Gogh · A Life Through Art

## Large media and deployment

The gallery model and opening film are stored in `assets/media-parts/` as small, lossless binary segments for reliable GitHub uploads. `data/media_manifest.json` records the order, byte counts and SHA-256 checksums. `npm run build` automatically restores the original `assets/gallery_v21.glb` and `assets/van-gogh-early-years.mp4` before building the site. The deployed model and film are byte-for-byte identical to the approved originals: no resizing, compression, re-encoding, audio changes or extra transitions. The restored local files and `dist/` are ignored by Git.

For a fresh clone, run `npm ci`, then `npm run build`. You can then use `npm start` for local preview. The existing GitHub Pages workflow performs the reconstruction automatically; visitors receive ordinary GLB and MP4 files, not the segments.

V21 retains the bright 30 by 27 metre arrival rotunda and its concave VINCENT VAN GOGH title wall. Hall 01 remains a **38 by 28 metre oval**, with approximately **836 square metres** of floor area and an **8.5 metre** daylight ceiling. Its film display, integrated London narrative and early-drawing wall share one spacious room rather than a small alcove in the connecting passage. The Hall 01 curve now joins behind the Hall 02 artwork wall instead of crossing its paintings. Two Hall 02 entry mounts are set back from wall ends, and the Hall 07 entry wall is shortened to clear the last Hall 06 frame. All other architecture and mounts remain unchanged. Earlier Blender scenes and route data remain untouched as backups.

The camera follows a continuous, rounded spatial rail with a level gaze. In Hall 01 it follows **opening film → London story → early drawings, 1881 → Hall 02**, with brief calm holds at the two narrative stations. Artwork stations remain on the left of the travel direction. Multiple paintings, floor, ceiling, seating, and room depth remain part of the composition. The staggered halls include an oval cinema-and-narrative gallery, a rectangular Dutch gallery, a high-low Paris square, nine visitor-facing stepped fan walls, a curved charcoal black box, a high elliptical Saint-Rémy gallery, and a wide Auvers/afterlife return. Ceiling heights vary from 6.4 to 10.6 metres; walking floors remain at one level. Hall 01 retains its suspended black curtain and 16:9 screen above a low circular plinth, without restoring the removed cinema benches. All labels and interface text are in English.

The expanded installation has **365 individually identified artwork images: 46 original highlights plus 319 additions**. They occupy **54 switchable wall sets**, not 365 simultaneous frames. V21 preserves the collection, lighting, wide passages, left-wall viewing order and the complete V20 90-second camera rail. Manual artwork stations now face their paintings squarely at eye level. Additional paintings retain their actual image proportions within each mount's audited `displayBounds`. Every fitted frame, including switched works, is checked for continuous wall backing and unobstructed frontal and tour sightlines in both Blender and the browser. Titles, dates, F/JH or museum identifiers, image credits, and primary record links appear in the English catalogue and cards.

## Collection and wall sets

| Hall | Chapter | Individual works | Physical positions | Wall sets |
| --- | --- | ---: | ---: | ---: |
| 01 | Origins and early drawing | 2 | 1 | 2 |
| 02 | The Netherlands and early Antwerp | 100 | 8 | 13 |
| 03 | Paris | 107 | 6 | 18 |
| 04 | Early Arles | 41 | 9 | 5 |
| 05 | Gauguin, late Arles and recovery | 26 | 6 | 5 |
| 06 | Saint-Rémy | 68 | 10 | 7 |
| 07 | Auvers and the posthumous research chapter | 21 | 6 | 4 |
| Total | | 365 | 46 | 54 |

Every hall starts on its original **Highlights** set. Use the upper-right selector or its arrows to replace that hall's paintings with another collection set. Unused positions on a partial set are hidden rather than filled with unrelated works. Images load before the walls change; a failed download leaves the previous set intact and allows a retry. **Next / Previous** and the keyboard arrows browse the whole 365-work reading order, switching sets when necessary. Searching a title, F number or accession in **Seven Halls · Catalogue** and selecting a result loads its set and opens the artwork with its story.

The **90-second tour is a highlights tour, not a film of all 365 works**. It remains the default; starting it restores the original 46-work installation in every hall. The separate **Full collection · 365 works** mode automatically visits the entire installed selection across all 54 wall sets. It follows the same seven-hall reading order as Next / Previous: each hall's Highlights first, then its additional sets. This is a period-based itinerary, not a claim that every individual painting within a hall is in exact date order or that all of Van Gogh's works are installed.

### Full collection tour

- Choose **Full collection · 365 works** in the bottom toolbar, then **Play full collection**. This browser-only mode starts at the first drawing; the opening film and London narrative remain optional interactive stops rather than being automatically played or opened.
- Each work has a full **8-second stationary viewing hold**, measured only after its images and camera arrival are ready. Choose **6s**, **8s**, or **12s per work**. The full visit is much longer than 90 seconds; 8-second holds alone total 48 minutes 40 seconds, with camera transitions and image loading adding time.
- Stations face paintings squarely at eye level while preserving the gallery around them. Short clear moves glide slowly; changed wall sets, large turns and moves across architecture use a gentle 0.6-second fade out and in. Reduced-motion preferences suppress both glides and fades. The architecture and the original 90-second Blender camera remain unchanged.
- **Pause collection / Resume collection** retains the current work and its remaining stationary viewing time. A transition interrupted by a pause resumes at the same target work. Scrolling, dragging, walking, viewing an enlarged artwork, opening the catalogue or London story, and hiding the browser tab pause playback. After manual movement, Resume first returns to that artwork's station.
- In this mode the progress slider chooses a **work number**, not seconds. Scrubbing loads that work and pauses; Next / Previous and catalogue selections synchronize the tour position. **Reset view** returns to the current work, not the overview rail. The counter, English title and status distinguish loading, travel, viewing, pause and completion.
- A complete wall set loads before any image is replaced. Loading and travel do not consume the viewing hold. Failed images keep the old walls, stop the tour at the failed work and offer **Retry collection**. Pausing or changing modes during loading invalidates the pending change; late downloads cannot replace walls or restart playback.
- The tour stops after the last of the 365 works. **Replay collection** starts again at the first. Choosing **Highlights · 90 seconds** and pressing Play restores the original installation; the two modes never play simultaneously.

### Scope and unresolved material

This is **selected, verified series coverage**, not the complete oeuvre or a complete catalogue raisonné. The original 96 catalogue entries mix individual works, entire series and archive leads; they are not 96 individual paintings. Of those entries, 46 refer to installed highlights, 39 have selected series works, four early-subject leads remain unresolved, and seven archive leads are not installed. Another 288 individually identified candidate records remain outside the installed collection because image or chronology verification is still pending. These are listed in `data/collection_audit.json`; missing works are not represented by similar images, AI replacements or placeholder paintings.

Versions are separate records. For example, the bandaged-ear self-portraits with and without a pipe are distinct, and the Chicago 1889 bedroom repetition belongs to Saint-Rémy rather than the 1888 Arles group. Only the separately documented F753 oil portrait of Doctor Gachet is installed; do not infer that both oil versions are included. Collection names drawn from the scholarly letter edition are attributed to that source, not asserted as newly confirmed current ownership. Private or historical auction locations are qualified in the cards. The Washington Potato Eaters lithograph is identified by its accession as well as the shared print-design number.

Sources include public museum records, the scholarly Van Gogh Letters edition and individually licensed image files. Preserve all credits and links and review each image licence before public release. Research and installation counts are dated October 1, 2026.

## Open the interactive gallery

From a fresh clone, first run `npm ci` and `npm run build` to restore the original media. Then run `npm start` from this directory and open `http://127.0.0.1:8765/`. Do not open `index.html` directly: the 3D model and data files require a local web server. An existing server on this port may need to be restarted or its tab reloaded to show changes.

- Use **Next / Previous** or the left and right arrow keys to follow the 365 works in chapter order without leaving the wide gallery view. Frames preserve each source image's aspect ratio, with a balanced display area rather than identical frame dimensions. Short unobstructed moves glide; long moves or moves across walls use a gentle fade rather than flying through architecture. Click a painting when you want a close reading of the artwork and its story.
- Hover over a painting for its white information card. Click it for a large artwork-and-text view; press **Esc**, click outside, or use the close button to return. Open **Seven Halls · Catalogue** to search and jump to a work or chapter.
- Drag to look around and use **W/A/S/D** to walk through the wide open thresholds. Floors, wall blades, benches, and the film plinth have collision boundaries. Painted faces are visible and interactive from their front, with architecture blocking hover/click selection through walls.
- Scroll the mouse wheel or use two-finger trackpad scrolling to move closer or farther: scroll up to approach, down to step back. On a touchscreen, spread two fingers to approach and pinch them together to step back. These controls move the camera smoothly at eye level instead of zooming the webpage or changing the lens. Movement stops before walls and the film plinth, and manual navigation pauses the tour. Pinching or dragging over a painting does not open its artwork dialog; a short click or tap still does. **Reset view** restores the current tour position and level heading.
- The opening view faces the suspended film screen front-on at the same wide viewing distance, without changing the architecture or frame sizes. A five-second smooth blend joins the original camera rail after the opening hold, and the tour returns to the same frontal view at the end.
- Play or scrub the **90-second tour** for an overview. It begins with a three-second bright rotunda establishing view and returns to the same view. The level camera stays at 1.85 metres, with a 64-degree vertical field of view on 16:9 landscape screens matching Blender. Narrow portrait panels widen the vertical field to preserve the horizontal composition. A rounded spatial rail and continuous heading interpolation replace sharp corners and independently eased turns. Brief calm holds introduce the London story and early drawings; the later halls continue without stopping at every painting. Use Next / Previous or click a painting to study it at your own pace.
- Hall 01's suspended screen includes **The Early Years**, a 3:02 Full HD film with English subtitles and restrained piano. Press **Play film** to start with sound; it does not autoplay. The first 1.2 seconds fade from black, without delaying narration or changing the original shot order or restored dissolve near eight seconds. The approved v4 audio is retained unchanged, with no added writing foley. Playback pauses tours and camera transitions; opening the London story, an artwork dialog, or another hall pauses the film.
- **Choose another film** accepts a local MP4, WebM, or Ogg override for the current browser session. Reloading restores the bundled film. The Blender scene still requires a separate film assignment; this integration is for the interactive website.
- Piano: **Calm Piano 1 (Vaporware)** by **The Cynic Project / cynicmusic**, CC0, from `https://opengameart.org/content/calm-piano-1-vaporware`. Film and music provenance is included in `data/film_credits.json`; CC0 applies only to the music track.

## London story inside Hall 01

The London display is integrated into the west curve of enlarged Hall 01, with a wide, level, frontal viewing area. The ivory display contains the exact January 1873 portrait of Vincent, a short English invitation, **Explore the Story**, and a compact **Searching for a Place** chronology. The subtitle is **Work, Affection and the Search for Belonging — 1873–1874**. It is a story exhibit, not a new painting or a second film screen. The former passage alcove is removed; the broad connection to Hall 02 remains open.

- Follow **Next / Previous**: opening film → London story → **Road in Etten** → **Boy with a Sickle** → Hall 02. The two genuine 1881 drawings share one fitted frame across two wall sets on the west curve, after London and before the next hall. **London story** in the toolbar also takes you directly to the narrative display. Previous from the first drawing returns to London; Previous from London returns to the film viewpoint.
- Click the physical display or **Explore the Story**. **Previous / Next** follows four main chapters: **A New Home → A Life He Enjoyed → An Uncertain Attachment → Sources & Versions**. Longer chapter text expands inside the reader rather than covering the gallery walls.
- **Art Before Painting** is an optional branch accessible from the first two chapters. **Back to…** returns to the originating chapter, preserving the selected January/April letter tab. It is not placed after the romance as a supposed consequence of rejection.
- In **A Life He Enjoyed**, switch between **January: Home and Art** and **April: Gardens and Walks**. Each view has its own quotation, letter date, short narrative and original-edition links.
- Enlarge the genuine nineteen-year-old portrait or the modern house photograph inside the reader. Escape closes the enlargement first, returns focus to that photograph, and leaves the story open. Udimu’s house photograph is explicitly dated **17 May 2016**, not 1873; the full original is displayed without cropping.
- Letter quotations appear directly in quiet, paper-toned **typeset excerpt** panels. They are not facsimiles or invented handwriting. The English wording follows WebExhibits; dates and letter numbers follow the modern scholarly edition. January and April retain separate selectable views.
- **An Uncertain Attachment** offers four selectable people, household/family connections and an evidence timeline. It does not depict Vincent and Eugénie as a proven couple. **The Household Behind the Story** explains rooms, teaching and everyday business without reproducing the insurance photograph.
- **Sources & Versions** has four expandable evidence cards: **Vincent’s Own Words**, **Family Memory**, **Revisiting the Story**, and **What Remains Uncertain**. These distinguish contemporary letters, retrospective memoir, later research and unresolved questions; there is no vote on which account is true.
- Expand **Searching for a Place** to read the short art-trade, teaching, religious-work and early-drawing chronology. Dated source links distinguish contemporary letters from later interpretations.
- While reading, walking, dragging, dolly controls and the automatic tour pause. **Close**, Escape or a backdrop click returns to the same view; **Continue to early drawings** guides you to **Road in Etten**. On phones, images sit above the text.

The tour still lasts **90 seconds** at eye level. V21 retains every V20 waypoint and animation frame; the first-hall segment from 9 to 20.5 seconds remains the smooth expanded-gallery rail introduced in V20. `data/story_exhibit_en.json` holds the editable English copy, chapters, chronology, source links and viewpoint. `assets/story_transition_v20.glb` carries the unchanged integrated London display, with only its wall collision in `data/story_transition_layout.json` and no supplementary walkable pocket. The main expanded room and corrected artwork walls are in `assets/gallery_v21.glb`.

Two real photographs are embedded: the verified January 1873 portrait by J. M. W. de Louw (Commons marks it public domain) and Udimu’s 2016 photograph of 87 Hackford Road (**CC BY-SA 4.0**). The composed wall image retains its own CC BY-SA 4.0 composition licence. Credit, licence, source links, modifications and exact-file SHA-256 checksums are recorded in `data/story_image_credits.json`; `data/story_source_audit.json` records nine materials, twenty-four source records and four typeset excerpts.

The short English excerpts are credited to Vincent van Gogh / English version as published by WebExhibits. Its exhibit-specific credits distinguish public-domain letters from edited or translated letters offered under **CC BY-SA 1.0**; no blanket public-domain claim is made for translations. The typeset excerpt panels retain attribution and are offered under CC BY-SA 1.0. The reuse basis is `https://www.webexhibits.org/vangogh/about/credits.html`, not a guessed general copyright page. The gallery’s surrounding summaries are independently written and are not part of the quoted translation. Modern scholarly edition facsimiles and full English translations are not copied.

Original relationship and household cards replace the locket and insurance photographs rather than simulating archives. The Tom Parsons exterior, Claire Zhao insurance photograph, locket and Jacquet reproduction remain credited research references; permission to redistribute those images is not assumed. Reference dates of 2019 describe modern photographs or research publication, not the date of Vincent’s residence. No external image is fetched merely by opening a chapter, and no AI-generated archive imagery is used. The seven-hall design, 365 installed works and 90-second tour remain preserved. The integrated physical wall is included in V21 Blender; its interactive reader and optional materials are browser features.

## GitHub Pages deployment

Publish this `interactive_gallery` directory as the repository root, not the surrounding Blender or video workspace. The `.gitignore` excludes installed dependencies, build output, caches, older models, and older route data. Preserve the artwork credits and source links in the English data files, and review their image licences before public publication.

1. Install Node.js 22 and run `npm ci` to install the pinned Three.js dependency.
2. Run `npm run build`. This exports `dist/` with the corrected V21 architectural model, all 365 artwork images, the collection manifest and audit, the integrated London display, reader, licensed images and English data, the bundled opening film and its credits, and the required Three.js modules. It does not copy Blender files, old models, unrelated video exports, server code, or caches into the website.
3. To check the production build locally, run `npm start` and open `http://127.0.0.1:8765/dist/index.html`. This also checks that resource URLs work inside a subdirectory, as they do on a project Pages site.
4. Push this directory to the repository's `main` branch. In the repository's **Settings > Pages**, choose **GitHub Actions** as the source.
5. Open **Actions > Deploy gallery to GitHub Pages** and wait for both jobs to succeed. If the first run occurred before Pages was enabled, use **Run workflow** to deploy again. The deployment environment links to the actual published website.

The workflow rebuilds and publishes the site after each push to `main`. No personal access token needs to be saved in the repository. The bundled opening film loads by default; the chooser can temporarily replace it with a visitor's local file. Building this local folder does not update an already published GitHub Pages site; publication requires a separate push and deployment.

## Open the expanded Blender collection

Open `../outputs/van_gogh_gallery_v21_clear_artwork_walls.blend` for the enlarged first hall, corrected artwork walls, integrated London wall and 365-work collection. V20 remains the expanded-first-hall backup; V19 remains the previous narrative-alcove backup; V17 remains the pre-story collection backup. All installed painting and story-wall images are packed in V21. The film display and complete V20 2,160-frame, 24 fps tour are retained. The two moved Hall 02 mounts include all switched picture, frame, reveal and label components; the hidden Hall 01 drawing variant is also aligned with its visible mount. The physical story wall appears in Blender, but its clickable chapter reader is a browser feature.

In **Scene Properties > Custom Properties**, change `hall_01_wall_set` through `hall_07_wall_set` to choose a hall's visible set. Values are zero-based: **0 means Highlights**, 1 means the second set, and so on. The maximum values for Halls 01–07 are **1, 12, 17, 4, 4, 6, 3**. The seven properties work independently. Set all seven to 0 to restore the highlights tour. Visibility uses simple property drivers and does not need an auto-run script.

The Text Editor includes **READ ME | Expanded collection** and **COLLECTION | Manifest**. Individual painting objects store their title, story, primary record and identifier as custom properties. Blender wall-set choices are independent of the browser choices. The 90-second animation does not automatically cycle wall sets.

## Source files

- `../outputs/van_gogh_gallery_v21_clear_artwork_walls.blend`: packed 365-work collection, enlarged Hall 01, corrected artwork walls and integrated narrative display.
- `../work/rebuild_gallery_v21.py`, `../outputs/gallery_v21_validation.json`: all 365 frame-backing and sightline checks, clear routes, preservation of unrelated geometry and the unchanged 90-second rail. Use `--audit-only` to reproduce the V20 wall failures without modifying the previous scene.
- `story.js`, `data/story_exhibit_en.json`: English four-chapter reader, short chronology and sourced evidence notes.
- `assets/story_transition_v20.glb`, `data/story_transition_layout.json`: integrated story-wall geometry and collision, with no extra alcove floor.
- `data/story_image_credits.json`: house/portrait image attribution, licences and derivative-wall rights.
- `../work/build_story_transition.py`: builds V19 from V17; `--verify-only` reopens the saved file and checks the original camera, works, wall sightlines and route clearance.
- `story-data.js` and `../work/verify_story_data.mjs`: validate chapter, branch, material and source references, image credits and safe resource paths.
- `../work/verify_story_browser.mjs`, `../outputs/story_browser_checks.json`: physical wall click, chapter reading, camera pause, mobile layout and Hall 01–02 navigation checks.
- `../outputs/van_gogh_gallery_v17_collection.blend`: expanded, packed 365-work Blender collection with switchable sets and the preserved 90-second camera animation.
- `../outputs/van_gogh_gallery_v16.blend`: unchanged architectural source and original highlight scene.
- `assets/gallery_v21.glb`: expanded Hall 01, trimmed joining walls and corrected entry mounts; `assets/*.jpg`: individually sourced artwork images.
- `data/artworks_en.json`: original 46 highlight records, retained as source data.
- `data/collection_en.json`: enriched individual records for all 365 installed works, their identifiers, provenance and exact hall/set assignments.
- `data/collection_audit.json`: original lead coverage, exclusions and pending individual records.
- `data/chapters_en.json`: generated English catalogue, including installed titles and explicitly uninstalled research leads.
- `collection.js`: collection validation, reading order, exact work lookup and proportion-preserving display sizing.
- `collection-tour.js`: cancellable full-collection playback, viewing holds, pause/resume, work seeking and same-work error recovery. Included in the production static build; it does not alter the Blender file.
- `../outputs/gallery_collection_inventory.csv`: one row per installed work, including its hall, one-based wall set, identifiers, image licence and sources.
- `../outputs/gallery_collection_stats.json`: installed and pending counts, with explicit non-completeness flags.
- `data/ordered_route_v21.json`: expanded floor polygons, corrected collision obstacles, seating, frontal eye-level viewing stations, audited mount bounds and unchanged chronological camera waypoints.
- `../work/rebuild_gallery_v16.py`: builds V16 from the preserved V15 Blender scene and route with Blender 5.0.
- `../outputs/gallery_v16_validation.json`: route clearance, left-side artwork stations, unchanged later-gallery and artwork geometry, opening-title margins and safe framing, ray-cast visibility checks for the entire opening title and subtitle, heading-rate checks, and sampled forward wall distances.
- `../work/assemble_gallery_collection.mjs`: assembles the enriched collection, wall sets, catalogue, inventory and honest lead audit from cached research.
- `../work/build_gallery_collection_blend.py`: builds V17 from V16; `--verify-only` reopens and checks the saved collection.
- `../outputs/gallery_v17_collection_validation.json`: camera and geometry fingerprints, packed images, exact work placements and every set's visibility checks.
- `../outputs/gallery_collection_data_checks.json`: individual reachability, source/identifier and duplicate checks, JPEG decoding and frame proportions.
- `../outputs/gallery_collection_browser_checks.json`: all 54 set loads, failed-image recovery, catalogue selection, highlight restoration and mobile controls.
- `../work/verify_artwork_walls_browser.mjs`, `../outputs/gallery_v21_browser_wall_checks.json`: full-width backing and frame-edge visibility checks for every work across all 54 wall sets using the exported browser meshes; run from the workspace root with the local server active. Accepts a production-build URL as its first argument.
- `../work/verify_collection_tour.mjs`, `../outputs/gallery_collection_tour_checks.json`: deterministic playback checks for all 365 works and 54 sets, timing, pause/resume, canceled arrivals, seeking, replay and failed-image retry.
- `../work/verify_collection_tour_browser.mjs`, `../outputs/gallery_collection_tour_browser_checks.json`: actual-browser checks for the complete automated itinerary, correct visible paintings, frontal level walkable stations, loading cancellation/retry, immersive/catalogue/story pauses, original Highlights restoration and mobile controls. Accepts a production-build URL as its first argument. Tests accelerate viewing holds and suppress motion while traversing all works; ordinary playback retains the selected full hold and calm transitions.

The Blender render and interactive website are separate outputs. Artwork hover cards and the browser-selected film do not automatically appear in a Blender-rendered MP4.
