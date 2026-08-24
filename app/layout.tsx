import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "同频｜儿陪师咨询团队协作",
  description: "五人团队的任务分配、进度协作与沟通记录工作台",
  openGraph: { title: "同频｜儿陪师咨询团队协作", description: "五人团队的任务分配、进度协作与沟通记录工作台", images: ["/og.png"] },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
