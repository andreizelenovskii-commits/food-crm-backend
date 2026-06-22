import { withTransaction } from "@backend/shared/db/transaction";
import { ConflictError, ValidationError } from "@backend/shared/errors/app-error";
import type { AuthenticatedApiUser } from "@backend/modules/access/access-control";
import { hasApiPermission } from "@backend/modules/access/access-control";
import {
  calculateShiftMetrics,
  closeShift,
  createShift,
  getOpenShift,
  getShiftById,
  getShiftByBusinessDate,
  getShiftOrders,
  listShifts,
  lockShiftById,
  groupDispatcherOrders,
} from "@backend/modules/dispatcher-shifts/dispatcher-shifts.repository";
import {
  BUSINESS_TIME_ZONE,
  type Clock,
  formatShiftNumber,
  getBusinessDate,
  getCloseThreshold,
  getOpenThreshold,
  systemClock,
} from "@backend/modules/dispatcher-shifts/dispatcher-shifts.time";
import type { DispatcherWorkspaceDto } from "@backend/modules/dispatcher-shifts/dispatcher-shifts.types";
import { canCreateOrders } from "@backend/modules/orders/orders.workflow";

function assertPermission(user: AuthenticatedApiUser, permission: Parameters<typeof hasApiPermission>[1]) {
  if (!hasApiPermission(user, permission)) {
    throw new ValidationError("У вашей роли нет прав на это действие");
  }
}

function makeOrderingClosedMessage(todayShiftExists: boolean) {
  return todayShiftExists
    ? "Приём заказов на сегодня завершён."
    : "Сейчас заказы не принимаются";
}

export async function getPublicOrderingStatus(clock: Clock = systemClock) {
  const now = clock.now();
  const businessDate = getBusinessDate(now, BUSINESS_TIME_ZONE);
  const [openShift, todayShift] = await Promise.all([
    getOpenShift(),
    getShiftByBusinessDate(businessDate),
  ]);
  const acceptingOrders = Boolean(openShift?.status === "OPEN" && openShift.businessDate === businessDate);

  return {
    acceptingOrders,
    reason: acceptingOrders ? null : todayShift?.status === "CLOSED" ? "SHIFT_CLOSED" : "SHIFT_NOT_OPEN",
    businessDate,
    businessTimeZone: BUSINESS_TIME_ZONE,
    serverNow: now.toISOString(),
    nextOpenNotBefore: getOpenThreshold(now, BUSINESS_TIME_ZONE).toISOString(),
    message: acceptingOrders
      ? "Заказы принимаются"
      : makeOrderingClosedMessage(Boolean(todayShift)),
  };
}

export async function openDispatcherShift(input: {
  responsibleName: string;
  user: AuthenticatedApiUser;
  clock?: Clock;
}) {
  assertPermission(input.user, "manage_dispatcher_shift");
  const clock = input.clock ?? systemClock;
  const now = clock.now();
  const businessDate = getBusinessDate(now, BUSINESS_TIME_ZONE);
  const openAvailableAt = getOpenThreshold(now, BUSINESS_TIME_ZONE);

  if (now < openAvailableAt) {
    throw new ConflictError("Открытие смены доступно не ранее 09:00 по сахалинскому времени", {
      code: "SHIFT_OPEN_TOO_EARLY",
    });
  }

  return withTransaction(async (client) => {
    const openShift = await getOpenShift(client);
    const todayShift = await getShiftByBusinessDate(businessDate, client);

    if (openShift) {
      throw new ConflictError(
        openShift.businessDate === businessDate ? "Смена уже открыта" : "Предыдущая смена не закрыта",
        { code: openShift.businessDate === businessDate ? "SHIFT_ALREADY_OPEN" : "PREVIOUS_SHIFT_NOT_CLOSED" },
      );
    }

    if (todayShift) {
      throw new ConflictError("Смена на сегодня уже была создана", {
        code: "SHIFT_ALREADY_EXISTS_FOR_DATE",
      });
    }

    return createShift({
      businessDate,
      now,
      responsibleName: input.responsibleName,
      openedByUserId: input.user.id,
      client,
    });
  });
}

export async function closeDispatcherShift(input: {
  shiftId: number;
  closedByName: string;
  user: AuthenticatedApiUser;
  clock?: Clock;
}) {
  assertPermission(input.user, "manage_dispatcher_shift");
  const clock = input.clock ?? systemClock;
  const now = clock.now();

  return withTransaction(async (client) => {
    const shift = await lockShiftById(input.shiftId, client);

    if (!shift) {
      throw new ValidationError("Смена не найдена");
    }

    if (shift.status !== "OPEN") {
      throw new ConflictError("Смена уже закрыта", { code: "SHIFT_NOT_OPEN" });
    }

    const metrics = await calculateShiftMetrics(shift.id, client);

    if (metrics.activeOrdersCount > 0) {
      throw new ConflictError("Завершите активные заказы перед закрытием смены", {
        code: "SHIFT_HAS_ACTIVE_ORDERS",
        details: { activeOrdersCount: metrics.activeOrdersCount },
      });
    }

    const closeAvailableAt = getCloseThreshold(shift.businessDate, shift.timeZone);

    if (now < closeAvailableAt) {
      throw new ConflictError("Закрытие смены доступно после 21:00 по сахалинскому времени", {
        code: "SHIFT_CLOSE_TOO_EARLY",
      });
    }

    return closeShift({
      shiftId: shift.id,
      now,
      closedByName: input.closedByName,
      closedByUserId: input.user.id,
      metrics,
      client,
    });
  });
}

export async function getDispatcherWorkspace(user: AuthenticatedApiUser, clock: Clock = systemClock): Promise<DispatcherWorkspaceDto> {
  if (!hasApiPermission(user, "manage_dispatcher_shift") && !hasApiPermission(user, "view_dispatcher_shifts")) {
    throw new ValidationError("У вашей роли нет доступа к диспетчерской");
  }

  const now = clock.now();
  const businessDate = getBusinessDate(now, BUSINESS_TIME_ZONE);
  const openAvailableAt = getOpenThreshold(now, BUSINESS_TIME_ZONE);
  const todayCloseAvailableAt = getCloseThreshold(businessDate, BUSINESS_TIME_ZONE);
  const [openShift, todayShift] = await Promise.all([
    getOpenShift(),
    getShiftByBusinessDate(businessDate),
  ]);
  const currentShift = openShift?.businessDate === businessDate ? openShift : null;
  const previousShift = openShift && openShift.businessDate !== businessDate ? openShift : null;
  const state = previousShift
    ? "PREVIOUS_SHIFT_OPEN"
    : currentShift
      ? "OPEN"
      : todayShift?.status === "CLOSED"
        ? "CLOSED"
        : "NOT_OPEN";
  const orders = currentShift ? await getShiftOrders(currentShift.id) : [];
  const groups = groupDispatcherOrders(orders);
  const shift = currentShift ?? todayShift ?? null;
  const closeAvailableAt = shift ? getCloseThreshold(shift.businessDate, shift.timeZone) : todayCloseAvailableAt;
  const canOpenShift = hasApiPermission(user, "manage_dispatcher_shift") && state === "NOT_OPEN" && now >= openAvailableAt;
  const canCloseShift = hasApiPermission(user, "manage_dispatcher_shift") &&
    state === "OPEN" &&
    now >= closeAvailableAt &&
    (currentShift?.activeOrdersCount ?? 0) === 0;

  return {
    clock: {
      serverNow: now.toISOString(),
      businessDate,
      businessTimeZone: BUSINESS_TIME_ZONE,
    },
    shift: {
      state,
      id: shift?.id ?? previousShift?.id ?? null,
      number: shift?.number ?? previousShift?.number ?? null,
      displayNumber: shift?.displayNumber ?? previousShift?.displayNumber ?? null,
      businessDate: shift?.businessDate ?? previousShift?.businessDate ?? businessDate,
      openedAt: shift?.openedAt ?? previousShift?.openedAt ?? null,
      closedAt: shift?.closedAt ?? previousShift?.closedAt ?? null,
      responsibleName: shift?.responsibleName ?? previousShift?.responsibleName ?? null,
      closedByName: shift?.closedByName ?? previousShift?.closedByName ?? null,
      canOpen: canOpenShift,
      canClose: canCloseShift,
      openAvailableAt: openAvailableAt.toISOString(),
      closeAvailableAt: closeAvailableAt.toISOString(),
      activeOrdersCount: shift?.activeOrdersCount ?? previousShift?.activeOrdersCount ?? 0,
      checksCount: shift?.checksCount ?? previousShift?.checksCount ?? 0,
      revenueCents: shift?.revenueCents ?? previousShift?.revenueCents ?? 0,
      cancelledOrdersCount: shift?.cancelledOrdersCount ?? previousShift?.cancelledOrdersCount ?? 0,
      ...(previousShift ? { previousShift } : {}),
    },
    orderGroups: groups,
    counts: {
      new: groups.new.length,
      inProgress: groups.inProgress.length,
      completed: groups.completed.length,
    },
    capabilities: {
      canCreateOrder: state === "OPEN" && canCreateOrders(user.role) && hasApiPermission(user, "manage_orders"),
      canOpenShift,
      canCloseShift,
      canCancelOrder: hasApiPermission(user, "cancel_orders"),
      canDeleteOrder: hasApiPermission(user, "delete_orders"),
    },
  };
}

export async function getDispatcherShiftHistory(user: AuthenticatedApiUser, limit = 30) {
  assertPermission(user, "view_dispatcher_shifts");

  return listShifts({ limit: Math.min(Math.max(limit, 1), 100) });
}

export async function getDispatcherShiftDetail(user: AuthenticatedApiUser, shiftId: number) {
  assertPermission(user, "view_dispatcher_shifts");

  const shift = await getShiftById(shiftId);

  if (!shift) {
    throw new ValidationError("Смена не найдена");
  }

  return {
    ...shift,
    orders: await getShiftOrders(shift.id),
  };
}

export function getShiftDisplayNumber(number: number) {
  return formatShiftNumber(number);
}
