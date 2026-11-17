// Sunset Bay — drawing only: the city, the cars, the people and the effects,
// through a camera that follows Mara, then the HUD and the menu screens.
// Warm sunset light: a soft amber wash over everything, and long shadows.
import { BEACH_Y, PALETTE, PIER, WATER_Y, WORLD_H, WORLD_W } from './config.js';
import { ROAD_W, SIDEWALK_W } from './city.js';
import { drawHud } from './hud.js';
import { currentObjective, isMissionTarget } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_COMPLETE = 'complete';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function text(ctx, value, x, y, size, color, align, weight) {
  ctx.font = `${weight || 600} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 1280, h: 720, dpr: 1 };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    view.dpr = dpr;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  /** World rectangle currently visible, for culling. */
  function visibleRect(state) {
    const cam = state.camera;
    return {
      x: cam.x - 80,
      y: cam.y - 80,
      w: view.w / cam.zoom + 160,
      h: view.h / cam.zoom + 160,
    };
  }

  function inView(v, x, y, pad) {
    return x > v.x - pad && x < v.x + v.w + pad && y > v.y - pad && y < v.y + v.h + pad;
  }

  function drawGround(state, v) {
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(v.x, v.y, v.w, v.h);
    // Dry patches for variety.
    ctx.fillStyle = PALETTE.grassDry;
    for (let i = 0; i < 40; i += 1) {
      const px = ((i * 977) % WORLD_W) - 100;
      const py = ((i * 571) % 3000) + 100;
      if (inView(v, px, py, 200)) ctx.fillRect(px, py, 260, 150);
    }
    // Beach and bay along the south edge.
    if (v.y + v.h > BEACH_Y) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(v.x, BEACH_Y, v.w, WATER_Y - BEACH_Y);
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(v.x, WATER_Y, v.w, WORLD_H - WATER_Y);
      ctx.fillStyle = PALETTE.waterDeep;
      for (let i = 0; i < 8; i += 1) {
        const wy = WATER_Y + 40 + i * 26;
        if (inView(v, 0, wy, 40)) {
          ctx.fillRect(v.x, wy, v.w, 3);
        }
      }
    }
    // Parks: darker green lawns.
    ctx.fillStyle = '#5d9148';
    for (const park of state.city.parks) {
      if (inView(v, park.x + park.w / 2, park.y + park.h / 2, 100)) ctx.fillRect(park.x, park.y, park.w, park.h);
    }
  }

  function drawRoads(state, v) {
    ctx.fillStyle = PALETTE.road;
    for (const ax of state.city.avenues) {
      if (ax < v.x - 80 || ax > v.x + v.w + 80) continue;
      ctx.fillRect(ax - ROAD_W / 2, v.y, ROAD_W, v.h);
    }
    for (const sy of state.city.streets) {
      if (sy < v.y - 80 || sy > v.y + v.h + 80) continue;
      ctx.fillRect(v.x, sy - ROAD_W / 2, v.w, ROAD_W);
    }
    // Sidewalk borders.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const ax of state.city.avenues) {
      if (ax < v.x - 80 || ax > v.x + v.w + 80) continue;
      ctx.fillRect(ax - ROAD_W / 2 - SIDEWALK_W, v.y, SIDEWALK_W, v.h);
      ctx.fillRect(ax + ROAD_W / 2, v.y, SIDEWALK_W, v.h);
    }
    for (const sy of state.city.streets) {
      if (sy < v.y - 80 || sy > v.y + v.h + 80) continue;
      ctx.fillRect(v.x, sy - ROAD_W / 2 - SIDEWALK_W, v.w, SIDEWALK_W);
      ctx.fillRect(v.x, sy + ROAD_W / 2, v.w, SIDEWALK_W);
    }
    // Dashed centre lines.
    ctx.fillStyle = PALETTE.lane;
    for (const ax of state.city.avenues) {
      if (ax < v.x - 80 || ax > v.x + v.w + 80) continue;
      for (let y = Math.floor(v.y / 60) * 60; y < v.y + v.h; y += 60) ctx.fillRect(ax - 2, y, 4, 30);
    }
    for (const sy of state.city.streets) {
      if (sy < v.y - 80 || sy > v.y + v.h + 80) continue;
      for (let x = Math.floor(v.x / 60) * 60; x < v.x + v.w; x += 60) ctx.fillRect(x, sy - 2, 30, 4);
    }
    // The pier: wooden planks over the water.
    if (inView(v, PIER.x + PIER.w / 2, PIER.y + 100, 200)) {
      ctx.fillStyle = PALETTE.pierWood;
      ctx.fillRect(PIER.x, PIER.y, PIER.w, PIER.endY - PIER.y);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = PIER.y + 14; y < PIER.endY; y += 22) ctx.fillRect(PIER.x, y, PIER.w, 2);
    }
  }

  function drawBuildings(state, v) {
    for (const b of state.city.buildings) {
      if (!inView(v, b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
      // Long sunset shadow to the north-east.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + 12, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      if (b.tower) {
        // Glass tower: window grid.
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 22) {
          for (let wy = b.y + 12; wy < b.y + b.h - 10; wy += 22) ctx.fillRect(wx, wy, 10, 12);
        }
      } else if (b.roof === 'garden') {
        ctx.fillStyle = '#5d9148';
        ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
      } else if (b.roof === 'pool') {
        ctx.fillStyle = '#3d9bff';
        ctx.fillRect(b.x + b.w / 2 - 18, b.y + b.h / 2 - 12, 36, 24);
      }
      // Rooftop detail: a vent or skylight.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 8, b.y + 8, 16, 12);
    }
    // Palms: a trunk dot and a green crown.
    for (const palm of state.city.palms) {
      if (!inView(v, palm.x, palm.y, 30)) continue;
      ctx.fillStyle = '#6b4a2f';
      ctx.beginPath();
      ctx.arc(palm.x, palm.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.palm;
      ctx.beginPath();
      ctx.arc(palm.x, palm.y, palm.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(palm.x - 2, palm.y - 2, palm.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(car, state) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-34 + 5, -15 + 6, 68, 30);
    // Body.
    ctx.fillStyle = car.color;
    const len = 68;
    const wid = 32;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -wid / 2, len, wid, 9);
    ctx.fill();
    // Cabin and windshield.
    ctx.fillStyle = 'rgba(20,26,34,0.85)';
    ctx.beginPath();
    ctx.roundRect(-8, -wid / 2 + 4, 22, wid - 8, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,240,0.5)';
    ctx.fillRect(12, -wid / 2 + 5, 8, wid - 10);
    // Headlights and tail lights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 6);
    ctx.fillRect(len / 2 - 3, wid / 2 - 9, 3, 6);
    ctx.fillStyle = car.brakeLight ? '#ff3b30' : '#a33';
    ctx.fillRect(-len / 2, -wid / 2 + 3, 3, 6);
    ctx.fillRect(-len / 2, wid / 2 - 9, 3, 6);
    if (car.police) {
      // Light bar, flashing red and blue.
      const flash = Math.floor(state.time * 4) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#2f7bff';
      ctx.fillRect(-6, -wid / 2 + 2, 12, 8);
      ctx.fillStyle = flash ? '#2f7bff' : '#ff3b30';
      ctx.fillRect(-6, wid / 2 - 10, 12, 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 4);
    }
    if (car === state.mission.targetCar) {
      // The heist coupe: a gold ring so the player can spot it.
      ctx.strokeStyle = '#ffd23d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 52 + Math.sin(state.time * 5) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPed(ped, state) {
    const bob = Math.sin(ped.walkPhase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 3, ped.y + 4, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob * 0.3, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c2c34';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4 + bob * 0.3, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.inCar) return;
    const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 12) % 2 === 0;
    if (blink) return;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x + 3, p.y + 5, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mara: coral jacket, dark hair, facing her aim.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aimAngle);
    ctx.fillStyle = '#e85d3d';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c2c34';
    ctx.beginPath();
    ctx.arc(-2, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    // The pistol, pointing where she aims.
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(8, -2, 14, 4);
    ctx.restore();
  }

  function drawEffects(state) {
    for (const e of state.effects) {
      const a = Math.max(0, e.life / e.max);
      if (e.type === 'muzzle') {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);
        ctx.fillStyle = `rgba(255, 220, 90, ${a})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(26, -6);
        ctx.lineTo(32, 0);
        ctx.lineTo(26, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (e.type === 'spark') {
        ctx.fillStyle = `rgba(255, 200, 80, ${a})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 5 * a + 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'hit') {
        ctx.strokeStyle = `rgba(255, 90, 60, ${a})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 12 * (1 - a) + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.type === 'smoke') {
        ctx.fillStyle = `rgba(120, 120, 120, ${a * 0.5})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 26 * (1 - a) + 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Bullets: short bright streaks.
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function drawPickups(state, v) {
    for (const p of state.pickups) {
      if (p.taken || !inView(v, p.x, p.y, 40)) continue;
      const bobY = Math.sin(p.bob) * 3;
      ctx.save();
      ctx.translate(p.x, p.y + bobY);
      if (p.kind === 'health') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-11, -11, 22, 22);
        ctx.fillStyle = '#e83d3d';
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);
      } else if (p.kind === 'armor') {
        ctx.fillStyle = '#5fa8d9';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(11, -6);
        ctx.lineTo(11, 4);
        ctx.lineTo(0, 12);
        ctx.lineTo(-11, 4);
        ctx.lineTo(-11, -6);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#7dd94f';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1c2733';
        ctx.font = '700 13px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 1);
        ctx.textBaseline = 'alphabetic';
      }
      ctx.restore();
    }
  }

  function drawMissionBeacon(state, v) {
    const objective = currentObjective(state);
    if (objective.x === null) return;
    if (!inView(v, objective.x, objective.y, 300)) {
      // Off-screen: an arrow at the screen edge points the way.
      const cam = state.camera;
      const dx = objective.x - state.player.x;
      const dy = objective.y - state.player.y;
      const angle = Math.atan2(dy, dx);
      const ex = view.w / 2 + Math.cos(angle) * (view.w / 2 - 60);
      const ey = view.h / 2 + Math.sin(angle) * (view.h / 2 - 60);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(angle);
      ctx.fillStyle = '#ffd23d';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    const pulse = 1 + Math.sin(state.time * 4) * 0.12;
    ctx.strokeStyle = 'rgba(255, 210, 61, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(objective.x, objective.y, 46 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 210, 61, 0.16)';
    ctx.beginPath();
    ctx.arc(objective.x, objective.y, 46 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // A column of light so the marker reads from far away.
    const grad = ctx.createLinearGradient(objective.x, objective.y - 260, objective.x, objective.y);
    grad.addColorStop(0, 'rgba(255, 210, 61, 0)');
    grad.addColorStop(1, 'rgba(255, 210, 61, 0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(objective.x - 8, objective.y - 260, 16, 260);
  }

  function drawWorld(state) {
    const cam = state.camera;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#1f5f7d';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.setTransform(view.dpr * cam.zoom, 0, 0, view.dpr * cam.zoom, -cam.x * view.dpr * cam.zoom, -cam.y * view.dpr * cam.zoom);
    const v = visibleRect(state);
    drawGround(state, v);
    drawRoads(state, v);
    drawBuildings(state, v);
    drawPickups(state, v);
    drawMissionBeacon(state, v);
    // People and cars, sorted by y so nearer things draw on top.
    const drawables = [];
    for (const car of state.cars) drawables.push({ y: car.y, kind: 'car', car });
    for (const ped of state.peds) drawables.push({ y: ped.y, kind: 'ped', ped });
    for (const cop of state.police) {
      if (cop.kind === 'foot') drawables.push({ y: cop.y, kind: 'cop', cop });
    }
    for (const enemy of state.enemies) drawables.push({ y: enemy.y, kind: 'enemy', enemy });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      if (!inView(v, d.kind === 'car' ? d.car.x : d.kind === 'ped' ? d.ped.x : d.kind === 'cop' ? d.cop.x : d.enemy.x,
        d.kind === 'car' ? d.car.y : d.kind === 'ped' ? d.ped.y : d.kind === 'cop' ? d.cop.y : d.enemy.y, 80)) continue;
      if (d.kind === 'car') drawCar(d.car, state);
      else if (d.kind === 'ped') drawPed(d.ped, state);
      else if (d.kind === 'cop') {
        ctx.fillStyle = '#1c3a5c';
        ctx.beginPath();
        ctx.arc(d.cop.x, d.cop.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d9e6f2';
        ctx.beginPath();
        ctx.arc(d.cop.x, d.cop.y, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Rival gang member: dark red, with a gun.
        ctx.save();
        ctx.translate(d.enemy.x, d.enemy.y);
        ctx.rotate(d.enemy.angle);
        ctx.fillStyle = '#7a1f1f';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1c2733';
        ctx.fillRect(8, -2, 14, 4);
        ctx.restore();
        // Health bar over the enemy.
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(d.enemy.x - 16, d.enemy.y - 26, 32, 5);
        ctx.fillStyle = '#ff5a3d';
        ctx.fillRect(d.enemy.x - 16, d.enemy.y - 26, 32 * Math.max(0, d.enemy.health / 100), 5);
      }
    }
    drawPlayer(state);
    drawEffects(state);
    // Sunset wash: warm light from the west, fading at the edges.
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const wash = ctx.createLinearGradient(0, 0, view.w, view.h);
    wash.addColorStop(0, 'rgba(255, 170, 80, 0.10)');
    wash.addColorStop(0.6, 'rgba(255, 140, 90, 0.04)');
    wash.addColorStop(1, 'rgba(40, 60, 120, 0.08)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = 640;
    const lineH = 30;
    const h = 150 + lines.length * lineH + 76;
    const x = (view.w - w) / 2;
    const y = (view.h - h) / 2;
    ctx.fillStyle = 'rgba(10, 12, 18, 0.82)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || '#ffd23d';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    text(ctx, title, view.w / 2, y + 64, 44, '#ffd23d', 'center', 800);
    for (let i = 0; i < lines.length; i += 1) {
      text(ctx, lines[i], view.w / 2, y + 116 + i * lineH, 18, '#f2f0e8', 'center', 500);
    }
    text(ctx, prompt, view.w / 2, y + h - 34, 20, '#7dd94f', 'center', 700);
  }

  function drawTitle(state, save) {
    drawWorld(state);
    ctx.fillStyle = 'rgba(10, 12, 18, 0.45)';
    ctx.fillRect(0, 0, view.w, view.h);
    const cx = view.w / 2;
    text(ctx, 'SUNSET BAY', cx, view.h * 0.24, 84, '#ffd23d', 'center', 800);
    text(ctx, 'an open-world crime story', cx, view.h * 0.24 + 44, 24, '#ffffff', 'center', 500);
    const lines = [
      'Mara Voss is new in Sunset Bay — broke, fast behind a wheel,',
      'and on fixer Dana Kline\'s payroll. Five jobs. One crew to beat.',
      '',
      'WASD / Arrows — move & drive      Mouse — aim      Click — shoot',
      'E — steal a car / talk / pick up      Shift — sprint      Space — handbrake',
      'P — pause      M — mute      Your progress saves automatically.',
    ];
    const w = 680;
    const h = 60 + lines.length * 30 + 90;
    const x = (view.w - w) / 2;
    const y = view.h * 0.33;
    ctx.fillStyle = 'rgba(10, 12, 18, 0.72)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255, 210, 61, 0.6)';
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    for (let i = 0; i < lines.length; i += 1) {
      text(ctx, lines[i], cx, y + 44 + i * 30, 18, i < 2 ? '#f2f0e8' : '#c9c4b4', 'center', 500);
    }
    // Start / Continue buttons (mouse-clickable; main.js reads their rects).
    const bw = 260;
    const bh = 54;
    const by = y + h + 18;
    const startX = save ? cx - bw - 12 : cx - bw / 2;
    ctx.fillStyle = '#ffd23d';
    ctx.fillRect(startX, by, bw, bh);
    text(ctx, save ? 'CONTINUE' : 'START GAME', startX + bw / 2, by + 36, 22, '#1c2733', 'center', 800);
    if (save) {
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(cx + 12, by, bw, bh);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(cx + 12, by, bw, bh);
      text(ctx, 'NEW GAME', cx + 12 + bw / 2, by + 36, 22, '#ffffff', 'center', 800);
      text(ctx, `Saved: $${(save.cash || 0).toLocaleString('en-US')} · Job ${(save.missionIndex || 0) + 1} of 5`, cx, by + bh + 26, 15, 'rgba(255,255,255,0.8)', 'center', 500);
    }
    text(ctx, 'Press Enter to start', cx, by + bh + (save ? 50 : 24), 16, 'rgba(255,255,255,0.75)', 'center', 500);
    state.titleButtons = {
      start: { x: startX, y: by, w: bw, h: bh },
      newGame: save ? { x: cx + 12, y: by, w: bw, h: bh } : null,
    };
  }

  /** Paint one frame for the screen the game is on. */
  function draw(state, screen, save) {
    if (screen === SCREEN_TITLE) {
      drawTitle(state, save);
      return;
    }
    drawWorld(state);
    if (screen === SCREEN_PLAY) {
      drawHud(ctx, state, view);
      return;
    }
    // Dim the world behind the overlays.
    ctx.fillStyle = 'rgba(10, 12, 18, 0.55)';
    ctx.fillRect(0, 0, view.w, view.h);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.', 'Progress saves when you finish a job.'], 'Press P or Enter to keep playing');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Mara is down. The bay does not forgive.', `You kept $${state.player.cash.toLocaleString('en-US')}.`], 'Press Enter to wake up at St. Marina Hospital');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Bay City police caught up with you.', `Bail cost you $${Math.min(200, state.player.cash).toLocaleString('en-US')}.`], 'Press Enter to walk out of the precinct');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('SUNSET BAY IS YOURS', ['All five jobs done. Vex is finished.', 'Free roam: steal cars, dodge the law, enjoy the sunset.'], 'Press Enter to keep playing');
    }
  }

  return { draw, view };
}
