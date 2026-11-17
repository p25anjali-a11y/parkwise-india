import type { ReactNode } from "react";

export const metadata = { title: "Parkwise India", description: "Dynamic parking: know the price and the space before you leave." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
