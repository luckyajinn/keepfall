# Keepfall handoff

Last updated: 2026-11-23

## Where things stand

The design is settled and the plan is written. No game code exists yet. The owner had not yet approved the plan when work moved to cloud sessions, so get their OK on the plan and the four assumptions below before building.

This repo holds only this file so far. The repo is named `knightfall`, and the working name of the game is Keepfall. Ask the owner which name to keep.

## The game

Keepfall is a single-player roguelite that runs in the browser. A knight fights up through a castle of 3 floors and beats the boss on the last one. A run should take about 10 minutes.

## Decisions the owner made

- View and movement: top-down. Every entity moves in 4 directions only. The knight moves with WASD.
- Enemies on the map: the player can see them and chooses to fight them or walk around them. Walking around an enemy means missing its rewards. Some enemies are hidden and jump out.
- Fights: a separate battle screen with turns and a menu of Attack, Guard, Potion and Flee. An enemy that ambushes the knight gets the first turn.
- Gear: a sword (damage), a shield (how well Guard works) and armor (health), plus trinkets that give passive bonuses.
- Floor reward: clearing a floor always upgrades the lowest level item, with a 25% chance of an extra item.
- Fight rewards: XP, which levels the knight up, and gold.
- Death: the run ends. The player keeps their gold and spends it in a shop on attribute buffs and better starting items. Better starting items also make the floor upgrades land on higher levels.
- Floors: 2 regular floors, then a boss floor.
- Art and sound: original, drawn in code with simple shapes and a warm fantasy color set. No outside assets.
- Stack: TypeScript, Vite and canvas.
- Controls: keyboard only for now. Leave room in the layout for touch controls later.
- Players: single player, with no server.

## Assumptions to confirm with the owner

1. Gold is only spent between runs. There is no shop inside a run. Shop purchases are permanent and are saved in the browser.
2. The extra item from the 25% roll is a trinket.
3. The player must reach the stairs to clear a floor but doesn't have to fight. The boss can't be skipped.
4. Enemies the player can see stand still or patrol a short path. They start a fight only when touched. Hidden ones trigger when the knight steps next to their tile.

## Open questions

- What should the boss be? If the owner has no preference, pick one that fits the castle.
- Keep the name Keepfall, or use Knightfall to match the repo?

## Risks

- Balance: if skipping every fight still wins, the choice to fight means nothing. Tune the boss so that a knight who skipped everything loses.
- Shop growth: permanent buffs can make runs trivial. Raise prices with each purchase.
- Original work: only the general idea of map encounters and menu battles comes from the genre. The names, creatures, layout and look must all be our own.

## First playable milestone

One full run: a start screen, 3 floors, map enemies and ambushers, menu battles, XP and gold, floor rewards, the boss, win and lose screens, and the shop with saved gold.

## Order of work

Show each step running in a browser before committing it.

1. Project setup, and a knight walking around a floor.
2. Random floor layout, stairs and moving between floors.
3. Map enemies, hidden ambushers and the battle screen.
4. Gear, XP, gold, potions and floor rewards.
5. The boss floor, and the win and lose screens.
6. The shop between runs, with saving.
7. A balance pass and simple sound effects.

## Planned file layout

```
index.html
package.json, tsconfig.json, vite.config.ts
README.md, CREDITS.md
src/
  main.ts          start up and game loop
  game.ts          run state and screen switching
  input.ts         keyboard
  map/             floor generation, tiles, movement
  entities/        knight, enemies, boss
  battle/          turn logic and battle screen
  items/           gear, trinkets, floor rewards
  meta/            shop and saved progress
  ui/              start, win, lose and shop screens, plus the HUD
  render/          canvas drawing helpers and colors
  audio/           generated sound effects
```

## Project rules

- Make an original game. Don't recreate a specific existing game's name, characters, art, music, levels or look.
- Only use assets the owner supplies, assets made for this project, or assets with a clear free license listed in `CREDITS.md`.
- Never commit secrets, tokens, internal hostnames, IPs or personal email addresses. This repo is public.
- No force pushes. No merges without the owner's OK. Commit and push only when the owner asks.
- Use plain words and no em dashes in docs, UI text and commits.
- Keep LF line endings. Add a `.gitattributes` file containing `* text=auto eol=lf` with the first code commit.
- If the game will be hosted on the owner's home server, write the steps for the owner to run.
