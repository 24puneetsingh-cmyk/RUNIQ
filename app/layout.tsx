import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import PageTransition from "./components/PageTransition";

export const metadata: Metadata = {
  title: "RUNIQ – Who Runs UB",
  description: "The official basketball and pickleball ranking system at University at Buffalo. Real records. Real rankings. See who runs the court.",
  keywords: ["RUNIQ", "UB basketball", "UB pickleball", "University at Buffalo", "pickup basketball rankings", "who runs the court"],
  openGraph: {
    title: "RUNIQ – Who Runs UB",
    description: "Real records. Real rankings. Basketball and pickleball at UB.",
    url: "https://runiqub.vercel.app",
    siteName: "RUNIQ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RUNIQ – Who Runs UB",
    description: "Real records. Real rankings. Basketball and pickleball at UB.",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "rfLcJnk3Z-9vXRCCdcFKitjkSvct-h8TldJIYTpXAvc",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body suppressHydrationWarning>
          <PageTransition>
            {children}
          </PageTransition>
        </body>
      </html>
    </ClerkProvider>
  );
}