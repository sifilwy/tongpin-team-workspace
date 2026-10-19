import type { Metadata, Viewport } from "next";
import "./globals.css";
import TeamAccess from "./components/TeamAccess";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  applicationName: "同频",
  appleWebApp: { capable: true, title: "同频", statusBarStyle: "default" },
  other: { "apple-mobile-web-app-capable": "yes" },
  title: "同频｜儿陪师咨询团队协作",
  description: "五人团队的任务分配、进度协作与沟通记录工作台",
  openGraph: { title: "同频｜儿陪师咨询团队协作", description: "五人团队的任务分配、进度协作与沟通记录工作台", images: ["/og.png"] },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/app-icon-192.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f5f4fa" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><TeamAccess>{children}</TeamAccess></body></html>;
}
