# 真实设备验收清单

## Release state

- Preview: `https://japanese-tool-7y2vsc4r9-zrq-projects1.vercel.app`
- Preview deployment ID: `dpl_73jSyHz3LzSBapovuQDziPEtck3H`
- Candidate code commit: `9c4da88585534db716a70acacb09e77f68da7bc5`
- Candidate aggregate SHA-256: `261b4c457b4288672eb1139fb0421cfc83215c2016bf20a67cc709a6918f6823`
- Production: `https://yomeru.japanese-hub.com`
- Production action: none
- Release status: `HOLD`

## Mac Safari

1. Open the Preview in a Private Browsing window, or clear this site's cache and storage first.
2. Paste the agreed test article and start reading.
3. Click `显示假名` and record the elapsed time until all furigana finishes rendering.
4. Confirm a processing message appears immediately after the click.
5. Reload and process the same article a second time; record the warm-load elapsed time.
6. Verify all of the following:
   - `三菱` is read as `みつびし`.
   - `UFJ` is not given incorrect furigana.
   - `時価総額` has a usable meaning.
   - `総額` has a usable meaning.
   - `金融機関` has a usable meaning.
   - `半導体` has a usable meaning.
   - `メモリー` has a usable meaning.
   - JMdict English meanings and `JMdict / EDRDG` attribution appear where applicable.
   - Saving a word preserves the looked-up reading and meaning in the vocabulary list.
   - No user-visible area contains `kuromoji`.
   - Unknown vocabulary levels display `未分级`.
   - Flashcards do not display internal technical fields.

Record:

- Safari version:
- Cold-load furigana time:
- Warm-load furigana time:
- Result: PASS / FAIL
- Notes or screenshots:

## iPhone Safari

- Device: `MLE23CH/A`
- iOS: `26.4.2`

Test the Preview under each condition:

1. First cold load after clearing site data.
2. Second warm load of the same article.
3. Slow-network condition.
4. Confirm there is no white screen, freeze, or unrecoverable loading state.
5. Verify furigana, meanings, saving, vocabulary list, and flashcards.
6. Confirm the page does not display `kuromoji`, `worker`, `tokenizer`, or `fallback`.
7. Confirm words without a JLPT level display `未分级`.

Record:

- Cold-load furigana time:
- Warm-load furigana time:
- Slow-network result:
- Result: PASS / FAIL
- Notes or screenshots:

## Gate

Keep release status at `HOLD` until both Mac Safari and iPhone Safari checks are completed and reviewed. Do not deploy Production, change the production alias, change the custom domain, or merge to `main` before that review.
