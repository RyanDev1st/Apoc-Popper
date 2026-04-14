import type { Metadata } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

const displayFont = Press_Start_2P({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const bodyFont = VT323({
  variable: "--font-body",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Quiz Survivors",
  description: "Retro multiplayer zombie survival with timed chest quizzes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
