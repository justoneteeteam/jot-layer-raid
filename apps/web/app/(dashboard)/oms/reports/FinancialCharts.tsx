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
  const chartHeight = 160;

  // Compute expense vs profit progress percentages
  const totalInflow = Math.max(totalRevenue, totalExpenses + Math.max(0, netProfit), 1);
  const expensePct = Math.min(100, Math.max(0, (totalExpenses / totalInflow) * 100));
  const profitPct = Math.min(100, Math.max(0, (Math.max(0, netProfit) / totalInflow) * 100));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
      {/* 1. Left Card: Monthly Revenue (Jan–Dec {year}) */}
      <div className="lg:col-span-7 bg-white border border-gray-200/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Monthly Revenue</h3>
            <p className="text-xs text-gray-500 mt-0.5">Jan–Dec {year}</p>
          </div>
          <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
            Total: {formatAmount(totalRevenue)}
          </div>
        </div>

        {/* Clean Vertical Green Bars with exact numbers on top */}
        <div className="pt-6 pb-2 flex items-end justify-between gap-1 sm:gap-2 h-[200px] border-b border-gray-100">
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
                className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative"
              >
                {/* Value on Top of Bar */}
                <span
                  className={`text-[10px] font-semibold mb-1.5 transition-colors whitespace-nowrap ${
                    isSelected
                      ? "text-emerald-700 font-bold"
                      : d.grossRevenue > 0
                      ? "text-gray-600 group-hover:text-emerald-600"
                      : "text-gray-400"
                  }`}
                >
                  {d.grossRevenue > 0 ? formatShortUsd(d.grossRevenue) : hasData ? "$0" : "—"}
                </span>

                {/* Vertical Bar */}
                <div
                  className="w-full max-w-[28px] rounded-t-md transition-all duration-200"
                  style={{
                    height: `${barHeightPx}px`,
                    backgroundColor: isSelected ? "#059669" : d.grossRevenue > 0 ? "#10B981" : "#E5E7EB",
                    minHeight: d.grossRevenue > 0 ? "6px" : "2px"
                  }}
                />

                {/* Month Name */}
                <span
                  className={`text-xs mt-2 transition-colors ${
                    isSelected
                      ? "text-emerald-800 font-bold"
                      : "text-gray-600 group-hover:text-gray-900 font-medium"
                  }`}
                >
                  {monthLabel}
                </span>

                {/* Hover Tooltip Popup */}
                {hoveredMonth?.month === d.month && (
                  <div className="absolute bottom-full mb-6 bg-gray-900 text-white rounded-lg px-2.5 py-1.5 text-[11px] shadow-xl pointer-events-none z-20 whitespace-nowrap">
                    <div className="font-bold text-gray-200 border-b border-gray-700 pb-0.5">
                      {monthLabel} {year}
                    </div>
                    <div className="text-emerald-400 mt-0.5">Rev: {formatAmount(d.grossRevenue)}</div>
                    <div className="text-rose-400">Cost: {formatAmount(d.totalCost)}</div>
                    <div className="text-blue-400">Net: {formatAmount(d.netProfit)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Right Card: Spend Summary (Annual distribution) */}
      <div className="lg:col-span-5 bg-white border border-gray-200/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Spend Summary</h3>
              <p className="text-xs text-gray-500 mt-0.5">Annual distribution</p>
            </div>
            {spendDistribution.length > 0 && (
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                {spendDistribution.length} categories
              </span>
            )}
          </div>

          {/* Progress Bar 1: Expenses */}
          <div className="space-y-1.5 mb-4">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span>Expenses</span>
              <span className="text-gray-900 font-bold">{formatAmount(totalExpenses)}</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${expensePct}%` }}
              />
            </div>
          </div>

          {/* Progress Bar 2: Net Profit */}
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span>Net profit</span>
              <span className="text-emerald-700 font-bold">{formatAmount(netProfit)}</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${profitPct}%` }}
              />
            </div>
          </div>

          {/* Explanatory Callout */}
          <p className="text-xs text-gray-500 italic mb-4">
            Profit represents <strong className="text-gray-800 not-italic">{netMargin.toFixed(1)}%</strong> of gross revenue.
          </p>
        </div>

        {/* Expense Category Breakdown List */}
        <div className="border-t border-gray-100 pt-3 space-y-2 max-h-[140px] overflow-y-auto pr-1">
          {spendDistribution.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No expenses recorded yet.</p>
          ) : (
            spendDistribution.map((item, idx) => {
              const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length] || "#0D9488";
              return (
                <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-gray-700 truncate" title={item.category}>
                      {item.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-gray-500 font-medium text-[11px]">{item.percentage}%</span>
                    <span className="font-semibold text-gray-900">{formatAmount(item.amountUsd)}</span>
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
