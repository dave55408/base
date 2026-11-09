# ST Command

An interactive USS Enterprise navigation simulator powered by Phaser 3.90.0.

The bridge uses a panoramic, illuminated viewscreen surround and a red/orange glass helm with paired circular attitude/power instruments. Drag the power dial vertically to set engine power; the linear throttle offers the same control with keyboard accessibility.

Approaching a planet within 1 LY automatically establishes standard orbit and enables **Launch Landing Craft**. Outposts and custom waypoints retain their normal arrival behavior. The landing craft keeps the existing heading, pitch, power, keyboard and autopilot controls; local navigation uses kilometres and metres per second. Warp is unavailable aboard the craft.

The orbital close-up uses a detailed globe with coastlines, ocean shelves, mountains, polar ice, clouds and atmospheric limb shading. The globe rotates diagonally left and downward around a tilted axis (one revolution in about 8 minutes). Rotation follows simulation time and pauses with P; the planet's outline remains fixed.

Clouds are thin, feathered wisps in orbit, during atmospheric descent and over the terrain. Each planet's icon color also sets its globe, surface, atmosphere, water and local terrain-map palette; Vulcan uses warm rust and sand tones.

Select **Abandoned beacon** in the navigation panel and engage a guided descent, or fly manually through the upper atmosphere, cloud deck and lower atmosphere. The surface view now uses the Flight Simulator project's Three.js engine and alpine scenery style: faceted meadows, rocky and snowy mountains, thousands of pine trees, a turquoise river, soft 3D clouds, warm daylight and atmospheric haze. The pilot view banks gently while turning. Tactical and galaxy panels switch to local radar and a terrain map, and the rendered terrain shares its height field with navigation and terrain-clearance protection. A Canvas terrain fallback is available when WebGL cannot start.

The 3D engine is bundled in `vendor/alpine-three.js` for offline and direct-file launches. Regenerate it from the local Flight Simulator bundle with `node build-alpine-vendor.cjs` if that engine is updated; its MIT license is included in `vendor/THREE-LICENSE.txt`.

Use **Retrieve Beacon** within 450 m of the beacon, below 450 m AGL and at no more than 150 m/s. The beacon has a tall column and stacked cap based on the supplied reference. Retrieval selects **Enterprise · aft shuttle bay**. Engage to climb to orbit and approach from aft, or fly back manually. **Land in Bay** requires the aft side, within 650 m, lateral alignment within 300 m, speed at most 120 m/s, heading 000° ±15° and pitch within ±12°. The exterior shows the saucer, nacelles and illuminated bay entrance. Landing guidance carries the craft inside; press **Power Down Craft** after touchdown to return to the bridge. The ship remains in orbit and another sortie can be launched. R resets the full simulation.

Run `npm start` in this folder and open http://127.0.0.1:8090. Phaser is bundled locally; no installation or internet connection is needed. Opening `index.html` directly also works.

Select a destination, choose impulse or warp, set engine power, and engage the course. The galaxy is a perspective-projected 3D volume: drag to orbit, scroll or use the buttons to zoom, and click a star to select it. Empty-space clicks plot a waypoint at the ship's current elevation. The home button resets the camera.

Drag the spherical attitude control to adjust heading and pitch, or use the heading/pitch sliders and climb/dive buttons. Pitch changes the ship's elevation above or below the galactic plane. Autopilot tracks all three coordinates and stops at the destination. The forward viewscreen, tactical elevation display, and 3D galaxy share the same position, heading, pitch, target, and travel state.

Controls: Left/Right or A/D steer, Up/Down or Q/E pitch up/down, W/S adjust power, Space stops, P pauses, R resets, B toggles bridge audio, and Enter engages a course or resumes a paused simulation. The helm also provides on-screen flight controls.

The planet craft uses Flight Simulator pilot pitch controls: Up pushes the nose down to dive; Down pulls the nose up to climb. Left/Right turn with a visual bank; W/S change power. Q/E remain climb/dive shortcuts. Flight keys continue working while a helm slider is focused. The footer shows the active craft's controls.

Selecting Enterprise switches the right navigation display to a 3D shuttle-attitude and aft-bay approach map. The shuttle model tracks heading, pitch and bank, with an Enterprise outline, bay entrance, approach gates, heading vector, vertical drop line and lateral/vertical offsets. Drag to orbit the map, scroll or use +/− to zoom, and use ⌂ to reset its camera. Landing guidance animates the shuttle into the bay through touchdown; after power-down the normal galaxy display returns.

The map is a fictional schematic. Distances and speeds are compressed for exploration.

Double-click the main viewscreen to expand it to the entire screen. Double-click again or press Escape to return to Ops mode. Flight state and keyboard controls stay active. Browsers that decline native fullscreen still expand the viewscreen to fill the browser viewport.

Bridge Audio automatically starts the local recording at `assets/audio/bridge-ambience.m4a` and loops continuously, with its panel hidden. If the browser requires an interaction before playing sound, the first click or key press starts it. Press B to stop; press B again to open the audio controls and restart. Adjust volume in the audio panel, or close it to stop. Audio pauses and resumes with the simulation. The recording was extracted from the requested YouTube video (`MwBMf0mg_q0`) and is approximately 2 minutes, 5 seconds long. Playback requires no internet connection or YouTube player. Source details are saved beside the audio file in `assets/audio/SOURCE.txt`.

Browser verification: `npm test` uses Playwright and installed Chrome. It covers bridge navigation, audio, and a complete away mission with desktop/mobile layout checks. It reuses the workspace's existing Playwright installation when available; otherwise run `npm install` first. `node mission-smoke.cjs --screenshots` also saves orbit, surface and aft-bay previews.
