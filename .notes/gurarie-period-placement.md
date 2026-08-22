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
