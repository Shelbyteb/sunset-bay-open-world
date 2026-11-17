// Sunset Bay — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, wasted, busted, story complete.
//
// ?seed=N fixes the city. ?shot=chase|street|steal|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createWorld, EVENT_BUSTED, EVENT_WASTED, loadGame, saveGame, stepWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createWorld(seed);
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();
state.view = renderer.view;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Screen readers (and anyone watching the page's text) hear the screen changes. */
function announce(message) {
  status.textContent = message;
}

/** React to the world's recent events with sound and saves. */
function handleRecentEvents() {
  for (const e of state.recentEvents || []) {
    if (e.type === 'shot') audio.shot();
    else if (e.type === 'enemyFired') audio.enemyShot();
    else if (e.type === 'playerHit') audio.hit();
    else if (e.type === 'crash' || e.type === 'rammed') audio.crash();
    else if (e.type === 'pickup') audio.pickup();
    else if (e.type === 'missionDone') {
      audio.cash();
      audio.jingle();
      state.stats.jobsDone += 1;
      saveGame(state);
    } else if (e.type === 'missionStart') audio.jingle();
    else if (e.type === 'save') saveGame(state);
    else if (e.type === 'wanted') announce(`Wanted level ${e.stars}.`);
  }
  state.recentEvents = [];
}

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let shownComplete = false;

  function startGame(fresh) {
    audio.ensure();
    if (fresh) {
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* no storage */ }
      const keepSeed = state.seed;
      const freshState = createWorld(keepSeed);
      Object.keys(state).forEach((k) => { state[k] = freshState[k]; });
      state.view = renderer.view;
      save = null;
    } else {
      loadGame(state);
      save = readSave();
    }
    state.camera.x = state.player.x - renderer.view.w / 2;
    state.camera.y = state.player.y - renderer.view.h / 2;
    screen = SCREEN_PLAY;
    announce('Playing Sunset Bay. Go see Dana for your first job.');
  }

  function respawn(placeName, fine) {
    const place = state.city.places[placeName];
    const player = state.player;
    if (player.inCar) {
      player.inCar.driver = null;
      player.inCar = null;
    }
    player.x = place.x;
    player.y = place.y;
    player.health = 100;
    player.armor = 0;
    player.cash = Math.max(0, player.cash - fine);
    player.invulnerable = 2;
    state.wanted = 0;
    state.police = [];
    state.enemies = [];
    state.camera.x = player.x - renderer.view.w / 2;
    state.camera.y = player.y - renderer.view.h / 2;
    saveGame(state);
    screen = SCREEN_PLAY;
  }

  function handleTitleInput(actions) {
    const clicked = input.takeClick();
    const buttons = state.titleButtons;
    if (actions & ACTION_CONFIRM) {
      startGame(false);
      return;
    }
    if (clicked && buttons) {
      const mx = input.mouse.x;
      const my = input.mouse.y;
      const b = buttons.start;
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        startGame(false);
        return;
      }
      const n = buttons.newGame;
      if (n && mx >= n.x && mx <= n.x + n.w && my >= n.y && my <= n.y + n.h) startGame(true);
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      handleTitleInput(actions);
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        state.pendingActions = 0;
        saveGame(state);
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) {
        audio.ensure();
        respawn('hospital', 200);
        announce('Woke up at St. Marina Hospital.');
      }
    } else if (screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) {
        audio.ensure();
        respawn('policeStation', 200);
        announce('Walked out of the Bay Precinct.');
      }
    } else if (screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Free roam. Sunset Bay is yours.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Attract mode: the city lives behind the title.
      const idle = {
        move: () => ({ x: 0, y: 0 }),
        sprint: () => false,
        handbrake: () => false,
        mouse: { x: 0, y: 0, down: false, clicked: false },
        takeActions: () => 0,
        takeClick: () => false,
      };
      stepWorld(state, idle, STEP, 0);
      state.recentEvents = [];
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const actions = state.pendingActions || 0;
    state.pendingActions = 0;
    const events = stepWorld(state, input, STEP, actions);
    handleRecentEvents();
    // Engine and siren follow the driving and the heat.
    const player = state.player;
    audio.engine(player.inCar ? Math.abs(player.speed) / 560 : 0, !!player.inCar);
    audio.update(STEP, state.wanted);
    if (events & EVENT_WASTED) {
      screen = SCREEN_WASTED;
      audio.busted();
      announce('Wasted.');
    } else if (events & EVENT_BUSTED) {
      screen = SCREEN_BUSTED;
      audio.busted();
      announce('Busted.');
    } else if (state.mission.done && !shownComplete) {
      shownComplete = true;
      screen = SCREEN_COMPLETE;
      audio.jingle();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    state.mouseX = input.mouse.x;
    state.mouseY = input.mouse.y;
    const actions = input.takeActions();
    // Pause and mute are handled here; the rest rides into the world step.
    if (screen === SCREEN_PLAY) state.pendingActions = (state.pendingActions || 0) | actions;
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state, screen, screen === SCREEN_TITLE ? save : null);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(state);
      announce('Paused.');
    }
  });
  // The first click or keypress unlocks the audio.
  window.addEventListener('pointerdown', () => audio.ensure(), { once: true });
  window.addEventListener('keydown', () => audio.ensure(), { once: true });

  announce('Sunset Bay. Press Enter or click Start to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
