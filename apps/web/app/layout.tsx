import type { ReactNode } from "react";
import { RegisterSW } from "../components/RegisterSW";

export const metadata = { title: "Parkwise India", description: "Dynamic parking: know the price and the space before you leave.", manifest: "/manifest.webmanifest" };
export const viewport = { themeColor: "#0f766e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
