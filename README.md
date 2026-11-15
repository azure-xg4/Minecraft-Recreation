# BlockWorld — TypeScript Voxel Sandbox

A small, dependency-free browser voxel sandbox built with TypeScript, native WebGL 2, and browser APIs. It is an original prototype inspired by the uploaded Voxel Prototype, not a copy of Mojang's Minecraft.

## Run

Open `index.html` in a modern desktop browser with WebGL 2 enabled (Chrome, Edge, or Firefox). No server, npm install, CDN, framework, or external library is required. The checked-in `app.js` is the compiled browser build; `src/main.ts` is the TypeScript source.

To rebuild after editing the TypeScript, install/use the TypeScript compiler on your machine and run:

```bash
tsc --target ES2020 --lib DOM,ES2020 --outFile app.js src/main.ts
```

## Controls

- Click **Create World**, then click the game view if pointer lock does not start.
- `W A S D`: move · `Space`: jump · `Shift`: sprint · mouse: look
- Left click: mine · right click: place / toggle lever
- `1`–`9`: select hotbar slot · `E` / `Q`: cycle selected block
- `T` or `/`: open command chat · `Enter`: run · `Esc`: close / pause
- `F3`: debug overlay

## Current prototype features

- Native WebGL 2 voxel raycaster (no Three.js or other runtime dependency)
- Procedural seeded terrain with plains, forest, desert, snowy taiga, savanna, swamp, mountains, and ocean regions
- Trees, cacti, water, coal and iron ore
- Lobby / world-name screen, survival and creative mode selection
- First-person movement, jumping, sprinting, mining, placing, hotbar, basic inventory counts
- Day/night lighting cycle
- Redstone dust signal propagation, lever toggles, redstone torches, lamps, repeaters/comparators as placeable blocks, piston/sticky-piston extension in simple cases, observer change detection
- Commands: `/help`, `/gamemode`, `/time set`, `/weather`, `/tp`, `/give`, `/setblock`, `/fill`, `/seed`, `/spawn`

## Honest limitations

This is a playable foundation, not a complete Minecraft Java 26.3 recreation. It does not include Mojang's assets, exact world generation, mobs, combat, crafting, recipes, full block physics, chunk streaming, multiplayer, saves, dimensions, structures, enchantments, advancements, or full vanilla redstone semantics. The renderer is a compact raycast renderer, not Minecraft's production chunk mesh renderer. The current redstone logic is intentionally simplified and should be treated as experimental.
