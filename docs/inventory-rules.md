# Inventory Rules

This document describes current inventory behavior and the business rules that
must be preserved when changing stock, orders, incoming acts, writeoffs, or
inventory sessions.

## Core Rule

Inventory is a ledger-backed operational value:

1. Incoming acts increase stock.
2. Writeoff acts decrease stock.
3. Orders consume ingredients through technological cards.
4. Order cancellation does not currently return consumed stock.
5. Stock should not go negative as a business rule.
6. Every stock movement must be visible in history.

## Products

Each product has:

- `stockQuantity`
- `priceCents`
- `unit`
- optional category and description

`stockQuantity` is the current operational stock value used by orders,
incoming acts, writeoffs, and inventory sessions.

## Incoming Acts

Incoming act creation:

- Creates an incoming act and its item rows.
- Does not change product stock immediately.

Incoming act completion:

- Requires at least one item.
- Fails if any product from the act is no longer available.
- Increases each product stock by the item quantity.
- Updates product price using weighted average cost.
- Stores `stockQuantityBefore` and `stockQuantityAfter` on each act item.
- Marks the act as completed.
- Cannot be completed twice.

Deleting a completed incoming act:

- Subtracts each act item quantity from current product stock.
- Deletes the act.
- Current implementation does not prevent this reverse operation from making
  stock negative. Target business rule: deletion/reversal must not create
  negative stock.

## Writeoff Acts

Writeoff act creation:

- Creates a writeoff act and its item rows.
- Does not change product stock immediately.

Writeoff act completion:

- Requires at least one item.
- Fails if any product from the act is no longer available.
- Decreases each product stock by the item quantity.
- Stores `stockQuantityBefore` and `stockQuantityAfter` on each act item.
- Marks the act as completed.
- Cannot be completed twice.

Current implementation note:

- Completion currently subtracts quantities without an explicit insufficient
  stock check. Target business rule: writeoff completion must fail if it would
  make stock negative.

Deleting a completed writeoff act:

- Adds each item quantity back to current product stock.
- Deletes the act.

## Orders and Technological Cards

Order stock consumption happens when an order moves to `READY`.

Rules:

- Consumption happens only once per order.
- Consumption is calculated from catalog items connected to technological cards.
- Each technological card must have a positive output quantity.
- Each technological card must have ingredients.
- If an ingredient product is missing, the transition fails.
- If stock is insufficient, the transition fails.
- Product stock is decreased by required ingredient quantities.
- `OrderInventoryMovement` rows are created with:
  - order id
  - product id/name/unit
  - consumed quantity
  - movement type `CONSUME`
  - order status
  - reason
  - actor user id
  - stock before
  - stock after

Order cancellation:

- Does not currently return consumed stock.
- If an order was already moved to `READY`, cancellation keeps the stock
  movement history as-is.
- Any future return-stock workflow must be explicit and create reverse movement
  history.

## Inventory Sessions

Inventory session creation:

- Stores product snapshot quantities in session items.
- Does not change product stock immediately.

Saving actuals:

- Updates actual quantities on session items.
- Does not change product stock immediately.
- Cannot be done after the session is closed.

Closing an inventory session:

- Requires at least one item.
- Requires actual quantity for every item.
- Sets each product stock to the actual quantity.
- Marks the session as closed.
- Cannot be closed twice.

Deleting a closed inventory session:

- Reverts each product by adding the difference between snapshot and actual
  quantity to current stock.
- Clamps reverted product stock to `0` minimum.
- Deletes session items and the session.

## Negative Stock

Business rule:

- Product stock must not go below `0`.

Currently enforced:

- Product form validation rejects negative product stock.
- Order ingredient consumption fails before stock would go below `0`.
- Deleted closed inventory sessions clamp reverted stock to `0`.

Needs explicit enforcement:

- Writeoff completion should reject insufficient stock.
- Deleting/reversing completed incoming acts should reject a reversal that would
  make stock negative.

## Movement History

Visible stock history currently comes from:

- `OrderInventoryMovement` for order ingredient consumption.
- Incoming act items with stock before/after.
- Writeoff act items with stock before/after.
- Inventory session items with snapshot and actual quantities.
- `audit_log` for high-level user actions and before/after payloads.

Business rule:

- Every stock-changing operation must leave either movement rows, act/session
  rows with before/after values, or audit log entries sufficient to understand
  who changed what and when.
