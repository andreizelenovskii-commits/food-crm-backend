import {
  createClient,
  deleteClient,
  getClientById,
  getClientByPhone,
  getAllClients,
  updateClient,
} from "@backend/modules/clients/clients.repository";
import type { Client } from "@backend/modules/clients/clients.types";
import type {
  CreateClientInput,
  UpdateClientInput,
} from "@backend/modules/clients/clients.validation";
import { attachLoyaltyToClient } from "@backend/modules/loyalty/loyalty.rules";

export async function fetchClients(): Promise<Client[]> {
  const clients = await getAllClients();
  return clients.map(attachLoyaltyToClient);
}

export async function addClient(input: CreateClientInput): Promise<Client> {
  return createClient(input);
}

export async function fetchClientById(clientId: number): Promise<Client | null> {
  const client = await getClientById(clientId);
  return client ? attachLoyaltyToClient(client) : null;
}

export async function fetchClientByPhone(phone: string): Promise<Client | null> {
  const client = await getClientByPhone(phone);
  return client ? attachLoyaltyToClient(client) : null;
}

export async function updateClientService(
  clientId: number,
  input: UpdateClientInput,
): Promise<Client | null> {
  return updateClient(clientId, input);
}

export async function deleteClientService(clientId: number): Promise<boolean> {
  return deleteClient(clientId);
}
