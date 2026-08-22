# Ki Tetze 7 — broken Gur Arye `[2]`

When Gur Arye was first injected (`0d85470`), the `[2]` block on
Devarim 25:8 (`ואמר בלשון הקודש`) was spliced into the opening tag of
Siftei Chachamim 630. The page rendered as:

`היא דבריה [2]'> בלשון הקודש`

and tapping `[2]` did nothing, because the click handler never closed.

Restored the two sibling markers:

- `[2]` → `gur_25_8_2` (Gur Arye)
- `(ר)` → `630` (Siftei Chachamim), the letter from before the injection

A full scan of `assets/html/**/*.html` found no other leftover
`onclick='hideShowById  …` / orphan siftey / orphan gurarie cases.
`learnTanahApp` is clean of this pattern too.
