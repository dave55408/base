# Elf Adventure

Runs on **Phaser 3.90.0** with WebGL rendering and a Canvas fallback.

```powershell
cd elf-adventure
npm install
npm start
```

Open **http://127.0.0.1:8080**. Dependencies are local and pinned in `package-lock.json`; no CDN is required. Opening `index.html` directly also works: `file://` pages load the generated `file-assets.js` image bundle to keep WebGL textures and pixel masks origin-clean. HTTP pages continue to use ordinary image files. Run `npm run build:local-assets` after changing artwork.

## Structure

- `phaser-scene.js`: the `AdventureScene` lifecycle (`preload`, `create`, `update`), keyboard input, pooled images and text, cached room textures, Arcade Physics terrain, responsive sizing, and shutdown cleanup.
- `game.js`: game state and rules, exposed through `window.ElfAdventure`. Preserves six jewels, both swords, reusable axes, Hate attacks, gifts, theft memory, bridge cutouts, and the happy-helper moon gate.
- `joystick.js`: existing mobile joystick; its movement vector feeds the same Scene-controlled movement.
- `dev-server.cjs`: a localhost-only development server.

## Rendering and physics

Phaser owns the only game animation loop. Moving actors and items are pooled Phaser images rather than a full-screen canvas upload every frame. The current room's background is rasterized only when its artwork changes (room transition, gate animation, bridge placement, treasury count, or asset load). The background texture is reused between changes. Generated elf artwork and item crops become reusable textures; animated jewel textures refresh only when their flash color changes. HUD updates are capped at ten per second while messages can update immediately.

Arcade Physics integrates player movement and resolves rectangular terrain using static bodies. Geometry is rebuilt only when the room, bridge placement, or moon-gate passage changes. Existing narrow-phase checks still resolve transparent castle artwork, bridge cutouts, movable objects, dead dragon pixels, and jewel protection. Elf AI, dragon AI, and axe projectiles continue to use the tested game-rule collision functions. This is a working Scene migration, not a replacement of every custom collision rule with Arcade bodies.

The Scene uses bounded 1/60-second simulation substeps and limits catch-up to 100 ms. Pause and the behavior dialog freeze gameplay. The Scene cleans up keyboard listeners, generated textures, and its resize observer on shutdown.

Elf task decisions and dragon route visibility checks run every 150 ms while movement, collisions, stun recovery, and dragon bites continue at the simulation rate. Changed gifts, emotional states, destinations, and blocked movement can prompt earlier decisions. Gift sharing and retry deadlines retain their original timing.

Room navigation caches the 31-by-20 static grid and links between adjacent points. Each search overlays current loose and carried objects or protected jewels. Gates, bridges, trees, artwork, and room layout changes invalidate the affected room; a new quest clears all navigation data.

## Verification

```powershell
npm run test:browser
npm run test:browser -- --file
npm test
```

The browser smoke test uses installed Chrome (or `CHROME_PATH`), checks WebGL startup, keyboard movement, tree/barrier collisions, bridge traversal, sword pickup, pause/restart, moon-gate animation, background caching, mobile sizing, six-jewel victory, and Scene restart cleanup. It saves `test-results/phaser-shrine.png`.

The older Node test suite contains failing assertions for earlier game behavior and layouts. A full run during this migration reported **135 passing and 18 failing**. Focused current-rule tests and the browser smoke test should be checked independently; the full legacy suite is not a clean baseline.

To inspect a running local game, `window.elfGame.scene.metrics` reports simulation steps, physics steps, and texture uploads. These counters are diagnostics, not an FPS guarantee.

South of Sapphire Shore, Lamplight Landing contains a lamp and a bell. A happy, trusting elf answers the bell, collects the loose lamp, and holds it in Midnight Vault's upper-left corner. The lamp reveals 80% of the room. Umbra attacks a player carrying the lamp, but watches a friend holding it, allowing Nightstone to be collected in the lower right. The sealed jewel cannot be retrieved by a bat or magnet; Umbra cannot be slain. Nightstone is the sixth jewel required by the treasury. Amethyst rests inside White Castle.

Puzzle checks: `node --test dark-vault.test.js`; browser checks: `node dark-vault-smoke.cjs` (add `--file` for direct-file mode).
