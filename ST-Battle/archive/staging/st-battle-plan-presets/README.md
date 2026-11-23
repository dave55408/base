# ST Battle

A standalone, visual-first 3D duel between **Enterprise** and **Yorktown**. This is a separate project; ST Command has not been modified.

Each new engagement places both ships at random positions around K7, safely separated and within sensor range. Their opening headings face roughly toward each other so Yorktown is visible at the start. Reloading or choosing **New engagement** produces a fresh arrangement.

## Up to three maneuvers in one turn

**Free Flight**, beside **Engage Yorktown**, starts peaceful manual flight. Use the arrow keys to steer and W/S to adjust speed while Yorktown patrols near K7. F fires practice phasers and T launches practice torpedoes straight ahead, with normal recharge times and unlimited practice ammunition. Practice shots cause no damage and travel harmlessly through ships and K7. Yorktown does not fire. Pause and camera controls remain available. Select **Engage Yorktown** to start a fresh combat engagement and open tactical planning. The Mars planet is a true sphere at a fixed, reachable location. Free Flight HUD shows its heading, pitch and distance to cloud tops. Fly toward those coordinates; approach braking and cloud-top clearance keep the ship outside the atmosphere, and warp destinations inside the planet are blocked.

Click **Engage Yorktown** or **Build attack plan**. Click maneuver thumbnails to add one to three entries in order, then select **Done** to configure attacks. Repeated clicks can add the same maneuver more than once. Each numbered slot can use any of the eight thumbnail choices: direct assault, port curve, starboard curve, attack from above, attack from below, attack from behind, hide behind K7 then assault, or flee and effect repairs. Each selected maneuver has a **Delete** button. Deleting it removes its attack assignments; reassign any attacks left without a maneuver before committing.

Selected maneuvers execute automatically **in order during the same turn**, with one final breakaway and damage review. Configure three attacks using the weapon cards, rotatable 3D Yorktown target and range sliders. Each attack has large **M1 / M2 / M3 toggle buttons**, defaulting to its corresponding maneuver when selected. All three attacks can share one maneuver. Lighting up multiple maneuver buttons makes an attack eligible in each, but **each attack fires only once per turn**. The entire turn shares **two phaser bursts and one torpedo**. Flee/repair maneuvers take 30 seconds and cannot receive attacks; a turn consisting entirely of repair maneuvers needs no attacks.

Attack from behind sweeps around Yorktown and tracks its moving stern, holding fire until Enterprise reaches the aft side. Each offensive maneuver positions first, then executes its assigned attacks when range, arc, sensors and shield exposure permit. Phasers finish their burst before advancing. An attack that times out can retry during a later selected maneuver; otherwise it is skipped. A maneuver without attacks still flies its route. Damage, ammunition, repair parts, and the enemy's shot budget persist across the turn. No intermediate damage-review turn interrupts the sequence.

The live panel groups attacks under their selected maneuvers and identifies attacks already used in an earlier maneuver. Automatic helm handles heading, pitch, speed, K7 avoidance and breakaway. Current and upcoming flight maneuvers and pending weapon actions share two revisions across the whole turn. Completed maneuvers stay fixed. Review/Edit Plan opens on maneuvers first. Select a numbered maneuver and choose its replacement; Done continues to pending attack settings. A flee stage temporarily diverts power and prioritizes damaged areas with finite parts, requiring six seconds clear of hits. It can restore hull more slowly than components. Normal power and repair assignment return before the next maneuver.

**Editing and Cancel:** The wizard stages edits separately from the real plan. **Save action** records an action in this editor only. **Apply changes** updates staged maneuvers and pending live actions together, spending one revision per changed maneuver or attack. Changing the active maneuver replots the course without resetting remaining time, ammunition, damage, or the enemy plan. A maneuver that finishes before Apply cannot be changed. **Cancel**, the close button, and Escape discard all staged and unsaved edits without spending revisions or changing the running orders. Actual movement, shots and damage that occur while the editor is open remain in effect. If an edited action fires before Apply, the update is rejected; cancel and reopen to review the current plan. A paused turn stays paused when edits are applied or cancelled.

During initial planning, complete attack selections are retained as you move between attack stages. Selecting the weapon, target, maneuver assignments and range automatically advances to the next unfinished attack. Range changes advance after the slider is released; reviewing a completed attack stays on that attack. Once two phasers and one torpedo have valid targets, ranges and maneuver assignments, **Commit plan** enables immediately and additional weapon choices gray out. Click a selected weapon again or **Clear shot** to remove it; that attack stage becomes available again and Commit waits until it is filled. Live revisions still require explicit **Apply changes**.

Planning a new turn uses **Commit plan** once the selected maneuvers and attack assignments are ready. Planning and final review freeze motion, repairs and recharge. The 30-second assessment clock is advisory and Commit remains required. Opening the planning wizard pauses this clock; Cancel restores its prior running state.

Drag Yorktown's 3D diagram to rotate and scroll to zoom. Click a projected marker or label to select the corresponding component or shield. Systems/Shields toggles keep all fourteen targets accessible. Arrow keys rotate the focused diagram; plus/minus zoom and Home or **Reset view** resets it.

Phasers have a **5-10 km optimal band** and **15 km maximum**; torpedoes have a **3-7 km optimal band** and **19 km planning maximum**. Shots launched in the green optimal band gain **15% damage**. Range is a trigger threshold: a later action can fire as soon as its maneuver is positioned and it is inside its chosen range. F/T can trigger the current scheduled action, without adding shots or skipping maneuvers. Cooldowns, capacitor, heat, ammunition, sensors, shield exposure and K7 obstruction still apply.

**End turn:** The button at the bottom of the live updates panel immediately stops the current turn and returns to the main battle screen, including when combat is paused. Remaining maneuver actions and in-flight torpedoes are cancelled. Damage, ammunition already spent, repair parts and ship positions are preserved; temporary withdrawal power allocation is restored. A shortened replay is saved. Open the planner when ready and Commit the next plan to begin a new turn.

## Cinematic replay and bridge layout

The tactical radar sits beneath the range readout in the HUD. Yorktown's dark gray telemetry panels stack vertically in the right-hand sixth of the dashboard: contact information, engineering, shield matrix and weapons. Their reactor summary, colored power allocation, shield diagram and weapon readouts follow Enterprise's panel styling. Hull and system damage appear in their respective stations, without a duplicate damage summary. The entire dashboard scales to fit the window with every Yorktown panel visible. Yorktown stats remain visible at any range and sensor-power setting while Enterprise's sensors are undamaged; any sensor damage hides those readouts until fully repaired. Combat targeting retains its range and power requirements. Yorktown retains control of its systems.

Both ships ease automatic turns, climbs, banking and acceleration into new commands. Angular acceleration is limited, and braking ramps smoothly when the next maneuver or firing solution changes.

Shield bubbles extend farther beyond the hull. Shield sectors absorb fewer hits and recharge more slowly, while internal components and reactors withstand penetrating damage longer. Hull strikes leave visible, persistent black scorch marks with burnt edges on both ships; new engagements clear them. Phasers originate at dorsal or ventral saucer emitters. Beams, impact flashes and scorch marks share the recorded hull contact point, which stays attached as the target maneuvers and is preserved in replay.

**Replay last turn** becomes available after a full turn or a battle-ending hit. It records the selected maneuver stages, ship motion, traveling torpedoes, weapon bursts, impacts and the final breakaway. The completed recording remains available while the next turn is in progress; starting a new engagement clears it.

Playback uses a separate recorded scene with establishing views, ship portraits, launch tracking, broadside shots and impact close-ups. Weapon action slows down, quiet travel speeds up, and the picture uses cinematic letterboxing. **Pause**, **Restart**, **Audio** and **Return to bridge** are available. P/Space pauses replay, R restarts, B toggles audio, and Escape returns to the bridge. Playback pauses the live battle and restores its previous running/paused state on exit. It never re-runs combat or changes hull, power, ammunition, repairs, orders, random state or the live camera.

Replay cameras follow the 180-degree rule: all shots stay on the same side of the Enterprise–Yorktown line, including tracking drift, so screen direction stays consistent. Shot sizes still vary, and consecutive cuts retain at least a 30-degree change in viewpoint.

Yorktown's sensor panel stays at the top right; its dedicated **Damage** panel is directly beneath it. Damage readouts include hull, reactor output, all six shields and impulse engines, main engines, bridge, weapons, sensors and shield generators. Detailed values respect sensor telemetry and become unknown when the link is lost. Enterprise's helm, shields, weapons and engineering occupy the row beneath the main viewscreen. Engineering is inside the Enterprise area rather than the Yorktown column.

## Play

Double-click **Start ST Battle.cmd**, then click **Engage Yorktown**. Requires Node.js 20+ and a browser with WebGL/graphics acceleration (Chrome or Edge recommended). No dependency installation, account, network connection, or build step is needed.

Alternatively run `node server.cjs` from this folder and open **http://localhost:3188**. `PORT` can override the default port. You can also open `index.html` directly, including recorded weapon audio. Direct file pages use media players; the local server uses decoded Web Audio. All game resources are local.

The simulation begins in stand by. **Briefing** explains the mechanics and lets you choose Mutara nebula or open space. Switching windows automatically pauses a running battle.

## Controls

| Control | Action |
| --- | --- |
| F (hold or tap) | Trigger the remaining phaser burst within ordered range/arc |
| T | Trigger the remaining torpedo within ordered range/arc |
| D | Self-destruct Enterprise during active combat or Free Flight; uses the five-second breakup sequence |
| C | Active sensor scan |
| P | Pause/resume |
| Enter | Engage/resume |
| V | Cycle chase, tactical, forward, cinema views |
| B | Toggle weapon and action audio |
| Drag viewscreen / wheel | Orbit camera / zoom |
| Double-click playfield | Toggle playfield fullscreen; Escape exits fullscreen |

Choose flight maneuvers through the wizard. Attitude and impulse dials display the automatic helm state.

## Battle stations

- **Shields:** Six sectors (fore, aft, port, starboard, dorsal, ventral) absorb hits according to relative 3D ship attitude. Sliders divide the shield system's recharge power, not current charge. Reinforce the threatened side or turn an intact shield toward Yorktown. Sliders always conserve a 100% recharge budget.
- **Weapons:** Phasers drain shields efficiently within a 65° forward cone and 15 km. Photons choose an intercept at launch and travel in a straight line without turning or homing, delivering heavier structural hits within a 28° forward cone and below 20 km. Capacitor, phaser heat, reload time, and the 24-torpedo magazine limit firing. Torpedoes already launched remain in flight during an engagement.
- **Damage:** Below 25% shield charge, strikes penetrate and damage hull and subsystems. Hits that overwhelm a shield can also penetrate. Weapon aim points follow the selected subsystem. Hits intersect the rendered hull geometry, so an intervening hull section can take the strike; penetrating damage is assigned to the nearest system at the actual contact point. Destroying hull stops combat immediately. The ship breaks into saucer, engineering hull, pylons, nacelles and fragments amid chained explosions. After the breakup animation, the scene holds for two seconds before showing the end screen; the same destruction sequence is available in replay. Damage to reactor/conduits reduces actual output; engine, shield, weapon, and sensor integrity each affect their systems.
- **Sensors:** Effective sensor power and range control contact, lock, and damage telemetry. Weak sensors lose detailed readings; failed sensors lose lock. Active scan spends capacitor to reveal detailed telemetry for eight seconds, provided sensors still operate. Target tracking cuts off at 20 km in both environments; the HUD reports OUT OF RANGE until Yorktown returns within that limit. Phaser range remains 15 km.
- **Power:** The four system shares always total 100%. Effective power is allocation × available reactor output × system integrity. Integrity is displayed beside each system; hover an allocation for effective GW. Attack, defend, evasive, and balanced presets are available. The reactor retains a small emergency output reserve.
- **Repairs:** A single selected repair team restores subsystem integrity or reactor output after six seconds without a hit. Thirty finite repair parts are available. The Flee and effect repairs maneuver can also restore hull, using the same finite parts.
- **Yorktown:** Pursues in three dimensions, chooses an approach toward a weak shield, fires phasers and photons, and obeys power, weapon arc, capacitor, heat, reload, and damage limits. Yorktown uses its own attack sequence while Enterprise executes the committed maneuver.

## Visual design and references

The Enterprise is an intentionally simplified procedural model informed by ST Command's `enterprise-third-renderer.js` and `enterprise-engineering-shape.js`: saucer, bridge dome, neck, engineering spindle, swept pylons, elevated nacelles, painted registry and windows. Yorktown uses the same cruiser silhouette with its own markings. ST Command's locally bundled Three.js renderer and its MIT license are included in `vendor/`; the project has no external asset requests.

Reference clips supplied for this project:

- [First Clash: Reliant versus Enterprise](https://www.youtube.com/watch?v=WCpYqWAIwFA)
- [The Enterprise Takes Down Kahn's Ship](https://www.youtube.com/watch?v=Tg0O5JdxjVw)

Visual excerpts were reviewed in Chrome. Applicable cues are deliberate approaches, clear ship silhouettes, bridge instrumentation, concentrated weapon hits, shield failures leading to lasting damage, and three-dimensional pursuit in the nebula. The game is an adaptation of those cues, not a recreation of the films' scripted encounters. No film imagery, dialogue, or soundtrack is embedded.

Spatial guides include four additional altitude grids above and below Enterprise with vertical rails and height labels. Spatial guides are enabled by default: a level grid through Enterprise, distance rings, cyan/coral ship footprints, vertical height guides, and a labeled range readout. Grid spacing adjusts to contact range (100 world units = 1 km). Use **Grid on/off** to toggle; Cinema hides guides automatically. Enemy guides respect sensor contact.

## Verify

Run `node --test test/*.test.cjs` (or `npm.cmd test` in PowerShell). Tests cover timed turn transitions, limited salvos and revisions, range/sector gating, damage review, conserved power, attitude-relative shield sectors, shield/hull penetration, subsystem/output loss, firing constraints, traveling torpedoes, pursuit and defeat, signed helm thrust, pause/reset, sensor failure/scan, finite repairs, and victory.

Files: `engine.js` contains the simulation; `scene.js` contains Three.js ships, sky and effects; `app.js` connects controls, telemetry, audio and HUD; `replay.js` records and samples turn state; `replay-view.js` controls cinematic playback; `planner.js` handles the maneuver/shot wizard; `target-diagram.js` renders and rotates the perspective 3D targeting model; `style.css` provides responsive layouts. Everything is self-contained in this folder.

Below 25% hull, Yorktown breaks off and flees in 3D, routing power toward engines and shields. Engine damage still limits escape speed; the player can pursue. Enterprise displays a critical-hull red alert below the same threshold.

**Emergency warp:** Helm Control provides one 30 km jump per engagement, along Enterprise's current heading and pitch. The jump preserves attitude, throttle and speed, and spends its single charge immediately. Yorktown remains at its position and continues its pursuit (or its retreat if critically damaged). A new engagement restores the charge.

**K7 station:** A static, neutral obstacle sits beside the initial engagement. Its procedural silhouette follows the supplied orthographic and rendered references: central saucer and conical tower, three radial habitat pods, lower hangar drum and rear cargo pod. Approximate component collision volumes keep the gaps between its arms open. Both ships deflect around the station at slow impulse, Yorktown steers around it, K7 blocks firing solutions and intercepts traveling torpedoes. Warp skips the intervening space but rejects an occupied destination without spending its charge. K7 is indestructible and marked in amber on radar and the viewscreen.

Impulse movement speed is boosted by 50% for both ships, including Enterprise reverse and Yorktown pursuit/retreat. Turn rates and weapon/projectile speeds retain their existing values.

Both ships show animated engine speed trails that lengthen and brighten with actual speed. Reverse motion uses the same trails in the opposite direction; they remain visible at minimum impulse. The HUD range bar uses a fixed 0-20 km scale and color indicating contact and firing geometry, shrinking as the ships close.

Chase view stays anchored on Enterprise and only pulls back along the existing viewing angle to fit both ships below 10 km separation; Yorktown never makes the camera switch sides. It returns to the normal chase view beyond 13 km or when contact is lost; separate thresholds prevent rapid switching during close approaches.

The full bridge dashboard automatically fits the browser viewport, with compact panels and proportional scaling on window resize.

Both ships maintain minimum impulse while moving. Automatic helm selects thrust and respects engine damage. Pausing freezes the simulation.

Automatic helm adjusts turn rate and bank according to the committed maneuver. Manual steering does not override the route.

With Audio enabled, both ships use `assets/phaser.mp3` during the 1.4-second beam, followed by a 0.18-second fade-out. Torpedo launches play `assets/torpedo.mp3` once. Muting, pausing, and starting a new engagement fade out active weapon sounds.

The continuous bridge hum is disabled; Audio controls recorded weapons and short action sounds.

Phaser bursts last 1.4 seconds with the same damage per shot, capacitor cost and reload interval. The helm status panel reports positioning, K7 avoidance, cover, attack, withdrawal or breakaway.

Ship hits on either shields or hull play `assets/explosion.mp3` once, on both ships. The final hit sound can finish after victory/defeat; muting or starting a new engagement still stops it.

Audio is enabled by default and initializes on the first click or keypress. The Audio button or B still mutes/unmutes it.

Automatic Helm displays Enterprise speed in meters per second, including an astern indicator for reverse motion. Enterprise fires blue phasers; Yorktown fires orange phasers. Beam launch and impact flares match their ship's phaser color. The persistent targeting line between ships is removed.

**Adaptive speed:** Enterprise and Yorktown use the same automatic speed controller. Ships accelerate for clear approaches, escape and breakaway; slow for tight turns, K7 clearance and nearby waypoints; and match target motion around the next ordered firing range. Cooldown, capacitor recharge and phaser cooling affect approach timing. Cover uses minimum impulse. Speed changes use gradual acceleration and braking, with available engine power, bridge/main-engine damage and minimum impulse still limiting performance. Automatic Helm shows the current speed-control intent beside the phase. During an automatic maneuver, hold **W** to accelerate or **S** to slow down. Release the key to return smoothly to the plan. Heading, pitch and attack orders stay automatic; engine limits and obstacle braking still apply.

**Replay continuity:** Every actual camera cut cycles through wide, medium and close framing. The director measures the preceding camera viewpoint and enforces at least a 30-degree viewpoint change around the next subject, plus at least a 30% change in apparent subject size. It uses extra angle/size margins to avoid borderline cuts, adapts to viewport aspect ratio, and holds each shot for at least 1.1 seconds of screen time even during slow motion or accelerated travel. Camera labels show the framing actually being displayed.

**Opening camera:** The default chase camera sits lower and closer to the ship's centerline, with a forward look-ahead that keeps Yorktown visible above Enterprise at the start. Look-ahead eases out as the ships close; existing close-engagement framing remains active.

**Yorktown captain:** Sensor-visible shield weaknesses and damaged systems determine attack targets. A visible breach can prompt a torpedo-first sequence; pending actions adapt to new breaches and follow up on weakened shields. Yorktown reallocates its existing 100% power budget between pursuit, attack, defense and sensor reacquisition, reinforces the threatened shield, and prioritizes critical repairs using finite parts. It attempts lateral/vertical evasions against detected incoming torpedoes, predicts torpedo aim from observed motion, and abandons prolonged attempts to reach an inaccessible shield. Failed sensors prevent new firing solutions; navigation uses an extrapolated last-known track instead of hidden player positions. After retreating, it can re-engage once hull and essential systems stabilize. Weapon arcs, range, cooldowns, capacitor, ammunition and the two-phaser/one-torpedo turn budget still apply. The captain does not inspect the player's chosen plan.


Planet image: `assets/mars-surface.png` is a generated 2:1 equirectangular surface texture adapted from the supplied NASA/USGS Viking Mars globe reference. It is bundled locally and requires no internet connection. Longitude/latitude UV mapping wraps distinct terrain around the entire sphere, with bright surface illumination and sRGB output applied by the renderer. The texture canvas retains fixed GPU dimensions while the image loads. This is a visual game asset, not a scientific Mars map.


**Random turns:** Random, to the right of Commit Next Turn, generates and immediately commits the next plan. Attack turns use three random offensive maneuvers, random targets and trigger ranges, and the maximum two phasers plus one torpedo in random order. Random flee turns use one withdrawal/repair maneuver and no weapons. Check Continue to start random turns automatically; each completed turn receives a fresh random plan. Uncheck it to finish the current turn and wait at review. Pause, the planner, briefing and replay suspend automatic continuation. A new engagement or Free Flight clears Continue; the battle ending stops further turns.


**Cinematic Replay Turn:** A wide opening reveal frames both ships and K7 with Mars as a background cue. Close-ups follow the front underside phaser emitter and traveling torpedoes, then cut to impacts. Shots normally hold for at least 3.2 seconds of screen time, with earlier cuts for impacts and destruction. Speed eases into slow motion around weapons and hits and compresses uneventful travel. Destruction ends with a five-second pullback centered on the drifting wreckage. Camera shake is reduced during replays. Controls and captions fade after 2.8 seconds of inactivity; move the pointer or use the keyboard to reveal them. Pause and completion keep controls visible. Replays operate on recorded state and do not alter the live turn.


**Quick battle plans:** Timid, Strong and Aggressive appear at the top of the planning wizard. Each fills a complete draft with three maneuvers, two phasers and one torpedo, ready to review, customize or Commit. Timid uses K7 cover, a port sweep and withdrawal, attacking weapons and engines from longer range. Strong flanks to port, climbs and attacks directly, using optimal-range fire against shields, weapons and hull. Aggressive closes directly, attacks from above and gets astern, firing at weapons, bridge and reactor at short range. No attacks are assigned to withdrawal. Cancel discards a selected preset; selecting a preset spends no ammunition or power. Quick plans apply to new turns and final review; live revisions retain their existing limits.
