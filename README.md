# Pokémon Legends: Z-A Battle Lab

A static, responsive battle-data dashboard for the existing Cloudflare Pages deployment. No build step, API key or third-party runtime scripts are needed. Serve the repository root with `npm run serve` (Node 24 and Python 3), then open http://localhost:4173.

## Database coverage

- 554 explicit Pokémon/form records, including 97 Mega form records. Pumpkaboo and Gourgeist have four size records each; Mega Meowstic has distinct male/female records.
- 554 resolved stat records corroborated against PKHeX's pinned Z-A personal table. New size-form stats also agree with Serebii.
- 554 sourced form-specific move pools. 455 pools agree with the prior Pokémon Database pool after expanding size forms; 99 additional Mega/Primal pools come directly from explicit PKHeX form records. This does not certify full encounter, pre-evolution, event or competitive legality.
- 340 base moves, 340 explicit Plus variants and 105 boss-only reference variants. Core base fields agree between Bulbapedia and Serebii; all 340 base move types also agree with PKHeX. Frame, duration and raw range fields still have one source.
- 7,804 form-specific natural Plus-mastery level records and corroborated availability of all 340 Plus-capable base moves. Actual trainer mastery, Seed of Mastery usage and Alpha acquisition state are not inferred.

The [comparison notes](docs/SOURCE_COMPARISON.md) and [machine-readable comparison](source-comparison.json) preserve the prior counts, additions, reviewed form IDs, source commits, hashes and disagreements. No conflicting values were found in this merge.
The imported move table covers published DLC moves, but its source does not consistently identify DLC introduction versions. All counts are generated in `data-report.json`; the interface reads that report rather than hardcoding coverage claims.

## Recommendations and mechanics

**Experimental move suggestions are available; certified legal/optimal optimization remains locked.** The current evidence does not establish independently verified complete learnsets, complete acquisition history, actual Plus mastery, or the move table's frame timebase. Boss variants are never selectable as player moves. Unknown values remain null, with unresolved mappings and source conflicts exposed in the audit.

Select a Pokémon to see five recommendation cards: **Balanced**, **Quickest**, **Highest Damage**, **Sustained Damage**, and **Best Type Matchups**. Each card ranks sourced, modeled base moves against either the selected opponent or a neutral target (Defense/Sp. Def 100). Use a card to load up to four unique moves into the comparison. The comparison target follows the applied suggestion and can be changed explicitly. Pokémon, stat, level and target changes recalculate suggestions; an existing comparison is preserved with a reminder to reapply.

Quickest sorts by wind-up, then total animation frames, then effective cooldown. Highest Damage sorts by the direct-hit estimate. Sustained Damage sorts by damage / cooldown; this is a repeat-use proxy, **not battle DPS**, and does not combine frames with seconds. Balanced weights normalized damage (50%), inverse wind-up (25%, with +1 to handle zero-frame wind-up), and inverse cooldown (25%). Best Type Matchups sorts by type multiplier, then estimated damage. Each ranking reports up to eight candidates internally; the interface shows and applies the first four.

Suggestions exclude status moves, unknown/conflicting timings, unmodeled damage rules, immunities, boss moves and Plus variants. They use sourced learnability without claiming independently verified completeness. Missing data produces an explanation instead of invented recommendations. Mega/Primal suggestions now use their own sourced numeric-form pools. The optional **unverified inheritance** fallback is used only if a future form lacks a native source and has an unambiguous base form. Unknown future forms remain unavailable when that setting is off.

Manual four-move comparisons support editable actual battle stats, STAB, dual-type effectiveness, category-specific offensive/defensive stats, and Speed cooldowns. Levels up to 200 support Mega Dimension boosts. Stats initialize at level 50, 31 IVs, 0 EVs, neutral nature. Damage is a maximum-roll direct-hit estimate using the standard level/power/stat formula, not a fully validated Z-A damage simulator. Critical hits, item effects, random rolls, secondary effects, movement and scheduling are omitted. Special-rule damage moves are excluded. Multi-hit estimates assume every listed hit lands.

Frames remain frames: there is no invented FPS conversion. Range values retain source units and sentinel-looking values such as 99 without translating them into meters. Cooldown is `max(3, base - 3 * (Speed - 25) / 100)`, including speeds below 25, per [Bulbapedia's documented internal formula](https://bulbapedia.bulbagarden.net/wiki/Cooldown). The model uses JavaScript numeric precision rather than reproducing per-frame float32 countdowns.

The gated strategy engine implements four distinct scores over eligible base moves: Burst uses direct-hit damage; Fastest minimizes animation duration; Sustained DPS uses damage divided by animation plus cooldown; Balanced equally weights normalized damage and that DPS proxy. These are additive comparison scores, not rotation scheduling or a claim of optimal real battle play. Tests use synthetic complete fixtures to exercise the engine while real records remain gated.

## Import and validation

```sh
python -m pip install -r scripts/requirements.txt
python scripts/import_data.py
npm run check
python -m unittest discover -s tests -p 'test_*.py'
```

The normal import rebuilds the original reference layer and automatically reapplies `scripts/enrich_data.py`. Use `--base-only` only to inspect that original layer. To enrich an existing baseline directly, run `python scripts/enrich_data.py`; an unchanged repeat run preserves the original comparison audit. Imports cache HTML under ignored `.cache/sources`; `--offline` rebuilds from that cache. Pinned supplemental references are cached under `.cache/references`. The audit stores source URLs, SHA-256 hashes, byte counts, import time, counts, unresolved fields and conflicts. It does not replace missing values with guesses. The source's identical duplicate Hyper Voice R row is collapsed by exact equality; conflicting duplicate IDs abort the import. Some boss variants have no corresponding player base move in the published table and remain reference-only.

Browser regression checks:

```sh
python -m pip install playwright==1.62.0
python -m playwright install --with-deps chromium webkit
mkdir -p test-results
python tests/browser_smoke.py
```

The suite checks Chromium desktop and WebKit with iPad and iPhone profiles, selectors, filters, source gates, manual comparisons, stat edits, duplicates, overflow and failed data loading. WebKit emulation is not a physical-device Safari certification. GitHub Actions repeats data validation, unit tests and browser checks on pushes/PRs.

## Sources and attribution

- [PKHeX Z-A data at the pinned commit](https://github.com/kwsch/PKHeX/tree/5bfb32305c8af70e5885f6ac0800e50b3867f197/PKHeX.Core): form identities, stats, level-up arrays, TM permissions, move types and Plus-mastery data.
- [PokeZACatchCalc pinned database](https://github.com/TheFauxDreamer/PokeZACatchCalc/blob/aeae99bc1f4a6bdfffdbad7c5fb11b58905c06e0/pokemon-legends-za-data.json): corroborating 210 original-game stat records; its upstream data cites RotomLabs. It is not treated as a full DLC or move database.

- [Bulbapedia Z-A move table](https://bulbapedia.bulbagarden.net/wiki/List_of_moves_in_Pok%C3%A9mon_Legends%3A_Z-A): numeric IDs, variants, power, timings and raw ranges.
- [Serebii Z-A stat changes](https://www.serebii.net/legendsz-a/updatedstats.shtml): explicit game-specific overrides for Meditite, Medicham, Mega Medicham and Mega Mawile, applied over standard species stats.
- [Serebii Z-A attacks](https://www.serebii.net/legendsz-a/attacks.shtml): independent base move field comparisons.
- [Pokémon Database Z-A dex](https://pokemondb.net/pokedex/game/legends-z-a), [Mega Dimension dex](https://pokemondb.net/pokedex/game/legends-z-a/mega-dimension), linked species pages and their generation 9 **Z-A tabs**: stats and learnsets.
- Bulbapedia's [Lumiose](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_Lumiose_Pok%C3%A9dex_number), [Hyperspace](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_Hyperspace_Pok%C3%A9dex_number), and [Mega Evolution](https://bulbapedia.bulbagarden.net/wiki/Mega_Evolution_Pok%C3%A9dex) dexes: form availability.

Bulbapedia contributions are attributed under [CC BY-NC-SA 2.5](https://bulbapedia.bulbagarden.net/wiki/Bulbapedia:Copyrights). Source links are retained in imported records; no third-party artwork is bundled. Pokémon names and marks belong to their respective owners.

See [the implementation plan](docs/IMPLEMENTATION_PLAN.md) for remaining research gates.
