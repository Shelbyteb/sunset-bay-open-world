// Sunset Bay — the world: one state object holding the city, the player, the
// traffic, the police, the missions and the combat, and one step() that moves
// them all forward. No drawing and no browser in here: main.js owns the loop.
import { PLAYER, SAVE_KEY } from './config.js';
import { buildCity, randomRoadPoint } from './city.js';
import { createRandom } from './random.js';
import { createPlayer, exitCar, nearestCar, stealCar, stepDriving, stepOnFoot } from './player.js';
import { spawnWorld, stepTraffic } from './traffic.js';
import { addWanted, stepPolice } from './police.js';
import { fireBullet, stepBullets, stepEnemies } from './combat.js';
import { missionInteract, stepMissions } from './missions.js';

export const EVENT_WASTED = 1;
export const EVENT_BUSTED = 2;

const PICKUP_KINDS = ['health', 'armor', 'cash'];

function spawnPickups(state, random) {
  state.pickups = [];
  for (let i = 0; i < 14; i += 1) {
    const p = randomRoadPoint(random, state.city);
    state.pickups.push({
      kind: PICKUP_KINDS[i % PICKUP_KINDS.length],
      x: p.x + random.range(-60, 60),
      y: p.y + random.range(-60, 60),
      taken: false,
      bob: random.next() * Math.PI * 2,
    });
  }
}

/** A fresh world for `seed`: the city, a full street, and Mara at her apartment. */
export function createWorld(seed) {
  const random = createRandom(seed);
  const city = buildCity(random);
  const state = {
    seed,
    random,
    city,
    time: 0,
    player: null,
    cars: [],
    peds: [],
    police: [],
    bullets: [],
    enemies: [],
    effects: [],
    pickups: [],
    wanted: 0,
    wantedHeat: 0,
    heatTimer: 0,
    mission: { index: 0, step: 0, active: false, done: false, spawned: false, targetCar: null, pickupDone: false },
    messages: [],
    events: [],
    camera: { x: 0, y: 0, zoom: 1 },
    stats: { carsStolen: 0, shotsFired: 0, jobsDone: 0 },
    storyComplete: false,
  };
  state.player = createPlayer(city);
  spawnWorld(state, random);
  spawnPickups(state, random);
  centerCamera(state, true);
  return state;
}

export function centerCamera(state, snap) {
  const player = state.player;
  const view = state.view || { w: 1280, h: 720 };
  const zoom = player.inCar ? 0.82 : 1;
  const tx = player.x - view.w / 2 / zoom;
  const ty = player.y - view.h / 2 / zoom;
  if (snap) {
    state.camera.x = tx;
    state.camera.y = ty;
    state.camera.zoom = zoom;
  } else {
    state.camera.x += (tx - state.camera.x) * 0.12;
    state.camera.y += (ty - state.camera.y) * 0.12;
    state.camera.zoom += (zoom - state.camera.zoom) * 0.05;
  }
}

function handleEvents(state) {
  let result = 0;
  // Keep a copy for main.js (sounds, saves) before the queue is cleared.
  state.recentEvents = state.events.slice();
  for (const e of state.events) {
    if (e.type === 'carjack') {
      state.stats.carsStolen += 1;
      addWanted(state, 1, 'stole a car');
      state.messages.push({ text: 'Car stolen!', sub: 'Someone saw that. The cops are coming.', life: 3 });
    } else if (e.type === 'busted') {
      result |= EVENT_BUSTED;
    } else if (e.type === 'rammed' || e.type === 'crash') {
      state.effects.push({ type: 'smoke', x: e.x, y: e.y, life: 0.6, max: 0.6 });
    }
  }
  state.events.length = 0;
  return result;
}

function stepPickups(state, dt) {
  const player = state.player;
  for (const p of state.pickups) {
    if (p.taken) continue;
    p.bob += dt * 3;
    if (player.inCar) continue;
    if (Math.hypot(p.x - player.x, p.y - player.y) < 30) {
      p.taken = true;
      if (p.kind === 'health') {
        player.health = Math.min(PLAYER.healthMax, player.health + 40);
        state.events.push({ type: 'pickup', kind: 'health' });
      } else if (p.kind === 'armor') {
        player.armor = Math.min(PLAYER.armorMax, player.armor + 50);
        state.events.push({ type: 'pickup', kind: 'armor' });
      } else {
        player.cash += 50;
        state.events.push({ type: 'pickup', kind: 'cash' });
      }
    }
  }
  // Pickups come back over time so the city never runs dry.
  if (state.pickups.every((p) => p.taken) || state.time % 60 < dt) {
    for (const p of state.pickups) {
      if (p.taken && state.random.chance(0.25)) {
        const spot = randomRoadPoint(state.random, state.city);
        p.x = spot.x;
        p.y = spot.y;
        p.taken = false;
      }
    }
  }
}

function stepEffects(state, dt) {
  for (const e of state.effects) e.life -= dt;
  state.effects = state.effects.filter((e) => e.life > 0);
  for (const m of state.messages) m.life -= dt;
  state.messages = state.messages.filter((m) => m.life > 0);
}

/**
 * One fixed step. `input` is the live keyboard/mouse; `actions` are the one-shot
 * presses main.js took this frame (ACTION_INTERACT and friends).
 * Returns EVENT_WASTED / EVENT_BUSTED flags for main.js to act on.
 */
export function stepWorld(state, input, dt, actions) {
  state.time += dt;
  const player = state.player;

  // Interact (E): missions first, then getting in and out of cars.
  if (actions & 4) { // ACTION_INTERACT
    if (!missionInteract(state)) {
      if (player.inCar) exitCar(state);
      else {
        const car = nearestCar(state, 90);
        if (car) stealCar(state, car);
      }
    }
  }

  if (player.inCar) stepDriving(state, player, input, dt);
  else stepOnFoot(state, player, input, dt, state.camera);

  // Shooting: hold the mouse button, aim with the cursor.
  if (input.mouse.down && !player.inCar) {
    state.shootTimer = (state.shootTimer || 0) - dt;
    if (state.shootTimer <= 0) {
      state.shootTimer = 0.22;
      const muzzleX = player.x + Math.cos(player.aimAngle) * 20;
      const muzzleY = player.y + Math.sin(player.aimAngle) * 20;
      fireBullet(state, muzzleX, muzzleY, player.aimAngle, 'player', 34);
      state.stats.shotsFired += 1;
      state.events.push({ type: 'shot' });
    }
  }

  stepTraffic(state, dt);
  stepPolice(state, dt);
  stepEnemies(state, dt);
  stepBullets(state, dt);
  stepMissions(state);
  stepPickups(state, dt);
  stepEffects(state, dt);
  centerCamera(state, false);

  // Enemy pot-shots and rams arrive as events from the police step.
  for (const e of state.events) {
    if (e.type === 'enemyShot') {
      const angle = Math.atan2(e.ty - e.y, e.tx - e.x) + (state.random.next() - 0.5) * 0.2;
      fireBullet(state, e.x, e.y, angle, 'enemy', e.damage);
      state.events.push({ type: 'enemyFired' });
    }
  }

  const result = handleEvents(state);
  if (player.health <= 0) return result | EVENT_WASTED;
  return result;
}

/** Save the run: cash, story progress, health and where Mara is standing. */
export function saveGame(state) {
  try {
    const save = {
      cash: state.player.cash,
      missionIndex: state.mission.index,
      missionDone: state.mission.done,
      health: state.player.health,
      armor: state.player.armor,
      x: state.player.x,
      y: state.player.y,
      carsStolen: state.stats.carsStolen,
      jobsDone: state.stats.jobsDone,
      time: state.time,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

/** Load a save into a fresh world, or null when there is none. */
export function loadGame(state) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    state.player.cash = save.cash || 0;
    state.player.health = save.health || PLAYER.healthMax;
    state.player.armor = save.armor || 0;
    state.player.x = save.x ?? state.city.places.start.x;
    state.player.y = save.y ?? state.city.places.start.y;
    state.mission.index = save.missionIndex || 0;
    state.mission.done = !!save.missionDone;
    state.stats.carsStolen = save.carsStolen || 0;
    state.stats.jobsDone = save.jobsDone || 0;
    state.time = save.time || 0;
    centerCamera(state, true);
    return save;
  } catch {
    return null;
  }
}
