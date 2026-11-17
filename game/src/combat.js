// Sunset Bay — combat: the player's pistol, enemy gang members, and the bullets
// that fly between them. Shooting a civilian or a cop is a crime; shooting a
// rival gangster during a job is just business.
import { WANTED_MAX } from './config.js';
import { addWanted } from './police.js';

export const BULLET_SPEED = 900;
export const BULLET_RANGE = 620;

/** Fire one bullet from (x, y) along `angle`. `from` is 'player' or 'enemy'. */
export function fireBullet(state, x, y, angle, from, damage) {
  state.bullets.push({
    x,
    y,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    from,
    damage: damage || 34,
    travelled: 0,
    dead: false,
  });
  state.effects.push({ type: 'muzzle', x, y, angle, life: 0.08, max: 0.08 });
}

function pointHitsCar(x, y, car) {
  const dx = x - car.x;
  const dy = y - car.y;
  const along = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
  const side = -Math.sin(car.angle) * dx + Math.cos(car.angle) * dy;
  return Math.abs(along) < 36 && Math.abs(side) < 20;
}

/** One step for every bullet: fly, hit a building, a car, a person — or fade out. */
export function stepBullets(state, dt) {
  for (const b of state.bullets) {
    if (b.dead) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += BULLET_SPEED * dt;
    if (b.travelled > BULLET_RANGE) {
      b.dead = true;
      continue;
    }
    // Buildings stop bullets.
    if (state.city.buildings.some((bd) => b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h)) {
      state.effects.push({ type: 'spark', x: b.x, y: b.y, life: 0.15, max: 0.15 });
      b.dead = true;
      continue;
    }
    // Cars take the hit (and remember who shot them).
    for (const car of state.cars) {
      if (car === state.player.inCar) continue;
      if (pointHitsCar(b.x, b.y, car)) {
        b.dead = true;
        state.effects.push({ type: 'spark', x: b.x, y: b.y, life: 0.15, max: 0.15 });
        if (b.from === 'player' && car.police) addWanted(state, 1, 'shot a police car');
        break;
      }
    }
    if (b.dead) continue;
    // Pedestrians: hitting one is a crime, and they run.
    for (const ped of state.peds) {
      if (Math.hypot(b.x - ped.x, b.y - ped.y) < 14) {
        b.dead = true;
        ped.flee = 2;
        if (b.from === 'player') {
          addWanted(state, 1, 'shot a pedestrian');
          state.events.push({ type: 'pedDown', x: ped.x, y: ped.y });
        }
        // The pedestrian is hurt, not killed: they stagger away.
        ped.x += (ped.x - b.x) * 0.2;
        ped.y += (ped.y - b.y) * 0.2;
        break;
      }
    }
    if (b.dead) continue;
    // Enemy gang members.
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      if (Math.hypot(b.x - enemy.x, b.y - enemy.y) < 16) {
        b.dead = true;
        enemy.health -= b.damage;
        state.effects.push({ type: 'hit', x: b.x, y: b.y, life: 0.2, max: 0.2 });
        if (enemy.health <= 0) {
          enemy.dead = true;
          state.events.push({ type: 'enemyDown', x: enemy.x, y: enemy.y });
          state.player.cash += 25;
        }
        break;
      }
    }
    if (b.dead) continue;
    // Enemy bullets can hit the player.
    if (b.from === 'enemy') {
      const player = state.player;
      const radius = player.inCar ? 30 : 14;
      if (Math.hypot(b.x - player.x, b.y - player.y) < radius && player.invulnerable <= 0) {
        b.dead = true;
        let dmg = b.damage;
        if (player.armor > 0) {
          const absorbed = Math.min(player.armor, dmg);
          player.armor -= absorbed;
          dmg -= absorbed;
        }
        player.health -= dmg;
        player.invulnerable = 0.35;
        state.events.push({ type: 'playerHit', x: player.x, y: player.y });
      }
    }
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
}

/** Spawn a rival gang member at (x, y) who will fight the player. */
export function spawnEnemy(state, x, y) {
  const enemy = {
    x,
    y,
    angle: 0,
    health: 100,
    speed: 150,
    shootTimer: 0.8 + state.random.next() * 0.8,
    moveTimer: 0,
    strafeDir: state.random.chance(0.5) ? 1 : -1,
    dead: false,
  };
  state.enemies.push(enemy);
  return enemy;
}

/** One step for the gang: close in, strafe, and shoot when they have a line on Mara. */
export function stepEnemies(state, dt) {
  const player = state.player;
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    enemy.angle = Math.atan2(dy, dx);
    enemy.moveTimer -= dt;
    if (enemy.moveTimer <= 0) {
      enemy.moveTimer = 0.7 + state.random.next() * 0.8;
      enemy.strafeDir *= -1;
    }
    let vx = 0;
    let vy = 0;
    if (dist > 260) {
      vx = Math.cos(enemy.angle);
      vy = Math.sin(enemy.angle);
    } else if (dist < 150) {
      vx = -Math.cos(enemy.angle) * 0.6;
      vy = -Math.sin(enemy.angle) * 0.6;
    } else {
      vx = -Math.sin(enemy.angle) * enemy.strafeDir * 0.7;
      vy = Math.cos(enemy.angle) * enemy.strafeDir * 0.7;
    }
    enemy.x += vx * enemy.speed * dt;
    enemy.y += vy * enemy.speed * dt;
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && dist < 520) {
      enemy.shootTimer = 1.1 + state.random.next() * 0.9;
      const spread = (state.random.next() - 0.5) * 0.22;
      fireBullet(state, enemy.x + Math.cos(enemy.angle) * 18, enemy.y + Math.sin(enemy.angle) * 18,
        enemy.angle + spread, 'enemy', 9);
      state.events.push({ type: 'enemyFired' });
    }
  }
  state.enemies = state.enemies.filter((e) => !e.dead);
}

export { WANTED_MAX };
