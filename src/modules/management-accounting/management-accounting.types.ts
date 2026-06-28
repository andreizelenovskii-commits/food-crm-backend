export type ManagementAccountingMetric = {
  label: string;
  value?: string;
  hint: string;
  tone?: "good" | "warning" | "danger";
};

export type ManagementAccountingRange = {
  date: string;
  start: string;
  end: string;
  label: string;
  previousDate: string;
  nextDate: string;
};

export type ManagementAccountingDto = {
  range: ManagementAccountingRange;
  previousHref: string;
  nextHref: string;
  kpis: ManagementAccountingMetric[];
  sales: ManagementAccountingMetric[];
  income: ManagementAccountingMetric[];
  expenses: ManagementAccountingMetric[];
  profit: ManagementAccountingMetric[];
  foodCost: ManagementAccountingMetric[];
  dataGaps: ManagementAccountingMetric[];
  rawTotals: {
    revenueCents: number;
    subtotalCents: number;
    discountCents: number;
    estimatedFoodCostCents: number;
    purchaseCents: number;
    writeoffCents: number;
    manualIncomeCents: number;
    manualExpenseCents: number;
    grossProfitCents: number;
    netProfitCents: number;
    completedOrders: number;
  };
  availability: {
    orders: boolean;
    inventory: boolean;
    manualOperations: boolean;
  };
};
