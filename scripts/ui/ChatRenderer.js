class ChatRenderer {
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

  sendToChat(data, result) {
    const windCourseLabel = this.label(ZEPHYR_WIND_COURSES?.[data.windCourse], "label", data.windCourse || "—");
    const windForceLabel = this.label(ZEPHYR_WIND_FORCES?.[data.windForce], "label", data.windForce || "—");
    const wavesLabel = this.label(ZEPHYR_WAVES?.[data.waves], "label", data.waves || "—");
    const crewWeight = result.shipState.crewWeightTons ?? 0;
    const shipName = this.label(ZEPHYR_SHIPS_LIBRARY?.[data.ship], "name", data.ship ?? "—");

    const modeLines = data.mode === "distance"
      ? `<div><strong>${this.t("CHAT_DISTANCE")}:</strong> ${data.distance} ${this.getUnitLabel(data.unit)}</div>
         <div><strong>${this.t("CHAT_TIME")}:</strong> ${result.time?.days ?? 0}${this.t("UNIT_DAYS")} ${result.time?.hours ?? 0}${this.t("UNIT_HOURS")} ${result.time?.minutes ?? 0}${this.t("UNIT_MINUTES")}</div>`
      : `<div><strong>${this.t("CHAT_TRAVELED")}:</strong> ${(result.distanceKm ?? 0).toFixed(1)} ${this.t("UNIT_KM")} (${(result.distanceMi ?? 0).toFixed(1)} ${this.t("UNIT_NMI")})</div>`;

    const content = `
<div class="zephyr-chat">
  <div class="zephyr-chat__card">
    <h3 class="zephyr-chat__title">${this.t("CHAT_TITLE")}</h3>

    <div class="zephyr-chat__section">
      <div><strong>${this.t("CHAT_SHIP")}:</strong> ${shipName}</div>
      <div><strong>${this.t("CHAT_SPEED")}:</strong> ${result.speed.toFixed(2)} ${this.t("UNIT_SPEED")} (${result.ftPerRound.toFixed(0)} ${this.t("UNIT_FT_ROUND")})</div>
      <div><strong>${this.t("CHAT_TURN_RADIUS")}:</strong> ${(result.shipState.maneuverability * 100).toFixed(0)}% / ≈ ${Math.round(result.shipState.turnRadiusFt)} ${this.t("UNIT_FT")}</div>
      <div><strong>${this.t("CHAT_CARGO")}:</strong> ${result.shipState.effectiveCargo.toFixed(2)} ${this.t("UNIT_TONS")} (${this.t("SHIP_CREW").toLowerCase()} ${data.crewCount} ${this.t("UNIT_PEOPLE")} ≈ ${crewWeight.toFixed(2)} ${this.t("UNIT_TONS")})</div>
    </div>

    <div class="zephyr-chat__section">
      <div><strong>${this.t("CHAT_MODE")}:</strong> ${data.mode === "distance" ? this.t("CHAT_MODE_DISTANCE") : `${this.t("CHAT_MODE_TIME")} (${data.time} ${this.t("UNIT_HOURS_SHORT")})`}</div>
      <div><strong>${this.t("CHAT_CONDITIONS")}:</strong> ${windCourseLabel}, ${windForceLabel}, ${wavesLabel}</div>
    </div>

    <div class="zephyr-chat__section">
      ${modeLines}
    </div>

    <div class="zephyr-chat__section">
      <strong>${this.t("CHAT_HELM")}:</strong> ${data.helm ? this.t("CHAT_HELM_YES") : this.t("CHAT_HELM_NO")}
    </div>
  </div>
</div>
`;

    ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker()
    });
  }
}
