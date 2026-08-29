"use client";

import React, { useState, useEffect, useRef } from "react";
import { FinancialTransaction } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

const DEFAULT_COST_CATEGORIES = [
  "Personnel",
  "Advertising & Marketing",
  "Software",
  "VPS & Proxy",
  "Others",
  "Development",
  "Stripe Cost",
  "Product Fulfillment (COGS)"
];

const DEFAULT_REVENUE_CATEGORIES = [
  "Order Revenue Sync",
  "Direct Client Sale",
  "Affiliate Payout",
  "Refund",
  "Other Income"
];

const DEFAULT_DEBT_CATEGORIES = [
  "Supplier Credit",
  "Advertising Account Credit",
  "Personal Loan",
  "Equipment Financing",
  "Customer Receivable",
  "Other Debt"
];

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultExchangeRate: number;
  initialData?: FinancialTransaction | null;
}

export function TransactionModal({
  isOpen,
  onClose,
  onSuccess,
  defaultExchangeRate = 26000,
  initialData
}: TransactionModalProps) {
  const [activeTab, setActiveTab] = useState<"cost" | "revenue" | "debt">("cost");
  const [inputCurrency, setInputCurrency] = useState<"VND" | "USD">("VND");
  const [amountVnd, setAmountVnd] = useState<string>("");
  const [amountUsd, setAmountUsd] = useState<string>("");
  const [exchangeRate, setExchangeRate] = useState<number>(defaultExchangeRate);
  const [category, setCategory] = useState<string>("");
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(false);
  const [customCategoryName, setCustomCategoryName] = useState<string>("");
  const [repeatFrequency, setRepeatFrequency] = useState<"none" | "monthly" | "weekly" | "yearly">("none");
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split("T")[0]!
  );
  const [note, setNote] = useState<string>("");

  // Expandable "Add More Detail" fields
  const [showMoreDetails, setShowMoreDetails] = useState<boolean>(false);
  const [event, setEvent] = useState<string>("");
  const [imageProofUrl, setImageProofUrl] = useState<string>("");
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [isExcludedFromReport, setIsExcludedFromReport] = useState<boolean>(false); // 'not count in the report'

  // Debt specific fields
  const [debtStatus, setDebtStatus] = useState<"unpaid" | "paid" | "partial">("unpaid");
  const [debtCounterparty, setDebtCounterparty] = useState<string>("");
  const [debtDueDate, setDebtDueDate] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset form state
  useEffect(() => {
    if (initialData) {
      setActiveTab(initialData.type);
      setInputCurrency(initialData.inputCurrency || "VND");
      setExchangeRate(initialData.exchangeRate || defaultExchangeRate);
      setAmountVnd(initialData.amountVnd ? String(initialData.amountVnd) : "");
      setAmountUsd(initialData.amountUsd ? String(initialData.amountUsd) : "");
      setCategory(initialData.category || "");
      setRepeatFrequency(initialData.repeatFrequency || "none");
      setTransactionDate(
        initialData.transactionDate
          ? initialData.transactionDate.split("T")[0]!
          : new Date().toISOString().split("T")[0]!
      );
      setNote(initialData.note || "");
      setEvent(initialData.event || "");
      setImageProofUrl(initialData.imageProofUrl || "");
      setIsExcludedFromReport(Boolean(initialData.isExcludedFromReport));
      setDebtStatus((initialData.debtStatus as any) || "unpaid");
      setDebtCounterparty(initialData.debtCounterparty || "");
      setDebtDueDate(initialData.debtDueDate ? initialData.debtDueDate.split("T")[0]! : "");
      setShowMoreDetails(
        Boolean(
          initialData.event ||
            initialData.imageProofUrl ||
            initialData.isExcludedFromReport ||
            initialData.debtCounterparty
        )
      );
    } else {
      setActiveTab("cost");
      setInputCurrency("VND");
      setExchangeRate(defaultExchangeRate);
      setAmountVnd("");
      setAmountUsd("");
      setCategory(DEFAULT_COST_CATEGORIES[0]!);
      setIsCustomCategory(false);
      setCustomCategoryName("");
      setRepeatFrequency("none");
      setTransactionDate(new Date().toISOString().split("T")[0]!);
      setNote("");
      setShowMoreDetails(false);
      setEvent("");
      setImageProofUrl("");
      setIsExcludedFromReport(false);
      setDebtStatus("unpaid");
      setDebtCounterparty("");
      setDebtDueDate("");
    }
    setErrorMsg("");
  }, [initialData, isOpen, defaultExchangeRate]);

  // Set default category on tab switch if not custom
  useEffect(() => {
    if (!initialData && !isCustomCategory) {
      if (activeTab === "cost") setCategory(DEFAULT_COST_CATEGORIES[0]!);
      if (activeTab === "revenue") setCategory("Other Income");
      if (activeTab === "debt") setCategory(DEFAULT_DEBT_CATEGORIES[0]!);
    }
  }, [activeTab, initialData, isCustomCategory]);

  // Currency auto-conversion handlers
  const handleVndChange = (valStr: string) => {
    setAmountVnd(valStr);
    const num = parseFloat(valStr.replace(/,/g, ""));
    if (!isNaN(num) && num >= 0 && exchangeRate > 0) {
      setAmountUsd((num / exchangeRate).toFixed(2));
    } else {
      setAmountUsd("");
    }
  };

  const handleUsdChange = (valStr: string) => {
    setAmountUsd(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0 && exchangeRate > 0) {
      setAmountVnd(String(Math.round(num * exchangeRate)));
    } else {
      setAmountVnd("");
    }
  };

  const handleRateChange = (newRate: number) => {
    setExchangeRate(newRate);
    if (inputCurrency === "VND") {
      const num = parseFloat(amountVnd.replace(/,/g, ""));
      if (!isNaN(num) && newRate > 0) {
        setAmountUsd((num / newRate).toFixed(2));
      }
    } else {
      const num = parseFloat(amountUsd);
      if (!isNaN(num) && newRate > 0) {
        setAmountVnd(String(Math.round(num * newRate)));
      }
    }
  };

  // Image Upload to R2 Bucket
  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingImage(true);
      setErrorMsg("");
      const formData = new FormData();
      formData.append("file", file);

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/oms/financials/upload-proof`, {
        method: "POST",
        headers,
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to upload image proof");
      }

      setImageProofUrl(data.url);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload image proof");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Save Transaction
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const targetCategory = isCustomCategory ? customCategoryName.trim() : category;
    if (!targetCategory) {
      setErrorMsg("Please select or enter a category.");
      return;
    }

    const rawAmount = inputCurrency === "VND" ? parseFloat(amountVnd.replace(/,/g, "")) : parseFloat(amountUsd);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      setErrorMsg("Please enter a valid amount greater than zero.");
      return;
    }

    try {
      setSubmitting(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const payload = {
        type: activeTab,
        category: targetCategory,
        amount: rawAmount,
        input_currency: inputCurrency,
        exchange_rate: exchangeRate,
        transaction_date: transactionDate,
        note,
        event,
        image_proof_url: imageProofUrl,
        is_recurring: repeatFrequency !== "none",
        repeat_frequency: repeatFrequency,
        is_excluded_from_report: isExcludedFromReport,
        debt_status: activeTab === "debt" ? debtStatus : "n/a",
        debt_counterparty: activeTab === "debt" ? debtCounterparty : "",
        debt_due_date: activeTab === "debt" && debtDueDate ? debtDueDate : null
      };

      const url = initialData
        ? `${API_BASE}/api/oms/financials/transactions/${initialData.id}`
        : `${API_BASE}/api/oms/financials/transactions`;
      const method = initialData ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save transaction.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save transaction.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentCategoryList =
    activeTab === "cost"
      ? DEFAULT_COST_CATEGORIES
      : activeTab === "revenue"
      ? DEFAULT_REVENUE_CATEGORIES
      : DEFAULT_DEBT_CATEGORIES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">
              {activeTab === "cost" ? "💸" : activeTab === "revenue" ? "💰" : "💳"}
            </span>
            <h2 className="text-lg font-bold text-gray-900">
              {initialData ? "Edit Transaction" : "Add / Import Transaction"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200/60 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 3 Tabs: Cost / Revenue / Debt */}
        <div className="grid grid-cols-3 p-1.5 bg-gray-100/80 mx-6 mt-5 rounded-xl text-sm font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("cost")}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "cost"
                ? "bg-white text-rose-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>💸</span> Cost (Expense)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("revenue")}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "revenue"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>💰</span> Revenue / Refund
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("debt")}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "debt"
                ? "bg-white text-amber-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>💳</span> Debt / Payable
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Currency Switch & Dual Amount Input */}
          <div className="bg-gray-50/90 border border-gray-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">Amount & Currency Conversion</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Rate: 1 USD =</span>
                <input
                  type="number"
                  value={exchangeRate}
                  onChange={(e) => handleRateChange(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-0.5 text-xs bg-white border border-gray-300 rounded font-semibold text-gray-800 text-right focus:ring-1 focus:ring-teal-500"
                />
                <span className="text-gray-500 font-medium">VND</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* VND Field */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 flex items-center justify-between">
                  <span>Amount in VND (₫)</span>
                  {inputCurrency === "VND" && (
                    <span className="text-[10px] bg-teal-100 text-teal-700 font-semibold px-1.5 py-0.2 rounded">
                      Primary
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. 5,000,000"
                    value={amountVnd ? Number(amountVnd.replace(/,/g, "")).toLocaleString() : ""}
                    onFocus={() => setInputCurrency("VND")}
                    onChange={(e) => handleVndChange(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <span className="absolute right-3 top-2.5 text-gray-400 text-xs font-medium">₫</span>
                </div>
              </div>

              {/* USD Field */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 flex items-center justify-between">
                  <span>Amount in USD ($)</span>
                  {inputCurrency === "USD" && (
                    <span className="text-[10px] bg-teal-100 text-teal-700 font-semibold px-1.5 py-0.2 rounded">
                      Primary
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 192.30"
                    value={amountUsd}
                    onFocus={() => setInputCurrency("USD")}
                    onChange={(e) => handleUsdChange(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <span className="absolute right-3 top-2.5 text-gray-400 text-xs font-medium">$</span>
                </div>
              </div>
            </div>
          </div>

          {/* Category & Repeat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700">Category *</label>
                <button
                  type="button"
                  onClick={() => setIsCustomCategory(!isCustomCategory)}
                  className="text-[11px] text-teal-600 hover:text-teal-700 font-semibold"
                >
                  {isCustomCategory ? "Select Existing" : "+ New Category"}
                </button>
              </div>

              {isCustomCategory ? (
                <input
                  type="text"
                  placeholder="Enter custom category name..."
                  value={customCategoryName}
                  onChange={(e) => setCustomCategoryName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-2 focus:ring-teal-500"
                />
              ) : (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  {currentCategoryList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Repeat Option */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Repeat / Recurrence</label>
              <select
                value={repeatFrequency}
                onChange={(e) => setRepeatFrequency(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="none">None (One-time)</option>
                <option value="monthly">Monthly (Repeats every month)</option>
                <option value="weekly">Weekly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          {/* Date & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Note / Description</label>
              <input
                type="text"
                placeholder="e.g. Monthly Vultr server bill, FB ads topup..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Debt specific options */}
          {activeTab === "debt" && (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-3">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <span>📋</span> Debt Tracking Information
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-[11px] font-medium text-gray-600 block mb-1">Counterparty</label>
                  <input
                    type="text"
                    placeholder="e.g. Supplier A / Bank"
                    value={debtCounterparty}
                    onChange={(e) => setDebtCounterparty(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={debtDueDate}
                    onChange={(e) => setDebtDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 block mb-1">Status</label>
                  <select
                    value={debtStatus}
                    onChange={(e) => setDebtStatus(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900 font-semibold"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Settled / Paid</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Expandable: Add More Detail */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowMoreDetails(!showMoreDetails)}
              className="w-full px-4 py-2.5 bg-gray-50 flex items-center justify-between text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <span>📎</span> Add More Detail (Event, Image Proof, Report Toggle)
              </span>
              <span>{showMoreDetails ? "▲" : "▼"}</span>
            </button>

            {showMoreDetails && (
              <div className="p-4 space-y-3 bg-white border-t border-gray-100">
                {/* Event Tag */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Associated Event / Campaign</label>
                  <input
                    type="text"
                    placeholder="e.g. Super Bowl Campaign 2026, Summer Drop Promo"
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                {/* Image Proof Upload */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">Image Proof / Receipt / Invoice</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleProofUpload}
                      accept="image/*,application/pdf"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium border border-gray-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <span>📸</span>
                      <span>{isUploadingImage ? "Uploading..." : "Upload Receipt / Bill"}</span>
                    </button>
                    {imageProofUrl && (
                      <div className="flex items-center gap-2 text-xs">
                        <a
                          href={imageProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-600 hover:underline font-medium truncate max-w-[200px]"
                        >
                          View Uploaded Proof
                        </a>
                        <button
                          type="button"
                          onClick={() => setImageProofUrl("")}
                          className="text-rose-500 hover:text-rose-700 text-xs font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Not count in the report Toggle */}
                <div className="flex items-center justify-between p-3 bg-amber-50/60 rounded-xl border border-amber-200/60">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-gray-900 block">
                      Not count in the report
                    </span>
                    <span className="text-[11px] text-gray-500 block">
                      Keep this transaction saved for notes/history without factoring into official P&L profit calculations.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={isExcludedFromReport}
                      onChange={(e) => setIsExcludedFromReport(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isUploadingImage}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <span className="animate-spin">🌀</span> Saving...
                </>
              ) : initialData ? (
                "Update Transaction"
              ) : (
                "Save Transaction"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
