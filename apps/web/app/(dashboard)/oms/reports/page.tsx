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

  // Number Formatter
  const formatCell = (
    val: number,
    hasMonthData: boolean = true,
    opts: { isVnd?: boolean; isMargin?: boolean; isNegativeRed?: boolean } = {}
  ) => {
    if (!hasMonthData && val === 0) {
      return <span className="pl-val-empty">—</span>;
    }

    if (opts.isMargin) {
      if (val === 0 && !hasMonthData) return <span className="pl-val-empty">—</span>;
      const isNeg = val < 0;
      return (
        <span className={isNeg ? "pl-val-neg" : "pl-val-pos"}>
          {isNeg ? `(${Math.abs(val).toFixed(1)}%)` : `${val.toFixed(1)}%`}
        </span>
      );
    }

    if (opts.isVnd || currencyMode === "VND") {
      const vndVal = opts.isVnd ? val : val * exchangeRate;
      const isNeg = vndVal < 0;
      const absVnd = Math.abs(Math.round(vndVal)).toLocaleString();
      return (
        <span className={isNeg ? "pl-val-neg" : "pl-val-pos"}>
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
        <span className={isNeg ? "pl-val-neg" : "pl-val-pos"}>
          {isNeg ? `($${absUsd})` : `$${absUsd}`}{" "}
          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 400 }}>({vndVal} ₫)</span>
        </span>
      );
    }

    return (
      <span className={isNeg ? "pl-val-neg" : "pl-val-pos"}>
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
    <div className="pl-dashboard">
      {/* ── TOP HEADER: Profit & Loss — {year} ───────────────────────────── */}
      <div className="pl-header">
        <div>
          <div className="pl-header-title">
            Profit & Loss — {selectedYear}
          </div>
          <div className="pl-header-subtitle">
            Management view · USD · 1 USD = {exchangeRate.toLocaleString()} VND
          </div>
        </div>

        {/* Top Right Action & Filter Toolbar */}
        <div className="pl-header-actions">
          {/* Year Dropdown Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="pl-select"
            >
              {(report?.availableYears || [2024, 2025, 2026, 2027]).map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Currency Switcher */}
          <div className="pl-currency-pill">
            <button
              onClick={() => setCurrencyMode("USD")}
              className={`pl-currency-btn ${currencyMode === "USD" ? "active" : ""}`}
            >
              USD
            </button>
            <button
              onClick={() => setCurrencyMode("VND")}
              className={`pl-currency-btn ${currencyMode === "VND" ? "active" : ""}`}
            >
              VND
            </button>
            <button
              onClick={() => setCurrencyMode("DUAL")}
              className={`pl-currency-btn ${currencyMode === "DUAL" ? "active" : ""}`}
            >
              Both
            </button>
          </div>

          {/* Sync Orders Button */}
          <button
            onClick={handleSyncOrders}
            disabled={syncingOrders}
            className="btn btn-secondary"
            title="Sync latest live orders from WooCommerce, ShopBase, and Astro"
          >
            <span>{syncingOrders ? "🔄" : "⚡"}</span>
            <span>{syncingOrders ? "Syncing..." : "Sync Orders"}</span>
          </button>

          {/* Export Excel Button */}
          {report && (
            <button
              onClick={() => exportPLToExcel(report)}
              className="btn btn-secondary"
              style={{ color: "#10B981" }}
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
            className="btn btn-primary"
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
            <span>Add / Import Transaction</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: "12px 16px", background: "#FEE2E2", color: "var(--error)", borderRadius: "10px", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => fetchReportData()} style={{ fontWeight: 700, textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      )}

      {loading && !report ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Calculating financial metrics & syncing live orders...</p>
        </div>
      ) : report ? (
        <>
          {/* ── 1. TOP SECTION: 5 KPI SUMMARY CARDS ─────────────────────── */}
          <div className="pl-kpi-grid">
            {/* 1. Gross Revenue */}
            <div className="pl-kpi-card">
              <span className="pl-kpi-label">Gross Revenue</span>
              <div className="pl-kpi-value">
                ${report.totals.crossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="pl-kpi-sub">Total orders & sales</span>
            </div>

            {/* 2. Total Expenses */}
            <div className="pl-kpi-card">
              <span className="pl-kpi-label">Total Expenses</span>
              <div className="pl-kpi-value">
                ${report.totals.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="pl-kpi-sub">
                {report.spendDistribution.length} active categories
              </span>
            </div>

            {/* 3. Net Profit */}
            <div className="pl-kpi-card">
              <span className="pl-kpi-label">Net Profit</span>
              <div className="pl-kpi-value" style={{ color: report.totals.netProfitUsd >= 0 ? "var(--text-primary)" : "var(--error)" }}>
                ${report.totals.netProfitUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="pl-kpi-sub highlight">
                {formatVndShort(report.totals.netProfitVnd)}
              </span>
            </div>

            {/* 4. Net Margin */}
            <div className="pl-kpi-card">
              <span className="pl-kpi-label">Net Margin</span>
              <div className="pl-kpi-value">
                {report.totals.netProfitMargin.toFixed(1)}%
              </div>
              <span className="pl-kpi-sub">Profit to revenue ratio</span>
            </div>

            {/* 5. Unsettled Debt */}
            <div className="pl-kpi-card">
              <span className="pl-kpi-label">Unsettled Debt</span>
              <div className="pl-kpi-value">
                ${(debtSummary?.totalUnpaidUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="pl-kpi-sub">
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
          <div className="pl-table-card">
            {/* Spreadsheet Card Header */}
            <div className="pl-table-header">
              <div>
                <div className="pl-card-title">P&L Spreadsheet</div>
                <div className="pl-card-subtitle">Google Sheets-style monthly financial matrix</div>
              </div>

              {/* Sub-view switcher for drilldowns */}
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`btn btn-secondary ${activeTab === "overview" ? "active" : ""}`}
                  style={{ fontSize: "12px", padding: "6px 12px", background: activeTab === "overview" ? "var(--bg-tertiary)" : "transparent" }}
                >
                  P&L Matrix
                </button>
                <button
                  onClick={() => setActiveTab("debts")}
                  className={`btn btn-secondary ${activeTab === "debts" ? "active" : ""}`}
                  style={{ fontSize: "12px", padding: "6px 12px", background: activeTab === "debts" ? "var(--bg-tertiary)" : "transparent" }}
                >
                  <span>💳 Debt Tracker</span>
                  {debtSummary && debtSummary.totalUnpaidUsd > 0 && (
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F59E0B", display: "inline-block", marginLeft: "4px" }} />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("ledger")}
                  className={`btn btn-secondary ${activeTab === "ledger" ? "active" : ""}`}
                  style={{ fontSize: "12px", padding: "6px 12px", background: activeTab === "ledger" ? "var(--bg-tertiary)" : "transparent" }}
                >
                  📝 Transaction Ledger
                </button>
              </div>
            </div>

            {/* TAB CONTENT 1: Full P&L Spreadsheet Matrix */}
            {activeTab === "overview" && (
              <div style={{ overflowX: "auto" }}>
                <table className="pl-spreadsheet-table">
                  <thead>
                    <tr>
                      <th>Category / Metric</th>
                      {MONTH_NAMES.map((name) => (
                        <th key={name}>{name}</th>
                      ))}
                      <th className="ytd-col">YTD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* ── SECTION 1: REVENUE ──────────────────────────────── */}
                    <tr className="pl-row-section">
                      <td colSpan={14}>Revenue</td>
                    </tr>

                    {/* Revenue Row */}
                    <tr>
                      <td>Revenue</td>
                      {report.months.map((m) => (
                        <td key={m.month}>
                          {formatCell(m.totalRevenue, m.hasData)}
                        </td>
                      ))}
                      <td style={{ fontWeight: 700, background: "#F8FAFC" }}>
                        {formatCell(report.totals.totalRevenue, true)}
                      </td>
                    </tr>

                    {/* Refund Row */}
                    <tr>
                      <td>Refund</td>
                      {report.months.map((m) => (
                        <td key={m.month}>
                          {m.refund > 0 ? formatCell(-m.refund, true) : formatCell(0, m.hasData)}
                        </td>
                      ))}
                      <td style={{ fontWeight: 700, background: "#F8FAFC" }}>
                        {report.totals.refund > 0 ? formatCell(-report.totals.refund, true) : formatCell(0, true)}
                      </td>
                    </tr>

                    {/* Gross Revenue Row */}
                    <tr className="pl-row-gross-rev">
                      <td>Gross Revenue</td>
                      {report.months.map((m) => (
                        <td key={m.month}>
                          {formatCell(m.crossRevenue, m.hasData)}
                        </td>
                      ))}
                      <td style={{ fontWeight: 900, background: "#BBF7D0" }}>
                        {formatCell(report.totals.crossRevenue, true)}
                      </td>
                    </tr>

                    {/* ── SECTION 2: EXPENSES ─────────────────────────────── */}
                    <tr className="pl-row-section">
                      <td colSpan={14}>Expenses</td>
                    </tr>

                    {/* Expense Categories */}
                    {report.categoriesList.map((cat) => {
                      const totalCat = report.totals.costCategories[cat] || 0;
                      return (
                        <tr key={cat}>
                          <td>{cat}</td>
                          {report.months.map((m) => {
                            const val = m.costCategories[cat] || 0;
                            return (
                              <td key={m.month}>
                                {formatCell(val, m.hasData && val > 0)}
                              </td>
                            );
                          })}
                          <td style={{ fontWeight: 700, background: "#F8FAFC" }}>
                            {formatCell(totalCat, totalCat > 0)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Total Expenses Row */}
                    <tr className="pl-row-total-cost">
                      <td>Total Expenses</td>
                      {report.months.map((m) => (
                        <td key={m.month}>
                          {formatCell(m.totalCost, m.hasData)}
                        </td>
                      ))}
                      <td style={{ fontWeight: 900, background: "#FDE68A" }}>
                        {formatCell(report.totals.totalCost, true)}
                      </td>
                    </tr>

                    {/* ── SECTION 3: PROFITABILITY ─────────────────────────── */}
                    <tr className="pl-row-section">
                      <td colSpan={14}>Profitability</td>
                    </tr>

                    {/* Net Profit ($ USD) */}
                    <tr className="pl-row-net-profit">
                      <td style={{ fontWeight: 700 }}>Net Profit ($)</td>
                      {report.months.map((m) => (
                        <td key={m.month} style={{ fontWeight: 700 }}>
                          {formatCell(m.netProfitUsd, m.hasData, { isNegativeRed: true })}
                        </td>
                      ))}
                      <td style={{ fontWeight: 900, background: "#F1F5F9" }}>
                        {formatCell(report.totals.netProfitUsd, true, { isNegativeRed: true })}
                      </td>
                    </tr>

                    {/* Net Profit (VND) */}
                    <tr>
                      <td>Net Profit (VND)</td>
                      {report.months.map((m) => (
                        <td key={m.month}>
                          {formatCell(m.netProfitVnd, m.hasData, { isVnd: true, isNegativeRed: true })}
                        </td>
                      ))}
                      <td style={{ fontWeight: 700, background: "#F8FAFC" }}>
                        {formatCell(report.totals.netProfitVnd, true, { isVnd: true, isNegativeRed: true })}
                      </td>
                    </tr>

                    {/* Net Margin % */}
                    <tr>
                      <td>Net Margin %</td>
                      {report.months.map((m) => (
                        <td key={m.month}>
                          {formatCell(m.netProfitMargin, m.hasData, { isMargin: true })}
                        </td>
                      ))}
                      <td style={{ fontWeight: 700, background: "#F8FAFC" }}>
                        {formatCell(report.totals.netProfitMargin, true, { isMargin: true })}
                      </td>
                    </tr>

                    {/* Accumulate Profit (VND) */}
                    <tr style={{ background: "#F8FAFC", fontWeight: 700 }}>
                      <td style={{ textTransform: "uppercase", fontSize: "11px", color: "var(--text-secondary)" }}>
                        Accumulate Profit (VND)
                      </td>
                      {report.months.map((m) => (
                        <td key={m.month}>
                          {formatCell(m.accumulateProfitVnd, m.hasData, { isVnd: true })}
                        </td>
                      ))}
                      <td style={{ fontWeight: 900, background: "#E2E8F0" }}>
                        {formatCell(report.totals.accumulateProfitVnd, true, { isVnd: true })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB CONTENT 2: Debt Tracker */}
            {activeTab === "debts" && (
              <div style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--border-default)" }}>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                    Track payables, supplier loans, and credit balances with due dates and settlement receipts.
                  </div>
                  <div style={{ display: "flex", gap: "12px", fontSize: "12px", fontWeight: 600 }}>
                    <div style={{ padding: "6px 12px", background: "#FEF3C7", color: "#78350F", borderRadius: "8px" }}>
                      Unsettled: <strong>${(debtSummary?.totalUnpaidUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ padding: "6px 12px", background: "#DCFCE7", color: "#14532D", borderRadius: "8px" }}>
                      Paid: <strong>${(debtSummary?.totalPaidUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                </div>

                <table className="pl-spreadsheet-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Date</th>
                      <th style={{ textAlign: "left" }}>Counterparty</th>
                      <th style={{ textAlign: "left" }}>Category</th>
                      <th>Amount (USD)</th>
                      <th>Amount (VND)</th>
                      <th style={{ textAlign: "left" }}>Due Date</th>
                      <th style={{ textAlign: "left" }}>Status</th>
                      <th style={{ textAlign: "left" }}>Proof</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!debtSummary || debtSummary.debts.length === 0) ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: "center", padding: "30px 0", color: "var(--text-muted)" }}>
                          No debt records found. Click "+ Add / Import Transaction" to record one.
                        </td>
                      </tr>
                    ) : (
                      debtSummary.debts.map((d) => (
                        <tr key={d.id}>
                          <td style={{ textAlign: "left" }}>{d.transactionDate?.split("T")[0]}</td>
                          <td style={{ textAlign: "left", fontWeight: 600 }}>{d.debtCounterparty || "—"}</td>
                          <td style={{ textAlign: "left" }}>{d.category}</td>
                          <td style={{ fontWeight: 600 }}>${d.amountUsd?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td>{d.amountVnd?.toLocaleString()} ₫</td>
                          <td style={{ textAlign: "left" }}>{d.debtDueDate ? d.debtDueDate.split("T")[0] : "—"}</td>
                          <td style={{ textAlign: "left" }}>
                            <span className={`badge ${d.debtStatus === "paid" ? "badge-success" : d.debtStatus === "partial" ? "badge-info" : "badge-warning"}`}>
                              {d.debtStatus}
                            </span>
                          </td>
                          <td style={{ textAlign: "left" }}>
                            {d.imageProofUrl ? (
                              <a href={d.imageProofUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}>
                                📎 View
                              </a>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                              <button onClick={() => handleSettleDebt(d)} className="btn btn-ghost" style={{ fontSize: "11px", padding: "4px 8px" }}>
                                {d.debtStatus === "paid" ? "Unsettle" : "Settle"}
                              </button>
                              <button onClick={() => { setEditingTransaction(d); setIsModalOpen(true); }} className="btn btn-ghost" style={{ fontSize: "11px", padding: "4px 8px" }}>
                                Edit
                              </button>
                              <button onClick={() => handleDeleteTransaction(d.id)} className="btn btn-ghost" style={{ fontSize: "11px", padding: "4px 8px", color: "var(--error)" }}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB CONTENT 3: Transaction Ledger */}
            {activeTab === "ledger" && (
              <div style={{ padding: "20px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    <input
                      type="text"
                      placeholder="Search notes, events, category..."
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      className="input"
                      style={{ width: "240px", height: "36px" }}
                    />
                    <select
                      value={txTypeFilter}
                      onChange={(e) => setTxTypeFilter(e.target.value)}
                      className="pl-select"
                    >
                      <option value="all">All Types</option>
                      <option value="cost">Cost (Expense)</option>
                      <option value="revenue">Revenue</option>
                      <option value="debt">Debt</option>
                    </select>
                    <select
                      value={txCategoryFilter}
                      onChange={(e) => setTxCategoryFilter(e.target.value)}
                      className="pl-select"
                    >
                      <option value="all">All Categories</option>
                      {report.categoriesList.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Showing <strong>{filteredTransactions.length}</strong> transactions
                  </div>
                </div>

                <table className="pl-spreadsheet-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Date</th>
                      <th style={{ textAlign: "left" }}>Type</th>
                      <th style={{ textAlign: "left" }}>Category</th>
                      <th>Amount (USD)</th>
                      <th>Amount (VND)</th>
                      <th style={{ textAlign: "left" }}>Note / Event</th>
                      <th style={{ textAlign: "left" }}>Flags</th>
                      <th style={{ textAlign: "left" }}>Proof</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: "center", padding: "30px 0", color: "var(--text-muted)" }}>
                          No transactions found matching the filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <tr key={tx.id}>
                          <td style={{ textAlign: "left" }}>{tx.transactionDate?.split("T")[0]}</td>
                          <td style={{ textAlign: "left" }}>
                            <span className={`badge ${tx.type === "cost" ? "badge-error" : tx.type === "revenue" ? "badge-success" : "badge-warning"}`}>
                              {tx.type}
                            </span>
                          </td>
                          <td style={{ textAlign: "left", fontWeight: 600 }}>{tx.category}</td>
                          <td style={{ fontWeight: 600 }}>${tx.amountUsd?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td>{tx.amountVnd?.toLocaleString()} ₫</td>
                          <td style={{ textAlign: "left", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {tx.note || tx.event ? (
                              <div>
                                {tx.note && <span>{tx.note} </span>}
                                {tx.event && <span className="badge" style={{ background: "var(--bg-tertiary)", fontSize: "10px" }}>🏷️ {tx.event}</span>}
                              </div>
                            ) : "—"}
                          </td>
                          <td style={{ textAlign: "left" }}>
                            {tx.isExcludedFromReport ? (
                              <span className="badge" style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)", fontSize: "10px" }}>
                                Excluded from Report
                              </span>
                            ) : tx.isRecurring ? (
                              <span className="badge badge-info" style={{ fontSize: "10px" }}>
                                🔄 {tx.repeatFrequency}
                              </span>
                            ) : "—"}
                          </td>
                          <td style={{ textAlign: "left" }}>
                            {tx.imageProofUrl ? (
                              <a href={tx.imageProofUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}>
                                📎 View
                              </a>
                            ) : "—"}
                          </td>
                          <td>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                              <button onClick={() => { setEditingTransaction(tx); setIsModalOpen(true); }} className="btn btn-ghost" style={{ fontSize: "11px", padding: "4px 8px" }}>
                                Edit
                              </button>
                              <button onClick={() => handleDeleteTransaction(tx.id)} className="btn btn-ghost" style={{ fontSize: "11px", padding: "4px 8px", color: "var(--error)" }}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
