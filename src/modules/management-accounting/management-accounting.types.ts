export type ManagementAccountingMetric = {
  label: string;
  value?: string;
  hint: string;
  tone?: "good" | "warning" | "danger";
};

export type ManagementAccountingEntryType = "INCOME" | "EXPENSE";
export type ManagementAccountingDayStatus = "NOT_STARTED" | "OPEN" | "CLOSED";

export type ManagementAccountingManualEntry = {
  id: number;
  date: string;
  type: ManagementAccountingEntryType;
  category: string;
  amountCents: number;
  amount: string;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ManagementAccountingStaffMember = {
  employeeId: number;
  name: string;
  role: string;
  scheduledHours: number;
  ordersCount: number;
  revenueCents: number;
  advancesCents: number;
  finesCents: number;
  debtCents: number;
  payoutCents: number;
  summary: string;
};

export type ManagementAccountingPositionMetric = {
  label: string;
  quantity: string;
  revenueCents: number;
  costCents: number;
  marginCents: number;
  foodCostPercent: string;
  hint: string;
};

export type ManagementAccountingRange = {
  date: string;
  start: string;
  end: string;
  label: string;
  previousDate: string;
  nextDate: string;
};

export type ManagementAccountingDay = {
  id: number | null;
  date: string;
  status: ManagementAccountingDayStatus;
  openedAt: string | null;
  closedAt: string | null;
  canStart: boolean;
  canEdit: boolean;
  canClose: boolean;
  canReopen: boolean;
};

export type ManagementAccountingDto = {
  range: ManagementAccountingRange;
  accountingDay: ManagementAccountingDay;
  previousHref: string;
  nextHref: string;
  kpis: ManagementAccountingMetric[];
  sales: ManagementAccountingMetric[];
  income: ManagementAccountingMetric[];
  expenses: ManagementAccountingMetric[];
  profit: ManagementAccountingMetric[];
  foodCost: ManagementAccountingMetric[];
  topPositions: ManagementAccountingPositionMetric[];
  badPositions: ManagementAccountingPositionMetric[];
  shift: {
    id: number;
    number: string;
    status: string;
    openedAt: string;
    closedAt: string | null;
    checksCount: number;
    revenueCents: number;
    totalOrdersCount: number;
    cancelledOrdersCount: number;
  } | null;
  staff: {
    members: ManagementAccountingStaffMember[];
    totals: {
      scheduledHours: number;
      advancesCents: number;
      finesCents: number;
      debtCents: number;
      payoutCents: number;
    };
  };
  manualEntries: ManagementAccountingManualEntry[];
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
    staffPayoutCents: number;
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
