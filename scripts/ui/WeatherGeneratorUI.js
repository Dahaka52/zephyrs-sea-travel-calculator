class WeatherGeneratorUI {
  constructor() {
    this.dialog = null;
  }

  t(key, vars) {
    if (typeof zephyrT === "function") return zephyrT(key, vars);
    return key;
  }

  getLang() {
    if (typeof zephyrGetLanguage === "function") return zephyrGetLanguage();
    return "ru";
  }

  localizedLabel(obj, fallback = "") {
    const lang = this.getLang();
    if (!obj) return fallback;
    if (lang === "en") return obj.label_en ?? obj.label_ru ?? obj.label ?? fallback;
    return obj.label_ru ?? obj.label ?? obj.label_en ?? fallback;
  }

  localizeFromMap(map, key) {
    const lang = this.getLang();
    const entry = map?.[key];
    if (!entry) return key;
    return (lang === "en" ? entry.en : entry.ru) || key;
  }

  render() {
    if (this.dialog) {
      if (typeof this.dialog.bringToTop === "function") this.dialog.bringToTop();
      return;
    }

    const MODULE_ID = ZEPHYR_MODULE_ID;
    const lang = this.getLang();
    const F_HOUR = "weatherNextHour";
    const F_ZONE = "weatherZone";
    const F_SEASON = "weatherSeason";

    const CLIMATE = WeatherGeneratorUI.CLIMATE;
    const zoneKeys = Object.keys(CLIMATE);

    const savedHour = game.user.getFlag(MODULE_ID, F_HOUR) || 12;
    const savedZone = game.user.getFlag(MODULE_ID, F_ZONE) || zoneKeys[0];
    const activeZone = CLIMATE[savedZone] ? savedZone : zoneKeys[0];
    const savedSeason = game.user.getFlag(MODULE_ID, F_SEASON) || CLIMATE[activeZone].seasons[0];
    const activeSeason = CLIMATE[activeZone].seasons.includes(savedSeason)
      ? savedSeason
      : CLIMATE[activeZone].seasons[0];

    const SELECT_STYLE = "width:100%;background:rgba(20, 15, 10, 0.9);color:#e8d5b5;border:1px solid rgba(184, 144, 92, 0.5);";
    const OPTION_STYLE = "background-color:#2a1c14;color:#e8d5b5;";

    const buildZoneOptions = (selected) => zoneKeys
      .map(z => `<option value="${z}"${z === selected ? " selected" : ""} style="${OPTION_STYLE}">${this.localizeFromMap(WeatherGeneratorUI.LOCALIZATION.zones, z)}</option>`)
      .join("");

    const buildSeasonOptions = (zone, selected) => (CLIMATE[zone]?.seasons || [])
      .map(s => {
        const label = this.localizeFromMap(WeatherGeneratorUI.LOCALIZATION.seasons, s);
        return `<option value="${s}"${s === selected ? " selected" : ""} style="${OPTION_STYLE}">${label}</option>`;
      })
      .join("");

    const buildHourOptions = (selected) => Array.from({ length: 24 }, (_, i) => {
      const h = i + 1;
      return `<option value="${h}"${h === selected ? " selected" : ""} style="${OPTION_STYLE}">${WeatherGeneratorUI.fmtHour(h)}</option>`;
    }).join("");

    const content =
      `<div class="zephyr-bg"></div>` +
      `<div class="zephyr-calc-wrap">` +
        `<div class="zephyr-scroll">` +
          `<form class="zephyr-section zephyr-weather-form">` +
            `<div class="zephyr-section__title">${this.t("WEATHER_TITLE")}</div>` +
            `<div class="calc-row">` +
              `<div class="calc-label">${this.t("WEATHER_ZONE")}</div>` +
              `<div class="calc-control">` +
                `<select id="zone" style="${SELECT_STYLE}">${buildZoneOptions(activeZone)}</select>` +
              `</div>` +
            `</div>` +
            `<div class="calc-row">` +
              `<div class="calc-label">${this.t("WEATHER_SEASON")}</div>` +
              `<div class="calc-control">` +
                `<select id="season" style="${SELECT_STYLE}">${buildSeasonOptions(activeZone, activeSeason)}</select>` +
              `</div>` +
            `</div>` +
            `<div class="calc-row">` +
              `<div class="calc-label">${this.t("WEATHER_HOUR")}</div>` +
              `<div class="calc-control">` +
                `<select id="currentHour" style="${SELECT_STYLE}">${buildHourOptions(savedHour)}</select>` +
              `</div>` +
            `</div>` +
            `<div class="calc-row">` +
              `<div class="calc-label"></div>` +
              `<div class="calc-control">` +
                `<label class="zephyr-checkbox-line"><input type="checkbox" id="gmOnly"> ${this.t("WEATHER_GM_ONLY")}</label>` +
              `</div>` +
            `</div>` +
          `</form>` +
        `</div>` +
      `</div>`;

    this.dialog = new Dialog({
      title: this.t("WEATHER_TITLE"),
      content,
      classes: ["zephyr-calculator", "zephyr-weather", "flexcol"],
      render: (html) => {
        const appEl = html.closest(".app, .window-app");
        if (appEl.length) appEl.addClass("zephyr-calculator zephyr-weather");
        html.find("#zone").on("change", () => {
          const zone = html.find("#zone").val();
          const seasons = CLIMATE[zone]?.seasons || [];
          const current = html.find("#season").val();
          const next = seasons.includes(current) ? current : seasons[0];
          html.find("#season").html(buildSeasonOptions(zone, next));
        });
      },
      buttons: {
        ok: {
          label: this.t("WEATHER_GENERATE"),
          callback: async (html) => {
            const zone = html.find("#zone").val();
            const season = html.find("#season").val();
            const currentHour = parseInt(html.find("#currentHour").val(), 10) || savedHour;
            const tod = WeatherGeneratorUI.hourToCategory(currentHour);
            const gmOnly = html.find("#gmOnly")[0].checked;

            await Promise.all([
              game.user.setFlag(MODULE_ID, F_ZONE, zone),
              game.user.setFlag(MODULE_ID, F_SEASON, season)
            ]);

            const zData = CLIMATE[zone] || CLIMATE[zoneKeys[0]];
            const windDirections = WeatherGeneratorUI.DIR_NAMES
              .map((d, i) => ({ ...d, weight: zData.directions[i] || 1 }));
            const wWeights = zData.windW[season] || zData.windW[zData.seasons[0]];
            const windTableF = WeatherGeneratorUI.WIND_DEFS
              .map((d, i) => ({ ...d, weight: wWeights[i] || 0 }));

            const baseWeather = zData.weatherW[season] || zData.weatherW[zData.seasons[0]];
            const weightedWeatherTable = Object.entries(baseWeather).map(([cond, base]) => {
              const mult = (WeatherGeneratorUI.weatherByTime[tod] && WeatherGeneratorUI.weatherByTime[tod][cond]) || 1;
              return { cond, weight: Math.max(0.01, base * mult) };
            });

            const MAX_TRIES = 8;
            let chosen = null;
            for (let attempt = 0; attempt < MAX_TRIES && !chosen; attempt++) {
              const weatherPick = WeatherGeneratorUI.weightedChoice(weightedWeatherTable);
              const weatherCond = weatherPick.cond;
              const reqMin = WeatherGeneratorUI.weatherWindMin[weatherCond] || 1;
              const windOpts = windTableF.filter(w => w.max >= reqMin);
              const mods = WeatherGeneratorUI.windModsByTime[tod] || WeatherGeneratorUI.windModsByTime["День"];
              const adjOpts = windOpts.map((w, i) => ({ ...w, weight: (w.weight || 1) * (mods[i] || 1) }));
              const directionObj = WeatherGeneratorUI.weightedChoice(windDirections);
              let wind = null;
              for (let i = 0; i < 6; i++) {
                wind = WeatherGeneratorUI.weightedChoice(adjOpts);
                if (weatherCond === "Гроза" && wind.max < 3) continue;
                if (weatherCond === "Туман" && wind.max >= 4) continue;
                break;
              }
              if (!wind) continue;
              chosen = { weatherCond, wind, directionObj };
            }
            if (!chosen) {
              const fb = WeatherGeneratorUI.weightedChoice(weightedWeatherTable);
              chosen = {
                weatherCond: fb.cond,
                wind: WeatherGeneratorUI.weightedChoice(windTableF),
                directionObj: WeatherGeneratorUI.weightedChoice(windDirections)
              };
            }

            const dur = WeatherGeneratorUI.weatherDuration[chosen.weatherCond] || { min: 1, max: 6 };
            const durationHours = Math.floor(Math.random() * (dur.max - dur.min + 1)) + dur.min;
            const nextHour = WeatherGeneratorUI.addHoursToHour(currentHour, durationHours);
            await game.user.setFlag(MODULE_ID, F_HOUR, nextHour);

            const curLabel = WeatherGeneratorUI.fmtHour(currentHour);
            const nextLabel = WeatherGeneratorUI.fmtHour(nextHour);
            const arrow = chosen.directionObj.arrow || "→";
            const arrowHtml = `<span style="font-size:22px;font-weight:700;display:inline-block;width:32px;text-align:center;transform:translateY(4px);">${arrow}</span>`;

            const zoneLabel = this.localizeFromMap(WeatherGeneratorUI.LOCALIZATION.zones, zone);
            const seasonLabel = this.localizeFromMap(WeatherGeneratorUI.LOCALIZATION.seasons, season);
            const weatherLabel = this.localizeFromMap(WeatherGeneratorUI.LOCALIZATION.weatherDisplay, chosen.weatherCond);
            const directionLabel = this.localizeFromMap(WeatherGeneratorUI.LOCALIZATION.directions, chosen.directionObj.key);
            const windLabel = this.localizedLabel(chosen.wind, "");
            const windRange = (lang === "en" ? chosen.wind.range_en : chosen.wind.range_ru) || chosen.wind.range_ru || "";
            const windWaves = (lang === "en" ? chosen.wind.waves_en : chosen.wind.waves_ru) || chosen.wind.waves_ru || "";

            const msg =
              `<div style="background:linear-gradient(180deg,#0f1724,#11121a);color:#e6eef6;padding:14px;border-radius:12px;font-family:Inter,system-ui;border:1px solid rgba(160,180,200,0.06);">` +
                `<h2 style="margin:0 0 4px 0;font-size:18px;color:#9be7ff;">${this.t("WEATHER_HEADER")} — ${this.localizeFromMap(WeatherGeneratorUI.LOCALIZATION.months, "F")}</h2>` +
                `<div style="font-size:11px;color:#9aa7b2;margin-bottom:10px;">${zoneLabel} · ${seasonLabel} · ${curLabel}</div>` +
                `<hr style="border:none;height:1px;background:rgba(255,255,255,0.08);margin:8px 0 12px 0;">` +
                `<p style="margin:0 0 8px 0;font-size:14px;"><b>🧭 ${this.t("WEATHER_WIND_DIR")}:</b><br>${arrowHtml}<br><b style="color:#ffd380;">${directionLabel}</b></p>` +
                `<p style="margin:0 0 8px 0;font-size:15px;"><b>🌦️ ${this.t("WEATHER_CONDITIONS")}:</b> ${weatherLabel}</p>` +
                `<p style="margin:0 0 8px 0;font-size:14px;"><b>💨 ${this.t("WEATHER_WIND_WAVES")}:</b> ${chosen.wind.icon} <b>${windLabel}</b> (${windRange}), ${windWaves}</p>` +
                `<p style="margin:0 0 8px 0;font-size:14px;"><b>⏳ ${this.t("WEATHER_DURATION")}:</b> ${durationHours} ${this.t("UNIT_HOURS_SHORT")}</p>` +
                `<hr style="border:none;height:1px;background:rgba(255,255,255,0.08);margin:8px 0 10px 0;">` +
                `<p style="margin:0;font-size:13px;color:#ffd380;">🔄 ${this.t("WEATHER_NEXT")}: <b>${nextLabel}</b></p>` +
              `</div>`;

            try {
              if (gmOnly) {
                const gmIds = game.users.contents.filter(u => u.isGM).map(u => u.id);
                await ChatMessage.create({ content: msg, whisper: gmIds.length ? gmIds : undefined });
              } else {
                await ChatMessage.create({ content: msg });
              }
            } catch (err) {
              console.error("Weather generator error:", err);
              ChatMessage.create({ content: `<pre>${this.t("ERROR_PREFIX")} ${err}</pre>` });
            }
          }
        }
      },
      default: "ok",
      close: () => {
        this.dialog = null;
      }
    }, {
      width: 640,
      height: "auto",
      resizable: true
    });

    this.dialog.render(true);
  }

  rerenderWithLanguage() {
    if (!this.dialog) return;
    try {
      this.dialog.close();
      setTimeout(() => this.render(), 0);
    } catch (e) {
      console.warn("Zephyr: failed to rerender weather generator after language change", e);
    }
  }

  static hourToCategory(h) {
    if (h >= 6 && h < 12) return "Утро";
    if (h >= 12 && h < 18) return "День";
    if (h >= 18 && h < 21) return "Вечер";
    return "Ночь";
  }

  static addHoursToHour(cur, dh) {
    return ((cur - 1 + dh) % 24) + 1;
  }

  static fmtHour(h) {
    return String(h).padStart(2, "0") + ":00";
  }

  static weightedChoice(items) {
    const total = items.reduce((s, e) => s + (e.weight || 0), 0);
    if (total <= 0) return items[0];
    let r = Math.random() * total;
    let sum = 0;
    for (const e of items) {
      sum += (e.weight || 0);
      if (r <= sum) return e;
    }
    return items[0];
  }
}

WeatherGeneratorUI.LOCALIZATION = {
  zones: {
    "Дольдрумы (0–10°)": { ru: "Дольдрумы (0–10°)", en: "Doldrums (0–10°)" },
    "Пассаты (10–30°)": { ru: "Пассаты (10–30°)", en: "Trade winds (10–30°)" },
    "Западные ветры (30–60°)": { ru: "Западные ветры (30–60°)", en: "Westerlies (30–60°)" },
    "Полярные ветры (>60°)": { ru: "Полярные ветры (>60°)", en: "Polar winds (>60°)" }
  },
  seasons: {
    "Зима (DJF)": { ru: "Зима (DJF)", en: "Winter (DJF)" },
    "Весна (MAM)": { ru: "Весна (MAM)", en: "Spring (MAM)" },
    "Лето (JJA)": { ru: "Лето (JJA)", en: "Summer (JJA)" },
    "Осень (SON)": { ru: "Осень (SON)", en: "Autumn (SON)" }
  },
  weatherDisplay: {
    "Ясно": { ru: "Ясно ☀️", en: "Clear ☀️" },
    "Облачно": { ru: "Облачно ☁️", en: "Cloudy ☁️" },
    "Туман": { ru: "Туман 🌫️", en: "Fog 🌫️" },
    "Лёгкий дождь": { ru: "Мелкий дождь 🌦️", en: "Light rain 🌦️" },
    "Сильный дождь": { ru: "Сильный дождь 🌧️", en: "Heavy rain 🌧️" },
    "Гроза": { ru: "Гроза ⛈️", en: "Thunderstorm ⛈️" }
  },
  directions: {
    north: { ru: "Северный", en: "North" },
    northeast: { ru: "Северо-восточный", en: "Northeast" },
    east: { ru: "Восточный", en: "East" },
    southeast: { ru: "Юго-восточный", en: "Southeast" },
    south: { ru: "Южный", en: "South" },
    southwest: { ru: "Юго-западный", en: "Southwest" },
    west: { ru: "Западный", en: "West" },
    northwest: { ru: "Северо-западный", en: "Northwest" }
  },
  months: {
    F: { ru: "Элесиас", en: "Elesias" }
  }
};

WeatherGeneratorUI.DIR_NAMES = [
  { key: "north", arrow: "↓" },
  { key: "northeast", arrow: "↙" },
  { key: "east", arrow: "←" },
  { key: "southeast", arrow: "↖" },
  { key: "south", arrow: "↑" },
  { key: "southwest", arrow: "↗" },
  { key: "west", arrow: "→" },
  { key: "northwest", arrow: "↘" }
];

WeatherGeneratorUI.WIND_DEFS = [
  { label_ru: "Штиль", label_en: "Calm", range_ru: "<5 уз.", range_en: "<5 kn", waves_ru: "0–0.5 м", waves_en: "0–0.5 m", icon: "🌫️", max: 1 },
  { label_ru: "Лёгкий бриз", label_en: "Light breeze", range_ru: "5–10 уз.", range_en: "5–10 kn", waves_ru: "0.5–1 м", waves_en: "0.5–1 m", icon: "🍃", max: 2 },
  { label_ru: "Свежий бриз", label_en: "Fresh breeze", range_ru: "10–20 уз.", range_en: "10–20 kn", waves_ru: "1–2 м", waves_en: "1–2 m", icon: "💨", max: 3 },
  { label_ru: "Крепкий ветер", label_en: "Strong wind", range_ru: "20–40 уз.", range_en: "20–40 kn", waves_ru: "2–4 м", waves_en: "2–4 m", icon: "🌬️", max: 4 },
  { label_ru: "Шторм", label_en: "Storm", range_ru: ">40 уз.", range_en: ">40 kn", waves_ru: "4–8+ м", waves_en: "4–8+ m", icon: "⛈️", max: 5 }
];

WeatherGeneratorUI.weatherByTime = {
  "Утро": { "Ясно": 1.0, "Облачно": 1.0, "Туман": 2.5, "Лёгкий дождь": 0.8, "Сильный дождь": 0.4, "Гроза": 0.1 },
  "День": { "Ясно": 2.2, "Облачно": 1.2, "Туман": 0.2, "Лёгкий дождь": 1.1, "Сильный дождь": 0.6, "Гроза": 1.8 },
  "Вечер": { "Ясно": 1.1, "Облачно": 1.3, "Туман": 1.8, "Лёгкий дождь": 1.1, "Сильный дождь": 1.0, "Гроза": 0.8 },
  "Ночь": { "Ясно": 0.9, "Облачно": 1.1, "Туман": 2.2, "Лёгкий дождь": 0.9, "Сильный дождь": 0.6, "Гроза": 0.3 }
};

WeatherGeneratorUI.windModsByTime = {
  "Утро": [2.0, 1.6, 1.0, 0.6, 0.2],
  "День": [0.6, 0.9, 1.3, 1.6, 1.0],
  "Вечер": [1.2, 1.4, 1.0, 0.8, 0.4],
  "Ночь": [1.8, 1.2, 0.8, 0.5, 0.2]
};

WeatherGeneratorUI.weatherWindMin = { "Ясно": 1, "Облачно": 1, "Туман": 1, "Лёгкий дождь": 2, "Сильный дождь": 3, "Гроза": 3 };
WeatherGeneratorUI.weatherDuration = {
  "Ясно": { min: 4, max: 6 },
  "Облачно": { min: 2, max: 6 },
  "Туман": { min: 1, max: 6 },
  "Лёгкий дождь": { min: 1, max: 6 },
  "Сильный дождь": { min: 1, max: 6 },
  "Гроза": { min: 1, max: 4 }
};

WeatherGeneratorUI.CLIMATE = {
  "Дольдрумы (0–10°)": {
    seasons: ["Зима (DJF)", "Весна (MAM)", "Лето (JJA)", "Осень (SON)"],
    directions: [13, 13, 13, 13, 13, 13, 13, 13],
    windW: {
      "Зима (DJF)": [62, 25, 10, 3, 0],
      "Весна (MAM)": [58, 28, 11, 3, 0],
      "Лето (JJA)": [55, 30, 12, 3, 0],
      "Осень (SON)": [60, 26, 11, 3, 0]
    },
    weatherW: {
      "Зима (DJF)": { "Ясно": 22, "Облачно": 58, "Туман": 6, "Лёгкий дождь": 28, "Сильный дождь": 14, "Гроза": 18 },
      "Весна (MAM)": { "Ясно": 20, "Облачно": 60, "Туман": 5, "Лёгкий дождь": 30, "Сильный дождь": 15, "Гроза": 20 },
      "Лето (JJA)": { "Ясно": 18, "Облачно": 62, "Туман": 4, "Лёгкий дождь": 32, "Сильный дождь": 16, "Гроза": 22 },
      "Осень (SON)": { "Ясно": 21, "Облачно": 59, "Туман": 5, "Лёгкий дождь": 29, "Сильный дождь": 14, "Гроза": 19 }
    }
  },
  "Пассаты (10–30°)": {
    seasons: ["Зима (DJF)", "Весна (MAM)", "Лето (JJA)", "Осень (SON)"],
    directions: [8, 70, 15, 2, 1, 1, 1, 2],
    windW: {
      "Зима (DJF)": [8, 21, 47, 22, 2],
      "Весна (MAM)": [10, 24, 49, 16, 1],
      "Лето (JJA)": [12, 27, 51, 9, 1],
      "Осень (SON)": [9, 23, 48, 18, 2]
    },
    weatherW: {
      "Зима (DJF)": { "Ясно": 48, "Облачно": 35, "Туман": 3, "Лёгкий дождь": 8, "Сильный дождь": 4, "Гроза": 4 },
      "Весна (MAM)": { "Ясно": 50, "Облачно": 34, "Туман": 3, "Лёгкий дождь": 7, "Сильный дождь": 4, "Гроза": 4 },
      "Лето (JJA)": { "Ясно": 52, "Облачно": 33, "Туман": 3, "Лёгкий дождь": 7, "Сильный дождь": 3, "Гроза": 3 },
      "Осень (SON)": { "Ясно": 49, "Облачно": 35, "Туман": 3, "Лёгкий дождь": 7, "Сильный дождь": 4, "Гроза": 4 }
    }
  },
  "Западные ветры (30–60°)": {
    seasons: ["Зима (DJF)", "Весна (MAM)", "Лето (JJA)", "Осень (SON)"],
    directions: [1, 1, 1, 2, 8, 53, 22, 11],
    windW: {
      "Зима (DJF)": [5, 14, 38, 37, 6],
      "Весна (MAM)": [7, 18, 42, 29, 4],
      "Лето (JJA)": [10, 25, 45, 18, 2],
      "Осень (SON)": [6, 16, 40, 33, 5]
    },
    weatherW: {
      "Зима (DJF)": { "Ясно": 18, "Облачно": 48, "Туман": 7, "Лёгкий дождь": 16, "Сильный дождь": 8, "Гроза": 3 },
      "Весна (MAM)": { "Ясно": 22, "Облачно": 46, "Туман": 6, "Лёгкий дождь": 15, "Сильный дождь": 7, "Гроза": 3 },
      "Лето (JJA)": { "Ясно": 28, "Облачно": 45, "Туман": 5, "Лёгкий дождь": 12, "Сильный дождь": 6, "Гроза": 2 },
      "Осень (SON)": { "Ясно": 20, "Облачно": 47, "Туман": 6, "Лёгкий дождь": 15, "Сильный дождь": 8, "Гроза": 3 }
    }
  },
  "Полярные ветры (>60°)": {
    seasons: ["Зима (DJF)", "Лето (JJA)"],
    directions: [10, 27, 28, 15, 5, 3, 3, 9],
    windW: {
      "Зима (DJF)": [8, 18, 35, 30, 9],
      "Лето (JJA)": [15, 25, 40, 18, 2]
    },
    weatherW: {
      "Зима (DJF)": { "Ясно": 15, "Облачно": 50, "Туман": 10, "Лёгкий дождь": 13, "Сильный дождь": 7, "Гроза": 2 },
      "Лето (JJA)": { "Ясно": 25, "Облачно": 48, "Туман": 8, "Лёгкий дождь": 10, "Сильный дождь": 5, "Гроза": 1 }
    }
  }
};
