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
  const [isExcludedFromReport, setIsExcludedFromReport] = useState<boolean>(false);

  // Debt specific fields
  const [debtStatus, setDebtStatus] = useState<"unpaid" | "paid" | "partial">("unpaid");
  const [debtCounterparty, setDebtCounterparty] = useState<string>("");
  const [debtDueDate, setDebtDueDate] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!initialData && !isCustomCategory) {
      if (activeTab === "cost") setCategory(DEFAULT_COST_CATEGORIES[0]!);
      if (activeTab === "revenue") setCategory("Other Income");
      if (activeTab === "debt") setCategory(DEFAULT_DEBT_CATEGORIES[0]!);
    }
  }, [activeTab, initialData, isCustomCategory]);

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
    <div className="pl-modal-overlay">
      <div className="pl-modal-box">
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-default)", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>
              {activeTab === "cost" ? "💸" : activeTab === "revenue" ? "💰" : "💳"}
            </span>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
              {initialData ? "Edit Transaction" : "Add / Import Transaction"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "18px", cursor: "pointer", padding: "4px" }}
          >
            ✕
          </button>
        </div>

        {/* 3 Tabs: Cost / Revenue / Debt */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", margin: "20px 24px 0", background: "var(--bg-tertiary)", padding: "4px", borderRadius: "10px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("cost")}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
              background: activeTab === "cost" ? "var(--bg-primary)" : "transparent",
              color: activeTab === "cost" ? "#EF4444" : "var(--text-secondary)",
              boxShadow: activeTab === "cost" ? "var(--shadow-sm)" : "none"
            }}
          >
            💸 Cost (Expense)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("revenue")}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
              background: activeTab === "revenue" ? "var(--bg-primary)" : "transparent",
              color: activeTab === "revenue" ? "#10B981" : "var(--text-secondary)",
              boxShadow: activeTab === "revenue" ? "var(--shadow-sm)" : "none"
            }}
          >
            💰 Revenue / Refund
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("debt")}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
              background: activeTab === "debt" ? "var(--bg-primary)" : "transparent",
              color: activeTab === "debt" ? "#F59E0B" : "var(--text-secondary)",
              boxShadow: activeTab === "debt" ? "var(--shadow-sm)" : "none"
            }}
          >
            💳 Debt / Payable
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", maxHeight: "75vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {errorMsg && (
            <div style={{ padding: "10px 14px", background: "#FEE2E2", color: "var(--error)", borderRadius: "8px", fontSize: "12px", fontWeight: 500 }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Currency Switch & Dual Amount Input */}
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-default)", borderRadius: "10px", padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", marginBottom: "10px" }}>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Amount & Exchange Conversion</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "var(--text-muted)" }}>1 USD =</span>
                <input
                  type="number"
                  value={exchangeRate}
                  onChange={(e) => handleRateChange(parseFloat(e.target.value) || 0)}
                  style={{ width: "70px", padding: "2px 6px", border: "1px solid var(--border-default)", borderRadius: "4px", fontSize: "12px", fontWeight: 700, textAlign: "right" }}
                />
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>VND</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {/* VND Field */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span>Amount in VND (₫)</span>
                  {inputCurrency === "VND" && <span style={{ color: "var(--accent)", fontWeight: 700 }}>Primary</span>}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="e.g. 5,000,000"
                    value={amountVnd ? Number(amountVnd.replace(/,/g, "")).toLocaleString() : ""}
                    onFocus={() => setInputCurrency("VND")}
                    onChange={(e) => handleVndChange(e.target.value)}
                    className="input"
                    style={{ fontWeight: 600, paddingRight: "28px" }}
                  />
                  <span style={{ position: "absolute", right: "10px", top: "10px", color: "var(--text-muted)", fontSize: "13px" }}>₫</span>
                </div>
              </div>

              {/* USD Field */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span>Amount in USD ($)</span>
                  {inputCurrency === "USD" && <span style={{ color: "var(--accent)", fontWeight: 700 }}>Primary</span>}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 192.30"
                    value={amountUsd}
                    onFocus={() => setInputCurrency("USD")}
                    onChange={(e) => handleUsdChange(e.target.value)}
                    className="input"
                    style={{ fontWeight: 600, paddingRight: "28px" }}
                  />
                  <span style={{ position: "absolute", right: "10px", top: "10px", color: "var(--text-muted)", fontSize: "13px" }}>$</span>
                </div>
              </div>
            </div>
          </div>

          {/* Category & Recurrence */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>Category *</label>
                <button
                  type="button"
                  onClick={() => setIsCustomCategory(!isCustomCategory)}
                  style={{ background: "none", border: "none", color: "var(--accent)", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                >
                  {isCustomCategory ? "Select Existing" : "+ New"}
                </button>
              </div>

              {isCustomCategory ? (
                <input
                  type="text"
                  placeholder="Custom category name..."
                  value={customCategoryName}
                  onChange={(e) => setCustomCategoryName(e.target.value)}
                  className="input"
                />
              ) : (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input"
                  style={{ cursor: "pointer" }}
                >
                  {currentCategoryList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>Repeat / Recurrence</label>
              <select
                value={repeatFrequency}
                onChange={(e) => setRepeatFrequency(e.target.value as any)}
                className="input"
                style={{ cursor: "pointer" }}
              >
                <option value="none">None (One-time)</option>
                <option value="monthly">Monthly (Repeats every month)</option>
                <option value="weekly">Weekly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          {/* Date & Note */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>Date</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>Note / Description</label>
              <input
                type="text"
                placeholder="e.g. Vultr VPS, Facebook Ads..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {/* Debt specific options */}
          {activeTab === "debt" && (
            <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: "10px", padding: "12px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#78350F", marginBottom: "8px" }}>
                📋 Debt Tracking Information
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "3px" }}>Counterparty</label>
                  <input
                    type="text"
                    placeholder="Supplier / Bank"
                    value={debtCounterparty}
                    onChange={(e) => setDebtCounterparty(e.target.value)}
                    className="input"
                    style={{ height: "32px", fontSize: "12px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "3px" }}>Due Date</label>
                  <input
                    type="date"
                    value={debtDueDate}
                    onChange={(e) => setDebtDueDate(e.target.value)}
                    className="input"
                    style={{ height: "32px", fontSize: "12px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "3px" }}>Status</label>
                  <select
                    value={debtStatus}
                    onChange={(e) => setDebtStatus(e.target.value as any)}
                    className="input"
                    style={{ height: "32px", fontSize: "12px", fontWeight: 600 }}
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
          <div style={{ border: "1px solid var(--border-default)", borderRadius: "10px", overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setShowMoreDetails(!showMoreDetails)}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--bg-secondary)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-primary)",
                cursor: "pointer"
              }}
            >
              <span>📎 Add More Detail (Event, Image Proof, Report Toggle)</span>
              <span>{showMoreDetails ? "▲" : "▼"}</span>
            </button>

            {showMoreDetails && (
              <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "12px", background: "var(--bg-primary)", borderTop: "1px solid var(--border-default)" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Associated Event / Campaign</label>
                  <input
                    type="text"
                    placeholder="e.g. Super Bowl 2026, TikTok Drop"
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Image Proof / Receipt / Invoice</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleProofUpload}
                      accept="image/*,application/pdf"
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      disabled={isUploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-secondary"
                      style={{ fontSize: "12px", padding: "6px 12px" }}
                    >
                      <span>📸</span>
                      <span>{isUploadingImage ? "Uploading..." : "Upload Receipt / Bill"}</span>
                    </button>
                    {imageProofUrl && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                        <a href={imageProofUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}>
                          View Proof Link
                        </a>
                        <button
                          type="button"
                          onClick={() => setImageProofUrl("")}
                          style={{ color: "var(--error)", background: "none", border: "none", fontWeight: 700, cursor: "pointer" }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
                  <div>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", display: "block" }}>
                      Not count in the report
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>
                      Keep saved for records without factoring into official P&L profit calculations.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isExcludedFromReport}
                    onChange={(e) => setIsExcludedFromReport(e.target.checked)}
                    style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--accent)" }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", paddingTop: "12px", borderTop: "1px solid var(--border-default)" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting || isUploadingImage} className="btn btn-primary">
              {submitting ? "Saving..." : initialData ? "Update Transaction" : "Save Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
