class TravelCalculatorUI {
  constructor(calculator) {
    this.calculator = calculator;
    this.dialog = null;
    this.resizeObserver = null;
    this.chatRenderer = new ChatRenderer();

    this.saveDebounceMs = 300;
    this.pendingSaveTimer = null;
    this.pendingLastInput = null;

    this.windowSaveDebounceMs = 250;
    this.pendingWindowSaveTimer = null;
    this.pendingWindowSettings = null;

    this.trackedWindowElement = null;
    this.onWindowMouseUp = null;

    // Внутреннее состояние компаса для UI (8 румбов)
    this.uiState = {
      windDir: 0,   // Направление ветра (0=N, 45=NE ... 315=NW)
      shipDir: 90   // Направление движения корабля
    };
  }

  t(key, vars) {
    if (typeof zephyrT === "function") return zephyrT(key, vars);
    return key;
  }

  label(obj, key = "label", fallback = "") {
    if (typeof zephyrLabel === "function") return zephyrLabel(obj, key, fallback);
    return obj?.[key] ?? fallback;
  }

  getUnitLabel(unit) {
    return unit === "km" ? this.t("UNIT_KM") : this.t("UNIT_NMI");
  }

  getWindCourseLabel(key) {
    const course = ZEPHYR_WIND_COURSES?.[key];
    return this.label(course, "label", key);
  }

  buildOarsBlock(shipId, useOars) {
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    const oars = ship?.sailing?.oars;
    if (!oars?.available) return "";
    const hint = this.t("OARS_HINT", { max: oars.maxSpeed, crew: oars.crewRequired });
    const hintExtra = this.t("OARS_HINT_PARTIAL");
    return `
      <div class="calc-row oars-row">
        <div class="calc-control helm-toggle oars-toggle">
          <input type="checkbox" id="useOars" ${useOars ? "checked" : ""}/>
          <label for="useOars">
            ${this.t("OARS_LABEL")}
            <span class="oars-meta">(${hint})</span>
            <span class="oars-note">${hintExtra}</span>
          </label>
        </div>
      </div>
    `;
  }

  updateOarsBlock(html, shipId, useOars) {
    const container = html.find("#oarsContainer");
    if (!container.length) return;
    container.html(this.buildOarsBlock(shipId, useOars));
  }

  scheduleWindowSave(settings) {
    this.pendingWindowSettings = settings;
    if (this.pendingWindowSaveTimer) clearTimeout(this.pendingWindowSaveTimer);
    this.pendingWindowSaveTimer = setTimeout(() => this.flushWindowSave(), this.windowSaveDebounceMs);
  }

  flushWindowSave() {
    if (this.pendingWindowSaveTimer) {
      clearTimeout(this.pendingWindowSaveTimer);
      this.pendingWindowSaveTimer = null;
    }
    if (!this.pendingWindowSettings) return;
    this.calculator.saveWindowSettings(this.pendingWindowSettings);
    this.pendingWindowSettings = null;
  }

  rerenderWithLanguage() {
    if (!this.dialog) return;
    try {
      const dialogElement = this.getDialogElement();
      if (!dialogElement) return;
      const html = $(dialogElement);
      const data = this.getFormData(html);
      this.calculator.lastData = this.calculator.normalizeInput(data);
      this.dialog.close();
      setTimeout(() => this.render(), 0);
    } catch (e) {
      console.warn("Zephyr: failed to rerender calculator after language change", e);
    }
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
      : { width: 1200, height: 760, top: null, left: null };
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
      title: this.t("CALC_TITLE"),
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
    this.scheduleWindowSave(settings);
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
    this.flushWindowSave();
    this.teardownWindowTracking();
    this.dialog = null;
  }

  applyMinWindowHeight() {
    const dialogElement = this.getDialogElement();
    if (!dialogElement) return;
    const scrollEl = dialogElement.querySelector(".zephyr-scroll");
    const headerEl = dialogElement.querySelector(".window-header");
    if (!scrollEl) return;
    const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0;
    const children = Array.from(scrollEl.children || []);
    let contentH = 0;
    if (children.length) {
      children.forEach(child => {
        const rect = child.getBoundingClientRect();
        const styles = getComputedStyle(child);
        const marginTop = parseFloat(styles.marginTop) || 0;
        const marginBottom = parseFloat(styles.marginBottom) || 0;
        contentH += rect.height + marginTop + marginBottom;
      });
    } else {
      contentH = scrollEl.scrollHeight;
    }
    const paddingY = 24;
    const minH = Math.ceil(headerH + contentH + paddingY);
    dialogElement.style.minHeight = `${minH}px`;
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
    const outerR = 100, innerR = 70, centerR = 18;

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
    const wArrowTail = polarToXY(windDir, outerR + 8);
    const wArrowHead = polarToXY(windDir, innerR + 6);

    // Рисуем стрелку корабля (куда плывет)
    const sArrowHead = polarToXY(shipDir, innerR - 6);
    const sArrowTail = polarToXY(shipDir, centerR + 2);

    return `
      <div class="compass-wrapper">
        <svg class="compass-svg" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="zephyr-wind-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L6,3 L0,6 Z" fill="#9ff0ff"/>
            </marker>
            <marker id="zephyr-ship-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L7,3.5 L0,7 Z" fill="#ffb24a"/>
            </marker>
          </defs>
          <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="rgba(10,5,0,0.5)" stroke="#dcb881" stroke-width="2"/>
          ${outerRing}
          ${innerRing}
          <circle cx="${cx}" cy="${cy}" r="${centerR}" fill="#2a1c14" stroke="#dcb881" stroke-width="1"/>
          
          <!-- Ship Arrow -->
          <line class="compass-arrow compass-arrow--ship" x1="${sArrowTail.x}" y1="${sArrowTail.y}" x2="${sArrowHead.x}" y2="${sArrowHead.y}" stroke="#dcb881" stroke-width="4" stroke-linecap="round" marker-end="url(#zephyr-ship-arrow)"/>

          <!-- Wind Arrow -->
          <line class="compass-arrow compass-arrow--wind" x1="${wArrowTail.x}" y1="${wArrowTail.y}" x2="${wArrowHead.x}" y2="${wArrowHead.y}" stroke="#9ff0ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="5,3" marker-end="url(#zephyr-wind-arrow)"/>
          
          <text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="12" fill="#dcb881">🧭</text>
        </svg>
      </div>`;
  }

  createDialogContent(data) {
    const t = (key, vars) => this.t(key, vars);
    const ship = ZEPHYR_SHIPS_LIBRARY[data.ship];

    if (!ship) {
      return `<div class="zephyr-bg"></div><div class="zephyr-calc-wrap"><div class="zephyr-scroll">
        <div class="zephyr-section"><p style="color:#ff6b6b;">${t("SHIP_NOT_FOUND")}</p></div>
      </div></div>`;
    }

    const availableSails = this.getAvailableBonusSails(data.ship);
    const maxCargo = this.getShipMaxCargo(data.ship);
    const oarsBlock = this.buildOarsBlock(data.ship, data.useOars);

    // Доп. паруса
    const sailsOptions = Object.entries(availableSails).map(([k, s]) =>
      `<option value="${k}" ${data.bonusSails === k ? "selected" : ""}>${this.label(s)}</option>`
    ).join("");

    // Корабли
    const shipsOptions = Object.values(ZEPHYR_SHIPS_LIBRARY).map(s =>
      `<option value="${s.id}" ${data.ship === s.id ? "selected" : ""}>${this.label(s, "name", s.id)}</option>`
    ).join("");

    const crewOptions = Object.entries(ZEPHYR_CREW_MODIFIERS).map(([k, c]) =>
      `<option value="${k}" ${data.crewType === k ? "selected" : ""}>${this.label(c)}</option>`
    ).join("");

    // ── Кнопки ветра + волнения (связанные) ──
    const windData = [
      { id: "calm", icon: "🌫️", label: t("WIND_CALM"), sub: t("WIND_CALM_SUB") },
      { id: "weak", icon: "🍃", label: t("WIND_WEAK"), sub: t("WIND_WEAK_SUB") },
      { id: "normal", icon: "💨", label: t("WIND_NORMAL"), sub: t("WIND_NORMAL_SUB") },
      { id: "strong", icon: "🌬️", label: t("WIND_STRONG"), sub: t("WIND_STRONG_SUB") },
      { id: "storm", icon: "⛈️", label: t("WIND_STORM"), sub: t("WIND_STORM_SUB") }
    ];

    const waveData = [
      { id: "calm", icon: "〰️", label: t("WAVE_CALM"), sub: t("WAVE_CALM_SUB") },
      { id: "ripple", icon: "🌊", label: t("WAVE_RIPPLE"), sub: t("WAVE_RIPPLE_SUB") },
      { id: "wave", icon: "🌊🌊", label: t("WAVE_WAVE"), sub: t("WAVE_WAVE_SUB") },
      { id: "stwave", icon: "🌊🌊🌊", label: t("WAVE_STWAVE"), sub: t("WAVE_STWAVE_SUB") },
      { id: "storm", icon: "🌀", label: t("WAVE_STORM"), sub: t("WAVE_STORM_SUB") }
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
        <div class="wbtn-wave">${t("WAVES_LABEL")}: ${wave.sub}</div>
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
          <div class="zephyr-section__title">${t("SECTION_SHIP")}</div>

          <div class="calc-row">
            <div class="calc-label">${t("LABEL_SHIP")}</div>
            <div class="calc-control">
              <select id="shipSelect" style="width:100%">${shipsOptions}</select>
            </div>
          </div>

          <div id="shipInfo" class="ship-info">${this.getShipDescription(data.ship, data.cargo, data.crewCount || 0)}</div>

          <div class="calc-row">
            <div class="calc-label">${t("LABEL_CREW_TYPE")}</div>
            <div class="calc-control">
              <select id="crewType" style="width:100%">${crewOptions}</select>
            </div>
          </div>

          <div class="calc-row">
            <div class="calc-label">${t("LABEL_CREW_COUNT")}</div>
            <div class="calc-control">
              <input type="number" id="crewCount" value="${data.crewCount || 8}" min="0" step="1" style="width:80px;"/>
            </div>
          </div>

          <div class="calc-row">
            <div class="calc-label">${t("LABEL_BONUS_SAILS")}</div>
            <div class="calc-control">
              <select id="bonusSails" style="width:100%">${sailsOptions}</select>
            </div>
          </div>

          <div id="oarsContainer">
            ${oarsBlock}
          </div>

          <div class="calc-row">
            <div class="calc-label">${t("LABEL_CARGO")}</div>
            <div class="calc-control">
              <div class="cargo-slider">
                <input type="range" id="cargo" min="0" max="${maxCargo}" step="0.1" value="${data.cargo}">
                <div id="cargoValue" class="cargo-value">${data.cargo} ${t("UNIT_TONS")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ ПРАВАЯ КОЛОНКА: НАВИГАЦИЯ ═══ -->
      <div class="zephyr-col">
        <div class="zephyr-section">
          <div class="zephyr-section__title">${t("SECTION_NAV")}</div>

          <div class="calc-row">
            <div class="calc-label">${t("LABEL_MODE")}</div>
            <div class="calc-control">
              <select id="mode" style="width:100%">
                <option value="distance" ${data.mode === "distance" ? "selected" : ""}>${t("MODE_DISTANCE")}</option>
                <option value="time" ${data.mode === "time" ? "selected" : ""}>${t("MODE_TIME")}</option>
              </select>
            </div>
          </div>

          <div class="mode-distance" style="display:${data.mode === "distance" ? "block" : "none"}; margin-bottom: 8px;">
            <div class="calc-row">
              <div class="calc-label">${t("LABEL_DISTANCE")}</div>
              <div class="calc-control">
                <input type="number" id="distance" value="${data.distance}" min="0" step="1" style="width:80px;"/>
                <select id="unit" style="width:90px;">
                  <option value="km" ${data.unit === "km" ? "selected" : ""}>${t("UNIT_KM")}</option>
                  <option value="mi" ${data.unit === "mi" ? "selected" : ""}>${t("UNIT_NMI")}</option>
                </select>
              </div>
            </div>
          </div>

          <div class="mode-time" style="display:${data.mode === "time" ? "block" : "none"}; margin-bottom: 8px;">
            <div class="calc-row">
              <div class="calc-label">${t("LABEL_TIME_HOURS")}</div>
              <div class="calc-control">
                <input type="number" id="time" value="${data.time}" min="0" step="0.5" style="width:80px;"/>
              </div>
            </div>
          </div>

          <div class="compass-container">
            <div class="compass-hint">${t("COMPASS_HINT")}</div>
            <div id="compassRenderArea">
              ${this._buildDualCompassSVG(this.uiState.windDir, this.uiState.shipDir)}
            </div>
            <!-- Скрытые технические данные -->
            <div class="course-line">
              ${t("COURSE_TO_WIND")} <span id="derivedCourseLabel">${this.getWindCourseLabel(data.windCourse)}</span>
            </div>
            <input type="hidden" id="windCourse" value="${data.windCourse}"/>
          </div>

          <div class="calc-row helm-row">
            <div class="calc-control helm-toggle">
              <input type="checkbox" id="helm" ${data.helm ? "checked" : ""}/>
              <label for="helm">${t("HELM_LABEL")}</label>
            </div>
          </div>

          <div class="section-subtitle">${t("SECTION_WIND_WAVES")}</div>
          <div class="wbtn-group windsea-group">${windSeaBtns}</div>
          <input type="hidden" id="windForce" value="${data.windForce}"/>
          <input type="hidden" id="waves" value="${derivedWaves}"/>

        </div>
      </div>

    </div> <!-- End Columns Layout -->

    <div class="calc-actions">
      <button type="button" class="zephyr-action-btn" id="sendToChat">
        <i class='fas fa-ship'></i> ${t("BUTTON_CALC_SEND")}
      </button>
    </div>

    <!-- ═══ СЕКЦИЯ РЕЗУЛЬТАТОВ (На всю ширину внизу) ═══ -->
    <div class="zephyr-results zephyr-section">
      <div id="calcResult" class="result-panel">
        <div class="result-card">
          <div class="label">${t("RESULT_CARGO_CREW")}</div>
          <div class="value" id="res-cargo">—</div>
          <div class="sub" id="res-crew">—</div>
        </div>
        <div class="result-card">
          <div class="label">${t("RESULT_MANEUVER")}</div>
          <div class="value" id="res-mano">—</div>
          <div class="sub" id="res-radius">—</div>
        </div>
        <div class="result-card">
          <div class="label">${t("RESULT_DISTANCE_TIME")}</div>
          <div class="value" id="res-dist">—</div>
          <div class="sub" id="res-extra">—</div>
        </div>
        <div class="result-card">
          <div class="label">${t("RESULT_SPEED")}</div>
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
      this.applyMinWindowHeight();
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
      html.find("#derivedCourseLabel").text(this.getWindCourseLabel(newCourse));

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
      html.find("#cargoValue").text(`${v.toFixed(1)} ${this.t("UNIT_TONS")}`);
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
    setTimeout(() => this.applyMinWindowHeight(), 0);
  }

  updateMode(html) {
    const mode = html.find("#mode").val();
    html.find(".mode-distance").toggle(mode === "distance");
    html.find(".mode-time").toggle(mode === "time");
    this.applyMinWindowHeight();
  }

  updateShip(html) {
    const shipId = html.find("#shipSelect").val();
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    if (!ship) return;

    // Сброс и проверка доступности курсов при смене судна
    const newCourse = this.calculateWindCourse(this.uiState.windDir, this.uiState.shipDir, shipId);
    html.find("#windCourse").val(newCourse);
    html.find("#derivedCourseLabel").text(this.getWindCourseLabel(newCourse));

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

    this.updateOarsBlock(html, shipId, currentUseOars);
    this.updateCargoLimits(html);
    this.updateShipInfo(html);
    this.applyMinWindowHeight();
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
      html.find("#cargoValue").text(`0.0 ${this.t("UNIT_TONS")}`);
    } else {
      cargoEl.prop("disabled", false);
      html.find("#cargoValue").text(`${cargoVal.toFixed(1)} ${this.t("UNIT_TONS")}`);
    }
    this.applyMinWindowHeight();
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
      html.find("#calcResult").html(`<div style="color:#ff6b6b; padding:10px;">${this.t("ERROR_PREFIX")} ${e.message}</div>`);
    }
  }

  displayResultCompact(html, result, data) {
    html.find("#res-speed").text(`${result.speed.toFixed(2)} ${this.t("UNIT_SPEED")}`);
    html.find("#res-ft").text(`${result.ftPerRound.toFixed(0)} ${this.t("UNIT_FT_ROUND")}`);

    if (data.mode === "distance") {
      html.find("#res-dist").text(`${data.distance} ${this.getUnitLabel(data.unit)}`);
      html.find("#res-extra").text(`${result.time.days}${this.t("UNIT_DAYS")} ${result.time.hours}${this.t("UNIT_HOURS")} ${result.time.minutes}${this.t("UNIT_MINUTES")}`);
    } else {
      html.find("#res-dist").text(`${result.distanceKm.toFixed(1)} ${this.t("UNIT_KM")} / ${result.distanceMi.toFixed(1)} ${this.t("UNIT_NMI")}`);
      html.find("#res-extra").text(`${result.timeHours} ${this.t("UNIT_HOURS_SHORT")}`);
    }

    html.find("#res-mano").text(`≈ ${Math.round(result.shipState.turnRadiusFt)} ${this.t("UNIT_FT")}`);
    html.find("#res-radius").text(`${(result.shipState.maneuverability * 100).toFixed(0)}%`);
    html.find("#res-cargo").text(`${result.shipState.effectiveCargo.toFixed(2)} ${this.t("UNIT_TONS")} / ${this.getShipMaxCargo(data.ship)} ${this.t("UNIT_TONS")}`);
    html.find("#res-crew").text(`${data.crewCount} ${this.t("UNIT_PEOPLE")} (≈ ${result.shipState.crewWeightTons.toFixed(2)} ${this.t("UNIT_TONS")})`);
  }

  calculateAndSend(html) {
    const data = this.getFormData(html);
    const result = this.calculator.calculateTravelFromData(data);
    this.pendingLastInput = result.input;
    this.flushPendingSave();
    this.chatRenderer.sendToChat(result.input, result);
    ui.notifications.info(this.t("NOTIFY_SENT"));
    this.focusDialog();
  }
}
