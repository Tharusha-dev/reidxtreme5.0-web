"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "motion/react";
import { REID_LOGO } from "@/components/brand";
import { REGISTRATIONS_OPEN } from "@/lib/registration";

const LINKS = [
  { id: "about", label: "About" },
  { id: "timeline", label: "Timeline" },
  { id: "prizes", label: "Prizes" },
  { id: "contact", label: "Contact" },
  { id: "faq", label: "FAQ" },
];
const REGISTER = {
  href: "/register",
  label: REGISTRATIONS_OPEN ? "Connect & Register" : "Registrations Closed",
};
const SECTION_IDS = LINKS.map((link) => link.id);

/** The linked section crossing the middle of the viewport, if any (§17). */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          setActive((a) => (entry.isIntersecting ? id : a === id ? null : a));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const id of ids) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const active = useActiveSection(SECTION_IDS);

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onDesktop = () => desktop.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onDesktop);
    return () => {
      window.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [open]);

  const solid = scrolled || open;

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed inset-x-0 top-0 z-10 border-b transition-[background-color,border-color,backdrop-filter] duration-300 ${solid
        ? "border-mint/15 bg-panel backdrop-blur-md"
        : "border-transparent bg-transparent"
        }`}
    >
      <div className="mx-auto flex h-(--nav-h) w-[min(92%,var(--container-page))] items-center justify-between">
        <Link href="/" className="-m-1 rounded-sm p-1">
          <Image
            {...REID_LOGO}
            alt="REID XTREME 5.0"
            className="h-10 w-auto md:h-12"
            sizes="80px"
            loading="eager"
          />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex xl:gap-10">
          {LINKS.map((link) => (
            <Link
              key={link.id}
              href={`/#${link.id}`}
              aria-current={active === link.id ? "true" : undefined}
              className="nav-link"
            >
              {link.label}
            </Link>
          ))}
          <Link href={REGISTER.href} className="btn-primary">
            {REGISTER.label}
          </Link>
        </nav>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="relative grid size-10 place-items-center rounded-md border border-line bg-bg/40 lg:hidden"
        >
          <span
            aria-hidden
            className={`absolute h-px w-[18px] bg-white transition-transform duration-300 ease-standard ${open ? "rotate-45" : "-translate-y-[3px]"
              }`}
          />
          <span
            aria-hidden
            className={`absolute h-px w-[18px] bg-white transition-transform duration-300 ease-standard ${open ? "-rotate-45" : "translate-y-[3px]"
              }`}
          />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="site-menu"
            aria-label="Primary"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="border-t border-mint/10 lg:hidden"
          >
            <div className="mx-auto flex w-[min(92%,var(--container-page))] flex-col gap-1 py-4">
              {LINKS.map((link) => (
                <Link
                  key={link.id}
                  href={`/#${link.id}`}
                  aria-current={active === link.id ? "true" : undefined}
                  onClick={() => setOpen(false)}
                  className="nav-link py-3"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={REGISTER.href}
                onClick={() => setOpen(false)}
                className="btn-primary mt-3"
              >
                {REGISTER.label}
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
