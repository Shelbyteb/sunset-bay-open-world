// Sunset Bay — traffic cars that drive the avenues and streets, and pedestrians
// strolling the sidewalks. Both keep the city feeling alive behind the player.
import { AVENUES, ROAD_W, STREETS, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { BEACH_Y, CAR, WORLD_H, WORLD_W } from './config.js';

const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8c33d', '#7dd94f', '#e8e8e8', '#2c2c34', '#d97fb5', '#4fd9c9', '#c97b3d'];
const PED_COLORS = ['#f2c94c', '#7fb5d9', '#d98a7f', '#9ad97f', '#c9a0d9', '#e8e8e8', '#5b8a72'];

export function makeCar(random, x, y, angle, opts) {
  const o = opts || {};
  return {
    x,
    y,
    angle,
    speed: o.speed ?? 0,
    color: o.color ?? random.pick(CAR_COLORS),
    driver: o.driver ?? 'traffic',
    police: !!o.police,
    parked: !!o.parked,
    roadV: o.roadV ?? null,
    roadH: o.roadH ?? null,
    lane: o.lane ?? 0,
    dir: o.dir ?? 1,
    targetSpeed: o.targetSpeed ?? randomRange(random, 120, 210),
    turnTimer: randomRange(random, 2, 8),
    brakeLight: false,
  };
}

function randomRange(random, min, max) {
  return min + random.next() * (max - min);
}

/** A traffic car already rolling on a road, facing along it. */
export function spawnTrafficCar(random, city) {
  const vertical = random.chance(0.5);
  let car;
  if (vertical) {
    const ax = random.pick(city.avenues);
    const lane = random.chance(0.5) ? -1 : 1;
    const dir = lane > 0 ? 1 : -1;
    car = makeCar(random, ax + lane * (ROAD_W / 4), randomRange(random, 100, BEACH_Y - 150),
      dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      { roadV: ax, lane, dir, speed: randomRange(random, 100, 200) });
  } else {
    const sy = random.pick(city.streets);
    const lane = random.chance(0.5) ? -1 : 1;
    const dir = lane > 0 ? 1 : -1;
    car = makeCar(random, randomRange(random, 100, WORLD_W - 100), sy + lane * (ROAD_W / 4),
      dir > 0 ? 0 : Math.PI,
      { roadH: sy, lane, dir, speed: randomRange(random, 100, 200) });
  }
  return car;
}

/** A parked car at the kerb, free for the taking. */
export function spawnParkedCar(random, city) {
  const p = randomRoadPoint(random, city);
  const vertical = random.chance(0.5);
  const angle = vertical ? (random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (random.chance(0.5) ? 0 : Math.PI);
  const off = vertical ? 30 : 0;
  return makeCar(random, p.x + (vertical ? off : 0), p.y + (vertical ? 0 : 30), angle,
    { parked: true, speed: 0, driver: null });
}

function makePed(random, city) {
  const p = randomSidewalkPoint(random, city);
  return {
    x: p.x,
    y: p.y,
    angle: random.next() * Math.PI * 2,
    speed: randomRange(random, 45, 85),
    color: random.pick(PED_COLORS),
    walkPhase: random.next() * Math.PI * 2,
    flee: 0,
    // Pedestrians walk along one road; at an intersection they may turn.
    vertical: Math.abs(p.x - (AVENUES.find((a) => Math.abs(a - p.x) < 60) ?? -999)) < 60,
    dir: random.chance(0.5) ? 1 : -1,
  };
}

export function spawnWorld(state, random) {
  state.cars = [];
  state.peds = [];
  for (let i = 0; i < 26; i += 1) state.cars.push(spawnTrafficCar(random, state.city));
  for (let i = 0; i < 10; i += 1) state.cars.push(spawnParkedCar(random, state.city));
  for (let i = 0; i < 42; i += 1) state.peds.push(makePed(random, state.city));
}

/** One step for every traffic car: cruise its road, slow for the car ahead, turn at random. */
export function stepTraffic(state, dt) {
  const playerCar = state.player.inCar;
  for (const car of state.cars) {
    if (car.driver === 'player' || car.police) continue;
    if (car.parked) continue;
    // Ease toward cruising speed.
    car.speed += Math.sign(car.targetSpeed - car.speed) * Math.min(Math.abs(car.targetSpeed - car.speed), 140 * dt);
    car.brakeLight = false;
    // Slow down for the car ahead on the same road.
    for (const other of state.cars) {
      if (other === car || other.parked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
      const side = Math.abs(-Math.sin(car.angle) * dx + Math.cos(car.angle) * dy);
      if (ahead > 0 && ahead < 110 && side < 40) {
        car.speed = Math.min(car.speed, Math.max(0, other.speed - 20));
        car.brakeLight = true;
      }
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // At an intersection, sometimes turn onto the crossing road.
    car.turnTimer -= dt;
    if (car.turnTimer <= 0) {
      car.turnTimer = randomRange(state.random, 3, 9);
      const onV = car.roadV !== null && Math.abs(car.x - car.roadV) < 6;
      const onH = car.roadH !== null && Math.abs(car.y - car.roadH) < 6;
      if (onV) {
        const sy = STREETS.find((s) => Math.abs(s - car.y) < ROAD_W / 2);
        if (sy !== undefined && state.random.chance(0.35)) {
          car.roadV = null;
          car.roadH = sy;
          car.angle = state.random.chance(0.5) ? 0 : Math.PI;
          car.dir = car.angle === 0 ? 1 : -1;
          car.y = sy + car.lane * (ROAD_W / 4);
        }
      } else if (onH) {
        const ax = AVENUES.find((a) => Math.abs(a - car.x) < ROAD_W / 2);
        if (ax !== undefined && state.random.chance(0.35)) {
          car.roadH = null;
          car.roadV = ax;
          car.angle = state.random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
          car.dir = car.angle === Math.PI / 2 ? 1 : -1;
          car.x = ax + car.lane * (ROAD_W / 4);
        }
      }
    }
    // Wrap around the city edges so traffic never runs out.
    if (car.x < 40 || car.x > WORLD_W - 40 || car.y < 40 || car.y > BEACH_Y - 40) {
      const fresh = spawnTrafficCar(state.random, state.city);
      car.x = fresh.x;
      car.y = fresh.y;
      car.angle = fresh.angle;
      car.roadV = fresh.roadV;
      car.roadH = fresh.roadH;
      car.lane = fresh.lane;
      car.dir = fresh.dir;
      car.speed = fresh.speed;
    }
    // Bump the player's car out of the way instead of overlapping it.
    if (playerCar && playerCar !== car) {
      const d = Math.hypot(car.x - playerCar.x, car.y - playerCar.y);
      if (d < 70 && d > 0.01) {
        const push = (70 - d) / 70;
        car.x += ((car.x - playerCar.x) / d) * push * 30 * dt * 10;
        car.y += ((car.y - playerCar.y) / d) * push * 30 * dt * 10;
      }
    }
  }

  // Pedestrians: stroll the sidewalk, flee a speeding car, wander off and respawn.
  for (const ped of state.peds) {
    ped.walkPhase += dt * 8;
    let fleeX = 0;
    let fleeY = 0;
    const threat = playerCar && Math.abs(playerCar.speed) > 200
      ? playerCar
      : null;
    if (threat) {
      const d = Math.hypot(ped.x - threat.x, ped.y - threat.y);
      if (d < 160) {
        fleeX = (ped.x - threat.x) / d;
        fleeY = (ped.y - threat.y) / d;
        ped.flee = 1.2;
      }
    }
    if (ped.flee > 0) {
      ped.flee -= dt;
      ped.x += fleeX * 150 * dt;
      ped.y += fleeY * 150 * dt;
      ped.angle = Math.atan2(fleeY, fleeX);
    } else {
      const vx = ped.vertical ? 0 : ped.dir;
      const vy = ped.vertical ? ped.dir : 0;
      ped.x += vx * ped.speed * dt;
      ped.y += vy * ped.speed * dt;
      ped.angle = Math.atan2(vy, vx);
      // Turn around at the end of the block, or at an intersection now and then.
      if (ped.x < 70 || ped.x > WORLD_W - 70 || ped.y < 70 || ped.y > BEACH_Y - 70) ped.dir *= -1;
      else if (state.random.chance(dt * 0.06)) ped.dir *= -1;
    }
    if (ped.x < 30 || ped.x > WORLD_W - 30 || ped.y < 30 || ped.y > BEACH_Y - 30) {
      const fresh = makePed(state.random, state.city);
      ped.x = fresh.x;
      ped.y = fresh.y;
      ped.vertical = fresh.vertical;
      ped.dir = fresh.dir;
    }
  }
}
