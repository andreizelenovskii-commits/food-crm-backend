import { fetchClients } from "@backend/modules/clients/clients.service";
import { fetchCatalogItems } from "@backend/modules/catalog/catalog.service";
import { fetchEmployees } from "@backend/modules/employees/employees.service";
import { getProducts } from "@backend/modules/inventory/inventory.repository";
import {
  addOrderPackagingUsage,
  createOrder,
  getOrderById,
  getOrdersByClientId,
  getOrders,
  updateOrderStatus,
} from "@backend/modules/orders/orders.repository";
import type {
  KitchenOrderListItem,
  OrderCreateInput,
  OrderListItem,
  OrderStatus,
} from "@backend/modules/orders/orders.types";

const KITCHEN_ORDER_STATUSES: OrderStatus[] = ["SENT_TO_KITCHEN", "READY"];

export function sanitizeKitchenOrder(order: OrderListItem): KitchenOrderListItem {
  return {
    id: order.id,
    status: order.status,
    source: order.source,
    isInternal: order.isInternal,
    employeeId: order.employeeId,
    employeeName: order.employeeName,
    customerComment: order.customerComment,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      catalogItemId: item.catalogItemId,
      catalogItemVariantId: item.catalogItemVariantId,
      itemName: item.itemName,
      quantity: item.quantity,
      catalogCategory: item.catalogCategory,
      kitchenZone: item.kitchenZone,
      kitchenZones: item.kitchenZones,
      excludedIngredients: item.excludedIngredients,
      packagingUsages: item.packagingUsages,
    })),
  };
}

export async function fetchOrders(): Promise<OrderListItem[]> {
  return getOrders();
}

export async function fetchKitchenOrders(): Promise<KitchenOrderListItem[]> {
  const orders = await getOrders();

  return orders
    .filter((order) => KITCHEN_ORDER_STATUSES.includes(order.status))
    .map(sanitizeKitchenOrder);
}

export async function fetchOrdersByClientId(clientId: number): Promise<OrderListItem[]> {
  return getOrdersByClientId(clientId);
}

export async function fetchOrderCreateOptions() {
  const [clients, employees, catalogItems] = await Promise.all([
    fetchClients(),
    fetchEmployees(),
    fetchCatalogItems(),
  ]);

  return {
    clients,
    employees,
    catalogItems,
  };
}

export async function addOrder(input: OrderCreateInput) {
  return createOrder(input);
}

export async function fetchOrderById(orderId: number) {
  return getOrderById(orderId);
}

export async function updateOrderStatusById(
  orderId: number,
  status: OrderStatus,
  expectedCurrentStatus: OrderStatus,
  actorUserId?: number,
) {
  return updateOrderStatus(orderId, status, expectedCurrentStatus, actorUserId);
}

export async function fetchPackagingOptions() {
  const products = await getProducts();

  return products.filter((product) => product.category === "Упаковка" && product.kitchenZone);
}

export async function chooseOrderPackaging(input: {
  orderId: number;
  orderItemId: number;
  unitIndex: number;
  inputKitchenZone?: string;
  packageProductId: number;
  actorUserId?: number;
}) {
  return addOrderPackagingUsage(input);
}
