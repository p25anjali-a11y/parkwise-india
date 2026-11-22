import type { ReactNode } from "react";
import { OpSidebar } from "../../components/OpSidebar";

/** Operator console: sidebar on desktop, the bottom tab bar on phones. */
export default function OperatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="opshell">
      <OpSidebar />
      <div className="opmain">{children}</div>
    </div>
  );
}
