import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import NavBar from "@/components/nav-bar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "RIS Dataset Builder",
  description: "Build training data for Regional Intent Segmentation",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NavBar />
        <main className="mx-auto max-w-5xl p-4">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
