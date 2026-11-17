// Sunset Bay — the HUD: wanted stars, cash, health and armour, the mission
// objective, the minimap, and the floating messages. Drawn in screen space,
// after the world, so it stays readable whatever the camera is doing.
import { BEACH_Y, PALETTE, PIER, WORLD_H, WORLD_W } from './config.js';
import { currentObjective } from './missions.js';
import { WANTED_NAMES } from './police.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MAP_W = 240;
const MAP_H = 176;

function text(ctx, value, x, y, size, color, align, weight) {
  ctx.font = `${weight || 600} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(12, 14, 20, ${alpha ?? 0.62})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

/** The minimap: the whole city shrunk into the corner, with the player, the cops and the job. */
export function drawMinimap(ctx, state, x, y) {
  const sx = MAP_W / WORLD_W;
  const sy = MAP_H / WORLD_H;
  panel(ctx, x - 6, y - 6, MAP_W + 12, MAP_H + 12, 0.9);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, MAP_W, MAP_H);
  ctx.clip();
  // Ground, water and sand.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x, y, MAP_W, MAP_H);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x, y + BEACH_Y * sy, MAP_W, MAP_H - BEACH_Y * sy);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x, y + 3560 * sy, MAP_W, MAP_H - 3560 * sy);
  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const ax of state.city.avenues) ctx.fillRect(x + ax * sx - 2, y, 4, MAP_H);
  for (const sy2 of state.city.streets) ctx.fillRect(x, y + sy2 * sy - 2, MAP_W, 4);
  // The pier.
  ctx.fillStyle = PALETTE.pierWood;
  ctx.fillRect(x + PIER.x * sx, y + PIER.y * sy, PIER.w * sx, (PIER.endY - PIER.y) * sy);
  // Mission marker: a pulsing yellow diamond.
  const objective = currentObjective(state);
  if (objective.x !== null) {
    const pulse = 5 + Math.sin(state.time * 4) * 2;
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.moveTo(x + objective.x * sx, y + objective.y * sy - pulse);
    ctx.lineTo(x + objective.x * sx + pulse, y + objective.y * sy);
    ctx.lineTo(x + objective.x * sx, y + objective.y * sy + pulse);
    ctx.lineTo(x + objective.x * sx - pulse, y + objective.y * sy);
    ctx.closePath();
    ctx.fill();
  }
  // Police blips flash blue.
  const flash = Math.floor(state.time * 3) % 2 === 0;
  for (const unit of state.police) {
    const ux = unit.kind === 'car' ? unit.car.x : unit.x;
    const uy = unit.kind === 'car' ? unit.car.y : unit.y;
    ctx.fillStyle = flash ? '#3d9bff' : '#ff4d4d';
    ctx.beginPath();
    ctx.arc(x + ux * sx, y + uy * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Enemy blips.
  ctx.fillStyle = '#ff5a3d';
  for (const enemy of state.enemies) {
    ctx.beginPath();
    ctx.arc(x + enemy.x * sx, y + enemy.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player: a white arrow pointing where Mara faces.
  const px = x + state.player.x * sx;
  const py = y + state.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North arrow and a frame.
  ctx.restore();
  text(ctx, 'N', x + MAP_W - 8, y + 14, 12, 'rgba(255,255,255,0.8)', 'center');
}

/** The whole HUD for the play screen. `view` is {w, h} in screen pixels. */
export function drawHud(ctx, state, view) {
  const player = state.player;
  const objective = currentObjective(state);

  // Top-left: the current job.
  panel(ctx, 16, 16, 430, 66, 0.9);
  text(ctx, objective.title, 30, 42, 17, '#ffd23d', 'left', 700);
  text(ctx, objective.text, 30, 66, 14, '#f2f0e8', 'left', 500);

  // Top-right: cash and wanted stars.
  const cashText = `$${player.cash.toLocaleString('en-US')}`;
  text(ctx, cashText, view.w - 20, 44, 26, '#7dd94f', 'right', 700);
  const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
  text(ctx, stars, view.w - 20, 76, 24, state.wanted > 0 ? '#ff5a3d' : 'rgba(255,255,255,0.55)', 'right', 700);
  if (state.wanted > 0) {
    text(ctx, WANTED_NAMES[state.wanted], view.w - 20, 100, 13, '#ffb3a3', 'right', 600);
  }

  // Bottom-left: health and armour bars above the minimap.
  const mapX = 16;
  const mapY = view.h - MAP_H - 16;
  panel(ctx, mapX, mapY - 58, MAP_W + 12, 48, 0.9);
  text(ctx, 'HEALTH', mapX + 12, mapY - 36, 11, 'rgba(255,255,255,0.75)', 'left', 700);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(mapX + 78, mapY - 46, 130, 12);
  ctx.fillStyle = player.health > 30 ? '#7dd94f' : '#ff5a3d';
  ctx.fillRect(mapX + 78, mapY - 46, 130 * Math.max(0, player.health / 100), 12);
  text(ctx, 'ARMOUR', mapX + 12, mapY - 18, 11, 'rgba(255,255,255,0.75)', 'left', 700);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(mapX + 78, mapY - 28, 130, 12);
  ctx.fillStyle = '#5fa8d9';
  ctx.fillRect(mapX + 78, mapY - 28, 130 * Math.max(0, player.armor / 100), 12);

  drawMinimap(ctx, state, mapX, mapY);

  // Bottom-right: speed and weapon, and the interact hint.
  if (player.inCar) {
    const kmh = Math.round(Math.abs(player.speed) * 0.36);
    text(ctx, `${kmh}`, view.w - 24, view.h - 30, 40, '#ffffff', 'right', 700);
    text(ctx, 'km/h', view.w - 24, view.h - 8, 12, 'rgba(255,255,255,0.7)', 'right', 600);
    text(ctx, 'E — get out   SPACE — handbrake', view.w - 24, view.h - 84, 13, 'rgba(255,255,255,0.75)', 'right', 500);
  } else {
    text(ctx, 'PISTOL  ∞', view.w - 24, view.h - 30, 20, '#ffffff', 'right', 700);
    text(ctx, 'Click — shoot    E — enter car / talk    Shift — sprint', view.w - 24, view.h - 60, 13, 'rgba(255,255,255,0.75)', 'right', 500);
  }

  // Centre messages: job banners fade in the middle of the screen.
  let my = 120;
  for (const m of state.messages) {
    const alpha = Math.min(1, m.life);
    ctx.globalAlpha = alpha;
    text(ctx, m.text, view.w / 2, my, 30, '#ffd23d', 'center', 700);
    if (m.sub) text(ctx, m.sub, view.w / 2, my + 26, 16, '#ffffff', 'center', 500);
    ctx.globalAlpha = 1;
    my += 64;
  }

  // Crosshair on foot, following the mouse (only once the mouse has a position).
  if (!player.inCar && state.mouseX !== undefined && state.mouseY !== undefined) {
    const mx = state.mouseX;
    const my2 = state.mouseY;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my2, 10, 0, Math.PI * 2);
    ctx.moveTo(mx - 15, my2);
    ctx.lineTo(mx - 6, my2);
    ctx.moveTo(mx + 6, my2);
    ctx.lineTo(mx + 15, my2);
    ctx.moveTo(mx, my2 - 15);
    ctx.lineTo(mx, my2 - 6);
    ctx.moveTo(mx, my2 + 6);
    ctx.lineTo(mx, my2 + 15);
    ctx.stroke();
  }
}
