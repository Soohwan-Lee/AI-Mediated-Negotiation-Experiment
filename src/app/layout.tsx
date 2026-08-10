import type { Metadata } from "next";
import { ParticipantProvider } from "@/lib/participant-context";
import { STUDY } from "@/lib/study-config";
import "./globals.css";

export const metadata: Metadata = {
  title: STUDY.title,
  description: "An online research study on workplace negotiation.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ParticipantProvider>{children}</ParticipantProvider>
      </body>
    </html>
  );
}
