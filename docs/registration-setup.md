# Team registration → Google Sheet setup

```
Browser form ──POST /api/register──▶ Next.js route (validates) ──POST + secret──▶ Apps Script web app ──▶ Google Sheet
                                                                                           └──▶ welcome emails (leader + each member)
```

The browser never sees the Apps Script URL or the secret. They live only in the
server's environment variables.

## 1. Sheet columns

You don't need to type these yourself. The script creates the `Registrations` tab
and its header row on the first submission, or when you run `setup()`. There is
one row per team and 22 columns:

| # | Column | Notes |
|---|--------|-------|
| A | Timestamp | `yyyy-MM-dd HH:mm:ss`, Asia/Colombo |
| B | Team ID | `RX5-001`, `RX5-002`, … |
| C | Team Name | unique (case-insensitive) |
| D | Team Size | 2–3 |
| E–J | Leader Name, Leader Year, Leader Email, Leader WhatsApp, Leader Reg No, Leader IEEE No | |
| K–P | Member 2 Name, Year, Email, WhatsApp, Reg No, IEEE No | |
| Q–V | Member 3 … | blank if team size < 3 |

> **Upgrading a sheet made before emails were collected:** paste the new script,
> choose `migrateAddEmailColumns` in the function dropdown and click **Run**. It
> inserts an Email column after each Year column (existing rows stay blank there)
> and is safe to run twice. Until it runs, the web app refuses submissions rather
> than writing into the wrong columns.

Every cell is stored as plain text, so leading zeros in phone numbers are kept and
values starting with `=` or `+` are never run as formulas.

Field formats (checked in the form, the API route and `lib/registration.ts`):

| Field | Format | Example |
|-------|--------|---------|
| Email | `name@domain.tld`; stored lowercased | `Kasun@Gmail.com` → `kasun@gmail.com` |
| WhatsApp | exactly 10 digits, starting with 0 | `0771234567` |
| Registration number | letters, digits and `/`; stored uppercased; unique across all teams | `2022cs001` → `2022CS001` |
| IEEE membership number | optional, 6–12 digits | `101597523` |

## 2. Create the sheet and script

1. Create a new Google Sheet, e.g. **ReidXtreme 5.0 Registrations**, using the
   organizing committee's Google account.
2. Open **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with [`scripts/registration-sheet.gs`](../scripts/registration-sheet.gs)
   and save.
4. Set the shared secret:
   - Generate one: `openssl rand -hex 32`
   - In Apps Script open **Project Settings (⚙) → Script Properties → Add script property**
   - Property: `SECRET`, Value: the generated string
5. *(Optional)* Choose `setup` in the function dropdown and click **Run**. This
   creates the header row now. The first time, Google asks you to authorize the
   script: **Review permissions → choose account → Advanced → Go to (project) → Allow**.
   It asks for Sheets, and Gmail (send) access (plus Drive, if a booklet is set).
6. *(Optional)* To attach the delegate booklet, upload the PDF to Drive and put
   its file ID in `DELEGATE_BOOKLET_FILE_ID` at the top of the script. Left
   empty, the emails go out without the attachment or the booklet paragraph.
7. *(Optional)* Run `sendTestWelcomeEmail` to send both welcome emails (leader
   and member) to your own address and check how they look.

## 3. Deploy as a web app

1. **Deploy → New deployment**, then click the gear icon and choose **Web app**.
2. Settings:
   - **Execute as:** *Me*. The script writes to the sheet as you.
   - **Who has access:** *Anyone*. Your Next.js server calls it without a Google
     login. The `SECRET` stops anyone else from writing to the sheet.
3. Click **Deploy** and copy the **Web app URL**
   (`https://script.google.com/macros/s/…/exec`).

> **Changing the script later:** saving the code does not update the live URL. Use
> **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. This
> keeps the same URL. "New deployment" would create a different URL.

## 4. Environment variables

Add these to `.env.local` for local development and to your hosting provider
(e.g. Vercel → Project → Settings → Environment Variables) for production:

```bash
# Apps Script web app URL from step 3
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/XXXXXXXX/exec
# Must exactly match the SECRET script property from step 2
GOOGLE_SCRIPT_SECRET=paste-the-openssl-output-here
```

Both are server-only (no `NEXT_PUBLIC_` prefix).

Whether registrations are open is set in code, not the environment: flip
`REGISTRATIONS_OPEN` in `lib/registration.ts` and redeploy. When it is `false`,
the form shows a "Registrations closed" overlay, the site's "Register" buttons
say so instead, and `/api/register` rejects submissions.

## 5. Test it

1. Run `pnpm dev`, open `/register`, and submit a test team.
2. A new row should appear in the sheet, the form should show the Team ID, and the
   leader should receive the leaders' welcome email and every other member the
   members' one.
3. Submit the same team name again. You should see *"That team name is already taken."*
4. Delete the test rows before you announce registrations.

## Troubleshooting

| Symptom | Cause |
|---------|-------|
| "Registrations are not configured yet." | `GOOGLE_SCRIPT_URL` / `GOOGLE_SCRIPT_SECRET` are missing in the server environment |
| "Unauthorized." | `GOOGLE_SCRIPT_SECRET` doesn't match the `SECRET` script property |
| "Could not save your registration." | The script crashed or the URL is wrong. Check **Apps Script → Executions** for the error. A common cause is that access isn't set to *Anyone* |
| "Registrations are being updated." | The sheet's header row doesn't match the script. Run `migrateAddEmailColumns` |
| Team saved but no welcome email | Check **Executions** for the mail error. Free Gmail accounts can send about 100 emails a day from Apps Script (Workspace: 1,500), and each team uses up to 3 |
| Code changes have no effect | You didn't publish a new version of the deployment (see the note in step 3) |

Team IDs come from the row number. If you delete rows in the middle of the sheet,
later IDs can repeat an earlier one, so clear only test rows, and only before
registrations open.
