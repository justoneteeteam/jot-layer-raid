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

interface FinancialChartsProps {
  spendDistribution: SpendDistributionItem[];
  monthlyTrends: MonthlyTrendItem[];
  currencyMode: "USD" | "VND" | "DUAL";
  exchangeRate: number;
  selectedMonthFilter: number; // 0 for All Year, 1-12 for specific month
  onSelectMonth: (month: number) => void;
}

export function FinancialCharts({
  spendDistribution,
  monthlyTrends,
  currencyMode,
  exchangeRate,
  selectedMonthFilter,
  onSelectMonth
}: FinancialChartsProps) {
  const [hoveredSlice, setHoveredSlice] = useState<SpendDistributionItem | null>(null);
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

  // Donut Chart calculations
  const totalSpendUsd = spendDistribution.reduce((acc, cur) => acc + cur.amountUsd, 0);
  const size = 260;
  const center = size / 2;
  const radius = 90;
  const innerRadius = 55;

  let cumulativeAngle = 0;
  const slices = spendDistribution.map((item, index) => {
    const angle = totalSpendUsd > 0 ? (item.amountUsd / totalSpendUsd) * 360 : 0;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle += angle;

    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const ix1 = center + innerRadius * Math.cos(endRad);
    const iy1 = center + innerRadius * Math.sin(endRad);
    const ix2 = center + innerRadius * Math.cos(startRad);
    const iy2 = center + innerRadius * Math.sin(startRad);

    const largeArcFlag = angle > 180 ? 1 : 0;
    const pathData = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix2} ${iy2}`,
      "Z"
    ].join(" ");

    const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length] || "#0D9488";
    return { ...item, pathData, color, startAngle, endAngle };
  });

  // Monthly Grouped Column Chart Calculations
  const chartHeight = 220;
  const chartWidth = 640;
  const padLeft = 50;
  const padBottom = 30;
  const padTop = 20;
  const innerWidth = chartWidth - padLeft - 20;
  const innerHeight = chartHeight - padTop - padBottom;

  const maxVal = Math.max(
    ...monthlyTrends.map((d) => Math.max(d.grossRevenue, d.totalCost, Math.abs(d.netProfit))),
    1000
  );

  const groupWidth = innerWidth / 12;
  const barWidth = groupWidth * 0.24;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
      {/* 1. Circle / Donut Spend Distribution */}
      <div className="lg:col-span-5 bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
              <span>🍩</span> Spend Breakdown by Category
            </h3>
            <p className="text-xs text-gray-500">
              {selectedMonthFilter === 0 ? "Overall Annual Distribution" : `Month ${selectedMonthFilter} Distribution`}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <select
              value={selectedMonthFilter}
              onChange={(e) => onSelectMonth(parseInt(e.target.value, 10))}
              className="text-xs bg-white border border-gray-300 rounded px-2 py-1 text-gray-700 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value={0}>All Year (Total)</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Month {i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>

        {spendDistribution.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <span className="text-3xl mb-2">💸</span>
            <p className="text-sm">No expenses recorded for this period.</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-4 flex-1">
            {/* SVG Donut Chart */}
            <div className="relative flex-shrink-0">
              <svg width={size} height={size} className="overflow-visible">
                {slices.map((slice, i) => (
                  <path
                    key={i}
                    d={slice.pathData}
                    fill={slice.color}
                    className="transition-all duration-200 cursor-pointer hover:opacity-85"
                    style={{
                      transform: hoveredSlice?.category === slice.category ? "scale(1.04)" : "scale(1)",
                      transformOrigin: `${center}px ${center}px`
                    }}
                    onMouseEnter={() => setHoveredSlice(slice)}
                    onMouseLeave={() => setHoveredSlice(null)}
                  />
                ))}
              </svg>
              {/* Center Donut Label */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4"
                style={{ width: size, height: size }}
              >
                {hoveredSlice ? (
                  <>
                    <span className="text-[11px] text-gray-500 font-medium truncate max-w-[100px]">
                      {hoveredSlice.category}
                    </span>
                    <span className="text-sm font-bold text-gray-900">{hoveredSlice.percentage}%</span>
                    <span className="text-[10px] text-teal-600 font-semibold">{formatAmount(hoveredSlice.amountUsd)}</span>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Total Cost</span>
                    <span className="text-sm font-bold text-gray-900">{formatAmount(totalSpendUsd)}</span>
                    <span className="text-[10px] text-gray-500">{spendDistribution.length} categories</span>
                  </>
                )}
              </div>
            </div>

            {/* Category Legend & List */}
            <div className="flex-1 overflow-y-auto max-h-[220px] w-full space-y-2 pr-1 custom-scrollbar">
              {spendDistribution.map((item, idx) => {
                const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length] || "#0D9488";
                const isHovered = hoveredSlice?.category === item.category;
                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredSlice(item)}
                    onMouseLeave={() => setHoveredSlice(null)}
                    className={`flex items-center justify-between p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      isHovered ? "bg-gray-100 font-semibold" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-gray-800 truncate" title={item.category}>
                        {item.category}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{item.percentage}%</span>
                      <span className="text-gray-500 text-[11px]">{formatAmount(item.amountUsd)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Column / Bar Chart: Monthly Financial Trends */}
      <div className="lg:col-span-7 bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
              <span>📊</span> Monthly Financial Performance
            </h3>
            <p className="text-xs text-gray-500">Gross Revenue vs. Total Cost vs. Net Profit across Months 1–12</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
              <span className="text-gray-600">Gross Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-rose-500" />
              <span className="text-gray-600">Total Cost</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-blue-500" />
              <span className="text-gray-600">Net Profit</span>
            </div>
          </div>
        </div>

        {/* SVG Grouped Bar Chart */}
        <div className="flex-1 w-full overflow-x-auto relative">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto select-none">
            {/* Gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = padTop + innerHeight * (1 - ratio);
              const val = maxVal * ratio;
              return (
                <g key={i}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={chartWidth - 20}
                    y2={y}
                    stroke="#E5E7EB"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                  <text x={padLeft - 8} y={y + 3} textAnchor="end" fontSize={9} fill="#9CA3AF">
                    ${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Zero Base Line */}
            <line
              x1={padLeft}
              y1={padTop + innerHeight}
              x2={chartWidth - 20}
              y2={padTop + innerHeight}
              stroke="#9CA3AF"
              strokeWidth={1}
            />

            {/* Month Bars */}
            {monthlyTrends.map((d, index) => {
              const groupX = padLeft + index * groupWidth;
              const revH = (d.grossRevenue / maxVal) * innerHeight;
              const costH = (d.totalCost / maxVal) * innerHeight;
              const profitH = Math.max((Math.abs(d.netProfit) / maxVal) * innerHeight, 2);
              const isProfitPositive = d.netProfit >= 0;

              const isSelected = selectedMonthFilter === d.month;
              const isHovered = hoveredMonth?.month === d.month;

              return (
                <g
                  key={index}
                  className="cursor-pointer"
                  onClick={() => onSelectMonth(selectedMonthFilter === d.month ? 0 : d.month)}
                  onMouseEnter={() => setHoveredMonth(d)}
                  onMouseLeave={() => setHoveredMonth(null)}
                >
                  {/* Background Highlight on Active/Hover */}
                  {(isSelected || isHovered) && (
                    <rect
                      x={groupX + 2}
                      y={padTop}
                      width={groupWidth - 4}
                      height={innerHeight}
                      fill={isSelected ? "#CCFBF1" : "#F3F4F6"}
                      rx={4}
                      opacity={0.7}
                    />
                  )}

                  {/* Gross Revenue Bar */}
                  <rect
                    x={groupX + groupWidth * 0.12}
                    y={padTop + innerHeight - revH}
                    width={barWidth}
                    height={Math.max(revH, 2)}
                    fill="#10B981"
                    rx={2}
                  />

                  {/* Total Cost Bar */}
                  <rect
                    x={groupX + groupWidth * 0.12 + barWidth + 2}
                    y={padTop + innerHeight - costH}
                    width={barWidth}
                    height={Math.max(costH, 2)}
                    fill="#EF4444"
                    rx={2}
                  />

                  {/* Net Profit Bar */}
                  <rect
                    x={groupX + groupWidth * 0.12 + (barWidth + 2) * 2}
                    y={padTop + innerHeight - profitH}
                    width={barWidth}
                    height={Math.max(profitH, 2)}
                    fill={isProfitPositive ? "#3B82F6" : "#F59E0B"}
                    rx={2}
                  />

                  {/* Month Label */}
                  <text
                    x={groupX + groupWidth / 2}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={isSelected ? "bold" : "normal"}
                    fill={isSelected ? "#0D9488" : "#6B7280"}
                  >
                    M{d.month}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Hover Tooltip Overlay */}
          {hoveredMonth && (
            <div className="absolute top-2 right-4 bg-gray-900 text-white rounded-lg p-2.5 text-xs shadow-lg pointer-events-none z-10 space-y-1">
              <div className="font-bold border-b border-gray-700 pb-1 flex justify-between gap-4">
                <span>Month {hoveredMonth.month} Details</span>
              </div>
              <div className="flex justify-between gap-3 text-emerald-400">
                <span>Revenue:</span>
                <span className="font-semibold">{formatAmount(hoveredMonth.grossRevenue)}</span>
              </div>
              <div className="flex justify-between gap-3 text-rose-400">
                <span>Cost:</span>
                <span className="font-semibold">{formatAmount(hoveredMonth.totalCost)}</span>
              </div>
              <div className="flex justify-between gap-3 text-blue-400">
                <span>Net Profit:</span>
                <span className="font-semibold">{formatAmount(hoveredMonth.netProfit)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
