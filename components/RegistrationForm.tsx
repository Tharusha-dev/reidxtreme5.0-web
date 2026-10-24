"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SubmitEvent,
} from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import CustomSelect from "@/components/CustomSelect";
import RegistrationDialog, { type RegistrationResult } from "@/components/RegistrationDialog";
import { TransitionOverlay } from "@/components/TransitionOverlay";
import { useHydrated } from "@/hooks/useHydrated";
import { cx } from "@/lib/cx";
import {
  MAX_TEAM_SIZE,
  MIN_TEAM_SIZE,
  YEARS,
  blankMember,
  memberError,
  normalizeRegNumber,
  teamError,
  type Member,
  type RegistrationSubmission,
} from "@/lib/registration";
import { clearDraft, loadDraft, saveDraft } from "@/lib/registrationDraft";

type RegistrationFormProps = {
  // When false, the form is shown greyed out behind a "registrations closed" overlay.
  isOpen: boolean;
};

// Form building blocks, styled after DESIGN.md §16 and §25.
const FIELD = "grid min-w-0 gap-[0.5rem]";
const FIELD_LABEL = "text-[0.68rem] font-semibold tracking-[0.12em] text-muted uppercase";
const FIELD_HINT = "text-[0.68rem] text-muted/75";
const CONTROL =
  "block min-h-[2.9rem] w-full min-w-0 rounded-sm border border-line bg-bg/65 px-[0.85rem] py-[0.72rem] font-sans text-[0.9rem] leading-[1.4] text-body transition-[border-color,box-shadow] duration-180 placeholder:text-muted/55 focus:border-mint focus:shadow-[0_0_12px_rgb(140_245_189/0.25)] user-invalid:border-[#ffb4a8]/70";
const CARD = "grid min-w-0 gap-[0.85rem] rounded-md border border-emerald/28 bg-bg/42 p-[0.9rem]";
const CARD_HEADING =
  "m-0 font-display text-[0.9rem] font-semibold tracking-[0.1em] text-mint uppercase";
// DESIGN.md §16 secondary button.
const BUTTON_SECONDARY =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[6px] border border-mint/45 bg-bg/65 px-4 text-[0.72rem] font-semibold tracking-[0.06em] text-body uppercase transition-[border-color,box-shadow,transform] duration-150 ease-standard hover:-translate-y-px hover:border-mint hover:shadow-[0_0_14px_rgb(140_245_189/0.25)] disabled:pointer-events-none disabled:opacity-50";
const SMALL_BUTTON =
  "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-sm border px-2.5 text-[0.62rem] font-semibold tracking-[0.1em] uppercase transition-[border-color,background-color,color,box-shadow,transform] duration-150 hover:-translate-y-px";
const ERROR_TONE = "text-[#ffb4a8]";
const NOTICE = "rounded-md border px-3 py-2.5 text-[0.78rem] leading-relaxed";
const EASE = [0.22, 1, 0.36, 1] as const;

type Step = { key: string; label: string; title: string };

// Team, leader, one step per extra member, then review.
function buildSteps(memberCount: number): Step[] {
  return [
    { key: "team", label: "Team", title: "Assemble your team" },
    { key: "leader", label: "Leader", title: "Team leader" },
    ...Array.from({ length: memberCount }, (_, index) => ({
      key: `member-${index + 2}`,
      label: `Member ${index + 2}`,
      title: `Member ${String(index + 2).padStart(2, "0")}`,
    })),
    { key: "review", label: "Review", title: "Review & confirm" },
  ];
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className={cx("size-3.5 flex-none", direction === "left" && "rotate-180")}
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="M2 8h11M9 3.5 13.5 8 9 12.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

type ChoiceGroupProps = {
  legend: string;
  hint?: string;
  name: string;
  options: readonly { label: string; value: string; srLabel: string }[];
  value: string;
  onChange: (value: string) => void;
};

// A row of radio tiles. Native radios keep arrow-key support and the
// browser's "required" check.
function ChoiceGroup({ legend, hint, name, options, value, onChange }: ChoiceGroupProps) {
  return (
    <fieldset className="m-0 grid min-w-0 gap-[0.4rem] border-0 p-0">
      <legend className={cx(FIELD_LABEL, "mb-[0.4rem] p-0")}>
        {legend}{" "}
        {hint && <span className="font-normal tracking-[0.04em] normal-case">{hint}</span>}
      </legend>
      <div className="grid grid-cols-4 gap-[0.5rem]">
        {options.map((option, index) => (
          <label className="relative min-w-0 cursor-pointer" key={option.value}>
            <input
              aria-label={option.srLabel}
              checked={value === option.value}
              className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-sm"
              name={name}
              onChange={() => onChange(option.value)}
              required={index === 0}
              type="radio"
              value={option.value}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none grid min-h-[2.9rem] place-items-center rounded-sm border border-line bg-bg/65 px-1 text-center font-display text-[1.05rem] leading-tight font-bold tracking-[0.06em] text-muted transition-[border-color,background-color,color,box-shadow] duration-150 ease-standard peer-checked:border-mint peer-checked:bg-mint/12 peer-checked:text-mint peer-checked:shadow-[0_0_12px_rgb(140_245_189/0.25)] peer-hover:border-mint/70 peer-hover:text-body peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mint"
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const YEAR_OPTIONS = YEARS.map((year) => ({ label: `Year ${year}`, value: year }));

const TEAM_SIZE_OPTIONS = Array.from(
  { length: MAX_TEAM_SIZE - MIN_TEAM_SIZE + 1 },
  (_, index) => {
    const size = String(MIN_TEAM_SIZE + index);
    return { label: size, value: size, srLabel: `${size} member${size === "1" ? "" : "s"}` };
  },
);

type MemberFieldsProps = {
  fieldId: string;
  member: Member;
  emailHint?: string;
  onChange: (field: keyof Member, value: string) => void;
};

function MemberFields({ fieldId, member, emailHint, onChange }: MemberFieldsProps) {
  return (
    <div className="grid min-w-0 gap-[1.35rem]">
      <div className={FIELD}>
        <label className={FIELD_LABEL} htmlFor={`${fieldId}-name`}>
          Full name
        </label>
        <input
          autoComplete="off"
          className={CONTROL}
          id={`${fieldId}-name`}
          maxLength={100}
          onChange={(event) => onChange("name", event.target.value)}
          placeholder="Full name"
          required
          value={member.name}
        />
      </div>

      {/* A dropdown rather than tiles, so it can't be mistaken for the team size picker. */}
      <div className={FIELD}>
        <span className={FIELD_LABEL} id={`${fieldId}-year-label`}>
          Year of study
        </span>
        <CustomSelect
          id={`${fieldId}-year`}
          labelId={`${fieldId}-year-label`}
          name={`${fieldId}-year`}
          onChange={(value) => onChange("year", value)}
          options={YEAR_OPTIONS}
          placeholder="Select your year"
          required
          value={member.year}
        />
      </div>

      <div className={FIELD}>
        <label className={FIELD_LABEL} htmlFor={`${fieldId}-email`}>
          Email address
        </label>
        <input
          aria-describedby={emailHint ? `${fieldId}-email-hint` : undefined}
          autoCapitalize="none"
          autoComplete="off"
          className={CONTROL}
          id={`${fieldId}-email`}
          maxLength={254}
          onChange={(event) => onChange("email", event.target.value.trim())}
          placeholder="name@example.com"
          required
          spellCheck={false}
          type="email"
          value={member.email}
        />
        {emailHint && (
          <span className={FIELD_HINT} id={`${fieldId}-email-hint`}>
            {emailHint}
          </span>
        )}
      </div>

      <div className={FIELD}>
        <label className={FIELD_LABEL} htmlFor={`${fieldId}-whatsapp`}>
          WhatsApp number
        </label>
        <input
          aria-describedby={`${fieldId}-whatsapp-hint`}
          autoComplete="off"
          className={CONTROL}
          id={`${fieldId}-whatsapp`}
          inputMode="numeric"
          maxLength={10}
          // Digits only, so the value can only ever take the 0771234567 shape.
          onChange={(event) => onChange("whatsapp", event.target.value.replace(/\D/g, ""))}
          pattern="0[0-9]{9}"
          placeholder="0771234567"
          required
          title="10 digits starting with 0, e.g. 0771234567"
          type="tel"
          value={member.whatsapp}
        />
        <span className={FIELD_HINT} id={`${fieldId}-whatsapp-hint`}>
          10 digits, starting with 0.
        </span>
      </div>

      <div className={FIELD}>
        <label className={FIELD_LABEL} htmlFor={`${fieldId}-registration`}>
          Registration number
        </label>
        <input
          aria-describedby={`${fieldId}-registration-hint`}
          autoCapitalize="none"
          autoComplete="off"
          className={CONTROL}
          id={`${fieldId}-registration`}
          maxLength={40}
          // Letters, digits and "/" only, e.g. 2022cs001 or EG/2022/1234.
          onChange={(event) =>
            onChange("registrationNumber", event.target.value.replace(/[^A-Za-z0-9/]/g, ""))
          }
          pattern="[A-Za-z0-9/]+"
          placeholder="2022cs001"
          required
          spellCheck={false}
          title="Letters, numbers and /, e.g. 2022cs001"
          value={member.registrationNumber}
        />
        <span className={FIELD_HINT} id={`${fieldId}-registration-hint`}>
          Letters, numbers and / only.
        </span>
      </div>

      <div className={FIELD}>
        <label className={FIELD_LABEL} htmlFor={`${fieldId}-ieee`}>
          IEEE membership number{" "}
          <span className="font-normal tracking-[0.04em] normal-case">(optional)</span>
        </label>
        <input
          aria-describedby={`${fieldId}-ieee-hint`}
          autoComplete="off"
          className={CONTROL}
          id={`${fieldId}-ieee`}
          inputMode="numeric"
          maxLength={12}
          onChange={(event) => onChange("ieeeMembership", event.target.value.replace(/\D/g, ""))}
          pattern="[0-9]{6,12}"
          placeholder="101597523"
          title="Digits only, e.g. 101597523"
          value={member.ieeeMembership}
        />
        <span className={FIELD_HINT} id={`${fieldId}-ieee-hint`}>
          Leave blank if you&apos;re not an IEEE member.
        </span>
      </div>
    </div>
  );
}

type StepperProps = {
  steps: Step[];
  current: number;
  // Furthest step that can be opened; every step before it is complete.
  reachable: number;
  onSelect: (index: number) => void;
};

// Phones: a segmented progress bar, like deck sections laid across the chasm.
function ProgressBar({ steps, current, reachable, onSelect }: StepperProps) {
  return (
    <nav aria-label="Registration steps" className="lg:hidden">
      <ol className="m-0 flex list-none gap-[0.35rem] p-0">
        {steps.map((step, index) => {
          const isCurrent = index === current;
          const isDone = !isCurrent && index < reachable;
          const canOpen = !isCurrent && index <= reachable;

          return (
            <li className="min-w-0 flex-1" key={step.key}>
              <button
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${step.label}${isDone ? " (complete)" : ""}`}
                className={cx(
                  "group grid w-full min-w-0 gap-[0.45rem] py-1 text-left",
                  canOpen ? "cursor-pointer" : "cursor-default",
                )}
                disabled={!canOpen}
                onClick={() => onSelect(index)}
                type="button"
              >
                <span
                  className={cx(
                    "block h-[3px] rounded-full transition-[background-color,box-shadow] duration-300 ease-standard",
                    isCurrent
                      ? "bg-mint shadow-[0_0_10px_rgb(140_245_189/0.7)]"
                      : isDone
                        ? "bg-emerald group-hover:bg-mint"
                        : "bg-line/35",
                  )}
                />
                <span
                  className={cx(
                    "hidden truncate text-[0.6rem] font-semibold tracking-[0.1em] uppercase transition-colors duration-150 sm:block",
                    isCurrent
                      ? "text-mint"
                      : isDone
                        ? "text-body group-hover:text-mint"
                        : "text-muted/55",
                  )}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 16 16">
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

// Desktop: the steps as a vertical route, each showing what's been entered so far.
function StepList({
  steps,
  current,
  reachable,
  onSelect,
  summaries,
}: StepperProps & { summaries: string[] }) {
  return (
    <nav aria-label="Registration steps">
      <ol className="m-0 grid list-none p-0">
        {steps.map((step, index) => {
          const isCurrent = index === current;
          const isDone = !isCurrent && index < reachable;
          const canOpen = !isCurrent && index <= reachable;
          const status = isCurrent ? "In progress" : isDone ? "Complete" : "Not started";

          return (
            <li className="relative pb-[1.1rem] last:pb-0" key={step.key}>
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cx(
                    "absolute top-[2.35rem] bottom-[0.3rem] left-[calc(1rem-0.5px)] w-px transition-colors duration-300",
                    index < reachable ? "bg-emerald/70" : "bg-line/30",
                  )}
                />
              )}
              <button
                aria-current={isCurrent ? "step" : undefined}
                className={cx(
                  "group flex w-full min-w-0 items-center gap-[0.9rem] text-left",
                  canOpen ? "cursor-pointer" : "cursor-default",
                )}
                disabled={!canOpen}
                onClick={() => onSelect(index)}
                type="button"
              >
                <span
                  className={cx(
                    "grid size-8 flex-none place-items-center rounded-full border font-display text-[0.85rem] font-bold transition-[border-color,background-color,color,box-shadow] duration-300 ease-standard",
                    isCurrent
                      ? "border-mint bg-mint/12 text-mint shadow-[0_0_14px_rgb(140_245_189/0.45)]"
                      : isDone
                        ? "border-emerald/80 bg-emerald/15 text-mint group-hover:border-mint"
                        : "border-line/45 text-muted/55",
                  )}
                >
                  {isDone ? <CheckIcon /> : String(index + 1).padStart(2, "0")}
                </span>
                <span className="grid min-w-0 gap-[0.1rem]">
                  <span
                    className={cx(
                      "truncate text-[0.72rem] font-semibold tracking-[0.12em] uppercase transition-colors duration-150",
                      isCurrent
                        ? "text-mint"
                        : isDone
                          ? "text-white group-hover:text-mint"
                          : "text-muted/60",
                    )}
                  >
                    {step.label}
                  </span>
                  <span
                    className={cx(
                      "truncate text-[0.78rem]",
                      isCurrent || isDone ? "text-muted" : "text-muted/45",
                    )}
                  >
                    {summaries[index] || status}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type RegistrationLayoutProps = {
  headingId: string;
  isOpen: boolean;
  // Step details shown under the heading on desktop.
  aside: ReactNode;
  panel: ReactNode;
};

// Desktop: the heading, the current step and the route on the left, the form
// on the right. Phones: the heading stacked above the form.
function RegistrationLayout({ headingId, isOpen, aside, panel }: RegistrationLayoutProps) {
  return (
    <div className="grid items-start gap-x-[clamp(3rem,7vw,7rem)] gap-y-[clamp(1.75rem,5vw,2.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
      <aside className="grid min-w-0 gap-[clamp(1.75rem,3vw,2.5rem)] lg:sticky lg:top-[calc(var(--nav-h)+2.5rem)]">
        <header className="mx-auto grid max-w-[34rem] gap-[0.9rem] text-center lg:mx-0 lg:text-left">
          <p className="m-0 text-xs leading-snug font-semibold tracking-[0.12em] text-mint uppercase">
            ReidXtreme 5.0 · Team registration
          </p>
          <h2
            className="m-0 font-display text-[clamp(2.75rem,6vw,5rem)] leading-[0.95] font-bold tracking-[0.025em] text-balance text-white uppercase"
            id={headingId}
          >
            {isOpen ? (
              <>
                Register <span className="text-mint text-glow">now!</span>
              </>
            ) : (
              <>
                Registrations <span className="text-mint text-glow">closed</span>
              </>
            )}
          </h2>
          <p className="m-0 text-[clamp(0.875rem,1.5vw,1rem)] leading-relaxed text-muted">
            {isOpen ? (
              <>
                Teams of up to {MAX_TEAM_SIZE}, leader included. Have everyone&apos;s email,
                registration and WhatsApp numbers ready. It takes about five minutes.
              </>
            ) : (
              <>
                The bridge is set and every team is on the path. Thank you to everyone who
                registered for ReidXtreme 5.0.
              </>
            )}
          </p>
          <div
            className={cx(
              NOTICE,
              "flex items-start gap-2.5 border-mint/30 bg-mint/6 text-left text-body",
            )}
            role="note"
          >
            <svg
              aria-hidden="true"
              className="mt-0.5 size-4 flex-none text-mint"
              fill="none"
              viewBox="0 0 16 16"
            >
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M8 7v4M8 4.75v.5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.6"
              />
            </svg>
            {isOpen ? (
              <p className="m-0">
                <span className="font-semibold text-mint">Please note:</span> Only{" "}
                <span className="font-medium text-white">UCSC</span> (University of Colombo School
                of Computing) undergraduates are eligible to participate.
              </p>
            ) : (
              <p className="m-0">
                <span className="font-semibold text-mint">Already registered?</span> Watch the
                official Team Leaders&rsquo; WhatsApp group and your inbox for Initial Round
                instructions.
              </p>
            )}
          </div>
        </header>
        {isOpen && aside}
      </aside>

      <div className="relative mx-auto w-full max-w-[34rem] min-w-0 rounded-lg border border-line bg-panel shadow-[0_20px_55px_rgb(0_0_0/0.3),inset_0_1px_rgb(245_250_247/0.035)] backdrop-blur-md lg:mx-0">
        {!isOpen && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-bg/40 backdrop-blur-[3px]">
            <div className="relative mx-4 flex flex-col items-center justify-center rounded-xl border border-mint/30 bg-panel/90 p-8 text-center shadow-[0_0_40px_rgb(140_245_189/0.15)] backdrop-blur-md">
              {/* Corner ticks, echoing the registration dialog. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-2 rounded-lg border border-dashed border-mint/12"
              />
              <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-mint uppercase">
                Path sealed
              </p>
              <h3 className="mt-2 font-display text-xl font-bold tracking-[0.1em] text-white md:text-2xl">
                REGISTRATIONS
              </h3>
              <p className="mt-1 font-display text-2xl font-bold tracking-[0.05em] text-mint text-glow md:text-3xl">
                CLOSED
              </p>
              <p className="mt-4 max-w-[22rem] text-sm leading-relaxed text-muted">
                The bridge has been raised. Follow the timeline as the competition unfolds.
              </p>
              <Link
                className="btn-primary mt-6 h-auto min-h-11 px-6 text-[0.75rem] tracking-[0.06em]"
                href="/#timeline"
              >
                View the timeline
              </Link>
            </div>
          </div>
        )}

        <div
          className={cx(
            "p-[clamp(1.1rem,4vw,2.25rem)]",
            !isOpen && "pointer-events-none opacity-25 grayscale-[0.5] select-none",
          )}
          inert={!isOpen}
        >
          {panel}
        </div>
      </div>
    </div>
  );
}

type ReviewRow = { label: string; value: string };

type ReviewCardProps = {
  title: string;
  rows: ReviewRow[];
  error: string | null;
  onEdit: () => void;
};

function ReviewCard({ title, rows, error, onEdit }: ReviewCardProps) {
  return (
    <section className={cx(CARD, error && "border-[#ffb4a8]/45")}>
      <div className="flex items-center justify-between gap-3">
        <h4 className={CARD_HEADING}>{title}</h4>
        <button
          aria-label={`Edit ${title.toLowerCase()}`}
          className={cx(
            SMALL_BUTTON,
            "border-mint/40 text-mint hover:border-mint hover:shadow-[0_0_12px_rgb(140_245_189/0.25)]",
          )}
          onClick={onEdit}
          type="button"
        >
          <svg aria-hidden="true" className="size-3" fill="none" viewBox="0 0 16 16">
            <path
              d="M10.5 2.5 13.5 5.5 6 13H3v-3l7.5-7.5Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
          Edit
        </button>
      </div>
      <dl className="m-0 grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-x-3 gap-y-[0.45rem] max-[420px]:grid-cols-1 max-[420px]:gap-y-[0.1rem]">
        {rows.map((row) => (
          <div className="contents" key={row.label}>
            <dt className="pt-[0.15rem] text-[0.62rem] font-semibold tracking-[0.1em] text-muted uppercase max-[420px]:pt-[0.45rem]">
              {row.label}
            </dt>
            <dd
              className={cx(
                "m-0 text-[0.88rem] break-words",
                row.value ? "text-body" : "text-muted/60 italic",
              )}
            >
              {row.value || "Not provided"}
            </dd>
          </div>
        ))}
      </dl>
      {error && <p className={cx("m-0 text-[0.75rem]", ERROR_TONE)}>{error}</p>}
    </section>
  );
}

const memberRows = (member: Member): ReviewRow[] => [
  { label: "Full name", value: member.name },
  { label: "Year of study", value: member.year ? `Year ${member.year}` : "" },
  { label: "Email", value: member.email },
  { label: "WhatsApp", value: member.whatsapp },
  { label: "Registration no.", value: member.registrationNumber },
  { label: "IEEE membership no.", value: member.ieeeMembership },
];

function formatSavedAt(timestamp: number) {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === new Date().toDateString()) return `today at ${time}`;
  return `on ${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${time}`;
}

function SlideDown({ children }: { children: ReactNode }) {
  return (
    <motion.div
      animate={{ opacity: 1, height: "auto" }}
      className="overflow-hidden"
      exit={{ opacity: 0, height: 0 }}
      initial={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// Logo assembly in public/transition/transition.webm takes about two seconds.
const MIN_TRANSITION_MS = 2200;

// Sends the registration and turns every outcome into a dialog message.
async function postRegistration(submission: RegistrationSubmission): Promise<RegistrationResult> {
  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });
    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!response.ok || !body.ok) {
      return {
        kind: "error",
        message: body.error ?? "Something went wrong on our side. Please try again.",
      };
    }
    return { kind: "success", teamName: submission.teamName, teamSize: submission.teamSize };
  } catch {
    return {
      kind: "error",
      message:
        "The connection could not be established. Check your internet connection and try again.",
    };
  }
}

function RegistrationWizard({ isOpen, headingId }: RegistrationFormProps & { headingId: string }) {
  const id = useId();
  // Rendered only after hydration, so reading localStorage here is safe.
  const [draft] = useState(() => (isOpen ? loadDraft() : null));
  const [step, setStep] = useState(draft?.step ?? 0);
  const [direction, setDirection] = useState(1);
  const [teamName, setTeamName] = useState(draft?.teamName ?? "");
  const [leader, setLeader] = useState<Member>(draft?.leader ?? blankMember());
  // Everyone except the leader; its length is always teamSize - 1.
  const [members, setMembers] = useState<Member[]>(draft?.members ?? []);
  // Set when a step is opened from the review page, so "next" returns there.
  const [editingFromReview, setEditingFromReview] = useState(false);
  const [stepError, setStepError] = useState("");
  const [restoredAt, setRestoredAt] = useState(draft?.savedAt ?? null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  // Set when the user changes step; the next step's heading takes focus as it
  // mounts. A ref, not state, so typing never re-triggers the focus.
  const focusNextHeading = useRef(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  // Stable, so React only calls it when a heading mounts or unmounts, not on
  // every render (an inline ref here stole focus from inputs on each keystroke).
  const attachHeading = useCallback((heading: HTMLHeadingElement | null) => {
    headingRef.current = heading;
    if (heading && focusNextHeading.current) {
      focusNextHeading.current = false;
      heading.focus();
    }
  }, []);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const teamSize = members.length + 1;
  const steps = buildSteps(members.length);
  const reviewStep = steps.length - 1;
  const isReview = step === reviewStep;
  const isPristine =
    step === 0 &&
    !teamName &&
    members.length === 0 &&
    Object.values(leader).every((value) => !value);

  function errorForStep(index: number): string | null {
    if (index === 0) return teamError(teamName, teamSize);
    if (index === 1) return memberError(leader);
    if (index === reviewStep) return null;

    const memberIndex = index - 2;
    const member = members[memberIndex];
    const error = memberError(member);
    if (error) return error;
    const clash = [leader, ...members.slice(0, memberIndex)].findIndex(
      (other) =>
        normalizeRegNumber(other.registrationNumber) ===
        normalizeRegNumber(member.registrationNumber),
    );
    if (clash === -1) return null;
    return `This registration number is already used by ${clash === 0 ? "the team leader" : `member ${clash + 1}`}.`;
  }

  const stepErrors = steps.map((_, index) => errorForStep(index));
  const firstIncomplete = stepErrors.findIndex((error) => error !== null);
  const reachable = firstIncomplete === -1 ? reviewStep : firstIncomplete;

  useEffect(() => {
    if (!isOpen) return;
    if (isPristine) clearDraft();
    else saveDraft({ step, teamName, leader, members });
  }, [isOpen, isPristine, step, teamName, leader, members]);

  function goTo(index: number) {
    setDirection(index >= step ? 1 : -1);
    setStep(index);
    setStepError("");
    focusNextHeading.current = true;
    // The "welcome back" notice has done its job once they move on.
    setRestoredAt(null);
    if (index === reviewStep) setEditingFromReview(false);
  }

  function editFromReview(index: number) {
    setEditingFromReview(true);
    goTo(index);
  }

  function changeTeamSize(value: string) {
    setStepError("");
    const otherMembers = Number(value) - 1;
    setMembers((current) =>
      Array.from({ length: otherMembers }, (_, index) => current[index] ?? blankMember()),
    );
  }

  function updateMember(index: number, field: keyof Member, value: string) {
    setStepError("");
    setMembers((current) =>
      current.map((member, currentIndex) =>
        currentIndex === index ? { ...member, [field]: value } : member,
      ),
    );
  }

  function resetForm() {
    clearDraft();
    setTeamName("");
    setLeader(blankMember());
    setMembers([]);
    setEditingFromReview(false);
    setConfirmingReset(false);
    setRestoredAt(null);
    setStepError("");
    setDirection(-1);
    setStep(0);
  }

  async function submit() {
    const submission: RegistrationSubmission = { teamName, teamSize, leader, members };

    setIsSubmitting(true);
    // Keep the transition up long enough for the logo to assemble, even when
    // the request is quick; a slow request holds on the finished logo.
    const [outcome] = await Promise.all([
      postRegistration(submission),
      new Promise((resolve) => setTimeout(resolve, MIN_TRANSITION_MS)),
    ]);
    setIsSubmitting(false);
    setResult(outcome);

    if (outcome.kind === "success") {
      resetForm();
      // The success dialog holds focus; don't pull it to the form behind.
      focusNextHeading.current = false;
    }
  }

  // Runs after the browser has checked required fields and patterns.
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOpen || isSubmitting) return;

    if (isReview) {
      if (firstIncomplete === -1) {
        void submit();
      } else {
        goTo(firstIncomplete);
        setStepError(stepErrors[firstIncomplete] ?? "");
      }
      return;
    }

    const error = stepErrors[step];
    if (error) {
      setStepError(error);
      return;
    }
    if (editingFromReview) {
      // Back to review, unless this edit left a later step unfinished
      // (e.g. the team grew and the new member needs details).
      const nextIncomplete = stepErrors.findIndex((other, index) => index > step && other);
      goTo(nextIncomplete === -1 ? reviewStep : nextIncomplete);
    } else {
      goTo(step + 1);
    }
  }

  const current = steps[step];
  const memberIndex = step - 2;

  let content: ReactNode;
  let subtitle: string;
  if (step === 0) {
    subtitle = "Name your team and tell us how many are crossing together.";
    content = (
      <div className="grid gap-[1.5rem]">
        <div className={FIELD}>
          <label className={FIELD_LABEL} htmlFor={`${id}-team-name`}>
            Team name
          </label>
          <input
            autoComplete="off"
            className={CONTROL}
            id={`${id}-team-name`}
            maxLength={80}
            onChange={(event) => {
              setStepError("");
              setTeamName(event.target.value);
            }}
            placeholder="Enter your team name"
            required
            value={teamName}
          />
        </div>
        <ChoiceGroup
          hint={`(including the leader, max ${MAX_TEAM_SIZE})`}
          legend="Team size"
          name={`${id}-team-size`}
          onChange={changeTeamSize}
          options={TEAM_SIZE_OPTIONS}
          value={String(teamSize)}
        />
      </div>
    );
  } else if (step === 1) {
    subtitle = "The leader is our main point of contact for the team.";
    content = (
      <MemberFields
        emailHint="We'll send the confirmation email here."
        fieldId={`${id}-leader`}
        member={leader}
        onChange={(field, value) => {
          setStepError("");
          setLeader((member) => ({ ...member, [field]: value }));
        }}
      />
    );
  } else if (!isReview) {
    subtitle = `Details for team member ${memberIndex + 2} of ${teamSize}.`;
    content = (
      <MemberFields
        fieldId={`${id}-member-${memberIndex + 2}`}
        member={members[memberIndex]}
        onChange={(field, value) => updateMember(memberIndex, field, value)}
      />
    );
  } else {
    subtitle = "Check every detail before you lock it in. Use Edit to change anything.";
    content = (
      <div className="grid gap-[0.8rem]">
        <ReviewCard
          error={stepErrors[0]}
          onEdit={() => editFromReview(0)}
          rows={[
            { label: "Team name", value: teamName },
            { label: "Team size", value: `${teamSize} member${teamSize === 1 ? "" : "s"}` },
          ]}
          title="Team"
        />
        {[leader, ...members].map((member, index) => (
          <ReviewCard
            error={stepErrors[index + 1]}
            key={steps[index + 1].key}
            onEdit={() => editFromReview(index + 1)}
            rows={memberRows(member)}
            title={steps[index + 1].title}
          />
        ))}
      </div>
    );
  }

  let primaryLabel: ReactNode;
  if (isReview) {
    primaryLabel = isSubmitting ? "Constructing bridge..." : "Connect & register";
  } else {
    primaryLabel = (
      <>
        {editingFromReview ? "Save & review" : `Next: ${steps[step + 1].label}`}
        <ArrowIcon direction="right" />
      </>
    );
  }

  const stepCount = `${String(step + 1).padStart(2, "0")} / ${String(steps.length).padStart(2, "0")}`;
  const summaries = steps.map((_, index) => {
    if (index === 0) return teamName ? `${teamName} · ${teamSize} member${teamSize === 1 ? "" : "s"}` : "";
    if (index === reviewStep) return "";
    return (index === 1 ? leader : members[index - 2]).name;
  });

  const startOverButton = (
    <button
      aria-expanded={confirmingReset}
      className={cx(SMALL_BUTTON, "border-line text-muted hover:border-mint/60 hover:text-white")}
      onClick={() => setConfirmingReset((value) => !value)}
      type="button"
    >
      <svg aria-hidden="true" className="size-3" fill="none" viewBox="0 0 16 16">
        <path
          d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v3h3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
      Start over
    </button>
  );

  const savedNote = (
    <span className="inline-flex items-center gap-1.5 text-[0.7rem] text-muted/80">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald" />
      Progress saved on this device
    </span>
  );

  const aside = (
    <div className="hidden gap-[clamp(1.75rem,3vw,2.5rem)] lg:grid">
      <div className="h-px w-16 bg-mint/60 shadow-[0_0_8px_rgb(140_245_189/0.6)]" />

      {/* The panel holds the real heading; this is its large visual twin. */}
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          aria-hidden="true"
          className="grid gap-[0.55rem]"
          exit={{ opacity: 0, y: -8 }}
          initial={{ opacity: 0, y: 8 }}
          key={current.key}
          transition={{ duration: 0.22, ease: EASE }}
        >
          <p className="m-0 text-[0.68rem] font-semibold tracking-[0.16em] text-muted uppercase">
            Step <span className="text-mint">{stepCount}</span>
          </p>
          <p className="m-0 font-display text-[clamp(1.9rem,3vw,2.6rem)] leading-none font-bold tracking-[0.03em] text-white uppercase">
            {current.title}
          </p>
          <p className="m-0 max-w-[30rem] text-[0.95rem] leading-relaxed text-muted">{subtitle}</p>
        </motion.div>
      </AnimatePresence>

      <StepList
        current={step}
        onSelect={goTo}
        reachable={reachable}
        steps={steps}
        summaries={summaries}
      />

      {!isPristine && (
        <div className="flex items-center gap-4">
          {savedNote}
          {startOverButton}
        </div>
      )}
    </div>
  );

  const panel = (
    <div className="grid min-w-0 gap-[1.5rem]">
      {/* Phones only: the left column's progress moves into the panel. */}
      <div className="grid gap-[0.7rem] lg:hidden">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <p className="m-0 text-[0.66rem] font-semibold tracking-[0.14em] text-muted uppercase">
            Step <span className="text-mint">{stepCount}</span>
            <span className="sm:hidden"> · {current.label}</span>
          </p>
          {isOpen && !isPristine && startOverButton}
        </div>
        <ProgressBar current={step} onSelect={goTo} reachable={reachable} steps={steps} />
      </div>

      <AnimatePresence initial={false}>
        {confirmingReset && (
          <SlideDown>
            <div
              className={cx(
                NOTICE,
                "flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-[#ffb4a8]/35 bg-[#ffb4a8]/6",
              )}
              role="group"
              aria-label="Confirm start over"
            >
              <p className="m-0 text-body">
                Clear everything you&apos;ve entered and start from step 01?
              </p>
              <div className="flex gap-2">
                <button
                  autoFocus
                  className={cx(SMALL_BUTTON, "border-line text-body hover:border-mint hover:text-mint")}
                  onClick={() => setConfirmingReset(false)}
                  type="button"
                >
                  Keep editing
                </button>
                <button
                  className={cx(SMALL_BUTTON, "border-[#ffb4a8]/50 text-[#ffb4a8] hover:bg-[#ffb4a8]/10")}
                  onClick={() => {
                    resetForm();
                    // Already on step 01, the heading won't remount, so focus it now.
                    if (step === 0) headingRef.current?.focus();
                    else focusNextHeading.current = true;
                  }}
                  type="button"
                >
                  Clear &amp; restart
                </button>
              </div>
            </div>
          </SlideDown>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {restoredAt && !confirmingReset && (
          <SlideDown>
            <div
              className={cx(NOTICE, "flex items-start justify-between gap-3 border-mint/30 bg-mint/6")}
              role="status"
            >
              <p className="m-0 text-body">
                <span className="font-semibold text-mint">Welcome back.</span> We restored the
                progress you saved {formatSavedAt(restoredAt)}.
              </p>
              <button
                aria-label="Dismiss"
                className="-m-1 grid size-7 flex-none cursor-pointer place-items-center rounded-sm text-muted transition-colors hover:text-white"
                onClick={() => setRestoredAt(null)}
                type="button"
              >
                <svg aria-hidden="true" className="size-3" fill="none" viewBox="0 0 12 12">
                  <path
                    d="M2 2l8 8M10 2l-8 8"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                </svg>
              </button>
            </div>
          </SlideDown>
        )}
      </AnimatePresence>

      <form className="grid min-w-0 gap-[1.5rem]" onSubmit={handleSubmit}>
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="grid min-w-0 gap-[1.25rem]"
            exit={{ opacity: 0, x: -20 * direction }}
            initial={{ opacity: 0, x: 20 * direction }}
            key={current.key}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <header className="grid gap-1 lg:contents">
              <h3
                className="m-0 font-display text-[clamp(1.5rem,5vw,1.9rem)] leading-none font-bold tracking-[0.04em] text-white uppercase focus:outline-none lg:sr-only"
                // Focus the new step so screen readers announce it and, on
                // phones, the top of the step scrolls into view.
                ref={attachHeading}
                tabIndex={-1}
              >
                {current.title}
              </h3>
              <p className="m-0 text-[0.8rem] leading-relaxed text-muted lg:hidden">{subtitle}</p>
            </header>

            {content}
          </motion.div>
        </AnimatePresence>

        {stepError && (
          <p
            className={cx(NOTICE, "m-0 flex items-start gap-2 border-[#ffb4a8]/35 bg-[#ffb4a8]/6", ERROR_TONE)}
            role="alert"
          >
            <svg
              aria-hidden="true"
              className="mt-[0.2rem] size-3.5 flex-none"
              fill="none"
              viewBox="0 0 16 16"
            >
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M8 4.5v4.2M8 11.2v.3"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.6"
              />
            </svg>
            {stepError}
          </p>
        )}

        <div className="flex gap-[0.7rem] border-t border-line/25 pt-[1.5rem]">
          {step > 0 && (
            <button
              className={cx(BUTTON_SECONDARY, isReview ? "flex-none" : "flex-1")}
              disabled={isSubmitting}
              onClick={() => goTo(step - 1)}
              type="button"
            >
              <ArrowIcon direction="left" />
              Back
            </button>
          )}
          <button
            className="btn-primary h-auto min-h-12 flex-1 gap-2 px-4 text-[clamp(0.68rem,3vw,0.78rem)] tracking-[0.06em] disabled:cursor-wait disabled:opacity-65"
            disabled={isSubmitting}
            type="submit"
          >
            {primaryLabel}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <RegistrationLayout aside={aside} headingId={headingId} isOpen={isOpen} panel={panel} />
      <TransitionOverlay label="Constructing bridge..." show={isSubmitting} variant="submit" />
      <RegistrationDialog onClose={() => setResult(null)} result={result} />
    </MotionConfig>
  );
}

export default function RegistrationForm({ isOpen }: RegistrationFormProps) {
  const id = useId();
  const hydrated = useHydrated();

  return (
    <motion.section
      id="registration"
      aria-labelledby={`${id}-heading`}
      className="mx-auto w-full max-w-[72rem] min-w-0"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {hydrated ? (
        <RegistrationWizard headingId={`${id}-heading`} isOpen={isOpen} />
      ) : (
        <RegistrationLayout
          aside={null}
          headingId={`${id}-heading`}
          isOpen={isOpen}
          panel={
            // Drafts live in localStorage, so the form waits for the browser.
            <p className="m-0 grid min-h-80 place-items-center text-[0.7rem] font-semibold tracking-[0.16em] text-muted uppercase">
              Initializing path...
            </p>
          }
        />
      )}
    </motion.section>
  );
}
