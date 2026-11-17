// Sunset Bay — shared constants for the whole game.
// The world is one big coastal city, drawn top-down in world units (pixels at zoom 1).
export const WORLD_W = 5200;
export const WORLD_H = 3800;

// Fixed 1/60 s simulation step, like the frame loop in main.js.
export const STEP = 1 / 60;

// Where the sand starts and where the water starts, on the south edge.
export const BEACH_Y = 3300;
export const WATER_Y = 3560;

// The pier juts south from the beach into the bay.
export const PIER = { x: 2380, y: BEACH_Y, w: 120, h: 330, endY: 3630 };

// Player tuning.
export const PLAYER = {
  radius: 14,
  walkSpeed: 215,
  sprintSpeed: 330,
  healthMax: 100,
  armorMax: 100,
};

// Car tuning (traffic, police and the player's stolen rides share this shape).
export const CAR = {
  length: 66,
  width: 32,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  grip: 2.6,
  policeMaxSpeed: 640,
};

// Wanted stars: 0 is clean, 5 is a full-city manhunt.
export const WANTED_MAX = 5;

// Cash rewards for the five story jobs, in order.
export const MISSION_PAY = [400, 900, 1500, 2600, 5000];

// Save slot in localStorage.
export const SAVE_KEY = 'sunset-bay-save-v1';

// Sunset palette: warm sand, teal bay water, hot roads, pastel roofs.
export const PALETTE = {
  grass: '#7fae62',
  grassDry: '#a8b060',
  sand: '#e8cf9a',
  water: '#2e7f9e',
  waterDeep: '#1f5f7d',
  road: '#3c3a3e',
  roadEdge: '#2a282c',
  sidewalk: '#b9b2a4',
  lane: '#e8d44d',
  buildingRoof: ['#c96f4a', '#d9a05b', '#7d9bb5', '#b56a7e', '#8fae7d', '#c9b458', '#9a7fb5'],
  towerGlass: '#5f8fb0',
  palm: '#3f7a3a',
  pierWood: '#8a6b4a',
};
