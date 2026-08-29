import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql, desc, like } from "drizzle-orm";
import { financialTransactions, financialSettings, orders } from "../db/schema";

export const DEFAULT_CATEGORIES = [
  "Personnel",
  "Advertising & Marketing",
  "Software",
  "VPS & Proxy",
  "Others",
  "Development",
  "Stripe Cost",
  "Product Fulfillment (COGS)"
];

/**
 * Ensure financial tables exist in D1 (self-healing migration)
 */
export async function initFinancialTables(d1: D1Database): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS financial_transactions (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      type text NOT NULL,
      category text NOT NULL,
      amount_vnd real NOT NULL DEFAULT 0.0,
      amount_usd real NOT NULL DEFAULT 0.0,
      exchange_rate real NOT NULL DEFAULT 26000.0,
      input_currency text NOT NULL DEFAULT 'VND',
      transaction_date text NOT NULL,
      year integer NOT NULL,
      month integer NOT NULL,
      note text DEFAULT '',
      event text DEFAULT '',
      image_proof_url text DEFAULT '',
      is_recurring integer DEFAULT 0,
      repeat_frequency text DEFAULT 'none',
      repeat_until text,
      is_excluded_from_report integer DEFAULT 0,
      debt_status text DEFAULT 'n/a',
      debt_counterparty text DEFAULT '',
      debt_due_date text,
      created_at text,
      updated_at text
    );`,
    `CREATE INDEX IF NOT EXISTS idx_fin_tx_type ON financial_transactions (type);`,
    `CREATE INDEX IF NOT EXISTS idx_fin_tx_year_month ON financial_transactions (year, month);`,
    `CREATE INDEX IF NOT EXISTS idx_fin_tx_category ON financial_transactions (category);`,
    `CREATE INDEX IF NOT EXISTS idx_fin_tx_excluded ON financial_transactions (is_excluded_from_report);`,
    `CREATE INDEX IF NOT EXISTS idx_fin_tx_debt_status ON financial_transactions (debt_status);`,
    `CREATE TABLE IF NOT EXISTS financial_settings (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      default_exchange_rate real DEFAULT 26000.0,
      company_name text DEFAULT 'Just One Tee Group',
      updated_at text
    );`
  ];

  for (const query of statements) {
    try {
      await d1.prepare(query).run();
    } catch (e) {
      console.warn("Table init statement error (non-fatal):", e);
    }
  }

  // Ensure default settings record exists
  try {
    const existing = await d1.prepare("SELECT id FROM financial_settings LIMIT 1").first();
    if (!existing) {
      await d1.prepare(
        "INSERT INTO financial_settings (id, default_exchange_rate, company_name, updated_at) VALUES (1, 26000.0, 'Just One Tee Group', ?)"
      ).bind(new Date().toISOString()).run();
    }
  } catch (e) {
    console.warn("Settings check error:", e);
  }
}

export interface MonthlyPLData {
  month: number; // 1 to 12
  monthLabel: string; // Jan..Dec
  hasData: boolean;
  orderRevenue: number;
  manualRevenue: number;
  totalRevenue: number;
  refund: number;
  crossRevenue: number; // Gross Revenue = Total Revenue - Refund
  cogs: number; // Order fulfillment / COGS
  costCategories: Record<string, number>; // Category name -> USD amount
  totalCost: number;
  netProfitUsd: number;
  netProfitVnd: number;
  netProfitMargin: number; // percentage
  accumulateProfitUsd: number;
  accumulateProfitVnd: number;
}

export interface PLReportSummary {
  year: number;
  companyName: string;
  exchangeRate: number;
  months: MonthlyPLData[];
  totals: {
    orderRevenue: number;
    manualRevenue: number;
    totalRevenue: number;
    refund: number;
    crossRevenue: number;
    cogs: number;
    costCategories: Record<string, number>;
    totalCost: number;
    netProfitUsd: number;
    netProfitVnd: number;
    netProfitMargin: number;
    accumulateProfitUsd: number;
    accumulateProfitVnd: number;
  };
  categoriesList: string[];
  spendDistribution: {
    category: string;
    amountUsd: number;
    amountVnd: number;
    percentage: number;
  }[];
  monthlyTrends: {
    month: number;
    label: string;
    grossRevenue: number;
    totalCost: number;
    netProfit: number;
  }[];
  availableYears: number[];
}

/**
 * Generate full Year P&L Report
 */
export async function generatePLReport(
  d1: D1Database,
  targetYear: number,
  overrideExchangeRate?: number
): Promise<PLReportSummary> {
  await initFinancialTables(d1);
  const db = drizzle(d1);

  // 1. Fetch settings
  let exchangeRate = overrideExchangeRate || 26000.0;
  let companyName = "Just One Tee Group";
  try {
    const settingsRecord = await db.select().from(financialSettings).limit(1);
    if (settingsRecord[0]) {
      if (!overrideExchangeRate && settingsRecord[0].defaultExchangeRate) {
        exchangeRate = settingsRecord[0].defaultExchangeRate;
      }
      if (settingsRecord[0].companyName) {
        companyName = settingsRecord[0].companyName;
      }
    }
  } catch (e) {
    console.warn("Could not read financial settings:", e);
  }

  // 2. Fetch all orders for this year to aggregate monthly revenue & COGS
  // Format of createdAt in orders is ISO string 'YYYY-MM-DDTHH:mm:ss' or 'YYYY-MM-DD'
  const yearPrefix = `${targetYear}-`;
  const orderRows = await db
    .select({
      createdAt: orders.createdAt,
      revenue: orders.revenue,
      cost: orders.cost
    })
    .from(orders)
    .where(like(orders.createdAt, `${yearPrefix}%`));

  const monthlyOrderRevenue: Record<number, number> = {};
  const monthlyOrderCogs: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    monthlyOrderRevenue[m] = 0;
    monthlyOrderCogs[m] = 0;
  }

  for (const row of orderRows) {
    if (!row.createdAt) continue;
    try {
      const parts = row.createdAt.split("-");
      if (parts.length >= 2) {
        const m = parseInt(parts[1]!, 10);
        if (m >= 1 && m <= 12) {
          monthlyOrderRevenue[m] = (monthlyOrderRevenue[m] || 0) + (row.revenue || 0);
          monthlyOrderCogs[m] = (monthlyOrderCogs[m] || 0) + (row.cost || 0);
        }
      }
    } catch (_) {}
  }

  // 3. Fetch all financial transactions for targetYear not excluded from report
  const transactions = await db
    .select()
    .from(financialTransactions)
    .where(
      and(
        eq(financialTransactions.year, targetYear),
        eq(financialTransactions.isExcludedFromReport, false)
      )
    );

  // Discover all cost categories present in transactions + defaults
  const categorySet = new Set<string>(DEFAULT_CATEGORIES);
  for (const tx of transactions) {
    if (tx.type === "cost" && tx.category) {
      categorySet.add(tx.category.trim());
    }
  }
  const allCategories = Array.from(categorySet);

  // Initialize data structures for 12 months
  const monthlyManualRevenue: Record<number, number> = {};
  const monthlyRefunds: Record<number, number> = {};
  const monthlyCostByCategory: Record<number, Record<string, number>> = {};

  for (let m = 1; m <= 12; m++) {
    monthlyManualRevenue[m] = 0;
    monthlyRefunds[m] = 0;
    monthlyCostByCategory[m] = {};
    for (const cat of allCategories) {
      monthlyCostByCategory[m]![cat] = 0;
    }
  }

  // Distribute transactions into months
  for (const tx of transactions) {
    const m = tx.month;
    if (m < 1 || m > 12) continue;

    // Use amountUsd directly or convert from amountVnd if 0
    let usd = tx.amountUsd;
    if (!usd && tx.amountVnd) {
      usd = tx.amountVnd / (tx.exchangeRate || exchangeRate);
    }

    if (tx.type === "revenue") {
      const catLower = (tx.category || "").toLowerCase();
      if (catLower === "refund" || catLower === "refunds") {
        monthlyRefunds[m] = (monthlyRefunds[m] || 0) + usd;
      } else {
        monthlyManualRevenue[m] = (monthlyManualRevenue[m] || 0) + usd;
      }
    } else if (tx.type === "cost") {
      const cat = tx.category || "Others";
      monthlyCostByCategory[m]![cat] = (monthlyCostByCategory[m]![cat] || 0) + usd;
    }
  }

  // Add auto-synced Order Fulfillment Cost to Product Fulfillment (COGS) category
  // and auto-estimate Stripe Processing Fee (2.50%) if no manual Stripe Cost is entered
  for (let m = 1; m <= 12; m++) {
    const cogsFromOrders = monthlyOrderCogs[m] || 0;
    if (cogsFromOrders > 0) {
      monthlyCostByCategory[m]!["Product Fulfillment (COGS)"] =
        (monthlyCostByCategory[m]!["Product Fulfillment (COGS)"] || 0) + cogsFromOrders;
    }

    const orderRev = monthlyOrderRevenue[m] || 0;
    if (orderRev > 0 && (!monthlyCostByCategory[m]!["Stripe Cost"] || monthlyCostByCategory[m]!["Stripe Cost"] === 0)) {
      // Auto compute 2.50% standard gateway fee matching the spreadsheet formula
      monthlyCostByCategory[m]!["Stripe Cost"] = Number((orderRev * 0.025).toFixed(2));
    }
  }

  // 4. Build monthly rows with P&L formulas and cumulative profit
  const monthsData: MonthlyPLData[] = [];
  let runningCumulativeUsd = 0;

  for (let m = 1; m <= 12; m++) {
    const orderRev = monthlyOrderRevenue[m] || 0;
    const manRev = monthlyManualRevenue[m] || 0;
    const totRev = orderRev + manRev;
    const refund = monthlyRefunds[m] || 0;
    const crossRev = totRev - refund;
    const cogs = monthlyCostByCategory[m]!["Product Fulfillment (COGS)"] || 0;

    let totalMonthCost = 0;
    const catAmounts: Record<string, number> = {};
    for (const cat of allCategories) {
      const amt = monthlyCostByCategory[m]![cat] || 0;
      catAmounts[cat] = amt;
      totalMonthCost += amt;
    }

    const netProfitUsd = crossRev - totalMonthCost;
    const netProfitVnd = netProfitUsd * exchangeRate;
    const netProfitMargin = crossRev !== 0 ? (netProfitUsd / crossRev) * 100 : 0;

    runningCumulativeUsd += netProfitUsd;
    const accumulateProfitVnd = runningCumulativeUsd * exchangeRate;
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const hasData = orderRev > 0 || manRev > 0 || refund > 0 || totalMonthCost > 0;

    monthsData.push({
      month: m,
      monthLabel: MONTH_NAMES[m - 1] || `Mth ${m}`,
      hasData,
      orderRevenue: orderRev,
      manualRevenue: manRev,
      totalRevenue: totRev,
      refund: refund,
      crossRevenue: crossRev,
      cogs: cogs,
      costCategories: catAmounts,
      totalCost: totalMonthCost,
      netProfitUsd: netProfitUsd,
      netProfitVnd: netProfitVnd,
      netProfitMargin: netProfitMargin,
      accumulateProfitUsd: runningCumulativeUsd,
      accumulateProfitVnd: accumulateProfitVnd
    });
  }

  // 5. Calculate Annual Totals
  const totalOrderRev = monthsData.reduce((acc, cur) => acc + cur.orderRevenue, 0);
  const totalManualRev = monthsData.reduce((acc, cur) => acc + cur.manualRevenue, 0);
  const totalRev = monthsData.reduce((acc, cur) => acc + cur.totalRevenue, 0);
  const totalRefund = monthsData.reduce((acc, cur) => acc + cur.refund, 0);
  const totalCrossRev = totalRev - totalRefund;
  const totalCogs = monthsData.reduce((acc, cur) => acc + cur.cogs, 0);

  const totalCatCosts: Record<string, number> = {};
  for (const cat of allCategories) {
    totalCatCosts[cat] = monthsData.reduce((acc, cur) => acc + (cur.costCategories[cat] || 0), 0);
  }
  const grandTotalCost = Object.values(totalCatCosts).reduce((a, b) => a + b, 0);
  const grandNetProfitUsd = totalCrossRev - grandTotalCost;
  const grandNetProfitVnd = grandNetProfitUsd * exchangeRate;
  const grandMargin = totalCrossRev !== 0 ? (grandNetProfitUsd / totalCrossRev) * 100 : 0;

  // 6. Calculate Spend Distribution for Circle / Donut Chart
  const spendDistribution = allCategories
    .map((cat) => {
      const amtUsd = totalCatCosts[cat] || 0;
      const amtVnd = amtUsd * exchangeRate;
      const pct = grandTotalCost > 0 ? (amtUsd / grandTotalCost) * 100 : 0;
      return {
        category: cat,
        amountUsd: amtUsd,
        amountVnd: amtVnd,
        percentage: Number(pct.toFixed(2))
      };
    })
    .filter((item) => item.amountUsd > 0)
    .sort((a, b) => b.amountUsd - a.amountUsd);

  // 7. Monthly Trends for Column / Bar Chart
  const monthlyTrends = monthsData.map((m) => ({
    month: m.month,
    label: m.monthLabel,
    grossRevenue: Number(m.crossRevenue.toFixed(2)),
    totalCost: Number(m.totalCost.toFixed(2)),
    netProfit: Number(m.netProfitUsd.toFixed(2))
  }));

  // 8. Discover available years from orders + transactions
  const availableYearsSet = new Set<number>([2024, 2025, 2026, 2027, targetYear]);
  try {
    const yearsFromTx = await d1
      .prepare("SELECT DISTINCT year FROM financial_transactions WHERE year IS NOT NULL")
      .all<{ year: number }>();
    if (yearsFromTx.results) {
      for (const r of yearsFromTx.results) {
        if (r.year) availableYearsSet.add(r.year);
      }
    }
  } catch (_) {}

  const sortedYears = Array.from(availableYearsSet).sort((a, b) => a - b);

  return {
    year: targetYear,
    companyName,
    exchangeRate,
    months: monthsData,
    totals: {
      orderRevenue: totalOrderRev,
      manualRevenue: totalManualRev,
      totalRevenue: totalRev,
      refund: totalRefund,
      crossRevenue: totalCrossRev,
      cogs: totalCogs,
      costCategories: totalCatCosts,
      totalCost: grandTotalCost,
      netProfitUsd: grandNetProfitUsd,
      netProfitVnd: grandNetProfitVnd,
      netProfitMargin: grandMargin,
      accumulateProfitUsd: runningCumulativeUsd,
      accumulateProfitVnd: runningCumulativeUsd * exchangeRate
    },
    categoriesList: allCategories,
    spendDistribution,
    monthlyTrends,
    availableYears: sortedYears
  };
}

/**
 * Fetch and Filter Transactions
 */
export async function getFinancialTransactions(
  d1: D1Database,
  params: {
    type?: string;
    category?: string;
    year?: number;
    month?: number;
    debtStatus?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
) {
  await initFinancialTables(d1);
  const db = drizzle(d1);

  const conditions = [];
  if (params.type) {
    conditions.push(eq(financialTransactions.type, params.type));
  }
  if (params.category) {
    conditions.push(eq(financialTransactions.category, params.category));
  }
  if (params.year) {
    conditions.push(eq(financialTransactions.year, params.year));
  }
  if (params.month) {
    conditions.push(eq(financialTransactions.month, params.month));
  }
  if (params.debtStatus) {
    conditions.push(eq(financialTransactions.debtStatus, params.debtStatus));
  }
  if (params.search) {
    const q = `%${params.search}%`;
    conditions.push(
      sql`(${financialTransactions.note} LIKE ${q} OR ${financialTransactions.event} LIKE ${q} OR ${financialTransactions.debtCounterparty} LIKE ${q} OR ${financialTransactions.category} LIKE ${q})`
    );
  }

  let query = db.select().from(financialTransactions);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const limit = params.limit || 100;
  const offset = params.offset || 0;

  const results = await query
    .orderBy(desc(financialTransactions.transactionDate), desc(financialTransactions.id))
    .limit(limit)
    .offset(offset);

  return results;
}

/**
 * Create Transaction with automatic USD/VND conversions and recurrence logic
 */
export async function createFinancialTransaction(
  d1: D1Database,
  data: {
    type: "cost" | "revenue" | "debt";
    category: string;
    amount: number;
    inputCurrency: "VND" | "USD";
    exchangeRate?: number;
    transactionDate?: string;
    note?: string;
    event?: string;
    imageProofUrl?: string;
    isRecurring?: boolean;
    repeatFrequency?: "none" | "monthly" | "weekly" | "yearly";
    repeatUntil?: string;
    isExcludedFromReport?: boolean;
    debtStatus?: "unpaid" | "paid" | "partial" | "n/a";
    debtCounterparty?: string;
    debtDueDate?: string;
  }
) {
  await initFinancialTables(d1);
  const db = drizzle(d1);

  // Resolve exchange rate
  let rate = data.exchangeRate;
  if (!rate || rate <= 0) {
    const settings = await db.select().from(financialSettings).limit(1);
    rate = settings[0]?.defaultExchangeRate || 26000.0;
  }

  const inputCurrency = data.inputCurrency || "VND";
  const rawAmount = data.amount || 0;

  let amountVnd = 0;
  let amountUsd = 0;

  if (inputCurrency === "VND") {
    amountVnd = rawAmount;
    amountUsd = Number((rawAmount / rate).toFixed(2));
  } else {
    amountUsd = rawAmount;
    amountVnd = Math.round(rawAmount * rate);
  }

  const now = new Date();
  const txDateStr = data.transactionDate || now.toISOString().split("T")[0]!;
  const parsedDate = new Date(txDateStr);
  const year = isNaN(parsedDate.getFullYear()) ? now.getFullYear() : parsedDate.getFullYear();
  const month = isNaN(parsedDate.getMonth()) ? now.getMonth() + 1 : parsedDate.getMonth() + 1;

  const newTx = {
    type: data.type,
    category: data.category || "Others",
    amountVnd,
    amountUsd,
    exchangeRate: rate,
    inputCurrency,
    transactionDate: txDateStr,
    year,
    month,
    note: data.note || "",
    event: data.event || "",
    imageProofUrl: data.imageProofUrl || "",
    isRecurring: data.isRecurring || false,
    repeatFrequency: data.repeatFrequency || "none",
    repeatUntil: data.repeatUntil || null,
    isExcludedFromReport: data.isExcludedFromReport || false,
    debtStatus: data.type === "debt" ? data.debtStatus || "unpaid" : "n/a",
    debtCounterparty: data.debtCounterparty || "",
    debtDueDate: data.debtDueDate || null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  const inserted = await db.insert(financialTransactions).values(newTx).returning();
  return inserted[0];
}

/**
 * Update Transaction
 */
export async function updateFinancialTransaction(
  d1: D1Database,
  id: number,
  data: Partial<{
    type: "cost" | "revenue" | "debt";
    category: string;
    amount: number;
    inputCurrency: "VND" | "USD";
    exchangeRate: number;
    transactionDate: string;
    note: string;
    event: string;
    imageProofUrl: string;
    isRecurring: boolean;
    repeatFrequency: string;
    repeatUntil: string;
    isExcludedFromReport: boolean;
    debtStatus: string;
    debtCounterparty: string;
    debtDueDate: string;
  }>
) {
  await initFinancialTables(d1);
  const db = drizzle(d1);

  const existing = await db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.id, id))
    .limit(1);

  if (!existing[0]) {
    throw new Error(`Transaction #${id} not found`);
  }

  const prev = existing[0];
  const rate: number = (data.exchangeRate !== undefined ? data.exchangeRate : prev.exchangeRate) || 26000.0;
  const inputCurrency = data.inputCurrency || prev.inputCurrency;
  
  let amountVnd = prev.amountVnd;
  let amountUsd = prev.amountUsd;

  if (data.amount !== undefined) {
    if (inputCurrency === "VND") {
      amountVnd = data.amount;
      amountUsd = Number((data.amount / rate).toFixed(2));
    } else {
      amountUsd = data.amount;
      amountVnd = Math.round(data.amount * rate);
    }
  } else if (data.exchangeRate !== undefined) {
    if (inputCurrency === "VND") {
      amountUsd = Number((amountVnd / rate).toFixed(2));
    } else {
      amountVnd = Math.round(amountUsd * rate);
    }
  }

  let year = prev.year;
  let month = prev.month;
  if (data.transactionDate) {
    const parsedDate = new Date(data.transactionDate);
    if (!isNaN(parsedDate.getTime())) {
      year = parsedDate.getFullYear();
      month = parsedDate.getMonth() + 1;
    }
  }

  const updatePayload: any = {
    ...data,
    amountVnd,
    amountUsd,
    exchangeRate: rate,
    inputCurrency,
    year,
    month,
    updatedAt: new Date().toISOString()
  };

  const updated = await db
    .update(financialTransactions)
    .set(updatePayload)
    .where(eq(financialTransactions.id, id))
    .returning();

  return updated[0];
}

/**
 * Delete Transaction
 */
export async function deleteFinancialTransaction(d1: D1Database, id: number) {
  await initFinancialTables(d1);
  const db = drizzle(d1);
  await db.delete(financialTransactions).where(eq(financialTransactions.id, id));
  return { success: true, id };
}

/**
 * Summary for Debt Tracker
 */
export async function getDebtSummary(d1: D1Database) {
  await initFinancialTables(d1);
  const db = drizzle(d1);

  const debts = await db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.type, "debt"))
    .orderBy(desc(financialTransactions.transactionDate));

  let totalUnpaidUsd = 0;
  let totalUnpaidVnd = 0;
  let totalPaidUsd = 0;
  let totalPaidVnd = 0;

  for (const d of debts) {
    if (d.debtStatus === "unpaid" || d.debtStatus === "partial") {
      totalUnpaidUsd += d.amountUsd || 0;
      totalUnpaidVnd += d.amountVnd || 0;
    } else if (d.debtStatus === "paid") {
      totalPaidUsd += d.amountUsd || 0;
      totalPaidVnd += d.amountVnd || 0;
    }
  }

  return {
    debts,
    totalUnpaidUsd,
    totalUnpaidVnd,
    totalPaidUsd,
    totalPaidVnd,
    totalCount: debts.length
  };
}
