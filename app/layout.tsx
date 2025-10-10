import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Leach Family Budget",
    template: "%s | Family Budget",
  },
  applicationName: "Family Budget",
  description:
    "Plan, track, and review your household spending from anywhere, even offline.",

  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Leach Family Budget",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-icon-180x180.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`min-h-screen bg-gradient-to-br from-[#f5f4ff] via-[#fff2f4] to-[#f0fbff] dark:from-[#05060f] dark:via-[#0c1224] dark:to-[#162036] text-slate-900 dark:text-slate-100 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
