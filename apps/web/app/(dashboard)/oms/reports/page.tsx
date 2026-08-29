"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PLReportSummary, FinancialTransaction, DebtSummary } from "./types";
import { FinancialCharts } from "./FinancialCharts";
import { TransactionModal } from "./TransactionModal";
import { exportPLToExcel } from "./excelExport";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PLReportsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [exchangeRate, setExchangeRate] = useState<number>(26000);
  const [currencyMode, setCurrencyMode] = useState<"USD" | "VND" | "DUAL">("USD");
  const [activeTab, setActiveTab] = useState<"overview" | "debts" | "ledger">("overview");
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<number>(0); // 0 = all year

  // Data States
  const [report, setReport] = useState<PLReportSummary | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [debtSummary, setDebtSummary] = useState<DebtSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingOrders, setSyncingOrders] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);

  // Filters for Transaction Ledger
  const [txTypeFilter, setTxTypeFilter] = useState<string>("all");
  const [txSearch, setTxSearch] = useState<string>("");
  const [txCategoryFilter, setTxCategoryFilter] = useState<string>("all");

  // Fetch Report Data
  const fetchReportData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // 1. Fetch P&L Report
      const reportRes = await fetch(
        `${API_BASE}/api/oms/financials/report?year=${selectedYear}&exchange_rate=${exchangeRate}`,
        { headers }
      );
      if (!reportRes.ok) throw new Error("Failed to load P&L Report");
      const reportJson: PLReportSummary = await reportRes.json();
      setReport(reportJson);
      if (reportJson.exchangeRate) {
        setExchangeRate(reportJson.exchangeRate);
      }

      // 2. Fetch Transactions
      const txRes = await fetch(
        `${API_BASE}/api/oms/financials/transactions?year=${selectedYear}&limit=200`,
        { headers }
      );
      if (txRes.ok) {
        const txJson = await txRes.json();
        setTransactions(txJson);
      }

      // 3. Fetch Debt Summary
      const debtRes = await fetch(`${API_BASE}/api/oms/financials/debts`, { headers });
      if (debtRes.ok) {
        const debtJson = await debtRes.json();
        setDebtSummary(debtJson);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, exchangeRate]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Sync Live Orders from OMS
  const handleSyncOrders = async () => {
    try {
      setSyncingOrders(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(`${API_BASE}/api/oms/sync`, { method: "POST", headers });
      await fetchReportData();
    } catch (err: any) {
      alert("Order sync failed: " + err.message);
    } finally {
      setSyncingOrders(false);
    }
  };

  // Update Global Exchange Rate
  const handleSaveExchangeRate = async (newRate: number) => {
    setExchangeRate(newRate);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(`${API_BASE}/api/oms/financials/settings`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ default_exchange_rate: newRate })
      });
      fetchReportData();
    } catch (_) {}
  };

  // Delete Transaction
  const handleDeleteTransaction = async (id: number) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(`${API_BASE}/api/oms/financials/transactions/${id}`, {
        method: "DELETE",
        headers
      });
      fetchReportData();
    } catch (err: any) {
      alert("Failed to delete transaction: " + err.message);
    }
  };

  // Quick Settle Debt
  const handleSettleDebt = async (tx: FinancialTransaction) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const newStatus = tx.debtStatus === "paid" ? "unpaid" : "paid";
      await fetch(`${API_BASE}/api/oms/financials/transactions/${tx.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ debt_status: newStatus })
      });
      fetchReportData();
    } catch (err: any) {
      alert("Failed to update debt: " + err.message);
    }
  };

  // Number Formatter: formats negative values in parentheses e.g. ($179.66) and empty values as —
  const formatCell = (
    val: number,
    hasMonthData: boolean = true,
    opts: { isVnd?: boolean; isMargin?: boolean; isNegativeRed?: boolean } = {}
  ) => {
    if (!hasMonthData && val === 0) {
      return <span className="text-gray-400 font-normal">—</span>;
    }

    if (opts.isMargin) {
      if (val === 0 && !hasMonthData) return <span className="text-gray-400 font-normal">—</span>;
      const isNeg = val < 0;
      return (
        <span className={isNeg ? "text-rose-600 font-semibold" : "text-gray-900 font-semibold"}>
          {isNeg ? `(${Math.abs(val).toFixed(1)}%)` : `${val.toFixed(1)}%`}
        </span>
      );
    }

    if (opts.isVnd || currencyMode === "VND") {
      const vndVal = opts.isVnd ? val : val * exchangeRate;
      const isNeg = vndVal < 0;
      const absVnd = Math.abs(Math.round(vndVal)).toLocaleString();
      return (
        <span className={isNeg ? "text-rose-600 font-semibold" : "text-gray-900"}>
          {isNeg ? `(${absVnd} ₫)` : `${absVnd} ₫`}
        </span>
      );
    }

    const isNeg = val < 0;
    const absUsd = Math.abs(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    if (currencyMode === "DUAL") {
      const vndVal = Math.abs(Math.round(val * exchangeRate)).toLocaleString();
      return (
        <span className={isNeg ? "text-rose-600 font-semibold" : "text-gray-900"}>
          {isNeg ? `($${absUsd})` : `$${absUsd}`}{" "}
          <span className="text-[10px] text-gray-500 font-normal">({vndVal} ₫)</span>
        </span>
      );
    }

    return (
      <span className={isNeg ? "text-rose-600 font-semibold" : "text-gray-900"}>
        {isNeg ? `($${absUsd})` : `$${absUsd}`}
      </span>
    );
  };

  const formatVndShort = (vnd: number) => {
    if (Math.abs(vnd) >= 1_000_000_000) {
      return `${(vnd / 1_000_000_000).toFixed(2)}B VND`;
    }
    if (Math.abs(vnd) >= 1_000_000) {
      return `${(vnd / 1_000_000).toFixed(2)}M VND`;
    }
    return `${Math.round(vnd).toLocaleString()} ₫`;
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (txTypeFilter !== "all" && tx.type !== txTypeFilter) return false;
    if (txCategoryFilter !== "all" && tx.category !== txCategoryFilter) return false;
    if (txSearch) {
      const q = txSearch.toLowerCase();
      const matchNote = (tx.note || "").toLowerCase().includes(q);
      const matchEvent = (tx.event || "").toLowerCase().includes(q);
      const matchCat = (tx.category || "").toLowerCase().includes(q);
      const matchCp = (tx.debtCounterparty || "").toLowerCase().includes(q);
      if (!matchNote && !matchEvent && !matchCat && !matchCp) return false;
    }
    return true;
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* ── TOP HEADER: Profit & Loss — {year} ───────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Profit & Loss — {selectedYear}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Management view · USD · 1 USD = {exchangeRate.toLocaleString()} VND
          </p>
        </div>

        {/* Top Right Action & Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Year Dropdown Selector */}
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="text-xs font-semibold text-gray-600">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="text-xs font-bold text-gray-900 bg-transparent cursor-pointer focus:outline-none"
            >
              {(report?.availableYears || [2024, 2025, 2026, 2027]).map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Currency Switcher */}
          <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-medium border border-gray-200/60">
            <button
              onClick={() => setCurrencyMode("USD")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currencyMode === "USD" ? "bg-white text-gray-900 font-bold shadow-sm" : "text-gray-600"
              }`}
            >
              USD
            </button>
            <button
              onClick={() => setCurrencyMode("VND")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currencyMode === "VND" ? "bg-white text-gray-900 font-bold shadow-sm" : "text-gray-600"
              }`}
            >
              VND
            </button>
            <button
              onClick={() => setCurrencyMode("DUAL")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currencyMode === "DUAL" ? "bg-white text-gray-900 font-bold shadow-sm" : "text-gray-600"
              }`}
            >
              Both
            </button>
          </div>

          {/* Sync Orders Button */}
          <button
            onClick={handleSyncOrders}
            disabled={syncingOrders}
            className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
            title="Sync latest live orders from WooCommerce, ShopBase, and Astro"
          >
            <span>{syncingOrders ? "🔄" : "⚡"}</span>
            <span>{syncingOrders ? "Syncing..." : "Sync Orders"}</span>
          </button>

          {/* Export Excel Button */}
          {report && (
            <button
              onClick={() => exportPLToExcel(report)}
              className="px-3 py-2 bg-white hover:bg-gray-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <span>📥</span>
              <span>Export Excel</span>
            </button>
          )}

          {/* + Add / Import Transaction Button */}
          <button
            onClick={() => {
              setEditingTransaction(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all"
          >
            <span className="text-base leading-none">+</span>
            <span>Add / Import Transaction</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center justify-between">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => fetchReportData()} className="underline font-bold">
            Retry
          </button>
        </div>
      )}

      {loading && !report ? (
        <div className="p-16 flex flex-col items-center justify-center text-gray-400 space-y-3 bg-white rounded-2xl border border-gray-200">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-teal-600 rounded-full animate-spin"></div>
          <p className="text-xs font-medium">Calculating financial metrics & syncing live orders...</p>
        </div>
      ) : report ? (
        <>
          {/* ── 1. TOP SECTION: 5 KPI SUMMARY CARDS ─────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* 1. Gross Revenue */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-gray-500">Gross Revenue</span>
              <div className="text-2xl font-black text-gray-900 mt-2 tracking-tight">
                ${report.totals.crossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-gray-400 mt-1">Total orders & sales</span>
            </div>

            {/* 2. Total Expenses */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-gray-500">Total Expenses</span>
              <div className="text-2xl font-black text-gray-900 mt-2 tracking-tight">
                ${report.totals.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-gray-400 mt-1">
                {report.spendDistribution.length} active spend categories
              </span>
            </div>

            {/* 3. Net Profit */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-gray-500">Net Profit</span>
              <div
                className={`text-2xl font-black mt-2 tracking-tight ${
                  report.totals.netProfitUsd >= 0 ? "text-gray-900" : "text-rose-600"
                }`}
              >
                ${report.totals.netProfitUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1">
                {formatVndShort(report.totals.netProfitVnd)}
              </span>
            </div>

            {/* 4. Net Margin */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-gray-500">Net Margin</span>
              <div className="text-2xl font-black text-gray-900 mt-2 tracking-tight">
                {report.totals.netProfitMargin.toFixed(1)}%
              </div>
              <span className="text-[11px] text-gray-400 mt-1">Profit to revenue ratio</span>
            </div>

            {/* 5. Unsettled Debt */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-gray-500">Unsettled Debt</span>
              <div className="text-2xl font-black text-gray-900 mt-2 tracking-tight">
                ${(debtSummary?.totalUnpaidUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-gray-400 mt-1">
                {debtSummary?.debts.filter((d) => d.debtStatus === "unpaid").length || 0} pending payables
              </span>
            </div>
          </div>

          {/* ── 2. MIDDLE SECTION: VISUAL PERFORMANCE CHARTS ─────────────── */}
          <FinancialCharts
            year={report.year}
            spendDistribution={report.spendDistribution}
            monthlyTrends={report.monthlyTrends}
            totalRevenue={report.totals.crossRevenue}
            totalExpenses={report.totals.totalCost}
            netProfit={report.totals.netProfitUsd}
            netMargin={report.totals.netProfitMargin}
            currencyMode={currencyMode}
            exchangeRate={exchangeRate}
            selectedMonthFilter={selectedMonthFilter}
            onSelectMonth={(m) => setSelectedMonthFilter(m)}
          />

          {/* ── 3. BOTTOM SECTION: P&L SPREADSHEET MATRIX ────────────────── */}
          <div className="bg-white border border-gray-200/90 rounded-2xl shadow-sm overflow-hidden">
            {/* Spreadsheet Card Header */}
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/60">
              <div>
                <h3 className="font-bold text-gray-900 text-base">P&L Spreadsheet</h3>
                <p className="text-xs text-gray-500 mt-0.5">Google Sheets-style monthly financial matrix</p>
              </div>

              {/* Sub-view switcher for drilldowns */}
              <div className="flex items-center gap-2">
                <div className="flex bg-gray-200/70 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab("overview")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      activeTab === "overview" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                    }`}
                  >
                    P&L Matrix
                  </button>
                  <button
                    onClick={() => setActiveTab("debts")}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                      activeTab === "debts" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                    }`}
                  >
                    <span>💳 Debt Tracker</span>
                    {debtSummary && debtSummary.totalUnpaidUsd > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("ledger")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      activeTab === "ledger" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                    }`}
                  >
                    📝 Transaction Ledger
                  </button>
                </div>
              </div>
            </div>

            {/* TAB CONTENT 1: Full P&L Spreadsheet Matrix */}
            {activeTab === "overview" && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-gray-100/70 text-gray-600 border-b border-gray-200 font-bold">
                      <th className="py-3 px-4 sticky left-0 bg-gray-100/95 z-10 w-60 border-r border-gray-200 text-gray-700 uppercase tracking-wider text-[11px]">
                        Category / Metric
                      </th>
                      {MONTH_NAMES.map((name) => (
                        <th key={name} className="py-3 px-3 text-right font-bold border-r border-gray-200 text-gray-700">
                          {name}
                        </th>
                      ))}
                      <th className="py-3 px-4 text-right font-black bg-gray-200/90 text-gray-900 w-28">
                        YTD
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {/* ── SECTION 1: REVENUE ──────────────────────────────── */}
                    <tr className="bg-gray-50/90 font-bold text-gray-900 border-y border-gray-200">
                      <td colSpan={14} className="py-2 px-4 uppercase tracking-wider text-[11px] text-gray-800">
                        Revenue
                      </td>
                    </tr>

                    {/* Revenue Row */}
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-gray-700 sticky left-0 bg-white border-r border-gray-200">
                        Revenue
                      </td>
                      {report.months.map((m) => (
                        <td key={m.month} className="py-2.5 px-3 text-right border-r border-gray-200">
                          {formatCell(m.totalRevenue, m.hasData)}
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-bold text-gray-900 bg-gray-50/60">
                        {formatCell(report.totals.totalRevenue, true)}
                      </td>
                    </tr>

                    {/* Refund Row */}
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-gray-700 sticky left-0 bg-white border-r border-gray-200">
                        Refund
                      </td>
                      {report.months.map((m) => (
                        <td key={m.month} className="py-2.5 px-3 text-right border-r border-gray-200">
                          {m.refund > 0 ? formatCell(-m.refund, true) : formatCell(0, m.hasData)}
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-bold text-gray-900 bg-gray-50/60">
                        {report.totals.refund > 0 ? formatCell(-report.totals.refund, true) : formatCell(0, true)}
                      </td>
                    </tr>

                    {/* Gross Revenue Row */}
                    <tr className="bg-emerald-50/50 font-bold border-y border-emerald-100 text-gray-900">
                      <td className="py-2.5 px-4 sticky left-0 bg-emerald-50/90 border-r border-emerald-100 font-bold">
                        Gross Revenue
                      </td>
                      {report.months.map((m) => (
                        <td key={m.month} className="py-2.5 px-3 text-right border-r border-emerald-100 font-bold">
                          {formatCell(m.crossRevenue, m.hasData)}
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-black bg-emerald-100/70 text-emerald-950">
                        {formatCell(report.totals.crossRevenue, true)}
                      </td>
                    </tr>

                    {/* ── SECTION 2: EXPENSES ─────────────────────────────── */}
                    <tr className="bg-gray-50/90 font-bold text-gray-900 border-y border-gray-200">
                      <td colSpan={14} className="py-2 px-4 uppercase tracking-wider text-[11px] text-gray-800">
                        Expenses
                      </td>
                    </tr>

                    {/* Expense Categories */}
                    {report.categoriesList.map((cat, idx) => {
                      const totalCat = report.totals.costCategories[cat] || 0;
                      return (
                        <tr
                          key={cat}
                          className={`hover:bg-gray-50/50 transition-colors ${
                            idx % 2 === 1 ? "bg-gray-50/20" : ""
                          }`}
                        >
                          <td className="py-2.5 px-4 font-medium text-gray-700 sticky left-0 bg-inherit border-r border-gray-200">
                            {cat}
                          </td>
                          {report.months.map((m) => {
                            const val = m.costCategories[cat] || 0;
                            return (
                              <td key={m.month} className="py-2.5 px-3 text-right border-r border-gray-200">
                                {formatCell(val, m.hasData && val > 0)}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-4 text-right font-bold text-gray-900 bg-gray-50/60">
                            {formatCell(totalCat, totalCat > 0)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Total Expenses Row */}
                    <tr className="bg-amber-50/60 font-bold border-y border-amber-200 text-gray-900">
                      <td className="py-2.5 px-4 uppercase sticky left-0 bg-amber-50/95 border-r border-amber-200 font-bold text-[11px]">
                        Total Expenses
                      </td>
                      {report.months.map((m) => (
                        <td key={m.month} className="py-2.5 px-3 text-right border-r border-amber-200 font-bold">
                          {formatCell(m.totalCost, m.hasData)}
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-black bg-amber-100/70 text-amber-950">
                        {formatCell(report.totals.totalCost, true)}
                      </td>
                    </tr>

                    {/* ── SECTION 3: PROFITABILITY ─────────────────────────── */}
                    <tr className="bg-gray-50/90 font-bold text-gray-900 border-y border-gray-200">
                      <td colSpan={14} className="py-2 px-4 uppercase tracking-wider text-[11px] text-gray-800">
                        Profitability
                      </td>
                    </tr>

                    {/* Net Profit ($ USD) */}
                    <tr className="bg-white font-bold hover:bg-gray-50/50">
                      <td className="py-2.5 px-4 sticky left-0 bg-white border-r border-gray-200 text-gray-900 font-bold">
                        Net Profit ($)
                      </td>
                      {report.months.map((m) => (
                        <td key={m.month} className="py-2.5 px-3 text-right border-r border-gray-200 font-bold">
                          {formatCell(m.netProfitUsd, m.hasData, { isNegativeRed: true })}
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-black bg-gray-100 text-gray-900">
                        {formatCell(report.totals.netProfitUsd, true, { isNegativeRed: true })}
                      </td>
                    </tr>

                    {/* Net Profit (VND) */}
                    <tr className="bg-white hover:bg-gray-50/50">
                      <td className="py-2.5 px-4 sticky left-0 bg-white border-r border-gray-200 text-gray-700 font-medium">
                        Net Profit (VND)
                      </td>
                      {report.months.map((m) => (
                        <td key={m.month} className="py-2.5 px-3 text-right border-r border-gray-200 font-semibold">
                          {formatCell(m.netProfitVnd, m.hasData, { isVnd: true, isNegativeRed: true })}
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-bold bg-gray-100 text-gray-900">
                        {formatCell(report.totals.netProfitVnd, true, { isVnd: true, isNegativeRed: true })}
                      </td>
                    </tr>

                    {/* Net Margin % */}
                    <tr className="bg-white hover:bg-gray-50/50">
                      <td className="py-2 px-4 sticky left-0 bg-white border-r border-gray-200 text-gray-700 font-medium">
                        Net Margin %
                      </td>
                      {report.months.map((m) => (
                        <td key={m.month} className="py-2 px-3 text-right border-r border-gray-200">
                          {formatCell(m.netProfitMargin, m.hasData, { isMargin: true })}
                        </td>
                      ))}
                      <td className="py-2 px-4 text-right font-bold bg-gray-100 text-gray-900">
                        {formatCell(report.totals.netProfitMargin, true, { isMargin: true })}
                      </td>
                    </tr>

                    {/* Accumulate Profit (VND) */}
                    <tr className="bg-gray-50/60 font-bold border-t border-gray-200">
                      <td className="py-2.5 px-4 uppercase sticky left-0 bg-gray-50 border-r border-gray-200 text-gray-800 text-[11px]">
                        Accumulate Profit (VND)
                      </td>
                      {report.months.map((m) => (
                        <td key={m.month} className="py-2.5 px-3 text-right border-r border-gray-200">
                          {formatCell(m.accumulateProfitVnd, m.hasData, { isVnd: true })}
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-black bg-gray-200 text-gray-900">
                        {formatCell(report.totals.accumulateProfitVnd, true, { isVnd: true })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB CONTENT 2: Debt Tracker */}
            {activeTab === "debts" && (
              <div className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-3 border-b border-gray-100">
                  <div className="text-xs text-gray-600">
                    Track payables, supplier loans, and credit balances with due dates and settlement receipts.
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-xl">
                      Unsettled: <strong>${(debtSummary?.totalUnpaidUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-1.5 rounded-xl">
                      Paid: <strong>${(debtSummary?.totalPaidUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Counterparty</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4 text-right">Amount (USD)</th>
                        <th className="py-2.5 px-4 text-right">Amount (VND)</th>
                        <th className="py-2.5 px-4">Due Date</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Proof</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(!debtSummary || debtSummary.debts.length === 0) ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-gray-400">
                            No debt records found. Click "+ Add / Import Transaction" to record one.
                          </td>
                        </tr>
                      ) : (
                        debtSummary.debts.map((d) => (
                          <tr key={d.id} className="hover:bg-gray-50">
                            <td className="py-2.5 px-4 font-medium text-gray-700">
                              {d.transactionDate?.split("T")[0]}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-gray-900">
                              {d.debtCounterparty || "—"}
                            </td>
                            <td className="py-2.5 px-4 text-gray-600">{d.category}</td>
                            <td className="py-2.5 px-4 text-right font-semibold text-gray-900">
                              ${d.amountUsd?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-4 text-right font-medium text-gray-600">
                              {d.amountVnd?.toLocaleString()} ₫
                            </td>
                            <td className="py-2.5 px-4 text-gray-700">
                              {d.debtDueDate ? d.debtDueDate.split("T")[0] : "—"}
                            </td>
                            <td className="py-2.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  d.debtStatus === "paid"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : d.debtStatus === "partial"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {d.debtStatus}
                              </span>
                            </td>
                            <td className="py-2.5 px-4">
                              {d.imageProofUrl ? (
                                <a
                                  href={d.imageProofUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-teal-600 hover:underline font-semibold"
                                >
                                  📎 View
                                </a>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right space-x-2">
                              <button
                                onClick={() => handleSettleDebt(d)}
                                className="text-xs text-teal-600 hover:text-teal-800 font-semibold"
                              >
                                {d.debtStatus === "paid" ? "Mark Unpaid" : "Mark Paid"}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTransaction(d);
                                  setIsModalOpen(true);
                                }}
                                className="text-gray-500 hover:text-gray-800 font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(d.id)}
                                className="text-rose-500 hover:text-rose-700 font-medium"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: Transaction Ledger */}
            {activeTab === "ledger" && (
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      placeholder="Search notes, events, category..."
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs w-64 focus:ring-1 focus:ring-teal-500"
                    />
                    <select
                      value={txTypeFilter}
                      onChange={(e) => setTxTypeFilter(e.target.value)}
                      className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-700 font-medium cursor-pointer"
                    >
                      <option value="all">All Types</option>
                      <option value="cost">Cost (Expense)</option>
                      <option value="revenue">Revenue</option>
                      <option value="debt">Debt</option>
                    </select>
                    <select
                      value={txCategoryFilter}
                      onChange={(e) => setTxCategoryFilter(e.target.value)}
                      className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-700 font-medium cursor-pointer"
                    >
                      <option value="all">All Categories</option>
                      {report.categoriesList.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-gray-500">
                    Showing <strong>{filteredTransactions.length}</strong> transactions
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4 text-right">Amount (USD)</th>
                        <th className="py-2.5 px-4 text-right">Amount (VND)</th>
                        <th className="py-2.5 px-4">Note / Event</th>
                        <th className="py-2.5 px-4">Flags</th>
                        <th className="py-2.5 px-4">Proof</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-gray-400">
                            No transactions found matching the filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-gray-50">
                            <td className="py-2.5 px-4 font-medium text-gray-700">
                              {tx.transactionDate?.split("T")[0]}
                            </td>
                            <td className="py-2.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  tx.type === "cost"
                                    ? "bg-rose-100 text-rose-800"
                                    : tx.type === "revenue"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {tx.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-gray-900">{tx.category}</td>
                            <td className="py-2.5 px-4 text-right font-bold text-gray-900">
                              ${tx.amountUsd?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-4 text-right font-medium text-gray-600">
                              {tx.amountVnd?.toLocaleString()} ₫
                            </td>
                            <td className="py-2.5 px-4 text-gray-700 max-w-[200px] truncate">
                              {tx.note || tx.event ? (
                                <div className="space-y-0.5">
                                  {tx.note && <div className="truncate">{tx.note}</div>}
                                  {tx.event && (
                                    <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-medium">
                                      🏷️ {tx.event}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-2.5 px-4">
                              {tx.isExcludedFromReport ? (
                                <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-medium">
                                  Excluded from Report
                                </span>
                              ) : tx.isRecurring ? (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                                  🔄 {tx.repeatFrequency}
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4">
                              {tx.imageProofUrl ? (
                                <a
                                  href={tx.imageProofUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-teal-600 hover:underline font-semibold"
                                >
                                  📎 View
                                </a>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right space-x-2">
                              <button
                                onClick={() => {
                                  setEditingTransaction(tx);
                                  setIsModalOpen(true);
                                }}
                                className="text-xs text-gray-600 hover:text-gray-900 font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="text-xs text-rose-500 hover:text-rose-700 font-medium"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Transaction Modal (Add / Edit / Import) */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchReportData}
        defaultExchangeRate={exchangeRate}
        initialData={editingTransaction}
      />
    </div>
  );
}
