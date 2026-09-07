import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroVideoScrub } from "@/components/landing/HeroVideoScrub";
import { MarqueeBar } from "@/components/landing/MarqueeBar";
import { NarrativeSection } from "@/components/landing/NarrativeSection";
import {
  SectionSilsilah,
  SectionKenangan,
  SectionChat,
  SectionWarisan,
  SectionTaaruf,
} from "@/components/landing/FeatureSections";
import {
  StatsSection,
  CTASection,
  LandingFooter,
} from "@/components/landing/StatsAndCTA";

export default function LandingPage() {
  return (
    <main
      style={{
        background: "var(--ck-bg)",
        color: "var(--ck-paper)",
        fontFamily: "var(--font-body)",
        overflowX: "hidden",
      }}
    >
      {/* Fixed navbar */}
      <LandingNavbar />

      {/* 1. Hero — video scrub, 280vh */}
      <HeroVideoScrub />

      {/* 2. Marquee bar */}
      <MarqueeBar />

      {/* 3. Narasi pembuka — cinematic dark */}
      <NarrativeSection />

      {/* 4–8. Feature sections */}
      <div style={{ background: "var(--ck-bg)" }}>
        <SectionSilsilah />
        <SectionKenangan />
        <SectionChat />
        <SectionWarisan />
        <SectionTaaruf />
      </div>

      {/* 9. Stats counter */}
      <StatsSection />

      {/* 10. CTA + Footer */}
      <CTASection />
      <LandingFooter />
    </main>
  );
}
