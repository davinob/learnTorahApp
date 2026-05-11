# Admin mode (in-app editor + GitHub PR)

A hidden admin mode lets you edit the rendered HTML in place — fix
letters, move perush blocks (Gur Arye, Rashi notes, ...) around —
and submit the change as a Pull Request to the source repo.

This file documents both the user-facing flow and the internal
plumbing. The same feature exists in `learnTanahApp`; the two apps
are kept byte-identical except for `UpdateConfig.repo`.

## One-time setup (per repo, on GitHub)

Do this once for both `davinob/learnTorahApp` and `davinob/learnTanahApp`.

1. **Protect `master`**: Settings -> Branches -> Add rule for `master`:
   - Require a pull request before merging.
   - Restrict who can push to matching branches -> only you (or no one).
2. **Create a fine-grained PAT**: github.com -> Settings -> Developer
   settings -> Personal access tokens -> Fine-grained tokens -> Generate.
   - Resource owner: `davinob`.
   - Repository access: **Only select repositories** ->
     `learnTorahApp`, `learnTanahApp` (or one PAT per repo if you
     prefer; the app uses one token per app).
   - Repository permissions:
     - Contents: **Read and write**
     - Pull requests: **Read and write**
     - Metadata: **Read-only**
   - Expiration: pick a value you're comfortable with (e.g. 90 days).
3. Copy the token (starts with `github_pat_...`); you only see it once.

With `master` protected, the token cannot push to `master` even by
mistake. The worst case if a device is lost is unwanted PRs, which
you can close — and the token can be revoked from GitHub in one click.

## One-time setup (in the app, per device)

1. Open the app.
2. **Tap 5 times quickly (within 1.5 seconds) in the very top
   100px of the screen** (the status-bar margin / banner area).
   Long-press is intercepted by Android's WebView text selection,
   so we use a tap burst on a small invisible hot zone instead.
3. The first time, you set an **admin passphrase** (min 6 chars).
   On every subsequent unlock you'll be asked for that passphrase.
4. The page reloads in admin mode — a red **ADMIN** badge appears
   top-left and a toolbar appears at the bottom.
5. Tap the gear icon in the toolbar -> paste your GitHub PAT ->
   Save -> Test token. You should see "OK" and the repo name.

## Editing flow

In admin mode:

- Tap inside any pasuk to **type / fix letters** (it's contentEditable).
- Gur Arye spans stay collapsed exactly like normal mode — open them
  via their `[N]` footnote marker. When opened, they get a thin
  green dotted outline so you can spot them.
- To **move** a perush block (rashi, gurarie, onkelos, etc.):
  1. Tap **Select: OFF** on the toolbar so it turns green and reads
     **Select: ON**.
  2. Tap the block you want to move. It gets a dashed yellow outline.
  3. Tap **Cut** (or **Copy**). The toolbar flashes "Cut. Tap target
     block to paste after it." and every block on the page gets a
     thin blue dashed outline — you are now in **paste mode**.
  4. Tap the block after which the clipboard should be inserted.
     The block is pasted right below the target, paste mode ends.
  - On a desktop browser you can also hold **Shift** while clicking
    a block instead of toggling Select.
- Toolbar buttons:
  - **Select: OFF/ON**: toggle block-selection mode (mobile-friendly
    replacement for shift-click).
  - **Cut** / **Copy**: clipboard the selected block, then enter
    paste mode (next block tap pastes after it).
  - **Undo / Redo**: in-memory snapshot stack (~100 deep).
  - **Discard**: reload the page from disk, throwing away edits.
  - **Submit PR**: prompts for a short title, then opens a PR.
  - Gear: open admin settings (token, sign out).
  - **X**: exit admin mode (go back to read-only).
- All in-page modals can be dismissed by tapping the dark backdrop
  outside the white card (or pressing Escape on a desktop keyboard),
  so a stuck modal will never block the UI.

When you tap Submit, the app:
1. Asks GitHub for `master` HEAD's SHA.
2. Creates a blob with your edited file content.
3. Creates a tree based on `master` overriding that one file.
4. Creates a commit pointing at the new tree.
5. Creates a branch `admin-edit/<timestamp>-<slug>` pointing at the commit.
6. Opens a PR from that branch into `master`.
7. Shows you the PR URL.

You then review and merge on desktop as usual.

## Test plan (run once after setup)

For each app (`learnTorahApp`, `learnTanahApp`):

1. `flutter pub get`
2. Run on iOS simulator and on an Android device.
3. Tap 5 times quickly in the top 100px banner area, set passphrase, paste PAT, hit Test token.
4. Open Bereshit/1.html (or Yehoshua/1.html for Tanah).
5. Add an extra space inside a Hebrew word, then **Submit PR**.
   Verify a PR appears at github.com/davinob/<repo>/pulls.
6. Close the PR.
7. Repeat with a Gur Arye span: tap **Select: OFF** to turn it
   ON, tap the green-bordered gurarie span, then Down/Paste it
   into the next pasuk's Rashi block. Submit PR and verify the
   span (and its `[N]` marker) moved correctly in the diff.
8. Verify `master` was NOT pushed to directly.
9. Exit admin mode (X button) and confirm the toolbar is gone
   and editing no longer triggers.

## Files added / changed in this app

- `assets/html/js/admin.js` — editor toolbar, contentEditable, JS bridge calls.
- `assets/html/css/admin.css` — toolbar + selection styles.
- `assets/html/**/*.html` — `<link>` + `<script>` tags injected by
  `scripts/inject_admin_assets.py` (idempotent; safe to re-run).
- `lib/admin/admin_storage.dart` — secure storage of token + passphrase hash.
- `lib/admin/github_pr_service.dart` — the 7-step PR flow.
- `lib/admin/admin_settings_screen.dart` — token entry + test + sign out.
- `lib/admin/admin_bridge.dart` — JS bridge handler dispatching to the above.
- `lib/main.dart` — registers the AdminBridge on the WebView, holds a
  navigatorKey so the bridge can push routes.
- `lib/update_service.dart` — copies `css/admin.css` and `js/admin.js`
  into the local cache; manifest version bumped to 4 to force a re-copy.
- `pubspec.yaml` — `flutter_secure_storage: ^9.2.2`.
- `scripts/inject_admin_assets.py` — one-off (and idempotent) injector.

## Keeping the two apps in sync

The two apps share the **same** admin code. To prevent drift:

- `assets/html/js/admin.js`, `assets/html/css/admin.css`, every
  file under `lib/admin/`, and `scripts/inject_admin_assets.py`
  should be byte-identical between the two apps.
- The only intentional difference is `UpdateConfig.repo` in
  `lib/update_service.dart` (`learnTorahApp` vs `learnTanahApp`).
- Whenever you change anything admin-related in one app, copy it
  over to the other:

  ```bash
  cp learnTorahApp/lib/admin/*.dart   learnTanahApp/lib/admin/
  cp learnTorahApp/assets/html/js/admin.js   learnTanahApp/assets/html/js/admin.js
  cp learnTorahApp/assets/html/css/admin.css learnTanahApp/assets/html/css/admin.css
  cp learnTorahApp/scripts/inject_admin_assets.py learnTanahApp/scripts/inject_admin_assets.py
  ```

  Then re-run the injector in the target app if you added new HTML
  files there:

  ```bash
  cd learnTanahApp && python3 scripts/inject_admin_assets.py
  ```

## Risks and known limitations

- **Token leakage if device is lost** — token is stored in
  `flutter_secure_storage` (Keychain on iOS, EncryptedSharedPrefs on
  Android), but if the device is unlocked an attacker could open the
  app and exfiltrate. Mitigation: `master` is branch-protected, and
  the token can be revoked instantly on GitHub.
- **Stale local copy vs. remote** — the PR is always based on the
  current `master` HEAD, so a stale local copy still produces a clean
  diff against `master`. If `master` moved between your sync and your
  edit, the PR may need a manual rebase on desktop.
- **HTML serialization** — submitting uses `document.documentElement
  .outerHTML`. The browser may re-serialize attribute quoting (e.g.
  `'` -> `"`) which produces noisy first-time diffs on a file. After
  a file's first PR, subsequent diffs are clean.
- **Multi-file edits in one session** — currently, navigating to
  another file in admin mode does not preserve unsaved edits across
  pages. Submit before navigating.
