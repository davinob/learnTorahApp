# Gur Arye markers missed their lemma because of a Rashi period

Rashi writes the dibbur with a period (`ועמד. בעמידה`). Gur Arye
quotes the same words without that period (`ועמד בעמידה`). The original
injector did a literal substring search, failed to find the lemma, and
dropped `[n]` later in the same Rashi — often after the next dibbur.

On כי תצא / 7, Devarim 25:8, that produced:

`ועמד. בעמידה: ואמר. בלשון הקודש, ואף [1] היא דבריה [2]`

`[1]` comments on `ועמד בעמידה`, so it now sits immediately after that
phrase:

`ועמד. בעמידה[1]: ואמר. בלשון הקודש, ואף היא דבריה [2]`

The same punctuation-insensitive rematch (ignore `.` / `,` / `:`
between lemma words; require a tight hit with no extra Hebrew in
between) moved 66 markers across 56 pages.

A second pass treated *any* non-word junk as a separator, not just `.`:

- a Siftei Chachamim `(ז)` / hidden span between lemma words
  (`אל תונו. זו אונאת (ז) … ממון`)
- a `<small>` citation in the middle of the lemma
- the lemma present as an exact phrase, but `[n]` still dropped later
  in the same Rashi (`בראשית הכל`, `היום לעשותם`, …)

That moved another 56 markers across 34 pages. A rematch after the
pass found no remaining cases of this class.
