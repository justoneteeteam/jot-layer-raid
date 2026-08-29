"use client";

import React, { useState } from "react";
import { SpendDistributionItem, MonthlyTrendItem } from "./types";

const CATEGORY_COLORS = [
  "#0D9488", // Teal
  "#3B82F6", // Blue
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#10B981", // Emerald
  "#6366F1", // Indigo
  "#14B8A6", // Light teal
  "#F97316", // Orange
  "#64748B", // Slate
  "#84CC16"  // Lime
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface FinancialChartsProps {
  year: number;
  spendDistribution: SpendDistributionItem[];
  monthlyTrends: MonthlyTrendItem[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  netMargin: number;
  currencyMode: "USD" | "VND" | "DUAL";
  exchangeRate: number;
  selectedMonthFilter: number; // 0 for All Year, 1-12 for specific month
  onSelectMonth: (month: number) => void;
}

export function FinancialCharts({
  year,
  spendDistribution,
  monthlyTrends,
  totalRevenue,
  totalExpenses,
  netProfit,
  netMargin,
  currencyMode,
  exchangeRate,
  selectedMonthFilter,
  onSelectMonth
}: FinancialChartsProps) {
  const [hoveredMonth, setHoveredMonth] = useState<MonthlyTrendItem | null>(null);

  // Format numbers helper
  const formatAmount = (usd: number) => {
    if (currencyMode === "VND") {
      const vnd = usd * exchangeRate;
      return `${Math.round(vnd).toLocaleString()} ₫`;
    }
    if (currencyMode === "DUAL") {
      const vnd = usd * exchangeRate;
      return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${Math.round(vnd).toLocaleString()} ₫)`;
    }
    return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatShortUsd = (usd: number) => {
    if (usd === 0) return "$0";
    if (usd >= 1000) return `$${Math.round(usd).toLocaleString()}`;
    return `$${Math.round(usd)}`;
  };

  // Max value for revenue bar chart scaling
  const maxRevenue = Math.max(...monthlyTrends.map((d) => d.grossRevenue), 100);
  const chartHeight = 150;

  // Compute expense vs profit progress percentages
  const totalInflow = Math.max(totalRevenue, totalExpenses + Math.max(0, netProfit), 1);
  const expensePct = Math.min(100, Math.max(0, (totalExpenses / totalInflow) * 100));
  const profitPct = Math.min(100, Math.max(0, (Math.max(0, netProfit) / totalInflow) * 100));

  return (
    <div className="pl-visual-grid">
      {/* 1. Left Card: Monthly Revenue (Jan–Dec {year}) */}
      <div className="pl-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <div className="pl-card-title">Monthly Revenue</div>
            <div className="pl-card-subtitle">Jan–Dec {year}</div>
          </div>
          <span className="badge badge-success" style={{ fontSize: "12px", fontWeight: 600 }}>
            Total: {formatAmount(totalRevenue)}
          </span>
        </div>

        {/* Clean Vertical Emerald Bars with exact numbers on top */}
        <div className="pl-bar-container">
          {monthlyTrends.map((d, index) => {
            const hasData = d.grossRevenue > 0 || d.totalCost > 0;
            const barHeightPct = hasData && d.grossRevenue > 0 ? (d.grossRevenue / maxRevenue) * 100 : 0;
            const barHeightPx = Math.max((barHeightPct / 100) * chartHeight, d.grossRevenue > 0 ? 6 : 0);
            const isSelected = selectedMonthFilter === d.month;
            const monthLabel = MONTH_NAMES[index] || `M${d.month}`;

            return (
              <div
                key={d.month}
                onClick={() => onSelectMonth(selectedMonthFilter === d.month ? 0 : d.month)}
                onMouseEnter={() => setHoveredMonth(d)}
                onMouseLeave={() => setHoveredMonth(null)}
                className={`pl-bar-col ${isSelected ? "selected" : ""}`}
              >
                {/* Value on Top of Bar */}
                <span className="pl-bar-value">
                  {d.grossRevenue > 0 ? formatShortUsd(d.grossRevenue) : hasData ? "$0" : "—"}
                </span>

                {/* Vertical Bar */}
                <div
                  className="pl-bar-stick"
                  style={{
                    height: `${barHeightPx}px`,
                    background: isSelected ? "var(--accent-hover)" : d.grossRevenue > 0 ? "#10B981" : "var(--border-default)"
                  }}
                />

                {/* Month Name */}
                <span className="pl-bar-label">{monthLabel}</span>

                {/* Hover Tooltip Popup */}
                {hoveredMonth?.month === d.month && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      marginBottom: "24px",
                      background: "var(--text-primary)",
                      color: "white",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "11px",
                      boxShadow: "var(--shadow-lg)",
                      pointerEvents: "none",
                      zIndex: 30,
                      whiteSpace: "nowrap"
                    }}
                  >
                    <div style={{ fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: "3px" }}>
                      {monthLabel} {year}
                    </div>
                    <div style={{ color: "#34D399", marginTop: "3px" }}>Revenue: {formatAmount(d.grossRevenue)}</div>
                    <div style={{ color: "#F87171" }}>Cost: {formatAmount(d.totalCost)}</div>
                    <div style={{ color: "#60A5FA" }}>Net: {formatAmount(d.netProfit)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Right Card: Spend Summary (Annual distribution) */}
      <div className="pl-card">
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <div className="pl-card-title">Spend Summary</div>
              <div className="pl-card-subtitle">Annual distribution</div>
            </div>
            {spendDistribution.length > 0 && (
              <span className="badge" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: "11px" }}>
                {spendDistribution.length} categories
              </span>
            )}
          </div>

          {/* Progress Bar 1: Expenses */}
          <div className="pl-progress-group">
            <div className="pl-progress-header">
              <span>Expenses</span>
              <span style={{ color: "var(--text-primary)" }}>{formatAmount(totalExpenses)}</span>
            </div>
            <div className="pl-progress-track">
              <div className="pl-progress-bar-orange" style={{ width: `${expensePct}%` }} />
            </div>
          </div>

          {/* Progress Bar 2: Net Profit */}
          <div className="pl-progress-group" style={{ marginBottom: "10px" }}>
            <div className="pl-progress-header">
              <span>Net profit</span>
              <span style={{ color: "#10B981" }}>{formatAmount(netProfit)}</span>
            </div>
            <div className="pl-progress-track">
              <div className="pl-progress-bar-green" style={{ width: `${profitPct}%` }} />
            </div>
          </div>

          {/* Explanatory Callout */}
          <p style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", marginBottom: "16px" }}>
            Profit represents <strong style={{ color: "var(--text-primary)", fontStyle: "normal" }}>{netMargin.toFixed(1)}%</strong> of gross revenue.
          </p>
        </div>

        {/* Expense Category Breakdown List */}
        <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "12px", maxHeight: "140px", overflowY: "auto" }}>
          {spendDistribution.length === 0 ? (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
              No expenses recorded yet.
            </p>
          ) : (
            spendDistribution.map((item, idx) => {
              const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length] || "#0D9488";
              return (
                <div key={idx} className="pl-category-row">
                  <div style={{ display: "flex", alignItems: "center", minWidth: 0, paddingRight: "8px" }}>
                    <span className="pl-cat-dot" style={{ backgroundColor: color }} />
                    <span style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.category}>
                      {item.category}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{item.percentage}%</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{formatAmount(item.amountUsd)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
