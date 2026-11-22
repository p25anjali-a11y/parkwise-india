import type { ReactNode } from "react";
import "./globals.css";
import { RegisterSW } from "../components/RegisterSW";
import { LangProvider } from "../components/I18n";
import { TabBar } from "../components/TabBar";
import { SiteNav } from "../components/SiteNav";
import { getLang } from "../lib/lang";

export const metadata = { title: "Parkwise India", description: "Dynamic parking: know the price and the space before you leave.", manifest: "/manifest.webmanifest" };
export const viewport = { themeColor: "#0b0d12", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { lang } = await getLang();
  return (
    <html lang={lang}>
      <body>
        <LangProvider lang={lang}>
          <SiteNav />
          {children}
          <TabBar />
        </LangProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
