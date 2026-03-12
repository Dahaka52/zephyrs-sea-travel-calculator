class TravelCalculatorUI {
  constructor(calculator) {
    this.calculator = calculator;
    this.dialog = null;
    this.resizeObserver = null;
    this.chatRenderer = new ChatRenderer();

    this.saveDebounceMs = 300;
    this.pendingSaveTimer = null;
    this.pendingLastInput = null;

    this.trackedWindowElement = null;
    this.onWindowMouseUp = null;
  }

  getDialogElement() {
    if (!this.dialog?.appId) return null;
    return document.querySelector(`.app.window-app[data-appid="${this.dialog.appId}"]`);
  }

  render() {
    if (this.dialog) {
      this.focusDialog();
      return;
    }

    const content = this.createDialogContent();
    const ws = this.calculator.windowSettings || { width: 680, height: 700, top: null, left: null };
    const options = {
      width: ws.width || 680,
      height: ws.height || 700,
      resizable: true,
      classes: ["zephyr-calculator"]
    };

    if (Number.isFinite(ws.top)) options.top = ws.top;
    if (Number.isFinite(ws.left)) options.left = ws.left;

    this.dialog = new Dialog({
      title: "🧭 Калькулятор морского перехода",
      content,
      buttons: {
        calculate: {
          label: "<i class='fas fa-ship'></i> Рассчитать и отправить в чат",
          callback: html => {
            this.calculateAndSend(html);
            return false;
          }
        },
        close: {
          label: "<i class='fas fa-times'></i> Закрыть",
          callback: () => {
            if (this.dialog) this.dialog.close();
          }
        }
      },
      render: html => this.initializeEventHandlers(html),
      default: "calculate",
      close: () => this.closeDialog()
    }, options);

    this.dialog.render(true);
    setTimeout(() => this.setupWindowTracking(), 0);
  }

  toggle() {
    if (this.dialog) {
      this.dialog.close();
      return;
    }
    this.render();
  }

  focusDialog() {
    if (!this.dialog) return;
    try {
      if (typeof this.dialog.bringToTop === "function") this.dialog.bringToTop();
      const dialogElement = this.getDialogElement();
      if (dialogElement) {
        const focusable = dialogElement.querySelector("input, select, textarea, button, [tabindex]");
        if (focusable && typeof focusable.focus === "function") focusable.focus();
      }
    } catch (e) {
      console.warn("Zephyr: could not focus calculator dialog", e);
    }
  }

  setupWindowTracking() {
    const dialogElement = this.getDialogElement();
    if (!dialogElement) return;

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.saveWindowPosition());
      this.resizeObserver.observe(dialogElement);
    }

    const jqElement = $(dialogElement);
    this.trackedWindowElement = jqElement;
    this.onWindowMouseUp = () => setTimeout(() => this.saveWindowPosition(), 100);
    jqElement.on("mouseup", this.onWindowMouseUp);
  }

  teardownWindowTracking() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.trackedWindowElement && this.onWindowMouseUp) {
      this.trackedWindowElement.off("mouseup", this.onWindowMouseUp);
    }
    this.trackedWindowElement = null;
    this.onWindowMouseUp = null;
  }

  saveWindowPosition() {
    const dialogElement = this.getDialogElement();
    if (!dialogElement) return;
    const rect = dialogElement.getBoundingClientRect();
    const settings = {
      width: Math.round(rect.width),
      height: Math.min(Math.round(rect.height), Math.round(window.innerHeight * 0.9)),
      top: Math.round(rect.top),
      left: Math.round(rect.left)
    };
    this.calculator.saveWindowSettings(settings);
  }

  scheduleSave(html) {
    this.pendingLastInput = this.getFormData(html);
    if (this.pendingSaveTimer) clearTimeout(this.pendingSaveTimer);
    this.pendingSaveTimer = setTimeout(() => this.flushPendingSave(), this.saveDebounceMs);
  }

  flushPendingSave() {
    if (this.pendingSaveTimer) {
      clearTimeout(this.pendingSaveTimer);
      this.pendingSaveTimer = null;
    }
    if (!this.pendingLastInput) return;
    this.calculator.saveLastInput(this.pendingLastInput);
    this.pendingLastInput = null;
  }

  closeDialog() {
    this.flushPendingSave();
    this.saveWindowPosition();
    this.teardownWindowTracking();
    this.dialog = null;
  }

  // adjustDialogHeight() — удалено: с flex-схемой height:100% Foundry
  // сам корректно управляет высотой при ресайзе.
  adjustDialogHeight() {}

  getAvailableBonusSails(shipId) {
    return this.calculator.getAvailableBonusSails(shipId);
  }

  getShipMaxCargo(shipId) {
    return this.calculator.getShipMaxCargo(shipId);
  }

  getShipDescription(shipId, cargoTons = 0, crewCount = 0) {
    return this.calculator.getShipDescription(shipId, cargoTons, crewCount);
  }

  // ── Строит SVG компас для выбора курса к ветру ──────────────────────
  _buildCompassSVG(courses, selectedCourse) {
    // Курсы расположены от носа (0°) до кормы (180°) — верхняя полуокружность
    // Мы рисуем 6 секторов в полукруге (180°), снизу вверх
    const cx = 110, cy = 110, r = 98, innerR = 22;

    // Определяем угловые диапазоны для каждого курса (в градусах от 0 = вверх)
    // Компас смотрит: ветер дует снизу, нос корабля вверху
    // 0° = прямо против ветра (мёртвая зона), 180° = фордевинд
    const courseAngles = {
      "45-close":   { start: 215, end: 245, label: "45°",  sub: "Бейд." },
      "60-close":   { start: 245, end: 270, label: "60°",  sub: "Бейд." },
      "90-cross":   { start: 270, end: 290, label: "90°",  sub: "Галфв." },
      "90-cross-sq":{ start: 290, end: 310, label: "90°▪", sub: "Галфв." },
      "135-broad":  { start: 310, end: 335, label: "135°", sub: "Бакш." },
      "180-run":    { start: 335, end: 360, label: "180°", sub: "Форд." }
    };

    function polarToXY(angleDeg, radius) {
      const rad = (angleDeg - 90) * Math.PI / 180;
      return {
        x: cx + radius * Math.cos(rad),
        y: cy + radius * Math.sin(rad)
      };
    }

    function sectorPath(startDeg, endDeg, outerR, innerR) {
      const s1 = polarToXY(startDeg, outerR);
      const e1 = polarToXY(endDeg, outerR);
      const s2 = polarToXY(endDeg, innerR);
      const e2 = polarToXY(startDeg, innerR);
      const large = (endDeg - startDeg) > 180 ? 1 : 0;
      return `M ${s1.x} ${s1.y} A ${outerR} ${outerR} 0 ${large} 1 ${e1.x} ${e1.y} L ${s2.x} ${s2.y} A ${innerR} ${innerR} 0 ${large} 0 ${e2.x} ${e2.y} Z`;
    }

    let sectorsHTML = "";
    for (const courseKey of courses) {
      const angle = courseAngles[courseKey];
      if (!angle) continue;
      const midAngle = (angle.start + angle.end) / 2;
      const midR = (r + innerR) / 2;
      const mid = polarToXY(midAngle, midR);
      const isActive = courseKey === selectedCourse;

      sectorsHTML += `<g class="compass-sector${isActive ? " active" : ""}" data-course="${courseKey}">
        <path d="${sectorPath(angle.start, angle.end, r, innerR)}"/>
        <text x="${mid.x}" y="${mid.y - 5}">${angle.label}</text>
        <text x="${mid.x}" y="${mid.y + 8}" style="font-size:8px">${angle.sub}</text>
      </g>`;
    }

    // Стрелка ветра (всегда снизу)
    const windArrow = `
      <line x1="${cx}" y1="${cy + innerR + 2}" x2="${cx}" y2="${cy + r - 2}"
            stroke="rgba(79,195,247,0.5)" stroke-width="2" stroke-dasharray="3,3"/>
      <text x="${cx}" y="${cy + r + 14}" text-anchor="middle" font-size="9"
            fill="rgba(126,207,238,0.7)" font-family="Cinzel,serif">↑ ВЕТЕР</text>
    `;

    // Зона мёртвого угла (нет ветра)
    const deadZone = `
      <path d="${sectorPath(180, 215, r, innerR)}"
            fill="rgba(80,20,20,0.4)" stroke="rgba(180,60,60,0.3)" stroke-width="1"/>
      <text x="${polarToXY(197, (r+innerR)/2).x}" y="${polarToXY(197, (r+innerR)/2).y}"
            text-anchor="middle" dominant-baseline="middle"
            font-size="8" fill="rgba(200,80,80,0.8)" font-family="Cinzel,serif">✗</text>
    `;

    return `
      <div class="wind-compass">
        <svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(5,20,50,0.4)"
                  stroke="rgba(79,195,247,0.2)" stroke-width="1"/>
          ${deadZone}
          ${sectorsHTML}
          ${windArrow}
        </svg>
        <div class="compass-center">🧭</div>
      </div>`;
  }

  createDialogContent() {
    const data = this.calculator.normalizeInput(this.calculator.lastData || {});
    const ship = ZEPHYR_SHIPS_LIBRARY[data.ship];

    if (!ship) {
      console.error(`Ship not found: ${data.ship}`);
      return `<div class="zephyr-bg"></div><div class="zephyr-calc-wrap"><div class="zephyr-scroll">
        <div class="zephyr-section"><p style="color:#ff6b6b;">Ошибка: корабль не найден</p></div>
      </div></div>`;
    }

    const availableSails = this.getAvailableBonusSails(data.ship);
    const maxCargo = this.getShipMaxCargo(data.ship);
    const shipCourses = ship.sailing?.availableCourses || Object.keys(ZEPHYR_WIND_COURSES);

    // ── Компас ──────────────────────────────────────────────────────────
    const compassSVG = this._buildCompassSVG(shipCourses, data.windCourse);

    // ── Кнопки ветра ────────────────────────────────────────────────────
    const windIcons = { calm: "🪶", weak: "🍃", normal: "💨", strong: "🌬️", storm: "⛈️" };
    const windShort = { calm: "Штиль", weak: "Бриз", normal: "Свежий", strong: "Крепкий", storm: "Шторм" };
    const windBtns = Object.entries(ZEPHYR_WIND_FORCES).map(([k]) =>
      `<div class="wind-btn${data.windForce === k ? " active" : ""}" data-wind="${k}">
         <span class="wbtn-icon">${windIcons[k]}</span>
         <span class="wbtn-label">${windShort[k]}</span>
       </div>`
    ).join("");

    // ── Кнопки волнения ──────────────────────────────────────────────────
    const waveIcons = { calm: "〰️", ripple: "🌊", wave: "🌊🌊", stwave: "🌊🌊🌊", storm: "🌀" };
    const waveShort = { calm: "Рябь", ripple: "Барашки", wave: "Волнение", stwave: "Шторм", storm: "Ураган" };
    const waveBtns = Object.entries(ZEPHYR_WAVES).map(([k]) =>
      `<div class="wave-btn${data.waves === k ? " active" : ""}" data-wave="${k}">
         <span class="wbtn-icon">${waveIcons[k]}</span>
         <span class="wbtn-label">${waveShort[k]}</span>
       </div>`
    ).join("");

    // ── Дополнительные паруса ─────────────────────────────────────────
    const sailsOptions = Object.entries(availableSails).map(([k, s]) =>
      `<option value="${k}" ${data.bonusSails === k ? "selected" : ""}>${s.label}</option>`
    ).join("");

    // ── Паруса + корабль ──────────────────────────────────────────────
    const shipsOptions = Object.values(ZEPHYR_SHIPS_LIBRARY).map(s =>
      `<option value="${s.id}" ${data.ship === s.id ? "selected" : ""}>${s.name}</option>`
    ).join("");

    const crewOptions = Object.entries(ZEPHYR_CREW_MODIFIERS).map(([k, c]) =>
      `<option value="${k}" ${data.crewType === k ? "selected" : ""}>${c.label}</option>`
    ).join("");

    const oarsRow = ship.sailing?.oars?.available ? `
      <div class="calc-row oars-row">
        <div class="calc-label">Весла:</div>
        <div class="calc-control calc-inline-control">
          <input type="checkbox" id="useOars" ${data.useOars ? "checked" : ""}/>

          <span class="calc-inline-note">${ship.sailing.oars.maxSpeed} уз. в штиль (≥${ship.sailing.oars.crewRequired} чел)</span>
        </div>
      </div>` : "";

    return `
<div class="zephyr-bg"></div>
<div class="zephyr-calc-wrap">
  <div class="zephyr-scroll">

    <!-- ═══ СЕКЦИЯ 1: УСЛОВИЯ ПЛАВАНИЯ ═══ -->
    <div class="zephyr-section">
      <div class="zephyr-section__title">⛵ Условия плавания</div>

      <!-- Компас курсов к ветру -->
      <div class="wind-compass-wrap">
        ${compassSVG}
        <div class="compass-label" id="courseLabel">${ZEPHYR_WIND_COURSES[data.windCourse]?.label ?? data.windCourse}</div>
      </div>
      <input type="hidden" id="windCourse" value="${data.windCourse}"/>

      <!-- Сила ветра -->
      <div style="margin-top:12px;">
        <div class="zephyr-section__title" style="font-size:0.7em; margin-bottom:6px; border:none; padding:0;">
          💨 Сила ветра
        </div>
        <div class="wind-btns">${windBtns}</div>
      </div>
      <input type="hidden" id="windForce" value="${data.windForce}"/>

      <!-- Волнение -->
      <div style="margin-top:10px;">
        <div class="zephyr-section__title" style="font-size:0.7em; margin-bottom:6px; border:none; padding:0;">
          🌊 Волнение моря
        </div>
        <div class="wave-btns">${waveBtns}</div>
      </div>
      <input type="hidden" id="waves" value="${data.waves}"/>
    </div>

    <!-- ═══ СЕКЦИЯ 2: ПАРАМЕТРЫ КОРАБЛЯ ═══ -->
    <div class="zephyr-section">
      <div class="zephyr-section__title">⚙️ Параметры корабля</div>

      <div class="calc-row">
        <div class="calc-label">Корабль:</div>
        <div class="calc-control">
          <select id="shipSelect">${shipsOptions}</select>
        </div>
      </div>

      <div id="shipInfo" class="ship-info">${this.getShipDescription(data.ship, data.cargo, data.crewCount || 0)}</div>

      <div class="calc-row">
        <div class="calc-label">Тип экипажа:</div>
        <div class="calc-control">
          <select id="crewType">${crewOptions}</select>
        </div>
      </div>

      <div class="calc-row">
        <div class="calc-label">Кол-во экипажа:</div>
        <div class="calc-control">
          <input type="number" id="crewCount" value="${data.crewCount || 8}" min="0" step="1" style="width:100px;"/>
        </div>
      </div>

      <div class="calc-row">
        <div class="calc-label">Доп. паруса:</div>
        <div class="calc-control">
          <select id="bonusSails">${sailsOptions}</select>
        </div>
      </div>

      <div class="calc-row">
        <div class="calc-label">Загрузка (т):</div>
        <div class="calc-control">
          <div class="cargo-slider">
            <input type="range" id="cargo" min="0" max="${maxCargo}" step="0.1" value="${data.cargo}">
            <div id="cargoValue" class="cargo-value">${data.cargo} т</div>
          </div>
        </div>
      </div>

      <div class="calc-row">
        <div class="calc-label">Штурвал ветра:</div>
        <div class="calc-control calc-inline-control">
          <input type="checkbox" id="helm" ${data.helm ? "checked" : ""}/>
          <span class="calc-inline-note">+5 узлов в любых условиях</span>
        </div>
      </div>

      ${oarsRow}
    </div>

    <!-- ═══ СЕКЦИЯ 3: МАРШРУТ ═══ -->
    <div class="zephyr-section">
      <div class="zephyr-section__title">📏 Маршрут</div>

      <div class="calc-row">
        <div class="calc-label">Режим:</div>
        <div class="calc-control">
          <select id="mode">
            <option value="distance" ${data.mode === "distance" ? "selected" : ""}>По дистанции</option>
            <option value="time" ${data.mode === "time" ? "selected" : ""}>По времени</option>
          </select>
        </div>
      </div>

      <div class="mode-distance" style="display:${data.mode === "distance" ? "block" : "none"}">
        <div class="calc-row">
          <div class="calc-label">Дистанция:</div>
          <div class="calc-control calc-inline-control">
            <input type="number" id="distance" value="${data.distance}" min="0" step="1" style="width:100px;"/>
            <select id="unit" style="width:130px;">
              <option value="km" ${data.unit === "km" ? "selected" : ""}>Километры</option>
              <option value="mi" ${data.unit === "mi" ? "selected" : ""}>Морские мили</option>
            </select>
          </div>
        </div>
      </div>

      <div class="mode-time" style="display:${data.mode === "time" ? "block" : "none"}">
        <div class="calc-row">
          <div class="calc-label">Время (ч):</div>
          <div class="calc-control">
            <input type="number" id="time" value="${data.time}" min="0" step="0.5" style="width:100px;"/>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ РЕЗУЛЬТАТЫ ═══ -->
    <div class="zephyr-section">
      <div class="zephyr-section__title">📊 Результаты</div>
      <div id="calcResult" class="result-panel">
        <div class="result-card">
          <div class="label">Скорость</div>
          <div class="value" id="res-speed">—</div>
          <div class="sub" id="res-ft">—</div>
        </div>
        <div class="result-card">
          <div class="label">Дистанция / Время</div>
          <div class="value" id="res-dist">—</div>
          <div class="sub" id="res-extra">—</div>
        </div>
        <div class="result-card">
          <div class="label">Манёвренность</div>
          <div class="value" id="res-mano">—</div>
          <div class="sub" id="res-radius">—</div>
        </div>
        <div class="result-card">
          <div class="label">Загрузка / Экипаж</div>
          <div class="value" id="res-cargo">—</div>
          <div class="sub" id="res-crew">—</div>
        </div>
      </div>
    </div>

  </div><!-- end .zephyr-scroll -->
</div><!-- end .zephyr-calc-wrap -->`;
  }

  initializeEventHandlers(html) {
    const recalcAndQueueSave = () => {
      this.calculate(html);
      this.scheduleSave(html);
    };

    // ── Компас: клик по сектору ──────────────────────────────────────
    html.on("click", ".compass-sector", (e) => {
      const course = $(e.currentTarget).data("course");
      if (!course) return;
      html.find("#windCourse").val(course);
      html.find(".compass-sector").removeClass("active");
      $(e.currentTarget).addClass("active");
      html.find("#courseLabel").text(ZEPHYR_WIND_COURSES[course]?.label ?? course);
      recalcAndQueueSave();
    });

    // ── Кнопки ветра ─────────────────────────────────────────────────
    html.on("click", ".wind-btn", (e) => {
      const wind = $(e.currentTarget).data("wind");
      if (!wind) return;
      html.find("#windForce").val(wind);
      html.find(".wind-btn").removeClass("active");
      $(e.currentTarget).addClass("active");

      // Автосинхронизация волнения
      const autoWave = { calm: "calm", weak: "ripple", normal: "wave", strong: "stwave", storm: "storm" };
      const newWave = autoWave[wind];
      if (newWave) {
        html.find("#waves").val(newWave);
        html.find(".wave-btn").removeClass("active");
        html.find(`.wave-btn[data-wave="${newWave}"]`).addClass("active");
      }
      recalcAndQueueSave();
    });

    // ── Кнопки волнения ───────────────────────────────────────────────
    html.on("click", ".wave-btn", (e) => {
      const wave = $(e.currentTarget).data("wave");
      if (!wave) return;
      html.find("#waves").val(wave);
      html.find(".wave-btn").removeClass("active");
      $(e.currentTarget).addClass("active");
      recalcAndQueueSave();
    });

    // ── Обычные контролы ─────────────────────────────────────────────
    html.find("#mode").on("change", () => {
      this.updateMode(html);
      recalcAndQueueSave();
    });

    html.find("#shipSelect").on("change", () => {
      this.updateShip(html);
      recalcAndQueueSave();
    });

    html.find("#cargo").on("input change", () => {
      const v = parseFloat(html.find("#cargo").val()) || 0;
      html.find("#cargoValue").text(`${v.toFixed(1)} т`);
      this.updateShipInfo(html);
      recalcAndQueueSave();
    });

    html.find("#crewCount").on("input change", () => {
      this.updateCargoLimits(html);
      this.updateShipInfo(html);
      recalcAndQueueSave();
    });

    html.find("#crewType, #bonusSails, #helm, #distance, #time, #unit")
      .on("input change", () => recalcAndQueueSave());

    html.on("change", "#useOars", () => recalcAndQueueSave());

    this.updateMode(html);
    this.updateCargoLimits(html);
    this.calculate(html);
  }

  updateMode(html) {
    const mode = html.find("#mode").val();
    html.find(".mode-distance").toggle(mode === "distance");
    html.find(".mode-time").toggle(mode === "time");
  }

  updateShip(html) {
    const shipId = html.find("#shipSelect").val();
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    if (!ship) return;

    const currentCourse = html.find("#windCourse").val();
    const currentBonusSails = html.find("#bonusSails").val();
    const currentUseOars = html.find("#useOars").is(":checked");
    const shipCourses = ship.sailing?.availableCourses || Object.keys(ZEPHYR_WIND_COURSES);

    // Перестраиваем компас под новый корабль
    const selectedCourse = shipCourses.includes(currentCourse) ? currentCourse : shipCourses[0];
    const compassWrap = html.find(".wind-compass-wrap");
    const compassSVG = this._buildCompassSVG(shipCourses, selectedCourse);
    compassWrap.html(`${compassSVG}<div class="compass-label" id="courseLabel">${ZEPHYR_WIND_COURSES[selectedCourse]?.label ?? selectedCourse}</div>`);
    html.find("#windCourse").val(selectedCourse);

    // Доп. паруса
    const availableSails = this.getAvailableBonusSails(shipId);
    const bonusSailsSelect = html.find("#bonusSails");
    bonusSailsSelect.empty();
    Object.entries(availableSails).forEach(([k, s]) => {
      bonusSailsSelect.append(`<option value="${k}">${s.label}</option>`);
    });
    if (Object.prototype.hasOwnProperty.call(availableSails, currentBonusSails)) {
      bonusSailsSelect.val(currentBonusSails);
    }

    this.updateOarsOption(html, shipId);
    if (ship.sailing?.oars?.available) {
      html.find("#useOars").prop("checked", currentUseOars);
    }

    this.updateCargoLimits(html);
    this.updateShipInfo(html);
  }

  updateOarsOption(html, shipId) {
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    const hasOars = ship?.sailing?.oars?.available;
    const existingOarsRow = html.find(".oars-row");

    if (hasOars && existingOarsRow.length === 0) {
      const oarsHTML = `
      <div class="calc-row oars-row">
        <div class="calc-label">Весла:</div>
        <div class="calc-control calc-inline-control">
          <input type="checkbox" id="useOars"/>
          <span class="calc-inline-note">${ship.sailing.oars.maxSpeed} уз. в штиль (≥${ship.sailing.oars.crewRequired} чел)</span>
        </div>
      </div>`;
      html.find("#helm").closest(".calc-row").after(oarsHTML);
    } else if (!hasOars && existingOarsRow.length > 0) {
      existingOarsRow.remove();
    }
  }

  updateCargoLimits(html) {
    const shipId = html.find("#shipSelect").val();
    const crewCount = parseInt(html.find("#crewCount").val() || 0, 10);
    const maxCargoTotal = this.getShipMaxCargo(shipId);
    const crewWeight = (crewCount * ZEPHYR_AVG_CREW_WEIGHT_KG) / 1000.0;
    const sliderMax = Math.max(0, maxCargoTotal - crewWeight);

    const cargoEl = html.find("#cargo");
    cargoEl.attr("max", sliderMax);

    let cargoVal = parseFloat(cargoEl.val() || 0);
    if (cargoVal > sliderMax) {
      cargoVal = sliderMax;
      cargoEl.val(cargoVal);
    }

    if (crewWeight >= maxCargoTotal) {
      cargoEl.prop("disabled", true);
      cargoEl.val(0);
      html.find("#cargoValue").text("0.0 т");
    } else {
      cargoEl.prop("disabled", false);
      html.find("#cargoValue").text(`${cargoVal.toFixed(1)} т`);
    }
  }

  updateShipInfo(html) {
    const shipId = html.find("#shipSelect").val();
    const cargo = parseFloat(html.find("#cargo").val()) || 0;
    const crewCount = parseInt(html.find("#crewCount").val() || 0, 10);
    html.find("#shipInfo").html(this.getShipDescription(shipId, cargo, crewCount));
  }

  getFormData(html) {
    const shipId = html.find("#shipSelect").val();
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    const hasOars = !!(ship?.sailing?.oars?.available);

    return {
      ship: shipId,
      mode: html.find("#mode").val(),
      distance: parseFloat(html.find("#distance").val()) || 0,
      time: parseFloat(html.find("#time").val()) || 0,
      unit: html.find("#unit").val(),
      windCourse: html.find("#windCourse").val(),
      windForce: html.find("#windForce").val(),
      waves: html.find("#waves").val(),
      bonusSails: html.find("#bonusSails").val(),
      crewType: html.find("#crewType").val(),
      crewCount: parseInt(html.find("#crewCount").val() || 0, 10),
      helm: !!html.find("#helm")[0]?.checked,
      cargo: parseFloat(html.find("#cargo").val()) || 0,
      useOars: hasOars ? !!html.find("#useOars")[0]?.checked : false
    };
  }

  calculate(html) {
    try {
      const data = this.getFormData(html);
      const result = this.calculator.calculateTravelFromData(data);
      this.displayResultCompact(html, result, result.input);
    } catch (e) {
      html.find("#calcResult").html(`<div style="color:#ff6b6b;">Ошибка: ${e.message}</div>`);
    }
  }

  displayResultCompact(html, result, data) {
    html.find("#res-speed").text(`${result.speed.toFixed(2)} уз.`);
    html.find("#res-ft").text(`${result.ftPerRound.toFixed(0)} фт/раунд`);

    if (data.mode === "distance") {
      html.find("#res-dist").text(`${data.distance} ${data.unit === "km" ? "км" : "миль"}`);
      html.find("#res-extra").text(`${result.time.days}д ${result.time.hours}ч ${result.time.minutes}м`);
    } else {
      html.find("#res-dist").text(`${result.distanceKm.toFixed(1)} км`);
      html.find("#res-extra").text(`${result.distanceMi.toFixed(1)} миль`);
    }

    html.find("#res-mano").text(`${(result.shipState.maneuverability * 100).toFixed(0)}%`);
    html.find("#res-radius").text(`≈ ${Math.round(result.shipState.turnRadiusFt)} фт`);
    html.find("#res-cargo").text(`${result.shipState.effectiveCargo.toFixed(2)} т / ${this.getShipMaxCargo(data.ship)} т`);
    html.find("#res-crew").text(`${data.crewCount} чел (≈ ${result.shipState.crewWeightTons.toFixed(2)} т)`);
  }

  calculateAndSend(html) {
    const data = this.getFormData(html);
    const result = this.calculator.calculateTravelFromData(data);
    this.pendingLastInput = result.input;
    this.flushPendingSave();
    this.chatRenderer.sendToChat(result.input, result);
    ui.notifications.info("Результаты отправлены в чат!");
    this.focusDialog();
  }
}
