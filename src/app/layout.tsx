import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MathsMock — Year 10 Maths Paper 1",
  description: "Year 10 Mathematics mock tests, progress tracking, and teacher feedback.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
