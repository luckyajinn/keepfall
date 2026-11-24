# KeepFall: plan for the next features

Written 2026-11-23. A planning pass read all of the code, and its claims were then checked against the files. Three of the bugs below were also reproduced in a browser.

Items 1 to 6 are done, at the owner's request. On 2026-11-24 the owner also had the whole look changed to 16-bit retro pixel art, which was not in this plan; see `HANDOFF.md`. New art for the items below must follow the rules at the top of `src/render/pixel.ts`. Items 7 to 12 are not approved yet. The owner picks what gets built next and in what order. See "Questions for the owner" at the end.

Effort sizes: small is under about 150 lines, medium is 150 to 400, large is over 400.

## Bugs found and fixed

All nine bugs from the planning pass were fixed on 2026-11-23. Each fix has its own browser tests, and the combined code passed full test runs.

1. A potion could be wasted at full health. Now no potion is used and no turn passes, the menu says "You are already at full health.", and the Potion row is dimmed.
2. The boss enrage could be late when Thorn Ring damage took him below half health. The check now runs after Thorn Ring damage as well.
3. With two hidden enemies next to the same tile, only one ambushed, and the knight could walk onto the other. The ambush check now runs whenever the knight stands still, and stepping into a hidden enemy's tile starts its ambush.
4. Floor 3 guards hit as hard as the boss. Enemy attack growth is now capped at 1.65 times, so floor 3 guards have 7 or 8 attack against the boss's 10. The boss has 150 health (was 140) to keep the win rates where they were.
5. `?seed=` only repeated floor 1. Each run now has its own seed and each floor is built from that seed and its floor number, so the floor layouts of a seed are always the same. Fights and rewards still depend on what the player does.
6. The battle screen read meaning out of log text. Battle events now carry `blocked` and `source` fields.
7. Touch-only devices would get no sound. Sound now unlocks on the first key press, click or tap. Not yet tried on a real phone.
8. The lose screen always drew the boss. It now draws the enemy that beat the knight and names it.
9. Small leftovers: the always true check in the battle screen is gone, the best floor is shown on the title screen, and `loadSave` only accepts a save whose `version` is 1.

## Do next

### 1. Bug fixes (small). Done

See "Bugs found and fixed" above.

### 2. Sound check screen and volume (small). Done

The title menu has a Sound entry (`src/ui/soundScreen.ts`). It lists all 20 sounds with plain names and when each plays, plays one with Enter, and sets the volume in ten steps with A and D. The volume is saved. Nobody has listened to the sound yet, so this screen is where the owner should start.

### 3. Run timer and run stats on the end screen (small). Done

The win and lose screens show time, potions used, damage taken and the run seed. The first run of a visit uses the `?seed=` from the address, so a seed shown on the end screen can be put in the address to see the same floors again. Time in the pause menu does not count.

### 4. Touch controls (medium). Done, not yet tried on a real device

`src/ui/touch.ts` adds a direction pad and OK, Back and Sound buttons. They appear on the first touch, or at load when the main pointer is a finger. Upright devices get a bar under the game and sideways devices get the controls at the sides. Hints switch to touch wording (`src/ui/hints.ts`).

Open points from building it:

- Only checked with touch emulation in a headless browser. Real phones may differ, most of all iOS Safari (pointer capture, bounce, safe areas, sound on the first tap).
- On an upright phone the game is small (about half size), so the smallest hint text is hard to read. Sideways is the better way to hold it.
- Once touch controls are shown, hints keep the touch wording even if a keyboard is used later.

### 5. A trinket for sale at the vendor (small). Done

Each vendor visit offers one trinket the knight does not own, for 25 gold (`VENDOR_TRINKET_PRICE` in `src/items/vendor.ts`). The 25% floor reward roll is unchanged. The plan guessed 35 gold, but the simulator showed that at 35 a trinket is almost always worse than spending the same gold on whetstones. At 25 it is a real choice: a good one lifts a careful full clear from 75% to as much as 85%, and buying blindly drops it to about 68%.

## After that

### 6. Pause menu with "Give up this run" (small). Done

Escape on the map (or the touch Back button) opens Resume, Sound, How to play and Give up this run (`src/ui/pauseScreen.ts`). The map is drawn dimmed underneath and nothing moves. Giving up needs a second press, keeps the gold and counts as a run, and the end screen says "You turned back".

### 7. Chests and a healing fountain on floors 1 and 2 (medium)

One chest per floor (gold or a potion) and sometimes a fountain that heals once. A reason to explore side rooms.

- New tile kinds in `src/map/tiles.ts`, placed in `tryGenerate` in `src/map/floor.ts` on a free inner room tile. `MapScreen.tryMove` handles bumping into them.
- Risk: more gold and healing changes the balance numbers in `HANDOFF.md`. Run the simulation again.

### 8. Two new enemy types (medium to large)

Enemies that need new tactics. Floors 2 and 3 share one enemy pool and only two traits exist (`heavy` and `double`).

- New `EnemyKind` and `EnemyTrait` values in `src/entities/enemies.ts`, for example one that heals from the damage it deals and one that takes half damage unless the hit is a strike back from Guard. New branches in `Battle`, new sprites in `src/render/sprites.ts`.
- Floor 3 Tallow Wisps and Rafter Lurkers have the same attack as on floor 2 since the attack cap. A boss floor enemy mix of its own would give that floor more of a step up.

### 9. Boss rework (small, then medium)

- Step 1: gather the boss's name and all text about him into one `BOSS` object in `src/entities/enemies.ts`. His name is written out today in `screens.ts`, `mapScreen.ts`, `battle.ts`, `sprites.ts` and `README.md`. This makes any later boss change cheap.
- Step 2: give the boss a real second phase below half health with one new telegraphed move.
- Needs the owner to decide who the boss is. The Ork was chosen "for now".

## Later or maybe

10. Shop rework with unlocks. The shop makes the game easy fast (about 98% wins with three cheap upgrades). Changing what existing upgrades give needs a save format change and a migration in `src/meta/save.ts`.
11. Music made in code: a quiet loop for the map, one for battles and one for the boss. Only after the owner has heard the sound effects.
12. Harder runs after a first win, with levels that raise enemy attack or health.

## Questions for the owner

1. Which items should be built, and in what order?
2. Is the Ork staying as the boss, or should there be a different one?
3. May the vendor sell a trinket, or should trinkets stay floor rewards only?
4. For touch: buttons in a bar under the game, or on both sides when the phone is held sideways?
5. Should the vendor keep spending saved shop gold, or should a run start with 0 gold in hand? It spends saved gold today, and changing that would shift the balance a lot.
6. Should the sound check screen and run stats stay in for players, or are they for testing only?
