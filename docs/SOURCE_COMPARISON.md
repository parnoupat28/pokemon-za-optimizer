# Z-A database comparison and merge — 2026-10-31

The supplemental merge compares the existing Pokémon Database/Bulbapedia/Serebii dataset with PKHeX's explicit Z-A tables, the original-game PokeZACatchCalc database, and additional Serebii form pages. References are joined by reviewed National Pokédex ID and numeric form index, never by matching stats alone.

| Coverage | Previous | Merged |
| --- | ---: | ---: |
| Pokémon/form records | 547 | 554 |
| Resolved stat records | 545 | 554 |
| Sourced form-specific move pools | 449 | 554 |
| Base / Plus / boss move variants | 340 / 340 / 105 | 340 / 340 / 105 |
| Form-specific natural Plus-mastery levels | 0 | 7,804 |

Eight explicit Pumpkaboo/Gourgeist size records replace two ambiguous records. Two Mega Meowstic sex forms replace one combined record: its male and female move pools differ even though their base stats agree. Thus the roster grows by seven records. Retired IDs and replacement IDs are recorded in `source-comparison.json`.

## Source selection

- **PKHeX**, commit [`5bfb32305c8af70e5885f6ac0800e50b3867f197`](https://github.com/kwsch/PKHeX/tree/5bfb32305c8af70e5885f6ac0800e50b3867f197): the `personal_za`, `lvlmove_za.pkl`, and `plus_za.pkl` resources plus their reader schemas, form converter and Z-A move type array. These are specifically the Z-A resources, including Mega Dimension data. Generic Scarlet/Violet learnsets are excluded. The source code is GPL-3.0; [upstream license](https://github.com/kwsch/PKHeX/blob/5bfb32305c8af70e5885f6ac0800e50b3867f197/LICENSE). The importer implements a small independent reader of the documented resource layouts rather than importing application code.
- **PokeZACatchCalc**, commit [`aeae99bc1f4a6bdfffdbad7c5fb11b58905c06e0`](https://github.com/TheFauxDreamer/PokeZACatchCalc/tree/aeae99bc1f4a6bdfffdbad7c5fb11b58905c06e0): 210 original-game factual records, internally labeled Legends: Z-A. The records reference RotomLabs metadata. They corroborate matching species/form stats; they are not promoted to full DLC coverage, timing evidence or learnsets. No third-party application code is imported.
- **Serebii** [Pumpkaboo](https://www.serebii.net/pokedex-sv/pumpkaboo/), [Gourgeist](https://www.serebii.net/pokedex-sv/gourgeist/), and [Meowstic](https://www.serebii.net/pokedex-sv/meowstic/) pages: corroborating stat rows for the ten replacement form records. Meowstic reads the Z-A section. The size rows agree with the Z-A personal table; the site uses “Variety” labels for these sizes.

An agreeing value establishes corroboration across these references, not proof that their upstream research was independent. Every supplemental URL has a checksum and byte count in the machine-readable audit.

## What the comparison established

- All 554 current forms have reviewed numeric mappings and match their Z-A presence flags.
- All 554 stat records are corroborated. No existing stat or type was overwritten to resolve a disagreement.
- 455 prior/reference move pools agree with the PKHeX level-up/TM union, including the expanded size forms. Acquisition availability also agrees after normalizing source levels 0 and 1 to starting availability. Raw level-zero reminder/evolution trigger semantics remain uncertified.
- 99 additional pools come from native Mega/Primal table entries. They do not require an assumption that a base form's moves carry over.
- All 340 base move types agree with PKHeX; its Plus-capable move list corroborates all 340 Plus variants. This supplies no independent frame or range verification.
- Natural Plus-mastery levels are stored per form in `learnsets.json`. Natural mastery levels do not establish whether an individual Pokémon has mastered a move or used a Seed of Mastery.

The audit reports **zero unresolved conflicts** for this merge. Pool membership and acquisition availability are checked separately. `complete` remains false: encounter, event, pre-evolution history and competitive eligibility are outside this merge's certification. Plus and boss variants remain excluded from automatic suggestions. No FPS value or missing timing was invented.

## Reproduction and review

```sh
python -m pip install -r scripts/requirements.txt
python scripts/import_data.py          # rebuild references, then apply supplemental merge
python scripts/enrich_data.py --dry-run  # compare without modifying live database files
python scripts/enrich_data.py --offline # reuse cached references; unchanged runs are a no-op
npm run check
python -m unittest discover -s tests -p 'test_*.py'
```

The normal importer reapplies the supplemental layer so a refresh cannot silently discard it. Supplemental binary and HTML snapshots are cached outside deployment under `.cache/references`. The audit preserves the baseline commit and input file hashes. `sources/pkhex-form-map.json` exposes every reviewed identity mapping. No blanket completeness or frame-verification flag is enabled by this merge.
