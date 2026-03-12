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

    // Внутреннее состояние компаса для UI (8 румбов)
    this.uiState = {
      windDir: 0,   // Направление ветра (0=N, 45=NE ... 315=NW)
      shipDir: 90   // Направление движения корабля
    };
  }

  getDialogElement() {
    if (!this.dialog) return null;
    const el = this.dialog.element?.[0] ?? this.dialog.element;
    if (el instanceof HTMLElement) return el;
    if (!this.dialog?.appId) return null;
    return document.querySelector(`[data-appid="${this.dialog.appId}"]`);
  }

  render() {
    if (this.dialog) {
      this.focusDialog();
      return;
    }

    // Инициализируем uiState из lastData (или по умолчанию)
    const data = this.calculator.normalizeInput(this.calculator.lastData || {});
    // Попытка восстановить направления (если они были сохранены в data, для обратной совместимости ставим дефолт)
    this.uiState.windDir = data.windDir ?? 0;
    this.uiState.shipDir = data.shipDir ?? 90;

    const content = this.createDialogContent(data);
    const defaults = (typeof this.calculator.getDefaultWindowSettings === "function")
      ? this.calculator.getDefaultWindowSettings()
      : { width: 980, height: 750, top: null, left: null };
    const ws = { ...defaults, ...(this.calculator.windowSettings || {}) };
    const options = {
      width: ws.width || defaults.width,
      height: ws.height || defaults.height,
      resizable: true,
      classes: ["zephyr-calculator", "flexcol"]
    };

    if (Number.isFinite(ws.top)) options.top = ws.top;
    if (Number.isFinite(ws.left)) options.left = ws.left;
    options.position = {
      width: options.width,
      height: options.height,
      ...(Number.isFinite(ws.top) ? { top: ws.top } : {}),
      ...(Number.isFinite(ws.left) ? { left: ws.left } : {}),
      resizable: true
    };

    this.dialog = new Dialog({
      title: "🧭 Калькулятор морского перехода",
      content,
      buttons: {},
      render: html => this.initializeEventHandlers(html),
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

  getAvailableBonusSails(shipId) {
    return this.calculator.getAvailableBonusSails(shipId);
  }

  getShipMaxCargo(shipId) {
    return this.calculator.getShipMaxCargo(shipId);
  }

  getShipDescription(shipId, cargoTons = 0, crewCount = 0) {
    return this.calculator.getShipDescription(shipId, cargoTons, crewCount);
  }

  // ==== ЛОГИКА КОМПАСА И УГЛОВ ====

  // Расчет курса (windCourse) на основе разницы углов ветра и корабля
  calculateWindCourse(windDir, shipDir, shipId) {
    // Находим абсолютную разницу в углах
    let delta = Math.abs(windDir - shipDir) % 360;
    if (delta > 180) delta = 360 - delta;
    // delta теперь от 0 до 180 (угол атаки ветра)
    // 0 = встречный ветер, 180 = попутный

    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    const baseCourses = ship?.sailing?.availableCourses || Object.keys(ZEPHYR_WIND_COURSES);
    const courseSet = new Set(baseCourses);
    if (ZEPHYR_WIND_COURSES?.["0-dead"]) courseSet.add("0-dead");

    const candidates = Array.from(courseSet).map(key => ({
      key,
      angle: ZEPHYR_WIND_COURSES?.[key]?.angle
    })).filter(c => Number.isFinite(c.angle));

    if (!candidates.length) return "90-cross";

    let best = candidates[0].key;
    let bestDiff = Math.abs(delta - candidates[0].angle);
    for (let i = 1; i < candidates.length; i++) {
      const diff = Math.abs(delta - candidates[i].angle);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = candidates[i].key;
      }
    }

    return best;
  }

  // Отрисовка двухслойной розы ветров
  _buildDualCompassSVG(windDir, shipDir) {
    const cx = 110, cy = 110;
    const outerR = 100, innerR = 65, centerR = 30;

    const windDirs = [
      { a: 0, label: "N" }, { a: 45, label: "NE" }, { a: 90, label: "E" }, { a: 135, label: "SE" },
      { a: 180, label: "S" }, { a: 225, label: "SW" }, { a: 270, label: "W" }, { a: 315, label: "NW" }
    ];

    const shipDirs = [
      { a: 0, label: "N" }, { a: 15, label: "" }, { a: 30, label: "" }, { a: 45, label: "NE" },
      { a: 60, label: "" }, { a: 75, label: "" }, { a: 90, label: "E" }, { a: 105, label: "" },
      { a: 120, label: "" }, { a: 135, label: "SE" }, { a: 150, label: "" }, { a: 165, label: "" },
      { a: 180, label: "S" }, { a: 195, label: "" }, { a: 210, label: "" }, { a: 225, label: "SW" },
      { a: 240, label: "" }, { a: 255, label: "" }, { a: 270, label: "W" }, { a: 285, label: "" },
      { a: 300, label: "" }, { a: 315, label: "NW" }, { a: 330, label: "" }, { a: 345, label: "" }
    ];

    function polarToXY(angleDeg, radius) {
      // svg 0 = top (N)
      const rad = (angleDeg - 90) * Math.PI / 180;
      return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
    }

    function drawRing(dirs, curAngle, type, rOut, rIn, fillBase, fillActive, stepDeg) {
      let html = "";
      const half = stepDeg / 2;
      dirs.forEach(d => {
        const start = d.a - half;
        const end = d.a + half;
        const isActive = (d.a === curAngle);
        
        const p1 = polarToXY(start, rOut);
        const p2 = polarToXY(end, rOut);
        const p3 = polarToXY(end, rIn);
        const p4 = polarToXY(start, rIn);

        // SVG Path for an arc slice
        const path = `M ${p1.x} ${p1.y} A ${rOut} ${rOut} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rIn} ${rIn} 0 0 0 ${p4.x} ${p4.y} Z`;
        
        // Label position
        const mid = polarToXY(d.a, (rOut + rIn) / 2);
        
        html += `<g class="compass-sector ${isActive ? 'active' : ''}" data-type="${type}" data-angle="${d.a}">
          <path d="${path}" fill="${isActive ? fillActive : fillBase}" stroke="#b8905c" stroke-width="1"/>
          <text x="${mid.x}" y="${mid.y + 4}" text-anchor="middle" font-size="10" fill="${isActive ? '#fff' : '#e8d5b5'}" font-weight="bold">${d.label}</text>
        </g>`;
      });
      return html;
    }

    const outerRing = drawRing(windDirs, windDir, "wind", outerR, innerR, "rgba(20, 15, 10, 0.7)", "rgba(100, 160, 200, 0.6)", 45);
    const innerRing = drawRing(shipDirs, shipDir, "ship", innerR, centerR, "rgba(40, 30, 20, 0.8)", "rgba(200, 100, 50, 0.6)", 15);

    // Рисуем стрелку ветра (откуда дует)
    // Ветер N (0) дует С СЕВЕРА НА ЮГ. Угол стрелки = windDir + 180
    const wArrowAngle = (windDir + 180) % 360;
    const wArrowTail = polarToXY(windDir, outerR - 5);
    const wArrowHead = polarToXY(windDir, centerR + 5);

    // Рисуем стрелку корабля (куда плывет)
    const sArrowHead = polarToXY(shipDir, innerR - 5);
    const sArrowTail = polarToXY((shipDir + 180) % 360, centerR + 5);

    return `
      <div class="compass-wrapper">
        <svg class="compass-svg" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="rgba(10,5,0,0.5)" stroke="#dcb881" stroke-width="2"/>
          ${outerRing}
          ${innerRing}
          <circle cx="${cx}" cy="${cy}" r="${centerR}" fill="#2a1c14" stroke="#dcb881" stroke-width="1"/>
          
          <!-- Ship Arrow -->
          <line class="compass-arrow compass-arrow--ship" x1="${sArrowTail.x}" y1="${sArrowTail.y}" x2="${sArrowHead.x}" y2="${sArrowHead.y}" stroke="#dcb881" stroke-width="4" stroke-linecap="round"/>
          <circle class="compass-arrow-head compass-arrow-head--ship" cx="${sArrowHead.x}" cy="${sArrowHead.y}" r="4" fill="#ffb24a"/>

          <!-- Wind Arrow -->
          <line class="compass-arrow compass-arrow--wind" x1="${wArrowTail.x}" y1="${wArrowTail.y}" x2="${wArrowHead.x}" y2="${wArrowHead.y}" stroke="#9ff0ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="5,3"/>
          
          <text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="12" fill="#dcb881">🧭</text>
        </svg>
      </div>`;
  }

  createDialogContent(data) {
    const ship = ZEPHYR_SHIPS_LIBRARY[data.ship];

    if (!ship) {
      return `<div class="zephyr-bg"></div><div class="zephyr-calc-wrap"><div class="zephyr-scroll">
        <div class="zephyr-section"><p style="color:#ff6b6b;">Ошибка: корабль не найден</p></div>
      </div></div>`;
    }

    const availableSails = this.getAvailableBonusSails(data.ship);
    const maxCargo = this.getShipMaxCargo(data.ship);

    // Доп. паруса
    const sailsOptions = Object.entries(availableSails).map(([k, s]) =>
      `<option value="${k}" ${data.bonusSails === k ? "selected" : ""}>${s.label}</option>`
    ).join("");

    // Корабли
    const shipsOptions = Object.values(ZEPHYR_SHIPS_LIBRARY).map(s =>
      `<option value="${s.id}" ${data.ship === s.id ? "selected" : ""}>${s.name}</option>`
    ).join("");

    const crewOptions = Object.entries(ZEPHYR_CREW_MODIFIERS).map(([k, c]) =>
      `<option value="${k}" ${data.crewType === k ? "selected" : ""}>${c.label}</option>`
    ).join("");

    // ── Кнопки ветра + волнения (связанные) ──
    const windData = [
      { id: "calm", icon: "🌫️", label: "Штиль", sub: "<5 уз." },
      { id: "weak", icon: "🍃", label: "Бриз", sub: "5-10 уз." },
      { id: "normal", icon: "💨", label: "Свежий", sub: "10-20 уз." },
      { id: "strong", icon: "🌬️", label: "Крепкий", sub: "20-40 уз." },
      { id: "storm", icon: "⛈️", label: "Шторм", sub: ">40 уз." }
    ];

    const waveData = [
      { id: "calm", icon: "〰️", label: "Штиль", sub: "0-0.5 м" },
      { id: "ripple", icon: "🌊", label: "Рябь", sub: "0.5-1 м" },
      { id: "wave", icon: "🌊🌊", label: "Волнение", sub: "1-2 м" },
      { id: "stwave", icon: "🌊🌊🌊", label: "Шторм", sub: "2-4 м" },
      { id: "storm", icon: "🌀", label: "Ураган", sub: "4-8+ м" }
    ];

    const windToWaveMap = { calm: "calm", weak: "ripple", normal: "wave", strong: "stwave", storm: "storm" };
    const derivedWaves = windToWaveMap[data.windForce] || data.waves || "calm";
    const windSeaBtns = windData.map(w => {
      const waveId = windToWaveMap[w.id] || "calm";
      const wave = waveData.find(entry => entry.id === waveId) || waveData[0];
      return `<div class="wbtn wbtn--windsea windsea-btn ${data.windForce === w.id ? "active" : ""}" data-wind="${w.id}" data-wave="${waveId}">
        <div class="wbtn-icon">${w.icon}</div>
        <div class="wbtn-label">${w.label}</div>
        <div class="wbtn-sub">${w.sub}</div>
        <div class="wbtn-wave">Волны: ${wave.sub}</div>
      </div>`;
    }).join("");

    return `
<div class="zephyr-bg"></div>
<div class="zephyr-calc-wrap">
  <div class="zephyr-scroll">
    <div class="zephyr-layout-cols">

      <!-- ═══ ЛЕВАЯ КОЛОНКА: КОРАБЛЬ ═══ -->
      <div class="zephyr-col">
        <div class="zephyr-section">
          <div class="zephyr-section__title">⚙️ Параметры корабля</div>

          <div class="calc-row">
            <div class="calc-label">Корабль:</div>
            <div class="calc-control">
              <select id="shipSelect" style="width:100%">${shipsOptions}</select>
            </div>
          </div>

          <div id="shipInfo" class="ship-info">${this.getShipDescription(data.ship, data.cargo, data.crewCount || 0)}</div>

          <div class="calc-row">
            <div class="calc-label">Тип экипажа:</div>
            <div class="calc-control">
              <select id="crewType" style="width:100%">${crewOptions}</select>
            </div>
          </div>

          <div class="calc-row">
            <div class="calc-label">Экипаж (чел):</div>
            <div class="calc-control">
              <input type="number" id="crewCount" value="${data.crewCount || 8}" min="0" step="1" style="width:80px;"/>
            </div>
          </div>

          <div class="calc-row">
            <div class="calc-label">Доп. паруса:</div>
            <div class="calc-control">
              <select id="bonusSails" style="width:100%">${sailsOptions}</select>
            </div>
          </div>

          <div class="calc-row">
            <div class="calc-label">Груз:</div>
            <div class="calc-control">
              <div class="cargo-slider">
                <input type="range" id="cargo" min="0" max="${maxCargo}" step="0.1" value="${data.cargo}">
                <div id="cargoValue" class="cargo-value">${data.cargo} т</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ ПРАВАЯ КОЛОНКА: НАВИГАЦИЯ ═══ -->
      <div class="zephyr-col">
        <div class="zephyr-section">
          <div class="zephyr-section__title">🧭 Навигация и Погода</div>

          <div class="calc-row">
            <div class="calc-label">Режим расчёта:</div>
            <div class="calc-control">
              <select id="mode" style="width:100%">
                <option value="distance" ${data.mode === "distance" ? "selected" : ""}>По расстоянию</option>
                <option value="time" ${data.mode === "time" ? "selected" : ""}>По времени</option>
              </select>
            </div>
          </div>

          <div class="mode-distance" style="display:${data.mode === "distance" ? "block" : "none"}; margin-bottom: 8px;">
            <div class="calc-row">
              <div class="calc-label">Дистанция:</div>
              <div class="calc-control">
                <input type="number" id="distance" value="${data.distance}" min="0" step="1" style="width:80px;"/>
                <select id="unit" style="width:90px;">
                  <option value="km" ${data.unit === "km" ? "selected" : ""}>км</option>
                  <option value="mi" ${data.unit === "mi" ? "selected" : ""}>миль</option>
                </select>
              </div>
            </div>
          </div>

          <div class="mode-time" style="display:${data.mode === "time" ? "block" : "none"}; margin-bottom: 8px;">
            <div class="calc-row">
              <div class="calc-label">Время (часов):</div>
              <div class="calc-control">
                <input type="number" id="time" value="${data.time}" min="0" step="0.5" style="width:80px;"/>
              </div>
            </div>
          </div>

          <div class="compass-container">
            <div class="compass-hint">Внешний круг: Ветер. Внутренний: Движение.</div>
            <div id="compassRenderArea">
              ${this._buildDualCompassSVG(this.uiState.windDir, this.uiState.shipDir)}
            </div>
            <!-- Скрытые технические данные -->
            <div class="course-line">
              Курс к ветру: <span id="derivedCourseLabel">${ZEPHYR_WIND_COURSES[data.windCourse]?.label ?? data.windCourse}</span>
            </div>
            <input type="hidden" id="windCourse" value="${data.windCourse}"/>
          </div>

          <div class="calc-row helm-row">
            <div class="calc-control helm-toggle">
              <input type="checkbox" id="helm" ${data.helm ? "checked" : ""}/>
              <label for="helm">Корабельный штурвал (+5 узлов)</label>
            </div>
          </div>

          <div class="section-subtitle">Ветер и волны</div>
          <div class="wbtn-group windsea-group">${windSeaBtns}</div>
          <input type="hidden" id="windForce" value="${data.windForce}"/>
          <input type="hidden" id="waves" value="${derivedWaves}"/>

        </div>
      </div>

    </div> <!-- End Columns Layout -->

    <div class="calc-actions">
      <button type="button" class="zephyr-action-btn" id="sendToChat">
        <i class='fas fa-ship'></i> Рассчитать и отправить в чат
      </button>
    </div>

    <!-- ═══ СЕКЦИЯ РЕЗУЛЬТАТОВ (На всю ширину внизу) ═══ -->
    <div class="zephyr-results zephyr-section">
      <div id="calcResult" class="result-panel">
        <div class="result-card">
          <div class="label">Загрузка / Экипаж</div>
          <div class="value" id="res-cargo">—</div>
          <div class="sub" id="res-crew">—</div>
        </div>
        <div class="result-card">
          <div class="label">Манёвренность</div>
          <div class="value" id="res-mano">—</div>
          <div class="sub" id="res-radius">—</div>
        </div>
        <div class="result-card">
          <div class="label">Пройдено / Затрачено</div>
          <div class="value" id="res-dist">—</div>
          <div class="sub" id="res-extra">—</div>
        </div>
        <div class="result-card">
          <div class="label">Скорость</div>
          <div class="value" id="res-speed">—</div>
          <div class="sub" id="res-ft">—</div>
        </div>
      </div>
    </div>

  </div> <!-- end scroll -->
</div> <!-- end wrapper -->`;
  }

  initializeEventHandlers(html) {
    const recalcAndQueueSave = () => {
      this.calculate(html);
      this.scheduleSave(html);
    };

    // ── Компас (Клик по внешнему/внутреннему кругу) ────────────────
    html.on("click", ".compass-sector", (e) => {
      const el = $(e.currentTarget);
      const angle = parseInt(el.data("angle"), 10);
      const type = el.data("type"); // 'wind' или 'ship'

      if (type === "wind") this.uiState.windDir = angle;
      if (type === "ship") this.uiState.shipDir = angle;

      // Вычисляем новый windCourse
      const shipId = html.find("#shipSelect").val();
      const newCourse = this.calculateWindCourse(this.uiState.windDir, this.uiState.shipDir, shipId);
      
      html.find("#windCourse").val(newCourse);
      html.find("#derivedCourseLabel").text(ZEPHYR_WIND_COURSES[newCourse]?.label ?? newCourse);

      // Перерисовываем компас (используя HTML замену внутри контейнера)
      const compassArea = html.find("#compassRenderArea");
      compassArea.html(this._buildDualCompassSVG(this.uiState.windDir, this.uiState.shipDir));
      
      recalcAndQueueSave();
    });

    html.find("#sendToChat").on("click", () => {
      this.calculateAndSend(html);
    });

    // ── Кнопки ветра + волн (связанные) ─────────────────────────────
    html.on("click", ".windsea-btn", (e) => {
      const btn = $(e.currentTarget);
      const windVal = btn.data("wind");
      const waveVal = btn.data("wave");
      if (!windVal || !waveVal) return;

      html.find("#windForce").val(windVal);
      html.find("#waves").val(waveVal);

      btn.siblings(".windsea-btn").removeClass("active");
      btn.addClass("active");

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

    // Сброс и проверка доступности курсов при смене судна
    const newCourse = this.calculateWindCourse(this.uiState.windDir, this.uiState.shipDir, shipId);
    html.find("#windCourse").val(newCourse);
    html.find("#derivedCourseLabel").text(ZEPHYR_WIND_COURSES[newCourse]?.label ?? newCourse);

    const currentBonusSails = html.find("#bonusSails").val();
    const currentUseOars = html.find("#useOars").is(":checked");

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

    this.updateCargoLimits(html);
    this.updateShipInfo(html);
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
      useOars: hasOars ? !!html.find("#useOars")[0]?.checked : false,
      windDir: this.uiState.windDir,
      shipDir: this.uiState.shipDir
    };
  }

  calculate(html) {
    try {
      const data = this.getFormData(html);
      const result = this.calculator.calculateTravelFromData(data);
      this.displayResultCompact(html, result, result.input);
    } catch (e) {
      html.find("#calcResult").html(`<div style="color:#ff6b6b; padding:10px;">Ошибка: ${e.message}</div>`);
    }
  }

  displayResultCompact(html, result, data) {
    html.find("#res-speed").text(`${result.speed.toFixed(2)} уз.`);
    html.find("#res-ft").text(`${result.ftPerRound.toFixed(0)} фт/раунд`);

    if (data.mode === "distance") {
      html.find("#res-dist").text(`${data.distance} ${data.unit === "km" ? "км" : "миль"}`);
      html.find("#res-extra").text(`${result.time.days}д ${result.time.hours}ч ${result.time.minutes}м`);
    } else {
      html.find("#res-dist").text(`${result.distanceKm.toFixed(1)} км / ${result.distanceMi.toFixed(1)} миль`);
      html.find("#res-extra").text(`${result.timeHours} ч.`);
    }

    html.find("#res-mano").text(`≈ ${Math.round(result.shipState.turnRadiusFt)} фт`);
    html.find("#res-radius").text(`${(result.shipState.maneuverability * 100).toFixed(0)}%`);
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
