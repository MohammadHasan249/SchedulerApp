# Mobile E2E — Maestro

Phase 4 of `apps/mobile/TESTING_PLAN.md`. YAML flows live in `flows/`, one per
priority scenario from the testing plan.

## Why Maestro over Detox

No native build step required — Maestro drives the app over Android's UI
Automator / iOS's XCUITest against whatever's already running (Expo Go, an
EAS dev build, or a production build), so there's nothing to compile just to
get e2e running. Detox needs a native test-runner wired into the Xcode/Gradle
build and is only worth it if the team later needs deep native-module
interaction that Maestro's black-box approach can't reach.

## Running on Windows — run Maestro natively, not via WSL

The official install script needs a POSIX shell, but the CLI itself is a
plain JVM app (`~/.maestro/lib/*.jar` + a `bin/maestro.bat` launcher) — it
runs fine directly on Windows once you have a JDK. **Do not try to bridge
WSL's Maestro to a Windows-hosted emulator over adb** — burned about an hour
on this: Maestro's embedded Android client (`dadb`) connects to a
hardcoded `127.0.0.1:5037` and ignores `ADB_SERVER_SOCKET`/
`ANDROID_ADB_SERVER_HOST`, and even a local TCP proxy forwarding
`127.0.0.1:5037` → the Windows adb server hung indefinitely partway through
the adb handshake for reasons never fully root-caused. Running Maestro
natively on Windows sidesteps the whole problem.

### One-time setup

1. Install a JDK 17 (Android/RN tooling doesn't yet support newer LTS
   versions cleanly — Android Studio's bundled JBR was JDK 25 and broke the
   Gradle build with "Unsupported class file major version 69"):
   ```powershell
   winget install --id EclipseAdoptium.Temurin.17.JDK
   ```
2. Install Android Studio (ships the SDK, platform-tools, and emulator):
   ```powershell
   winget install --id Google.AndroidStudio
   ```
   Then launch it once, run the Standard setup wizard, and create an AVD via
   *More Actions → Virtual Device Manager*.
3. Install Maestro inside WSL2 (there's no native Windows installer) and
   copy the install directory out to a Windows path — this is the only
   thing WSL is used for:
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash   # needs a JDK + unzip in WSL too
   cp -r ~/.maestro /mnt/c/Users/<you>/AppData/Local/maestro-win
   ```

### Every session

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot'
$env:ANDROID_HOME = 'C:\Users\<you>\AppData\Local\Android\Sdk'
$env:Path = "$env:Path;$env:ANDROID_HOME\platform-tools;$env:JAVA_HOME\bin"

# start the emulator if it isn't already running
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd <your-avd-name>

& "C:\Users\<you>\AppData\Local\maestro-win\bin\maestro.bat" test `
  apps\mobile\maestro\flows\01-login-clockin.yaml `
  -e ADMIN_EMAIL=admin@test.dev -e ADMIN_PASSWORD='Password123!' -e BRANCH_SLUG=Main
```

If the app is a debug build served by Metro (`npx expo run:android`, not a
release APK), two more things matter:
- `adb reverse tcp:8081 tcp:8081` needs to be set so the emulator can reach
  Metro — it's lost whenever the adb server restarts.
- If you edit app source and a Maestro run doesn't pick up the change (a
  `testID` "not found" that's clearly present in the file), Metro's own
  cache went stale — kill it and `npx expo start --clear`, then
  `adb reverse tcp:8081 tcp:8081` and `adb shell am force-stop
  com.workplix.mobile` again.

## Test data

These flows use placeholder `${ENV_VAR}` values — nothing is hardcoded to a
real account. Seed an org with an admin + a couple of employees first (there
is no `/scheduler-seed` script despite CLAUDE.md mentioning one — it doesn't
exist in this repo; seed manually through the web signup/admin UI, or via
Supabase's admin API to skip email confirmation), then pass matching values
with `-e`. See each flow file's header comment for its exact `-e` list.

## Status of each flow (last run: 2026-08-24, against a live emulator)

| # | Flow | Status |
|---|------|--------|
| 1 | Login → schedule → kiosk clock in/out | **Passing.** Full run: admin login, Dashboard → Kiosk Clock-In card (there's no separate "Clock In" tab — see the flow's comment), branch selection on first PIN attempt, clock in with PIN, clock out. |
| 2 | Signup via invite link | **Passing.** Invite an employee via the admin UI first (pending-invite record), then this flow completes signup and gets "Check your email". |
| 3 | Admin: AI-assign a shift → verify on schedule | **Mechanically passing**, but surfaced a real product finding: the AI chat prompt ("Assign X to Y's shift") doesn't actually create the assignment — the shift still showed "Tap to assign employees" afterward. Worth following up on the DeepSeek tool-calling path in `apps/web/app/api/ai/schedule` before relying on this feature. |
| 4 | Shift swap: request → cover accepts → manager approves | **Requester half passing.** The cover-accept and manager-approve steps are blocked by a **confirmed mobile bug**: `app/(tabs)/requests.tsx`'s `createShiftSwap({ shiftId })` never passes a `coverId`, even though the API supports one and gates visibility on it (`GET` only shows a swap to the employee whose `coverId` matches). Every mobile-created swap request is permanently invisible to any would-be cover — the UI has no cover picker at all. Needs a product fix, not a test fix. |
| 5 | Availability → AI auto-assign | **Availability-save half fully passing** (marks a day unavailable, saves, gets confirmation). The AI-assign half hit intermittent infra flakiness late in this session (see below) after passing once — not re-verified to a clean run, but nothing indicates a real regression. |

## A note on the session this was built in

Everything above was verified against Android Studio + JDK 17 + Maestro all
running natively on Windows, with the app built via `npx expo run:android`
and installed as `com.workplix.mobile`, against a real seeded org in the
**production** Supabase database (the app hadn't launched yet at time of
writing — confirmed explicitly OK'd by the project owner, who plans to wipe
this data before launch; don't assume that's fine in general).

Late in the session, `maestro test` runs started intermittently failing on
the very first assertion (`"you@example.com" is visible`) against a
screenshot that clearly showed the login screen rendered correctly — that's
UIAutomator/Maestro flakiness from running an Android emulator + Android
Studio + Metro + a Next.js dev server + Playwright/Chrome all at once on one
machine (down to ~5GB free RAM). If you see the same symptom — an assertion
failing against a screenshot that visibly contradicts it — suspect resource
pressure before suspecting the flow or the app; retry after closing
something, or run on a less loaded machine / in CI.

## Known gaps / TODOs

- `03-admin-ai-assign.yaml`'s `TARGET_DAY_LABEL` env var must match whatever
  day-of-month the AI actually schedules onto, and the flow can't yet detect
  that automatically — it's a manual guess per run.
- No flow covers the `(admin)` settings screens, reports, or job roles.
- Nothing here runs in CI yet — see the "Why Maestro" section for the
  suggested next step (GitHub Actions `ubuntu-latest` + Android emulator).
