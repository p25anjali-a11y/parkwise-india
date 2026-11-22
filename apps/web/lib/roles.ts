export type Role = "driver" | "operator" | "operator_admin" | "platform_admin";

/** Which area each role may open. Enforced here for UX; RLS is the real security boundary. */
export function canAccess(role: Role | null, area: "driver" | "find" | "operator" | "admin"): boolean {
  if (!role) return false;
  if (area === "driver") return true;
  // Find parking, lot pages, trips and rewards: every account has a driver view of its own, except platform admins.
  if (area === "find") return role === "driver" || role === "operator" || role === "operator_admin";
  if (area === "operator") return role === "operator" || role === "operator_admin" || role === "platform_admin";
  return role === "platform_admin";
}

export function homeFor(role: Role | null): string {
  if (role === "platform_admin") return "/admin";
  if (role === "operator" || role === "operator_admin") return "/operator";
  return "/search";
}
