# Vincent van Gogh · A Life Through Art

V16 opens the arrival scene into a 30 by 27 metre rotunda with a 9.4 metre daylight ceiling. A continuous concave title wall carries VINCENT VAN GOGH and its subtitle, inset from both ends and fully inside the opening camera frame. The opposite perimeter is shorter, leaving a broad view toward the circular cinema and connected galleries. A circular daylight oculus and an enlarged ceiling cove keep the opening bright. All seven later halls, 46 mounted works, and ten benches retain their V15 geometry. Earlier Blender scenes and route data remain untouched as backups.

The camera follows a continuous, rounded spatial rail rather than piecewise straight segments. Its level gaze turns continuously and looks through room thresholds during transitions, with smoother speed changes at bends. Artwork stations remain on the left of the travel direction and use the same poses as the automatic tour. Multiple paintings, floor, ceiling, seating, and room depth remain part of the composition. The staggered halls include a circular cinema, a rectangular Dutch gallery, a high-low Paris square, nine visitor-facing stepped fan walls, a curved charcoal black box, a high elliptical Saint-Rémy gallery, and a wide Auvers/afterlife return. Ceiling heights vary from 6.4 to 10.6 metres; walking floors remain at one level. Hall 01 reserves a suspended black curtain and a 16:9 screen above a low circular plinth. All labels and interface text are in English.

The installation has **46 documented artwork images**, not a complete catalogue of Van Gogh's roughly two thousand works on paper and canvas. The catalogue distinguishes mounted works from archival or series leads without substituting unrelated images. Titles, dates, image credits, and source links appear on the artwork cards. Check each version, date, collection, and image licence again before public release.

## Open the interactive gallery

From this directory run `npm start`, then open `http://127.0.0.1:8765/`. Do not open `index.html` directly: the 3D model and data files require a local web server. An existing server on this port may need to be restarted or its tab reloaded to show changes.

- Use **Next / Previous** or the left and right arrow keys to follow the 46 works in chapter order without leaving the wide gallery view. Frames preserve each source image's aspect ratio, with a balanced display area rather than identical frame dimensions. Short unobstructed moves glide; long moves or moves across walls use a gentle fade rather than flying through architecture. Click a painting when you want a close reading of the artwork and its story.
- Hover over a painting for its white information card. Click it for a large artwork-and-text view; press **Esc**, click outside, or use the close button to return. Open **Seven Halls · Catalogue** to search and jump to a work or chapter.
- Drag to look around and use **W/A/S/D** to walk through the wide open thresholds. Floors, wall blades, benches, and the film plinth have collision boundaries. Painted faces are visible and interactive from their front, with architecture blocking hover/click selection through walls.
- Play or scrub the **90-second tour** for an overview. It begins with a three-second bright rotunda establishing view and returns to the same view. The level camera stays at 1.85 metres, with a 64-degree vertical field of view on 16:9 landscape screens matching Blender. Narrow portrait panels widen the vertical field to preserve the horizontal composition. A rounded spatial rail and continuous heading interpolation replace sharp corners and independently eased turns. The tour moves continuously instead of stopping in front of each painting. Use Next / Previous or click a painting to study it at your own pace.
- Choose a local MP4, WebM, or Ogg file with **Choose opening film**, then press **Play film**. The selected file plays on Hall 01's screen in this browser session only. No opening film is bundled; the Blender scene retains a placeholder screen until you assign the film there separately.

## GitHub Pages deployment

Publish this `interactive_gallery` directory as the repository root, not the surrounding Blender or video workspace. The `.gitignore` excludes installed dependencies, build output, caches, older models, and older route data. Preserve the artwork credits and source links in the English data files, and review their image licences before public publication.

1. Install Node.js 22 and run `npm ci` to install the pinned Three.js dependency.
2. Run `npm run build`. This exports `dist/` with the V16 model, 46 artwork images, English chapter/route data, and the required Three.js modules. It does not copy Blender files, old models, local videos, server code, or caches into the website.
3. To check the production build locally, run `npm start` and open `http://127.0.0.1:8765/dist/index.html`. This also checks that resource URLs work inside a subdirectory, as they do on a project Pages site.
4. Push this directory to the repository's `main` branch. In the repository's **Settings > Pages**, choose **GitHub Actions** as the source.
5. Open **Actions > Deploy gallery to GitHub Pages** and wait for both jobs to succeed. If the first run occurred before Pages was enabled, use **Run workflow** to deploy again. The deployment environment links to the actual published website.

The workflow rebuilds and publishes the site after each push to `main`. No personal access token needs to be saved in the repository. The opening film chooser still selects a visitor's local file for that browser session; a permanent opening film must be added and configured separately.

## Source files

- `../outputs/van_gogh_gallery_v16.blend`: spacious Blender scene with packed artwork images and a 24 fps, 2,160-frame, 90-second camera animation.
- `assets/gallery_v16.glb`: web model; `assets/*.jpg`: individually sourced artwork images.
- `data/artworks_en.json`: English titles, approximate dates/media, interpretation, credits, and image paths for the 46 installed works.
- `data/chapters_en.json`: seven English chapters and work/series leads.
- `data/ordered_route_v16.json`: floor polygons, collision obstacles, seating, wide painting stations, viewing distances, and timed left-wall camera waypoints.
- `../work/rebuild_gallery_v16.py`: builds V16 from the preserved V15 Blender scene and route with Blender 5.0.
- `../outputs/gallery_v16_validation.json`: route clearance, left-side artwork stations, unchanged later-gallery and artwork geometry, opening-title margins and safe framing, ray-cast visibility checks for the entire opening title and subtitle, heading-rate checks, and sampled forward wall distances.

The Blender render and interactive website are separate outputs. Artwork hover cards and the browser-selected film do not automatically appear in a Blender-rendered MP4.
