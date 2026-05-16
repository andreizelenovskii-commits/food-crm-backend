import { fetchClients } from "@backend/modules/clients/clients.service";
import { fetchCatalogItems } from "@backend/modules/catalog/catalog.service";
import { fetchEmployees } from "@backend/modules/employees/employees.service";
import {
  createOrder,
  getOrderById,
  getOrdersByClientId,
  getOrders,
  updateOrderStatus,
} from "@backend/modules/orders/orders.repository";
import type {
  OrderCreateInput,
  OrderListItem,
  OrderStatus,
} from "@backend/modules/orders/orders.types";

export async function fetchOrders(): Promise<OrderListItem[]> {
  return getOrders();
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
  actorUserId?: number,
) {
  return updateOrderStatus(orderId, status, actorUserId);
}
