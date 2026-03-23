"use client";
import { useState, useEffect, useCallback } from "react";

/* ═══ Config ═══ */
const INVEST = 1000000;

/* ═══ 商品結構類型分類系統 ═══ */
var PRODUCT_TYPES = {
  FCN:        { label: "FCN", full: "Fixed Coupon Note", color: "#1A56DB", desc: "固定配息 + Autocall + Barrier（期末觀察）" },
  STEPDOWN:   { label: "StepDown FCN", full: "StepDown Fixed Coupon Note", color: "#7C3AED", desc: "FCN + Autocall界限逐期遞減" },
  DAC:        { label: "DAC", full: "Daily Accumulator", color: "#0891B2", desc: "每日觀察累計，非期末Barrier" },
  SNOWBALL:   { label: "Snowball", full: "Snowball Note", color: "#2563EB", desc: "配息具記憶累積，錯過可補發" },
  PHOENIX:    { label: "Phoenix", full: "Phoenix Note", color: "#DB2777", desc: "條件式配息，標的高於水位才配息" },
  ELN:        { label: "ELN", full: "Equity Linked Note", color: "#059669", desc: "到期看標的表現決定現金或股票" },
  RANGE:      { label: "Range Accrual", full: "Range Accrual Note", color: "#D97706", desc: "標的在區間內天數按比例計息" },
  PP:         { label: "保本型", full: "Principal Protected Note", color: "#4B5563", desc: "到期保證返還一定比例本金" },
  OTHER:      { label: "其他", full: "Other", color: "#6B7280", desc: "未歸類或特殊結構" },
};
var PT_KEYS = Object.keys(PRODUCT_TYPES);

/* ═══ 自動分類判斷規則 ═══ */
function autoClassify(product) {
  if (!product) return "OTHER";
  var pp = product.principalProtection;
  if (pp != null && pp > 0) return "PP";

  var ac = (product.autocallType || "").toLowerCase();
  var bo = (product.barrierObservation || "").toLowerCase();
  var name = ((product.name || "") + " " + (product.nameEn || "")).toLowerCase();
  var couponFreq = (product.couponFrequency || "").toLowerCase();

  if (name.indexOf("accumulator") >= 0 || name.indexOf("accum") >= 0 || name.indexOf("daily accu") >= 0)
    return "DAC";
  if (name.indexOf("range accrual") >= 0 || name.indexOf("區間累計") >= 0 || name.indexOf("range acc") >= 0)
    return "RANGE";
  if (name.indexOf("snowball") >= 0 || name.indexOf("雪球") >= 0)
    return "SNOWBALL";
  if (name.indexOf("phoenix") >= 0 || name.indexOf("鳳凰") >= 0)
    return "PHOENIX";
  if (name.indexOf("equity linked") >= 0 || name.indexOf("eln") >= 0)
    return "ELN";

  var hasAutocall = ac.indexOf("autocall") >= 0 || ac.indexOf("自動提前出場") >= 0 || name.indexOf("autocall") >= 0 || name.indexOf("自動提前出場") >= 0;
  var hasFixedCoupon = name.indexOf("fixed coupon") >= 0 || name.indexOf("固定配息") >= 0;
  var hasStepDown = name.indexOf("step down") >= 0 || name.indexOf("step-down") >= 0 || name.indexOf("stepdown") >= 0 || name.indexOf("下階") >= 0 || name.indexOf("遞減") >= 0;

  if (hasStepDown && hasAutocall) return "STEPDOWN";
  if (hasFixedCoupon && hasAutocall) return "FCN";
  if (hasAutocall) return "FCN";

  return "OTHER";
}

/* ═══════════════════════════════════════════════════════
   發行機構辨識學習資料庫（16家）
   每家包含：辨識特徵、文件結構、專屬提取 prompt
   新增機構只需填入對應區塊並設 ready: true
   ═══════════════════════════════════════════════════════ */

const ISSUER_DB = {
  citi: {
    ready: true,
    name: "Citigroup (花旗)", short: "Citi", color: "#003B70",
    issuerEntity: "Citigroup Global Markets Holdings Inc. (CGMHI)",
    guarantor: "Citigroup Inc. 花旗集團",
    registeredIn: "美國",
    signatures: {
      isinPrefix: ["XS"],
      keywords: ["CGMHI", "Citigroup Global Markets Holdings", "Citigroup Inc", "花旗集團", "花旗環球證券"],
      address: ["388 Greenwich Street", "New York 10013"],
      agent: "花旗環球證券股份有限公司",
      calcAgent: "花旗銀行紐約分行",
      custodian: ["Euroclear", "Clearstream"],
      governingLaw: "英國法",
      logo: "citi",
    },
    docStructure: {
      title: "中文產品說明書",
      titlePattern: "CGMHI [天期] [幣別]計價(...) 連結...由花旗集團保證之...結構型商品",
      sections: ["一、商品基本資料", "二、相關機構事業概況", "三、商品風險揭露", "四、一般交易事項", "五、特別記載事項"],
      pageFormat: "第X頁，共Y頁",
    },
    productTypes: ["固定配息自動提前出場型(Autocall)", "記憶式自動提前出場", "連結股權結構型商品"],
    typicalStructure: {
      coupon: "固定配息，不受連結標的表現影響",
      autocall: "記憶式(Memory) — 一旦觸發，後續觀察日均視為已觸發",
      autocallFormula: "面額 × (m/M) × 配息率",
      barrier: "多為期末觀察(European/EKI)",
      underlying: "一籃子(Basket)，表現最差(Worst of)，常見3~5檔美股",
      maturity: "未觸及Barrier返還100%；觸及則實物交割表現最差標的",
      principalProtection: "通常不保本(0%)",
    },
    creditRating: { issuer: "Moody's A2 / S&P A / Fitch A+", guarantor: "Moody's A3 / S&P BBB+ / Fitch A" },
  },
  gs: {
    ready: false,
    name: "Goldman Sachs (高盛)", short: "GS", color: "#6B8CC7",
    issuerEntity: "Goldman Sachs International",
    signatures: { isinPrefix: ["XS"], keywords: ["Goldman Sachs", "高盛"], address: ["Plumtree Court", "London"] },
  },
  ms: {
    ready: false,
    name: "Morgan Stanley (摩根士丹利)", short: "MS", color: "#002B5C",
    issuerEntity: "Morgan Stanley Finance LLC / Morgan Stanley B.V.",
    signatures: { isinPrefix: ["XS", "US"], keywords: ["Morgan Stanley", "摩根士丹利"], address: ["1585 Broadway", "New York"] },
  },
  jpm: {
    ready: false,
    name: "J.P. Morgan (摩根大通)", short: "JPM", color: "#00539B",
    issuerEntity: "JPMorgan Chase Financial Company LLC",
    signatures: { isinPrefix: ["XS", "US"], keywords: ["JPMorgan", "J.P. Morgan", "摩根大通"], address: ["383 Madison Avenue"] },
  },
  bnp: {
    ready: false,
    name: "BNP Paribas (法巴)", short: "BNP", color: "#00915A",
    issuerEntity: "BNP Paribas Issuance B.V.",
    signatures: { isinPrefix: ["XS"], keywords: ["BNP Paribas", "法國巴黎", "法巴"], address: ["16 boulevard des Italiens", "Paris"] },
  },
  barclays: {
    ready: false,
    name: "Barclays (巴克萊)", short: "BARC", color: "#00AEEF",
    issuerEntity: "Barclays Bank PLC",
    signatures: { isinPrefix: ["XS"], keywords: ["Barclays", "巴克萊"], address: ["1 Churchill Place", "London"] },
  },
  hsbc: {
    ready: false,
    name: "HSBC (滙豐)", short: "HSBC", color: "#DB0011",
    issuerEntity: "HSBC Bank plc",
    signatures: { isinPrefix: ["XS"], keywords: ["HSBC", "滙豐", "汇丰"], address: ["8 Canada Square", "London"] },
  },
  ubs: {
    ready: false,
    name: "UBS (瑞銀)", short: "UBS", color: "#E60000",
    issuerEntity: "UBS AG",
    signatures: { isinPrefix: ["CH", "XS"], keywords: ["UBS", "瑞銀", "瑞士銀行"], address: ["Bahnhofstrasse", "Zurich"] },
  },
  socgen: {
    ready: false,
    name: "Société Générale (法興)", short: "SG", color: "#E60028",
    issuerEntity: "Société Générale / SG Issuer",
    signatures: { isinPrefix: ["XS"], keywords: ["Société Générale", "Societe Generale", "法興", "SG Issuer"], address: ["29 boulevard Haussmann", "Paris"] },
  },
  nomura: {
    ready: false,
    name: "Nomura (野村)", short: "NMR", color: "#E50012",
    issuerEntity: "Nomura International Funding Pte. Ltd.",
    signatures: { isinPrefix: ["XS"], keywords: ["Nomura", "野村"], address: ["1 Angel Lane", "London"] },
  },
  dbs: {
    ready: false,
    name: "DBS (星展)", short: "DBS", color: "#E21836",
    issuerEntity: "DBS Bank Ltd.",
    signatures: { isinPrefix: ["XS", "SG"], keywords: ["DBS", "星展"], address: ["12 Marina Boulevard", "Singapore"] },
  },
  scb: {
    ready: false,
    name: "Standard Chartered (渣打)", short: "SCB", color: "#0072AA",
    issuerEntity: "Standard Chartered Bank",
    signatures: { isinPrefix: ["XS"], keywords: ["Standard Chartered", "渣打"], address: ["1 Basinghall Avenue", "London"] },
  },
  bofa: {
    ready: false,
    name: "Bank of America (美銀)", short: "BofA", color: "#012169",
    issuerEntity: "BofA Finance LLC / Merrill Lynch International",
    signatures: { isinPrefix: ["XS", "US"], keywords: ["Bank of America", "BofA", "Merrill Lynch", "美銀", "美林"], address: ["One Bryant Park", "New York"] },
  },
  deutsche: {
    ready: false,
    name: "Deutsche Bank (德意志)", short: "DB", color: "#0018A8",
    issuerEntity: "Deutsche Bank AG",
    signatures: { isinPrefix: ["DE", "XS"], keywords: ["Deutsche Bank", "德意志銀行"], address: ["Taunusanlage", "Frankfurt"] },
  },
  macquarie: {
    ready: false,
    name: "Macquarie (麥格理)", short: "MQG", color: "#000000",
    issuerEntity: "Macquarie Bank Limited",
    signatures: { isinPrefix: ["AU", "XS"], keywords: ["Macquarie", "麥格理"], address: ["50 Martin Place", "Sydney"] },
  },
  credit_agricole: {
    ready: false,
    name: "Crédit Agricole (法農)", short: "CA", color: "#00634A",
    issuerEntity: "Crédit Agricole CIB Financial Products",
    signatures: { isinPrefix: ["XS"], keywords: ["Crédit Agricole", "Credit Agricole", "法農", "法國農業信貸"], address: ["12 place des États-Unis", "Montrouge"] },
  },
};

/* ═══ 從 ISSUER_DB 生成各元件所需的簡化對照表 ═══ */
var ISSUERS = {};
var ISSUER_KEYS = Object.keys(ISSUER_DB);
ISSUER_KEYS.forEach(function (k) {
  var d = ISSUER_DB[k];
  ISSUERS[k] = { name: d.name, short: d.short, color: d.color, ready: d.ready };
});

/* ═══ 動態生成第一階段辨識 Prompt ═══ */
function buildStage1Prompt() {
  var list = ISSUER_KEYS.map(function (k) {
    var d = ISSUER_DB[k]; var s = d.signatures || {};
    return k + ":" + (s.keywords ? s.keywords[0] : d.name);
  }).join(", ");
  return '判斷此PDF的發行機構。已知：' + list + '。回覆JSON：{"issuer":"代碼或unknown","issuerName":"全名","confidence":"high/medium/low","evidence":["證據"]}';
}
var STAGE1 = buildStage1Prompt();

/* ═══ 通用欄位提取 JSON 結構（所有機構共用） ═══ */
var EXTRACT_JSON = '{"id":"商品代號","isin":"ISIN","tdccCode":"集保代號","name":"中文全名","nameEn":"英文全名","productType":"商品種類","structureType":"FCN/STEPDOWN/DAC/SNOWBALL/PHOENIX/ELN/RANGE/PP/OTHER其中之一","currency":"幣別","faceValue":面額數字,"couponRate":每期配息率小數,"annualizedRate":年化配息率小數,"periods":配息期數,"couponFrequency":"頻率","tenor":"年期","riskLevel":"風險等級","principalProtection":保本率小數,"issuerEntity":"發行機構全名","guarantor":"保證機構全名","issuerCredit":{"moodys":"","sp":"","fitch":""},"guarantorCredit":{"moodys":"","sp":"","fitch":""},"tradeDate":"YYYY-MM-DD","initialDate":"期初評價日","issueDate":"發行日","finalDate":"期末評價日","maturityDate":"到期日","autocallBarrierPct":小數,"barrierPct":小數,"strikePct":小數,"barrierObservation":"European或American","autocallType":"類型","underlyings":[{"name":"","ticker":"","initPrice":期初股價原始數字,"strike":執行價原始數字,"barrier":下限價原始數字,"autocall":出場價原始數字}],"couponSchedule":[{"period":1,"obsStartDate":"或null","obsEndDate":"","couponDate":"","perUnitAmount":每單位配息金額原始數字}],"fees":{"channelFee":"","purchaseFee":"","redemptionFee":""},"seller":"銷售機構","governingLaw":"準據法","identificationHits":["辨識證據"]}';

/* ═══ 花旗專屬提取 Prompt ═══ */
function buildCitiPrompt() {
  return "精確提取花旗(CGMHI)產品說明書。數字與PDF原文完全一致不得四捨五入。日期YYYY-MM-DD。無資料填null。structureType填FCN/STEPDOWN/DAC/SNOWBALL/PHOENIX/ELN/RANGE/PP/OTHER。僅回覆JSON：\n" + EXTRACT_JSON;
}

/* ═══ 各機構專屬 Prompt 對照表 ═══ */
var PROMPTS = {
  citi: buildCitiPrompt(),
};

/* ═══ 未來新增機構的模板函數 ═══ */
function buildIssuerPrompt(key) {
  var d = ISSUER_DB[key];
  if (!d) return null;
  return "精確提取" + d.name + "產品說明書。數字與PDF原文完全一致不得四捨五入。日期YYYY-MM-DD。無資料填null。structureType填FCN/STEPDOWN/DAC/SNOWBALL/PHOENIX/ELN/RANGE/PP/OTHER。僅回覆JSON：\n" + EXTRACT_JSON;
}

/* ═══════════════════════════════════════════════════════
   學習回饋系統
   - ISIN 去重：已辨識過的商品直接跳過（省 2 次 API）
   - 學習檔案：從已辨識商品累積各機構的模式
   - 範例注入：將成功案例注入 prompt（提高準確率）
   - 提取驗證：比對學習檔案驗證提取結果
   ═══════════════════════════════════════════════════════ */

/* ─── 1. ISIN 去重 ─── */
function checkDuplicate(products, newProduct) {
  if (!newProduct || !newProduct.isin) return null;
  return products.find(function (p) { return p.isin === newProduct.isin; });
}
function checkDuplicateByIsin(products, isin) {
  if (!isin) return null;
  return products.find(function (p) { return p.isin === isin; });
}

/* ─── 2. 學習檔案建構 ─── */
async function loadLearningProfile() {
  try {
    var r = localStorage.getItem("sn-learning");
    return r ? JSON.parse(r) : {};
  } catch (e) { return {}; }
}
async function saveLearningProfile(profile) {
  try { localStorage.setItem("sn-learning", JSON.stringify(profile)); } catch (e) { console.error(e); }
}

function buildLearningProfile(products) {
  var profile = {};
  products.forEach(function (p) {
    var key = p.issuer || "unknown";
    if (!profile[key]) {
      profile[key] = {
        count: 0,
        couponRates: [], annualizedRates: [], periods: [], faceValues: [],
        strikePcts: [], barrierPcts: [], autocallPcts: [],
        currencies: {}, tenors: {}, riskLevels: {}, structureTypes: {},
        underlyingTickers: {}, sellers: {},
        examples: [],
      };
    }
    var pr = profile[key];
    pr.count += 1;
    if (p.couponRate) pr.couponRates.push(p.couponRate);
    if (p.annualizedRate) pr.annualizedRates.push(p.annualizedRate);
    if (p.periods) pr.periods.push(p.periods);
    if (p.faceValue) pr.faceValues.push(p.faceValue);
    if (p.strikePct) pr.strikePcts.push(p.strikePct);
    if (p.barrierPct) pr.barrierPcts.push(p.barrierPct);
    if (p.autocallBarrierPct) pr.autocallPcts.push(p.autocallBarrierPct);
    if (p.currency) pr.currencies[p.currency] = (pr.currencies[p.currency] || 0) + 1;
    if (p.tenor) pr.tenors[p.tenor] = (pr.tenors[p.tenor] || 0) + 1;
    if (p.riskLevel) pr.riskLevels[p.riskLevel] = (pr.riskLevels[p.riskLevel] || 0) + 1;
    if (p.structureType) pr.structureTypes[p.structureType] = (pr.structureTypes[p.structureType] || 0) + 1;
    if (p.underlyings) p.underlyings.forEach(function (u) {
      if (u.ticker) pr.underlyingTickers[u.ticker] = (pr.underlyingTickers[u.ticker] || 0) + 1;
    });
    if (p.seller) pr.sellers[p.seller] = (pr.sellers[p.seller] || 0) + 1;
    if (pr.examples.length < 2 && p.id && p.isin && p.couponRate) {
      pr.examples.push({
        id: p.id, isin: p.isin, currency: p.currency, faceValue: p.faceValue,
        couponRate: p.couponRate, annualizedRate: p.annualizedRate, periods: p.periods,
        tenor: p.tenor, strikePct: p.strikePct, barrierPct: p.barrierPct,
        autocallBarrierPct: p.autocallBarrierPct, structureType: p.structureType,
      });
    }
  });

  Object.keys(profile).forEach(function (key) {
    var pr = profile[key];
    function minMax(arr) {
      if (!arr.length) return null;
      return { min: Math.min.apply(null, arr), max: Math.max.apply(null, arr), avg: arr.reduce(function (a, b) { return a + b; }, 0) / arr.length };
    }
    pr.couponRateRange = minMax(pr.couponRates);
    pr.annualizedRateRange = minMax(pr.annualizedRates);
    pr.periodRange = minMax(pr.periods);
    pr.strikePctRange = minMax(pr.strikePcts);
    pr.barrierPctRange = minMax(pr.barrierPcts);
    pr.autocallPctRange = minMax(pr.autocallPcts);
    delete pr.couponRates; delete pr.annualizedRates; delete pr.periods;
    delete pr.faceValues; delete pr.strikePcts; delete pr.barrierPcts; delete pr.autocallPcts;
  });

  return profile;
}

/* ─── 3. 範例注入：把成功案例加入 prompt ─── */
function injectExamples(basePrompt, profile, issuerKey) {
  var pr = profile && profile[issuerKey];
  if (!pr || !pr.examples || !pr.examples.length) return basePrompt;
  var ex = pr.examples[0];
  return basePrompt + "\n參考：" + ex.id + " couponRate:" + ex.couponRate + " strike:" + ex.strikePct + " barrier:" + ex.barrierPct;
}

/* ─── 4. 提取驗證 ─── */
function validateExtraction(product, profile) {
  var warnings = [];
  var pr = profile && profile[product.issuer];
  if (!pr) return warnings;

  function checkRange(val, range, name) {
    if (val == null || !range) return;
    if (val < range.min * 0.5 || val > range.max * 2) {
      warnings.push(name + " = " + val + " 超出學習範圍 [" + range.min + " ~ " + range.max + "]");
    }
  }
  checkRange(product.couponRate, pr.couponRateRange, "配息率");
  checkRange(product.annualizedRate, pr.annualizedRateRange, "年化配息率");
  checkRange(product.strikePct, pr.strikePctRange, "執行價%");
  checkRange(product.barrierPct, pr.barrierPctRange, "下限價%");
  checkRange(product.autocallBarrierPct, pr.autocallPctRange, "Autocall%");

  if (!product.id) warnings.push("缺少商品代碼");
  if (!product.isin) warnings.push("缺少ISIN");
  if (!product.couponRate) warnings.push("缺少配息率");
  if (!product.underlyings || !product.underlyings.length) warnings.push("缺少連結標的");
  if (!product.couponSchedule || !product.couponSchedule.length) warnings.push("缺少配息日期");

  return warnings;
}

/* ─── 5. 學習統計摘要 ─── */
function getLearningStats(profile) {
  var stats = { totalProducts: 0, issuers: 0, ready: 0 };
  var keys = Object.keys(profile);
  stats.issuers = keys.length;
  keys.forEach(function (k) {
    stats.totalProducts += profile[k].count;
    if (profile[k].count >= 1 && profile[k].examples && profile[k].examples.length > 0) stats.ready += 1;
  });
  return stats;
}

/* ═══ Helpers ═══ */
const fm = (n, d = 2) => (n == null || isNaN(n)) ? "—" : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fp = (n, d = 2) => (n != null && !isNaN(n)) ? fm(n * 100, d) + "%" : "—";
function autoDecimals(n) {
  if (n == null || isNaN(n)) return 2;
  var s = String(n);
  var dot = s.indexOf(".");
  return dot >= 0 ? Math.max(s.length - dot - 1, 2) : 2;
}
var f$ = function (n, c) {
  if (n == null || isNaN(n)) return "—";
  var prefix = (c || "USD") === "USD" ? "$" : (c || "USD") + " ";
  return prefix + fm(n, autoDecimals(n));
};
var fPrice = function (n, c) {
  if (n == null || isNaN(n)) return "—";
  var prefix = (c || "USD") === "USD" ? "$" : (c || "USD") + " ";
  return prefix + fm(n, autoDecimals(n));
};
const fd = (d) => d ? d.replace(/-/g, "/") : "—";

function calcSc(p) {
  if (!p) return [];
  const u = Math.floor(INVEST / p.faceValue);
  const inv = u * p.faceValue;
  const uc = Math.round(p.faceValue * p.couponRate * 100) / 100;
  const tp = Math.round(uc * u * 100) / 100;
  return Array.from({ length: p.periods }, (_, i) => {
    const t = i + 1;
    const cum = Math.round(tp * t * 100) / 100;
    const tot = Math.round((cum + inv) * 100) / 100;
    const s = p.couponSchedule && p.couponSchedule[i];
    return { t, mat: t === p.periods, date: fd(s && s.obsEndDate), cDate: fd(s && s.couponDate), u, inv, uc, tp, cum, tot, ret: tot / inv - 1, ann: p.annualizedRate || p.couponRate * 12 };
  });
}

/* ═══ Storage (localStorage) ═══ */
async function dbLoad() {
  try { var r = localStorage.getItem("sn-v3"); return r ? JSON.parse(r) : []; }
  catch (e) { console.error(e); return []; }
}
async function dbSave(d) {
  try { localStorage.setItem("sn-v3", JSON.stringify(d)); }
  catch (e) { console.error(e); }
}

/* ═══ Token tracking ═══ */
var SONNET_INPUT_PRICE = 3.0;   // per 1M input tokens
var SONNET_OUTPUT_PRICE = 15.0; // per 1M output tokens

async function loadTokens() {
  try { var r = localStorage.getItem("sn-tokens"); return r ? JSON.parse(r) : { total: { input: 0, output: 0, calls: 0 }, history: [] }; }
  catch (e) { return { total: { input: 0, output: 0, calls: 0 }, history: [] }; }
}
async function saveTokens(t) {
  try { localStorage.setItem("sn-tokens", JSON.stringify(t)); } catch (e) { console.error(e); }
}
async function addTokenUsage(inputT, outputT, fileName, stage) {
  var t = await loadTokens();
  t.total.input += inputT;
  t.total.output += outputT;
  t.total.calls += 1;
  t.history.push({ input: inputT, output: outputT, fileName: fileName, stage: stage, time: new Date().toISOString() });
  if (t.history.length > 500) t.history = t.history.slice(-500);
  await saveTokens(t);
  return t;
}

/* ═══ API ═══ */
async function apiCall(b64, prompt, fileName, stage, model) {
  const r = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || "claude-sonnet-4-20250514", max_tokens: 4096,
      messages: [{ role: "user", content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
        { type: "text", text: prompt }
      ] }]
    })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "API error");
  var inputT = d.usage ? d.usage.input_tokens : 0;
  var outputT = d.usage ? d.usage.output_tokens : 0;
  if (inputT || outputT) addTokenUsage(inputT, outputT, fileName || "", stage || "");
  const txt = (d.content || []).filter(c => c.type === "text").map(c => c.text).join("");
  return JSON.parse(txt.replace(/```json|```/g, "").trim());
}

/* ═══ 本地 PDF 文字掃描 + 機構辨識（省下第一階段 API）═══ */

/* 從 base64 PDF 提取可讀文字（掃描原始 bytes 中的 ASCII/CJK 字串）*/
function extractTextFromB64(b64) {
  try {
    var raw = atob(b64);
    var chunks = [];
    var buf = "";
    for (var i = 0; i < raw.length; i++) {
      var c = raw.charCodeAt(i);
      if (c >= 32 && c <= 126) {
        buf += raw[i];
      } else {
        if (buf.length > 3) chunks.push(buf);
        buf = "";
      }
    }
    if (buf.length > 3) chunks.push(buf);
    return chunks.join(" ");
  } catch (e) { return ""; }
}

/* 從文字中提取 ISIN（2字母 + 10字元） */
function extractISIN(text) {
  var m = text.match(/[A-Z]{2}[A-Z0-9]{10}/g);
  if (!m) return null;
  for (var i = 0; i < m.length; i++) {
    var pre = m[i].slice(0, 2);
    if (["XS", "US", "CH", "DE", "AU", "SG", "GB", "FR", "JP"].indexOf(pre) >= 0) return m[i];
  }
  return m[0];
}

/* 本地辨識發行機構：比對關鍵字 + ISIN 前綴 */
function localIdentify(text, isin) {
  var results = [];
  var textUp = text.toUpperCase();

  ISSUER_KEYS.forEach(function (key) {
    var d = ISSUER_DB[key];
    var sigs = d.signatures || {};
    var score = 0;
    var evidence = [];

    /* 關鍵字比對 */
    if (sigs.keywords) {
      sigs.keywords.forEach(function (kw) {
        if (text.indexOf(kw) >= 0 || textUp.indexOf(kw.toUpperCase()) >= 0) {
          score += 10;
          evidence.push("關鍵字：" + kw);
        }
      });
    }

    /* ISIN 前綴比對 */
    if (isin && sigs.isinPrefix) {
      var pre = isin.slice(0, 2);
      if (sigs.isinPrefix.indexOf(pre) >= 0) {
        score += 5;
        evidence.push("ISIN前綴：" + pre);
      }
    }

    /* 地址比對 */
    if (sigs.address) {
      sigs.address.forEach(function (addr) {
        if (text.indexOf(addr) >= 0) {
          score += 8;
          evidence.push("地址：" + addr);
        }
      });
    }

    /* 總代理人比對 */
    if (sigs.agent && text.indexOf(sigs.agent) >= 0) {
      score += 12;
      evidence.push("總代理人：" + sigs.agent);
    }

    if (score > 0) results.push({ key: key, score: score, evidence: evidence });
  });

  results.sort(function (a, b) { return b.score - a.score; });

  if (results.length === 0) return null;
  var best = results[0];
  var second = results[1];

  /* 高信心度：分數 >= 15 且遠超第二名 */
  if (best.score >= 15 && (!second || best.score >= second.score * 2)) {
    return { issuer: best.key, confidence: "high", evidence: best.evidence, score: best.score, method: "local" };
  }
  /* 中信心度：分數 >= 10 */
  if (best.score >= 10) {
    return { issuer: best.key, confidence: "medium", evidence: best.evidence, score: best.score, method: "local" };
  }
  return null;
}

/* ═══ 辨識主流程（本地優先，API 備用）═══ */
async function runIdentify(b64, onP, fileName, existingProducts) {
  var profile = await loadLearningProfile();
  var pid = null;
  var identEvidence = [];
  var identConfidence = "high";
  var savedOneCall = false;

  /* ── 嘗試本地辨識（省下第一階段 API）── */
  onP("本地掃描 PDF 文字...");
  var pdfText = extractTextFromB64(b64);
  var isin = extractISIN(pdfText);

  /* ISIN 去重：完全相同的 ISIN 直接跳過 */
  if (isin && existingProducts) {
    var dup = checkDuplicateByIsin(existingProducts, isin);
    if (dup) {
      onP("偵測到重複 ISIN：" + isin + "（" + dup.id + "），將覆蓋更新");
    }
  }

  if (pdfText.length > 100) {
    var localResult = localIdentify(pdfText, isin);
    if (localResult && localResult.confidence === "high") {
      pid = localResult.issuer;
      identEvidence = localResult.evidence;
      identConfidence = "high";
      savedOneCall = true;
      onP("本地辨識成功 ✓ " + (ISSUER_DB[pid] ? ISSUER_DB[pid].name : pid) + "（省下1次API）");
    }
  }

  /* ── 本地辨識失敗或信心不足 → 用 Haiku 辨識（便宜10倍）── */
  if (!pid) {
    onP("第一階段：Haiku 辨識發行機構（低成本）...");
    var s1 = await apiCall(b64, STAGE1, fileName, "辨識(Haiku)", "claude-haiku-4-5-20251001");
    pid = s1.issuer;
    identEvidence = s1.evidence || [];
    identConfidence = s1.confidence;
  }

  var issuerData = ISSUER_DB[pid];
  if (!issuerData) {
    throw new Error("發行機構「" + pid + "」不在已知機構中。請確認PDF是否為結構型商品產品說明書。");
  }
  if (!issuerData.ready || !PROMPTS[pid]) {
    var readyList = ISSUER_KEYS.filter(function (k) { return ISSUER_DB[k].ready; }).map(function (k) { return ISSUER_DB[k].name; });
    throw new Error("已辨識為「" + issuerData.name + "」，但專屬引擎尚未建立。\n已就緒：" + readyList.join("、"));
  }

  /* ── 第二階段：專屬引擎 + 學習範例注入 ── */
  onP(issuerData.name + " ✓ — 專屬引擎提取中" + (savedOneCall ? "（已省1次API）" : "") + "...");
  var enhancedPrompt = injectExamples(PROMPTS[pid], profile, pid);
  var p = await apiCall(b64, enhancedPrompt, fileName, "提取");
  p.issuer = pid;
  p.confidence = identConfidence;
  p.createdAt = new Date().toISOString();
  p._savedApiCall = savedOneCall;
  if (!p.identificationHits || !p.identificationHits.length) p.identificationHits = identEvidence;

  /* ── 分類 ── */
  var apiType = p.structureType;
  var localType = autoClassify(p);
  if (!apiType || !PRODUCT_TYPES[apiType]) p.structureType = localType;
  p._autoClassified = localType;

  /* ── ISIN 去重 ── */
  if (existingProducts && p.isin) {
    var dup2 = checkDuplicateByIsin(existingProducts, p.isin);
    if (dup2) { p._isDuplicate = true; p._dupId = dup2.id; }
  }

  /* ── 驗證 ── */
  var warnings = validateExtraction(p, profile);
  if (warnings.length) p._warnings = warnings;

  /* ── 更新學習 ── */
  var all = existingProducts ? existingProducts.concat([p]) : [p];
  var newProfile = buildLearningProfile(all);
  await saveLearningProfile(newProfile);

  return p;
}

/* ═══ Styles ═══ */
/* ═══ 五行配色（補金水 — 庚金日主）═══ */
const C = {
  bg: "#EAEFF5",       /* 淺銀灰 — 金氣 */
  sb: "#0A1628",       /* 深藍黑 — 水 */
  card: "#FFFFFF",     /* 純白 — 金 */
  bdr: "#C8D3E0",      /* 銀灰邊框 — 金 */
  tx: "#0B1D3A",       /* 深藍黑文字 — 水 */
  sub: "#4A6383",      /* 藍灰副文字 — 水 */
  hint: "#8A9BB5",     /* 淡藍提示 — 水 */
  ac: "#1A56DB",       /* 靛藍強調 — 水 */
  gn: "#B8860B",       /* 暗金色（正面/收益）— 金 */
  rd: "#C41E3A",       /* 深紅（警示）*/
  or: "#D4A017",       /* 金黃（費用/重要）— 金 */
};

/* ═══ Components ═══ */

function Badge({ children, color }) {
  const c = color || C.ac;
  return <span style={{ background: c + "18", color: c, fontSize: 12, padding: "4px 11px", borderRadius: 6, fontWeight: 600 }}>{children}</span>;
}

function Card({ title, children, pad }) {
  return (
    <div style={{ background: C.card, borderRadius: 10, border: "1px solid " + C.bdr, padding: pad || "20px 24px", marginBottom: 16 }}>
      {title && <div style={{ fontWeight: 600, fontSize: 16, color: C.tx, marginBottom: 14 }}>{title}</div>}
      {children}
    </div>
  );
}

function KV({ rows }) {
  return <div>{rows.map(function (r, i) {
    return <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: i ? "1px solid " + C.bdr + "44" : "none", fontSize: 15, gap: 12 }}>
      <span style={{ color: C.sub, flexShrink: 0 }}>{r[0]}</span>
      <span style={{ color: r[2] || C.tx, fontWeight: 500, textAlign: "right", wordBreak: "break-word" }}>{r[1] != null ? r[1] : "—"}</span>
    </div>;
  })}</div>;
}

function Sidebar({ tab, setTab, n }) {
  var tabs = [
    { id: "dashboard", label: "總覽", icon: "◉" },
    { id: "products", label: "商品清單", icon: "☰" },
    { id: "calculator", label: "配息試算", icon: "⊞" },
    { id: "upload", label: "上傳辨識", icon: "↑" },
    { id: "usage", label: "用量統計", icon: "◎" },
    { id: "backup", label: "備份還原", icon: "⇅" }
  ];
  return (
    <div style={{ width: 232, background: C.sb, display: "flex", flexDirection: "column", padding: "28px 0", flexShrink: 0 }}>
      <div style={{ padding: "0 26px", marginBottom: 40 }}>
        <div style={{ fontSize: 21, fontWeight: 700, color: "#E8EEF6", letterSpacing: "0.5px" }}>SN Manager</div>
        <div style={{ fontSize: 12, color: "#5A7A9B", marginTop: 5 }}>結構型商品辨識系統</div>
      </div>
      {tabs.map(function (t) {
        var a = tab === t.id;
        return <button key={t.id} onClick={function () { setTab(t.id); }}
          style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 26px", border: "none", cursor: "pointer", fontSize: 15, fontWeight: a ? 600 : 400, color: a ? "#E8EEF6" : "#7A93B0", background: a ? "rgba(26,86,219,0.15)" : "transparent", borderLeft: a ? "3px solid #3B82F6" : "3px solid transparent", width: "100%", textAlign: "left", transition: "all .15s" }}>
          <span style={{ fontSize: 16, opacity: a ? 1 : 0.6 }}>{t.icon}</span>
          <span>{t.label}</span>
          {t.id === "products" && n > 0 && <span style={{ marginLeft: "auto", background: "#122340", color: "#6BA3E8", fontSize: 12, padding: "2px 10px", borderRadius: 10, fontWeight: 600 }}>{n}</span>}
        </button>;
      })}
      <div style={{ marginTop: "auto", padding: "18px 26px", borderTop: "1px solid #1A2D4A" }}>
        <div style={{ fontSize: 12, color: "#5A7A9B", marginBottom: 8 }}>辨識引擎（{ISSUER_KEYS.filter(function(k){return ISSUER_DB[k].ready;}).length} / {ISSUER_KEYS.length}）</div>
        {ISSUER_KEYS.map(function (k) {
          var d = ISSUER_DB[k];
          return <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: d.ready ? "#3B82F6" : "#2A3F5F" }}></span>
            <span style={{ fontSize: 11, color: d.ready ? "#8AACC8" : "#3D5A7A" }}>{d.short}</span>
          </div>;
        })}
        <div style={{ fontSize: 10, color: "#3D5A7A", marginTop: 10, paddingTop: 8, borderTop: "1px solid #1A2D4A" }}>跨裝置同步</div>
      </div>
    </div>
  );
}

/* ─── Dashboard ─── */
function Dashboard({ products, setTab, setFilter }) {
  var byIssuer = {};
  products.forEach(function (p) {
    var key = p.issuer || "unknown";
    if (!byIssuer[key]) byIssuer[key] = { count: 0, types: {} };
    byIssuer[key].count += 1;
    var st = p.structureType || "OTHER";
    var stLabel = PRODUCT_TYPES[st] ? PRODUCT_TYPES[st].label : st;
    if (!byIssuer[key].types[st]) byIssuer[key].types[st] = { count: 0, label: stLabel };
    byIssuer[key].types[st].count += 1;
  });

  var s1 = useState(null); var expandedIssuer = s1[0]; var setExpanded = s1[1];
  var s2 = useState(null); var drillList = s2[0]; var setDrillList = s2[1];
  var s3 = useState(""); var drillTitle = s3[0]; var setDrillTitle = s3[1];

  function drillDown(issuerKey, typeKey) {
    var filtered = products.filter(function (p) {
      return (p.issuer || "unknown") === issuerKey && (p.structureType || "OTHER") === typeKey;
    });
    var issName = ISSUERS[issuerKey] ? ISSUERS[issuerKey].name : issuerKey;
    var stLabel = PRODUCT_TYPES[typeKey] ? PRODUCT_TYPES[typeKey].label : typeKey;
    setDrillTitle(issName + " — " + stLabel + "（" + filtered.length + " 檔）");
    setDrillList(filtered);
  }

  function goToProduct(p) {
    setFilter(p.id);
    setTab("products");
  }

  if (drillList) {
    return (
      <div>
        <button onClick={function () { setDrillList(null); }} style={{ background: "none", border: "none", color: C.ac, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 16, fontWeight: 500 }}>← 返回總覽</button>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.tx, margin: "0 0 20px" }}>{drillTitle}</h2>
        <Card pad="0">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 600 }}>
              <thead><tr style={{ background: "#f8fafc", borderBottom: "1px solid " + C.bdr }}>
                {["商品代碼", "ISIN", "幣別", "年期", "年化配息", "風險", "銷售機構"].map(function (h) { return <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontWeight: 600, color: C.sub, fontSize: 12 }}>{h}</th>; })}
              </tr></thead>
              <tbody>{drillList.map(function (p) {
                return <tr key={p.id + (p.isin || "")} onClick={function () { goToProduct(p); }} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                  onMouseEnter={function (e) { e.currentTarget.style.background = "#f8fafc"; }} onMouseLeave={function (e) { e.currentTarget.style.background = ""; }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: C.tx }}>{p.id}</td>
                  <td style={{ padding: "12px 14px", color: C.sub, fontFamily: "monospace", fontSize: 11 }}>{p.isin}</td>
                  <td style={{ padding: "12px 14px", color: C.sub }}>{p.currency}</td>
                  <td style={{ padding: "12px 14px", color: C.sub }}>{p.tenor}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: C.gn }}>{fp(p.annualizedRate)}</td>
                  <td style={{ padding: "12px 14px" }}><Badge color={p.riskLevel === "RR5" ? C.rd : p.riskLevel === "RR4" ? C.or : C.gn}>{p.riskLevel}</Badge></td>
                  <td style={{ padding: "12px 14px", color: C.sub, fontSize: 12 }}>{p.seller || "—"}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  var issuerKeys = Object.keys(byIssuer).sort(function (a, b) { return byIssuer[b].count - byIssuer[a].count; });

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: C.tx, margin: "0 0 24px" }}>總覽</h2>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
        {[
          ["商品總數", products.length, "檔"],
          ["發行機構", issuerKeys.length, "/ 16"]
        ].map(function (x, i) {
          return <div key={i} style={{ background: C.card, borderRadius: 10, padding: "18px 22px", border: "1px solid " + C.bdr, flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 13, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{x[0]}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.tx, marginTop: 4 }}>{x[1]}</div>
            {x[2] && <div style={{ fontSize: 11, color: C.hint, marginTop: 2 }}>{x[2]}</div>}
          </div>;
        })}
      </div>

      {products.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.hint }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>☐</div>
          <div style={{ fontSize: 15, color: C.sub, marginBottom: 20 }}>尚無商品資料</div>
          <button onClick={function () { setTab("upload"); }} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: C.ac, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>上傳 PDF 開始辨識</button>
        </div>
      ) : (
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: C.tx, marginBottom: 14 }}>各發行機構商品統計</div>
          {issuerKeys.map(function (key) {
            var iss = ISSUERS[key];
            var data = byIssuer[key];
            var isExpanded = expandedIssuer === key;
            var typeKeys = Object.keys(data.types).sort(function (a, b) { return data.types[b].count - data.types[a].count; });
            return <Card key={key} pad="0">
              <div onClick={function () { setExpanded(isExpanded ? null : key); }}
                style={{ display: "flex", alignItems: "center", padding: "16px 22px", cursor: "pointer", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: iss ? iss.color : C.sub, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{iss ? iss.short : "?"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.tx }}>{iss ? iss.name : key}</div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{typeKeys.length + " 種商品類型"}</div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.ac, marginRight: 8 }}>{data.count}</div>
                <div style={{ fontSize: 11, color: C.sub, marginRight: 12 }}>檔</div>
                <span style={{ fontSize: 12, color: C.hint, transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
              </div>
              {isExpanded && (
                <div style={{ borderTop: "1px solid " + C.bdr, padding: "0" }}>
                  {typeKeys.map(function (tk, ti) {
                    var td = data.types[tk];
                    var pt = PRODUCT_TYPES[tk] || PRODUCT_TYPES.OTHER;
                    return <div key={tk} onClick={function () { drillDown(key, tk); }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px 12px 72px", borderBottom: ti < typeKeys.length - 1 ? "1px solid #f1f5f9" : "none", cursor: "pointer", transition: "background 0.1s" }}
                      onMouseEnter={function (e) { e.currentTarget.style.background = "#f8fafc"; }} onMouseLeave={function (e) { e.currentTarget.style.background = ""; }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Badge color={pt.color}>{pt.label}</Badge>
                        <span style={{ fontSize: 12, color: C.sub }}>{pt.desc}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.tx }}>{td.count}</span>
                        <span style={{ fontSize: 11, color: C.hint }}>檔</span>
                        <span style={{ fontSize: 11, color: C.ac }}>→</span>
                      </div>
                    </div>;
                  })}
                </div>
              )}
            </Card>;
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Product List ─── */
function ProductList({ products, onSelect, onDel, initSearch, onReclassify }) {
  var ref = useState(initSearch || "");
  var q = ref[0]; var setQ = ref[1];
  useEffect(function () { if (initSearch) setQ(initSearch); }, [initSearch]);
  var list = products.filter(function (p) { return [p.id, p.isin, p.name, p.seller].join(" ").toLowerCase().indexOf(q.toLowerCase()) >= 0; });
  var unclassified = products.filter(function (p) { return !p.structureType || !PRODUCT_TYPES[p.structureType]; }).length;
  var s1 = useState(""); var reclassMsg = s1[0]; var setReclassMsg = s1[1];
  function doReclassify() {
    onReclassify();
    setReclassMsg("已重新分類 " + products.length + " 檔商品");
    setTimeout(function () { setReclassMsg(""); }, 3000);
  }
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.tx, margin: 0 }}>商品清單</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {unclassified > 0 && <button onClick={doReclassify} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: C.ac, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{"重新分類（" + unclassified + " 檔未分類）"}</button>}
          {unclassified === 0 && products.length > 0 && <button onClick={doReclassify} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid " + C.bdr, background: C.card, color: C.sub, fontSize: 13, cursor: "pointer" }}>重新分類</button>}
          {reclassMsg && <span style={{ fontSize: 13, color: C.gn, fontWeight: 500 }}>{reclassMsg}</span>}
          <input value={q} onChange={function (e) { setQ(e.target.value); }} placeholder="搜尋代碼、ISIN、名稱…" style={{ width: 220, padding: "9px 14px", borderRadius: 8, border: "1px solid " + C.bdr, fontSize: 13, outline: "none" }} />
        </div>
      </div>
      {list.length === 0 ? <div style={{ textAlign: "center", padding: 60, color: C.hint }}>{products.length ? "無搜尋結果" : "尚無商品"}</div> : (
        <Card pad="0">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 800 }}>
              <thead><tr style={{ background: "#f8fafc", borderBottom: "1px solid " + C.bdr }}>
                {["商品代碼", "ISIN", "發行機構", "類型", "幣別", "年期", "年化配息", "風險", ""].map(function (h) { return <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontWeight: 600, color: C.sub, fontSize: 12 }}>{h}</th>; })}
              </tr></thead>
              <tbody>{list.map(function (p) {
                var iss = ISSUERS[p.issuer];
                var st = PRODUCT_TYPES[p.structureType] || PRODUCT_TYPES.OTHER;
                return <tr key={p.id + (p.isin || "")} onClick={function () { onSelect(p); }} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: C.tx }}>{p.id}</td>
                  <td style={{ padding: "12px 14px", color: C.sub, fontFamily: "monospace", fontSize: 11 }}>{p.isin}</td>
                  <td style={{ padding: "12px 14px" }}><Badge color={iss ? iss.color : C.sub}>{iss ? iss.short : p.issuer}</Badge></td>
                  <td style={{ padding: "12px 14px" }}><Badge color={st.color}>{st.label}</Badge></td>
                  <td style={{ padding: "12px 14px", color: C.sub }}>{p.currency}</td>
                  <td style={{ padding: "12px 14px", color: C.sub }}>{p.tenor}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: C.gn }}>{fp(p.annualizedRate)}</td>
                  <td style={{ padding: "12px 14px" }}><Badge color={p.riskLevel === "RR5" ? C.rd : p.riskLevel === "RR4" ? C.or : C.gn}>{p.riskLevel}</Badge></td>
                  <td style={{ padding: "12px 14px" }}><button onClick={function (e) { e.stopPropagation(); onDel(p.id); }} style={{ background: "none", border: "none", color: C.hint, cursor: "pointer", fontSize: 14 }}>✕</button></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─── Detail ─── */
function Detail({ product, onBack, onUpdateType }) {
  var p = product;
  var sc = calcSc(p);
  var iss = ISSUERS[p.issuer];
  var st = PRODUCT_TYPES[p.structureType] || PRODUCT_TYPES.OTHER;
  var s1 = useState(false); var showTypeEdit = s1[0]; var setShowTypeEdit = s1[1];
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.ac, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 16, fontWeight: 500 }}>← 返回</button>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 46, height: 46, borderRadius: 10, background: iss ? iss.color : C.sub, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>{iss ? iss.short : "?"}</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.tx, margin: 0 }}>{p.id}</h2>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{p.isin} · {p.currency} · {p.tenor} · {p.riskLevel}</div>
        </div>
        {p.confidence && <Badge color={p.confidence === "high" ? C.gn : C.or}>辨識：{p.confidence}</Badge>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, padding: "10px 16px", background: st.color + "10", borderRadius: 8, border: "1px solid " + st.color + "30" }}>
        <span style={{ background: st.color, color: "#fff", fontSize: 13, padding: "4px 14px", borderRadius: 6, fontWeight: 700 }}>{st.label}</span>
        <span style={{ fontSize: 13, color: C.tx }}>{st.full}</span>
        <span style={{ fontSize: 12, color: C.sub }}>— {st.desc}</span>
        <button onClick={function () { setShowTypeEdit(!showTypeEdit); }} style={{ marginLeft: "auto", background: "none", border: "1px solid " + C.bdr, borderRadius: 6, padding: "4px 12px", fontSize: 12, color: C.sub, cursor: "pointer" }}>{showTypeEdit ? "收起" : "修改分類"}</button>
      </div>
      {showTypeEdit && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {PT_KEYS.map(function (k) {
            var pt = PRODUCT_TYPES[k];
            var active = p.structureType === k;
            return <button key={k} onClick={function () { onUpdateType(p.id, p.isin, k); setShowTypeEdit(false); }}
              style={{ padding: "8px 16px", borderRadius: 8, border: active ? "2px solid " + pt.color : "1px solid " + C.bdr, background: active ? pt.color + "15" : C.card, color: active ? pt.color : C.tx, fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer" }}>
              <div>{pt.label}</div>
              <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{pt.desc}</div>
            </button>;
          })}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 0 }}>
        <Card title="基本資訊"><KV rows={[["發行機構", p.issuerEntity], ["保證機構", p.guarantor], ["商品種類", p.productType], ["幣別/面額", p.currency + " / " + f$(p.faceValue, p.currency)], ["保本率", p.principalProtection === 0 ? "不保本 (0%)" : fp(p.principalProtection), p.principalProtection === 0 ? C.rd : null]]} /></Card>
        <Card title="關鍵日期"><KV rows={[["交易日", fd(p.tradeDate)], ["期初評價日", fd(p.initialDate)], ["發行日", fd(p.issueDate)], ["期末評價日", fd(p.finalDate)], ["到期日", fd(p.maturityDate)], ["Autocall類型", p.autocallType], ["Barrier觀察", p.barrierObservation ? (p.barrierObservation.indexOf("European") >= 0 ? p.barrierObservation + " (EKI)" : p.barrierObservation) : "—"]]} /></Card>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 0 }}>
        <Card title="收益結構"><KV rows={[["每期配息率", fp(p.couponRate)], ["年化配息率", fp(p.annualizedRate), C.gn], ["配息頻率", p.couponFrequency], ["Autocall界限", fp(p.autocallBarrierPct, 0)], ["執行價", fp(p.strikePct, 0)], ["下限價", fp(p.barrierPct, 0)]]} /></Card>

        {p.underlyings && p.underlyings.length > 0 ? (
          <Card title={"連結標的（" + p.underlyings.length + "檔）"}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead><tr style={{ borderBottom: "1px solid " + C.bdr }}>
                  {["標的", "代碼", "期初股價", "執行價", "下限價", "出場價"].map(function (h) { return <th key={h} style={{ padding: "8px 10px", textAlign: h === "標的" || h === "代碼" ? "left" : "right", color: C.sub, fontWeight: 500, fontSize: 11 }}>{h}</th>; })}
                </tr></thead>
                <tbody>{p.underlyings.map(function (u, i) {
                  var sp = p.strikePct; var bp = p.barrierPct; var ap = p.autocallBarrierPct;
                  var sPct = (u.initPrice && u.strike) ? u.strike / u.initPrice : sp;
                  var bPct = (u.initPrice && u.barrier) ? u.barrier / u.initPrice : bp;
                  var aPct = (u.initPrice && u.autocall) ? u.autocall / u.initPrice : ap;
                  return <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "9px 10px", fontWeight: 500 }}>{u.name}</td>
                    <td style={{ padding: "9px 10px", color: C.sub, fontFamily: "monospace", fontSize: 11 }}>{u.ticker}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right" }}>{f$(u.initPrice, p.currency)}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right" }}>{f$(u.strike, p.currency)} <span style={{ color: C.sub, fontSize: 10 }}>({fp(sPct, 0)})</span></td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: C.rd }}>{f$(u.barrier, p.currency)} <span style={{ fontSize: 10, opacity: 0.8 }}>({fp(bPct, 0)})</span></td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: C.ac }}>{f$(u.autocall, p.currency)} <span style={{ fontSize: 10, opacity: 0.8 }}>({fp(aPct, 0)})</span></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </Card>
        ) : <div></div>}
      </div>

      {p.couponSchedule && p.couponSchedule.length > 0 && (
        <Card title="配息日期明細">
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid " + C.bdr }}>
              {["期數", "觀察開始日", "觀察結束日", "配息日", "每單位配息"].map(function (h) { return <th key={h} style={{ padding: "8px 10px", textAlign: h === "每單位配息" ? "right" : "left", color: C.sub, fontWeight: 500, fontSize: 11 }}>{h}</th>; })}
            </tr></thead>
            <tbody>{p.couponSchedule.map(function (s, i) {
              return <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "9px 10px", fontWeight: 500 }}>{s.period}</td>
                <td style={{ padding: "9px 10px", color: C.sub }}>{fd(s.obsStartDate)}</td>
                <td style={{ padding: "9px 10px" }}>{fd(s.obsEndDate)}</td>
                <td style={{ padding: "9px 10px", fontWeight: 500 }}>{fd(s.couponDate)}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", color: C.gn, fontWeight: 600 }}>{f$(s.perUnitAmount || p.faceValue * p.couponRate, p.currency)}</td>
              </tr>;
            })}</tbody>
          </table>
        </Card>
      )}

      <Card title={"Autocall 提前到期試算（投資 " + f$(INVEST) + "）"}>
        <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>面額 {f$(p.faceValue, p.currency)} × {sc.length > 0 ? sc[0].u : "—"} 單位 = {sc.length > 0 ? f$(sc[0].inv, p.currency) : "—"} · 每期配息 {sc.length > 0 ? f$(sc[0].tp, p.currency) : "—"} · 年化 {fp(p.annualizedRate)}</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 600 }}>
            <thead><tr style={{ borderBottom: "1px solid " + C.bdr }}>
              {["觸發時點", "日期", "配息日", "累計配息", "買回金額", "總收入", "報酬率", "年化"].map(function (h) { return <th key={h} style={{ padding: "8px 10px", textAlign: h === "觸發時點" ? "left" : "right", color: C.sub, fontWeight: 500, fontSize: 11 }}>{h}</th>; })}
            </tr></thead>
            <tbody>{sc.map(function (s, i) {
              return <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 ? "" : "#f8fafc" }}>
                <td style={{ padding: "9px 10px", fontWeight: 600 }}>{s.mat ? "持有到期" : "第" + s.t + "期末"}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", color: C.sub }}>{s.date}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", color: C.sub }}>{s.cDate}</td>
                <td style={{ padding: "9px 10px", textAlign: "right" }}>{f$(s.cum, p.currency)}</td>
                <td style={{ padding: "9px 10px", textAlign: "right" }}>{f$(s.inv, p.currency)}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 600, color: C.gn }}>{f$(s.tot, p.currency)}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 600, color: C.gn }}>{fp(s.ret)}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 600, color: C.gn }}>{fp(s.ann)}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </Card>

      {p.identificationHits && p.identificationHits.length > 0 && (
        <Card title="辨識依據">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {p.identificationHits.map(function (h, i) { return <span key={i} style={{ background: "#f0fdf4", color: C.gn, fontSize: 12, padding: "4px 12px", borderRadius: 6, fontWeight: 500 }}>{"✓ " + h}</span>; })}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─── Calculator ─── */
function Calc({ products }) {
  var s1 = useState(products[0] ? products[0].id : "");
  var sid = s1[0]; var setSid = s1[1];
  var s3 = useState(3); var period = s3[0]; var setPer = s3[1];
  var s4 = useState(5); var mVal = s4[0]; var setMv = s4[1];
  var s5 = useState(20); var MVal = s5[0]; var setMV = s5[1];
  var p = products.find(function (x) { return x.id === sid; });
  var mid = null;
  if (p) {
    var u = Math.floor(INVEST / p.faceValue);
    var inv = u * p.faceValue;
    var uc = Math.round(p.faceValue * p.couponRate * 100) / 100;
    var comp = period - 1;
    var fc = Math.round(uc * u * comp * 100) / 100;
    var acu = Math.round(p.faceValue * (mVal / MVal) * p.couponRate * 100) / 100;
    var act = Math.round(acu * u * 100) / 100;
    var tot = Math.round((fc + act + inv) * 100) / 100;
    mid = { u: u, inv: inv, comp: comp, fc: fc, acu: acu, act: act, tot: tot, ret: tot / inv - 1, ann: p.annualizedRate || p.couponRate * 12 };
  }
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: C.tx, margin: "0 0 24px" }}>中途觸發配息試算（投資 {f$(INVEST)}）</h2>
      <Card>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: C.sub, marginBottom: 4, fontWeight: 600 }}>商品</div>
            <select value={sid} onChange={function (e) { setSid(e.target.value); }} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + C.bdr, fontSize: 13 }}>
              {products.map(function (p) { return <option key={p.id} value={p.id}>{p.id + " · " + p.currency + " · " + fp(p.annualizedRate)}</option>; })}
            </select>
          </div>
          <div><div style={{ fontSize: 11, color: C.sub, marginBottom: 4, fontWeight: 600 }}>觸發在第幾期</div><input type="number" min={2} max={p ? p.periods : 6} value={period} onChange={function (e) { setPer(+e.target.value); }} style={{ width: 70, padding: "9px", borderRadius: 8, border: "1px solid " + C.bdr, fontSize: 13 }} /></div>
          <div><div style={{ fontSize: 11, color: C.sub, marginBottom: 4, fontWeight: 600 }}>m（已過觀察日）</div><input type="number" min={1} max={MVal} value={mVal} onChange={function (e) { setMv(+e.target.value); }} style={{ width: 70, padding: "9px", borderRadius: 8, border: "1px solid " + C.bdr, fontSize: 13 }} /></div>
          <div><div style={{ fontSize: 11, color: C.sub, marginBottom: 4, fontWeight: 600 }}>M（觀察日總數）</div><input type="number" min={1} value={MVal} onChange={function (e) { setMV(+e.target.value); }} style={{ width: 70, padding: "9px", borderRadius: 8, border: "1px solid " + C.bdr, fontSize: 13 }} /></div>
        </div>
        {p && <div style={{ marginTop: 12, fontSize: 12, color: C.sub }}>面額 {f$(p.faceValue, p.currency)} × {mid.u} 單位 = {f$(mid.inv, p.currency)}</div>}
      </Card>

      {mid && p && (
        <Card>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>{"第" + period + "期第" + mVal + "個交易日觸發（m=" + mVal + ", M=" + MVal + "）· " + mid.u + " 單位"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: 14 }}><div style={{ fontSize: 11, color: C.sub }}>{"第1~" + mid.comp + "期固定配息"}</div><div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{f$(mid.fc, p.currency)}</div></div>
            <div style={{ background: "#eff6ff", borderRadius: 8, padding: 14 }}><div style={{ fontSize: 11, color: C.ac }}>{"第" + period + "期 Autocall 配息"}</div><div style={{ fontSize: 18, fontWeight: 700, color: "#1d4ed8", marginTop: 4 }}>{f$(mid.act, p.currency)}</div></div>
            <div style={{ background: "#f0fdf4", borderRadius: 8, padding: 14 }}><div style={{ fontSize: 11, color: C.gn }}>投資人總收入</div><div style={{ fontSize: 18, fontWeight: 700, color: C.gn, marginTop: 4 }}>{f$(mid.tot, p.currency)}</div></div>
          </div>
          <div style={{ fontSize: 12, color: C.sub }}>買回 {f$(mid.inv, p.currency)} · 報酬率 <b style={{ color: C.gn }}>{fp(mid.ret)}</b> · 年化 <b style={{ color: C.gn }}>{fp(mid.ann)}</b></div>
          <div style={{ marginTop: 10, padding: 10, background: "#fffbeb", borderRadius: 6, fontSize: 11, color: "#92400e" }}>
            {"每單位：" + f$(p.faceValue, p.currency) + " × (" + mVal + "/" + MVal + ") × " + fp(p.couponRate) + " = " + f$(mid.acu, p.currency) + " × " + mid.u + " 單位 = " + f$(mid.act, p.currency)}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─── Upload ─── */
function Upload({ onAdd, products }) {
  var s1 = useState("idle"); var st = s1[0]; var setSt = s1[1];
  var s2 = useState(""); var prog = s2[0]; var setProg = s2[1];
  var s3 = useState([]); var results = s3[0]; var setResults = s3[1];
  var s4 = useState(""); var err = s4[0]; var setErr = s4[1];
  var s5 = useState(false); var drag = s5[0]; var setDrag = s5[1];
  var s6 = useState(0); var current = s6[0]; var setCurrent = s6[1];
  var s7 = useState(0); var total = s7[0]; var setTotal = s7[1];

  function readFile(f) {
    return new Promise(function (ok, no) {
      var r = new FileReader();
      r.onload = function () { ok(r.result.split(",")[1]); };
      r.onerror = function () { no(new Error("讀取失敗：" + f.name)); };
      r.readAsDataURL(f);
    });
  }

  function goBatch(files) {
    var pdfs = [];
    for (var i = 0; i < files.length; i++) {
      if (files[i].name.toLowerCase().endsWith(".pdf")) pdfs.push(files[i]);
    }
    if (pdfs.length === 0) { setErr("請選擇 PDF 檔案"); return; }
    setSt("work"); setErr(""); setResults([]); setTotal(pdfs.length); setCurrent(0);

    function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

    function tryIdentify(b64, idx, attempt) {
      var fname = pdfs[idx].name;
      return runIdentify(b64, function (msg) {
        setProg("(" + (idx + 1) + "/" + pdfs.length + ") " + msg);
      }, fname, products).catch(function (e) {
        var isRateLimit = e.message && (e.message.indexOf("exceeded_limit") >= 0 || e.message.indexOf("rate") >= 0 || e.message.indexOf("429") >= 0);
        if (isRateLimit && attempt < 3) {
          var waitSec = 30 * (attempt + 1);
          setProg("(" + (idx + 1) + "/" + pdfs.length + ") API 限流，等待 " + waitSec + " 秒後重試...");
          return wait(waitSec * 1000).then(function () { return tryIdentify(b64, idx, attempt + 1); });
        }
        throw e;
      });
    }

    var allResults = [];
    function processNext(idx) {
      if (idx >= pdfs.length) {
        setSt("done");
        return;
      }
      var f = pdfs[idx];
      setCurrent(idx + 1);
      setProg("(" + (idx + 1) + "/" + pdfs.length + ") 讀取 " + f.name + "...");

      var delayMs = idx > 0 ? 5000 : 0;
      wait(delayMs).then(function () {
        return readFile(f);
      }).then(function (b64) {
        return tryIdentify(b64, idx, 0);
      }).then(function (p) {
        p._fileName = f.name;
        allResults.push({ status: "ok", product: p, fileName: f.name });
        setResults(allResults.slice());
        onAdd(p);
        processNext(idx + 1);
      }).catch(function (e) {
        allResults.push({ status: "err", fileName: f.name, error: e.message });
        setResults(allResults.slice());
        processNext(idx + 1);
      });
    }
    processNext(0);
  }

  var doneCount = results.filter(function (r) { return r.status === "ok"; }).length;
  var errCount = results.filter(function (r) { return r.status === "err"; }).length;

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: C.tx, margin: "0 0 24px" }}>上傳辨識</h2>
      <div onDrop={function (e) { e.preventDefault(); setDrag(false); goBatch(e.dataTransfer.files); }} onDragOver={function (e) { e.preventDefault(); setDrag(true); }} onDragLeave={function () { setDrag(false); }}
        style={{ background: drag ? "#eff6ff" : C.card, borderRadius: 12, border: "2px dashed " + (drag ? C.ac : "#cbd5e1"), padding: "50px 40px", textAlign: "center", marginBottom: 24, transition: "all 0.2s" }}>
        {st === "work" ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 22, height: 22, border: "3px solid #e2e8f0", borderTopColor: C.ac, borderRadius: "50%", animation: "spin .8s linear infinite" }}></div>
              <span style={{ fontSize: 15, color: C.ac, fontWeight: 600 }}>{prog}</span>
            </div>
            <div style={{ width: "100%", maxWidth: 400, margin: "0 auto", background: "#e2e8f0", borderRadius: 4, height: 6 }}>
              <div style={{ width: (current / total * 100) + "%", background: C.ac, borderRadius: 4, height: 6, transition: "width 0.3s" }}></div>
            </div>
            <div style={{ fontSize: 12, color: C.hint, marginTop: 8 }}>{"已完成 " + results.length + " / " + total + "（成功 " + doneCount + "，失敗 " + errCount + "）"}</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 44, color: C.hint, marginBottom: 12, opacity: 0.5 }}>↑</div>
            <div style={{ fontSize: 16, color: C.tx, fontWeight: 600, marginBottom: 6 }}>拖曳 PDF 或點擊選擇檔案</div>
            <div style={{ fontSize: 13, color: C.hint, marginBottom: 20 }}>支援批次上傳，可一次選擇多個 PDF</div>
            <label style={{ padding: "11px 30px", borderRadius: 8, background: C.ac, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-block" }}>
              選擇 PDF（可多選）
              <input type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={function (e) { goBatch(e.target.files); }} />
            </label>
          </div>
        )}
      </div>

      {err && <div style={{ background: "#fef2f2", borderRadius: 10, border: "1px solid #fecaca", padding: 16, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: C.rd, fontSize: 16 }}>✕</span><span style={{ fontSize: 13, color: "#991b1b" }}>{err}</span>
      </div>}

      {results.length > 0 && (function () {
        var savedCount = results.filter(function (r) { return r.status === "ok" && r.product._savedApiCall; }).length;
        return <Card title={"辨識結果（" + doneCount + " 成功" + (errCount > 0 ? "，" + errCount + " 失敗" : "") + (savedCount > 0 ? "，本地辨識 " + savedCount + " 檔省 " + savedCount + " 次API" : "") + "）"}>
          {results.map(function (r, i) {
            if (r.status === "ok") {
              var iss = ISSUERS[r.product.issuer];
              var st = PRODUCT_TYPES[r.product.structureType] || PRODUCT_TYPES.OTHER;
              var isDup = r.product._isDuplicate;
              var warns = r.product._warnings || [];
              var saved = r.product._savedApiCall;
              return <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: iss ? iss.color : C.gn, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{iss ? iss.short : "✓"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.product.id} — {r.product.isin}</div>
                    <div style={{ fontSize: 11, color: C.hint }}>{r.fileName}</div>
                  </div>
                  <Badge color={st.color}>{st.label}</Badge>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.gn, flexShrink: 0 }}>{fp(r.product.annualizedRate)}</div>
                  {saved && <span style={{ background: "#EFF6FF", color: C.ac, fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>本地辨識</span>}
                  {isDup ? <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>覆蓋</span>
                    : <span style={{ background: "#f0fdf4", color: C.gn, fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>成功</span>}
                </div>
                {warns.length > 0 && <div style={{ marginTop: 4, marginLeft: 38 }}>
                  {warns.map(function (w, wi) { return <div key={wi} style={{ fontSize: 11, color: C.or }}>{"⚠ " + w}</div>; })}
                </div>}
              </div>;
            } else {
              return <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", color: C.rd, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✕</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.tx }}>{r.fileName}</div>
                  <div style={{ fontSize: 11, color: C.rd }}>{r.error}</div>
                </div>
                <span style={{ background: "#fef2f2", color: C.rd, fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>失敗</span>
              </div>;
            }
          })}
        </Card>;
      })()}

      {results.length === 0 && products.length > 0 && (
        <LearningPanel products={products} />
      )}

      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

/* ─── Learning Panel ─── */
function LearningPanel({ products }) {
  var s1 = useState(null); var profile = s1[0]; var setProfile = s1[1];
  useEffect(function () {
    var p = buildLearningProfile(products);
    setProfile(p);
  }, [products]);
  if (!profile) return null;
  var keys = Object.keys(profile);
  if (!keys.length) return null;
  return (
    <Card title={"學習狀態 — 已從 " + products.length + " 檔商品學習"}>
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>系統從已辨識的商品中自動累積辨識模式，下次辨識時會注入成功範例到 prompt，提高準確率並加速提取。</div>
      {keys.map(function (k) {
        var pr = profile[k];
        var iss = ISSUERS[k];
        var topTickers = Object.keys(pr.underlyingTickers || {}).sort(function (a, b) { return pr.underlyingTickers[b] - pr.underlyingTickers[a]; }).slice(0, 8);
        var topTypes = Object.keys(pr.structureTypes || {}).sort(function (a, b) { return pr.structureTypes[b] - pr.structureTypes[a]; });
        return <div key={k} style={{ padding: "14px 0", borderTop: "1px solid " + C.bdr + "66" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: iss ? iss.color : C.sub, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 700 }}>{iss ? iss.short : "?"}</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.tx }}>{iss ? iss.name : k}</div>
            <span style={{ fontSize: 12, color: C.sub }}>{pr.count + " 檔"}</span>
            <span style={{ fontSize: 12, color: C.gn, fontWeight: 600 }}>{pr.examples ? pr.examples.length : 0} 範例已注入</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12 }}>
            {pr.couponRateRange && <div style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 12px" }}>
              <div style={{ color: C.hint, fontSize: 11 }}>月配息率</div>
              <div style={{ color: C.tx, fontWeight: 500 }}>{fp(pr.couponRateRange.min)} ~ {fp(pr.couponRateRange.max)}</div>
            </div>}
            {pr.annualizedRateRange && <div style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 12px" }}>
              <div style={{ color: C.hint, fontSize: 11 }}>年化配息率</div>
              <div style={{ color: C.gn, fontWeight: 600 }}>{fp(pr.annualizedRateRange.min)} ~ {fp(pr.annualizedRateRange.max)}</div>
            </div>}
            {pr.strikePctRange && <div style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 12px" }}>
              <div style={{ color: C.hint, fontSize: 11 }}>執行價</div>
              <div style={{ color: C.tx, fontWeight: 500 }}>{fp(pr.strikePctRange.min, 0)} ~ {fp(pr.strikePctRange.max, 0)}</div>
            </div>}
            {pr.barrierPctRange && <div style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 12px" }}>
              <div style={{ color: C.hint, fontSize: 11 }}>下限價</div>
              <div style={{ color: C.rd, fontWeight: 500 }}>{fp(pr.barrierPctRange.min, 0)} ~ {fp(pr.barrierPctRange.max, 0)}</div>
            </div>}
            {pr.autocallPctRange && <div style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 12px" }}>
              <div style={{ color: C.hint, fontSize: 11 }}>出場價</div>
              <div style={{ color: C.ac, fontWeight: 500 }}>{fp(pr.autocallPctRange.min, 0)} ~ {fp(pr.autocallPctRange.max, 0)}</div>
            </div>}
            {pr.periodRange && <div style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 12px" }}>
              <div style={{ color: C.hint, fontSize: 11 }}>期數</div>
              <div style={{ color: C.tx, fontWeight: 500 }}>{pr.periodRange.min} ~ {pr.periodRange.max} 期</div>
            </div>}
          </div>
          {topTypes.length > 0 && <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: C.hint }}>類型：</span>
            {topTypes.map(function (t) {
              var pt = PRODUCT_TYPES[t] || PRODUCT_TYPES.OTHER;
              return <Badge key={t} color={pt.color}>{pt.label + " ×" + pr.structureTypes[t]}</Badge>;
            })}
          </div>}
          {topTickers.length > 0 && <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: C.hint }}>常見標的：</span>
            {topTickers.map(function (t) {
              return <span key={t} style={{ fontSize: 11, background: "#f0f4f8", padding: "2px 8px", borderRadius: 4, color: C.tx }}>{t + " ×" + pr.underlyingTickers[t]}</span>;
            })}
          </div>}
        </div>;
      })}
    </Card>
  );
}

/* ─── Usage Stats ─── */
function Usage() {
  var s1 = useState(null); var data = s1[0]; var setData = s1[1];
  var s2 = useState(true); var loading = s2[0]; var setLoading = s2[1];
  var s3 = useState(null); var drillDate = s3[0]; var setDrillDate = s3[1];

  useEffect(function () {
    loadTokens().then(function (t) { setData(t); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.hint }}>載入中...</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: C.hint }}>無資料</div>;

  var t = data.total;
  var inputCost = t.input / 1000000 * SONNET_INPUT_PRICE;
  var outputCost = t.output / 1000000 * SONNET_OUTPUT_PRICE;
  var totalCost = inputCost + outputCost;

  function resetTokens() {
    if (confirm("確定要清除所有用量紀錄？")) {
      var empty = { total: { input: 0, output: 0, calls: 0 }, history: [] };
      saveTokens(empty).then(function () { setData(empty); });
    }
  }

  /* ── aggregate by day ── */
  var byDay = {};
  data.history.forEach(function (h) {
    if (!h.time) return;
    var day = h.time.slice(0, 10);
    if (!byDay[day]) byDay[day] = { input: 0, output: 0, calls: 0, cost: 0 };
    byDay[day].input += h.input;
    byDay[day].output += h.output;
    byDay[day].calls += 1;
    byDay[day].cost += h.input / 1000000 * SONNET_INPUT_PRICE + h.output / 1000000 * SONNET_OUTPUT_PRICE;
  });
  var dayKeys = Object.keys(byDay).sort();
  var maxDayCost = Math.max.apply(null, dayKeys.map(function (d) { return byDay[d].cost; }).concat([0.001]));

  /* ── aggregate by hour for drill-down ── */
  var byHour = null;
  var drillDayData = null;
  if (drillDate && byDay[drillDate]) {
    drillDayData = byDay[drillDate];
    byHour = {};
    for (var hi = 0; hi < 24; hi++) byHour[hi] = { input: 0, output: 0, calls: 0, cost: 0 };
    data.history.forEach(function (h) {
      if (!h.time || h.time.slice(0, 10) !== drillDate) return;
      var hour = parseInt(h.time.slice(11, 13), 10);
      byHour[hour].input += h.input;
      byHour[hour].output += h.output;
      byHour[hour].calls += 1;
      byHour[hour].cost += h.input / 1000000 * SONNET_INPUT_PRICE + h.output / 1000000 * SONNET_OUTPUT_PRICE;
    });
    var maxHourCost = 0.001;
    for (var hk = 0; hk < 24; hk++) { if (byHour[hk].cost > maxHourCost) maxHourCost = byHour[hk].cost; }
  }

  /* ── render bar helper ── */
  function Bar(val, max, color, label, sub, onClick) {
    var pct = max > 0 ? Math.max(val / max * 100, val > 0 ? 3 : 0) : 0;
    return <div onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ width: "100%", height: 120, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
        {val > 0 && <div style={{ fontSize: 9, color: C.sub, marginBottom: 2 }}>{"$" + fm(val, 3)}</div>}
        <div style={{ width: "70%", maxWidth: 28, height: pct + "%", minHeight: val > 0 ? 4 : 0, background: color, borderRadius: "3px 3px 0 0", transition: "height 0.3s" }}></div>
      </div>
      <div style={{ fontSize: 10, color: C.tx, marginTop: 4, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: C.hint }}>{sub}</div>}
    </div>;
  }

  /* ── hourly drill-down view ── */
  if (drillDate && byHour && drillDayData) {
    var maxHC = 0.001;
    for (var hh = 0; hh < 24; hh++) { if (byHour[hh].cost > maxHC) maxHC = byHour[hh].cost; }
    var peakHour = 0; var peakVal = 0;
    for (var ph = 0; ph < 24; ph++) { if (byHour[ph].cost > peakVal) { peakVal = byHour[ph].cost; peakHour = ph; } }

    return (
      <div>
        <button onClick={function () { setDrillDate(null); }} style={{ background: "none", border: "none", color: C.ac, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 16, fontWeight: 500 }}>← 返回每日走勢</button>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.tx, margin: "0 0 6px" }}>{drillDate.replace(/-/g, "/")} 每小時用量</h2>
        <div style={{ fontSize: 13, color: C.sub, marginBottom: 24 }}>
          當日 {fm(drillDayData.calls, 0)} 次呼叫 · {fm(drillDayData.input, 0)} input + {fm(drillDayData.output, 0)} output · 費用 {"$" + fm(drillDayData.cost, 4)}
          {peakVal > 0 && <span style={{ marginLeft: 12, color: C.or, fontWeight: 600 }}>{"尖峰：" + peakHour + ":00~" + (peakHour + 1) + ":00"}</span>}
        </div>

        <Card>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", padding: "0 4px" }}>
            {Array.from({ length: 24 }, function (_, h) {
              var d = byHour[h];
              var isPeak = h === peakHour && peakVal > 0;
              return Bar(d.cost, maxHC, isPeak ? C.or : C.ac, h + "", d.calls > 0 ? d.calls + "次" : null, null);
            })}
          </div>
        </Card>

        <Card title="該日呼叫明細" pad="0">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f8fafc", borderBottom: "1px solid " + C.bdr }}>
                {["時間", "檔案", "階段", "Input", "Output", "費用"].map(function (h) {
                  return <th key={h} style={{ padding: "10px 14px", textAlign: h === "時間" || h === "檔案" || h === "階段" ? "left" : "right", fontWeight: 600, color: C.sub, fontSize: 12 }}>{h}</th>;
                })}
              </tr></thead>
              <tbody>{data.history.filter(function (h) { return h.time && h.time.slice(0, 10) === drillDate; }).reverse().map(function (h, i) {
                var cost = h.input / 1000000 * SONNET_INPUT_PRICE + h.output / 1000000 * SONNET_OUTPUT_PRICE;
                return <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "9px 14px", color: C.sub, fontSize: 11 }}>{h.time ? h.time.slice(11, 19) : "—"}</td>
                  <td style={{ padding: "9px 14px", color: C.tx, fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.fileName || "—"}</td>
                  <td style={{ padding: "9px 14px" }}><Badge color={h.stage === "辨識" ? C.ac : C.gn}>{h.stage || "—"}</Badge></td>
                  <td style={{ padding: "9px 14px", textAlign: "right" }}>{fm(h.input, 0)}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right" }}>{fm(h.output, 0)}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: C.or, fontWeight: 600 }}>{"$" + fm(cost, 4)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  /* ── main daily view ── */
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.tx, margin: 0 }}>用量統計</h2>
        <button onClick={resetTokens} style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid " + C.bdr, background: C.card, color: C.sub, fontSize: 12, cursor: "pointer" }}>清除紀錄</button>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
        {[
          ["API 呼叫次數", fm(t.calls, 0), "次"],
          ["Input Tokens", fm(t.input, 0)],
          ["Output Tokens", fm(t.output, 0)],
          ["累計費用", "$" + fm(totalCost, 4), "USD", C.or]
        ].map(function (x, i) {
          return <div key={i} style={{ background: C.card, borderRadius: 10, padding: "18px 22px", border: "1px solid " + C.bdr, flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 13, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{x[0]}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: x[3] || C.tx, marginTop: 4 }}>{x[1]}</div>
            {x[2] && <div style={{ fontSize: 11, color: C.hint, marginTop: 2 }}>{x[2]}</div>}
          </div>;
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card title="費用明細">
          <KV rows={[
            ["模型", "Claude Sonnet 4"],
            ["Input 單價", "$" + fm(SONNET_INPUT_PRICE, 2) + " / 1M tokens"],
            ["Output 單價", "$" + fm(SONNET_OUTPUT_PRICE, 2) + " / 1M tokens"],
            ["Input 費用", "$" + fm(inputCost, 4)],
            ["Output 費用", "$" + fm(outputCost, 4)],
            ["累計總費用", "$" + fm(totalCost, 4), C.or],
          ]} />
        </Card>
        <Card title="今日用量">
          {(function () {
            var today = new Date().toISOString().slice(0, 10);
            var td = byDay[today] || { input: 0, output: 0, calls: 0, cost: 0 };
            return <KV rows={[
              ["今日呼叫次數", fm(td.calls, 0) + " 次"],
              ["今日 Input", fm(td.input, 0) + " tokens"],
              ["今日 Output", fm(td.output, 0) + " tokens"],
              ["今日費用", "$" + fm(td.cost, 4), C.or],
            ]} />;
          })()}
        </Card>
      </div>

      {dayKeys.length > 0 && (
        <Card title={"每日費用走勢（" + dayKeys.length + " 天）— 點擊柱狀可查看每小時明細"}>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", padding: "0 4px", overflowX: "auto" }}>
            {dayKeys.slice(-30).map(function (day) {
              var d = byDay[day];
              return Bar(d.cost, maxDayCost, C.ac, day.slice(5), d.calls + "次", function () { setDrillDate(day); });
            })}
          </div>
        </Card>
      )}

      {data.history.length > 0 && (
        <Card title={"最近呼叫紀錄（共 " + data.history.length + " 筆）"} pad="0">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f8fafc", borderBottom: "1px solid " + C.bdr }}>
                {["時間", "檔案", "階段", "Input", "Output", "費用"].map(function (h) {
                  return <th key={h} style={{ padding: "10px 14px", textAlign: h === "時間" || h === "檔案" || h === "階段" ? "left" : "right", fontWeight: 600, color: C.sub, fontSize: 12 }}>{h}</th>;
                })}
              </tr></thead>
              <tbody>{data.history.slice().reverse().slice(0, 50).map(function (h, i) {
                var cost = h.input / 1000000 * SONNET_INPUT_PRICE + h.output / 1000000 * SONNET_OUTPUT_PRICE;
                return <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "9px 14px", color: C.sub, fontSize: 11 }}>{h.time ? h.time.slice(5, 16).replace("T", " ") : "—"}</td>
                  <td style={{ padding: "9px 14px", color: C.tx, fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.fileName || "—"}</td>
                  <td style={{ padding: "9px 14px" }}><Badge color={h.stage === "辨識" ? C.ac : C.gn}>{h.stage || "—"}</Badge></td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: C.tx }}>{fm(h.input, 0)}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: C.tx }}>{fm(h.output, 0)}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: C.or, fontWeight: 600 }}>{"$" + fm(cost, 4)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─── Backup ─── */
function Backup({ products, onExport, onImport }) {
  var s1 = useState(false); var drag = s1[0]; var setDrag = s1[1];
  var learning = null;
  var tokens = null;
  try { learning = JSON.parse(localStorage.getItem("sn-learning") || "null"); } catch (e) {}
  try { tokens = JSON.parse(localStorage.getItem("sn-tokens") || "null"); } catch (e) {}

  var learningKeys = learning ? Object.keys(learning) : [];
  var totalCalls = tokens && tokens.total ? tokens.total.calls : 0;

  function handleFile(f) {
    if (!f || !f.name.endsWith(".json")) { alert("請選擇 .json 備份檔案"); return; }
    onImport(f);
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: C.tx, margin: "0 0 24px" }}>備份還原</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card title="匯出備份">
          <div style={{ fontSize: 14, color: C.sub, marginBottom: 16 }}>
            將所有資料匯出為 JSON 檔案，包含商品資料、學習檔案、Token 用量紀錄。
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ background: "#f0f4f8", borderRadius: 8, padding: "10px 16px", flex: 1 }}>
              <div style={{ fontSize: 12, color: C.hint }}>商品</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.tx }}>{products.length}</div>
            </div>
            <div style={{ background: "#f0f4f8", borderRadius: 8, padding: "10px 16px", flex: 1 }}>
              <div style={{ fontSize: 12, color: C.hint }}>學習機構</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.tx }}>{learningKeys.length}</div>
            </div>
            <div style={{ background: "#f0f4f8", borderRadius: 8, padding: "10px 16px", flex: 1 }}>
              <div style={{ fontSize: 12, color: C.hint }}>API 紀錄</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.tx }}>{totalCalls}</div>
            </div>
          </div>
          <button onClick={onExport} style={{ padding: "12px 28px", borderRadius: 8, border: "none", background: C.ac, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%" }}>
            匯出 JSON 備份檔
          </button>
        </Card>

        <Card title="匯入還原">
          <div style={{ fontSize: 14, color: C.sub, marginBottom: 16 }}>
            從 JSON 備份檔還原資料。匯入後會覆蓋目前的所有資料。
          </div>
          <div onDrop={function (e) { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
            onDragOver={function (e) { e.preventDefault(); setDrag(true); }}
            onDragLeave={function () { setDrag(false); }}
            style={{ background: drag ? "#EFF6FF" : "#f8fafc", border: "2px dashed " + (drag ? C.ac : C.bdr), borderRadius: 10, padding: "36px 20px", textAlign: "center", marginBottom: 16, transition: "all 0.2s" }}>
            <div style={{ fontSize: 32, color: C.hint, marginBottom: 8, opacity: 0.5 }}>⇅</div>
            <div style={{ fontSize: 14, color: C.tx, fontWeight: 500, marginBottom: 12 }}>拖曳備份檔案或點擊選擇</div>
            <label style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid " + C.bdr, background: C.card, color: C.tx, fontSize: 13, fontWeight: 500, cursor: "pointer", display: "inline-block" }}>
              選擇 JSON 檔案
              <input type="file" accept=".json" style={{ display: "none" }} onChange={function (e) { handleFile(e.target.files[0]); }} />
            </label>
          </div>
          <div style={{ fontSize: 12, color: C.or, padding: "8px 12px", background: "#FFFBEB", borderRadius: 6 }}>
            ⚠ 匯入會覆蓋目前資料，建議先匯出備份
          </div>
        </Card>
      </div>

      <Card title="備份建議">
        <KV rows={[
          ["建議頻率", "每次大量上傳後備份一次"],
          ["檔案大小", products.length > 0 ? "約 " + Math.round(JSON.stringify(products).length / 1024) + " KB" : "—"],
          ["儲存位置", "目前所有資料存在瀏覽器 localStorage"],
          ["風險提醒", "清除瀏覽器資料、換電腦、換瀏覽器都會遺失", C.rd],
        ]} />
      </Card>
    </div>
  );
}

/* ═══ App ═══ */
export default function App() {
  var t1 = useState("dashboard"); var tab = t1[0]; var setTab = t1[1];
  var t2 = useState([]); var products = t2[0]; var setProducts = t2[1];
  var t3 = useState(null); var sel = t3[0]; var setSel = t3[1];
  var t4 = useState(false); var loaded = t4[0]; var setLoaded = t4[1];
  var t5 = useState(""); var filter = t5[0]; var setFilter = t5[1];

  useEffect(function () { dbLoad().then(function (p) { setProducts(p); setLoaded(true); }); }, []);
  useEffect(function () {
    if (loaded) {
      dbSave(products);
      var profile = buildLearningProfile(products);
      saveLearningProfile(profile);
    }
  }, [products, loaded]);

  var add = useCallback(function (p) {
    setProducts(function (prev) {
      var exists = prev.find(function (x) { return x.id === p.id && x.isin === p.isin; });
      if (exists) return prev.map(function (x) { return (x.id === p.id && x.isin === p.isin) ? Object.assign({}, x, p) : x; });
      return prev.concat([p]);
    });
  }, []);

  var del = useCallback(function (id) {
    setProducts(function (prev) { return prev.filter(function (p) { return p.id !== id; }); });
    setSel(function (s) { return s && s.id === id ? null : s; });
  }, []);

  function switchTab(t) { setTab(t); setSel(null); setFilter(""); }

  function exportAll() {
    var data = {
      version: "sn-manager-v1",
      exportDate: new Date().toISOString(),
      products: products,
      learning: null,
      tokens: null,
    };
    try { data.learning = JSON.parse(localStorage.getItem("sn-learning") || "null"); } catch (e) {}
    try { data.tokens = JSON.parse(localStorage.getItem("sn-tokens") || "null"); } catch (e) {}
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "sn-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importAll(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (data.products && Array.isArray(data.products)) {
          setProducts(function (prev) {
            var merged = prev.slice();
            var added = 0; var updated = 0;
            data.products.forEach(function (np) {
              var idx = merged.findIndex(function (x) { return x.id === np.id && x.isin === np.isin; });
              if (idx >= 0) { merged[idx] = Object.assign({}, merged[idx], np); updated++; }
              else { merged.push(np); added++; }
            });
            alert("匯入完成！新增 " + added + " 檔，更新 " + updated + " 檔，共 " + merged.length + " 檔");
            var profile = buildLearningProfile(merged);
            saveLearningProfile(profile);
            return merged;
          });
        }
        if (data.tokens) {
          localStorage.setItem("sn-tokens", JSON.stringify(data.tokens));
        }
      } catch (e) {
        alert("匯入失敗：" + e.message);
      }
    };
    reader.readAsText(file);
  }

  var reclassify = useCallback(function () {
    setProducts(function (prev) {
      return prev.map(function (p) {
        var newType = autoClassify(p);
        return Object.assign({}, p, { structureType: newType, _autoClassified: newType });
      });
    });
  }, []);

  function goProductWithFilter(f) {
    setFilter(f);
    setTab("products");
    setSel(null);
  }

  return (
    <div style={{ display: "flex", minHeight: 600, fontFamily: "'Noto Sans TC', -apple-system, sans-serif", background: C.bg, fontSize: 15 }}>
      <Sidebar tab={tab} setTab={switchTab} n={products.length} />
      <div style={{ flex: 1, padding: "28px 32px", maxWidth: 1060, minWidth: 0, overflowX: "hidden" }}>
        {tab === "dashboard" && <Dashboard products={products} setTab={switchTab} setFilter={goProductWithFilter} />}
        {tab === "products" && !sel && <ProductList products={products} onSelect={setSel} onDel={del} initSearch={filter} onReclassify={reclassify} />}
        {tab === "products" && sel && <Detail product={sel} onBack={function () { setSel(null); }} onUpdateType={function (id, isin, newType) {
          setProducts(function (prev) {
            return prev.map(function (p) {
              if (p.id === id && p.isin === isin) { var updated = Object.assign({}, p, { structureType: newType }); setSel(updated); return updated; }
              return p;
            });
          });
        }} />}
        {tab === "calculator" && products.length > 0 && <Calc products={products} />}
        {tab === "calculator" && products.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.hint }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>⊞</div>
            <div style={{ fontSize: 15, color: C.sub, marginBottom: 20 }}>尚無商品</div>
            <button onClick={function () { switchTab("upload"); }} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: C.ac, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>上傳商品</button>
          </div>
        )}
        {tab === "upload" && <Upload onAdd={add} products={products} />}
        {tab === "usage" && <Usage />}
        {tab === "backup" && <Backup products={products} onExport={exportAll} onImport={importAll} />}
      </div>
    </div>
  );
}
