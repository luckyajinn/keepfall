# KeepFall handoff

Last updated: 2026-11-23

This file lives in the repo by the owner's choice (2026-11-23). The repo is public, so keep secrets, tokens, internal hostnames, IPs and personal email addresses out of it.

The repo was renamed from `knightfall` to `keepfall` on 2026-11-23.

## Where things stand

The first playable milestone is built, runs in a browser, and is merged to `main` and pushed (owner OK given in the project chat on 2026-11-23).

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

Not done yet: sound effects, a deeper balance pass, touch controls.

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

- The merged branch `first-playable` is still on GitHub at the same commit as `main`. The owner OK'd deleting it, but the cloud session's git proxy refused the delete (HTTP 403). The owner can delete it on the repo's Branches page.
- Next work: step 7, a balance pass and simple sound effects. Touch controls come later.

## Balance notes

- Simulated boss fights: a knight who skips every fight loses every time. A knight who clears the floors wins. A half clear nearly always loses.
- Four full runs played by a test script that guards every heavy blow all won. It may be a little easy for a careful player. Look at this in the balance pass.
- Shop prices rise with each purchase of the same upgrade.
- Vendor prices rise with each purchase in the run.

## Order of work

1. Project setup, and a knight walking around a floor. Done
2. Random floor layout, stairs and moving between floors. Done
3. Map enemies, hidden ambushers and the battle screen. Done
4. Gear, XP, gold, potions and floor rewards. Done
5. The boss floor, and the win and lose screens. Done
6. The shop between runs, with saving. Done
7. A balance pass and simple sound effects. Next

## Project rules

- Make an original game. Do not recreate a specific existing game's name, characters, art, music, levels or look.
- Only use assets the owner supplies, assets made for this project, or assets with a clear free license listed in `CREDITS.md`.
- Never commit secrets, tokens, internal hostnames, IPs or personal email addresses. This repo is public. Run a secrets check before every push.
- No force pushes. No merges without the owner's OK. Commit and push only when the owner asks.
- Use plain words and no em dashes in docs, UI text and commits. Commit messages end with a Co-Authored-By line for Claude.
- Keep LF line endings (`.gitattributes` has `* text=auto eol=lf`).
- Show each step running in a browser before committing it.
- If the game will be hosted on the owner's home server, write the steps for the owner to run. The work PC never connects to home servers.
