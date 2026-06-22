import type { OrderListItem } from "@backend/modules/orders/orders.types";

export type DispatcherShiftStatus = "OPEN" | "CLOSED";
export type DispatcherShiftState = "NOT_OPEN" | "OPEN" | "CLOSED" | "PREVIOUS_SHIFT_OPEN";

export type DispatcherShift = {
  id: number;
  number: number;
  displayNumber: string;
  businessDate: string;
  status: DispatcherShiftStatus;
  timeZone: string;
  openedAt: string;
  closedAt: string | null;
  responsibleName: string;
  closedByName: string | null;
  openedByUserId: number;
  closedByUserId: number | null;
  checksCount: number;
  revenueCents: number;
  cancelledOrdersCount: number;
  totalOrdersCount: number;
  activeOrdersCount: number;
};

export type DispatcherWorkspaceDto = {
  clock: {
    serverNow: string;
    businessDate: string;
    businessTimeZone: string;
  };
  shift: {
    state: DispatcherShiftState;
    id: number | null;
    number: number | null;
    displayNumber: string | null;
    businessDate: string;
    openedAt: string | null;
    closedAt: string | null;
    responsibleName: string | null;
    closedByName: string | null;
    canOpen: boolean;
    canClose: boolean;
    openAvailableAt: string;
    closeAvailableAt: string;
    activeOrdersCount: number;
    checksCount: number;
    revenueCents: number;
    cancelledOrdersCount: number;
    previousShift?: DispatcherShift;
  };
  orderGroups: {
    new: OrderListItem[];
    inProgress: OrderListItem[];
    completed: OrderListItem[];
  };
  counts: {
    new: number;
    inProgress: number;
    completed: number;
  };
  capabilities: {
    canCreateOrder: boolean;
    canOpenShift: boolean;
    canCloseShift: boolean;
    canCancelOrder: boolean;
    canDeleteOrder: boolean;
  };
};
