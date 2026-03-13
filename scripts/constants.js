// Zephyr global constants (units documented)
var ZEPHYR_MODULE_ID = "zephyrs-sea-travel-calculator";

// Default UI language
var ZEPHYR_LANG_DEFAULT = "ru";

// Lightweight i18n dictionary for UI strings (expand as needed)
var ZEPHYR_I18N = {
  ru: {
    CALC_TITLE: "🧭 Калькулятор морского перехода",
    SECTION_SHIP: "⚙️ Параметры корабля",
    SECTION_NAV: "🧭 Навигация и Погода",
    LABEL_SHIP: "Корабль:",
    LABEL_CREW_TYPE: "Тип экипажа:",
    LABEL_CREW_COUNT: "Экипаж (чел):",
    LABEL_BONUS_SAILS: "Доп. паруса:",
    LABEL_CARGO: "Груз:",
    LABEL_MODE: "Режим расчёта:",
    MODE_DISTANCE: "По расстоянию",
    MODE_TIME: "По времени",
    LABEL_DISTANCE: "Дистанция:",
    LABEL_TIME_HOURS: "Время (часов):",
    UNIT_KM: "км",
    UNIT_NMI: "миль",
    UNIT_METER: "м",
    UNIT_SPEED: "уз.",
    UNIT_FT_ROUND: "фт/раунд",
    UNIT_FT: "фт",
    UNIT_DAYS: "д",
    UNIT_HOURS: "ч",
    UNIT_MINUTES: "м",
    UNIT_HOURS_SHORT: "ч.",
    UNIT_TONS: "т",
    UNIT_PEOPLE: "чел",
    COMPASS_HINT: "Внешний круг: Ветер. Внутренний: Движение.",
    COURSE_TO_WIND: "Курс к ветру:",
    HELM_LABEL: "Корабельный штурвал (+5 узлов)",
    OARS_LABEL: "Вёсла",
    OARS_HINT: "до {max} уз., требуется {crew} гребцов",
    OARS_HINT_PARTIAL: "При меньшем числе гребцов бонус уменьшается",
    SECTION_WIND_WAVES: "Ветер и волны",
    BUTTON_CALC_SEND: "Рассчитать и отправить в чат",
    RESULT_CARGO_CREW: "Загрузка / Экипаж",
    RESULT_MANEUVER: "Манёвренность",
    RESULT_DISTANCE_TIME: "Пройдено / Затрачено",
    RESULT_SPEED: "Скорость",
    NOTIFY_SENT: "Результаты отправлены в чат!",
    ERROR_PREFIX: "Ошибка:",
    SHIP_NOT_FOUND: "Ошибка: корабль не найден",
    SHIP_STATS: "Характеристики:",
    SHIP_LENGTH: "Длина",
    SHIP_BEAM: "Ширина",
    SHIP_DRAFT: "Осадка",
    SHIP_DRAFT_EMPTY: "порожняя",
    SHIP_DRAFT_FULL: "полная",
    SHIP_DISPLACEMENT: "Водоизмещение",
    SHIP_LOAD: "Загруженность",
    SHIP_CREW: "Экипаж",
    SHIP_OPTIMAL: "оптимальный",
    SHIP_FEATURES: "Особенности",
    SHIP_ARMAMENT: "Вооружение",
    SHIP_OARS: "Весла",
    SHIP_OARS_INFO: "до {max} узлов в штиль (требуется {crew} гребцов)",
    CHAT_TITLE: "🧭 Отчёт о морском переходе",
    CHAT_SHIP: "Корабль",
    CHAT_SPEED: "Скорость",
    CHAT_TURN_RADIUS: "Радиус разворота",
    CHAT_CARGO: "Загрузка",
    CHAT_MODE: "Режим",
    CHAT_CONDITIONS: "Условия",
    CHAT_DISTANCE: "Дистанция",
    CHAT_TIME: "Время в пути",
    CHAT_TRAVELED: "Пройдено",
    CHAT_HELM: "Штурвал",
    CHAT_MODE_DISTANCE: "По дистанции",
    CHAT_MODE_TIME: "По времени",
    CHAT_HELM_YES: "✅ Да",
    CHAT_HELM_NO: "❌ Нет",
    WIND_CALM: "Штиль",
    WIND_CALM_SUB: "<5 уз.",
    WIND_WEAK: "Бриз",
    WIND_WEAK_SUB: "5-10 уз.",
    WIND_NORMAL: "Свежий",
    WIND_NORMAL_SUB: "10-20 уз.",
    WIND_STRONG: "Крепкий",
    WIND_STRONG_SUB: "20-40 уз.",
    WIND_STORM: "Шторм",
    WIND_STORM_SUB: ">40 уз.",
    WAVE_CALM: "Штиль",
    WAVE_CALM_SUB: "0-0.5 м",
    WAVE_RIPPLE: "Рябь",
    WAVE_RIPPLE_SUB: "0.5-1 м",
    WAVE_WAVE: "Волнение",
    WAVE_WAVE_SUB: "1-2 м",
    WAVE_STWAVE: "Шторм",
    WAVE_STWAVE_SUB: "2-4 м",
    WAVE_STORM: "Ураган",
    WAVE_STORM_SUB: "4-8+ м",
    WAVES_LABEL: "Волны",
    WEATHER_TITLE: "Генератор морской погоды",
    WEATHER_ZONE: "Климатический пояс:",
    WEATHER_SEASON: "Сезон:",
    WEATHER_HOUR: "Текущий час:",
    WEATHER_GM_ONLY: "Выводить только ГМ",
    WEATHER_GENERATE: "Сгенерировать",
    WEATHER_HEADER: "🌤️ Погода",
    WEATHER_WIND_DIR: "Направление ветра",
    WEATHER_CONDITIONS: "Условия",
    WEATHER_WIND_WAVES: "Ветер и волны",
    WEATHER_DURATION: "Длительность",
    WEATHER_NEXT: "Следующая смена погоды"
  },
  en: {
    CALC_TITLE: "🧭 Sea Travel Calculator",
    SECTION_SHIP: "⚙️ Ship Parameters",
    SECTION_NAV: "🧭 Navigation & Weather",
    LABEL_SHIP: "Ship:",
    LABEL_CREW_TYPE: "Crew type:",
    LABEL_CREW_COUNT: "Crew (people):",
    LABEL_BONUS_SAILS: "Bonus sails:",
    LABEL_CARGO: "Cargo:",
    LABEL_MODE: "Calculation mode:",
    MODE_DISTANCE: "By distance",
    MODE_TIME: "By time",
    LABEL_DISTANCE: "Distance:",
    LABEL_TIME_HOURS: "Time (hours):",
    UNIT_KM: "km",
    UNIT_NMI: "nmi",
    UNIT_METER: "m",
    UNIT_SPEED: "kn",
    UNIT_FT_ROUND: "ft/round",
    UNIT_FT: "ft",
    UNIT_DAYS: "d",
    UNIT_HOURS: "h",
    UNIT_MINUTES: "m",
    UNIT_HOURS_SHORT: "h",
    UNIT_TONS: "t",
    UNIT_PEOPLE: "people",
    COMPASS_HINT: "Outer ring: Wind. Inner: Heading.",
    COURSE_TO_WIND: "Course to wind:",
    HELM_LABEL: "Ship's helm (+5 knots)",
    OARS_LABEL: "Oars",
    OARS_HINT: "up to {max} kn, requires {crew} rowers",
    OARS_HINT_PARTIAL: "With fewer rowers the bonus is reduced",
    SECTION_WIND_WAVES: "Wind & waves",
    BUTTON_CALC_SEND: "Calculate and send to chat",
    RESULT_CARGO_CREW: "Cargo / Crew",
    RESULT_MANEUVER: "Maneuverability",
    RESULT_DISTANCE_TIME: "Traveled / Time",
    RESULT_SPEED: "Speed",
    NOTIFY_SENT: "Results sent to chat!",
    ERROR_PREFIX: "Error:",
    SHIP_NOT_FOUND: "Error: ship not found",
    SHIP_STATS: "Specs:",
    SHIP_LENGTH: "Length",
    SHIP_BEAM: "Beam",
    SHIP_DRAFT: "Draft",
    SHIP_DRAFT_EMPTY: "empty",
    SHIP_DRAFT_FULL: "full",
    SHIP_DISPLACEMENT: "Displacement",
    SHIP_LOAD: "Load",
    SHIP_CREW: "Crew",
    SHIP_OPTIMAL: "optimal",
    SHIP_FEATURES: "Features",
    SHIP_ARMAMENT: "Armament",
    SHIP_OARS: "Oars",
    SHIP_OARS_INFO: "up to {max} kn in calm (requires {crew} rowers)",
    CHAT_TITLE: "🧭 Sea Travel Report",
    CHAT_SHIP: "Ship",
    CHAT_SPEED: "Speed",
    CHAT_TURN_RADIUS: "Turning radius",
    CHAT_CARGO: "Load",
    CHAT_MODE: "Mode",
    CHAT_CONDITIONS: "Conditions",
    CHAT_DISTANCE: "Distance",
    CHAT_TIME: "Travel time",
    CHAT_TRAVELED: "Traveled",
    CHAT_HELM: "Helm",
    CHAT_MODE_DISTANCE: "By distance",
    CHAT_MODE_TIME: "By time",
    CHAT_HELM_YES: "✅ Yes",
    CHAT_HELM_NO: "❌ No",
    WIND_CALM: "Calm",
    WIND_CALM_SUB: "<5 kn",
    WIND_WEAK: "Breeze",
    WIND_WEAK_SUB: "5-10 kn",
    WIND_NORMAL: "Fresh",
    WIND_NORMAL_SUB: "10-20 kn",
    WIND_STRONG: "Strong",
    WIND_STRONG_SUB: "20-40 kn",
    WIND_STORM: "Storm",
    WIND_STORM_SUB: ">40 kn",
    WAVE_CALM: "Calm",
    WAVE_CALM_SUB: "0-0.5 m",
    WAVE_RIPPLE: "Ripples",
    WAVE_RIPPLE_SUB: "0.5-1 m",
    WAVE_WAVE: "Seas",
    WAVE_WAVE_SUB: "1-2 m",
    WAVE_STWAVE: "Rough",
    WAVE_STWAVE_SUB: "2-4 m",
    WAVE_STORM: "Hurricane",
    WAVE_STORM_SUB: "4-8+ m",
    WAVES_LABEL: "Waves",
    WEATHER_TITLE: "Sea Weather Generator",
    WEATHER_ZONE: "Climate zone:",
    WEATHER_SEASON: "Season:",
    WEATHER_HOUR: "Current hour:",
    WEATHER_GM_ONLY: "Whisper to GM only",
    WEATHER_GENERATE: "Generate",
    WEATHER_HEADER: "🌤️ Weather",
    WEATHER_WIND_DIR: "Wind direction",
    WEATHER_CONDITIONS: "Conditions",
    WEATHER_WIND_WAVES: "Wind and waves",
    WEATHER_DURATION: "Duration",
    WEATHER_NEXT: "Next weather change"
  }
};

function zephyrGetLanguage() {
  try {
    if (typeof game !== "undefined" && game.settings?.settings?.has(`${ZEPHYR_MODULE_ID}.uiLanguage`)) {
      return game.settings.get(ZEPHYR_MODULE_ID, "uiLanguage") || ZEPHYR_LANG_DEFAULT;
    }
  } catch (e) {
    // ignore
  }
  return ZEPHYR_LANG_DEFAULT;
}

function zephyrT(key, vars) {
  const lang = zephyrGetLanguage();
  const dict = ZEPHYR_I18N?.[lang] || ZEPHYR_I18N?.[ZEPHYR_LANG_DEFAULT] || {};
  let str = dict[key] || (ZEPHYR_I18N?.[ZEPHYR_LANG_DEFAULT]?.[key]) || key;
  if (vars && typeof str === "string") {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    });
  }
  return str;
}

function zephyrLabel(obj, key = "label", fallback = "") {
  if (!obj) return fallback;
  const lang = zephyrGetLanguage();
  if (lang === "en" && obj[`${key}_en`]) return obj[`${key}_en`];
  return obj[key] ?? fallback;
}

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
