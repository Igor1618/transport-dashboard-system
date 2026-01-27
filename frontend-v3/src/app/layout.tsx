import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { QueryProvider } from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "TL196 - Экономика автопарка",
  description: "Система управления логистикой",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="flex min-h-screen">
        <QueryProvider>
          <Sidebar />
          <main className="flex-1 p-6 ml-64">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
