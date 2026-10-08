# Vincent van Gogh · A Life Behind the Name


An interactive exhibition about Vincent as a person: his family, relationships, work, faith, hopes, difficulties, and the choices through which he lived.

[Visit the exhibition](https://yserena60-yyy.github.io/van-gogh-gallery/)

## The Exhibition

We recognise the name Vincent van Gogh. This exhibition asks us to look beyond that recognition and encounter the person behind it.

The exhibition follows his life through the places he inhabited, the people around him, the work he pursued, and the futures he imagined. Paintings and drawings remain important, but they are not the organising framework of an art-history survey. They sit alongside letters, recollections, documents, and accounts of daily life.

The aim is not to explain every decision through a famous painting, or to reduce his life to a story of suffering and posthumous success. It is to give visitors ways to understand how Vincent lived, what mattered to him, and what remains uncertain.

## Narrative and Evidence

The exhibition combines an accessible life story with opportunities for closer reading.

Where accounts differ, it distinguishes between:

- Vincent’s letters and other contemporary records.
- Family recollections and retrospective testimony.
- Later research and interpretation.
- Questions that the surviving evidence cannot settle.

These sources are not treated as interchangeable. Visitors can follow the main narrative, then open the supporting material to understand who told a particular story, when it was recorded, and how its interpretation has changed.

Curatorial writing is presented as exhibition interpretation rather than as Vincent’s own words. In particular, the first-person opening prologue is not a verified quotation from him.

## Exhibition Structure

The journey follows eight connected chapters.

| Hall | Chapter | Narrative focus |
| --- | --- | --- |
| 01 | Origins and Uncertainty | Family, early employment, faith, relationships, and the search for a direction. |
| 02 | The Dutch Years | Learning, working relationships, domestic circumstances, and life among rural communities. |
| 03 | The Paris Years | New surroundings, friendships, shared interests, and encounters with a changing city. |
| 04 | Arles | The hope of establishing a home and a working life in the south. |
| 05 | The Yellow House | Living and working with Gauguin, their differences, the crisis, and its aftermath. |
| 06 | Saint-Rémy | Care, restrictions, daily rhythms, and continuing to work through periods of uncertainty. |
| 07 | Auvers: The Final Months | Relationships, work, the final days, and the evidence behind different accounts of his death. |
| 08 | Afterlife | The people who preserved and shared his work and letters, and how his story reaches us today. |

The entrance invites visitors to set aside what they already know:

> We know who he would become.  
> As you enter, set that knowledge aside.

The closing question returns the focus to the person:

> We know who he became.  
> As you leave, what stays with you  
> from Vincent’s life?

## How to Explore

### Highlights

A three-minute guided route introduces the exhibition through selected works, chapter introductions, and narrative stops.

It is an orientation rather than a complete account. Film playback and time spent reading are additional to the guided route.

### Full Collection

The full-collection route visits the installed selection in greater depth. Additional works can occupy the gallery’s display positions as the route progresses, allowing a larger collection to be explored without crowding every wall.

“Full collection” refers to the collection installed in this exhibition, not every work Vincent produced.

### Independent Exploration

Visitors can move through the gallery at their own pace, open chapter introductions, select artworks, and enter the story readers.

The story menu offers deeper narrative paths, including **Early Life**, **The Yellow House**, **The Final Months**, and **Afterlife**. These complement the gallery route rather than replacing it.

English and Simplified Chinese are available through the language control. Linked external sources retain the language used by their original publishers.

## Stories and Artwork Cards

The opening film introduces Vincent’s early experiences. The story readers then make space for the people, relationships, and decisions that need more than a short label.

The first hall’s **Searching for a Place** section connects four chapters:

- **A Home in London**
- **Turning to Faith**
- **Among the Miners**
- **Learning to Draw**

Later stories explore shared life in the Yellow House, the crisis in Arles, the final months in Auvers, and the transmission of Vincent’s work and reputation after his death.

Authored artwork cards use a consistent reading structure:

1. **Artwork Information** — identification, date, place, materials, and collection.
2. **The Story** — the work’s connection to Vincent’s life.
3. **Look Closer** — details visitors can examine for themselves.
4. **Evidence & Interpretation** — the distinction between documentation and interpretation.
5. **Sources** — material supporting the account.

Previous and next controls support continued viewing. When an artwork is opened from a story, visitors can return to that reading context.

## Implementation

The exhibition is a static web application built with **Three.js**. Scene rendering, collection management, narrative content, navigation, translation, and audio are organised as separate components.

### System Logic

```text
Collection metadata, narrative data, and media
                    ↓
Build validation and media assembly
                    ↓
Static application and gallery model
                    ↓
Three.js scene and interactive display positions
                    ↓
Guided routes, independent exploration, and story readers
                    ↓
Artwork details, sources, and closing reflection
```

The spatial model and the artwork collection are kept separate. Stable artwork identifiers connect an image with its metadata, story, and route entry. Display positions determine where a work appears; they are not the identity of the work itself.

This separation lets guided routes reuse display positions while keeping the selected artwork’s image, title, information, and story aligned.

### Main Components

| Component | Responsibility |
| --- | --- |
| `viewer.js` | Scene rendering, camera behaviour, selection, and coordination between interactions. |
| `gallery-entry.js` | Opening sequence and transition into the exhibition. |
| `collection.js` | Collection metadata, artwork lookup, and wall-display management. |
| `highlight-route.js` | Highlights route and its playback behaviour. |
| `collection-tour.js` | Full-collection navigation and playback behaviour. |
| `story-data.js` and `gallery-stories.js` | Narrative content and story-reader interactions. |
| `hall-introductions.js` | Chapter introductions and closing text. |
| `i18n.js` and `locale-zh*.js` | Language selection and Chinese interface and narrative content. |
| `gallery-music.js` | Background audio, playback controls, and music attribution. |
| `build.mjs` | Validation, dependency preparation, media assembly, and production output. |
| `server.mjs` | Local preview, including byte-range responses for media playback. |

Content and configuration are stored in the project’s data files rather than being tied exclusively to scene geometry. This supports updates to stories, introductions, routes, and credits without treating them as changes to the building itself.

Large media assets are stored in lossless parts for publication and reconstructed during the build. The production site uses the assembled files, not the individual parts as playable media.

## Run Locally

Use Node.js 22 and npm.

```sh
git clone https://github.com/yserena60-yyy/van-gogh-gallery.git
cd van-gogh-gallery
npm ci
npm run build
npm start
```

The local preview server uses port `8765` by default. To use port `8766` in PowerShell:

```powershell
$env:PORT = '8766'
npm start
```

Keep the server running while viewing the local exhibition. A local address such as `127.0.0.1` is available only while the corresponding server is running on that computer.

Project verification is available with:

```sh
npm run verify
```

Browser checks remain important for camera movement, film playback and seeking, artwork navigation, story return paths, language switching, and audio behaviour.

## Build and Deployment

```sh
npm ci
npm run build
```

The build prepares the static website in `dist/`.

The GitHub Pages workflow in `.github/workflows/pages.yml` runs when changes are pushed to `main`. It installs dependencies, builds the exhibition, uploads the generated website, and deploys it to GitHub Pages.

The published exhibition does not require an application server or database. A successful Git push and a successful Pages deployment are separate stages; deployment status can be checked in GitHub Actions.

## Sound

Background music is optional and user-controlled.

- **Wildflowers** accompanies Halls 01–07.
- **A Kind Of Hope** accompanies Afterlife and the closing reflection.

Music is kept separate from the opening film so that the two soundtracks do not compete. Playback and transitions are managed by the audio module.

**Music: Scott Buckley — licensed under CC BY 4.0.**

- [Wildflowers](https://www.scottbuckley.com.au/library/wildflowers/)
- [A Kind Of Hope](https://www.scottbuckley.com.au/library/a-kind-of-hope/)
- [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)

Track attribution and source information are also maintained in `data/music_credits.json`.

## Sources and Media

Artwork and documentary material are accompanied by source information where available. Historical works, modern photographs, document scans, text, film, and music may have different usage conditions.

This repository does not imply that every included or linked item shares one licence. Preserve the relevant source, credit, and rights information when reusing material. A link to an external source does not grant permission to republish its contents.

## Data and Privacy

The exhibition does not require an account and does not provide a visitor message board.

Browser preferences, such as language and sound settings, are stored locally where implemented. External source links lead to independently operated websites.

## Project Purpose

This exhibition is an invitation to encounter a life, not only a name.

Its central question is not simply how Vincent became a famous artist, but what we can come to understand about the person who lived before that fame.
