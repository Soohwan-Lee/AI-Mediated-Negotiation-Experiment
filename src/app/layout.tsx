import type { Metadata } from "next";
import { DevPanelMount } from "@/components/dev-panel-mount";
import { DevModeProvider } from "@/lib/dev-mode";
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
        {/*
          DevModeProvider wraps the participant context because the dev slot
          override feeds into it. Both are inert in a production build — see
          lib/dev-mode.
        */}
        <DevModeProvider>
          <ParticipantProvider>
            {children}
            <DevPanelMount />
          </ParticipantProvider>
        </DevModeProvider>
      </body>
    </html>
  );
}
