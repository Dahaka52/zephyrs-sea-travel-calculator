// == Морская погода — климатические пояса, сезоны, автосохранение ==

(async () => {
  const MODULE_ID = "zephyrs-sea-travel-calculator";
  const F_HOUR = "weatherNextHour";   // number 1–24
  const F_ZONE = "weatherZone";        // string
  const F_SEASON = "weatherSeason";      // string

  const months = { "F": "Элесиас" };

  // ───────────────────────────────────────────────────────────────────────────
  // БАЗА КЛИМАТИЧЕСКИХ ДАННЫХ
  // Источник: погодные данные.md (Pilot Charts / ERA5 / ship obs.)
  //
  // Структура каждого пояса:
  //   seasons:   список доступных сезонов
  //   directions: [N, NE, E, SE, S, SW, W, NW] — веса (сумма ~100)
  //   windW:     { сезон: [<5kn, 5-10, 10-20, 20-40, >40] }
  //   weatherW:  { сезон: { Ясно, Облачно, Туман, Лёгкий дождь, Сильный дождь, Гроза } }
  // ───────────────────────────────────────────────────────────────────────────
  const CLIMATE = {

    // ── 1. Дольдрумы / ITCZ (0–10°) ────────────────────────────────────────
    "Дольдрумы (0–10°)": {
      seasons: ["Зима (DJF)", "Весна (MAM)", "Лето (JJA)", "Осень (SON)"],
      // Variable: все направления равновероятны
      directions: [13, 13, 13, 13, 13, 13, 13, 13],
      windW: {
        "Зима (DJF)": [62, 25, 10, 3, 0],
        "Весна (MAM)": [58, 28, 11, 3, 0],
        "Лето (JJA)": [55, 30, 12, 3, 0],
        "Осень (SON)": [60, 26, 11, 3, 0]
      },
      weatherW: {
        // Дождь (42/45/48/43) разбит на лёгкий (~2/3) + сильный (~1/3)
        "Зима (DJF)": { "Ясно": 22, "Облачно": 58, "Туман": 6, "Лёгкий дождь": 28, "Сильный дождь": 14, "Гроза": 18 },
        "Весна (MAM)": { "Ясно": 20, "Облачно": 60, "Туман": 5, "Лёгкий дождь": 30, "Сильный дождь": 15, "Гроза": 20 },
        "Лето (JJA)": { "Ясно": 18, "Облачно": 62, "Туман": 4, "Лёгкий дождь": 32, "Сильный дождь": 16, "Гроза": 22 },
        "Осень (SON)": { "Ясно": 21, "Облачно": 59, "Туман": 5, "Лёгкий дождь": 29, "Сильный дождь": 14, "Гроза": 19 }
      }
    },

    // ── 2. Пассаты (10–30°) ─────────────────────────────────────────────────
    "Пассаты (10–30°)": {
      seasons: ["Зима (DJF)", "Весна (MAM)", "Лето (JJA)", "Осень (SON)"],
      // NE dominant; N, E secondary
      // [N, NE, E, SE, S, SW, W, NW]
      directions: [8, 70, 15, 2, 1, 1, 1, 2],
      windW: {
        "Зима (DJF)": [8, 21, 47, 22, 2],
        "Весна (MAM)": [10, 24, 49, 16, 1],
        "Лето (JJA)": [12, 27, 51, 9, 1],
        "Осень (SON)": [9, 23, 48, 18, 2]
      },
      weatherW: {
        // Дождь (12/11/10/11): лёгкий ~8, сильный ~4
        "Зима (DJF)": { "Ясно": 48, "Облачно": 35, "Туман": 3, "Лёгкий дождь": 8, "Сильный дождь": 4, "Гроза": 4 },
        "Весна (MAM)": { "Ясно": 50, "Облачно": 34, "Туман": 3, "Лёгкий дождь": 7, "Сильный дождь": 4, "Гроза": 4 },
        "Лето (JJA)": { "Ясно": 52, "Облачно": 33, "Туман": 3, "Лёгкий дождь": 7, "Сильный дождь": 3, "Гроза": 3 },
        "Осень (SON)": { "Ясно": 49, "Облачно": 35, "Туман": 3, "Лёгкий дождь": 7, "Сильный дождь": 4, "Гроза": 4 }
      }
    },

    // ── 3. Западные ветры (30–60°) ──────────────────────────────────────────
    "Западные ветры (30–60°)": {
      seasons: ["Зима (DJF)", "Весна (MAM)", "Лето (JJA)", "Осень (SON)"],
      // SW dominant; W, NW, S secondary
      // [N, NE, E, SE, S, SW, W, NW]
      directions: [1, 1, 1, 2, 8, 53, 22, 11],
      windW: {
        "Зима (DJF)": [5, 14, 38, 37, 6],
        "Весна (MAM)": [7, 18, 42, 29, 4],
        "Лето (JJA)": [10, 25, 45, 18, 2],
        "Осень (SON)": [6, 16, 40, 33, 5]
      },
      weatherW: {
        // Дождь (24/22/18/23): лёгкий ~2/3, сильный ~1/3
        "Зима (DJF)": { "Ясно": 18, "Облачно": 48, "Туман": 7, "Лёгкий дождь": 16, "Сильный дождь": 8, "Гроза": 3 },
        "Весна (MAM)": { "Ясно": 22, "Облачно": 46, "Туман": 6, "Лёгкий дождь": 15, "Сильный дождь": 7, "Гроза": 3 },
        "Лето (JJA)": { "Ясно": 28, "Облачно": 45, "Туман": 5, "Лёгкий дождь": 12, "Сильный дождь": 6, "Гроза": 2 },
        "Осень (SON)": { "Ясно": 20, "Облачно": 47, "Туман": 6, "Лёгкий дождь": 15, "Сильный дождь": 8, "Гроза": 3 }
      }
    },

    // ── 4. Полярные восточные (>60°) ────────────────────────────────────────
    "Полярные ветры (>60°)": {
      seasons: ["Зима (DJF)", "Лето (JJA)"],
      // E/NE dominant winter; E dominant summer; N, SE secondary
      // [N, NE, E, SE, S, SW, W, NW]
      directions: [10, 27, 28, 15, 5, 3, 3, 9],
      windW: {
        "Зима (DJF)": [8, 18, 35, 30, 9],
        "Лето (JJA)": [15, 25, 40, 18, 2]
      },
      weatherW: {
        // Дождь (20/15): лёгкий ~2/3, сильный ~1/3
        "Зима (DJF)": { "Ясно": 15, "Облачно": 50, "Туман": 10, "Лёгкий дождь": 13, "Сильный дождь": 7, "Гроза": 2 },
        "Лето (JJA)": { "Ясно": 25, "Облачно": 48, "Туман": 8, "Лёгкий дождь": 10, "Сильный дождь": 5, "Гроза": 1 }
      }
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 8 направлений (индекс = порядок в массиве directions)
  // ───────────────────────────────────────────────────────────────────────────
  const DIR_NAMES = [
    { dir: "Северный", arrow: "↓" },
    { dir: "Северо-восточный", arrow: "↙" },
    { dir: "Восточный", arrow: "←" },
    { dir: "Юго-восточный", arrow: "↖" },
    { dir: "Южный", arrow: "↑" },
    { dir: "Юго-западный", arrow: "↗" },
    { dir: "Западный", arrow: "→" },
    { dir: "Северо-западный", arrow: "↘" }
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // Шкала ветра — веса берутся из CLIMATE[zone].windW[season]
  // ───────────────────────────────────────────────────────────────────────────
  const WIND_DEFS = [
    { range: "<5 уз.", label: "Штиль", waves: "0–0.5 м", icon: "🌫️", max: 1 },
    { range: "5–10 уз.", label: "Лёгкий бриз", waves: "0.5–1 м", icon: "🍃", max: 2 },
    { range: "10–20 уз.", label: "Свежий бриз", waves: "1–2 м", icon: "💨", max: 3 },
    { range: "20–40 уз.", label: "Крепкий ветер", waves: "2–4 м", icon: "🌬️", max: 4 },
    { range: ">40 уз.", label: "Шторм", waves: "4–8+ м", icon: "⛈️", max: 5 }
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // Множители погоды и ветра по времени суток
  // ───────────────────────────────────────────────────────────────────────────
  const weatherByTime = {
    "Утро": { "Ясно": 1.0, "Облачно": 1.0, "Туман": 2.5, "Лёгкий дождь": 0.8, "Сильный дождь": 0.4, "Гроза": 0.1 },
    "День": { "Ясно": 2.2, "Облачно": 1.2, "Туман": 0.2, "Лёгкий дождь": 1.1, "Сильный дождь": 0.6, "Гроза": 1.8 },
    "Вечер": { "Ясно": 1.1, "Облачно": 1.3, "Туман": 1.8, "Лёгкий дождь": 1.1, "Сильный дождь": 1.0, "Гроза": 0.8 },
    "Ночь": { "Ясно": 0.9, "Облачно": 1.1, "Туман": 2.2, "Лёгкий дождь": 0.9, "Сильный дождь": 0.6, "Гроза": 0.3 }
  };
  const windModsByTime = {
    "Утро": [2.0, 1.6, 1.0, 0.6, 0.2],
    "День": [0.6, 0.9, 1.3, 1.6, 1.0],
    "Вечер": [1.2, 1.4, 1.0, 0.8, 0.4],
    "Ночь": [1.8, 1.2, 0.8, 0.5, 0.2]
  };
  const weatherWindMin = {
    "Ясно": 1, "Облачно": 1, "Туман": 1,
    "Лёгкий дождь": 2, "Сильный дождь": 3, "Гроза": 3
  };
  const weatherDuration = {
    "Ясно": { min: 4, max: 6 },
    "Облачно": { min: 2, max: 6 },
    "Туман": { min: 1, max: 6 },
    "Лёгкий дождь": { min: 1, max: 6 },
    "Сильный дождь": { min: 1, max: 6 },
    "Гроза": { min: 1, max: 4 }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Вспомогательные функции
  // ───────────────────────────────────────────────────────────────────────────
  function hourToCategory(h) {
    if (h >= 6 && h < 12) return "Утро";
    if (h >= 12 && h < 18) return "День";
    if (h >= 18 && h < 21) return "Вечер";
    return "Ночь";
  }
  function addHoursToHour(cur, dh) { return ((cur - 1 + dh) % 24) + 1; }
  function fmtHour(h) { return String(h).padStart(2, "0") + ":00"; }

  function weightedChoice(items) {
    const total = items.reduce((s, e) => s + (e.weight || 0), 0);
    if (total <= 0) return items[0];
    let r = Math.random() * total, sum = 0;
    for (const e of items) { sum += (e.weight || 0); if (r <= sum) return e; }
    return items[0];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Загружаем сохранённые настройки
  // ───────────────────────────────────────────────────────────────────────────
  const savedHour = game.user.getFlag(MODULE_ID, F_HOUR) || 12;
  const zoneKeys = Object.keys(CLIMATE);
  const savedZone = (game.user.getFlag(MODULE_ID, F_ZONE) || zoneKeys[0]);
  const activeZone = CLIMATE[savedZone] ? savedZone : zoneKeys[0];
  const savedSeason = (game.user.getFlag(MODULE_ID, F_SEASON) || CLIMATE[activeZone].seasons[0]);
  const activeSeason = CLIMATE[activeZone].seasons.includes(savedSeason)
    ? savedSeason
    : CLIMATE[activeZone].seasons[0];

  // ───────────────────────────────────────────────────────────────────────────
  // Построение HTML диалога
  // ───────────────────────────────────────────────────────────────────────────
  const SEASON_ICONS = {
    "Зима (DJF)": "❄️",
    "Весна (MAM)": "🌸",
    "Лето (JJA)": "☀️",
    "Осень (SON)": "🍂"
  };

  function formatSeasonLabel(s) {
    const icon = SEASON_ICONS[s] || "🗓️";
    return icon + " " + s;
  }

  function buildZoneOptions(selected) {
    return zoneKeys.map(z =>
      "<option value=\"" + z + "\"" + (z === selected ? " selected" : "") + ">" + z + "</option>"
    ).join("");
  }

  function buildSeasonOptions(zone, selected) {
    return CLIMATE[zone].seasons.map(s => {
      const label = formatSeasonLabel(s);
      return "<option value=\"" + s + "\"" + (s === selected ? " selected" : "") + ">" + label + "</option>";
    }).join("");
  }

  function buildHourOptions(selected) {
    return Array.from({ length: 24 }, (_, i) => {
      const h = i + 1;
      return "<option value=\"" + h + "\"" + (h === selected ? " selected" : "") + ">" + fmtHour(h) + "</option>";
    }).join("");
  }

  const content =
    "<div class=\"zephyr-bg\"></div>" +
    "<div class=\"zephyr-calc-wrap\">" +
    "<div class=\"zephyr-scroll\">" +
    "<form class=\"zephyr-section zephyr-weather-form\">" +
    "<div class=\"zephyr-section__title\">Генератор морской погоды</div>" +

    "<div class=\"calc-row\">" +
    "<div class=\"calc-label\">Климатический пояс:</div>" +
    "<div class=\"calc-control\">" +
    "<select id=\"zone\" style=\"width:100%;\">" +
    buildZoneOptions(activeZone) +
    "</select>" +
    "</div>" +
    "</div>" +

    "<div class=\"calc-row\">" +
    "<div class=\"calc-label\">Сезон:</div>" +
    "<div class=\"calc-control\">" +
    "<select id=\"season\" style=\"width:100%;\">" +
    buildSeasonOptions(activeZone, activeSeason) +
    "</select>" +
    "</div>" +
    "</div>" +

    "<div class=\"calc-row\">" +
    "<div class=\"calc-label\">Текущий час:</div>" +
    "<div class=\"calc-control\">" +
    "<select id=\"currentHour\" style=\"width:100%;\">" +
    buildHourOptions(savedHour) +
    "</select>" +
    "</div>" +
    "</div>" +

    "<div class=\"calc-row\">" +
    "<div class=\"calc-label\"></div>" +
    "<div class=\"calc-control\">" +
    "<label class=\"zephyr-checkbox-line\"><input type=\"checkbox\" id=\"gmOnly\"> Выводить только ГМ</label>" +
    "</div>" +
    "</div>" +

    "</form>" +
    "</div>" +
    "</div>";

  // ───────────────────────────────────────────────────────────────────────────
  // Диалог
  // ───────────────────────────────────────────────────────────────────────────
  new Dialog({
    title: "Генератор морской погоды",
    content: content,
    classes: ["zephyr-calculator", "zephyr-weather", "flexcol"],

    // При смене пояса — перестраиваем список сезонов
    render: (html) => {
      html.find("#zone").on("change", function () {
        const z = this.value;
        const seasons = CLIMATE[z] ? CLIMATE[z].seasons : [];
        const current = html.find("#season").val();
        const next = seasons.includes(current) ? current : seasons[0];
        html.find("#season").html(buildSeasonOptions(z, next));
      });
    },

    buttons: {
      ok: {
        label: "Сгенерировать",
        callback: async (html) => {
          const zone = html.find("#zone").val();
          const season = html.find("#season").val();
          const currentHour = parseInt(html.find("#currentHour").val(), 10) || savedHour;
          const tod = hourToCategory(currentHour);
          const gmOnly = html.find("#gmOnly")[0].checked;

          // Сохраняем выбор
          await Promise.all([
            game.user.setFlag(MODULE_ID, F_ZONE, zone),
            game.user.setFlag(MODULE_ID, F_SEASON, season)
          ]);

          const zData = CLIMATE[zone] || CLIMATE[zoneKeys[0]];

          // Направления ветра с весами из текущего пояса
          const windDirections = DIR_NAMES.map((d, i) => ({
            ...d, weight: zData.directions[i] || 1
          }));

          // Шкала ветра с весами из текущего пояса+сезона
          const wWeights = (zData.windW[season] || zData.windW[zData.seasons[0]]);
          const windTableF = WIND_DEFS.map((d, i) => ({
            ...d, weight: wWeights[i] || 0
          }));

          // Таблица погоды с весами из текущего пояса+сезона, с модификатором времени суток
          const baseWeather = zData.weatherW[season] || zData.weatherW[zData.seasons[0]];
          const weightedWeatherTable = Object.entries(baseWeather).map(([cond, base]) => {
            const mult = (weatherByTime[tod] && weatherByTime[tod][cond]) || 1;
            return { cond, weight: Math.max(0.01, base * mult) };
          });

          // Генерация погоды + совместимый ветер
          const MAX_TRIES = 8;
          let chosen = null;

          for (let attempt = 0; attempt < MAX_TRIES && !chosen; attempt++) {
            const weatherPick = weightedChoice(weightedWeatherTable);
            const weatherCond = weatherPick.cond;
            const reqMin = weatherWindMin[weatherCond] || 1;

            const windOpts = windTableF.filter(w => w.max >= reqMin);
            const mods = windModsByTime[tod] || windModsByTime["День"];
            const adjOpts = windOpts.map((w, i) => ({ ...w, weight: (w.weight || 1) * (mods[i] || 1) }));

            const directionObj = weightedChoice(windDirections);
            let wind = null;
            for (let i = 0; i < 6; i++) {
              wind = weightedChoice(adjOpts);
              if (weatherCond === "Гроза" && wind.max < 3) continue;
              if (weatherCond === "Туман" && wind.max >= 4) continue;
              break;
            }
            if (!wind) continue;

            chosen = {
              weatherCond,
              weatherLabel: ({
                "Ясно": "Ясно ☀️",
                "Облачно": "Облачно ☁️",
                "Туман": "Туман 🌫️",
                "Лёгкий дождь": "Мелкий дождь 🌦️",
                "Сильный дождь": "Сильный дождь 🌧️",
                "Гроза": "Гроза ⛈️"
              })[weatherCond] || weatherCond,
              wind,
              directionObj
            };
          }

          // Запасной вариант
          if (!chosen) {
            const fb = weightedChoice(weightedWeatherTable);
            chosen = {
              weatherCond: fb.cond, weatherLabel: fb.cond,
              wind: weightedChoice(windTableF),
              directionObj: weightedChoice(windDirections)
            };
          }

          // Длительность и следующий час
          const dur = weatherDuration[chosen.weatherCond] || { min: 1, max: 6 };
          const durationHours = Math.floor(Math.random() * (dur.max - dur.min + 1)) + dur.min;
          const nextHour = addHoursToHour(currentHour, durationHours);
          await game.user.setFlag(MODULE_ID, F_HOUR, nextHour);

          const curLabel = fmtHour(currentHour);
          const nextLabel = fmtHour(nextHour);
          const arrow = chosen.directionObj.arrow || "→";
          const arrowHtml = "<span style=\"font-size:22px;font-weight:700;display:inline-block;" +
            "width:32px;text-align:center;transform:translateY(4px);\">" + arrow + "</span>";

          const msg =
            "<div style=\"background:linear-gradient(180deg,#0f1724,#11121a);color:#e6eef6;" +
            "padding:14px;border-radius:12px;font-family:Inter,system-ui;" +
            "border:1px solid rgba(160,180,200,0.06);\">" +
            "<h2 style=\"margin:0 0 4px 0;font-size:18px;color:#9be7ff;\">🌤️ Погода — " + months["F"] + "</h2>" +
            "<div style=\"font-size:11px;color:#9aa7b2;margin-bottom:10px;\">" +
            zone + " · " + season + " · " + curLabel +
            "</div>" +
            "<hr style=\"border:none;height:1px;background:rgba(255,255,255,0.08);margin:8px 0 12px 0;\">" +
            "<p style=\"margin:0 0 8px 0;font-size:14px;\">" +
            "<b>🧭 Направление ветра:</b><br>" + arrowHtml + "<br>" +
            "<b style=\"color:#ffd380;\">" + chosen.directionObj.dir + "</b>" +
            "</p>" +
            "<p style=\"margin:0 0 8px 0;font-size:15px;\">" +
            "<b>🌦️ Условия:</b> " + chosen.weatherLabel +
            "</p>" +
            "<p style=\"margin:0 0 8px 0;font-size:14px;\">" +
            "<b>💨 Ветер и волны:</b> " + chosen.wind.icon + " <b>" + chosen.wind.label + "</b>" +
            " (" + chosen.wind.range + "), " + chosen.wind.waves +
            "</p>" +
            "<p style=\"margin:0 0 8px 0;font-size:14px;\">" +
            "<b>⏳ Длительность:</b> " + durationHours + " ч." +
            "</p>" +
            "<hr style=\"border:none;height:1px;background:rgba(255,255,255,0.08);margin:8px 0 10px 0;\">" +
            "<p style=\"margin:0;font-size:13px;color:#ffd380;\">" +
            "🔄 Следующая смена погоды: <b>" + nextLabel + "</b>" +
            "</p>" +
            "</div>";

          try {
            if (gmOnly) {
              const gmIds = game.users.contents.filter(u => u.isGM).map(u => u.id);
              await ChatMessage.create({ content: msg, whisper: gmIds.length ? gmIds : undefined });
            } else {
              await ChatMessage.create({ content: msg });
            }
          } catch (err) {
            console.error("Ошибка погоды:", err);
            ChatMessage.create({ content: "<pre>Ошибка: " + err + "</pre>" });
          }
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "ok"
  }).render(true);
})();
