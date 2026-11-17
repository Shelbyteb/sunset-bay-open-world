// Sunset Bay — the city itself: a grid of avenues and streets, blocks of buildings,
// a beach and a bay along the south edge, and the named places the story uses.
// Everything is generated once from a seed, so the city never changes between visits.
import { BEACH_Y, PALETTE, PIER, WATER_Y, WORLD_H, WORLD_W } from './config.js';

export const ROAD_W = 96;
export const SIDEWALK_W = 26;

// The avenue and street centre lines. Downtown towers cluster near the middle.
export const AVENUES = [420, 1080, 1740, 2400, 3060, 3720, 4380, 4920];
export const STREETS = [360, 940, 1520, 2100, 2680, 3140];

function blockHasRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2 + SIDEWALK_W) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < ROAD_W / 2 + SIDEWALK_W) return true;
  return false;
}

/** True when the point is on a road surface (not sidewalk, not a block). */
export function isOnRoad(city, x, y) {
  for (const ax of city.avenues) if (Math.abs(x - ax) < ROAD_W / 2) return true;
  for (const sy of city.streets) if (Math.abs(y - sy) < ROAD_W / 2) return true;
  return false;
}

/** True when the point is inside any building (used to keep people and cars out). */
export function hitsBuilding(city, x, y, pad) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
  }
  return false;
}

/** A point on a road, for spawning cars and peds. */
export function randomRoadPoint(random, city) {
  if (random.chance(0.5)) {
    const ax = random.pick(city.avenues);
    return { x: ax + random.range(-ROAD_W / 4, ROAD_W / 4), y: random.range(80, BEACH_Y - 120) };
  }
  const sy = random.pick(city.streets);
  return { x: random.range(80, WORLD_W - 80), y: sy + random.range(-ROAD_W / 4, ROAD_W / 4) };
}

/** A sidewalk point beside a road, for spawning pedestrians. */
export function randomSidewalkPoint(random, city) {
  if (random.chance(0.5)) {
    const ax = random.pick(city.avenues);
    const side = random.chance(0.5) ? -1 : 1;
    return { x: ax + side * (ROAD_W / 2 + SIDEWALK_W / 2), y: random.range(80, BEACH_Y - 120) };
  }
  const sy = random.pick(city.streets);
  const side = random.chance(0.5) ? -1 : 1;
  return { x: random.range(80, WORLD_W - 80), y: sy + side * (ROAD_W / 2 + SIDEWALK_W / 2) };
}

export function buildCity(random) {
  const buildings = [];
  const palms = [];
  const parks = [];

  // Fill each block between the roads with one or two buildings, or a park.
  const xs = [60, ...AVENUES.map((a) => a + ROAD_W / 2 + SIDEWALK_W)];
  const ys = [60, ...STREETS.map((s) => s + ROAD_W / 2 + SIDEWALK_W)];
  const xe = [...AVENUES.map((a) => a - ROAD_W / 2 - SIDEWALK_W), WORLD_W - 60];
  const ye = [...STREETS.map((s) => s - ROAD_W / 2 - SIDEWALK_W), BEACH_Y - 40];

  for (let bx = 0; bx < xs.length; bx += 1) {
    for (let by = 0; by < ys.length; by += 1) {
      const x0 = xs[bx];
      const y0 = ys[by];
      const x1 = xe[bx];
      const y1 = ye[by];
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 120 || h < 100) continue;
      // The central blocks are downtown: tall glass towers. The rest are low roofs.
      const downtown = Math.abs(x0 + w / 2 - 2400) < 900 && Math.abs(y0 + h / 2 - 1500) < 800;
      if (random.chance(downtown ? 0.1 : 0.22)) {
        parks.push({ x: x0, y: y0, w, h });
        for (let p = 0; p < Math.floor((w * h) / 26000); p += 1) {
          palms.push({ x: random.range(x0 + 20, x1 - 20), y: random.range(y0 + 20, y1 - 20), r: random.range(7, 11) });
        }
        continue;
      }
      const split = random.chance(0.55) && w > 320;
      const spots = split
        ? [
            { x: x0 + 14, y: y0 + 14, w: w / 2 - 24, h: h - 28 },
            { x: x0 + w / 2 + 10, y: y0 + 14, w: w / 2 - 24, h: h - 28 },
          ]
        : [{ x: x0 + 16, y: y0 + 16, w: w - 32, h: h - 32 }];
      for (const s of spots) {
        const tower = downtown && random.chance(0.7);
        buildings.push({
          x: s.x,
          y: s.y,
          w: s.w,
          h: s.h,
          tower,
          color: tower ? PALETTE.towerGlass : random.pick(PALETTE.buildingRoof),
          roof: random.pick(['flat', 'flat', 'garden', 'pool']),
        });
      }
      // A palm or two on the block's corners.
      if (random.chance(0.6)) palms.push({ x: x0 + 12, y: y0 + 12, r: 8 });
      if (random.chance(0.5)) palms.push({ x: x1 - 12, y: y1 - 12, r: 8 });
    }
  }

  // Palms lining the beachfront promenade.
  for (let x = 140; x < WORLD_W - 100; x += 170) {
    palms.push({ x: x + random.range(-20, 20), y: BEACH_Y - 60, r: 9 });
  }

  // The story's named places, all on real roads so the player can drive to them.
  const places = {
    danaOffice: { name: "Dana's Office", x: 1740, y: 1520, label: 'DANA' },
    docks: { name: 'Sunset Docks', x: 4380, y: 3140, label: 'DOCKS' },
    safehouse: { name: 'Safehouse', x: 1080, y: 940, label: 'SAFEHOUSE' },
    garage: { name: 'Bayview Garage', x: 3060, y: 2680, label: 'GARAGE' },
    shop: { name: 'Coral Mart', x: 3720, y: 2100, label: 'MART' },
    pierEnd: { name: 'Sunset Pier', x: PIER.x + PIER.w / 2, y: PIER.endY - 30, label: 'PIER' },
    hospital: { name: 'St. Marina Hospital', x: 420, y: 940, label: 'HOSPITAL' },
    policeStation: { name: 'Bay Precinct', x: 2400, y: 360, label: 'POLICE' },
    start: { name: 'Marina Apartments', x: 2400, y: 2680, label: 'HOME' },
  };

  return {
    avenues: AVENUES,
    streets: STREETS,
    buildings,
    palms,
    parks,
    places,
    blockHasRoad,
  };
}

// Exported for the renderer and the minimap.
export { BEACH_Y, WATER_Y, WORLD_H, WORLD_W };
