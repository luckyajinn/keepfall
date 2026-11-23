# KeepFall: plan for the next features

Written 2026-11-23. A planning pass read all of the code, and its claims were then checked against the files. Three of the bugs below were also reproduced in a browser.

Item 1 (the bug fixes) is done, at the owner's request. Nothing else in this plan is approved yet. The owner picks what gets built and in what order. See "Questions for the owner" at the end.

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

### 2. Sound check screen and volume (small)

A "Sound" entry on the title screen that lists all 20 sounds, plays one with Enter and sets the volume with A and D. Nobody has listened to the sound yet, and this lets the owner judge all of it in about a minute.

- `src/audio/sfx.ts`: export `SFX_NAMES`, add a saved `volume` (0 to 1) and `setVolume(v)`.
- New `SoundScreen` in `src/ui/screens.ts` with a scrolling list. Add `showSound()` to `Game`. The title menu grows from 3 rows to 4, so its panel and the text under it move down.
- Check: press Enter on each row and confirm `keepfallSfx.played` ends with that name. A headless browser can not judge how it sounds.

### 3. Run timer and run stats on the end screen (small)

Time, potions used, damage taken and the run's seed on the win and lose screens. The target is about 10 minutes per run and nothing measures that today.

- `RunState` in `src/game.ts`: add `seconds`, `potionsUsed`, `damageTaken` and `seed`. Add `dt` to `seconds` in `Game.update` while a run is active.
- `RunSummary` and `EndScreen.render` in `src/ui/screens.ts`: show the new rows. The screen has room for 5 rows today (a sixth would land on the "Press Enter" line), so the layout needs smaller steps or two columns.
- The run seed already exists (`RunState.seed` in `src/game.ts`), so showing it is cheap.

### 4. Touch controls (medium)

A direction pad plus OK, Back and Sound buttons under the game on phones and tablets. `index.html` already has `#touch-controls` and the `--touch-h` variable, and `Input.press` and `Input.release` were written for this.

- New `src/ui/touch.ts` that builds buttons with a `data-action`, calls `input.press` on `pointerdown` and `input.release` on `pointerup`, `pointercancel` and `lostpointercapture`. Direction buttons must stay held, because the map moves by `input.heldDir()`.
- Show the controls on the first touch, set `--touch-h` and call `resize()` from `src/main.ts`. Sound already unlocks on a tap through the listeners in `src/main.ts`. Do not add a `pointerdown` only unlock: on touch, a tap counts for sound only when the finger lifts.
- Hint text that names keys (map, battle, vendor, shop, title) needs a touch wording.
- Check: Playwright with `hasTouch` and `isMobile`, tap OK on the title and hold the right button on the map.

### 5. A trinket for sale at the vendor (small)

One random trinket offered at each vendor visit. Trinkets only roll twice a run at 25%, so about 56% of runs never see one.

- `RunState`: add `vendorTrinket`. Roll it in `Game.showVendor`. Move the trinket handout in `src/items/rewards.ts` into a shared `giveTrinket(k, id)`.
- `VendorScreen`: one more row at a fixed price (about 35 gold). Six rows do not fit at the current row height, so shrink the rows.
- Needs the owner's OK, since the floor reward rule (25% chance) was confirmed as it is.

## After that

### 6. Pause menu with "Give up this run" (small)

Escape on the map opens Resume, Sound, How to play and Give up. Today the only ways out of a run are dying or closing the tab, and closing the tab loses that run's gold.

- New `PauseScreen` in `src/ui/screens.ts` that draws the map under a dark layer and does not pass time on to it. `MapScreen.update` opens it on `cancel`. Add a public `giveUp()` to `Game` that ends the run as a loss.

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
