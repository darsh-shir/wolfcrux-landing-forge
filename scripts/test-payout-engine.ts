/**
 * Checks the payout engine against the examples agreed with management.
 * Run: npm run test:payouts
 */
import assert from "node:assert/strict";
import {
  computeHistory,
  computeMonth,
  levelFor,
  shareOfRow,
  type PersonDayShare,
  type TradeRow,
} from "../src/lib/payoutEngine";

let passed = 0;
const near = (actual: number, expected: number, label: string) => {
  assert.ok(Math.abs(actual - expected) < 0.005, `${label}: expected ${expected}, got ${actual}`);
};
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
};

// Helpers -------------------------------------------------------------------
const days = (n: number, start: number, pnlPerDay: number, sharesPerDay: number, extra: Partial<TradeRow> = {}): TradeRow[] =>
  Array.from({ length: n }, (_, i) => ({
    trade_date: `2026-03-${String(start + i).padStart(2, "0")}`,
    user_id: "A",
    trader2_id: null,
    trader2_role: "trainee",
    trader1_attendance: "present",
    trader2_attendance: "present",
    net_pnl: pnlPerDay,
    shares_traded: sharesPerDay,
    ...extra,
  }));
const monthDays = (month: string, n: number, pnlPerDay: number, sharesPerDay: number): TradeRow[] =>
  days(n, 1, pnlPerDay, sharesPerDay).map((r) => ({ ...r, trade_date: `${month}${r.trade_date.slice(7)}` }));
const sharesFor = (person: string, rows: TradeRow[]) =>
  rows.map((r) => shareOfRow(person, r)).filter(Boolean) as PersonDayShare[];

console.log("Payout engine");

test("single trader, Level 2 (example from the owner)", () => {
  // $10,000 gross, 30,000 shares, $1,000 software, 35% STO / 15% LTO
  const r = computeMonth({ days: sharesFor("A", days(20, 1, 500, 1500)), seatCost: 1000, stoPercent: 35, ltoPercent: 15 });
  near(r.grossPnl, 10000, "gross");
  near(r.shareCost, 420, "share cost");
  near(r.netProfit, 8580, "net");
  near(r.sto, 3003, "STO");
  near(r.secondPcShare, 750.75, "25% of STO");
  near(r.finalSto, 2252.25, "final STO");
  near(r.lto, 1287, "LTO");
});

test("partners A (L2) and B (L1): 15 days together, 5 days A alone", () => {
  const together = days(15, 1, 8000 / 15, 20000 / 15, { trader2_id: "B", trader2_role: "partner" });
  const aAlone = days(5, 16, 400, 2000, { trader2_id: "B", trader2_role: "partner", trader2_attendance: "absent" });
  const rows = [...together, ...aAlone];

  const a = computeMonth({ days: sharesFor("A", rows), seatCost: 1000, stoPercent: 35, ltoPercent: 15 });
  near(a.grossPnl, 6000, "A gross");
  near(a.shareCost, 280, "A share cost");
  near(a.softwareCost, 500, "A software");
  near(a.netProfit, 5220, "A net");
  near(a.sto, 1827, "A STO");
  near(a.secondPcShare, 162.75, "A solo-day 25%");
  near(a.finalSto, 1664.25, "A final STO");
  near(a.lto, 783, "A LTO");
  assert.equal(a.togetherDays, 15);
  assert.equal(a.soloDays, 5);

  const b = computeMonth({ days: sharesFor("B", rows), seatCost: 1000, stoPercent: 25, ltoPercent: 10 });
  near(b.grossPnl, 4000, "B gross");
  near(b.shareCost, 140, "B share cost");
  near(b.netProfit, 3360, "B net");
  near(b.sto, 840, "B STO");
  near(b.secondPcShare, 0, "B pays no 25%");
  near(b.finalSto, 840, "B final STO");
  near(b.lto, 336, "B LTO");
});

test("partner trades the seat alone when the primary is absent", () => {
  const rows = days(1, 1, 1000, 0, { trader2_id: "B", trader2_role: "partner", trader1_attendance: "absent" });
  assert.equal(sharesFor("A", rows).length, 0, "A gets nothing");
  const b = sharesFor("B", rows);
  near(b[0].pnl, 1000, "B gets the full day");
  assert.equal(b[0].together, false);
});

test("losses carry forward; LTO goes negative", () => {
  const march = computeMonth({ days: [], seatCost: 0, transfersNet: -5000, stoPercent: 35, ltoPercent: 15 });
  near(march.netProfit, -5000, "March net");
  near(march.sto, 0, "March STO");
  near(march.lto, -750, "March LTO");
  near(march.deficitAfter, 5000, "carried loss");
  const april = computeMonth({ days: [], seatCost: 0, transfersNet: 10000, priorDeficit: march.deficitAfter, stoPercent: 35, ltoPercent: 15 });
  near(april.stoBase, 5000, "April STO base");
  near(april.sto, 1750, "April STO");
  near(april.lto, 1500, "April LTO");
  near(april.deficitAfter, 0, "loss recovered");
});

test("leave deduction reduces STO and positive LTO; 25% taken after leave", () => {
  const r = computeMonth({ days: sharesFor("A", days(20, 1, 500, 1500)), seatCost: 1000, stoPercent: 35, ltoPercent: 15, leavePct: 4 });
  near(r.leaveDeductionSto, 120.12, "STO leave deduction");
  near(r.secondPcShare, (3003 - 120.12) * 0.25, "25% after leave");
  near(r.leaveDeductionLto, 51.48, "LTO leave deduction");
  near(r.finalLto, 1235.52, "final LTO");
});

test("transfers move net profit", () => {
  const r = computeMonth({ days: sharesFor("A", days(20, 1, 500, 1500)), seatCost: 1000, transfersNet: -500, stoPercent: 35, ltoPercent: 15 });
  near(r.netProfit, 8080, "net after giving $500");
});

test("level: trading days OR profit", () => {
  assert.equal(levelFor(130, 30000).level, 1, "125 days reaches L1");
  assert.equal(levelFor(10, 160000).level, 2, "$150k reaches L2");
  assert.equal(levelFor(10, 1000).level, 0);
});

test("history: level is taken at the start of each month; software charged from joining", () => {
  const rows = days(20, 1, 500, 1500); // March 2026 only
  const h = computeHistory({
    personId: "A",
    rows,
    startMonth: "2026-01",
    throughMonth: "2026-04",
    baseline: { asOfDate: "2025-12-01", days: 120, netProfit: 40000 },
  });
  assert.deepEqual(h.months.map((m) => m.month), ["2026-01", "2026-02", "2026-03", "2026-04"]);
  near(h.byMonth.get("2026-01")!.netProfit, -1000, "Jan: software with no trades");
  assert.equal(h.byMonth.get("2026-03")!.level.level, 0, "March starts at L0 (120 days, $38k)");
  assert.equal(h.byMonth.get("2026-04")!.level.level, 1, "April starts at L1 (140 days)");
  near(h.byMonth.get("2026-03")!.priorDeficit, 2000, "Jan+Feb losses carried into March");
  near(h.byMonth.get("2026-03")!.stoBase, 8580 - 2000, "March STO only above the carried loss");
});

test("old rows without attendance count as present; trainee rows are solo", () => {
  const rows = days(2, 1, 100, 0, { trader1_attendance: null, trader2_attendance: null, trader2_role: "trainee", trader2_id: null });
  const a = sharesFor("A", rows);
  assert.equal(a.length, 2);
  assert.equal(a.every((d) => !d.together && d.present), true);
  // A partner row with missing attendance is treated as sitting together.
  const p = sharesFor("A", days(1, 3, 100, 0, { trader2_id: "B", trader2_role: "partner", trader1_attendance: null, trader2_attendance: null }));
  assert.equal(p[0].together, true);
  near(p[0].pnl, 50, "half the day");
});

test("manual percentages override the level table", () => {
  const h = computeHistory({
    personId: "A",
    rows: days(20, 1, 500, 1500),
    throughMonth: "2026-03",
    configFor: (k) => (k === "2026-03" ? { mode: "manual", stoPercent: 40, ltoPercent: 5 } : undefined),
  });
  const m = h.byMonth.get("2026-03")!;
  assert.equal(m.stoPercent, 40);
  near(m.sto, 8580 * 0.4, "manual STO");
});

test("a profitable solo-day share can't exceed the STO left after leave", () => {
  // Overall net is negative (no STO) even though solo days were profitable.
  const together = days(10, 1, -1000, 0, { trader2_id: "B", trader2_role: "partner" });
  const solo = days(2, 11, 300, 0, { trader2_id: "B", trader2_role: "partner", trader2_attendance: "absent" });
  const r = computeMonth({ days: sharesFor("A", [...together, ...solo]), seatCost: 1000, stoPercent: 35, ltoPercent: 15 });
  near(r.sto, 0, "no STO");
  near(r.secondPcShare, 0, "no 25% without STO");
});

test("manual level from a backdated month, with default and per-person %", () => {
  const rows = [...monthDays("2026-01", 20, 500, 1500), ...monthDays("2026-02", 20, 500, 1500), ...monthDays("2026-03", 20, 500, 1500)];
  // Told in March that the upgrade to Level 2 happened in February.
  const h = computeHistory({
    personId: "A",
    rows,
    throughMonth: "2026-03",
    levelChanges: [{ month: "2026-02", level: 2 }],
  });
  assert.equal(h.byMonth.get("2026-01")!.manualLevel, false, "January still automatic");
  assert.equal(h.byMonth.get("2026-02")!.stoPercent, 35, "February at Level 2 default STO");
  assert.equal(h.byMonth.get("2026-03")!.ltoPercent, 15, "March at Level 2 default LTO");
  assert.equal(h.currentLevel.level, 2);
  assert.equal(h.levelSince, "2026-02");
  // Same, with a per-person STO.
  const h2 = computeHistory({ personId: "A", rows, throughMonth: "2026-03", levelChanges: [{ month: "2026-02", level: 2, stoPercent: 30 }] });
  assert.equal(h2.byMonth.get("2026-02")!.stoPercent, 30);
  assert.equal(h2.byMonth.get("2026-02")!.ltoPercent, 15, "LTO keeps the default");
  assert.equal(h2.currentStoPercent, 30);
});

test("milestone overrides change progress, not payouts", () => {
  const rows = monthDays("2026-01", 20, 500, 1500);
  const plain = computeHistory({ personId: "A", rows, throughMonth: "2026-01" });
  const h = computeHistory({ personId: "A", rows, throughMonth: "2026-01", milestoneOverrides: new Map([["2026-01", 20000]]) });
  near(h.byMonth.get("2026-01")!.netProfit, plain.byMonth.get("2026-01")!.netProfit, "payout net unchanged");
  near(h.byMonth.get("2026-01")!.finalSto, plain.byMonth.get("2026-01")!.finalSto, "STO unchanged");
  near(h.totalProfit, 20000, "milestone uses the admin figure");
});

console.log(`\n${passed} passed`);
