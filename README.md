# Pokémon Legends: Z-A Battle Lab

A static, responsive battle-data dashboard for the existing Cloudflare Pages deployment. No build step, API key or third-party runtime scripts are needed. Serve the repository root with `npm run serve` (Node 24 and Python 3), then open http://localhost:4173.

## Database coverage

- 525 species/form records from the Lumiose, Hyperspace and Mega Evolution Pokédexes, including 74 Mega records.
- 523 resolved stat records. Pumpkaboo and Gourgeist have unresolved size selection, so their stats remain unknown.
- 340 base moves, 340 explicit Plus variants, and 105 boss-only reference variants. Base type, category, power and cooldown agree between Bulbapedia and Serebii for all 340 moves. Frames, duration and raw range values have one source.
- 449 species/form learnset records extracted exclusively from Pokémon Database's **Legends: Z-A** section. Shared tables and form-specific tabs are distinguished. Learnset completeness is not independently certified; Mega/Primal inheritance is not assumed.

The imported move table covers published DLC moves, but its source does not consistently identify DLC introduction versions. All counts are generated in `data-report.json`; the interface reads that report rather than hardcoding coverage claims.

## Recommendations and mechanics

**Four-move recommendations remain locked.** The current evidence does not establish independently verified complete learnsets, form inheritance, Plus unlocks, or the move table's frame timebase. Boss variants are never selectable as player moves. Unknown values remain null, with unresolved mappings and source conflicts exposed in the audit.

Manual four-move comparisons support editable actual battle stats, STAB, dual-type effectiveness, category-specific offensive/defensive stats, and Speed cooldowns. Stats initialize at level 50, 31 IVs, 0 EVs, neutral nature. Damage is a maximum-roll direct-hit estimate using the standard level/power/stat formula, not a fully validated Z-A damage simulator. Critical hits, item effects, random rolls, secondary effects, movement and scheduling are omitted. Special-rule damage moves are excluded. Multi-hit estimates assume every listed hit lands.

Frames remain frames: there is no invented FPS conversion. Range values retain source units and sentinel-looking values such as 99 without translating them into meters. Cooldown is `max(3, base - 3 * (Speed - 25) / 100)`, including speeds below 25, per [Bulbapedia's documented internal formula](https://bulbapedia.bulbagarden.net/wiki/Cooldown). The model uses JavaScript numeric precision rather than reproducing per-frame float32 countdowns.

The gated strategy engine implements four distinct scores over eligible base moves: Burst uses direct-hit damage; Fastest minimizes animation duration; Sustained DPS uses damage divided by animation plus cooldown; Balanced equally weights normalized damage and that DPS proxy. These are additive comparison scores, not rotation scheduling or a claim of optimal real battle play. Tests use synthetic complete fixtures to exercise the engine while real records remain gated.

## Import and validation

```sh
python -m pip install -r scripts/requirements.txt
python scripts/import_data.py
npm run check
```

Imports cache HTML under ignored `.cache/sources`; `--offline` rebuilds from that cache. The audit stores source URLs, SHA-256 hashes, byte counts, import time, counts, unresolved fields and conflicts. It does not replace missing values with guesses. The source's identical duplicate Hyper Voice R row is collapsed by exact equality; conflicting duplicate IDs abort the import. Some boss variants have no corresponding player base move in the published table and remain reference-only.

Browser regression checks:

```sh
python -m pip install playwright==1.62.0
python -m playwright install --with-deps chromium webkit
mkdir -p test-results
python tests/browser_smoke.py
```

The suite checks Chromium desktop and WebKit with iPad and iPhone profiles, selectors, filters, source gates, manual comparisons, stat edits, duplicates, overflow and failed data loading. WebKit emulation is not a physical-device Safari certification. GitHub Actions repeats data validation, unit tests and browser checks on pushes/PRs.

## Sources and attribution

- [Bulbapedia Z-A move table](https://bulbapedia.bulbagarden.net/wiki/List_of_moves_in_Pok%C3%A9mon_Legends%3A_Z-A): numeric IDs, variants, power, timings and raw ranges.
- [Serebii Z-A attacks](https://www.serebii.net/legendsz-a/attacks.shtml): independent base move field comparisons.
- [Pokémon Database Z-A dex](https://pokemondb.net/pokedex/game/legends-z-a), [Mega Dimension dex](https://pokemondb.net/pokedex/game/legends-z-a/mega-dimension), linked species pages and their generation 9 **Z-A tabs**: stats and learnsets.
- Bulbapedia's [Lumiose](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_Lumiose_Pok%C3%A9dex_number), [Hyperspace](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_Hyperspace_Pok%C3%A9dex_number), and [Mega Evolution](https://bulbapedia.bulbagarden.net/wiki/Mega_Evolution_Pok%C3%A9dex) dexes: form availability.

Bulbapedia contributions are attributed under [CC BY-NC-SA 2.5](https://bulbapedia.bulbagarden.net/wiki/Bulbapedia:Copyrights). Source links are retained in imported records; no third-party artwork is bundled. Pokémon names and marks belong to their respective owners.

See [the implementation plan](docs/IMPLEMENTATION_PLAN.md) for remaining research gates.
