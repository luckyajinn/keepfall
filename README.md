# KeepFall

KeepFall is a small single-player roguelite that runs in the browser. A knight fights up through a keep of 3 floors and has to beat the Ork on the last one. A run takes about 10 minutes.

Everything is drawn in code on a canvas, and the sound effects are made in code too. There are no image or sound files.

## How to play

- Move with W, A, S and D (the arrow keys work too). Every step is up, down, left or right.
- You can see most enemies. Walk into one to fight it, or walk around it and miss its XP and gold.
- Some enemies hide. Step next to one and it ambushes you and gets the first turn.
- Fights are turn based. Pick Attack, Guard, Potion or Flee with W and S and Enter, or press 1 to 4.
- Guard blocks part of the next hit and makes your next Attack stronger. Guard when an enemy winds up a heavy blow.
- Reach the stairs to clear a floor. Your lowest level item goes up one level, and there is a 1 in 4 chance of a trinket.
- After floors 1 and 2 a vendor sells boosts that last until the run ends.
- Floor 3 has no stairs. You must beat Mogrum the Ork.
- When a run ends, win or lose, you keep your gold. Spend it in the shop on upgrades that stay for every run.
- Press M to turn the sound off or on.

Progress is saved in your browser's local storage. Clearing the site data for the page resets it.

## Run it

You need Node.js 18 or newer.

```
npm install
npm run dev
```

Then open the address that Vite prints, usually http://localhost:5173.

To make a build that any static web server can host:

```
npm run build
```

The files end up in `dist/`. Run `npm run preview` to try the build.

Adding `?seed=123` to the address gives the same floor layouts and enemy placement each time, which helps when testing. Fights and rewards still play out differently, since they depend on what you do.

## Layout

```
index.html
src/
  main.ts          start up and game loop
  game.ts          run state and screen switching
  input.ts         keyboard (touch can hook in here later)
  rng.ts           seeded random numbers
  map/             floor building, tiles, the map screen
  entities/        knight and enemy stats
  battle/          turn rules and the battle screen
  items/           gear, trinkets, floor rewards, the vendor
  meta/            the shop and saved progress
  ui/              HUD and the menu screens
  render/          canvas helpers, colors and sprites
  audio/           sound effects made in code
```

## Status

The first playable version is in: start screen, 3 floors, map enemies and ambushers, menu battles, XP and gold, floor rewards, the vendor, the boss, win and lose screens, and the shop with saved gold.

Sound effects and a first balance pass are in as well.

Still to do: touch controls, and more balance tuning once real players have tried it.

See `CREDITS.md` for where the art and code come from.
