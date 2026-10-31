# Implementation plan

1. Replace the inherited 210 roster / 161 move records with source-backed imports of the Lumiose, Hyperspace and Mega Evolution dexes and all published move variants. Keep stable IDs, field sources, checksums, retrieval dates and a coverage report. Do not infer DLC introduction dates or Plus eligibility.
2. Import only the Legends: Z-A section of species learnsets. Keep acquisition methods; require explicit review for form inheritance and completeness. Exclude boss variants from player selections.
3. Separate pure mechanics from rendering. Test type immunity, dual types, category-specific stats, STAB, stat conversion, cooldown boundaries and recommendation gates. Treat damage as a direct-hit model with stated exclusions.
4. Build a responsive dashboard with labeled inputs, filtered/sortable move exploration, source links, four unique comparison slots, frame timelines and damage/cooldown charts. Preserve unknown values.
5. Exercise Chromium and WebKit at desktop, phone and iPad sizes, data failures and empty searches. Validate JSON relationships offline and run checks in CI.
6. Commit and push to main for the existing Cloudflare Pages connection. Report what remains unverified; do not call a four-move set legal or optimal before its required evidence is complete.

## Follow-up research gates

- Independently audit per-form learnset inheritance and all acquisition methods.
- Establish the reference frame timebase before converting frames to seconds.
- Resolve cross-source conflicts and specialized damage behavior.
- Verify Plus unlocks, Mega Z behavior, movement, animation cancellation and cooldown scheduling before claiming full battle optimization.

## 2026-10-31: Experimental move suggestions

Implemented a separate evidence-limited suggestion engine with five live strategy cards and one-click comparison loading. It ranks sourced base moves with no inferred FPS conversion or legal/optimal certification. Unverified Mega/Primal inheritance requires explicit opt-in and an unambiguous source form. The strict certified optimizer and original dataset verification flags remain unchanged. Tests cover ranking objectives, immunity, missing stats/timings, neutral targets, form source boundaries and mobile browser interactions.

## 2026-10-31: Supplemental database comparison

Added pinned PKHeX Z-A resources, a pinned original-game catch-calculator comparison, and Serebii size/form stat corroboration. Replaced three ambiguous identities with ten explicit forms; added 99 native Mega/Primal move pools and 7,804 natural Plus-mastery levels. Pool membership and normalized acquisition availability agree for 455 prior/reference pools. The machine-readable audit retains before/after counts, reviewed numeric mappings, source hashes and conflicts. Reimports reapply the enrichment; exact repeats are a no-op. Full encounter/event legality, trainer mastery state and animation timebase remain outside certification.
