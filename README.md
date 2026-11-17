# Sunset Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Shelbyteb/sunset-bay-open-world/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Shelbyteb/sunset-bay-open-world/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun "Make GTA 6" bounty](https://make.fun/c/gta6-01). Pure 2D canvas,
static files, no network requests, keyboard + mouse.

## The story

Mara Voss is new in Sunset Bay — broke, fast behind a wheel, and on fixer
Dana Kline's payroll. Five jobs stand between her and owning this town:

1. **The First Errand** — move a package from the Sunset Docks to the safehouse.
2. **Getaway Driver** — pick up Rico with a bag of cash and the cops on his tail.
3. **The Shakedown** — collect the protection money the Coral Mart crew owes Dana.
4. **The Harbor Heist** — steal a coral-red coupe from the docks lot.
5. **Sunset Showdown** — finish Vex and his crew on the pier, then outrun the whole bay.

Every job pays cash. Finish all five and Sunset Bay is yours.

## What is in the game

- A sun-soaked coastal city to explore **on foot and by car**: downtown towers,
  neighbourhoods, a beach, a bay, and a pier.
- **Traffic and pedestrians** filling the avenues and sidewalks.
- **Cars to steal** — walk up to any parked or moving car and press E.
- A **wanted level** (0–5 stars) with police cars that chase and ram, and foot
  cops who grab you or shoot back. Lay low and the heat cools off.
- **Missions and a story** with minimap markers, a beacon in the world, and
  cash rewards.
- **Combat**: aim with the mouse, click to shoot; rival gang members fight back.
- A **HUD with a minimap** (player, cops, enemies and the job marker), health
  and armour bars, cash and wanted stars.
- A **start screen**, pause, **save** (automatic after every job, plus on pause),
  and synthesized **sound** via WebAudio — engine, sirens, gunfire, and a
  sunset pad. No audio files.

## How to play

Serve `game/` with any static server and open `index.html` in desktop Chrome:

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot, drive in a car |
| Mouse | Aim (click to shoot) |
| E | Steal / enter a car, talk, pick up |
| Shift | Sprint |
| Space | Handbrake |
| P / Esc | Pause |
| M | Mute |

## Layout

- `game/index.html` — the page; `game/src/` holds the game's own source, one
  job per file: `city.js` (the city), `player.js` (on foot and driving),
  `traffic.js` (cars and pedestrians), `police.js` (wanted level and the law),
  `missions.js` (the five jobs), `combat.js` (shooting and gang members),
  `hud.js` (HUD and minimap), `render.js` (drawing), `audio.js` (WebAudio),
  `input.js`, `world.js` (the state and the step), `shots.js` (the staged
  screenshot scenes), `main.js` (boot and the loop), `config.js`, `random.js`.
- `screenshots/` — four real screenshots of the game, taken in headless Chrome.
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json`.

Everything in Sunset Bay — the city, the names, the characters, the story and
the art — is original. Nothing is copied from any commercial game.
