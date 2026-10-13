import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "TAD Logistics";

export const metadata: Metadata = {
  title: `${companyName} Recruitment Agent`,
  description: `${companyName} recruitment agent: job openings, CV import and AI-assisted candidate ranking`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
