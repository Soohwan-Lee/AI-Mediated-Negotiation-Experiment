/**
 * The raster illustrations, in one place.
 *
 * WHY A MANIFEST RATHER THAN INLINE PATHS. Three of these files are used from
 * more than one screen — the chat scene is step ④ of the Proxy flow AND step ②
 * of the Direct flow, and it must be the SAME FILE in both, because interface
 * rule 10 says the art draws the INTERFACE and never the condition. Two
 * separately generated "two people chatting" pictures would be a visible
 * difference between the arms that no design record accounts for, and it would
 * be exactly the kind of difference nobody notices until the images have
 * drifted. One key, one file.
 *
 * ALT TEXT NAMES THE SCENE, NEVER THE CONDITION. "Two people chatting at their
 * laptops", not "the Direct arm". Tasks are labelled "Task 1" and "Task 2" and
 * the condition name is never disclosed mid-study ("Things the participant must
 * never learn" #2); a screen reader is a screen, and alt text is copy.
 *
 * THE `?v=` SUFFIX IS NOT DECORATION. `next.config.ts` allowlists local images
 * as `{ pathname: "/illustrations/**", search: "?v=20260907b" }`, so a bare
 * path is REFUSED by the image optimizer at runtime. Keep the query on every
 * src here, and if the version string ever changes, change it in the config
 * first.
 *
 * The declared width/height are the generator's own pixel dimensions. They set
 * the aspect ratio `next/image` reserves space with; getting them wrong makes
 * every flow card jump as the raster loads.
 */

export type IllustrationKey =
  | "proxyStepBrief"
  | "proxyStepNegotiate"
  | "proxyStepResult"
  | "chat"
  | "directStepRead"
  | "directStepAgree"
  | "aiProxyPortrait";

export type Illustration = {
  /** Public path, including the `?v=` the image allowlist requires. */
  src: string;
  /** Describes the scene. Never names a condition, an arm or an outcome. */
  alt: string;
  width: number;
  height: number;
};

export const ILLUSTRATIONS: Record<IllustrationKey, Illustration> = {
  proxyStepBrief: {
    src: "/illustrations/proxy-step-brief.png?v=20260907b",
    alt: "One person at a desk talking to a small robot beside their laptop.",
    width: 1536,
    height: 1024,
  },
  proxyStepNegotiate: {
    src: "/illustrations/proxy-step-negotiate.png?v=20260907b",
    alt: "Two small robots facing each other across a table while two people watch.",
    width: 1536,
    height: 1024,
  },
  proxyStepResult: {
    src: "/illustrations/proxy-step-result.png?v=20260907b",
    alt: "Two people at their own laptops, each looking at the same blank card on screen.",
    width: 1536,
    height: 1024,
  },
  /**
   * SHARED between the two flow rows on purpose — see the file comment. Do not
   * split this into a proxy copy and a direct copy.
   */
  chat: {
    src: "/illustrations/chat.png?v=20260907b",
    alt: "Two people chatting at their laptops, with blank speech bubbles between them.",
    width: 1536,
    height: 1024,
  },
  directStepRead: {
    src: "/illustrations/direct-step-read.png?v=20260907b",
    alt: "One person at a desk reading a sheet of paper with blank blocks on it.",
    width: 1536,
    height: 1024,
  },
  directStepAgree: {
    src: "/illustrations/direct-step-agree.png?v=20260907b",
    alt: "Two people at one table looking at a single blank card between them.",
    width: 1536,
    height: 1024,
  },
  aiProxyPortrait: {
    src: "/illustrations/ai-proxy-portrait.png?v=20260907b",
    alt: "A small friendly robot.",
    width: 512,
    height: 512,
  },
};
