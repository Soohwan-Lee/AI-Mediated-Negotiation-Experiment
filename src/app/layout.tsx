import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";
import { DevPanelMount } from "@/components/dev-panel-mount";
import { NavigationGuard } from "@/components/navigation-guard";
import { StudyChrome } from "@/components/study-chrome";
import { DevModeProvider } from "@/lib/dev-mode";
import { ParticipantProvider } from "@/lib/participant-context";
import { STUDY } from "@/lib/study-config";
import "./globals.css";

/**
 * IBM Plex across three roles: sans for the interface, serif for the long
 * instructional prose participants actually have to read, mono for points and
 * codes that must align. One family, so the document character stays coherent.
 */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-plex-serif",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: STUDY.title,
  description: "An online research study on workplace negotiation.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${plexSans.variable} ${plexSerif.variable} ${plexMono.variable}`}
    >
      <body className="min-h-screen">
        {/*
          DevModeProvider wraps the participant context because the dev slot
          override feeds into it. Both are inert in a production build — see
          lib/dev-mode.
        */}
        <DevModeProvider>
          <ParticipantProvider>
            <NavigationGuard />
            <StudyChrome>{children}</StudyChrome>
            <DevPanelMount />
          </ParticipantProvider>
        </DevModeProvider>
      </body>
    </html>
  );
}
