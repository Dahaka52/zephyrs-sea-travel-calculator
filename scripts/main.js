// Zephyr's Sea Travel Calculator - Main Module File

Hooks.once('init', async function() {
  console.log("Zephyr's Sea Travel Calculator | Initializing module");

  try {
    if (typeof SeaTravelCalculator !== "undefined" && typeof SeaTravelCalculator.registerSettings === "function") {
      SeaTravelCalculator.registerSettings();
    } else {
      console.error("SeaTravelCalculator is not available during init.");
    }
  } catch (e) {
    console.error("Zephyr: failed to register settings during init", e);
  }
});

Hooks.once('ready', async function() {
  console.log("Zephyr's Sea Travel Calculator | Module ready");

  // Expose API via module and game
  if (typeof SeaTravelCalculator !== 'undefined') {
    const api = SeaTravelCalculator;
    const moduleObj = game.modules.get(ZEPHYR_MODULE_ID);
    if (moduleObj) moduleObj.api = api;
    window.SeaTravelCalculator = api;
    game.seaTravelCalculator = api;
  } else {
    console.error("SeaTravelCalculator is not defined. Check script loading order.");
  }

  // Create macro (helpers.js contains canonical implementation)
  try {
    await createTravelMacro();
  } catch (e) {
    console.warn("Zephyr: createTravelMacro failed:", e);
  }

  // Inject CSS is handled by styles/styles.css loaded from module.json, no inline injection needed.
});
