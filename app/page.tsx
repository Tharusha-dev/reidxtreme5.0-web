import { Hero } from "@/components/hero/Hero";
import { AboutSection } from "@/components/AboutSection";
import { SiteNav } from "@/components/nav/SiteNav";
import { Timeline } from "@/components/timeline/Timeline";
import Footer from "@/components/Footer";
import Link from "next/link";
import Prizes from "@/components/Prizes/Prizes";
import SponsorsSection from "@/app/components/SponsorsSection";
import { ContactSection } from "@/components/ContactSection";
import { FAQSection } from "@/components/FAQSection";
import { REGISTRATIONS_OPEN } from "@/lib/registration";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="w-full">
        <Hero />
        <AboutSection />
        <Timeline />
        <Prizes />
        {/* <SponsorsSection /> */}
        <section className="relative isolate overflow-hidden py-[clamp(5rem,12vw,10rem)] text-center">
          <div className="relative z-1 mx-auto max-w-2xl px-6">
            <h2 className="mb-6 font-display text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.98] font-bold uppercase tracking-[0.025em] text-white">
              {REGISTRATIONS_OPEN ? "Ready to Cross the Chasm?" : "The Bridge Is Set"}
            </h2>
            <p className="mb-10 text-[clamp(1rem,2vw,1.15rem)] leading-relaxed text-muted">
              {REGISTRATIONS_OPEN
                ? "Assemble your team, take on the challenge, and compete for your share of the prize pool."
                : "Registrations are now closed. Registered teams, keep an eye on your inbox and the leaders' WhatsApp group as the Initial Round begins."}
            </p>
            <Link
              href={REGISTRATIONS_OPEN ? "/register" : "/#timeline"}
              className="btn-primary inline-flex h-auto min-h-13 items-center justify-center px-10 text-[clamp(0.68rem,3vw,0.8rem)] font-bold tracking-[0.06em] shadow-[0_0_15px_rgb(140_245_189/0.25)] transition-[box-shadow,transform] duration-300 hover:-translate-y-[2px] hover:shadow-[0_0_25px_rgb(140_245_189/0.4)]"
            >
              {REGISTRATIONS_OPEN ? "REGISTER NOW" : "VIEW THE TIMELINE"}
            </Link>
          </div>
        </section>
        <ContactSection />
        <FAQSection />
      </main>
      <div className="p-4 md:p-[clamp(1rem,5vw,4.5rem)]">
        <Footer />
      </div>
    </>
  );
}
