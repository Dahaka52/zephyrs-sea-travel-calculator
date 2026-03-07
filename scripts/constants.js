// Zephyr global constants (units documented)
var ZEPHYR_MODULE_ID = "zephyrs-sea-travel-calculator";

// Crew weight: average kg per person
var ZEPHYR_AVG_CREW_WEIGHT_KG = 65;

// Base turn factor (kept for legacy compatibility)
var ZEPHYR_BASE_TURN_FACTOR = 1;

// Default draft change per tonne (meters / tonne)
var ZEPHYR_DRAFT_PER_TON = 0.015; // fallback if ship doesn't provide

// Conversion constants
// 1 knot = 1 nautical mile per hour
// 1 nautical mile = 6076.12 feet
// 1 round = 6 seconds -> fraction of hour = 6 / 3600
var ZEPHYR_FT_PER_KNOT_PER_ROUND = 6076.12 * (6 / 3600); // ≈ 10.1268667

// Minimum maneuverability to avoid division by zero / extreme radii
var ZEPHYR_MIN_MANEUVERABILITY = 0.05;
