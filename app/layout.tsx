import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEO GrowthLead — AI Visibility Platform",
  description:
    "Free AEO and GEO audit: see how ready your website is to be crawled, understood and cited by ChatGPT, Claude, Perplexity, Gemini and Google AI Overviews.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
