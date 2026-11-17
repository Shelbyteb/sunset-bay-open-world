// Sunset Bay — the story: five jobs for Dana Kline, the fixer who runs the bay
// from a second-floor office above the marina. Mara Voss is new in town, broke,
// and good behind a wheel. Each job pays cash and opens the next one.
// All names, places and people are original.
import { MISSION_PAY } from './config.js';
import { addWanted, clearWanted } from './police.js';
import { spawnEnemy } from './combat.js';
import { spawnParkedCar } from './traffic.js';

export const MISSION_DEFS = [
  {
    name: 'Job 1 — The First Errand',
    briefing: 'Dana needs a package moved from the docks to the safehouse. No questions, no cops.',
    steps: [
      { kind: 'goto', place: 'docks', label: 'Pick up the package at the Sunset Docks' },
      { kind: 'pickup', place: 'docks', label: 'Press E to grab the package' },
      { kind: 'goto', place: 'safehouse', label: 'Deliver the package to the Safehouse' },
    ],
  },
  {
    name: 'Job 2 — Getaway Driver',
    briefing: 'Rico is waiting at the safehouse with a bag of cash and the cops on his tail. Get him to the garage.',
    steps: [
      { kind: 'goto', place: 'safehouse', label: 'Pick up Rico at the Safehouse' },
      { kind: 'pickup', place: 'safehouse', label: 'Press E — Rico gets in' },
      { kind: 'deliver', place: 'garage', label: 'Drive Rico to Bayview Garage — the law is coming' },
    ],
  },
  {
    name: 'Job 3 — The Shakedown',
    briefing: 'The Coral Mart crew owes Dana three weeks of protection money. Collect it. They will argue.',
    steps: [
      { kind: 'goto', place: 'shop', label: 'Go to Coral Mart' },
      { kind: 'combat', place: 'shop', label: 'Deal with the Mart crew', count: 3 },
      { kind: 'pickup', place: 'shop', label: 'Press E to take the protection money' },
    ],
  },
  {
    name: 'Job 4 — The Harbor Heist',
    briefing: 'A coral-red coupe is sitting in the docks lot. It belongs to a collector who will never miss it. Take it to the garage.',
    steps: [
      { kind: 'goto', place: 'docks', label: 'Find the coral coupe at the Docks' },
      { kind: 'steal', place: 'docks', label: 'Steal the coral coupe (E to get in)' },
      { kind: 'deliver', place: 'garage', label: 'Deliver the coupe to Bayview Garage' },
    ],
  },
  {
    name: 'Job 5 — Sunset Showdown',
    briefing: 'Vex and his crew are waiting on the pier to end this. Finish it, then get back to Dana alive.',
    steps: [
      { kind: 'goto', place: 'pierEnd', label: 'Go to the end of Sunset Pier' },
      { kind: 'combat', place: 'pierEnd', label: 'Take down Vex and his crew', count: 5 },
      { kind: 'deliver', place: 'danaOffice', label: 'Escape the heat — get back to Dana' },
    ],
  },
];

/** The objective the HUD shows right now: title, line and the map marker. */
export function currentObjective(state) {
  const m = state.mission;
  const places = state.city.places;
  if (m.done) {
    return { title: 'Sunset Bay — Story Complete', text: 'You own this town now. Free roam: steal cars, dodge the law.', x: null, y: null };
  }
  if (!m.active) {
    const office = places.danaOffice;
    return { title: 'Next Job', text: `Go see Dana Kline at her office (${m.index + 1} of 5 jobs left)`, x: office.x, y: office.y };
  }
  const def = MISSION_DEFS[m.index];
  const step = def.steps[m.step];
  const place = places[step.place];
  return { title: def.name, text: step.label, x: place.x, y: place.y };
}

/** Begin the next job: brief the player and set up its first step. */
export function startMission(state, index) {
  const def = MISSION_DEFS[index];
  state.mission = { index, step: 0, active: true, done: false, spawned: false, targetCar: null, pickupDone: false };
  state.events.push({ type: 'missionStart', name: def.name, briefing: def.briefing });
  state.messages.push({ text: def.name, sub: def.briefing, life: 5 });
}

function placeOf(state, step) {
  return state.city.places[step.place];
}

function distTo(state, x, y) {
  return Math.hypot(state.player.x - x, state.player.y - y);
}

/** Set up a step that needs the world prepared (enemies, the marked car, the heat). */
function enterStep(state) {
  const def = MISSION_DEFS[state.mission.index];
  const step = def.steps[state.mission.step];
  const place = placeOf(state, step);
  if (step.kind === 'combat' && !state.mission.spawned) {
    state.mission.spawned = true;
    for (let i = 0; i < step.count; i += 1) {
      const a = (i / step.count) * Math.PI * 2;
      spawnEnemy(state, place.x + Math.cos(a) * 130, place.y + Math.sin(a) * 130);
    }
    state.messages.push({ text: 'Ambush!', sub: `${step.count} of Vex's crew are here.`, life: 4 });
  }
  if (step.kind === 'steal' && !state.mission.targetCar) {
    const car = spawnParkedCar(state.random, state.city);
    car.x = place.x + 60;
    car.y = place.y + 40;
    car.angle = Math.PI / 2;
    car.color = '#e85d3d';
    car.parked = true;
    state.cars.push(car);
    state.mission.targetCar = car;
    state.messages.push({ text: 'The coral coupe', sub: 'That is the one. Take it.', life: 4 });
  }
  if (step.kind === 'deliver' && state.mission.index === 1 && state.mission.step === 2) {
    addWanted(state, 2, 'getaway');
    state.messages.push({ text: 'The cops are on you!', sub: 'Lose them or outrun them to the garage.', life: 4 });
  }
  if (step.kind === 'deliver' && state.mission.index === 4 && state.mission.step === 2) {
    addWanted(state, 4, 'showdown');
    state.messages.push({ text: 'Every cop in the bay is coming.', sub: 'Get to Dana. Fast.', life: 4 });
  }
}

/** Advance the current step when its condition is met. */
function advanceStep(state) {
  const m = state.mission;
  const def = MISSION_DEFS[m.index];
  m.step += 1;
  m.spawned = false;
  m.pickupDone = false;
  if (m.step >= def.steps.length) {
    finishMission(state);
  } else {
    enterStep(state);
  }
}

/** Pay out the job, clear the heat on the getaway jobs, and open the next one. */
function finishMission(state) {
  const m = state.mission;
  const pay = MISSION_PAY[m.index];
  state.player.cash += pay;
  state.events.push({ type: 'missionDone', name: MISSION_DEFS[m.index].name, pay });
  state.messages.push({ text: `Job complete — $${pay}`, sub: m.index + 1 < MISSION_DEFS.length ? 'See Dana for the next job.' : 'That is the whole story. Sunset Bay is yours.', life: 6 });
  state.events.push({ type: 'save' });
  if (m.index === 1 || m.index === 4) clearWanted(state);
  if (m.index + 1 >= MISSION_DEFS.length) {
    state.mission = { index: m.index, step: 0, active: false, done: true, spawned: false, targetCar: null, pickupDone: false };
  } else {
    state.mission = { index: m.index + 1, step: 0, active: false, done: false, spawned: false, targetCar: null, pickupDone: false };
  }
}

/** One step of the story: check the current step's condition. */
export function stepMissions(state) {
  const m = state.mission;
  if (m.done || !m.active) return;
  const def = MISSION_DEFS[m.index];
  const step = def.steps[m.step];
  const place = placeOf(state, step);
  if (step.kind === 'goto' || step.kind === 'deliver') {
    if (distTo(state, place.x, place.y) < 110) advanceStep(state);
  } else if (step.kind === 'combat') {
    if (state.enemies.length === 0) advanceStep(state);
  } else if (step.kind === 'steal') {
    if (state.player.inCar === m.targetCar) advanceStep(state);
  }
  // 'pickup' steps wait for the player to press E (see missionInteract).
}

/** The E key: talk to Dana, pick up a package, collect the cash. */
export function missionInteract(state) {
  const m = state.mission;
  const player = state.player;
  if (m.done) return false;
  if (!m.active) {
    const office = state.city.places.danaOffice;
    if (distTo(state, office.x, office.y) < 130) {
      startMission(state, m.index);
      return true;
    }
    return false;
  }
  const def = MISSION_DEFS[m.index];
  const step = def.steps[m.step];
  if (step.kind !== 'pickup') return false;
  const place = placeOf(state, step);
  if (distTo(state, place.x, place.y) < 120) {
    if (m.index === 1) {
      state.messages.push({ text: 'Rico is in.', sub: 'Drive. Do not stop for anyone.', life: 4 });
    }
    advanceStep(state);
    return true;
  }
  return false;
}

/** Is this the coral coupe the heist job is after? */
export function isMissionTarget(state, car) {
  return state.mission.targetCar === car;
}
