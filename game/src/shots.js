// Sunset Bay — the staged screenshot scenes behind ?shot=chase|street|steal|mission.
// Each one sets the real world to a fixed, readable moment — a chase, a street,
// a theft, a fight — then steps it forward a little so the traffic and the cops
// are mid-motion, exactly as a player would see them. The same seed always
// gives the same frame.
import { STEP } from './config.js';
import { centerCamera, stepWorld } from './world.js';
import { makeCar, spawnTrafficCar } from './traffic.js';
import { spawnPoliceCar } from './police.js';
import { startMission } from './missions.js';
import { spawnEnemy } from './combat.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** Put Mara on a road, in a car, already moving. */
function putInCar(state, x, y, angle, speed) {
  const car = makeCar(state.random, x, y, angle, { driver: 'player', speed });
  car.color = '#e85d3d';
  state.cars.push(car);
  state.player.inCar = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.player.speed = speed;
}

/** Step the world forward with no input, so traffic and chases are mid-motion. */
function settle(state, seconds, drive) {
  const fakeInput = {
    move: () => ({ x: 0, y: drive ? -1 : 0 }),
    sprint: () => false,
    handbrake: () => false,
    mouse: { x: 0, y: 0, down: false, clicked: false },
    takeActions: () => 0,
    takeClick: () => false,
  };
  for (let i = 0; i < seconds / STEP; i += 1) stepWorld(state, fakeInput, STEP, 0);
  centerCamera(state, true);
}

/** Keep only the traffic near the player, so the frame reads at a glance. */
function thinTraffic(state, keep) {
  const p = state.player;
  state.cars = state.cars.filter((car) => {
    if (car.driver === 'player' || car.police) return true;
    return Math.hypot(car.x - p.x, car.y - p.y) < keep;
  });
  state.peds = state.peds.filter((ped) => Math.hypot(ped.x - p.x, ped.y - p.y) < keep);
}

/**
 * Set `state` to the named scene and return the screen to draw over it.
 * chase: the cover — a police chase at wanted 3, minimap, mission objective.
 * street: on foot downtown, traffic and pedestrians everywhere.
 * steal: Mara beside a parked car, door open, a cop watching from afar.
 * mission: the pier showdown — guns out, wanted 4, Vex's crew closing in.
 */
export function stageShot(name, state) {
  const city = state.city;
  const places = city.places;
  if (name === 'street') {
    state.player.x = 1080;
    state.player.y = 940;
    state.player.angle = Math.PI / 2;
    state.player.aimAngle = Math.PI / 2;
    state.mission.active = false;
    state.mission.index = 0;
    // Fill the avenue with traffic and the sidewalk with people.
    for (let i = 0; i < 10; i += 1) state.cars.push(spawnTrafficCar(state.random, city));
    settle(state, 1.5);
    thinTraffic(state, 1100);
    centerCamera(state, true);
    state.camera.zoom = 1.2;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'steal') {
    const car = makeCar(state.random, 1740 + 60, 1520, Math.PI / 2, { parked: true, driver: null });
    car.color = '#3d7bd9';
    state.cars.push(car);
    state.player.x = 1740 + 60 - 50;
    state.player.y = 1520 + 10;
    state.player.angle = 0;
    state.player.aimAngle = 0;
    state.wanted = 1;
    state.mission.active = false;
    state.mission.index = 0;
    spawnPoliceCar(state, state.random);
    settle(state, 1.2);
    thinTraffic(state, 900);
    centerCamera(state, true);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    startMission(state, 4);
    // Skip to the pier fight: the second step, with the crew already out.
    state.mission.step = 1;
    const pier = places.pierEnd;
    state.player.x = pier.x - 40;
    state.player.y = pier.y - 220;
    state.player.angle = Math.PI / 2;
    state.player.aimAngle = Math.PI / 2;
    state.player.health = 82;
    state.player.armor = 40;
    state.wanted = 4;
    // Re-enter the combat step so the crew spawns around the pier.
    const { enterStepForShot } = shotHelpers;
    enterStepForShot(state);
    settle(state, 1.0);
    centerCamera(state, true);
    return { screen: SCREEN_PLAY };
  }
  // Default: the chase cover.
  startMission(state, 1);
  state.mission.step = 2;
  state.mission.active = true;
  // Heading north up the main avenue, downtown towers on both sides.
  putInCar(state, 2400, 2680, -Math.PI / 2, 420);
  state.wanted = 3;
  spawnPoliceCar(state, state.random);
  spawnPoliceCar(state, state.random);
  spawnPoliceCar(state, state.random);
  state.player.cash = 2450;
  state.player.health = 100;
  settle(state, 2.2, true);
  thinTraffic(state, 1100);
  centerCamera(state, true);
  return { screen: SCREEN_PLAY };
}

// The missions module does not export its step setup, so the shot file keeps a
// small local copy for the pier scene: spawn the crew around the pier.
const shotHelpers = {
  enterStepForShot(state) {
    const pier = state.city.places.pierEnd;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      spawnEnemy(state, pier.x + Math.cos(a) * 150, pier.y - 60 + Math.sin(a) * 110);
    }
    state.mission.spawned = true;
  },
};

export { SCREEN_TITLE };
