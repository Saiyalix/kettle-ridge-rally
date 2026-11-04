/* =====================================================================
   Headless export for testing; the browser boots the game below.
   ===================================================================== */
if (typeof window === 'undefined') {
  globalThis.__RALLY = { CONFIG, buildTrack, buildTerrain, makeWorld, Car, collideCar, cliffBarriers };
} else {
  window.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();
}

function boot() {
  if (boot.done) return; boot.done = true;
  // Current stage. loadStage() swaps all of these.
  let ST = STAGES[0], half = ST.roadHalfWidth, track = null, terrain = null, world = null, P = null;
  let stageIdx = -1, stageGroup = null, obstacles = [], obsHash = new Map(), loading = false;
  const OH = 8;
  const mmBase = document.createElement('canvas'); mmBase.width = mmBase.height = 340;
  let mmX = () => 170, mmY = () => 170;

