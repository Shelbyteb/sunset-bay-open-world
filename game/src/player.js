// Sunset Bay — Mara Voss, on foot and behind the wheel. On foot she walks, sprints
// and aims with the mouse; in a car the same keys drive, and E gets in and out.
// Cars are stolen by walking up and pressing E: the owner (if any) runs off.
import { CAR, PLAYER, WORLD_H, WORLD_W } from './config.js';
import { hitsBuilding } from './city.js';

export function createPlayer(city) {
  const start = city.places.start;
  return {
    x: start.x,
    y: start.y,
    angle: -Math.PI / 2,
    health: PLAYER.healthMax,
    armor: 0,
    cash: 0,
    inCar: null,
    speed: 0,
    aimAngle: 0,
    moving: false,
    invulnerable: 0,
    sprinting: false,
  };
}

function clampToWorld(p) {
  p.x = Math.max(20, Math.min(WORLD_W - 20, p.x));
  p.y = Math.max(20, Math.min(WORLD_H - 20, p.y));
}

function tryMove(state, p, dx, dy) {
  const nx = p.x + dx;
  const ny = p.y + dy;
  if (!hitsBuilding(state.city, nx, p.y, PLAYER.radius)) p.x = nx;
  if (!hitsBuilding(state.city, p.x, ny, PLAYER.radius)) p.y = ny;
  clampToWorld(p);
}

/** On-foot step: WASD moves, Shift sprints, and the aim follows the mouse. */
export function stepOnFoot(state, player, input, dt, camera) {
  const move = input.move();
  const speed = input.sprint() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  player.sprinting = input.sprint() && (move.x !== 0 || move.y !== 0);
  const len = Math.hypot(move.x, move.y) || 1;
  const dx = (move.x / len) * speed * dt;
  const dy = (move.y / len) * speed * dt;
  player.moving = move.x !== 0 || move.y !== 0;
  if (player.moving) {
    tryMove(state, player, dx, dy);
    player.angle = Math.atan2(dy, dx);
  }
  // Aim at the mouse cursor, in world coordinates.
  const wx = camera.x + input.mouse.x / camera.zoom;
  const wy = camera.y + input.mouse.y / camera.zoom;
  player.aimAngle = Math.atan2(wy - player.y, wx - player.x);
  if (player.invulnerable > 0) player.invulnerable -= dt;
}

/** Driving step: W/S are throttle and brake/reverse, A/D steer with the speed. */
export function stepDriving(state, player, input, dt) {
  const car = player.inCar;
  const move = input.move();
  const forward = -move.y; // W is forward
  const steer = move.x;
  const handbrake = input.handbrake();
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) {
    car.speed -= car.speed > 20 ? CAR.brake * dt : CAR.reverseAccel * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 900 * dt);
  const max = car.police ? CAR.policeMaxSpeed : CAR.maxSpeed;
  car.speed = Math.max(-CAR.maxReverse, Math.min(max, car.speed));
  const turn = steer * CAR.grip * dt * Math.min(1, Math.abs(car.speed) / 160) * Math.sign(car.speed || 1);
  car.angle += turn * (car.speed < 0 ? -1 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (hitsBuilding(state.city, nx, ny, 20)) {
    if (Math.abs(car.speed) > 260) state.events.push({ type: 'crash', x: car.x, y: car.y });
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.y = ny;
  }
  clampToWorld(car);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = car.speed;
  if (player.invulnerable > 0) player.invulnerable -= dt;
}

/** The nearest car the player can get into, within reach, or null. */
export function nearestCar(state, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car === state.player.inCar) continue;
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Get out of the car beside it, on foot. */
export function exitCar(state) {
  const player = state.player;
  const car = player.inCar;
  if (!car) return;
  car.speed = 0;
  car.driver = null;
  const side = { x: car.x - Math.sin(car.angle) * 44, y: car.y + Math.cos(car.angle) * 44 };
  player.x = side.x;
  player.y = side.y;
  clampToWorld(player);
  player.inCar = null;
  player.speed = 0;
}

/** Steal a car: take the wheel, throw the driver out, and raise the heat if seen. */
export function stealCar(state, car) {
  const player = state.player;
  if (car.driver === 'traffic') {
    state.events.push({ type: 'carjack', x: car.x, y: car.y });
  }
  car.driver = 'player';
  car.parked = false;
  player.inCar = car;
  player.speed = car.speed;
}
