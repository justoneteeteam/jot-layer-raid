"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PLReportSummary, FinancialTransaction, DebtSummary } from "./types";
import { FinancialCharts } from "./FinancialCharts";
import { TransactionModal } from "./TransactionModal";
import { exportPLToExcel } from "./excelExport";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

export default function PLReportsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [exchangeRate, setExchangeRate] = useState<number>(26000);
  const [currencyMode, setCurrencyMode] = useState<"USD" | "VND" | "DUAL">("USD");
  const [activeViewTab, setActiveViewTab] = useState<"pl_sheet" | "analytics" | "debts" | "ledger">("pl_sheet");
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
  const handleSaveExchangeRate = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(`${API_BASE}/api/oms/financials/settings`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ default_exchange_rate: exchangeRate })
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

  // Number Formatter based on active currency mode
  const formatVal = (usd: number, isVndCell: boolean = false) => {
    if (isVndCell || currencyMode === "VND") {
      const vnd = usd * exchangeRate;
      const formatted = Math.round(vnd).toLocaleString();
      return `${formatted} ₫`;
    }
    if (currencyMode === "DUAL") {
      const vnd = usd * exchangeRate;
      return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${Math.round(vnd).toLocaleString()} ₫)`;
    }
    return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      {/* Top Header & Global Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📈</span>
            <h1 className="text-xl font-bold text-gray-900">Profit & Loss (P&L) Financials</h1>
            <span className="bg-teal-100 text-teal-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              OMS Live Sync
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Track multi-currency revenue, detailed expense breakdowns, debts, and cumulative profit.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Exchange Rate Badge & Setting */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-300 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-gray-500 font-medium">1 USD =</span>
            <input
              type="number"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 26000)}
              onBlur={handleSaveExchangeRate}
              className="w-16 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs font-bold text-gray-800 text-right focus:ring-1 focus:ring-teal-500"
            />
            <span className="text-gray-500 font-medium">VND</span>
          </div>

          {/* Currency Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setCurrencyMode("USD")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currencyMode === "USD" ? "bg-white text-teal-700 font-bold shadow-sm" : "text-gray-600"
              }`}
            >
              USD ($)
            </button>
            <button
              onClick={() => setCurrencyMode("VND")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currencyMode === "VND" ? "bg-white text-teal-700 font-bold shadow-sm" : "text-gray-600"
              }`}
            >
              VND (₫)
            </button>
            <button
              onClick={() => setCurrencyMode("DUAL")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currencyMode === "DUAL" ? "bg-white text-teal-700 font-bold shadow-sm" : "text-gray-600"
              }`}
            >
              Both
            </button>
          </div>

          {/* Live Order Sync */}
          <button
            onClick={handleSyncOrders}
            disabled={syncingOrders}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Sync latest live orders from WooCommerce, ShopBase, and Astro"
          >
            <span>{syncingOrders ? "🔄" : "⚡"}</span>
            <span>{syncingOrders ? "Syncing..." : "Sync Orders"}</span>
          </button>

          {/* Excel Export Button */}
          {report && (
            <button
              onClick={() => exportPLToExcel(report)}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <span>📥</span>
              <span>Export Excel</span>
            </button>
          )}

          {/* + Import / Add Transaction Button (Right Corner) */}
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

      {/* Year Selection Tabs & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
        {/* Year Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {(report?.availableYears || [2024, 2025, 2026, 2027]).map((yr) => (
            <button
              key={yr}
              onClick={() => setSelectedYear(yr)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedYear === yr
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {yr === 2024 ? "Overall 2024" : yr}
            </button>
          ))}
        </div>

        {/* View Mode Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveViewTab("pl_sheet")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeViewTab === "pl_sheet" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>📊</span> P&L Spreadsheet
          </button>
          <button
            onClick={() => setActiveViewTab("analytics")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeViewTab === "analytics" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>📈</span> Analytics & Charts
          </button>
          <button
            onClick={() => setActiveViewTab("debts")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeViewTab === "debts" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>💳</span> Debt Tracker
            {debtSummary && debtSummary.totalUnpaidUsd > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 ml-0.5" />
            )}
          </button>
          <button
            onClick={() => setActiveViewTab("ledger")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeViewTab === "ledger" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>📝</span> Transaction Ledger
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
          <p className="text-xs font-medium">Calculating financial metrics & syncing orders...</p>
        </div>
      ) : report ? (
        <>
          {/* TAB 1: P&L Spreadsheet Matrix View */}
          {activeViewTab === "pl_sheet" && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Spreadsheet Header Info */}
              <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-gray-900 uppercase tracking-wide">
                    {report.companyName} — Profit & Loss Matrix ({report.year})
                  </span>
                  <span className="text-gray-500">
                    Rate: <strong className="text-gray-800">{report.exchangeRate.toLocaleString()} VND</strong> / USD
                  </span>
                </div>
                <div className="text-gray-500 text-[11px]">
                  Showing Months 1 through 12 + Total YTD
                </div>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-gray-100/80 text-gray-700 border-b border-gray-300 font-bold">
                      <th className="py-2.5 px-4 sticky left-0 bg-gray-100 z-10 w-64 border-r border-gray-200">
                        Category / Metric
                      </th>
                      {Array.from({ length: 12 }, (_, i) => (
                        <th key={i + 1} className="py-2.5 px-3 text-right font-bold border-r border-gray-200">
                          Mth {i + 1}
                        </th>
                      ))}
                      <th className="py-2.5 px-4 text-right font-black bg-gray-200/90 text-gray-900">
                        Total {report.year}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 1. REVENUE BANNER */}
                    <tr className="bg-[#00FF00] text-black font-extrabold border-b border-green-600">
                      <td colSpan={14} className="py-2 px-4 uppercase tracking-wider text-xs">
                        Revenue
                      </td>
                    </tr>

                    {/* Revenue (Gross Orders + Manual) */}
                    <tr className="hover:bg-gray-50/70 border-b border-gray-200 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-gray-800 sticky left-0 bg-white border-r border-gray-200">
                        Revenue
                      </td>
                      {report.months.map((m) => (
                        <td key={m.month} className="py-2.5 px-3 text-right text-gray-900 border-r border-gray-200">
                          {formatVal(m.totalRevenue)}
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-bold text-gray-900 bg-gray-50">
                        {formatVal(report.totals.totalRevenue)}
                      </td>
                    </tr>

                    {/* Refund */}
                    <tr className="hover:bg-gray-50/70 border-b border-gray-200 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-gray-800 sticky left-0 bg-white border-r border-gray-200">
                        Refund
                      </td>
                      {report.months.map((m) => (
                        <td key={m.month} className="py-2.5 px-3 text-right text-rose-600 border-r border-gray-200">
                          {m.refund > 0 ? `-${formatVal(m.refund)}` : formatVal(0)}
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-bold text-rose-600 bg-gray-50">
                        {report.totals.refund > 0 ? `-${formatVal(report.totals.refund)}` : formatVal(0)}
                      </td>
                    </tr>

                    {/* Cross-Revenue (Gross Revenue = Revenue - Refund) */}
                    <tr className="bg-[#D9EAD3] font-bold border-b border-green-300 text-green-950">
                      <td className="py-2.5 px-4 sticky left-0 bg-[#D9EAD3] border-r border-green-300">
                        Cross-Revenue
                      </td>
                      {report.months.map((m) => (
                        <td key={m.month} className="py-2.5 px-3 text-right border-r border-green-300">
                          {formatVal(m.crossRevenue)}
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-black bg-[#C2E0B8]">
                        {formatVal(report.totals.crossRevenue)}
                      </td>
                    </tr>

                    {/* Spacer */}
                    <tr className="h-2 bg-gray-50/40">
                      <td colSpan={14}></td>
                    </tr>

                    {/* 2. COST CATEGORIES */}
                    {report.categoriesList.map((cat, idx) => {
                      const totalCatCost = report.totals.costCategories[cat] || 0;
                      return (
                        <tr
                          key={cat}
                          className={`hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                          }`}
                        >
                          <td className="py-2.5 px-4 font-medium text-gray-800 sticky left-0 bg-inherit border-r border-gray-200">
                            {cat}
                          </td>
                          {report.months.map((m) => {
                            const val = m.costCategories[cat] || 0;
                            return (
                              <td
                                key={m.month}
                                className="py-2.5 px-3 text-right text-gray-700 border-r border-gray-200"
                              >
                                {val > 0 ? formatVal(val) : "—"}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-4 text-right font-bold text-gray-900 bg-gray-50">
                            {totalCatCost > 0 ? formatVal(totalCatCost) : "—"}
                          </td>
                        </tr>
                      );
                    })}

                    {/* TOTAL COST Row */}
                    <tr className="bg-[#FFF2CC] font-bold border-t-2 border-b-2 border-amber-300 text-amber-950">
                      <td className="py-2.5 px-4 uppercase sticky left-0 bg-[#FFF2CC] border-r border-amber-300">
                        TOTAL COST
                      </td>
                      {report.months.map((m) => (
                        <td key={m.month} className="py-2.5 px-3 text-right border-r border-amber-300">
                          {formatVal(m.totalCost)}
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-black bg-[#FFE599]">
                        {formatVal(report.totals.totalCost)}
                      </td>
                    </tr>

                    {/* Spacer */}
                    <tr className="h-2 bg-gray-50/40">
                      <td colSpan={14}></td>
                    </tr>

                    {/* 3. NET PROFIT ($ USD) */}
                    <tr className="bg-[#FFF2CC]/90 font-bold border-b border-amber-200">
                      <td className="py-2.5 px-4 sticky left-0 bg-[#FFF2CC] border-r border-amber-200 text-gray-900">
                        NET PROFIT ($)
                      </td>
                      {report.months.map((m) => {
                        const isNeg = m.netProfitUsd < 0;
                        return (
                          <td
                            key={m.month}
                            className={`py-2.5 px-3 text-right border-r border-amber-200 font-bold ${
                              isNeg ? "text-rose-600" : "text-emerald-700"
                            }`}
                          >
                            {isNeg ? `-$${Math.abs(m.netProfitUsd).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `$${m.netProfitUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                          </td>
                        );
                      })}
                      <td
                        className={`py-2.5 px-4 text-right font-black bg-[#FFE599] ${
                          report.totals.netProfitUsd < 0 ? "text-rose-700" : "text-emerald-800"
                        }`}
                      >
                        {report.totals.netProfitUsd < 0
                          ? `-$${Math.abs(report.totals.netProfitUsd).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : `$${report.totals.netProfitUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </td>
                    </tr>

                    {/* NET PROFIT (VND) */}
                    <tr className="hover:bg-gray-50 border-b border-gray-200 font-semibold">
                      <td className="py-2.5 px-4 sticky left-0 bg-white border-r border-gray-200 text-gray-800">
                        NET PROFIT (VND)
                      </td>
                      {report.months.map((m) => {
                        const isNeg = m.netProfitVnd < 0;
                        return (
                          <td
                            key={m.month}
                            className={`py-2.5 px-3 text-right border-r border-gray-200 ${
                              isNeg ? "text-rose-600" : "text-emerald-700"
                            }`}
                          >
                            {Math.round(m.netProfitVnd).toLocaleString()} ₫
                          </td>
                        );
                      })}
                      <td
                        className={`py-2.5 px-4 text-right font-bold bg-gray-50 ${
                          report.totals.netProfitVnd < 0 ? "text-rose-700" : "text-emerald-800"
                        }`}
                      >
                        {Math.round(report.totals.netProfitVnd).toLocaleString()} ₫
                      </td>
                    </tr>

                    {/* Net Profit Margin % */}
                    <tr className="hover:bg-gray-50 border-b border-gray-200">
                      <td className="py-2 px-4 sticky left-0 bg-white border-r border-gray-200 text-gray-700 font-medium">
                        Net Profit Margin %
                      </td>
                      {report.months.map((m) => (
                        <td
                          key={m.month}
                          className={`py-2 px-3 text-right border-r border-gray-200 font-semibold ${
                            m.netProfitMargin < 0 ? "text-rose-600" : "text-gray-900"
                          }`}
                        >
                          {m.netProfitMargin.toFixed(2)}%
                        </td>
                      ))}
                      <td
                        className={`py-2 px-4 text-right font-bold bg-gray-50 ${
                          report.totals.netProfitMargin < 0 ? "text-rose-600" : "text-gray-900"
                        }`}
                      >
                        {report.totals.netProfitMargin.toFixed(2)}%
                      </td>
                    </tr>

                    {/* Accumulate PROFIT (VND) */}
                    <tr className="bg-gray-100/70 border-b border-gray-300 font-bold">
                      <td className="py-2.5 px-4 uppercase sticky left-0 bg-gray-100 border-r border-gray-300 text-gray-900">
                        Accumulate PROFIT (VND)
                      </td>
                      {report.months.map((m) => (
                        <td
                          key={m.month}
                          className={`py-2.5 px-3 text-right border-r border-gray-300 ${
                            m.accumulateProfitVnd < 0 ? "text-rose-600" : "text-gray-900"
                          }`}
                        >
                          {Math.round(m.accumulateProfitVnd).toLocaleString()} ₫
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-black bg-gray-200 text-gray-900">
                        {Math.round(report.totals.accumulateProfitVnd).toLocaleString()} ₫
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Analytics & Visual Charts */}
          {activeViewTab === "analytics" && (
            <div className="space-y-6">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Gross Revenue */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">Gross Revenue</span>
                  <div className="text-lg font-bold text-emerald-600 mt-1">
                    {formatVal(report.totals.crossRevenue)}
                  </div>
                  <span className="text-[11px] text-gray-400">Total orders & manual income</span>
                </div>

                {/* 2. Total Cost */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">Total Expenses</span>
                  <div className="text-lg font-bold text-rose-600 mt-1">
                    {formatVal(report.totals.totalCost)}
                  </div>
                  <span className="text-[11px] text-gray-400">{report.spendDistribution.length} active categories</span>
                </div>

                {/* 3. Net Profit (USD) */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">Net Profit (USD)</span>
                  <div
                    className={`text-lg font-bold mt-1 ${
                      report.totals.netProfitUsd >= 0 ? "text-blue-600" : "text-rose-600"
                    }`}
                  >
                    ${report.totals.netProfitUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-gray-400">Margin: {report.totals.netProfitMargin.toFixed(1)}%</span>
                </div>

                {/* 4. Net Profit (VND) */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">Net Profit (VND)</span>
                  <div
                    className={`text-lg font-bold mt-1 ${
                      report.totals.netProfitVnd >= 0 ? "text-teal-700" : "text-rose-600"
                    }`}
                  >
                    {Math.round(report.totals.netProfitVnd).toLocaleString()} ₫
                  </div>
                  <span className="text-[11px] text-gray-400">At {exchangeRate.toLocaleString()} VND/USD</span>
                </div>

                {/* 5. Outstanding Debt */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">Unsettled Debts</span>
                  <div className="text-lg font-bold text-amber-600 mt-1">
                    {debtSummary ? formatVal(debtSummary.totalUnpaidUsd) : "$0.00"}
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {debtSummary?.debts.filter((d) => d.debtStatus === "unpaid").length || 0} pending payables
                  </span>
                </div>
              </div>

              {/* SVG Charts: Donut + Column Chart */}
              <FinancialCharts
                spendDistribution={report.spendDistribution}
                monthlyTrends={report.monthlyTrends}
                currencyMode={currencyMode}
                exchangeRate={exchangeRate}
                selectedMonthFilter={selectedMonthFilter}
                onSelectMonth={(m) => setSelectedMonthFilter(m)}
              />
            </div>
          )}

          {/* TAB 3: Debt & Payables Tracker */}
          {activeViewTab === "debts" && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                    <span>💳</span> Debt & Payables Overview
                  </h3>
                  <p className="text-xs text-gray-500">
                    Track loans, supplier credits, and credit lines with due dates and settlement records.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl">
                    <span>Total Unsettled: </span>
                    <strong className="text-amber-950 font-bold">
                      {debtSummary ? formatVal(debtSummary.totalUnpaidUsd) : "$0.00"}
                    </strong>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-xl">
                    <span>Settled / Paid: </span>
                    <strong className="text-emerald-950 font-bold">
                      {debtSummary ? formatVal(debtSummary.totalPaidUsd) : "$0.00"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Debt Records Table */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Counterparty</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Amount (USD)</th>
                      <th className="py-3 px-4 text-right">Amount (VND)</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Proof</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(!debtSummary || debtSummary.debts.length === 0) ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-gray-400">
                          No debt or payable records found. Click "+ Add / Import Transaction" to record one.
                        </td>
                      </tr>
                    ) : (
                      debtSummary.debts.map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-700">
                            {d.transactionDate?.split("T")[0]}
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            {d.debtCounterparty || "—"}
                          </td>
                          <td className="py-3 px-4 text-gray-600">{d.category}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">
                            ${d.amountUsd?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-gray-600">
                            {d.amountVnd?.toLocaleString()} ₫
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {d.debtDueDate ? d.debtDueDate.split("T")[0] : "—"}
                          </td>
                          <td className="py-3 px-4">
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
                          <td className="py-3 px-4">
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
                          <td className="py-3 px-4 text-right space-x-2">
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

          {/* TAB 4: Transaction Ledger */}
          {activeViewTab === "ledger" && (
            <div className="space-y-4">
              {/* Ledger Controls */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
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

              {/* Transactions Table */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Amount (USD)</th>
                      <th className="py-3 px-4 text-right">Amount (VND)</th>
                      <th className="py-3 px-4">Note / Event</th>
                      <th className="py-3 px-4">Flags</th>
                      <th className="py-3 px-4">Proof</th>
                      <th className="py-3 px-4 text-right">Actions</th>
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
                          <td className="py-3 px-4 font-medium text-gray-700">
                            {tx.transactionDate?.split("T")[0]}
                          </td>
                          <td className="py-3 px-4">
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
                          <td className="py-3 px-4 font-semibold text-gray-900">{tx.category}</td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900">
                            ${tx.amountUsd?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-gray-600">
                            {tx.amountVnd?.toLocaleString()} ₫
                          </td>
                          <td className="py-3 px-4 text-gray-700 max-w-[200px] truncate">
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
                          <td className="py-3 px-4">
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
                          <td className="py-3 px-4">
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
                          <td className="py-3 px-4 text-right space-x-2">
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
