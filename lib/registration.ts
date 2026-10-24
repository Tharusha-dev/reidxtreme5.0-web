// Shared by the registration form and the /api/register route handler.

// Registrations closed on 2026-10-24. Flipping this back to true reopens the
// form, the API and every "Register" call to action across the site.
export const REGISTRATIONS_OPEN = false;

export const MIN_TEAM_SIZE = 2;
export const MAX_TEAM_SIZE = 3;

export const YEARS = ["1", "2", "3", "4"] as const;

export type Member = {
  name: string;
  year: string;
  email: string;
  whatsapp: string;
  registrationNumber: string;
  // Optional; empty string when the member has none.
  ieeeMembership: string;
};

export type RegistrationSubmission = {
  teamName: string;
  teamSize: number;
  leader: Member;
  members: Member[];
};

export const blankMember = (): Member => ({
  name: "",
  year: "",
  email: "",
  whatsapp: "",
  registrationNumber: "",
  ieeeMembership: "",
});

// Deliberately loose: something@something.tld, no spaces.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Local format only: 10 digits starting with 0, e.g. 0771234567.
export const WHATSAPP_PATTERN = /^0\d{9}$/;
// Letters, digits and slashes, e.g. 2022cs001 or EG/2022/1234.
export const REG_NUMBER_PATTERN = /^[A-Za-z0-9/]+$/;
// e.g. 101597523.
export const IEEE_PATTERN = /^\d{6,12}$/;

// Returns the first problem with a member's details, or null if they're valid.
// Messages are written to be shown to the user as-is.
export function memberError(member: Member): string | null {
  if (!member.name.trim()) return "Enter a full name.";
  if (!YEARS.includes(member.year as (typeof YEARS)[number])) return "Choose a year of study.";
  if (!EMAIL_PATTERN.test(member.email.trim()))
    return "Enter a valid email address, like name@example.com.";
  if (!WHATSAPP_PATTERN.test(member.whatsapp))
    return "WhatsApp number must be 10 digits, like 0771234567.";
  if (!REG_NUMBER_PATTERN.test(member.registrationNumber.trim()))
    return "Registration number can only contain letters, numbers and /, like 2022cs001.";
  if (member.ieeeMembership && !IEEE_PATTERN.test(member.ieeeMembership))
    return "IEEE membership number should be digits only, like 101597523.";
  return null;
}

export function teamError(teamName: string, teamSize: number): string | null {
  if (!teamName.trim()) return "Enter a team name.";
  if (!Number.isInteger(teamSize) || teamSize < MIN_TEAM_SIZE || teamSize > MAX_TEAM_SIZE)
    return `Teams must have ${MIN_TEAM_SIZE}–${MAX_TEAM_SIZE} members.`;
  return null;
}

// Registration numbers compare case-insensitively: 2022cs001 is 2022CS001.
export const normalizeRegNumber = (value: string) => value.trim().toUpperCase();

export function duplicateRegNumberError(people: Member[]): string | null {
  const regNumbers = people.map((member) => normalizeRegNumber(member.registrationNumber));
  return new Set(regNumbers).size === regNumbers.length
    ? null
    : "Each member must have a different registration number.";
}

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function cleanMember(raw: unknown, who: string): Member {
  const input = (raw ?? {}) as Record<string, unknown>;
  const member: Member = {
    name: text(input.name, 100),
    year: text(input.year, 1),
    email: text(input.email, 254).toLowerCase(),
    whatsapp: text(input.whatsapp, 20),
    registrationNumber: normalizeRegNumber(text(input.registrationNumber, 40)),
    ieeeMembership: text(input.ieeeMembership, 20),
  };

  const error = memberError(member);
  if (error) throw new Error(`${who}: ${error}`);
  return member;
}

// Validates untrusted input and returns a normalized submission, or throws
// an Error whose message is safe to show to the user.
export function parseSubmission(raw: unknown): RegistrationSubmission {
  const input = (raw ?? {}) as Record<string, unknown>;
  const teamName = text(input.teamName, 80);
  const teamSize = Number(input.teamSize);
  const rawMembers = Array.isArray(input.members) ? input.members : [];

  const error = teamError(teamName, teamSize);
  if (error) throw new Error(error);
  if (rawMembers.length !== teamSize - 1)
    throw new Error("Member details do not match the team size.");

  const leader = cleanMember(input.leader, "Team leader");
  const members = rawMembers.map((member, index) => cleanMember(member, `Member ${index + 2}`));

  const duplicate = duplicateRegNumberError([leader, ...members]);
  if (duplicate) throw new Error(duplicate);

  return { teamName, teamSize, leader, members };
}
