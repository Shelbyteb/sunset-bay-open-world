// Sunset Bay — a tiny seeded random number generator so the city, the traffic and
// the staged screenshot scenes are the same every time a seed is given.
export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    // Mulberry32: small, fast, and good enough for a game world.
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function range(min, max) {
    return min + next() * (max - min);
  }
  function int(min, max) {
    return Math.floor(range(min, max + 1));
  }
  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }
  function chance(p) {
    return next() < p;
  }
  return { next, range, int, pick, chance };
}
