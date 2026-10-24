import { SiteNav } from "@/components/nav/SiteNav";
import Footer from "@/components/Footer";
import RegistrationForm from "@/components/RegistrationForm";
import { Metadata } from "next";
import { REGISTRATIONS_OPEN } from "@/lib/registration";

export const metadata: Metadata = {
  title: "Register - REID XTREME 5.0",
};

export default function RegisterPage() {
  return (
    <>
      <SiteNav />
      <main className="w-full">
        {/* Side padding matches the footer so the two line up. */}
        <div className="grid min-h-screen [place-items:safe_center] px-4 pt-[calc(var(--nav-h)+clamp(2.5rem,8vh,5.5rem))] pb-[clamp(4rem,10vh,7rem)] md:px-[clamp(1rem,5vw,4.5rem)]">
          <RegistrationForm isOpen={REGISTRATIONS_OPEN} />
        </div>
      </main>
      <div className="px-4 pt-4 md:px-[clamp(1rem,5vw,4.5rem)] md:pt-[clamp(1rem,5vw,4.5rem)]">
        <Footer />
      </div>
    </>
  );
}
