# FlowGuard Live

Prompt: Traffic Management Simulation Platform

Context / Problem Statement

Design and build a web application that addresses uneven distribution of traffic across a Planning Authority's jurisdiction. The core deliverable is a simulation of traffic management during peak hours — 9:00 AM–12:00 Noon and 4:00 PM–7:00 PM — that helps planners rebalance signal timing, reroute flow, and reduce congestion hotspots.

Use the existing demo (a live traffic map with incident zones, construction zones, signal states, and a citizen/reporting view) as the visual and structural starting point. Keep its clean map-first layout, but rebuild it into a genuinely useful planning + simulation tool — not just a static dashboard.

Build this

1. Two user modes

Citizen view (public, no login): live map, current congestion, incident reporting, reroute suggestions — like the existing demo.

Planner/Authority view (behind sign-in): simulation controls, analytics, signal-timing editor, historical comparisons.

2. Core simulation engine

Let planners select a time window (default presets: 9 AM–12 PM, 4 PM–7 PM, plus a custom range slider).

Show a before/after comparison: current signal-timing plan vs. a simulated rebalanced plan, with metrics — average wait time, congestion index per corridor, throughput (vehicles/hour).

Include a "Run simulation" button that animates traffic flow across the map over the selected window (speed up/slow down playback, pause, scrub a timeline).

Allow planners to manually adjust signal timing at a junction (drag a slider for green-light duration) and instantly see the simulated impact ripple to nearby junctions.

Add a hotspot heatmap layer toggle showing which zones are chronically congested during each peak window, ranked by severity.

3. Interactivity upgrades over the current demo

Click any junction/road segment on the map to open a side panel with: live congestion %, historical trend chart, and quick actions (extend green phase, flag for review, suggest reroute).

Drag-and-drop zone comparison: select two zones and compare their traffic load side-by-side.

A "What if" scenario builder: e.g. "close this road for construction" or "divert 20% of traffic from Zone A to Zone B" — and see the simulated downstream effect.

Filters for vehicle type (if data supports it), day of week, and weather condition, so planners can simulate realistic variations.

Notifications/toast when a simulated change would reduce average commute time by more than a set threshold — surfaces "quick wins" automatically.

Keep and improve incident reporting: let citizens report from a pin-drop on the map rather than a separate form page, with photo upload and category tags (accident, pothole, signal fault, construction).

4. Dashboard for planners

Summary cards: total active incidents, average city-wide congestion, number of junctions in "peak-hour mode," estimated time saved by current simulated plan.

A ranked list: "Top 5 most congested corridors right now" with one-click jump-to-map.

Exportable report (PDF/CSV) of simulation results for a given time window, for use in planning meetings.

5. Login with OTP + role selection

Replace the current simple sign-in with a two-step login:

Enter mobile number (or email) → OTP sent and verified (6-digit, auto-expiring in ~5 minutes, with resend-after-cooldown).

On first login, user selects their role: Citizen, Police, Ambulance/Emergency responder, or Planning Authority. Role determines what dashboard and permissions they land on after login.

Store role with the account so returning users skip straight to their role's dashboard after OTP verification.

Police/Ambulance/Authority roles should require a verification field (badge ID / department code) at signup, reviewed or auto-validated before full access is granted — citizens can self-register freely.

Citizen view stays mostly public/browsable, but reporting an incident, using SOS, and saving preferences should require the person to be logged in so reports are traceable to a real account.

6. Emergency SOS button

A prominent, always-reachable SOS button in the citizen view (visible on the map screen and as a floating action button on mobile) for reporting an active incident on a street or highway in real time.

On press:

Capture the citizen's live GPS location automatically (with a permission prompt if not already granted).

Ask for a quick incident type (accident, breakdown, fire, medical, other) via one-tap icons — no long form, since this is an emergency flow.

Optional: allow attaching a photo and a short voice note.

Show a confirmation state ("Help is being notified") with a live countdown/status so the citizen knows the SOS registered.

Include a cancel/false-alarm option within a short window in case of accidental presses.

On submission:

Save the SOS report to the database with: timestamp, incident type, live coordinates, reporting user ID, status (new/acknowledged/ resolved), and any attached media.

Auto-push the live location and incident details to nearby Police and Ambulance dashboards in real time (via live map pin + alert notification), without the citizen needing to contact anyone separately.

Update the incident's location in real time for a short period if the reporter is still moving (e.g. hit-and-run reported from a moving vehicle), until marked resolved.

Police/Ambulance dashboard should let responders acknowledge, mark en route, and resolve an SOS, and see all active SOS pins ranked by time since report and distance from the responder.

7. Automatic traffic rebalancing + alternate routes on incident

The moment an SOS or reported incident lands on a main road/highway, the system should:

Flag that corridor as "incident override" on the signal-state map (reusing the existing signal legend states).

Automatically recalculate and display alternate routes to citizens currently near or heading toward that corridor, shown as highlighted reroute paths on the map with estimated time saved.

Trigger the simulation engine to suggest a temporary signal-timing rebalance for surrounding junctions to absorb the diverted traffic, consistent with the peak-hour simulation logic already built.

Notify Police/Ambulance with the incident location plus the fastest responder route, factoring in the current live congestion — not just straight-line distance.

Once an incident is marked "resolved" by Police/Ambulance, the corridor should automatically revert from "incident override" back to its normal or peak-hour signal plan, and alternate-route suggestions should stop.

Design direction (important — avoid a generic "AI-made" look)

Color palette: avoid default purple/blue gradients and glassmorphism clichés. Use an infrastructure/civic palette — deep slate or charcoal base, warm amber/orange for peak-hour and incident states, muted teal or green for normal flow, soft red only for critical alerts. Keep contrast accessible (WCAG AA).

Typography: a grounded, slightly technical sans-serif (e.g. Inter, IBM Plex Sans, or similar) — not a trendy rounded display font. Vary weight for hierarchy instead of relying only on size.

Layout: map-first, asymmetric layout (large map + slim data rail), not a centered card grid. Avoid excessive rounded corners and drop shadows on every element — use them sparingly for real elevation, like the side panel or modals only.

Micro-interactions: subtle transitions on map updates (fade/slide, not bouncy spring animations everywhere), real loading skeletons instead of generic spinners, and a live "last updated Xs ago" indicator to reinforce that this is a real-time system.

Data density done well: charts and heatmaps should feel like a planning tool (think transit-agency dashboards), not a marketing landing page — real axis labels, real units, no placeholder Lorem Ipsum stats.

Keep the citizen view friendly and simple; keep the planner view denser and more analytical — the two modes should feel like different registers of the same design system, not two different products.

Deliverable

A responsive web app (desktop-first for the planner and police/ambulance dashboards, mobile-friendly for the citizen view — especially the SOS flow, which must work smoothly one-handed on a phone) built on the existing FlowGuard-style structure. Implement the simulation engine, OTP + role-based login, the Emergency SOS pipeline (live location → database → live police/ ambulance dashboard → auto reroute + signal rebalance), and the design direction above throughout — not just on a single page.

Note for the build tool: this depends on real backend capability — a database for accounts/roles/incidents/SOS reports, an OTP delivery service (SMS/email), and live geolocation. If the platform can't wire up real OTP delivery or a live database/backend out of the box, build the full UI/UX flow with mocked-but-realistic data and clearly mark which parts need a real backend connected (e.g. Supabase, which Lovable integrates with natively) to go live.Prompt: Add OTP Login + Role Selection + Emergency SOS

Add the following features to the existing site (signal-wise-path / FlowGuard). Keep the current visual style, color palette, and layout intact — extend it, don't redesign it.

1. Login page with OTP + role selection

Replace the current sign-in with a two-step login:

User enters mobile number (or email) → an OTP is sent and must be verified (6-digit code, expires in ~5 minutes, with a resend button that's disabled during a cooldown).

On first login, the user selects their role: Citizen, Police, or Ambulance/Emergency responder. Store this role with the account.

Returning users go straight to their role's dashboard after OTP verification (no need to re-pick role every time).

Police/Ambulance roles should require a badge ID / department code field at signup for verification before getting full access. Citizens can self-register freely with just number/email + OTP.

Reporting an incident or using SOS should require being logged in, so every report is tied to a real account.

2. Emergency SOS button

Add a prominent, always-reachable SOS button on the citizen view — on the main map screen, and as a floating button on mobile — for reporting an active incident on a street or highway right now.

On press:

Automatically capture the citizen's live GPS location (prompt for location permission if not already granted).

Ask for the incident type via quick one-tap icons (accident, breakdown, fire, medical, other) — keep it fast, no long form.

Show a confirmation state ("Help is being notified") so the citizen knows it registered, with a short cancel/false-alarm window in case of accidental presses.

On submission, save to the database:

timestamp, incident type, live coordinates, reporting user ID, status (new / acknowledged / resolved), optional photo.

Automatically push the live location and incident details to nearby Police and Ambulance dashboards in real time — a new pin on their live map plus an alert notification — no need for the citizen to contact anyone separately.

If the incident is on a main road/highway, keep updating its location for a short time if the reporter is still moving, until it's marked resolved.

Police/Ambulance should be able to acknowledge, mark en route, and resolve an SOS from their dashboard, with active SOS incidents ranked by time-since-reported and distance from the responder.

3. Auto traffic rebalancing + alternate routes

The moment an SOS or incident is confirmed on a main road/highway:

Flag that corridor as "incident override" on the live signal-state map (reuse the existing signal legend states).

Show citizens near or heading toward that corridor an alternate route highlighted on the map, with estimated time saved.

Notify Police/Ambulance with the incident location and the fastest route to reach it, based on current live congestion, not just straight line distance.

When Police/Ambulance marks the incident "resolved," the corridor should automatically revert to its normal or peak-hour signal state, and the alternate-route suggestion should stop showing.

4. Editable signal waiting time

Give Police and Planning Authority roles (not citizens) the ability to manually edit the waiting time / green-light duration at any junction, directly from the map — click a junction to open a small panel with a slider or +/- stepper for the current wait time.

Changes should:

Apply in near-real-time to that junction's signal state.

Show the before vs. after wait time so the person editing can see the impact of their change immediately.

Optionally ripple a suggestion to nearby junctions if the edit would just push congestion to the next intersection instead of easing it.

Editing should default to sensible bounds (e.g. can't set a green light to 0s or to an unreasonably long duration) so a manual change can't accidentally break flow at that junction.

Useful during an active incident: after Police/Ambulance marks an SOS location, they should be able to immediately extend/shorten wait times at nearby junctions to help clear the way, on top of the automatic "incident override" rebalancing.

Log each manual edit (who changed it, junction, old value, new value, timestamp) so the Planning Authority dashboard can review manual overrides later.

Notes for the build

This needs a real backend: a database for accounts/roles/incidents/SOS reports, an OTP delivery service (SMS/email), and live geolocation. Connect a backend (e.g. Supabase) to make OTP delivery and live tracking actually work — if that's not wired up yet, build the full UI/UX flow with realistic mock data first and mark clearly which parts need the backend connected to go live.

Match the existing site's colors, typography, and map-first layout — the new login and SOS elements should look like a natural extension of the current design, not a bolted-on feature.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://flowguardhelps.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1e520991-15ee-4b76-8ce9-4dab13d8399f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
