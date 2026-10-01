/*
 * Laboratório de eixo — porta independente do núcleo de cálculo do programa
 * "Dimensionamento da Ponta de Eixo e do Mancal de Deslizamento" fornecido pelo usuário.
 * Unidades internas: kW, rpm, N·m, mm, MPa. Sem dependências externas.
 * Uso: ShaftEngine.calculate(input). Também exportado por CommonJS para testes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ShaftEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PI = Math.PI;
  const K_TORQUE = 9550;
  const SF_DEFAULT = 9;
  const KW_PER_CV = 0.73549875;
  const KW_PER_HP = 0.745699872;

  const MATERIALS = Object.freeze({
    "AISI 1045": { name: "AISI 1045", tensileMPa: 630, yieldMPa: 370, tauMaxMPa: 214, tauAdmissibleMPa: 142, minTempC: -20, weldable: false },
    "AISI 1524": { name: "AISI 1524", tensileMPa: 510, yieldMPa: 283, tauMaxMPa: 163, tauAdmissibleMPa: 109, minTempC: -20, weldable: true, note: "SPIDER ARM" },
    "AISI 8620": { name: "AISI 8620", tensileMPa: 530, yieldMPa: 385, tauMaxMPa: 222, tauAdmissibleMPa: 148, minTempC: -20, weldable: true, note: "SPIDER ARM" },
    "AISI 4140": { name: "AISI 4140", tensileMPa: 655, yieldMPa: 420, tauMaxMPa: 242, tauAdmissibleMPa: 162, minTempC: -40, weldable: false },
    "AISI 4340": { name: "AISI 4340", tensileMPa: 810, yieldMPa: 745, tauMaxMPa: 430, tauAdmissibleMPa: 287, minTempC: -50, weldable: false }
  });
  const APPLICATIONS = Object.freeze({
    GERADORES: 1.25,
    MOENDAS: 2,
    "MOINHOS DE CIMENTO": 2,
    "VENTILADORES DE GRANDE PORTE": 2,
    "BOMBAS CENTRÍFUGAS": 2.5,
    COMPRESSORES: 2.5,
    TRITURADORES: 2.5,
    "BOMBAS ALTERNATIVAS": 3,
    "BOMBAS DE ÓLEO PARA POÇOS": 3,
    LAMINADORES: 3
  });
  const APPLICATION_ORDER_SECTION9 = [
    "BOMBAS ALTERNATIVAS", "BOMBAS CENTRÍFUGAS", "BOMBAS DE ÓLEO PARA POÇOS", "COMPRESSORES",
    "GERADORES", "LAMINADORES", "MOENDAS", "MOINHOS DE CIMENTO", "TRITURADORES",
    "VENTILADORES DE GRANDE PORTE"
  ];
  const MATERIAL_ORDER = Object.keys(MATERIALS);
  const FS_TABLE_8 = [1, 1.25, 2, 2.5, 3];
  const DIN_UNDER_110 = [6, 7, 8, 9, 10, 11, 12, 14, 16, 19, 20, 22, 24, 25, 28, 30, 32, 35, 38, 40, 42, 45, 48, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
  const DIN_SECTION_8 = [110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 220, 240, 250, 260, 280, 300, 320, 340, 360, 380, 400, 420, 440, 450, 460, 480, 500, 530, 560, 600, 630];
  const DIN_DIAMETERS = Object.freeze([...DIN_UNDER_110, ...DIN_SECTION_8]);
  const SERIES = Object.freeze({
    "DIN 748-1": DIN_DIAMETERS,
    "Múltiplos de 5 mm": Object.freeze(Array.from({ length: 400 }, (_, i) => (i + 1) * 5)),
    "Múltiplos de 10 mm": Object.freeze(Array.from({ length: 200 }, (_, i) => (i + 1) * 10))
  });
  const ROTATION_COLUMNS = Object.freeze([
    [60, 2], [50, 2], [60, 4], [50, 4], [60, 6], [50, 6],
    [60, 8], [50, 8], [60, 10], [50, 10], [60, 12], [50, 12]
  ]);
  const IEC_FRAMES = Object.freeze([
    [6, "k6", []], [11, "k6", [["63", null]]], [14, "k6", [["71", null]]],
    [19, "k6", [["80", null]]], [24, "k6", [["90", null]]],
    [28, "k6", [["100", null], ["112", null]]], [38, "k6", [["132", null]]],
    [42, "k6", [["160", null]]], [48, "k6", [["180", null]]],
    [55, "m6", [["200", null], ["225 SM", "2"]]],
    [60, "m6", [["225 SM", "other"], ["250 SM", "2"]]],
    [65, "m6", [["250 SM", "other"], ["280 SM", "2"], ["315 SM", "2"], ["355 ML", "2"]]],
    [75, "m6", [["280 SM", "other"]]], [80, "m6", [["315 SM", "other"]]],
    [100, "m6", [["355 ML", "other"], ["355 AB", null]]]
  ]);
  const LENGTH_GROUPS = [
    [[6, 7], 16, null], [[8, 9], 20, null], [[10, 11], 23, 15], [[12, 14], 30, 18],
    [[16, 18, 19], 40, 28], [[20, 22, 24], 50, 36], [[25, 28], 60, 42],
    [[30, 32, 35, 38], 80, 58], [[40, 42, 45, 48, 50, 55, 56], 110, 82],
    [[60, 63, 65, 70, 71, 75], 140, 105], [[80, 85, 90, 95], 170, 130],
    [[100, 110, 120, 125], 210, 165], [[130, 140, 150], 250, 200],
    [[160, 170, 180], 300, 240], [[190, 200, 220], 350, 280],
    [[240, 250, 260], 410, 330], [[280, 300, 320], 470, 380],
    [[340, 360, 380], 550, 450], [[400, 420, 440, 450, 460, 480, 500], 650, 540],
    [[530, 560, 600, 630], 800, 680]
  ];

  function normalizeText(value) {
    return String(value == null ? "" : value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ").trim().toUpperCase();
  }

  function readBoolean(value) {
    return typeof value === "boolean" ? value : ["S", "SIM", "Y", "YES", "TRUE", "VERDADEIRO", "1", "X"].includes(normalizeText(value));
  }

  // Mirrors ler_numero() for values entered into a pt-BR interface.
  function readNumber(value, label, optional = false) {
    if (value == null || value === "") {
      if (optional) return null;
      throw new ShaftInputError([`${label}: campo obrigatório.`]);
    }
    if (typeof value === "number") {
      if (Number.isFinite(value)) return value;
      throw new ShaftInputError([`${label}: número inválido.`]);
    }
    let s = String(value).replace(/[\s\u00a0]/g, "");
    if (!s) {
      if (optional) return null;
      throw new ShaftInputError([`${label}: campo obrigatório.`]);
    }
    if (s.includes(",") && s.includes(".")) {
      s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    } else if (s.includes(",")) {
      s = s.replace(",", ".");
    } else if ((s.match(/\./g) || []).length > 1 || /^[-+]?[1-9]\d{0,2}\.\d{3}$/.test(s)) {
      s = s.replace(/\./g, "");
    }
    const n = Number(s);
    if (!Number.isFinite(n)) throw new ShaftInputError([`${label}: '${value}' não é um número válido.`]);
    return n;
  }

  class ShaftInputError extends Error {
    constructor(errors) {
      super(errors.join("\n"));
      this.name = "ShaftInputError";
      this.errors = errors;
    }
  }

  function pick(raw, camel, snake, fallback) {
    if (Object.prototype.hasOwnProperty.call(raw, camel)) return raw[camel];
    if (Object.prototype.hasOwnProperty.call(raw, snake)) return raw[snake];
    return fallback;
  }

  function canonicalMaterial(value) {
    const v = normalizeText(value || "AISI 1045").replace(/^(AISI|SAE)\s*/, "").trim();
    if (v.startsWith("PERSONAL")) return "Personalizado";
    const match = MATERIAL_ORDER.find(k => normalizeText(k).replace(/^AISI\s*/, "") === v);
    return match || String(value || "AISI 1045");
  }

  function canonicalApplication(value) {
    const v = normalizeText(value || "GERADORES");
    if (v.startsWith("OUTRA") || ["MANUAL", "NENHUMA", "-"].includes(v)) return "OUTRA (informar FS)";
    const exact = Object.keys(APPLICATIONS).find(k => normalizeText(k) === v);
    if (exact) return exact;
    const candidate = Object.keys(APPLICATIONS).filter(k => normalizeText(k).startsWith(v) || normalizeText(k).includes(v));
    if (candidate.length === 1) return candidate[0];
    const words = v.split(" ").map(w => w.slice(0, 5));
    const stems = Object.keys(APPLICATIONS).filter(k => words.every(w => normalizeText(k).split(" ").some(x => x.startsWith(w))));
    if (stems.length === 1) return stems[0];
    return String(value || "GERADORES");
  }

  function canonicalCriterion(value) {
    const key = normalizeText(value || "SECAO_5").replace(/[\s_\/-]/g, "");
    if (["SECAO5", "5", "58", "SECAO58", "SECAO8", "EQUACAO"].includes(key)) return "SECAO_5";
    if (["SECAO9", "9", "TABELAS"].includes(key)) return "SECAO_9";
    if (["MAIOR", "AMBOS", "OSDOIS"].includes(key)) return "MAIOR";
    if (["PERSONALIZADO", "CUSTOM"].includes(key)) return "PERSONALIZADO";
    return String(value);
  }

  function canonicalSeries(value) {
    const n = normalizeText(value || "DIN 748-1");
    return Object.keys(SERIES).find(k => normalizeText(k) === n) || String(value);
  }

  function normalizeInput(raw = {}) {
    const convertKva = readBoolean(pick(raw, "convertKva", "converter_kva", false));
    const rotationMode = normalizeText(pick(raw, "rotationMode", "modo_rotacao", "polos")) === "RPM" ? "rpm" : "polos";
    const input = {
      machineType: pick(raw, "machineType", "tipo_maquina", "Gerador"),
      power: readNumber(pick(raw, "power", "potencia", null), "Potência"),
      powerUnit: pick(raw, "powerUnit", "unidade_potencia", "kW"),
      convertKva,
      powerFactor: readNumber(pick(raw, "powerFactor", "cos_phi", 0.8), "cos φ", !convertKva),
      efficiency: readNumber(pick(raw, "efficiency", "rendimento", 0.97), "Rendimento", !convertKva),
      rotationMode,
      frequency: readNumber(pick(raw, "frequency", "frequencia", 60), "Frequência", rotationMode === "rpm"),
      poles: readNumber(pick(raw, "poles", "polos", 4), "Polos", rotationMode === "rpm"),
      slipPercent: readNumber(pick(raw, "slipPercent", "escorregamento", 0), "Escorregamento", rotationMode === "rpm"),
      directRpm: readNumber(pick(raw, "directRpm", "rotacao", null), "Rotação", true),
      application: canonicalApplication(pick(raw, "application", "aplicacao", "GERADORES")),
      customFs: readNumber(pick(raw, "customFs", "fs_personalizado", null), "FS personalizado", true),
      material: canonicalMaterial(pick(raw, "material", "material", "AISI 1045")),
      customYieldMPa: readNumber(pick(raw, "customYieldMPa", "mat_escoamento", null), "Se personalizado", true),
      customTensileMPa: readNumber(pick(raw, "customTensileMPa", "mat_ruptura", null), "Sr personalizado", true),
      customMinTempC: readNumber(pick(raw, "customMinTempC", "mat_temp_min", null), "Temperatura mínima do material", true),
      customWeldable: readBoolean(pick(raw, "customWeldable", "mat_soldavel", false)),
      criterion: canonicalCriterion(pick(raw, "criterion", "criterio", "SECAO_5")),
      customTauMPa: readNumber(pick(raw, "customTauMPa", "tau_personalizado", null), "τ personalizado", true),
      safetyFactor: readNumber(pick(raw, "safetyFactor", "fator_seguranca", 9), "Fator de segurança"),
      diameterSeries: canonicalSeries(pick(raw, "diameterSeries", "serie_diametros", "DIN 748-1")),
      existingDiameterMm: readNumber(pick(raw, "existingDiameterMm", "diametro_existente", null), "Diâmetro existente", true),
      peakTorqueMultiple: readNumber(pick(raw, "peakTorqueMultiple", "torque_pico_pu", null), "Torque de pico", true),
      minOperatingTempC: readNumber(pick(raw, "minOperatingTempC", "temp_min_operacao", null), "Temperatura mínima de operação", true),
      requiresWelding: readBoolean(pick(raw, "requiresWelding", "requer_solda", false))
    };
    input.machineType = ({ GERADOR: "Gerador", MOTOR: "Motor", OUTRO: "Outro" })[normalizeText(input.machineType)] || input.machineType;
    input.powerUnit = ["kW", "MW", "kVA", "MVA", "cv", "HP"].find(u => u.toLowerCase() === String(input.powerUnit).toLowerCase()) || input.powerUnit;
    return input;
  }

  function validate(input) {
    const errors = [], warnings = [];
    if (!(input.power > 0)) errors.push("Potência: informe um valor maior que zero.");
    else if (input.power > 5e6) errors.push("Potência fora da faixa plausível.");
    if (!["kW", "MW", "kVA", "MVA", "cv", "HP"].includes(input.powerUnit)) errors.push("Unidade de potência inválida.");
    if (["kVA", "MVA"].includes(input.powerUnit) && input.convertKva) {
      if (!(input.powerFactor > 0 && input.powerFactor <= 1)) errors.push("cos φ deve estar entre 0 e 1.");
      if (!(input.efficiency > 0 && input.efficiency <= 1)) errors.push("Rendimento η deve estar entre 0 e 1.");
    }
    if (input.rotationMode === "rpm") {
      if (!(input.directRpm > 0)) errors.push("Rotação: informe um valor em rpm maior que zero.");
      else if (input.directRpm > 1e5) errors.push("Rotação fora da faixa plausível.");
    } else {
      if (!(input.frequency > 0)) errors.push("Frequência deve ser maior que zero.");
      if (!Number.isInteger(input.poles) || input.poles < 2 || input.poles % 2) errors.push("Número de polos deve ser inteiro, par e ≥ 2.");
      if (!(input.slipPercent >= 0 && input.slipPercent < 50)) errors.push("Escorregamento deve estar entre 0 e 50%.");
    }
    if (!(input.application in APPLICATIONS) && input.customFs == null) errors.push("Aplicação 'OUTRA': informe o fator de serviço (FS).");
    if (input.customFs != null) {
      if (!(input.customFs > 0)) errors.push("Fator de serviço deve ser maior que zero.");
      else if (input.customFs < 1) warnings.push(`FS = ${input.customFs} < 1: abaixo dos valores usuais da tabela 6.2.7.`);
    }
    if (input.material === "Personalizado" && !(input.customYieldMPa > 0)) errors.push("Material personalizado: informe o escoamento Se (MPa).");
    else if (input.material !== "Personalizado" && !(input.material in MATERIALS)) errors.push(`Material '${input.material}' não cadastrado.`);
    if (!["SECAO_5", "SECAO_9", "MAIOR", "PERSONALIZADO"].includes(input.criterion)) errors.push("Critério inválido.");
    if (input.criterion === "PERSONALIZADO" && !(input.customTauMPa > 0)) errors.push("Critério personalizado: informe τ (MPa) > 0.");
    if (!(input.safetyFactor > 0)) errors.push("Fator de segurança deve ser maior que zero.");
    else if (input.safetyFactor < SF_DEFAULT - 1e-9) warnings.push(`Fator de segurança ${input.safetyFactor} abaixo do mínimo 9 da seção 5.`);
    if (input.existingDiameterMm != null && !(input.existingDiameterMm > 0)) errors.push("Diâmetro existente deve ser maior que zero.");
    if (input.peakTorqueMultiple != null && !(input.peakTorqueMultiple > 0)) errors.push("Torque de pico deve ser maior que zero.");
    if (!(input.diameterSeries in SERIES)) errors.push("Série de diâmetros inválida.");
    if (errors.length) throw new ShaftInputError(errors);
    return warnings;
  }

  function resolveMaterial(input) {
    if (input.material !== "Personalizado") return MATERIALS[input.material];
    const y = input.customYieldMPa;
    const tau = y / Math.sqrt(3);
    return {
      name: "Personalizado", tensileMPa: input.customTensileMPa, yieldMPa: y,
      tauMaxMPa: tau, tauAdmissibleMPa: tau / 1.5,
      minTempC: input.customMinTempC, weldable: input.customWeldable, note: "τmáx = Se/√3"
    };
  }

  function powerToKW(input) {
    const p = input.power;
    switch (input.powerUnit) {
      case "kW": return { value: p, description: `P = ${p} kW` };
      case "MW": return { value: p * 1000, description: `P = ${p} MW × 1000` };
      case "cv": return { value: p * KW_PER_CV, description: `P = ${p} cv × 0,73549875` };
      case "HP": return { value: p * KW_PER_HP, description: `P = ${p} HP × 0,745699872` };
      case "kVA":
      case "MVA": {
        const kva = p * (input.powerUnit === "MVA" ? 1000 : 1);
        if (!input.convertKva) return { value: kva, description: `S = ${kva} kVA tratado como ${kva} kW (convenção das tabelas da seção 9)`, convention: true };
        if (input.machineType === "Gerador") return { value: kva * input.powerFactor / input.efficiency, description: "P eixo = S · cosφ / η" };
        if (input.machineType === "Motor") return { value: kva * input.powerFactor * input.efficiency, description: "P eixo = S · cosφ · η" };
        return { value: kva * input.powerFactor, description: "P = S · cosφ" };
      }
      default: throw new ShaftInputError(["Unidade de potência inválida."]);
    }
  }

  function speed(input) {
    if (input.rotationMode === "rpm") return { rpm: input.directRpm, synchronousRpm: null, description: "n informado diretamente" };
    const synchronousRpm = 120 * input.frequency / input.poles;
    const rpm = synchronousRpm * (1 - input.slipPercent / 100);
    return { rpm, synchronousRpm, description: input.slipPercent ? "ns = 120f/p; n = ns(1 − s/100)" : "n = 120f/p" };
  }

  function serviceFactor(input) {
    if (input.customFs != null) return { value: input.customFs, source: "informado" };
    return { value: APPLICATIONS[input.application], source: "tabela 6.2.7" };
  }

  function tauFor(material, criterion, customTau) {
    if (criterion === "SECAO_5") return material.tauMaxMPa;
    if (criterion === "SECAO_9") return material.yieldMPa / 3;
    if (criterion === "PERSONALIZADO") return customTau;
    throw new ShaftInputError(["Critério inválido."]);
  }

  function torqueNm(powerKW, rpm) { return K_TORQUE * powerKW / rpm; }
  function minimumDiameterMm(torque, fs, tau, sf = SF_DEFAULT) {
    return Math.cbrt(sf * torque * fs * 1000 * 16 / (PI * tau));
  }
  function admissibleTorqueNm(d, fs, tau, sf = SF_DEFAULT) {
    return PI * tau * d ** 3 / (sf * fs * 1000 * 16);
  }
  function maxPowerKW(d, rpm, fs, tau, sf = SF_DEFAULT) {
    return admissibleTorqueNm(d, fs, tau, sf) * rpm / K_TORQUE;
  }
  function torsionalStressMPa(torque, diameter) { return 16 * torque * 1000 / (PI * diameter ** 3); }
  function selectDiameter(min, series) { return series.find(d => d >= min - 1e-9) ?? null; }
  function specialDiameter(min) { return Math.ceil(min / 10 - 1e-12) * 10; }
  function lengthFor(d) {
    if (Math.abs(d - Math.round(d)) > 1e-9) return { longMm: null, shortMm: null };
    const item = LENGTH_GROUPS.find(([ds]) => ds.includes(d));
    return item ? { longMm: item[1], shortMm: item[2] } : { longMm: null, shortMm: null };
  }
  function framesFor(d, poles) {
    const item = IEC_FRAMES.find(row => row[0] === d);
    if (!item) return [];
    return item[2].filter(([, restriction]) => poles == null || restriction == null ||
      (restriction === "2" && poles === 2) || (restriction === "other" && poles !== 2))
      .map(([label, restriction]) => poles == null && restriction ? `${label} (${restriction === "2" ? "somente 2 polos" : "demais polaridades"})` : label);
  }
  function nextIEC(min, poles) {
    const item = IEC_FRAMES.find(row => row[0] >= min - 1e-9);
    return item ? { diameterMm: item[0], tolerance: item[1], frames: framesFor(item[0], poles) } : null;
  }

  function powersSection9() {
    const out = [];
    for (let k = Math.floor(25 * Math.log10(1000)) - 1; k <= Math.ceil(25 * Math.log10(100000)) + 1; k++) {
      let value = 10 ** (k / 25);
      if (value >= 1000) value = Math.round(value / 10) * 10;
      else if (value >= 100) value = Math.round(value);
      else if (value >= 10) value = Math.round(value * 10) / 10;
      else value = Math.round(value * 100) / 100;
      if (value >= 1000 - 1e-9 && value <= 100000 + 1e-9 && out.at(-1) !== value) out.push(value);
    }
    return out;
  }
  const POWERS_SECTION_9 = powersSection9();

  function tableLookup(input, material, powerKW, rpm, fs) {
    const columnIndex = ROTATION_COLUMNS.findIndex(([f, p]) => Math.abs(120 * f / p - rpm) < 0.5);
    const table8Id = MATERIAL_ORDER.includes(material.name) && FS_TABLE_8.some(x => Math.abs(x - fs) < 1e-9)
      ? `8.${MATERIAL_ORDER.indexOf(material.name) + 1}.${FS_TABLE_8.findIndex(x => Math.abs(x - fs) < 1e-9) + 1}` : null;
    let section8 = null;
    if (table8Id && columnIndex >= 0) {
      const matched = DIN_SECTION_8.find(d => Math.round(maxPowerKW(d, rpm, fs, material.tauMaxMPa, 9)) >= powerKW - 1e-9);
      section8 = {
        section: table8Id, frequencyHz: ROTATION_COLUMNS[columnIndex][0], poles: ROTATION_COLUMNS[columnIndex][1],
        diameterMm: matched ?? null,
        maxPowerKW: matched == null ? null : Math.round(maxPowerKW(matched, rpm, fs, material.tauMaxMPa, 9)),
        belowRange: matched === 110 && minimumDiameterMm(torqueNm(powerKW, rpm), fs, material.tauMaxMPa, 9) < 110
      };
    }
    let section9 = null;
    if (input.application in APPLICATIONS && Math.abs(APPLICATIONS[input.application] - fs) < 1e-9 && MATERIAL_ORDER.includes(material.name)) {
      const rowPowerKW = POWERS_SECTION_9.find(p => p >= powerKW - 1e-9);
      if (rowPowerKW != null && powerKW >= 1000 - 1e-9) {
        const lowerRpm = columnIndex >= 0 ? rpm : Math.max(...ROTATION_COLUMNS.map(([f, p]) => 120 * f / p).filter(n => n <= rpm));
        if (Number.isFinite(lowerRpm)) {
          const lowerIndex = ROTATION_COLUMNS.findIndex(([f, p]) => Math.abs(120 * f / p - lowerRpm) < 0.5);
          const tau9 = material.yieldMPa / 3;
          const d = Math.round(minimumDiameterMm(torqueNm(rowPowerKW, lowerRpm), fs, tau9));
          let printedTau = tau9, printedFs = fs, errata = null;
          if (material.name === "AISI 1045" && Math.abs(fs - 3) < 1e-9 && rowPowerKW >= 1580) { printedTau = material.yieldMPa / 2; errata = "E1"; }
          if (material.name === "AISI 8620" && Math.abs(fs - 2) < 1e-9) { printedFs = 2.5; errata = "E2"; }
          const docDiameterMm = Math.round(minimumDiameterMm(torqueNm(rowPowerKW, lowerRpm), printedFs, printedTau));
          section9 = {
            section: `9.${APPLICATION_ORDER_SECTION9.indexOf(input.application) + 1}.${MATERIAL_ORDER.indexOf(material.name) + 1}`,
            rowPowerKW, frequencyHz: ROTATION_COLUMNS[lowerIndex][0], poles: ROTATION_COLUMNS[lowerIndex][1],
            columnRpm: lowerRpm, diameterMm: d, printedDiameterMm: docDiameterMm, errata,
            conservativeColumn: columnIndex < 0
          };
        }
      }
    }
    return { section8, section9 };
  }

  function calculate(raw) {
    const input = normalizeInput(raw);
    const warnings = validate(input);
    const notes = [];
    const material = resolveMaterial(input);
    const power = powerToKW(input);
    const rotation = speed(input);
    const fsRecord = serviceFactor(input);
    const powerKW = power.value, rpm = rotation.rpm, fs = fsRecord.value, sf = input.safetyFactor;
    if (input.customFs != null && input.application in APPLICATIONS && Math.abs(input.customFs - APPLICATIONS[input.application]) > 1e-9) {
      notes.push(`FS informado ${input.customFs}; a tabela 6.2.7 indica ${APPLICATIONS[input.application]} para ${input.application}.`);
    }
    const torque = torqueNm(powerKW, rpm), series = SERIES[input.diameterSeries];
    const criteria = {};
    for (const [key, criterion] of [["section5", "SECAO_5"], ["section9", "SECAO_9"], ...(input.criterion === "PERSONALIZADO" ? [["custom", "PERSONALIZADO"]] : [])]) {
      const tauMPa = tauFor(material, criterion, input.customTauMPa);
      const minDiameterMm = minimumDiameterMm(torque, fs, tauMPa, sf);
      const diameterFromSeries = selectDiameter(minDiameterMm, series);
      const special = diameterFromSeries == null;
      const normalizedDiameterMm = special ? specialDiameter(minDiameterMm) : diameterFromSeries;
      const limitPowerKW = maxPowerKW(normalizedDiameterMm, rpm, fs, tauMPa, sf);
      criteria[key] = { criterion, tauMPa, minDiameterMm, normalizedDiameterMm, special,
        maxPowerKW: limitPowerKW, utilization: powerKW / limitPowerKW };
    }
    const governingCriterion = input.criterion === "MAIOR"
      ? (criteria.section5.minDiameterMm >= criteria.section9.minDiameterMm ? "SECAO_5" : "SECAO_9") : input.criterion;
    const chosen = criteria[governingCriterion === "SECAO_5" ? "section5" : governingCriterion === "SECAO_9" ? "section9" : "custom"];
    const minDiameterMm = chosen.minDiameterMm;
    const adoptedDiameterMm = input.existingDiameterMm ?? chosen.normalizedDiameterMm;
    const nominalShearMPa = torsionalStressMPa(torque, adoptedDiameterMm);
    const serviceShearMPa = nominalShearMPa * fs;
    const actualSafetyFactor = chosen.tauMPa / serviceShearMPa;
    const utilization = (minDiameterMm / adoptedDiameterMm) ** 3;
    const limitPowerKW = maxPowerKW(adoptedDiameterMm, rpm, fs, chosen.tauMPa, sf);
    const limitTorqueNm = admissibleTorqueNm(adoptedDiameterMm, fs, chosen.tauMPa, sf);
    let status = "ok";
    let verification = null;
    if (input.existingDiameterMm != null) {
      const passes = adoptedDiameterMm >= minDiameterMm - 1e-9;
      verification = {
        diameterMm: adoptedDiameterMm, passes, deficitMm: Math.max(0, minDiameterMm - adoptedDiameterMm),
        actualSafetyFactor, utilization, maxPowerKW: limitPowerKW, normalized: series.some(d => Math.abs(d - adoptedDiameterMm) < 1e-9)
      };
      if (!passes) {
        status = "falha";
        warnings.push(`Diâmetro existente ${adoptedDiameterMm.toFixed(1)} mm não atende: mínimo ${minDiameterMm.toFixed(1)} mm; faltam ${(minDiameterMm - adoptedDiameterMm).toFixed(1)} mm.`);
      }
      if (!verification.normalized) notes.push(`O diâmetro ${adoptedDiameterMm} mm não pertence à série ${input.diameterSeries}.`);
    }
    let peakCheck = null;
    if (input.peakTorqueMultiple != null) {
      const peakTorqueNm = input.peakTorqueMultiple * torque;
      const peakShearMPa = torsionalStressMPa(peakTorqueNm, adoptedDiameterMm);
      const yieldShearMPa = material.yieldMPa / Math.sqrt(3);
      const margin = yieldShearMPa / peakShearMPa;
      peakCheck = { multiple: input.peakTorqueMultiple, peakTorqueNm, peakShearMPa, yieldShearMPa, margin, passes: margin >= 1 };
      if (!peakCheck.passes) {
        if (status === "ok") status = "atencao";
        warnings.push(`Torque de pico ${input.peakTorqueMultiple}×Mt excede o cisalhamento de escoamento Se/√3; risco de deformação permanente.`);
      }
    }
    if (input.minOperatingTempC != null && material.minTempC != null && input.minOperatingTempC < material.minTempC) {
      if (status === "ok") status = "atencao";
      warnings.push(`${material.name} é indicado até ${material.minTempC} °C; a operação informada chega a ${input.minOperatingTempC} °C.`);
    }
    if (input.requiresWelding && !material.weldable) {
      if (status === "ok") status = "atencao";
      warnings.push(`${material.name} não é soldável segundo a tabela de materiais usada pelo programa original.`);
    }
    if (input.requiresWelding && input.minOperatingTempC != null &&
        !Object.values(MATERIALS).some(m => m.weldable && m.minTempC <= input.minOperatingTempC)) {
      warnings.push(`Nenhum material cadastrado é simultaneamente soldável e adequado a ${input.minOperatingTempC} °C.`);
    }
    if (warnings.some(x => x.startsWith("Fator de segurança")) && status === "ok") status = "atencao";
    if (chosen.special) notes.push(`O diâmetro mínimo excede a série ${input.diameterSeries}; foi adotado um múltiplo especial de 10 mm.`);
    if (powerKW < 1000 || powerKW > 100000) notes.push("Potência fora da faixa tabelada da seção 9 (1.000–100.000 kW); o cálculo usa a equação direta.");
    if (minDiameterMm < 110) notes.push("Diâmetro abaixo da faixa da tabela da seção 8 (110–630 mm); a seleção usa a série DIN completa.");
    if (!ROTATION_COLUMNS.some(([f, p]) => Math.abs(120 * f / p - rpm) < 0.5)) notes.push("Rotação fora das colunas das tabelas; o cálculo direto mantém a rotação informada.");
    if (power.convention) notes.push("kVA foi tratado numericamente como kW, conforme a convenção das tabelas da seção 9. Ative a conversão física para usar a potência mecânica no eixo.");
    if (governingCriterion === "SECAO_5") notes.push(`A seção 9 pediria ${criteria.section9.minDiameterMm.toFixed(1)} mm, normalizado a ${criteria.section9.normalizedDiameterMm} mm.`);
    else if (governingCriterion === "SECAO_9") notes.push(`A seção 5/8 pediria ${criteria.section5.minDiameterMm.toFixed(1)} mm, normalizado a ${criteria.section5.normalizedDiameterMm} mm.`);

    const comparisonCriterion = governingCriterion === "PERSONALIZADO" ? "SECAO_5" : governingCriterion;
    const comparisonMaterials = [...Object.values(MATERIALS), ...(material.name === "Personalizado" ? [material] : [])];
    const materialComparison = comparisonMaterials.map(m => {
      const tauMPa = tauFor(m, comparisonCriterion);
      const dMin = minimumDiameterMm(torque, fs, tauMPa, sf);
      const dNorm = selectDiameter(dMin, series) ?? specialDiameter(dMin);
      const pMax = maxPowerKW(dNorm, rpm, fs, tauMPa, sf);
      return {
        material: m.name, yieldMPa: m.yieldMPa, tauMPa, minDiameterMm: dMin,
        normalizedDiameterMm: dNorm, maxPowerKW: pMax, utilization: powerKW / pMax,
        minTempC: m.minTempC, weldable: m.weldable,
        temperatureOK: input.minOperatingTempC == null || m.minTempC == null || input.minOperatingTempC >= m.minTempC,
        weldingOK: !input.requiresWelding || m.weldable,
        selected: m.name === material.name, best: false
      };
    });
    const eligible = materialComparison.filter(row => row.temperatureOK && row.weldingOK);
    if (eligible.length) {
      const bestDiameter = Math.min(...eligible.map(row => row.normalizedDiameterMm));
      for (const row of eligible) row.best = Math.abs(row.normalizedDiameterMm - bestDiameter) < 1e-9;
    }

    const poles = input.rotationMode === "polos" ? input.poles : null;
    const geometry = {
      tolerance: adoptedDiameterMm <= 50 ? "k6" : "m6",
      ...lengthFor(adoptedDiameterMm), frames: framesFor(adoptedDiameterMm, poles),
      nextIEC: minDiameterMm <= 100 ? nextIEC(minDiameterMm, poles) : null
    };
    const tableLookupResult = tableLookup(input, material, powerKW, rpm, fs);
    const trace = [
      { step: "power", label: "Potência no eixo", formula: power.description, result: powerKW, unit: "kW" },
      { step: "speed", label: "Rotação", formula: rotation.description, result: rpm, unit: "rpm" },
      { step: "service", label: "Fator de serviço", formula: fsRecord.source, result: fs, unit: "×" },
      { step: "torque", label: "Torque nominal", formula: "Mt = 9550 · P / n", result: torque, unit: "N·m" },
      { step: "diameter", label: "Diâmetro mínimo", formula: "d = ∛(SF · Mt · FS · 1000 · 16 / (π · τ))", result: minDiameterMm, unit: "mm" },
      { step: "selection", label: "Diâmetro adotado", formula: input.existingDiameterMm == null ? `Série ${input.diameterSeries}` : "Diâmetro existente informado", result: adoptedDiameterMm, unit: "mm" },
      { step: "verification", label: "Utilização", formula: "(d mínimo / d adotado)³", result: utilization, unit: "fração" }
    ];
    const statusText = input.existingDiameterMm != null
      ? ({ ok: "DIÂMETRO EXISTENTE ATENDE", atencao: "ATENDE COM RESSALVAS", falha: "DIÂMETRO EXISTENTE NÃO ATENDE" })[status]
      : ({ ok: "DIMENSIONADO — ATENDE", atencao: "DIMENSIONADO COM RESSALVAS", falha: "NÃO ATENDE" })[status];

    return {
      input, material: { ...material, tauSection9MPa: material.yieldMPa / 3 },
      powerKW, rpm, synchronousRpm: rotation.synchronousRpm, fs, safetyFactor: sf, torqueNm: torque,
      criteria, governingCriterion, minDiameterMm, normalizedDiameterMm: chosen.normalizedDiameterMm,
      adoptedDiameterMm, referenceShearMPa: chosen.tauMPa, nominalShearMPa, serviceShearMPa,
      actualSafetyFactor, utilization, maxPowerKW: limitPowerKW, maxTorqueNm: limitTorqueNm,
      status, statusText, verification, peakCheck, materialComparison,
      table8: tableLookupResult.section8, table9: tableLookupResult.section9,
      geometry, warnings, notes, trace
    };
  }

  const meta = Object.freeze({
    materials: Object.values(MATERIALS).map(m => ({ ...m, tauSection9MPa: m.yieldMPa / 3 })),
    applications: Object.entries(APPLICATIONS).map(([name, fs]) => ({ name, fs })),
    criteria: ["SECAO_5", "SECAO_9", "MAIOR", "PERSONALIZADO"],
    diameterSeries: Object.keys(SERIES), powerUnits: ["kW", "MW", "kVA", "MVA", "cv", "HP"],
    dinDiameters: DIN_DIAMETERS, section8Diameters: DIN_SECTION_8,
    rotationColumns: ROTATION_COLUMNS.map(([frequencyHz, poles]) => ({ frequencyHz, poles, rpm: 120 * frequencyHz / poles }))
  });
  return { calculate, meta, ShaftInputError, formulas: {
    torqueNm, minimumDiameterMm, admissibleTorqueNm, maxPowerKW, torsionalStressMPa
  } };
});

/*
 * Mancal de deslizamento — port of the bearing calculation in the user supplied
 * Python model. Equations and lookup tables follow that model (including its
 * documented spreadsheet corrections M1–M8). All lengths in mm unless named
 * otherwise. No runtime dependencies; works as a browser global and CommonJS.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BearingEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MANCAL_DIAMETROS = [25,30,35,40,45,50,55,60,70,80,90,100,110,120,125,140,160,180,200,225,250,280,314,315,335,354,375,400,425,450,475,500,530,560,630,710,800,900,1000,1120,1250];
  const H_LIM_TABELA = {"1":[0.003,0.004,0.006,0.008,0.01],"2":[0.004,0.005,0.008,0.011,0.014],"3":[0.005,0.007,0.01,0.013,0.016],"4":[0.007,0.009,0.012,0.015,0.018],"5":[0.009,0.012,0.015,0.018,0.021],"6":[0.012,0.015,0.018,0.021,0.024]};
  const PSI_TABELA = {"1":[1.32,1.6,1.9,2.24,null],"2":[1.12,1.32,1.6,1.9,null],"3":[1.12,1.12,1.32,1.6,null],"4":[0.8,1.12,1.32,1.32,null]};
  const PSI_SERIE = [0.56,0.8,1.12,1.32,1.6,1.9,2.24,3.15];
  const IT7_FURO = [[18,0.018],[30,0.021],[50,0.025],[80,0.03],[120,0.035],[180,0.04],[250,0.046],[315,0.052],[400,0.057],[500,0.063],[630,0.07],[800,0.08],[1000,0.09],[1250,0.105],[1600,0.125],[2000,0.15]];
  const FOLGA_MAX_TABELA = [[30,[0,0.03,0.038,0.044,0.052,0.06,0.073,0.098]],[35,[0,0.035,0.045,0.052,0.061,0.075,0.086,0.116]],[40,[0.03,0.039,0.051,0.063,0.074,0.085,0.098,0.132]],[45,[0.031,0.043,0.061,0.07,0.082,0.094,0.109,0.147]],[50,[0.036,0.052,0.067,0.076,0.09,0.104,0.12,0.163]],[55,[0.04,0.058,0.075,0.085,0.1,0.116,0.144,0.181]],[60,[0.043,0.062,0.08,0.092,0.108,0.125,0.145,0.197]],[70,[0.053,0.068,0.09,0.102,0.129,0.148,0.17,0.229]],[80,[0.058,0.076,0.109,0.124,0.145,0.167,0.193,0.261]],[90,[0.066,0.087,0.124,0.141,0.165,0.19,0.219,0.296]],[100,[0.072,0.095,0.135,0.154,0.181,0.209,0.241,0.328]],[110,[0.077,0.113,0.146,0.167,0.197,0.228,0.264,0.359]],[120,[0.093,0.121,0.157,0.18,0.213,0.247,0.286,0.391]],[140,[0.105,0.137,0.178,0.204,0.241,0.28,0.324,0.442]],[160,[0.117,0.153,0.201,0.231,0.273,0.318,0.369,0.505]],[180,[0.128,0.179,0.223,0.257,0.305,0.356,0.413,0.568]],[200,[0.144,0.19,0.25,0.288,0.342,0.399,0.463,0.636]],[225,[0.157,0.208,0.276,0.318,0.378,0.441,0.514,0.707]],[250,[0.171,0.228,0.304,0.351,0.418,0.489,0.57,0.786]],[280,[0.19,0.254,0.339,0.392,0.466,0.546,0.636,0.877]],[315,[0.209,0.28,0.375,0.435,0.518,0.607,0.708,0.979]],[355,[0.234,0.315,0.422,0.489,0.583,0.683,0.799,1.102]],[400,[0.258,0.349,0.469,0.545,0.651,0.764,0.892,1.236]],[450,[0.29,0.392,0.528,0.613,0.732,0.859,1.004,1.39]],[500,[0.318,0.432,0.584,0.679,0.812,0.954,1.116,1.548]],[560,[0.354,0.481,0.651,0.757,0.905,1.064,1.244,1.727]],[630,[0.39,0.533,0.723,0.842,1.009,1.188,1.39,1.966]],[710,[0.44,0.601,0.815,0.949,1.137,1.338,1.566,2.176]],[800,[0.488,0.669,0.911,1.062,1.273,1.5,1.756,2.443]],[900,[0.549,0.753,1.025,1.195,1.433,1.688,1.977,2.751]],[1000,[0.605,0.833,1.137,1.327,1.593,1.878,2.201,3.066]],[1120,[0.679,0.934,1.273,1.485,1.782,2.1,2.46,3.425]],[1250,[0.749,1.034,1.413,1.65,1.982,2.337,2.74,3.818]]];
  const FOLGA_MIN_TABELA = [[30,[0,0.015,0.023,0.029,0.037,0.045,0.051,0.076]],[35,[0,0.017,0.027,0.034,0.043,0.048,0.059,0.089]],[40,[0.012,0.021,0.033,0.036,0.047,0.058,0.071,0.105]],[45,[0.014,0.025,0.034,0.043,0.055,0.067,0.082,0.12]],[50,[0.018,0.025,0.04,0.049,0.063,0.077,0.093,0.136]],[55,[0.019,0.026,0.043,0.053,0.068,0.084,0.102,0.149]],[60,[0.022,0.03,0.048,0.06,0.076,0.093,0.113,0.165]],[70,[0.02,0.036,0.057,0.07,0.08,0.099,0.121,0.18]],[80,[0.026,0.044,0.06,0.075,0.096,0.118,0.144,0.212]],[90,[0.029,0.05,0.067,0.084,0.108,0.133,0.162,0.239]],[100,[0.035,0.058,0.078,0.097,0.124,0.152,0.184,0.271]],[110,[0.04,0.056,0.089,0.11,0.14,0.171,0.207,0.302]],[120,[0.036,0.064,0.1,0.122,0.156,0.19,0.229,0.334]],[140,[0.04,0.072,0.113,0.139,0.176,0.215,0.259,0.377]],[160,[0.052,0.088,0.136,0.166,0.208,0.253,0.304,0.44]],[180,[0.063,0.104,0.158,0.192,0.24,0.291,0.348,0.503]],[200,[0.069,0.115,0.175,0.213,0.267,0.324,0.388,0.581]],[225,[0.082,0.133,0.201,0.243,0.303,0.366,0.439,0.632]],[250,[0.096,0.153,0.229,0.276,0.343,0.414,0.495,0.711]],[280,[0.106,0.17,0.255,0.308,0.382,0.462,0.552,0.793]],[315,[0.125,0.196,0.291,0.351,0.434,0.523,0.624,0.895]],[355,[0.141,0.222,0.329,0.396,0.49,0.59,0.704,1.009]],[400,[0.165,0.256,0.376,0.452,0.558,0.671,0.799,1.143]],[450,[0.187,0.289,0.425,0.51,0.629,0.756,0.901,1.287]],[500,[0.215,0.329,0.481,0.576,0.709,0.851,1.013,1.445]],[560,[0.24,0.367,0.537,0.643,0.791,0.95,1.13,1.613]],[630,[0.276,0.419,0.609,0.728,0.895,1.074,1.276,1.852]],[710,[0.31,0.471,0.685,0.819,1.007,1.208,1.436,2.046]],[800,[0.358,0.539,0.781,0.932,1.143,1.37,1.626,2.313]],[900,[0.403,0.607,0.879,1.049,1.287,1.542,1.831,2.605]],[1000,[0.459,0.687,0.991,1.181,1.447,1.732,2.055,2.92]],[1120,[0.508,0.765,1.102,1.314,1.611,1.929,2.289,3.254]],[1250,[0.578,0.863,1.242,1.479,1.811,2.166,2.569,3.647]]];
  const VG_TABELA = {"1":[68,46,46,32,32],"2":[100,68,46,46,32],"3":[150,100,68,46,46]};
  const _MANCAL_BD = [0.125,0.166667,0.25,0.333333,0.5,0.625,0.75,0.875,1.0,1.25,1.5];
  const _MANCAL_EPS = [0.05,0.1,0.15,0.2,0.25,0.3,0.35,0.4,0.45,0.5,0.55,0.6,0.65,0.7,0.725,0.75,0.775,0.8,0.825,0.85,0.875,0.9,0.91,0.92,0.93,0.94,0.95,0.96,0.97,0.98,0.99];
  const _MANCAL_SO = [[0.0012265,0.0024955,0.0038531,0.0053522,0.0070582,0.0090554,0.011458,0.014424,0.018188,0.023102,0.029719,0.038959,0.052437,0.073203,0.08807,0.10759,0.13391,0.17058,0.22375,0.30499,0.43795,0.67767,0.83097,1.0419,1.3435,1.7963,2.5216,3.7929,6.3436,12.776,39.346],[0.0021704,0.0044155,0.0068158,0.0094641,0.012475,0.015994,0.020221,0.025433,0.032031,0.040625,0.052167,0.068233,0.091573,0.12735,0.15285,0.1862,0.23098,0.293,0.38237,0.51773,0.73689,1.1264,1.3722,1.7074,2.1812,2.8824,3.9855,5.8745,9.5478,18.416,52.265],[0.0048222,0.0098062,0.015126,0.020983,0.027621,0.035355,0.044606,0.055958,0.070258,0.088769,0.11346,0.14754,0.19657,0.27078,0.32309,0.3909,0.48097,0.6042,0.77915,1.0394,1.4511,2.1603,2.5971,3.1813,3.9887,5.153,6.9307,9.8611,15.286,27.542,70.128],[0.00843,0.017134,0.026406,0.036584,0.048077,0.061409,0.077274,0.096634,0.12086,0.15199,0.19317,0.24946,0.32948,0.44896,0.53218,0.63899,0.77927,0.96871,1.2334,1.6201,2.2189,3.222,3.8258,4.6217,5.7027,7.2301,9.5103,13.166,19.737,34.023,81.337],[0.018151,0.036846,0.056663,0.078264,0.10244,0.13018,0.16281,0.20208,0.25049,0.31166,0.39106,0.49731,0.64475,0.85855,1.0039,1.1871,1.4227,1.7334,2.1563,2.7559,3.6508,5.0915,5.9327,7.0166,8.4575,10.444,13.33,17.825,25.633,42.015,94.083],[0.027245,0.055246,0.084808,0.11684,0.15243,0.19291,0.24003,0.29614,0.36447,0.44968,0.5587,0.70233,0.89807,1.1765,1.3627,1.5945,1.889,2.272,2.7854,3.501,4.5508,6.2059,7.1582,8.3749,9.9755,12.163,15.302,20.14,28.452,45.656,99.608],[0.037515,0.075987,0.11643,0.16,0.20802,0.26216,0.32454,0.39797,0.48635,0.59512,0.73239,0.91051,1.1495,1.4834,1.7038,1.9754,2.3169,2.756,3.3384,4.1395,5.2999,7.1055,8.1341,9.4404,11.15,13.468,16.776,21.844,30.485,48.225,103.42],[0.048657,0.098448,0.15057,0.20638,0.26742,0.33562,0.41341,0.50399,0.61171,0.74268,0.90578,1.1146,1.3908,1.771,2.0191,2.3226,2.7007,3.1833,3.817,4.6821,5.9233,7.836,8.9181,10.289,12.073,14.484,17.912,23.14,32.014,50.132,106.21],[0.060403,0.12208,0.18639,0.25483,0.32913,0.41143,0.50437,0.61146,0.73738,0.88869,1.0749,1.3104,1.618,2.0362,2.3065,2.6351,3.0419,3.5575,4.2308,5.1434,6.4441,8.4354,9.5581,10.975,12.814,15.294,18.81,24.156,33.201,51.601,108.33],[0.084832,0.17112,0.2604,0.35435,0.45494,0.56453,0.68606,0.82336,0.98153,1.1677,1.392,1.67,2.0256,2.4998,2.8022,3.1662,3.613,4.1744,4.9007,5.8772,7.2578,9.3563,10.533,12.011,13.925,16.499,20.135,25.641,34.922,53.71,111.34],[0.10941,0.22032,0.33429,0.45307,0.57867,0.71353,0.86069,1.0241,1.2091,1.4229,1.6762,1.9849,2.3738,2.8852,3.2083,3.5948,4.0664,4.6562,5.4157,6.4317,7.8618,10.026,11.236,12.753,14.715,17.349,21.06,26.67,36.104,55.145,113.37]];
  const _MANCAL_BETA = [[86.36,82.73,79.1,75.48,71.86,68.25,64.64,61.03,57.42,53.79,50.14,46.45,42.7,38.86,36.89,34.88,32.81,30.69,28.48,26.17,23.72,21.09,19.96,18.79,17.55,16.24,14.83,13.29,11.57,9.56,6.97],[86.37,82.75,79.13,75.51,71.91,68.3,64.7,61.1,57.5,53.88,50.24,46.56,42.81,38.98,37.02,35.01,32.96,30.84,28.64,26.34,23.91,21.29,20.17,19.0,17.77,16.47,15.07,13.55,11.84,9.83,7.24],[86.4,82.8,79.21,75.62,72.04,68.46,64.88,61.31,57.72,54.13,50.51,46.85,43.14,39.33,37.39,35.4,33.36,31.26,29.08,26.79,24.38,21.79,20.68,19.53,18.31,17.02,15.63,14.11,12.4,10.37,7.71],[86.44,82.88,79.32,75.76,72.21,68.67,65.13,61.58,58.03,54.47,50.88,47.25,43.57,39.79,37.85,35.88,33.86,31.77,29.61,27.35,24.95,22.37,21.27,20.11,18.89,17.6,16.2,14.67,12.92,10.84,8.06],[86.53,83.07,79.6,76.14,72.68,69.23,65.77,62.3,58.83,55.34,51.82,48.26,44.63,40.92,39.01,37.06,35.05,32.99,30.84,28.58,26.18,23.58,22.46,21.29,20.04,18.71,17.26,15.66,13.82,11.59,8.58],[86.62,83.24,79.86,76.49,73.11,69.73,66.34,62.95,59.54,56.11,52.65,49.13,45.55,41.86,39.97,38.02,36.02,33.95,31.8,29.52,27.09,24.45,23.3,22.1,20.82,19.44,17.95,16.28,14.35,12.02,8.86],[86.72,83.43,80.15,76.86,73.57,70.27,66.97,63.65,60.31,56.94,53.53,50.07,46.51,42.85,40.95,39.01,37.01,34.93,32.75,30.44,27.97,25.26,24.08,22.85,21.52,20.1,18.54,16.81,14.8,12.38,9.08],[86.82,83.63,80.45,77.25,74.06,70.85,67.62,64.38,61.11,57.81,54.45,51.02,47.5,43.84,41.95,40.0,37.98,35.87,33.67,31.32,28.79,26.01,24.8,23.52,22.16,20.68,19.07,17.27,15.19,12.68,9.26],[86.92,83.84,80.75,77.66,74.56,71.44,68.3,65.13,61.93,58.68,55.37,51.98,48.48,44.82,42.92,40.96,38.92,36.79,34.54,32.15,29.56,26.7,25.46,24.14,22.73,21.21,19.54,17.67,15.53,12.93,9.41],[87.13,84.26,81.38,78.48,75.57,72.63,69.65,66.64,63.57,60.43,57.2,53.87,50.39,46.72,44.8,42.79,40.7,38.51,36.18,33.68,30.96,27.94,26.63,25.23,23.74,22.12,20.35,18.37,16.09,13.36,9.66],[87.34,84.67,81.99,79.29,76.56,73.79,70.98,68.1,65.15,62.11,58.96,55.67,52.2,48.5,46.54,44.5,42.35,40.08,37.66,35.05,32.2,29.03,27.64,26.17,24.6,22.89,21.03,18.95,16.56,13.7,9.86]];

  const OILS = {
    22: { rho15: 857, nu100: 4.3 },
    32: { rho15: 863, nu100: 5.4 },
    46: { rho15: 869, nu100: 6.8 },
    68: { rho15: 874, nu100: 8.7 },
    100: { rho15: 880, nu100: 11.2 },
    150: { rho15: 885, nu100: 14.7 },
    220: { rho15: 890, nu100: 19.0 }
  };
  const G = 9.81;
  const CP_OIL = 1785;
  const OIL_MODULUS = 1.4e9;
  const D_MIN = 24;
  const D_MAX = 1250;

  class BearingInputError extends Error {
    constructor(message, field) {
      super(message);
      this.name = 'BearingInputError';
      this.field = field;
    }
  }

  function numberOf(value, field, fallback) {
    if (value === undefined || value === null || value === '') {
      if (fallback !== undefined) return fallback;
      throw new BearingInputError(`Informe ${field}.`, field);
    }
    const parsed = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : Number(value);
    if (!Number.isFinite(parsed)) throw new BearingInputError(`${field} precisa ser um número válido.`, field);
    return parsed;
  }

  function positive(value, field, fallback) {
    const x = numberOf(value, field, fallback);
    if (!(x > 0)) throw new BearingInputError(`${field} deve ser maior que zero.`, field);
    return x;
  }

  function bounded(value, field, min, max, fallback) {
    const x = numberOf(value, field, fallback);
    if (x < min || x > max) throw new BearingInputError(`${field} deve ficar entre ${min} e ${max}.`, field);
    return x;
  }

  function roundOne(x) { return Math.round(x * 10) / 10; }
  function rightIndex(xs, value) {
    let lo = 0, hi = xs.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (xs[mid] <= value) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  const derivativeCache = new Map();
  function pchipDerivatives(xs, ys) {
    const n = xs.length;
    const h = new Array(n - 1), delta = new Array(n - 1), m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) {
      h[i] = xs[i + 1] - xs[i];
      delta[i] = (ys[i + 1] - ys[i]) / h[i];
    }
    m[0] = delta[0];
    m[n - 1] = delta[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (delta[i - 1] * delta[i] <= 0) continue;
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
    }
    return m;
  }

  function pchip(xs, ys, x, key) {
    let m = derivativeCache.get(key);
    if (!m) { m = pchipDerivatives(xs, ys); derivativeCache.set(key, m); }
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
    const last = xs.length - 1;
    if (x >= xs[last]) return ys[last] + m[last] * (x - xs[last]);
    const i = rightIndex(xs, x) - 1;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h;
    return (1 + 2 * t) * (1 - t) ** 2 * ys[i]
      + t * (1 - t) ** 2 * h * m[i]
      + t ** 2 * (3 - 2 * t) * ys[i + 1]
      + t ** 2 * (t - 1) * h * m[i + 1];
  }

  const LOG_BD = _MANCAL_BD.map(Math.log);
  const LOG_SO = _MANCAL_SO.map(row => row.map(Math.log));
  function bdLocation(bd) {
    const lb = Math.log(Math.min(Math.max(bd, _MANCAL_BD[0]), _MANCAL_BD.at(-1)));
    const j = Math.min(Math.max(rightIndex(LOG_BD, lb) - 1, 0), LOG_BD.length - 2);
    return [j, (lb - LOG_BD[j]) / (LOG_BD[j + 1] - LOG_BD[j])];
  }

  function sommerfeldFromEccentricity(eps, bd) {
    if (eps <= 0) return 0;
    const [j, w] = bdLocation(bd);
    const interp = (k, e) => pchip(_MANCAL_EPS, LOG_SO[k], e, `so${k}`);
    if (eps < _MANCAL_EPS[0]) {
      const base = Math.exp((1 - w) * interp(j, _MANCAL_EPS[0]) + w * interp(j + 1, _MANCAL_EPS[0]));
      return base * eps / _MANCAL_EPS[0];
    }
    return Math.exp((1 - w) * interp(j, eps) + w * interp(j + 1, eps));
  }

  function angleFromEccentricity(eps, bd) {
    const [j, w] = bdLocation(bd);
    const interp = (k, e) => pchip(_MANCAL_EPS, _MANCAL_BETA[k], e, `beta${k}`);
    if (eps < _MANCAL_EPS[0]) {
      const base = (1 - w) * interp(j, _MANCAL_EPS[0]) + w * interp(j + 1, _MANCAL_EPS[0]);
      return 90 + (base - 90) * Math.max(eps, 0) / _MANCAL_EPS[0];
    }
    const e = Math.min(eps, _MANCAL_EPS.at(-1));
    return (1 - w) * interp(j, e) + w * interp(j + 1, e);
  }

  function eccentricityFromSommerfeld(so, bd) {
    if (so <= 0) return { epsilon: 0, limited: false };
    const low = sommerfeldFromEccentricity(_MANCAL_EPS[0], bd);
    if (so <= low) return { epsilon: so / low * _MANCAL_EPS[0], limited: false };
    const end = _MANCAL_EPS.at(-1);
    if (so >= sommerfeldFromEccentricity(end, bd)) return { epsilon: end, limited: true };
    let a = _MANCAL_EPS[0], b = end;
    for (let i = 0; i < 60; i++) {
      const mid = (a + b) / 2;
      if (sommerfeldFromEccentricity(mid, bd) < so) a = mid;
      else b = mid;
    }
    return { epsilon: (a + b) / 2, limited: false };
  }

  function oilViscosity(vg, tempC) {
    if (!OILS[vg]) throw new BearingInputError(`ISO VG ${vg} não cadastrado.`, 'vg');
    const nu40 = Number(vg), nu100 = OILS[vg].nu100;
    const t1 = Math.log10(313.15), t2 = Math.log10(373.15);
    const y1 = Math.log10(Math.log10(nu40 + 0.7));
    const y2 = Math.log10(Math.log10(nu100 + 0.7));
    const b = (y1 - y2) / (t2 - t1), a = y1 + b * t1;
    let nu = 10 ** (10 ** (a - b * Math.log10(tempC + 273.15))) - 0.7;
    if (Math.abs(tempC - 40) < 1e-12) nu = nu40;
    const rho = OILS[vg].rho15 * (1 - 0.00065 * (tempC - 15));
    return { dynamicPaS: nu * 1e-6 * rho, kinematicMm2S: nu, densityKgM3: rho };
  }

  function peripheralVelocity(diameterMm, rpm) {
    return Math.PI * diameterMm / 1000 * rpm / 60;
  }

  function filmLimit(diameterMm, velocityMS) {
    const fd = diameterMm <= 63 ? 1 : diameterMm <= 160 ? 2 : diameterMm < 400 ? 3
      : diameterMm <= 1000 ? 4 : diameterMm <= 2500 ? 5 : 6;
    const fv = velocityMS <= 0.3 ? 2 : velocityMS <= 3 ? 3 : velocityMS <= 10 ? 4 : velocityMS <= 30 ? 5 : 6;
    return { mm: H_LIM_TABELA[fd][fv - 2], diameterBand: fd, velocityBand: fv };
  }

  function recommendedPsi(diameterMm, velocityMS) {
    const fd = diameterMm <= 100 ? 1 : diameterMm <= 250 ? 2 : diameterMm <= 500 ? 3 : 4;
    const fv = velocityMS <= 3 ? 2 : velocityMS <= 10 ? 3 : velocityMS <= 25 ? 4 : velocityMS <= 50 ? 5 : 6;
    return PSI_TABELA[fd][fv - 2];
  }

  function it7Hole(diameterMm) {
    const pair = IT7_FURO.find(([limit]) => diameterMm <= limit + 1e-9);
    if (!pair) throw new BearingInputError('Diâmetro acima da tabela H7.', 'diameterMm');
    return pair[1];
  }

  function clearanceRange(diameterMm, psiPermille) {
    if (!(D_MIN < diameterMm && diameterMm <= D_MAX))
      throw new BearingInputError('Diâmetro fora da tabela de folga (mais de 24 até 1250 mm).', 'diameterMm');
    const j = PSI_SERIE.findIndex(x => Math.abs(x - psiPermille) < 1e-9);
    if (j < 0) throw new BearingInputError(`ψ deve ser um destes valores: ${PSI_SERIE.join(', ')} ‰.`, 'psiPermille');
    const rowMax = FOLGA_MAX_TABELA.find(([limit]) => diameterMm <= limit + 1e-9);
    const rowMin = FOLGA_MIN_TABELA.find(([limit]) => diameterMm <= limit + 1e-9);
    const maxMm = rowMax[1][j], minMm = rowMin[1][j];
    if (!(maxMm > 0)) throw new BearingInputError('A tabela não define folga para esses parâmetros.', 'psiPermille');
    return { minMm, maxMm };
  }

  function recommendedOil(pressureMPa, velocityMS) {
    const ip = pressureMPa <= 1.25 ? 1 : pressureMPa <= 2.5 ? 2 : 3;
    const iv = [3, 10, 25, 50].findIndex(limit => velocityMS <= limit);
    return VG_TABELA[ip][iv < 0 ? 4 : iv];
  }

  function hydroCase(label, loadN, diameterMm, lengthMm, rpm, psi, dynamicPaS) {
    const d = diameterMm / 1000, l = lengthMm / 1000;
    const omega = 2 * Math.PI * rpm / 60;
    const pPa = loadN / (d * l);
    const sommerfeld = pPa * psi ** 2 / (dynamicPaS * omega);
    const { epsilon, limited } = eccentricityFromSommerfeld(sommerfeld, l / d);
    const betaDeg = angleFromEccentricity(epsilon, l / d);
    const frictionOverPsi = Math.PI / (sommerfeld * Math.sqrt(1 - epsilon ** 2))
      + epsilon / 2 * Math.sin(betaDeg * Math.PI / 180);
    const frictionCoefficient = psi * frictionOverPsi;
    const powerLossW = frictionCoefficient * loadN * omega * d / 2;
    const filmThicknessM = d / 2 * psi * (1 - epsilon);
    return {
      label, psi, dynamicPaS, sommerfeld, eccentricity: epsilon, attitudeAngleDeg: betaDeg,
      frictionCoefficient, powerLossW, filmThicknessM, filmThicknessUm: filmThicknessM * 1e6,
      limited, regime: sommerfeld > 1 ? 'carga elevada (So > 1)' : 'alta velocidade (So < 1)'
    };
  }

  function thermalBalance(loadN, diameterMm, lengthMm, rpm, psi, vg,
    housingAreaM2, heatTransferWm2K, ambientTemperatureC) {
    const residual = t => {
      const eta = oilViscosity(vg, t).dynamicPaS;
      const loss = hydroCase('', loadN, diameterMm, lengthMm, rpm, psi, eta).powerLossW;
      return loss - heatTransferWm2K * housingAreaM2 * (t - ambientTemperatureC);
    };
    let a = ambientTemperatureC + 0.01, b = 250;
    let ga = residual(a), gb = residual(b);
    if (gb > 0) return { temperatureC: b, converged: false };
    if (ga <= 0) return { temperatureC: a, converged: true };
    let side = 0, c = (a + b) / 2;
    for (let i = 0; i < 100; i++) {
      c = (a * gb - b * ga) / (gb - ga);
      const gc = residual(c);
      if (gc > 0) {
        a = c; ga = gc;
        if (side === 1) gb *= 0.5;
        side = 1;
      } else {
        b = c; gb = gc;
        if (side === -1) ga *= 0.5;
        side = -1;
      }
      if (b - a < 1e-7 || Math.abs(gc) < 1e-7) break;
    }
    return { temperatureC: c, converged: true };
  }

  function calculate(input) {
    const raw = input || {};
    const rpm = positive(raw.rpm, 'rpm');
    if (rpm > 100000) throw new BearingInputError('Rotação fora da faixa plausível.', 'rpm');
    const shaftDiameterMm = raw.shaftDiameterMm == null || raw.shaftDiameterMm === ''
      ? null : positive(raw.shaftDiameterMm, 'shaftDiameterMm');
    const diameterMm = raw.diameterMm != null && raw.diameterMm !== ''
      ? positive(raw.diameterMm, 'diameterMm')
      : MANCAL_DIAMETROS.find(d => shaftDiameterMm != null && d >= shaftDiameterMm - 1e-9);
    if (!diameterMm) throw new BearingInputError('Informe o diâmetro do mancal ou uma ponta de eixo até 1250 mm.', 'diameterMm');
    if (!(D_MIN < diameterMm && diameterMm <= D_MAX))
      throw new BearingInputError('O diâmetro do mancal deve estar acima de 24 e até 1250 mm.', 'diameterMm');
    const bdInput = bounded(raw.bd, 'bd', 0.125, 1.5, 0.8);
    const lengthMm = raw.lengthMm != null && raw.lengthMm !== ''
      ? positive(raw.lengthMm, 'lengthMm') : roundOne(bdInput * diameterMm);
    const bd = lengthMm / diameterMm;
    if (bd < 0.125 - 1e-9 || bd > 1.5 + 1e-9)
      throw new BearingInputError('B/D calculado deve ficar entre 0,125 e 1,5.', 'lengthMm');
    const loadFractionPct = bounded(raw.loadFractionPct, 'loadFractionPct', 0.000001, 100, 50);
    const loadFactor = positive(raw.loadFactor, 'loadFactor', 1);
    const hasLoad = raw.loadN != null && raw.loadN !== '';
    const rotorMassKg = hasLoad ? null : positive(raw.rotorMassKg, 'rotorMassKg');
    const loadN = hasLoad ? positive(raw.loadN, 'loadN')
      : rotorMassKg * G * loadFractionPct / 100 * loadFactor;
    const temperatureMode = raw.temperatureMode === 'balance' ? 'balance' : 'provided';
    let temperatureC = bounded(raw.temperatureC, 'temperatureC', -30, 200, 40);
    const housingAreaM2 = temperatureMode === 'balance'
      ? positive(raw.housingAreaM2, 'housingAreaM2') : null;
    const heatTransferWm2K = positive(raw.heatTransferWm2K, 'heatTransferWm2K', 20);
    const ambientTemperatureC = bounded(raw.ambientTemperatureC, 'ambientTemperatureC', -30, 100, 40);
    const temperatureLimitC = positive(raw.temperatureLimitC, 'temperatureLimitC', 90);
    const pressureLimitMPa = positive(raw.pressureLimitMPa, 'pressureLimitMPa', 2.5);
    const volumeOilL = positive(raw.volumeOilL, 'volumeOilL', 17.5);
    const angularVelocityRadS = 2 * Math.PI * rpm / 60;
    const peripheralVelocityMS = peripheralVelocity(diameterMm, rpm);
    const pressureMPa = loadN / (diameterMm * lengthMm);
    const limit = filmLimit(diameterMm, peripheralVelocityMS);
    const psiPermille = raw.psiPermille != null && raw.psiPermille !== ''
      ? numberOf(raw.psiPermille, 'psiPermille')
      : recommendedPsi(diameterMm, peripheralVelocityMS);
    if (psiPermille == null)
      throw new BearingInputError('Velocidade acima de 50 m/s: informe ψ manualmente.', 'psiPermille');
    const clearance = clearanceRange(diameterMm, psiPermille);
    const h7ToleranceMm = it7Hole(diameterMm);
    const holeMinMm = diameterMm, holeMaxMm = diameterMm + h7ToleranceMm;
    const journalMaxMm = holeMinMm - clearance.minMm;
    const journalMinMm = holeMaxMm - clearance.maxMm;
    const fitFeasible = journalMinMm <= journalMaxMm + 1e-12;
    const psiMin = clearance.minMm / diameterMm;
    const psiMax = clearance.maxMm / diameterMm;
    const psiMean = (psiMin + psiMax) / 2;
    const vg = raw.vg != null && raw.vg !== '' ? numberOf(raw.vg, 'vg')
      : recommendedOil(pressureMPa, peripheralVelocityMS);
    if (!OILS[vg]) throw new BearingInputError('ISO VG não cadastrado.', 'vg');
    const balance = temperatureMode === 'balance'
      ? thermalBalance(loadN, diameterMm, lengthMm, rpm, psiMean, vg,
        housingAreaM2, heatTransferWm2K, ambientTemperatureC) : null;
    if (balance) temperatureC = balance.temperatureC;
    const viscosity = oilViscosity(vg, temperatureC);
    const cases = {
      min: hydroCase('folga mínima', loadN, diameterMm, lengthMm, rpm, psiMin, viscosity.dynamicPaS),
      mean: hydroCase('folga média', loadN, diameterMm, lengthMm, rpm, psiMean, viscosity.dynamicPaS),
      max: hydroCase('folga máxima', loadN, diameterMm, lengthMm, rpm, psiMax, viscosity.dynamicPaS)
    };
    const main = cases.mean;
    const critical = Object.values(cases).reduce((a, b) => a.filmThicknessM <= b.filmThicknessM ? a : b);
    const flowReferenceLS = peripheralVelocityMS * (diameterMm / 1000) * psiMax * (lengthMm / 1000) * 1000;
    const oilMassKg = volumeOilL / 1000 * OILS[vg].rho15;
    const heatingOneMinuteK = 60 * main.powerLossW / (oilMassKg * CP_OIL);
    const stiffnessCompressionNM = psiMin > 0
      ? loadN / ((pressureMPa * 1e6 / OIL_MODULUS) * (diameterMm / 1000) * psiMin) : null;
    const e1 = Math.max(main.eccentricity - 1e-4, 1e-4);
    const e2 = Math.min(main.eccentricity + 1e-4, _MANCAL_EPS.at(-1));
    const dSoDEpsilon = (sommerfeldFromEccentricity(e2, bd) - sommerfeldFromEccentricity(e1, bd)) / (e2 - e1);
    const radialClearanceM = main.psi * diameterMm / 2000;
    const stiffnessHydroNM = loadN / main.sommerfeld * dSoDEpsilon / radialClearanceM;
    const filmLimitUm = limit.mm * 1000;

    const warning = [], notes = [];
    let status = 'ok';
    if (balance && !balance.converged)
      warning.push('Balanço térmico sem equilíbrio abaixo de 250 °C.');
    if (critical.filmThicknessUm < filmLimitUm - 1e-9 || critical.limited) {
      status = 'falha';
      warning.push('Filme mínimo insuficiente no pior caso de folga. Aumente B/D ou a viscosidade, ou reduza a carga.');
    }
    if (critical.limited) warning.push('Sommerfeld exige excentricidade acima de 0,99; possível atrito misto.');
    const pressureFailureLimitMPa = Math.max(pressureLimitMPa, 5);
    if (pressureMPa > pressureFailureLimitMPa + 1e-12) {
      status = 'falha';
      warning.push(`Pressão específica acima do máximo de referência de ${pressureFailureLimitMPa} N/mm².`);
    } else if (pressureMPa > pressureLimitMPa + 1e-12) {
      if (status === 'ok') status = 'atencao';
      warning.push('Pressão específica acima do limite de referência adotado.');
    }
    if (balance && temperatureC > temperatureLimitC) {
      status = 'falha';
      warning.push(`Temperatura efetiva acima do limite de ${temperatureLimitC} °C.`);
    }
    if (!fitFeasible) {
      if (status === 'ok') status = 'atencao';
      warning.push('A faixa de folga é menor que a tolerância H7; o ajuste não é realizável com H7.');
    }
    if (main.eccentricity > 0.95 && !main.limited) {
      if (status === 'ok') status = 'atencao';
      warning.push('Excentricidade acima de 0,95: sensível a desalinhamento.');
    }
    if (main.sommerfeld < 1) notes.push('So < 1: verificar estabilidade do filme e risco de oil whirl.');
    if (shaftDiameterMm != null && diameterMm < shaftDiameterMm)
      notes.push('O colo do mancal é menor que a ponta de eixo informada.');
    if (!balance && Math.abs(temperatureC - 40) < 1e-9)
      notes.push('Viscosidade avaliada a 40 °C; confira a temperatura real de operação.');
    notes.push('Excentricidade e ângulo interpolados da solução de Reynolds do modelo; So usa velocidade angular.');
    const oilComparison = [...new Set([32, 46, 68, vg])].map(grade => {
      const gradeTemperatureC = balance
        ? thermalBalance(loadN, diameterMm, lengthMm, rpm, psiMean, grade,
          housingAreaM2, heatTransferWm2K, ambientTemperatureC).temperatureC
        : temperatureC;
      const oil = oilViscosity(grade, gradeTemperatureC);
      const run = hydroCase(`VG ${grade}`, loadN, diameterMm, lengthMm, rpm, psiMean, oil.dynamicPaS);
      return { vg: grade, ...run, temperatureC: gradeTemperatureC, kinematicMm2S: oil.kinematicMm2S,
        meetsFilm: run.filmThicknessUm >= filmLimitUm - 1e-9 && !run.limited, selected: grade === vg };
    });
    const rpmComparison = [[60, 2], [50, 2], [60, 4], [50, 4], [60, 6], [50, 6],
      [60, 8], [50, 8], [60, 10], [50, 10], [60, 12], [50, 12]].map(([frequencyHz, poles]) => {
      const speedRpm = 120 * frequencyHz / poles;
      const speedMS = peripheralVelocity(diameterMm, speedRpm);
      const psi = raw.psiPermille != null && raw.psiPermille !== ''
        ? psiPermille : recommendedPsi(diameterMm, speedMS);
      const filmUm = filmLimit(diameterMm, speedMS).mm * 1000;
      if (psi == null) return { frequencyHz, poles, rpm: speedRpm, peripheralVelocityMS: speedMS,
        recommendedVg: recommendedOil(pressureMPa, speedMS), filmLimitUm: filmUm, error: 'v > 50 m/s' };
      const range = clearanceRange(diameterMm, psi);
      const average = (range.minMm + range.maxMm) / 2 / diameterMm;
      const speedTemperatureC = balance
        ? thermalBalance(loadN, diameterMm, lengthMm, speedRpm, average, vg,
          housingAreaM2, heatTransferWm2K, ambientTemperatureC).temperatureC
        : temperatureC;
      const speedViscosity = balance ? oilViscosity(vg, speedTemperatureC).dynamicPaS : viscosity.dynamicPaS;
      const run = hydroCase('', loadN, diameterMm, lengthMm, speedRpm, average, speedViscosity);
      return { frequencyHz, poles, rpm: speedRpm, peripheralVelocityMS: speedMS,
        recommendedVg: recommendedOil(pressureMPa, speedMS), psiPermille: psi,
        filmLimitUm: filmUm, temperatureC: speedTemperatureC, ...run,
        meetsFilm: run.filmThicknessUm >= filmUm - 1e-9 && !run.limited };
    });
    const temperatureComparison = [];
    for (let temp = 20; temp <= 100; temp += 5) {
      const oil = oilViscosity(vg, temp);
      const run = hydroCase('', loadN, diameterMm, lengthMm, rpm, psiMean, oil.dynamicPaS);
      temperatureComparison.push({ temperatureC: temp, dynamicPaS: oil.dynamicPaS,
        kinematicMm2S: oil.kinematicMm2S, filmThicknessUm: run.filmThicknessUm,
        powerLossW: run.powerLossW, sommerfeld: run.sommerfeld,
        eccentricity: run.eccentricity, meetsFilm: run.filmThicknessUm >= filmLimitUm - 1e-9 && !run.limited });
    }
    const radialClearanceUm = diameterMm / 2 * main.psi * 1000;
    const filmProfile = Array.from({ length: 73 }, (_, i) => {
      const angleDeg = i * 5;
      return { angleDeg, filmThicknessUm: radialClearanceUm *
        (1 + main.eccentricity * Math.cos(angleDeg * Math.PI / 180)) };
    });
    return {
      inputs: { shaftDiameterMm, diameterMm, lengthMm, bd, rpm, loadN, rotorMassKg,
        loadFractionPct, loadFactor, temperatureC, temperatureMode, housingAreaM2,
        heatTransferWm2K, ambientTemperatureC, temperatureLimitC,
        psiPermille, vg, pressureLimitMPa, volumeOilL },
      diameterMm, lengthMm, bd, loadN, rpm, angularVelocityRadS, peripheralVelocityMS,
      pressureMPa, pressureLimitMPa, filmLimitUm, filmLimitMm: limit.mm,
      psiPermille, clearanceMinMm: clearance.minMm, clearanceMaxMm: clearance.maxMm,
      relativeClearanceMin: psiMin, relativeClearanceMean: psiMean, relativeClearanceMax: psiMax,
      holeMinMm, holeMaxMm, h7ToleranceMm, journalMinMm, journalMaxMm,
      journalMeanMm: (journalMinMm + journalMaxMm) / 2,
      journalToleranceMm: (journalMaxMm - journalMinMm) / 2,
      fitFeasible, vg, oilViscosity: viscosity, temperatureC,
      temperatureMode, temperatureLimitC, thermalBalanceConverged: balance ? balance.converged : null,
      cases, main, critical, flowReferenceLS, oilMassKg, heatingOneMinuteK,
      stiffnessCompressionNM, stiffnessHydroNM, oilComparison, rpmComparison,
      temperatureComparison, filmProfile,
      filmSafetyRatio: critical.filmThicknessUm / filmLimitUm,
      pressureUtilization: pressureMPa / pressureLimitMPa,
      status, statusText: { ok: 'MANCAL ATENDE', atencao: 'MANCAL ATENDE COM RESSALVAS',
        falha: 'MANCAL NÃO ATENDE' }[status], warnings: warning, notes
    };
  }

  return { calculate, BearingInputError, oilViscosity, peripheralVelocity,
    filmLimit, recommendedPsi, clearanceRange, recommendedOil,
    sommerfeldFromEccentricity, angleFromEccentricity, eccentricityFromSommerfeld,
    hydroCase, availableOilGrades: Object.keys(OILS).map(Number), psiSeries: PSI_SERIE.slice(),
    bearingDiameters: MANCAL_DIAMETROS.slice() };
});

/* Dados dos gráficos técnicos. A matemática vem dos motores existentes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EngineeringCharts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function diameterSeries(result, shaftEngine) {
    const name = result.input.diameterSeries;
    if (name === 'DIN 748-1') return shaftEngine.meta.dinDiameters.slice();
    const step = name === 'Múltiplos de 5 mm' ? 5 : 10;
    const count = name === 'Múltiplos de 5 mm' ? 400 : 200;
    return Array.from({ length: count }, (_, i) => (i + 1) * step);
  }

  function shaftNeighbors(result, shaftEngine) {
    const series = diameterSeries(result, shaftEngine);
    const adopted = result.adoptedDiameterMm;
    if (!series.some(d => Math.abs(d - adopted) < 1e-9)) {
      series.push(adopted);
      series.sort((a, b) => a - b);
    }
    const index = series.findIndex(d => Math.abs(d - adopted) < 1e-9);
    const start = Math.max(0, Math.min(index - 4, series.length - 8));
    const diameters = series.slice(start, start + 8);
    return {
      demandKW: result.powerKW,
      material: result.material.name,
      seriesName: result.input.diameterSeries,
      bars: diameters.map(diameterMm => {
        const capacityKW = shaftEngine.formulas.maxPowerKW(diameterMm, result.rpm,
          result.fs, result.referenceShearMPa, result.safetyFactor);
        return { diameterMm, capacityKW, selected: Math.abs(diameterMm - adopted) < 1e-9,
          passes: capacityKW >= result.powerKW - 1e-9 };
      })
    };
  }

  function shaftMaterialCurves(result, shaftEngine) {
    const power = result.powerKW;
    const minPowerKW = Math.max(1, Math.min(1000, power / 10));
    const maxPowerKW = Math.max(1000, Math.min(100000, power * 20), power * 3);
    const curves = result.materialComparison.map((item, index) => {
      const tauMPa = item.selected ? result.referenceShearMPa : item.tauMPa;
      const points = Array.from({ length: 65 }, (_, i) => {
        const powerKW = minPowerKW * (maxPowerKW / minPowerKW) ** (i / 64);
        const torqueNm = shaftEngine.formulas.torqueNm(powerKW, result.rpm);
        return { powerKW, diameterMm: shaftEngine.formulas.minimumDiameterMm(
          torqueNm, result.fs, tauMPa, result.safetyFactor) };
      });
      return { material: item.material, selected: item.selected, eligible: item.temperatureOK && item.weldingOK,
        index, points };
    });
    return { minPowerKW, maxPowerKW, curves,
      operation: { powerKW: result.powerKW, diameterMm: result.minDiameterMm,
        adoptedDiameterMm: result.adoptedDiameterMm } };
  }

  function bearingPolar(result, bearingEngine) {
    const references = [0.25, 0.5, 1];
    const ratios = references.filter(bd => Math.abs(bd - result.bd) > 1e-6);
    ratios.push(result.bd);
    const curves = ratios.map(bd => ({
      bd, selected: Math.abs(bd - result.bd) < 1e-6,
      points: Array.from({ length: 64 }, (_, i) => {
        const epsilon = 0.02 + 0.97 * i / 63;
        return { epsilon, betaDeg: bearingEngine.angleFromEccentricity(epsilon, bd) };
      })
    }));
    return { curves, operating: {
      min: { epsilon: result.cases.min.eccentricity, betaDeg: result.cases.min.attitudeAngleDeg },
      mean: { epsilon: result.main.eccentricity, betaDeg: result.main.attitudeAngleDeg },
      max: { epsilon: result.cases.max.eccentricity, betaDeg: result.cases.max.attitudeAngleDeg }
    } };
  }

  function bearingRpm(result, bearingEngine) {
    const points = result.rpmComparison
      .filter(item => !item.error && Number.isFinite(item.filmThicknessUm) && Number.isFinite(item.rpm))
      .map(item => ({ rpm: item.rpm, filmUm: item.filmThicknessUm, limitUm: item.filmLimitUm, current: false }))
      .sort((a, b) => a.rpm - b.rpm);
    const unique = points.filter((item, index) => index === 0 || Math.abs(item.rpm - points[index - 1].rpm) > 1e-6);
    const current = { rpm: result.rpm, filmUm: result.main.filmThicknessUm,
      limitUm: result.filmLimitUm, current: true };
    const atCurrent = unique.findIndex(item => Math.abs(item.rpm - result.rpm) < 1e-6);
    if (atCurrent >= 0) unique[atCurrent] = current;
    else unique.push(current);
    unique.sort((a, b) => a.rpm - b.rpm);
    const minRpm = Math.min(...unique.map(item => item.rpm));
    const maxRpm = Math.max(...unique.map(item => item.rpm));
    const diameterM = result.diameterMm / 1000;
    const velocityLimits = [0.3, 3, 10, 30, 50];
    const boundaries = velocityLimits.map(v => v * 60 / (Math.PI * diameterM))
      .filter(rpm => rpm > minRpm && rpm < maxRpm);
    const filmLimitAt = rpm => bearingEngine.filmLimit(result.diameterMm,
      bearingEngine.peripheralVelocity(result.diameterMm, rpm)).mm * 1000;
    const limitSteps = [{ rpm: minRpm, limitUm: filmLimitAt(minRpm) }];
    for (const boundary of boundaries) {
      limitSteps.push({ rpm: boundary, limitUm: filmLimitAt(boundary - 1e-6) });
      limitSteps.push({ rpm: boundary, limitUm: filmLimitAt(boundary + 1e-6) });
    }
    limitSteps.push({ rpm: maxRpm, limitUm: filmLimitAt(maxRpm) });
    return { points: unique, limitSteps, minRpm, maxRpm, current };
  }

  return { shaftNeighbors, shaftMaterialCurves, bearingPolar, bearingRpm };
});

(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js-ready');
  const themeButton = document.querySelector('#theme-toggle');
  const menuButton = document.querySelector('#menu-toggle');
  const menu = document.querySelector('#nav-links');
  const progress = document.querySelector('#top-progress');
  const tabs = [...document.querySelectorAll('.calc-tab')];
  const formatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

  function setTheme(theme) {
    root.dataset.theme = theme;
    themeButton.setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
    themeButton.querySelector('.theme-icon').textContent = theme === 'dark' ? '☼' : '☾';
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#071a1e' : '#f4f7f4';
    try { localStorage.setItem('vg-theme', theme); } catch (_) { /* Private browsing may block storage. */ }
  }

  let savedTheme = null;
  try { savedTheme = localStorage.getItem('vg-theme'); } catch (_) { /* Use system preference. */ }
  setTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  themeButton.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));

  function closeMenu() {
    menu.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Abrir menu');
  }
  menuButton.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: .08, rootMargin: '0px 0px -25px 0px' });
    document.querySelectorAll('.reveal').forEach(element => revealObserver.observe(element));
  } else {
    document.querySelectorAll('.reveal').forEach(element => element.classList.add('is-visible'));
  }

  const sectionLinks = [...menu.querySelectorAll('a[href^="#"]')];
  if ('IntersectionObserver' in window) {
    const activeObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          sectionLinks.forEach(link => link.classList.toggle('is-active', link.hash === `#${entry.target.id}`));
        }
      });
    }, { rootMargin: '-25% 0px -65% 0px' });
    document.querySelectorAll('main > section[id]').forEach(section => activeObserver.observe(section));
  }

  let scrollScheduled = false;
  function updateProgress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = max > 0 ? `${Math.min(100, scrollY / max * 100)}%` : '0%';
    scrollScheduled = false;
  }
  addEventListener('scroll', () => {
    if (!scrollScheduled) { requestAnimationFrame(updateProgress); scrollScheduled = true; }
  }, { passive: true });
  addEventListener('resize', updateProgress);
  updateProgress();
  document.querySelector('#year').textContent = new Date().getFullYear();

  function selectTab(tab, focus = false) {
    tabs.forEach(item => {
      const selected = item === tab;
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[next], true);
    });
  });

  // Accept either comma or dot as the decimal separator, but never ambiguous
  // thousands formatting. This keeps inputs predictable across browser locales.
  function readNumber(form, name, options = {}) {
    const input = form.elements.namedItem(name);
    const raw = input.value.trim().replace(/\s/g, '');
    const label = input.dataset.label || name;
    const validSyntax = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(raw);
    const value = validSyntax ? Number(raw.replace(',', '.')) : NaN;
    const min = options.min ?? 0;
    const max = options.max ?? Number.POSITIVE_INFINITY;
    const valid = Number.isFinite(value) && value >= min && value <= max && (!options.integer || Number.isInteger(value));
    input.setAttribute('aria-invalid', String(!valid));
    if (!valid) {
      let requirement = `um número entre ${formatter.format(min)} e ${formatter.format(max)}`;
      if (!Number.isFinite(max)) requirement = `um número ${min > 0 ? 'maior que zero' : 'igual ou maior que zero'}`;
      if (options.integer) requirement = `um número inteiro entre ${formatter.format(min)} e ${formatter.format(max)}`;
      throw new Error(`${label}: informe ${requirement}.`);
    }
    return value;
  }

  const positive = { min: Number.EPSILON };
  const calculators = {
    synchronous(form) {
      const frequency = readNumber(form, 'frequency', positive);
      const poles = readNumber(form, 'poles', { min: 2, max: 100, integer: true });
      if (poles % 2 !== 0) {
        form.elements.namedItem('poles').setAttribute('aria-invalid', 'true');
        throw new Error('Número de polos: use um inteiro par (2, 4, 6…).');
      }
      return { value: 120 * frequency / poles, unit: 'rpm', detail: `Para ${formatter.format(frequency)} Hz e ${poles} polos.` };
    },
    torque(form) {
      const power = readNumber(form, 'power', positive);
      const rpm = readNumber(form, 'rpm', positive);
      const torque = power * 1000 / (2 * Math.PI * rpm / 60);
      return { value: torque, unit: 'N·m', detail: 'Potência informada como potência mecânica no eixo.' };
    },
    current(form) {
      const power = readNumber(form, 'power', positive);
      const voltage = readNumber(form, 'voltage', positive);
      const powerFactor = readNumber(form, 'powerFactor', { min: Number.EPSILON, max: 1 });
      const efficiency = readNumber(form, 'efficiency', { min: Number.EPSILON, max: 1 });
      const current = power * 1000 / (Math.sqrt(3) * voltage * powerFactor * efficiency);
      return { value: current, unit: 'A', detail: 'Corrente de linha estimada em regime permanente; não representa a corrente de partida.' };
    },
    slip(form) {
      const syncRpm = readNumber(form, 'syncRpm', positive);
      const rotorRpm = readNumber(form, 'rotorRpm', { min: 0 });
      if (rotorRpm > syncRpm) {
        form.elements.namedItem('rotorRpm').setAttribute('aria-invalid', 'true');
        throw new Error('Velocidade do rotor: em regime motor, use valor igual ou menor que a velocidade síncrona.');
      }
      const slip = (syncRpm - rotorRpm) / syncRpm * 100;
      return { value: slip, unit: '%', detail: `Diferença de ${formatter.format(syncRpm - rotorRpm)} rpm entre campo e rotor.` };
    },
    conversion(form) {
      const value = readNumber(form, 'value', { min: 0 });
      const rpmToRad = form.elements.namedItem('direction').value === 'rpm-to-rad';
      return rpmToRad
        ? { value: value * 2 * Math.PI / 60, unit: 'rad/s', detail: `${formatter.format(value)} rpm × 2π / 60` }
        : { value: value * 60 / (2 * Math.PI), unit: 'rpm', detail: `${formatter.format(value)} rad/s × 60 / 2π` };
    }
  };

  document.querySelectorAll('[data-calc-form]').forEach(form => {
    form.addEventListener('input', event => {
      if (event.target.matches('input')) event.target.removeAttribute('aria-invalid');
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      form.querySelectorAll('input').forEach(input => input.removeAttribute('aria-invalid'));
      const result = form.parentElement.querySelector('.calc-result');
      try {
        const output = calculators[form.dataset.calcForm](form);
        if (!Number.isFinite(output.value)) throw new Error('O resultado excedeu o limite numérico. Revise as entradas.');
        result.classList.remove('is-error');
        result.querySelector('strong').textContent = `${formatter.format(output.value)} ${output.unit}`;
        result.querySelector('p').textContent = output.detail;
      } catch (error) {
        result.classList.add('is-error');
        result.querySelector('strong').textContent = 'Confira os dados';
        result.querySelector('p').textContent = error.message;
        form.querySelector('[aria-invalid="true"]')?.focus();
      }
    });
  });

  const conversionDirection = document.querySelector('[name="direction"]');
  conversionDirection.addEventListener('change', () => {
    const isRpm = conversionDirection.value === 'rpm-to-rad';
    document.querySelector('#conversion-unit').textContent = isRpm ? 'rpm' : 'rad/s';
    const input = conversionDirection.form.elements.namedItem('value');
    input.value = isRpm ? '1800' : '188,5';
    const result = conversionDirection.closest('.calc-panel').querySelector('.calc-result');
    result.classList.remove('is-error');
    result.querySelector('strong').textContent = '—';
    result.querySelector('p').textContent = 'Insira o valor e converta.';
  });
})();

/* Interface do estúdio de dimensionamento. Os motores são declarados acima neste arquivo. */
(() => {
  'use strict';
  const shaftForm = document.getElementById('shaft-form');
  const bearingForm = document.getElementById('bearing-form');
  if (!shaftForm || !bearingForm) return;
  const svgNS = 'http://www.w3.org/2000/svg';
  let lastShaft = null, lastBearing = null, scheduled = false;

  const fmt = (value, digits = 2) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value);
  const $ = selector => document.querySelector(selector);
  const set = (selector, value) => { const node = $(selector); if (node) node.textContent = value; };
  const field = (form, name) => form.elements.namedItem(name);
  function numberFrom(form, name, optional = false) {
    const input = field(form, name);
    const raw = input.value.trim().replace(/\s/g, '');
    input.removeAttribute('aria-invalid');
    if (!raw && optional) return null;
    if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(raw)) {
      input.setAttribute('aria-invalid', 'true');
      throw new Error(`${input.closest('label')?.childNodes[0]?.textContent.trim() || name}: informe um número válido.`);
    }
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value)) throw new Error(`${name}: número fora da faixa.`);
    return value;
  }
  function node(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text != null) item.textContent = text;
    return item;
  }
  function svg(tag, attrs = {}) {
    const item = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([key, value]) => item.setAttribute(key, String(value)));
    return item;
  }
  function status(selector, kind, title, detail) {
    const box = $(selector);
    box.classList.toggle('is-attention', kind === 'atencao');
    box.classList.toggle('is-failure', kind === 'falha');
    box.classList.toggle('is-error', kind === 'error');
    box.querySelector('strong').textContent = title;
    box.querySelector('small').textContent = detail;
  }
  function messages(selector, warnings = [], notes = []) {
    const box = $(selector);
    box.replaceChildren();
    warnings.forEach(message => box.append(node('div', 'lab-message warning', message)));
    notes.slice(0, 5).forEach(message => box.append(node('div', 'lab-message', message)));
  }

  function syncShaftFields() {
    const mode = field(shaftForm, 'rotationMode').value;
    const unit = field(shaftForm, 'powerUnit').value;
    const apparent = unit === 'kVA' || unit === 'MVA';
    shaftForm.querySelectorAll('[data-shaft-poles]').forEach(item => item.hidden = mode === 'rpm');
    shaftForm.querySelectorAll('[data-shaft-rpm]').forEach(item => item.hidden = mode !== 'rpm');
    field(shaftForm, 'convertKva').closest('.lab-check').hidden = !apparent;
    shaftForm.querySelector('[data-shaft-kva]').hidden = !(apparent && field(shaftForm, 'convertKva').checked);
    set('#shaft-power-help', apparent
      ? (field(shaftForm, 'convertKva').checked ? 'A potência aparente será convertida em potência mecânica no eixo.' : 'Convenção do procedimento: kVA é usado numericamente como kW. Ative a conversão para usar cos φ e rendimento.')
      : 'Valor considerado como potência mecânica no eixo.');
  }
  function syncBearingFields() {
    const balance = field(bearingForm, 'temperatureMode').value === 'balance';
    bearingForm.querySelector('[data-bearing-balance]').hidden = !balance;
    bearingForm.querySelector('[data-bearing-temp]').hidden = balance;
    bearingForm.querySelector('[data-bearing-mass]').hidden = field(bearingForm, 'loadN').value.trim() !== '';
  }
  function shaftInput() {
    const unit = field(shaftForm, 'powerUnit').value;
    const mode = field(shaftForm, 'rotationMode').value;
    const convertApparent = (unit === 'kVA' || unit === 'MVA') && field(shaftForm, 'convertKva').checked;
    return {
      machineType: field(shaftForm, 'machineType').value,
      power: numberFrom(shaftForm, 'power'), powerUnit: unit,
      convertKva: convertApparent,
      powerFactor: convertApparent ? numberFrom(shaftForm, 'cosPhi') : .8,
      efficiency: convertApparent ? numberFrom(shaftForm, 'efficiency') : .97,
      rotationMode: mode,
      frequency: mode === 'polos' ? numberFrom(shaftForm, 'frequency') : 60,
      poles: mode === 'polos' ? numberFrom(shaftForm, 'poles') : 4,
      slipPercent: mode === 'polos' ? numberFrom(shaftForm, 'slipPercent') : 0,
      directRpm: mode === 'rpm' ? numberFrom(shaftForm, 'rpm') : null,
      application: field(shaftForm, 'application').value, customFs: numberFrom(shaftForm, 'customFs', true),
      material: field(shaftForm, 'material').value, criterion: field(shaftForm, 'criterion').value,
      safetyFactor: numberFrom(shaftForm, 'safetyFactor'), diameterSeries: field(shaftForm, 'diameterSeries').value,
      existingDiameterMm: numberFrom(shaftForm, 'existingDiameterMm', true),
      peakTorqueMultiple: numberFrom(shaftForm, 'peakTorqueMultiple', true),
      minOperatingTempC: numberFrom(shaftForm, 'minOperatingTempC', true),
      requiresWelding: field(shaftForm, 'requiresWelding').checked
    };
  }
  function renderShaftDiagram(result) {
    const diameter = result.adoptedDiameterMm;
    const height = Math.max(58, Math.min(155, 55 + diameter * .31));
    const y = 137 - height / 2;
    const body = $('#shaft-diagram .shaft-body');
    body.setAttribute('y', y); body.setAttribute('height', height);
    for (const selector of ['.shaft-ellipse-left', '.shaft-ellipse-right']) {
      const item = $('#shaft-diagram ' + selector);
      item.setAttribute('ry', height / 2);
    }
    $('#shaft-diagram .shaft-ellipse-face').setAttribute('ry', Math.max(18, height / 2 - 9));
    const dimension = $('#shaft-diagram .dimension-line');
    dimension.setAttribute('y1', y); dimension.setAttribute('y2', y + height);
    set('#shaft-diagram-d', `Ø ${fmt(diameter, 1)} mm`);
    set('#shaft-visual-adopted', `${fmt(diameter, 1)} mm`);
    set('#shaft-visual-min', `${fmt(result.minDiameterMm, 1)} mm`);
    set('#shaft-visual-bearing', lastBearing ? `${fmt(lastBearing.diameterMm ?? diameter, 1)} mm` : 'Aguardando cálculo');
  }
  function renderCriteria(result) {
    const box = $('#criterion-bars');
    box.replaceChildren();
    const rows = [
      ['Seção 5/8', result.criteria.section5],
      ['Seção 9', result.criteria.section9]
    ];
    const max = Math.max(...rows.map(([, item]) => item.minDiameterMm)) * 1.06;
    for (const [label, item] of rows) {
      const chosen = result.governingCriterion === item.criterion;
      const row = node('div', `criterion-row${chosen ? ' is-governing' : ''}`);
      const heading = node('div', 'criterion-row-top');
      heading.append(node('strong', '', label), node('span', '', `${fmt(item.minDiameterMm, 1)} mm`));
      const track = node('div', 'criterion-track');
      const bar = node('i'); bar.style.width = `${item.minDiameterMm / max * 100}%`;
      track.append(bar);
      row.append(heading, track, node('small', '', `τ = ${fmt(item.tauMPa, 1)} MPa · normalizado: ${fmt(item.normalizedDiameterMm, 0)} mm${chosen ? ' · critério governante' : ''}`));
      box.append(row);
    }
  }
  function renderMaterials(result) {
    const box = $('#material-comparison');
    box.replaceChildren();
    const max = Math.max(...result.materialComparison.map(row => row.normalizedDiameterMm));
    result.materialComparison.forEach(item => {
      const row = node('div', `material-row${item.selected ? ' selected' : ''}`);
      row.append(node('strong', '', item.material));
      const track = node('div', 'material-track');
      const bar = node('i'); bar.style.width = `${item.normalizedDiameterMm / max * 100}%`;
      track.append(bar); row.append(track);
      row.append(node('span', '', `${fmt(item.normalizedDiameterMm, 0)} mm`));
      row.title = item.weldingOK && item.temperatureOK ? `d mínimo ${fmt(item.minDiameterMm, 1)} mm` : 'Não atende à condição opcional de solda ou temperatura';
      box.append(row);
    });
  }
  function chartText(target, x, y, value, className, anchor = 'start', extra = {}) {
    const label = svg('text', { x, y, 'text-anchor': anchor, class: className, ...extra });
    label.textContent = value;
    target.append(label);
    return label;
  }
  function chartTitle(target, value) { const title = svg('title'); title.textContent = value; target.append(title); }
  function chartStep(raw) {
    const scale = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
    const fraction = raw / scale;
    return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * scale;
  }
  function chartPath(points) {
    return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  }
  function renderShaftNeighbors(result) {
    const data = EngineeringCharts.shaftNeighbors(result, ShaftEngine);
    const chart = $('#shaft-neighbor-chart'); chart.replaceChildren();
    const W = 760, H = 390, L = 76, R = 22, T = 25, B = 60;
    const step = chartStep(Math.max(data.demandKW, ...data.bars.map(item => item.capacityKW)) / 5);
    const yMax = Math.ceil(Math.max(data.demandKW, ...data.bars.map(item => item.capacityKW)) / step) * step;
    const y = value => H - B - value / yMax * (H - T - B);
    for (let value = 0; value <= yMax + step / 10; value += step) {
      const yy = y(value);
      chart.append(svg('line', { x1:L, y1:yy, x2:W-R, y2:yy, class:'chart-gridline' }));
      chartText(chart, L-10, yy+5, fmt(value,0), 'chart-label', 'end');
    }
    const slot = (W - L - R) / data.bars.length;
    data.bars.forEach((item, i) => {
      const width = Math.min(54, slot * .64);
      const x = L + slot * (i + .5) - width / 2;
      const bar = svg('rect', { x, y:y(item.capacityKW), width, height:H-B-y(item.capacityKW), rx:5,
        class:`capacity-bar ${item.selected ? 'selected' : item.passes ? 'passes' : 'fails'}` });
      chartTitle(bar, `${fmt(item.diameterMm,0)} mm · capacidade ${fmt(item.capacityKW,0)} kW · ${item.passes ? 'atende' : 'não atende'}`);
      chart.append(bar);
      chartText(chart, x+width/2, H-B+25, fmt(item.diameterMm,0),
        `chart-label capacity-x-label${item.selected ? ' selected' : ''}`, 'middle');
      if (item.selected || (i+1 < data.bars.length && !item.passes && data.bars[i+1].passes)) {
        chartText(chart, x+width/2, Math.max(T+14,y(item.capacityKW)-10), fmt(item.capacityKW,0),
          `chart-value-label${item.selected ? ' selected' : ''}`, 'middle');
      }
    });
    const demandY = y(data.demandKW);
    chart.append(svg('line', { x1:L, y1:demandY, x2:W-R, y2:demandY, class:'capacity-demand' }));
    chartText(chart, L+9, Math.max(T+18,demandY-9), `P de cálculo = ${fmt(data.demandKW,0)} kW`,
      'capacity-demand-label');
    chartText(chart, (L+W-R)/2, H-8, `${data.seriesName} · diâmetro (mm)`,
      'chart-axis-title', 'middle');
    chartText(chart, 19, (T+H-B)/2, 'Capacidade (kW)', 'chart-axis-title', 'middle',
      { transform:`rotate(-90 19 ${(T+H-B)/2})` });
    set('#shaft-neighbor-context', `${data.material} · ${fmt(result.rpm,0)} rpm · FS ${fmt(result.fs,2)} · SF ${fmt(result.safetyFactor,0)}`);
  }
  function renderShaftMaterialCurves(result) {
    const data = EngineeringCharts.shaftMaterialCurves(result, ShaftEngine);
    const chart = $('#shaft-diameter-power-chart'); chart.replaceChildren();
    const W = 760, H = 400, L = 76, R = 22, T = 26, B = 64;
    const maxDiameter = Math.max(...data.curves.flatMap(row => row.points.map(point => point.diameterMm)));
    const step = chartStep(maxDiameter / 6);
    const yMax = Math.ceil(maxDiameter / step) * step;
    const logMin = Math.log10(data.minPowerKW), logSpan = Math.log10(data.maxPowerKW) - logMin;
    const x = power => L + (Math.log10(power) - logMin) / logSpan * (W - L - R);
    const y = diameter => H - B - diameter / yMax * (H - T - B);
    for (let value = 0; value <= yMax + step / 10; value += step) {
      const yy = y(value);
      chart.append(svg('line', { x1:L,y1:yy,x2:W-R,y2:yy,class:'chart-gridline' }));
      chartText(chart,L-10,yy+5,fmt(value,0),'chart-label','end');
    }
    for (let decade = Math.floor(logMin); decade <= Math.ceil(Math.log10(data.maxPowerKW)); decade++) {
      const power = 10 ** decade;
      if (power < data.minPowerKW || power > data.maxPowerKW) continue;
      const xx = x(power);
      chart.append(svg('line', { x1:xx,y1:T,x2:xx,y2:H-B,class:'chart-gridline' }));
      chartText(chart,xx,H-B+25,fmt(power,0),'chart-label','middle');
    }
    data.curves.filter(row => !row.selected).concat(data.curves.filter(row => row.selected)).forEach(row => {
      const path = svg('path', { d:chartPath(row.points.map(point => [x(point.powerKW),y(point.diameterMm)])),
        class:`material-curve material-${row.index}${row.selected ? ' selected' : ''}${row.eligible ? '' : ' ineligible'}` });
      chartTitle(path, `${row.material}${row.selected ? ' · selecionado' : ''}`);
      chart.append(path);
    });
    const ox=x(data.operation.powerKW), oy=y(data.operation.diameterMm);
    chart.append(svg('line', { x1:ox,y1:oy,x2:ox,y2:H-B,class:'chart-guide' }));
    const point = svg('circle', { cx:ox,cy:oy,r:7,class:'chart-operation-point' });
    chartTitle(point, `${fmt(data.operation.powerKW,0)} kW · mínimo ${fmt(data.operation.diameterMm,1)} mm · adotado ${fmt(data.operation.adoptedDiameterMm,0)} mm`);
    chart.append(point);
    chartText(chart, ox+12, Math.max(T+14,oy-11), 'OPERAÇÃO', 'chart-operation-label');
    chartText(chart, (L+W-R)/2,H-8,'Potência de cálculo (kW) · escala logarítmica','chart-axis-title','middle');
    chartText(chart,19,(T+H-B)/2,'Diâmetro mínimo (mm)','chart-axis-title','middle',
      { transform:`rotate(-90 19 ${(T+H-B)/2})` });
    const legend = $('#shaft-material-legend'); legend.replaceChildren();
    data.curves.forEach(row => {
      const item = node('span', `material-legend-item${row.selected ? ' selected' : ''}`);
      item.append(node('i', `material-swatch material-${row.index}`),
        node('span', '', `${row.material}${row.selected ? ' · selecionado' : ''}`));
      legend.append(item);
    });
    set('#shaft-curve-context', `${fmt(data.operation.powerKW,0)} kW → d mínimo ${fmt(data.operation.diameterMm,1)} mm → Ø adotado ${fmt(data.operation.adoptedDiameterMm,0)} mm`);
  }
  function renderTrace(result) {
    const box = $('#shaft-trace'); box.replaceChildren();
    result.trace.forEach((item, index) => {
      const row = node('div', 'trace-row');
      row.append(node('span', '', String(index+1).padStart(2, '0')));
      const text = node('div'); text.append(node('strong', '', `${item.label} · ${fmt(item.result, 2)} ${item.unit || ''}`), node('p', '', item.formula));
      row.append(text); box.append(row);
    });
  }
  function renderShaft(result) {
    status('#shaft-status', result.status, result.statusText, `${result.material.name} · FS ${fmt(result.fs, 2)} · ${fmt(result.powerKW, 0)} kW no eixo`);
    set('#shaft-kpi-d', `${fmt(result.adoptedDiameterMm, 1)} mm`);
    set('#shaft-kpi-series', result.verification ? 'Diâmetro existente verificado' : result.input.diameterSeries);
    set('#shaft-kpi-min', `${fmt(result.minDiameterMm, 1)} mm`);
    set('#shaft-kpi-criterion', result.governingCriterion === 'SECAO_9' ? 'Critério da seção 9' : 'Critério da seção 5/8');
    set('#shaft-kpi-torque', `${fmt(result.torqueNm, 0)} N·m`);
    set('#shaft-kpi-speed', `${fmt(result.rpm, 0)} rpm`);
    set('#shaft-kpi-util', `${fmt(result.utilization * 100, 1)}%`);
    set('#shaft-kpi-margin', result.utilization <= 1 ? 'Abaixo da capacidade' : 'Acima da capacidade');
    set('#shaft-gauge-value', `${fmt(result.utilization * 100, 1)}%`);
    $('#shaft-gauge').style.strokeDashoffset = String(345.58 * (1 - Math.max(0, Math.min(result.utilization, 1))));
    set('#shaft-capacity-power', `${fmt(result.maxPowerKW, 0)} kW`);
    set('#shaft-capacity-sf', `${fmt(result.actualSafetyFactor, 2)}`);
    renderShaftDiagram(result); renderCriteria(result); renderMaterials(result);
    renderShaftNeighbors(result); renderShaftMaterialCurves(result); renderTrace(result);
    messages('#shaft-messages', result.warnings, result.notes);
  }

  function bearingInput(shaft) {
    const load = numberFrom(bearingForm, 'loadN', true);
    const mass = load == null ? numberFrom(bearingForm, 'rotorMassKg', true) : null;
    const mode = field(bearingForm, 'temperatureMode').value;
    return {
      shaftDiameterMm: shaft.adoptedDiameterMm, rpm: shaft.rpm,
      loadN: load, rotorMassKg: load == null ? mass : null,
      loadFractionPct: load == null ? numberFrom(bearingForm, 'loadFractionPct') : 50,
      loadFactor: load == null ? numberFrom(bearingForm, 'loadFactor') : 1,
      diameterMm: numberFrom(bearingForm, 'diameterMm', true),
      bd: numberFrom(bearingForm, 'bd'), lengthMm: numberFrom(bearingForm, 'lengthMm', true),
      vg: field(bearingForm, 'vg').value ? Number(field(bearingForm, 'vg').value) : null,
      temperatureMode: mode,
      temperatureC: mode === 'provided' ? numberFrom(bearingForm, 'temperatureC') : 40,
      housingAreaM2: mode === 'balance' ? numberFrom(bearingForm, 'housingAreaM2') : null,
      ambientTemperatureC: mode === 'balance' ? numberFrom(bearingForm, 'ambientTemperatureC') : 40,
      heatTransferWm2K: mode === 'balance' ? numberFrom(bearingForm, 'heatTransferWm2K') : 20,
      temperatureLimitC: mode === 'balance' ? numberFrom(bearingForm, 'temperatureLimitC') : 90,
      psiPermille: numberFrom(bearingForm, 'psiPermille', true)
    };
  }
  function renderFilm(result) {
    const box = $('#bearing-film-chart'); box.replaceChildren();
    const entries = [
      ['Folga menor', result.clearanceMinMm, result.cases.min],
      ['Folga central', (result.clearanceMinMm + result.clearanceMaxMm) / 2, result.cases.mean],
      ['Folga maior', result.clearanceMaxMm, result.cases.max]
    ];
    const max = Math.max(result.filmLimitUm, ...entries.map(([, , item]) => item.filmThicknessUm)) * 1.07;
    entries.forEach(([label, clearanceMm, item]) => {
      const row = node('div', `film-row${item === result.critical ? ' critical' : ''}`);
      const heading = node('div', 'film-row-heading');
      heading.append(node('span', 'film-row-name', label),
        node('strong', 'film-row-value', `${fmt(item.filmThicknessUm, 2)} µm`));
      const track = node('div', 'film-track'); const bar = node('i');
      bar.style.width = `${Math.max(0, Math.min(100, item.filmThicknessUm / max * 100))}%`;
      track.append(bar);
      const detail = node('div', 'film-row-detail');
      detail.append(node('span', '', `Folga diametral ${fmt(clearanceMm * 1000, 1)} µm`),
        node('span', '', `Excentricidade ε ${fmt(item.eccentricity, 3)}`));
      row.append(heading, track, detail); box.append(row);
    });
    box.append(node('div', 'film-limit', `Limite da tabela: ${fmt(result.filmLimitUm, 1)} µm · pior filme: ${fmt(result.critical.filmThicknessUm, 2)} µm (${fmt(result.critical.filmThicknessUm / result.filmLimitUm, 2)}× o limite)`));
  }
  function renderOils(result) {
    const box = $('#bearing-oil-comparison'); box.replaceChildren();
    const max = Math.max(...result.oilComparison.map(item => item.filmThicknessUm));
    result.oilComparison.forEach(item => {
      const row = node('div', `oil-row${item.selected ? ' selected' : ''}`);
      const label = node('div'); label.append(node('strong', '', `VG ${item.vg}`), node('small', '', item.selected ? 'selecionado' : 'comparação'));
      row.append(label);
      const track = node('div', 'oil-bar'); const bar = node('i');
      bar.style.width = `${Math.max(0, Math.min(100, item.filmThicknessUm / max * 100))}%`;
      track.append(bar); row.append(track);
      const value = node('span', '', `${fmt(item.filmThicknessUm, 1)} µm`);
      value.append(node('small', '', `${fmt(item.powerLossW / 1000, 2)} kW de perda`));
      row.append(value); box.append(row);
    });
  }
  function renderTemperature(result) {
    const chart = $('#bearing-temperature-chart'); chart.replaceChildren();
    const data = result.temperatureComparison;
    const W = 350, H = 190, L = 37, R = 12, T = 15, B = 29;
    const yMax = Math.max(result.filmLimitUm, ...data.map(item => item.filmThicknessUm)) * 1.15;
    const x = temp => L + (temp - 20) / 80 * (W - L - R);
    const y = film => H - B - film / yMax * (H - T - B);
    [0, .5, 1].forEach(part => {
      const yy = y(yMax * part); chart.append(svg('line', { x1:L,y1:yy,x2:W-R,y2:yy,class:'chart-gridline' }));
      const text = svg('text', { x:L-5,y:yy+3,'text-anchor':'end',class:'chart-label' });
      text.textContent = fmt(yMax*part,0); chart.append(text);
    });
    [20,60,100].forEach(temp => {
      const text = svg('text', { x:x(temp),y:H-6,'text-anchor':'middle',class:'chart-label' });
      text.textContent = `${temp}°C`; chart.append(text);
    });
    chart.append(svg('line', { x1:L,y1:y(result.filmLimitUm),x2:W-R,y2:y(result.filmLimitUm),class:'chart-guide' }));
    const path = data.map((item,i) => `${i?'L':'M'}${x(item.temperatureC).toFixed(2)} ${y(item.filmThicknessUm).toFixed(2)}`).join(' ');
    chart.append(svg('path', { d:path,class:'chart-curve' }));
    if (result.temperatureC >= 20 && result.temperatureC <= 100) {
      const targetTemp = result.temperatureC;
      const targetFilm = data.reduce((best,item) => Math.abs(item.temperatureC-targetTemp) < Math.abs(best.temperatureC-targetTemp) ? item : best, data[0]).filmThicknessUm;
      chart.append(svg('circle', { cx:x(targetTemp),cy:y(targetFilm),r:5,class:'chart-point' }));
    }
    const label = svg('text', { x:W-R-2,y:y(result.filmLimitUm)-5,'text-anchor':'end',class:'chart-legend' });
    label.textContent = `LIMITE ${fmt(result.filmLimitUm,0)} µm`; chart.append(label);
  }
  function renderBearingPolar(result) {
    const data = EngineeringCharts.bearingPolar(result, BearingEngine);
    const chart = $('#bearing-polar-chart'); chart.replaceChildren();
    const W = 420, H = 330, cx = 318, cy = 28, radius = 244;
    const point = (epsilon, betaDeg) => {
      const angle = betaDeg * Math.PI / 180;
      return [cx - radius * epsilon * Math.sin(angle), cy + radius * epsilon * Math.cos(angle)];
    };
    for (let epsilon = .2; epsilon <= 1.001; epsilon += .2) {
      const r = radius * epsilon;
      chart.append(svg('path', { d:`M${cx-r} ${cy} A${r} ${r} 0 0 0 ${cx} ${cy+r}`, class:'polar-grid' }));
      chartText(chart,cx+7,cy+r+4,fmt(epsilon,1),'polar-axis-label');
    }
    for (let beta = 0; beta <= 90; beta += 15) {
      const [ex,ey] = point(1,beta);
      chart.append(svg('line', { x1:cx,y1:cy,x2:ex,y2:ey,class:'polar-grid' }));
      const [lx,ly] = point(1.09,beta);
      chartText(chart,lx,ly+4,`${beta}°`,'polar-axis-label','middle');
    }
    data.curves.filter(row => !row.selected).concat(data.curves.filter(row => row.selected)).forEach(row => {
      const path = svg('path', { d:chartPath(row.points.map(item => point(item.epsilon,item.betaDeg))),
        class:`polar-curve${row.selected ? ' selected' : ''}` });
      chartTitle(path, `B/D ${fmt(row.bd,3)}${row.selected ? ' · configuração atual' : ' · referência'}`);
      chart.append(path);
    });
    for (const [name,item] of Object.entries(data.operating)) {
      const [x,y] = point(item.epsilon,item.betaDeg);
      const dot = svg('circle', { cx:x,cy:y,r:name === 'mean' ? 7 : 5,
        class:name === 'mean' ? 'polar-current' : 'polar-endpoint' });
      chartTitle(dot, `${name === 'mean' ? 'Folga central' : name === 'min' ? 'Folga menor' : 'Folga maior'} · ε ${fmt(item.epsilon,3)} · β ${fmt(item.betaDeg,1)}°`);
      chart.append(dot);
    }
    set('#bearing-polar-context', `B/D ${fmt(result.bd,3)} · ε ${fmt(result.main.eccentricity,3)} · β ${fmt(result.main.attitudeAngleDeg,1)}° na folga central`);
  }
  function renderBearingRpm(result) {
    const data = EngineeringCharts.bearingRpm(result, BearingEngine);
    const chart = $('#bearing-rpm-chart'); chart.replaceChildren();
    const W = 620, H = 340, L = 61, R = 18, T = 25, B = 56;
    const span = Math.max(1,data.maxRpm-data.minRpm);
    const xMin = Math.max(0,data.minRpm-span*.025), xMax = data.maxRpm+span*.025;
    const peak = Math.max(...data.points.map(item => item.filmUm),...data.limitSteps.map(item => item.limitUm));
    const yStep = chartStep(peak/5), yMax = Math.ceil(peak/yStep)*yStep;
    const x = rpm => L + (rpm-xMin)/(xMax-xMin)*(W-L-R);
    const y = film => H-B-film/yMax*(H-T-B);
    for (let value=0; value<=yMax+yStep/10; value+=yStep) {
      const yy=y(value);
      chart.append(svg('line', { x1:L,y1:yy,x2:W-R,y2:yy,class:'chart-gridline' }));
      chartText(chart,L-10,yy+5,fmt(value,0),'chart-label','end');
    }
    const xStep=chartStep(span/7);
    for (let rpm=Math.ceil(data.minRpm/xStep)*xStep; rpm<=data.maxRpm+1e-6; rpm+=xStep) {
      const xx=x(rpm);
      chart.append(svg('line', { x1:xx,y1:T,x2:xx,y2:H-B,class:'chart-gridline' }));
      chartText(chart,xx,H-B+25,fmt(rpm,0),'chart-label','middle');
    }
    chart.append(svg('path', { d:chartPath(data.limitSteps.map(item => [x(item.rpm),y(item.limitUm)])),
      class:'rpm-limit-curve' }));
    chart.append(svg('path', { d:chartPath(data.points.map(item => [x(item.rpm),y(item.filmUm)])),
      class:'rpm-film-curve' }));
    data.points.forEach(item => {
      const dot=svg('circle', { cx:x(item.rpm),cy:y(item.filmUm),r:item.current ? 7 : 4,
        class:item.current ? 'rpm-current' : 'rpm-point' });
      chartTitle(dot, `${fmt(item.rpm,0)} rpm · filme ${fmt(item.filmUm,2)} µm · limite ${fmt(item.limitUm,0)} µm`);
      chart.append(dot);
    });
    chartText(chart,(L+W-R)/2,H-8,'Rotação (rpm)','chart-axis-title','middle');
    chartText(chart,18,(T+H-B)/2,'Filme mínimo (µm)','chart-axis-title','middle',
      { transform:`rotate(-90 18 ${(T+H-B)/2})` });
    set('#bearing-rpm-context', `${fmt(result.rpm,0)} rpm → filme ${fmt(result.main.filmThicknessUm,1)} µm · limite ${fmt(result.filmLimitUm,0)} µm`);
  }
  function renderBearing(result) {
    status('#bearing-status', result.status, result.statusText, `${fmt(result.rpm, 0)} rpm · B/D ${fmt(result.bd, 3)} · ψ ${fmt(result.psiPermille, 2)}‰`);
    set('#bearing-kpi-film', `${fmt(result.critical.filmThicknessUm, 1)} µm`);
    set('#bearing-kpi-limit', `${fmt(result.filmLimitUm, 1)} µm`);
    set('#bearing-kpi-pressure', `${fmt(result.pressureMPa, 2)} MPa`);
    set('#bearing-kpi-load', `${fmt(result.loadN, 0)} N de carga radial`);
    set('#bearing-kpi-oil', `VG ${result.vg}`);
    set('#bearing-kpi-temp', `${fmt(result.temperatureC, 0)} °C · ${fmt(result.peripheralVelocityMS, 1)} m/s`);
    set('#shaft-visual-bearing', `${fmt(result.diameterMm, 1)} mm`);
    set('#bearing-diagram-label', `h mín ${fmt(result.critical.filmThicknessUm, 1)} µm`);
    const offset = 5 + Math.max(0,Math.min(.99,result.critical.eccentricity)) * 4;
    $('#bearing-rotor').setAttribute('cx', 175 + offset);
    $('#bearing-rotor').setAttribute('cy', 150 + offset * .25);
    $('#bearing-offset-point').setAttribute('cx', 175 + offset);
    $('#bearing-offset-point').setAttribute('cy', 150 + offset * .25);
    $('#bearing-ecc-line').setAttribute('x2', 175 + offset);
    $('#bearing-ecc-line').setAttribute('y2', 150 + offset * .25);
    renderFilm(result); renderOils(result); renderTemperature(result);
    renderBearingPolar(result); renderBearingRpm(result);
    const metrics = $('#bearing-metrics'); metrics.replaceChildren();
    [
      ['Velocidade periférica', `${fmt(result.peripheralVelocityMS, 2)} m/s`],
      ['Sommerfeld', fmt(result.main.sommerfeld, 3)],
      ['Excentricidade ε', fmt(result.main.eccentricity, 3)],
      ['Ângulo β', `${fmt(result.main.attitudeAngleDeg, 1)}°`],
      ['Perda por atrito', `${fmt(result.main.powerLossW / 1000, 2)} kW`],
      ['Folga diametral', `${fmt(result.clearanceMinMm, 3)}–${fmt(result.clearanceMaxMm, 3)} mm`]
    ].forEach(([label,value]) => { const item = node('div','bearing-metric'); item.append(node('span','',label),node('strong','',value)); metrics.append(item); });
    messages('#bearing-messages', result.warnings, result.notes);
  }
  function renderError(which, error) {
    const detail = error?.errors?.join(' · ') || error?.message || 'Revise os dados informados.';
    status(which === 'shaft' ? '#shaft-status' : '#bearing-status', 'error', 'Revise os dados de entrada', detail);
    messages(which === 'shaft' ? '#shaft-messages' : '#bearing-messages', [detail]);
    if (which === 'shaft') {
      ['#shaft-kpi-d','#shaft-kpi-min','#shaft-kpi-torque','#shaft-kpi-util','#shaft-gauge-value','#shaft-capacity-power','#shaft-capacity-sf','#shaft-visual-adopted','#shaft-visual-min','#shaft-visual-bearing','#shaft-diagram-d'].forEach(item => set(item, '—'));
      ['#criterion-bars','#material-comparison','#shaft-neighbor-chart','#shaft-diameter-power-chart','#shaft-material-legend','#shaft-trace'].forEach(item => $(item).replaceChildren());
      set('#shaft-neighbor-context','—'); set('#shaft-curve-context','—');
      $('#shaft-gauge').style.strokeDashoffset = '345.58';
    } else {
      ['#bearing-kpi-film','#bearing-kpi-limit','#bearing-kpi-pressure','#bearing-kpi-oil','#bearing-diagram-label'].forEach(item => set(item, '—'));
      ['#bearing-film-chart','#bearing-metrics','#bearing-oil-comparison','#bearing-temperature-chart','#bearing-polar-chart','#bearing-rpm-chart'].forEach(item => $(item).replaceChildren());
      set('#bearing-polar-context','—'); set('#bearing-rpm-context','—');
    }
  }
  function recalculate() {
    scheduled = false;
    syncShaftFields();
    syncBearingFields();
    try { lastShaft = ShaftEngine.calculate(shaftInput()); renderShaft(lastShaft); }
    catch (error) { lastShaft = null; lastBearing = null; renderError('shaft', error); return; }
    try { lastBearing = BearingEngine.calculate(bearingInput(lastShaft)); renderBearing(lastBearing); }
    catch (error) { lastBearing = null; set('#shaft-visual-bearing', 'Aguardando carga'); renderError('bearing', error); }
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(recalculate); } }
  [shaftForm, bearingForm].forEach(form => {
    form.addEventListener('input', schedule);
    form.addEventListener('change', schedule);
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('reset', () => requestAnimationFrame(schedule));
  });
  document.querySelectorAll('.lab-workspace').forEach(studio => {
    const switchTo = (view, scroll = false) => {
      studio.dataset.view = view;
      studio.querySelectorAll('[data-studio-view]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.studioView === view));
      });
      if (scroll && matchMedia('(max-width: 920px)').matches) {
        studio.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
    };
    studio.querySelectorAll('[data-studio-view]').forEach(button => {
      button.addEventListener('click', () => switchTo(button.dataset.studioView));
    });
    studio.querySelector('.studio-show-results')?.addEventListener('click', () => switchTo('results', true));
  });
  $('#shaft-download').addEventListener('click', () => {
    if (!lastShaft) return;
    const data = JSON.stringify({ generatedAt: new Date().toISOString(), shaft: lastShaft, bearing: lastBearing }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type:'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'dimensionamento-eixo-mancal.json';
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  recalculate();
})();

