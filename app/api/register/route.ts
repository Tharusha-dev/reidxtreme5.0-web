import { REGISTRATIONS_OPEN, parseSubmission } from "@/lib/registration";

// Forwards validated registrations to the Google Apps Script web app that
// writes them to the registrations sheet (see scripts/registration-sheet.gs).
export async function POST(request: Request) {
  if (!REGISTRATIONS_OPEN) {
    return Response.json({ ok: false, error: "Registrations are closed." }, { status: 403 });
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  const secret = process.env.GOOGLE_SCRIPT_SECRET;
  if (!scriptUrl || !secret) {
    console.error("GOOGLE_SCRIPT_URL or GOOGLE_SCRIPT_SECRET is not set.");
    return Response.json(
      { ok: false, error: "Registrations are not configured yet." },
      { status: 500 },
    );
  }

  let submission;
  try {
    submission = parseSubmission(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid submission.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }

  try {
    // Apps Script answers with a 302 to googleusercontent.com; fetch follows it.
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, ...submission }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    // Apps Script always returns 200, so the outcome is in the body.
    const result = (await response.json()) as { ok: boolean; error?: string; teamId?: string };

    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.error ?? "Registration failed." },
        { status: 409 },
      );
    }
    return Response.json({ ok: true, teamId: result.teamId });
  } catch (error) {
    console.error("Failed to reach the registration sheet:", error);
    return Response.json(
      { ok: false, error: "Could not save your registration. Please try again." },
      { status: 502 },
    );
  }
}
