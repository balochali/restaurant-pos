import { Role } from "./authService";

export type PermissionAction =
  | "void_order"
  | "apply_discount"
  | "manage_users"
  | "view_reports"
  | "manage_menu"
  | "manage_inventory"
  | "process_payment"
  | "create_order"
  | "view_kitchen_queue";

export const PERMISSION_MATRIX: Record<Role, PermissionAction[]> = {
  ADMIN: [
    "void_order",
    "apply_discount",
    "manage_users",
    "view_reports",
    "manage_menu",
    "manage_inventory",
    "process_payment",
    "create_order",
    "view_kitchen_queue",
  ],
  MANAGER: [
    "void_order",
    "apply_discount",
    "view_reports",
    "manage_menu",
    "manage_inventory",
    "process_payment",
    "create_order",
    "view_kitchen_queue",
  ],
  CASHIER: ["apply_discount", "process_payment", "create_order"],
  WAITER: ["create_order"],
  KITCHEN_STAFF: ["view_kitchen_queue", "manage_inventory"],
};

/**
 * Checks whether a given user role has permission to perform a specific action.
 */
export function can(role: Role | undefined, action: PermissionAction): boolean {
  if (!role) return false;
  const permissions = PERMISSION_MATRIX[role] || [];
  return permissions.includes(action);
}
