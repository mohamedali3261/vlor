import { ContactCTA } from "@/pages/Home/ContactCTA";
import { Featured } from "@/pages/Home/Featured";
import { Hero } from "@/pages/Home/Hero";
import { RunwayLookbook } from "@/pages/Home/RunwayLookbook";
import { useContent } from "@/hooks/useContent";

export function HomePage() {
  const { c } = useContent();

  return (
    <div key="home" className="anim-page">
      <Hero />
      {c.sections.runwayLookbook && <RunwayLookbook />}
      {c.sections.featured && <Featured />}
      {c.sections.contactCta && <ContactCTA />}
    </div>
  );
}
