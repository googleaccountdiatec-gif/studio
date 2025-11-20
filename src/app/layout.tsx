import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { DataProvider } from "@/contexts/data-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KPI Insights",
  description: "A dashboard for visualizing KPI data from various sources.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          themes={['light', 'dark', 'rose', 'slate']}
          disableTransitionOnChange
        >
          <DataProvider>
            {children}
          </DataProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
