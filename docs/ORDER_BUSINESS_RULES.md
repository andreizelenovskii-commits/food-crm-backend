# Order Business Rules

This document describes the current order behavior implemented by the backend.
It is the source of truth for changing order workflow, pricing, and stock rules.

## Statuses

Allowed order statuses:

- `SENT_TO_KITCHEN` - sent to kitchen, initial status for CRM-created orders.
- `READY` - kitchen marked the order ready.
- `PACKED` - dispatcher marked the order packed.
- `DELIVERED_PAID` - courier marked the order delivered and paid.
- `CANCELLED` - order was cancelled.

Closed statuses:

- `DELIVERED_PAID`
- `CANCELLED`

Closed orders cannot be advanced or cancelled again.

## Allowed Transitions

The normal path is linear:

```text
SENT_TO_KITCHEN -> READY -> PACKED -> DELIVERED_PAID
```

Allowed cancellation path:

```text
SENT_TO_KITCHEN -> CANCELLED
READY -> CANCELLED
PACKED -> CANCELLED
```

Forbidden transitions:

- Any transition from `DELIVERED_PAID`.
- Any transition from `CANCELLED`.
- Skipping stages, for example `SENT_TO_KITCHEN -> PACKED`.
- Moving backwards, for example `PACKED -> READY`.
- Moving to any status outside the Prisma `OrderStatus` enum.

## Stock Consumption

Stock is consumed when an order moves to `READY`.

Rules:

- Consumption happens only once per order.
- Consumption is based on catalog items connected to technological cards.
- Each tech card must have valid output quantity and ingredients.
- If a required ingredient is missing or stock is insufficient, the transition fails.
- `OrderInventoryMovement` rows are written with before/after stock values.
- `CANCELLED` does not currently return consumed stock.

## Cancellation

Cancellation is allowed only for active orders:

- `SENT_TO_KITCHEN`
- `READY`
- `PACKED`

Cancellation is not allowed after:

- `DELIVERED_PAID`
- `CANCELLED`

Current behavior: cancellation changes the order status and writes audit log.
It does not reverse stock movements that were already consumed at `READY`.

## Editing Orders

Current backend API supports creating orders and changing status.
It does not expose an order edit route after creation.

Business rule: editing an order after it has been sent to kitchen should remain
blocked until a dedicated edit workflow defines stock, kitchen, and audit impact.

## Delivery

Default delivery fee:

```text
17000 cents = 170 RUB
```

Rules:

- Internal orders always have delivery fee `0`.
- Non-internal orders use the submitted delivery fee only if the actor can adjust delivery.
- Only `admin` and `Управляющий` can adjust delivery fee.
- Other allowed order creators use the default delivery fee.
- Delivery fee is clamped to `0` or above before pricing.

## Discount and Loyalty

Pricing supports a discount percent on non-internal orders.

Rules:

- Internal orders ignore discount.
- Discount percent is clamped to the range `0..100`.
- Discount is calculated from item subtotal only.
- Delivery is added after discount.
- Total cannot go below `0` before delivery is added.

## Permissions

Order creation:

- `admin`
- `Управляющий`
- `Диспетчер`

Delivery adjustment:

- `admin`
- `Управляющий`

Status ownership:

- `SENT_TO_KITCHEN -> READY`: `Повар`
- `READY -> PACKED`: `Диспетчер`
- `PACKED -> DELIVERED_PAID`: `Курьер`

Managers can advance any active order stage:

- `admin`
- `Управляющий`

Cancellation:

- `admin`
- `Управляющий`
- `Диспетчер`
