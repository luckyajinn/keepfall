# KeepFall handoff

Last updated: 2026-11-23

This file lives in the repo by the owner's choice (2026-11-23). The repo is public, so keep secrets, tokens, internal hostnames, IPs and personal email addresses out of it.

The repo was renamed from `knightfall` to `keepfall` on 2026-11-23.

## Where things stand

The first playable milestone is built, runs in a browser, and is merged to `main` and pushed (owner OK given in the project chat on 2026-11-23).

Step 7 (a balance pass and sound effects) is built, checked in a browser, and merged to `main` and pushed (owner OK given on 2026-11-23). Every step in the order of work is now done.

All nine bugs listed in `PLAN.md` were fixed on 2026-11-23 by five agents working in parallel, each reviewed and then tested together. The fixes are on the branch `bug-fixes`.

Built and checked in headless Chromium:

- Start screen, how to play screen
- 3 floors: 2 random floors with stairs, then a set boss floor
- Map enemies that stand or patrol, and hidden ambushers
- Menu battles: Attack, Guard, Potion, Flee. Ambushers get the first turn
- XP, levels, gold, potions
- Floor rewards: lowest level item goes up, 25% chance of a trinket
- Vendor between floors (boosts for this run only)
- Boss: Mogrum the Ork. Can not be fled from
- Win and lose screens
- Shop between runs with saved gold and permanent upgrades
- Sound effects made in code with the Web Audio API (`src/audio/sfx.ts`). M turns sound off or on, and the choice is saved

Not done yet: touch controls. The sound has only been checked for running without errors. Nobody has listened to it yet, so the owner should play it and say how it sounds.

## Decisions the owner made

- Name: KeepFall. The owner renamed the repo to `keepfall` to match.
- View and movement: top-down, 4 directions only, WASD.
- Enemies on the map are visible and can be fought or walked around. Some are hidden and jump out.
- Fights: separate battle screen, turns, menu of Attack, Guard, Potion, Flee. An ambusher gets the first turn.
- Gear: sword (damage), shield (Guard), armor (health), plus trinkets with passive bonuses.
- Floor reward: the lowest level item always goes up. 25% chance of an extra item, and that item is a trinket (confirmed).
- Fight rewards: XP and gold.
- Death: the run ends and the player keeps their gold for the shop.
- Gold (changed 2026-11-23, reading confirmed by the owner): the permanent shop between runs stays. Gold can also be spent between floors at a vendor, but only on boosts that last for the current run.
- The player must reach the stairs to clear a floor but does not have to fight. The boss can not be skipped (confirmed).
- Visible enemies stand still or patrol a short path and only fight when touched. Hidden ones trigger when the knight steps next to them (confirmed).
- Boss: a big fat strong goblin or Ork "for now". Built as Mogrum the Ork.
- Floors: 2 regular floors, then a boss floor.
- Art and sound: original, drawn in code, warm fantasy colors, no outside assets.
- Stack: TypeScript, Vite, canvas. Keyboard only for now, with room left for touch controls.
- Single player, no server.
- Handoff notes live in this repo as `HANDOFF.md`. The old hub repo is being decommissioned, so there is no hub copy.

## Open items

- The merged branches `first-playable` and `balance-and-sound` are still on GitHub. The cloud session can not delete branches (the git proxy refuses it), so the owner deletes them on the repo's Branches page.
- Next: `PLAN.md` holds the plan for the next features and the list of bugs that were fixed. The bug fixes are done. Nothing else in it is approved yet. The owner picks what gets built and in what order.
- Sound on touch devices has only been checked in a headless browser, not on a real phone.

## Balance notes

Numbers after the bug fixes on 2026-11-23:

- Regular enemies grow by 1.6 times on floor 2 and 2.2 times on floor 3 in health. Attack growth stops at 1.65 times, so floor 3 enemies have 5 to 8 attack. The Ork has 150 health and 10 attack. A level up heals 40% of max health.
- Simulated first runs with no shop upgrades (3000 runs each, real battle rules, no map):
  - Skip every fight: wins 0%.
  - Fight half the visible enemies, guard heavy blows: wins about 20%.
  - Fight everything, guard heavy blows: wins about 75%.
  - Fight everything, never guard: wins about 27%.
  - Fight everything but buy nothing from the vendor: wins about 16%. Vendor spending matters.
- With a few cheap shop upgrades (Vigor 2, Might 1) a careful full clear wins about 99%. The shop makes the game easy fast. If that feels too quick, raise shop prices or lower what each upgrade gives.
- Floor 3 Tallow Wisps and Rafter Lurkers have the same attack as on floor 2 and only gain health. That was the price of keeping every guard clearly below the boss.
- Shop prices rise with each purchase of the same upgrade. Vendor prices rise with each purchase in the run.

## Order of work

1. Project setup, and a knight walking around a floor. Done
2. Random floor layout, stairs and moving between floors. Done
3. Map enemies, hidden ambushers and the battle screen. Done
4. Gear, XP, gold, potions and floor rewards. Done
5. The boss floor, and the win and lose screens. Done
6. The shop between runs, with saving. Done
7. A balance pass and simple sound effects. Done

## Project rules

- Make an original game. Do not recreate a specific existing game's name, characters, art, music, levels or look.
- Only use assets the owner supplies, assets made for this project, or assets with a clear free license listed in `CREDITS.md`.
- Never commit secrets, tokens, internal hostnames, IPs or personal email addresses. This repo is public. Run a secrets check before every push.
- No force pushes. No merges without the owner's OK. Commit and push only when the owner asks.
- Use plain words and no em dashes in docs, UI text and commits. Commit messages end with a Co-Authored-By line for Claude.
- Keep LF line endings (`.gitattributes` has `* text=auto eol=lf`).
- Show each step running in a browser before committing it.
- If the game will be hosted on the owner's home server, write the steps for the owner to run. The work PC never connects to home servers.
