export interface MonthlyPLData {
  month: number;
  monthLabel: string;
  hasData?: boolean;
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
}

export interface SpendDistributionItem {
  category: string;
  amountUsd: number;
  amountVnd: number;
  percentage: number;
}

export interface MonthlyTrendItem {
  month: number;
  label: string;
  grossRevenue: number;
  totalCost: number;
  netProfit: number;
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
  spendDistribution: SpendDistributionItem[];
  monthlyTrends: MonthlyTrendItem[];
  availableYears: number[];
}

export interface FinancialTransaction {
  id: number;
  type: "cost" | "revenue" | "debt";
  category: string;
  amountVnd: number;
  amountUsd: number;
  exchangeRate: number;
  inputCurrency: "VND" | "USD";
  transactionDate: string;
  year: number;
  month: number;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface DebtSummary {
  debts: FinancialTransaction[];
  totalUnpaidUsd: number;
  totalUnpaidVnd: number;
  totalPaidUsd: number;
  totalPaidVnd: number;
  totalCount: number;
}
