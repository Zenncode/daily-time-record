import type { Metadata } from "next";
import "./globals.css";
import "./responsive.css";

export const metadata: Metadata = {
  title: "Daymark — Daily Time Record",
  description: "Attendance tracking and daily time records.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
