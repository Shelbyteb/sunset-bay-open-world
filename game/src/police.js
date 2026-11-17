// Sunset Bay — the wanted level and the Bay City police who answer it.
// Crimes raise the heat; police cars chase and ram, foot cops chase and grab.
// Lose the cops' line of sight and the heat cools off, one star at a time.
import { CAR, WANTED_MAX } from './config.js';
import { makeCar, spawnTrafficCar } from './traffic.js';
import { BEACH_Y, WORLD_W } from './config.js';

export const WANTED_NAMES = ['Clean', 'Suspect', 'Pursuit', 'Manhunt', 'Lockdown', 'Full Alert'];

/** How many police units the heat calls for at each wanted level. */
const UNITS_AT_WANTED = [0, 1, 2, 3, 4, 6];

/** Raise the wanted level by `stars`, capped at the maximum. */
export function addWanted(state, stars, reason) {
  if (state.wanted >= WANTED_MAX) return;
  state.wanted = Math.min(WANTED_MAX, state.wanted + stars);
  state.wantedHeat = 0;
  state.heatTimer = 0;
  state.events.push({ type: 'wanted', stars: state.wanted, reason: reason || 'crime' });
}

/** Drop the wanted level to zero (a clean getaway, or a mission that clears it). */
export function clearWanted(state) {
  state.wanted = 0;
  state.wantedHeat = 0;
  state.heatTimer = 0;
  for (const unit of state.police) unit.despawn = true;
}

/** Spawn one police car on a road near the player, already rolling toward them. */
export function spawnPoliceCar(state, random) {
  const angle = random.next() * Math.PI * 2;
  const dist = 700 + random.next() * 400;
  let x = state.player.x + Math.cos(angle) * dist;
  let y = state.player.y + Math.sin(angle) * dist;
  x = Math.max(80, Math.min(WORLD_W - 80, x));
  y = Math.max(80, Math.min(BEACH_Y - 80, y));
  const car = makeCar(random, x, y, Math.atan2(state.player.y - y, state.player.x - x),
    { police: true, driver: 'police', speed: 320, color: '#1c2733' });
  car.targetSpeed = CAR.policeMaxSpeed;
  state.cars.push(car);
  state.police.push({ kind: 'car', car, grabTimer: 0, shootTimer: 1 + random.next() });
  return car;
}

/** Spawn a foot cop near the player. */
export function spawnFootCop(state, random) {
  const angle = random.next() * Math.PI * 2;
  const x = Math.max(60, Math.min(WORLD_W - 60, state.player.x + Math.cos(angle) * 260));
  const y = Math.max(60, Math.min(BEACH_Y - 60, state.player.y + Math.sin(angle) * 260));
  const cop = {
    kind: 'foot',
    x,
    y,
    angle: 0,
    speed: 235,
    health: 50,
    grabTimer: 0,
    shootTimer: 1 + random.next(),
    despawn: false,
  };
  state.police.push(cop);
  return cop;
}

function nearestPoliceDistance(state) {
  let best = Infinity;
  for (const unit of state.police) {
    const ux = unit.kind === 'car' ? unit.car.x : unit.x;
    const uy = unit.kind === 'car' ? unit.car.y : unit.y;
    best = Math.min(best, Math.hypot(ux - state.player.x, uy - state.player.y));
  }
  return best;
}

/** One step of the law: keep the right number of units out, chase, ram, grab, shoot. */
export function stepPolice(state, dt) {
  const player = state.player;
  const random = state.random;

  // Keep the street force at the level the heat demands.
  const wantedUnits = UNITS_AT_WANTED[state.wanted] || 0;
  const liveUnits = state.police.filter((u) => !u.despawn).length;
  if (liveUnits < wantedUnits && state.wanted > 0) {
    if (state.wanted >= 2 || random.chance(0.6)) spawnPoliceCar(state, random);
    else spawnFootCop(state, random);
  }

  // Cooling off: no police close by for a while drops a star.
  if (state.wanted > 0) {
    const near = nearestPoliceDistance(state);
    if (near > 650) {
      state.heatTimer += dt;
      if (state.heatTimer > 7) {
        state.wanted -= 1;
        state.heatTimer = 0;
        state.events.push({ type: 'cooled', stars: state.wanted });
      }
    } else {
      state.heatTimer = 0;
    }
  }

  for (const unit of state.police) {
    if (unit.despawn) continue;
    if (unit.kind === 'car') {
      const car = unit.car;
      const dx = player.x - car.x;
      const dy = player.y - car.y;
      const dist = Math.hypot(dx, dy) || 1;
      const wantAngle = Math.atan2(dy, dx);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      // Chase hard, brake a little when right on top of the player.
      const target = dist < 90 ? 140 : CAR.policeMaxSpeed;
      car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 520 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = Math.max(30, Math.min(WORLD_W - 30, car.x));
      car.y = Math.max(30, Math.min(BEACH_Y + 260, car.y));
      // Ramming the player's car hurts it (and the driver a little).
      if (player.inCar && dist < 72) {
        player.inCar.speed *= 0.82;
        car.speed *= 0.8;
        if (Math.abs(car.speed) > 200 && player.invulnerable <= 0) {
          player.health -= 6;
          player.invulnerable = 0.6;
          state.events.push({ type: 'rammed', x: player.x, y: player.y });
        }
      }
      // A police car that gets too far away is lost and replaced.
      if (dist > 2400) unit.despawn = true;
      // At wanted 3+, the passenger cop takes pot-shots at the player.
      if (state.wanted >= 3 && dist < 520) {
        unit.shootTimer -= dt;
        if (unit.shootTimer <= 0) {
          unit.shootTimer = 1.4 + random.next() * 0.8;
          state.events.push({ type: 'enemyShot', x: car.x, y: car.y, tx: player.x, ty: player.y, damage: 5 });
        }
      }
    } else {
      // Foot cop: run at the player, grab them when close and slow.
      const dx = player.x - unit.x;
      const dy = player.y - unit.y;
      const dist = Math.hypot(dx, dy) || 1;
      unit.angle = Math.atan2(dy, dx);
      const speed = player.inCar ? unit.speed + 40 : unit.speed;
      unit.x += Math.cos(unit.angle) * speed * dt;
      unit.y += Math.sin(unit.angle) * speed * dt;
      if (player.inCar) {
        // A cop on foot cannot catch a car: give up and fade out.
        if (dist > 900) unit.despawn = true;
      } else if (dist < 34) {
        unit.grabTimer += dt;
        if (unit.grabTimer > 1.1) {
          state.events.push({ type: 'busted' });
          unit.grabTimer = 0;
        }
      } else {
        unit.grabTimer = 0;
      }
      if (state.wanted >= 3 && dist < 420 && !player.inCar) {
        unit.shootTimer -= dt;
        if (unit.shootTimer <= 0) {
          unit.shootTimer = 1.6 + random.next();
          state.events.push({ type: 'enemyShot', x: unit.x, y: unit.y, tx: player.x, ty: player.y, damage: 6 });
        }
      }
      if (dist > 1600) unit.despawn = true;
    }
  }

  // Sweep out the despawned: police cars go back to being ordinary traffic cars
  // (kept in the world, just no longer hunting), foot cops are removed.
  state.police = state.police.filter((u) => {
    if (!u.despawn) return true;
    if (u.kind === 'car') {
      u.car.police = false;
      u.car.driver = 'traffic';
      u.car.targetSpeed = 150;
    }
    return false;
  });
}

export { spawnTrafficCar };
