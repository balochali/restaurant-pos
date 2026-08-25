import { ReactNode } from "react";
import { useAuth } from "../store/useAuth";
import { can, PermissionAction } from "../lib/permissions";

interface PermissionGateProps {
  action: PermissionAction;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Component wrapper that conditionally renders children based on the active user's permissions.
 */
export default function PermissionGate({ action, fallback = null, children }: PermissionGateProps) {
  const { user } = useAuth();

  const isAllowed = can(user?.role, action);

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
