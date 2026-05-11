// ============================================================
// Admin editor for Torah/Tanah HTML pages.
//
// Activation:
//   - On every page load, admin.js asks Flutter (via the
//     AdminBridge JS handler, action `isAdminActive`) whether the
//     admin session is already unlocked. If yes, it activates
//     silently with NO prompt - so navigating between pasukim
//     never re-prompts for the passphrase.
//   - Five quick taps (within 1.5s, in the top 100px banner)
//     trigger `requestAdminUnlock`, which prompts for the passphrase
//     once. After that, the Flutter bridge holds the unlocked flag
//     in memory until the user taps the toolbar X or the app dies.
//   - We avoid long-press because the Android WebView intercepts
//     long-press for native text selection.
//
// Editing model:
//   - Children of `.newPassuk` are made contentEditable so the
//     user can fix letters in place.
//   - A floating toolbar with a "Select" toggle lets the user
//     pick a perush block (rashi / gurarie / onkelos / sforno /
//     ...) and cut, copy, paste, or move it up/down.
//   - On desktop, holding Shift while clicking a block also
//     selects it (no need to flip the toggle).
//
// Submit:
//   - Calls window.flutter_inappwebview.callHandler('AdminBridge',
//     { action: 'submitEdit', filePath, newContent, message })
//   - Flutter handles the GitHub PR creation.
// ============================================================

(function () {
	"use strict";

	var EDITABLE_BLOCK_CLASSES = [
		"passukIvrit", "passukFr", "passukEn",
		"onkelos", "yonatan", "rashi", "siftey",
		"ibnEzra", "ramban", "sforno", "baalHaturim",
		"orHaHaim", "kliYakar", "daatZkenim", "haemekDavar",
		"abarbanel", "rashbam", "gurarie", "malbim",
		"mezudatDavid", "mezudatZion", "ralbag", "radak",
	];

	var TAP_BURST_COUNT = 5;        // taps required
	var TAP_BURST_WINDOW_MS = 1500; // within this window
	var TAP_HOT_ZONE_HEIGHT = 100;  // taps must land in the top N px

	// Per-tab state.
	var state = {
		active: false,
		selectMode: false,    // when true, tap selects a block instead of typing
		pasteMode: false,     // when true, tap pastes clipboard after the tapped block
		selectedEl: null,
		clipboardHtml: null,
		undoStack: [],
		redoStack: [],
		toolbarEl: null,
		pendingEdits: {}, // filePath -> outerHTML; used if you want multi-file batch later
	};

	function log() {
		try {
			var args = ["[admin]"];
			for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
			console.log.apply(console, args);
		} catch (e) {}
	}

	function hasFlutterBridge() {
		return typeof window.flutter_inappwebview !== "undefined" &&
			typeof window.flutter_inappwebview.callHandler === "function";
	}

	function callBridge(payload) {
		if (!hasFlutterBridge()) {
			log("callBridge: no bridge", payload);
			showInfoModal("Admin bridge", "Admin bridge not available (run inside the app).");
			return Promise.reject(new Error("no bridge"));
		}
		log("callBridge ->", payload);
		return window.flutter_inappwebview.callHandler("AdminBridge", payload);
	}

	// Returns "Bereshit/1.html" style path from the current URL.
	function getCurrentFilePath() {
		var path = window.location.pathname || "";
		var markers = ["/html_content/", "/assets/html/"];
		for (var i = 0; i < markers.length; i++) {
			var idx = path.indexOf(markers[i]);
			if (idx >= 0) {
				return decodeURIComponent(path.substring(idx + markers[i].length));
			}
		}
		// Fallback: just the file name.
		var parts = path.split("/");
		return decodeURIComponent(parts.slice(-2).join("/"));
	}

	// ============================================================
	// Tap-burst hot zone to open the admin gateway.
	//
	// 5 quick taps in the top 100px of the screen within 1.5s.
	// The hot zone is invisible to non-admins. We use touchend
	// (not click) because the click event can be cancelled by the
	// WebView's text-selection gesture on Android.
	// ============================================================

	function installTapBurstHandler() {
		var taps = [];

		function record(y) {
			if (y > TAP_HOT_ZONE_HEIGHT) {
				taps.length = 0;
				return;
			}
			var now = Date.now();
			taps.push(now);
			while (taps.length > 0 && now - taps[0] > TAP_BURST_WINDOW_MS) {
				taps.shift();
			}
			if (taps.length >= TAP_BURST_COUNT) {
				taps.length = 0;
				triggerUnlock();
			}
		}

		document.addEventListener("touchend", function (e) {
			var t = (e.changedTouches && e.changedTouches[0]) || null;
			if (!t) return;
			record(t.clientY || 0);
		}, { passive: true, capture: true });

		document.addEventListener("mouseup", function (e) {
			record(e.clientY || 0);
		}, true);
	}

	function triggerUnlock() {
		if (state.active) {
			log("triggerUnlock: already active, ignoring tap-burst");
			return;
		}
		if (!hasFlutterBridge()) {
			showInfoModal("Admin bridge", "Admin bridge not available (need to run inside the app).");
			return;
		}
		log("triggerUnlock: requesting admin unlock");
		callBridge({ action: "requestAdminUnlock" })
			.then(function (granted) {
				log("triggerUnlock result =", granted);
				if (granted === true || granted === "true") {
					activate();
				}
			})
			.catch(function (err) {
				log("triggerUnlock error", err);
			});
	}

	// ============================================================
	// Editable surface
	// ============================================================

	function makeEditable() {
		var passukim = document.getElementsByClassName("newPassuk");
		for (var i = 0; i < passukim.length; i++) {
			passukim[i].setAttribute("contenteditable", "true");
			// Don't let inline buttons/links be activated while editing.
			passukim[i].setAttribute("spellcheck", "false");
		}
	}

	// Capture the current document body so we can roll back to it.
	// We snapshot the body's innerHTML EXCLUDING any admin chrome
	// (toolbar, badge, modals) - those get rebuilt fresh on restore.
	function captureBody() {
		var clone = document.body.cloneNode(true);
		var dropIds = ["adminToolbar", "adminBadge", "adminModal"];
		for (var i = 0; i < dropIds.length; i++) {
			var n = clone.querySelector("#" + dropIds[i]);
			if (n && n.parentNode) n.parentNode.removeChild(n);
		}
		// Also drop the runtime-only classes so a restore doesn't
		// re-flag the body as "still in admin mode" by itself.
		clone.classList.remove("admin-active");
		clone.classList.remove("admin-select-mode");
		clone.classList.remove("admin-paste-mode");
		return clone.innerHTML;
	}

	function snapshot() {
		try {
			state.undoStack.push(captureBody());
			if (state.undoStack.length > 50) state.undoStack.shift();
			state.redoStack.length = 0;
			log("snapshot taken, undo depth =", state.undoStack.length);
		} catch (e) {
			log("snapshot error:", e && e.message);
		}
	}

	// Replace the body content with `html` and rewire admin mode. This
	// preserves the toolbar / admin state without doing a destructive
	// document.open() + document.write() (which kicks the WebView).
	function restoreBody(html) {
		// Stash and re-attach admin chrome so it doesn't disappear.
		var toolbar = document.getElementById("adminToolbar");
		var badge = document.getElementById("adminBadge");
		var modal = document.getElementById("adminModal");
		document.body.innerHTML = html;
		if (toolbar) document.body.appendChild(toolbar);
		if (badge) document.body.appendChild(badge);
		if (modal) document.body.appendChild(modal);
		document.body.classList.add("admin-active");
		if (state.selectMode) document.body.classList.add("admin-select-mode");
		if (state.pasteMode) document.body.classList.add("admin-paste-mode");
		// New nodes need contenteditable + listeners; old global click
		// listener still works because it's on `document`.
		makeEditable();
		state.selectedEl = null;
		updateToolbarSelectionLabel();
	}

	function undo() {
		log("undo tapped, undo depth =", state.undoStack.length);
		if (state.undoStack.length === 0) {
			flashToolbar("Nothing to undo");
			return;
		}
		state.redoStack.push(captureBody());
		var prev = state.undoStack.pop();
		restoreBody(prev);
		flashToolbar("Undone");
	}

	function redo() {
		log("redo tapped, redo depth =", state.redoStack.length);
		if (state.redoStack.length === 0) {
			flashToolbar("Nothing to redo");
			return;
		}
		state.undoStack.push(captureBody());
		var next = state.redoStack.pop();
		restoreBody(next);
		flashToolbar("Redone");
	}

	// ============================================================
	// Selection
	// ============================================================

	function clearSelectionStyle() {
		if (state.selectedEl) {
			state.selectedEl.classList.remove("admin-selected");
			state.selectedEl = null;
		}
	}

	function findEditableAncestor(el) {
		while (el && el !== document.body) {
			if (el.classList) {
				for (var i = 0; i < EDITABLE_BLOCK_CLASSES.length; i++) {
					if (el.classList.contains(EDITABLE_BLOCK_CLASSES[i])) {
						return el;
					}
				}
			}
			el = el.parentElement;
		}
		return null;
	}

	function onDocumentClick(e) {
		if (!state.active) return;
		if (state.toolbarEl && state.toolbarEl.contains(e.target)) return;
		if (e.target.closest && e.target.closest("#adminModal")) return;

		if (state.pasteMode) {
			e.preventDefault();
			e.stopPropagation();
			var inserted = pasteAtCaret(e.clientX, e.clientY);
			if (inserted === "no-clipboard") {
				showInfoModal("Empty clipboard", "Cut or copy a block first.");
			} else if (inserted === "no-target") {
				showInfoModal("Bad target", "Tap inside a perush block (e.g. inside the Rashi text) to choose where to paste.");
				return; // keep paste mode on so user can try again
			} else {
				flashToolbar("Pasted");
			}
			setPasteMode(false);
			return;
		}

		if (!state.selectMode && !e.shiftKey) return;
		var block = findEditableAncestor(e.target);
		log("click in SELECT mode, ancestor =", describeBlock(block));
		if (!block) return;
		e.preventDefault();
		e.stopPropagation();
		clearSelectionStyle();
		state.selectedEl = block;
		block.classList.add("admin-selected");
		updateToolbarSelectionLabel();
	}

	function setSelectMode(on) {
		state.selectMode = !!on;
		if (state.selectMode) setPasteMode(false);
		if (document.body) {
			document.body.classList.toggle("admin-select-mode", state.selectMode);
		}
		var btn = document.getElementById("adminSelectToggle");
		if (btn) {
			btn.textContent = state.selectMode ? "Select: ON" : "Select: OFF";
			btn.classList.toggle("admin-toggle-on", state.selectMode);
		}
		updateToolbarSelectionLabel();
	}

	function setPasteMode(on) {
		state.pasteMode = !!on;
		if (document.body) {
			document.body.classList.toggle("admin-paste-mode", state.pasteMode);
		}
		updateToolbarSelectionLabel();
	}

	function updateToolbarSelectionLabel() {
		var label = document.getElementById("adminSelectionLabel");
		if (!label) return;
		if (state.pasteMode) {
			label.textContent = "Paste: tap exact spot";
		} else if (state.selectedEl) {
			var classes = state.selectedEl.className || "";
			label.textContent = "Selected: " + classes.split(" ")[0];
		} else if (state.selectMode) {
			label.textContent = "Select mode: tap a block";
		} else {
			label.textContent = "Tap Select, then a block";
		}
	}

	// ============================================================
	// Block operations
	// ============================================================

	function describeBlock(el) {
		if (!el) return "(none)";
		var cls = (el.className || "").split(" ")[0];
		var id = el.id ? "#" + el.id : "";
		return el.tagName + "." + cls + id;
	}

	function ensureSelected() {
		if (!state.selectedEl) {
			log("ensureSelected: no block selected");
			showInfoModal("No selection", "Tap 'Select' on the toolbar, then tap a block to pick it.");
			return false;
		}
		return true;
	}

	// For perush spans that are paired with a footnote marker
	// (`<span onclick='hideShowById("ID")'>[N]</span>` + 
	//  `<span id='ID' class='gurarie' style='display:none'>...</span>`),
	// find the marker so cut/copy/paste move BOTH together.
	// Returns null if there's no matching marker.
	function findFootnoteMarkerFor(perushSpan) {
		if (!perushSpan || !perushSpan.id) return null;
		var id = perushSpan.id;
		// Walk siblings backward looking for an onclick that mentions our id.
		var sib = perushSpan.previousSibling;
		var hops = 0;
		while (sib && hops < 6) {
			if (sib.nodeType === 1) {
				var oc = sib.getAttribute && sib.getAttribute("onclick");
				if (oc && oc.indexOf('"' + id + '"') >= 0) return sib;
				if (oc && oc.indexOf("'" + id + "'") >= 0) return sib;
				hops++;
			}
			sib = sib.previousSibling;
		}
		// Fallback: scan the whole document for the matching onclick.
		var all = document.querySelectorAll("[onclick]");
		for (var i = 0; i < all.length; i++) {
			if (all[i] === perushSpan) continue;
			var s = all[i].getAttribute("onclick") || "";
			if (s.indexOf('"' + id + '"') >= 0 || s.indexOf("'" + id + "'") >= 0) {
				return all[i];
			}
		}
		return null;
	}

	// Build the "cut group" for the current selection: an array of
	// nodes that belong together. For a marker-paired span (e.g.
	// gurarie / siftey hidden block) we cut the marker + the span.
	// Otherwise just the selection itself.
	function selectionGroup() {
		var sel = state.selectedEl;
		if (!sel) return [];
		// Only auto-pair if the selection is a hidden span with an id.
		var isPaired = sel.tagName === "SPAN" && sel.id &&
			(sel.classList.contains("gurarie") ||
				sel.classList.contains("siftey"));
		if (!isPaired) return [sel];
		var marker = findFootnoteMarkerFor(sel);
		if (!marker) return [sel];
		// Order: marker first, then perush span (visual reading order).
		// We sort by document position to be safe.
		if (marker.compareDocumentPosition(sel) & Node.DOCUMENT_POSITION_FOLLOWING) {
			return [marker, sel];
		}
		return [sel, marker];
	}

	function groupOuterHtml(nodes) {
		var html = "";
		for (var i = 0; i < nodes.length; i++) {
			html += nodes[i].outerHTML;
		}
		return html;
	}

	function cutBlock() {
		log("cutBlock tapped, selected =", describeBlock(state.selectedEl));
		if (!ensureSelected()) return;
		snapshot();
		var group = selectionGroup();
		log("cutBlock group size =", group.length);
		state.clipboardHtml = groupOuterHtml(group);
		for (var i = 0; i < group.length; i++) {
			if (group[i].parentNode) group[i].parentNode.removeChild(group[i]);
		}
		state.selectedEl = null;
		setPasteMode(true);
		flashToolbar(group.length > 1
			? "Cut " + group.length + " linked nodes. Tap exact spot to paste."
			: "Cut. Tap exact spot inside a block to paste there.");
		log("cutBlock done, paste mode = ON, clipboard length =",
			state.clipboardHtml.length);
	}

	function copyBlock() {
		log("copyBlock tapped, selected =", describeBlock(state.selectedEl));
		if (!ensureSelected()) return;
		var group = selectionGroup();
		log("copyBlock group size =", group.length);
		state.clipboardHtml = groupOuterHtml(group);
		flashToolbar(group.length > 1
			? "Copied " + group.length + " linked nodes. Tap exact spot to paste."
			: "Copied. Tap exact spot inside a block to paste there.");
		setPasteMode(true);
		log("copyBlock done, paste mode = ON");
	}

	// Returns a Range located exactly at the (x,y) tap coordinates.
	// Tries the modern API first, then the legacy one. Returns null if
	// the platform supports neither.
	function caretRangeAt(x, y) {
		if (typeof document.caretRangeFromPoint === "function") {
			return document.caretRangeFromPoint(x, y);
		}
		if (typeof document.caretPositionFromPoint === "function") {
			var p = document.caretPositionFromPoint(x, y);
			if (!p) return null;
			var r = document.createRange();
			r.setStart(p.offsetNode, p.offset);
			r.collapse(true);
			return r;
		}
		return null;
	}

	// Paste the clipboard content right at the tap (x,y). Returns:
	//   "ok"           -> inserted at caret
	//   "no-clipboard" -> nothing in clipboard
	//   "no-target"    -> tap landed outside any editable block
	function pasteAtCaret(x, y) {
		log("pasteAtCaret at", x, y,
			"clipboard length =", state.clipboardHtml ? state.clipboardHtml.length : 0);
		if (!state.clipboardHtml) return "no-clipboard";
		var range = caretRangeAt(x, y);
		// Validate that the caret is actually inside an editable block
		// (otherwise we'd paste into the toolbar / nav / etc.).
		var anchorEl = range && range.startContainer;
		if (anchorEl && anchorEl.nodeType === 3) anchorEl = anchorEl.parentNode;
		var blockAncestor = anchorEl && findEditableAncestor(anchorEl);
		if (!range || !blockAncestor) {
			log("pasteAtCaret: no usable caret position");
			return "no-target";
		}
		snapshot();
		var tmp = document.createElement("div");
		tmp.innerHTML = state.clipboardHtml;
		var nodes = [];
		while (tmp.firstChild) nodes.push(tmp.removeChild(tmp.firstChild));
		// Insert all clipboard nodes at the caret in order.
		var inserted = 0;
		for (var i = nodes.length - 1; i >= 0; i--) {
			range.insertNode(nodes[i]);
			inserted++;
		}
		log("pasteAtCaret inserted", inserted, "node(s) into",
			describeBlock(blockAncestor));
		return "ok";
	}

	// ============================================================
	// Submit
	// ============================================================

	function discard() {
		showConfirmModal("Discard edits", "Discard ALL local edits and reload from disk?", function (ok) {
			if (ok) window.location.reload();
		});
	}

	// Build the HTML we'll commit to GitHub. CRITICAL: this must look
	// like what a normal (non-admin) user would see - no toolbar, no
	// ADMIN badge, no `contenteditable`, no `body.admin-active`, etc.
	// Otherwise the PR would ship admin chrome to every reader.
	function serializeForCommit() {
		// Clone the whole document so we don't mutate the live page.
		var docClone = document.documentElement.cloneNode(true);

		// 1. Strip admin-only DOM nodes that we appended at runtime.
		var dropSelectors = [
			"#adminToolbar", "#adminBadge", "#adminModal",
		];
		for (var i = 0; i < dropSelectors.length; i++) {
			var matches = docClone.querySelectorAll(dropSelectors[i]);
			for (var j = 0; j < matches.length; j++) {
				if (matches[j].parentNode) {
					matches[j].parentNode.removeChild(matches[j]);
				}
			}
		}

		// 2. Strip body-level admin classes.
		var bodyClone = docClone.querySelector("body");
		if (bodyClone) {
			var stripClasses = [
				"admin-active", "admin-select-mode",
				"admin-paste-mode", "admin-show-all",
			];
			for (var k = 0; k < stripClasses.length; k++) {
				bodyClone.classList.remove(stripClasses[k]);
			}
			if (bodyClone.classList.length === 0) {
				bodyClone.removeAttribute("class");
			}
		}

		// 3. Strip per-element admin attributes / classes added by the
		// editor (contenteditable, spellcheck="false", admin-selected
		// outline). We only added these to elements with class
		// "newPassuk", but be permissive in case anything else got it.
		var editable = docClone.querySelectorAll("[contenteditable]");
		for (var n = 0; n < editable.length; n++) {
			editable[n].removeAttribute("contenteditable");
		}
		var spellch = docClone.querySelectorAll("[spellcheck='false']");
		for (var s = 0; s < spellch.length; s++) {
			// Only strip if WE set it (newPassuk regions).
			if (spellch[s].classList.contains("newPassuk")) {
				spellch[s].removeAttribute("spellcheck");
			}
		}
		var sel = docClone.querySelectorAll(".admin-selected");
		for (var t = 0; t < sel.length; t++) {
			sel[t].classList.remove("admin-selected");
			if (sel[t].classList.length === 0) {
				sel[t].removeAttribute("class");
			}
		}

		// Reconstruct full HTML document.
		return "<!DOCTYPE html>\n" + docClone.outerHTML;
	}

	function submitEdit() {
		log("submitEdit tapped");
		var defaultTitle = "Edit " + getCurrentFilePath();
		showInputModal("Submit PR", "Short description of this change (PR title):", defaultTitle, function (msg) {
			log("submitEdit title =", msg);
			if (!msg) return;
			clearSelectionStyle();
			var html = serializeForCommit();
			log("submitEdit serialized HTML length =", html.length);
			var filePath = getCurrentFilePath();
			showPreviewOverlay(html, filePath, function (confirmed) {
				if (!confirmed) {
					log("submitEdit preview cancelled");
					return;
				}
				doSubmitAfterPreview(html, filePath, msg);
			});
		});
	}

	function doSubmitAfterPreview(html, filePath, msg) {
		flashToolbar("Submitting...");
		callBridge({
			action: "submitEdit",
			filePath: filePath,
			newContent: html,
			message: msg,
		}).then(function (result) {
			if (result && result.url) {
				// Apply locally so the user sees the edit immediately,
				// without waiting for the next background sync.
				callBridge({
					action: "writeLocalFile",
					filePath: filePath,
					newContent: html,
				}).catch(function (e) {
					log("writeLocalFile failed:", e);
				});
				showPrSuccessModal("PR opened", result.url, result.number);
			} else if (result && result.error) {
				showInfoModal("Failed", result.error);
			} else {
				showInfoModal("Submitted", "(no URL returned)");
			}
		}).catch(function (err) {
			showInfoModal("Submit failed", (err && err.message) ? err.message : String(err));
		});
	}

	// Renders a fullscreen iframe with `srcdoc=html` so the user can
	// see exactly how the page will look after the edit is committed.
	// `onResult(true)` to confirm and submit, `onResult(false)` to cancel.
	function showPreviewOverlay(html, filePath, onResult) {
		dismissAllAdminModals();
		var overlay = document.createElement("div");
		overlay.id = "adminModal";
		overlay.className = "admin-preview-overlay";
		overlay.innerHTML = ""
			+ "<div class='admin-preview-card'>"
			+ "  <div class='admin-preview-header'>"
			+ "    <div class='admin-preview-title'>Preview: <span class='admin-preview-path'></span></div>"
			+ "    <div class='admin-preview-hint'>Scroll inside the preview to verify formatting before submitting.</div>"
			+ "  </div>"
			+ "  <iframe class='admin-preview-frame' sandbox='allow-same-origin'></iframe>"
			+ "  <div class='admin-modal-actions admin-preview-actions'>"
			+ "    <button class='admin-modal-cancel'>Back to edit</button>"
			+ "    <button class='admin-modal-ok'>Looks good \u2014 submit</button>"
			+ "  </div>"
			+ "</div>";
		overlay.querySelector(".admin-preview-path").textContent = filePath;
		var frame = overlay.querySelector(".admin-preview-frame");
		// srcdoc renders the HTML with the same UA/CSS engine the real
		// page will use; this is the closest thing to the post-merge view.
		frame.setAttribute("srcdoc", html);
		document.body.appendChild(overlay);
		var done = false;
		function finish(result) {
			if (done) return;
			done = true;
			if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
			onResult(result);
		}
		overlay.querySelector(".admin-modal-cancel").addEventListener("click", function () { finish(false); });
		overlay.querySelector(".admin-modal-ok").addEventListener("click", function () { finish(true); });
	}

	// In-page modals to avoid WebView prompt()/alert() compatibility issues.
	function dismissAllAdminModals() {
		var existing = document.querySelectorAll("#adminModal");
		for (var i = 0; i < existing.length; i++) {
			if (existing[i].parentNode) existing[i].parentNode.removeChild(existing[i]);
		}
	}

	function buildOverlay() {
		dismissAllAdminModals();
		var overlay = document.createElement("div");
		overlay.id = "adminModal";
		return overlay;
	}

	function attachDismiss(overlay, onDismiss) {
		var dismissed = false;
		function teardown() {
			if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
			document.removeEventListener("keydown", onKey, true);
		}
		function dismissByUser() {
			if (dismissed) return;
			dismissed = true;
			teardown();
			if (onDismiss) onDismiss();
		}
		function onKey(e) {
			if (e.key === "Escape" || e.keyCode === 27) {
				e.preventDefault();
				dismissByUser();
			}
		}
		document.addEventListener("keydown", onKey, true);
		// Tap on the dark backdrop (outside the white card) closes the modal.
		overlay.addEventListener("click", function (e) {
			if (e.target === overlay) dismissByUser();
		});
		// __close is for the explicit OK/Cancel buttons - it does NOT call onDismiss.
		overlay.__close = function () {
			dismissed = true;
			teardown();
		};
	}

	function showInputModal(title, body, defaultValue, onSubmit) {
		var overlay = buildOverlay();
		overlay.innerHTML = ""
			+ "<div class='admin-modal-card'>"
			+ "  <div class='admin-modal-title'></div>"
			+ "  <div class='admin-modal-body'></div>"
			+ "  <input class='admin-modal-input' type='text' />"
			+ "  <div class='admin-modal-actions'>"
			+ "    <button class='admin-modal-cancel'>Cancel</button>"
			+ "    <button class='admin-modal-ok'>OK</button>"
			+ "  </div>"
			+ "</div>";
		overlay.querySelector(".admin-modal-title").textContent = title;
		overlay.querySelector(".admin-modal-body").textContent = body;
		var input = overlay.querySelector(".admin-modal-input");
		input.value = defaultValue || "";
		document.body.appendChild(overlay);
		attachDismiss(overlay, function () { onSubmit(null); });
		var submitted = false;
		input.focus();
		input.select();
		overlay.querySelector(".admin-modal-cancel").addEventListener("click", function () {
			submitted = true;
			overlay.__close();
			onSubmit(null);
		});
		overlay.querySelector(".admin-modal-ok").addEventListener("click", function () {
			submitted = true;
			var v = input.value;
			overlay.__close();
			onSubmit(v);
		});
	}

	function showInfoModal(title, body) {
		var overlay = buildOverlay();
		overlay.innerHTML = ""
			+ "<div class='admin-modal-card'>"
			+ "  <div class='admin-modal-title'></div>"
			+ "  <div class='admin-modal-body admin-modal-body-info'></div>"
			+ "  <div class='admin-modal-actions'>"
			+ "    <button class='admin-modal-ok'>OK</button>"
			+ "  </div>"
			+ "</div>";
		overlay.querySelector(".admin-modal-title").textContent = title;
		overlay.querySelector(".admin-modal-body").textContent = body;
		document.body.appendChild(overlay);
		attachDismiss(overlay);
		overlay.querySelector(".admin-modal-ok").addEventListener("click", function () {
			overlay.__close();
		});
	}

	// Renders the PR-opened success modal with a clickable link that asks
	// Flutter to open the URL in the system browser (the WebView itself
	// can't navigate to github.com without losing the admin session).
	function showPrSuccessModal(title, url, number) {
		var overlay = buildOverlay();
		var label = number ? ("Pull request #" + number + " opened.") : "Pull request opened.";
		overlay.innerHTML = ""
			+ "<div class='admin-modal-card'>"
			+ "  <div class='admin-modal-title'></div>"
			+ "  <div class='admin-modal-body admin-modal-pr-body'>"
			+ "    <div class='admin-modal-pr-label'></div>"
			+ "    <a class='admin-modal-pr-link' href='#' rel='noopener'></a>"
			+ "  </div>"
			+ "  <div class='admin-modal-actions'>"
			+ "    <button class='admin-modal-cancel'>Close</button>"
			+ "    <button class='admin-modal-ok'>Open in browser</button>"
			+ "  </div>"
			+ "</div>";
		overlay.querySelector(".admin-modal-title").textContent = title;
		overlay.querySelector(".admin-modal-pr-label").textContent = label;
		var link = overlay.querySelector(".admin-modal-pr-link");
		link.textContent = url;
		link.setAttribute("href", url);
		document.body.appendChild(overlay);
		attachDismiss(overlay);
		function openExternal(e) {
			if (e) { e.preventDefault(); e.stopPropagation(); }
			callBridge({ action: "openUrl", url: url }).catch(function () {});
		}
		link.addEventListener("click", openExternal);
		overlay.querySelector(".admin-modal-ok").addEventListener("click", function () {
			openExternal();
			overlay.__close();
		});
		overlay.querySelector(".admin-modal-cancel").addEventListener("click", function () {
			overlay.__close();
		});
	}

	function showConfirmModal(title, body, onResult) {
		var overlay = buildOverlay();
		overlay.innerHTML = ""
			+ "<div class='admin-modal-card'>"
			+ "  <div class='admin-modal-title'></div>"
			+ "  <div class='admin-modal-body admin-modal-body-info'></div>"
			+ "  <div class='admin-modal-actions'>"
			+ "    <button class='admin-modal-cancel'>Cancel</button>"
			+ "    <button class='admin-modal-ok'>OK</button>"
			+ "  </div>"
			+ "</div>";
		overlay.querySelector(".admin-modal-title").textContent = title;
		overlay.querySelector(".admin-modal-body").textContent = body;
		document.body.appendChild(overlay);
		attachDismiss(overlay, function () { onResult(false); });
		overlay.querySelector(".admin-modal-cancel").addEventListener("click", function () {
			overlay.__close();
			onResult(false);
		});
		overlay.querySelector(".admin-modal-ok").addEventListener("click", function () {
			overlay.__close();
			onResult(true);
		});
	}

	function openSettings() {
		callBridge({ action: "openSettings" }).catch(function () {});
	}

	function disableAdminMode() {
		log("disableAdminMode tapped");
		showConfirmModal("Exit admin mode", "Exit admin mode?", function (ok) {
			log("disableAdminMode confirm =", ok);
			if (!ok) return;
			callBridge({ action: "clearAdminActive" })
				.catch(function () {})
				.then(function () { window.location.reload(); });
		});
	}

	// ============================================================
	// Toolbar
	// ============================================================

	function flashToolbar(text) {
		var label = document.getElementById("adminFlash");
		if (!label) return;
		label.textContent = text;
		label.style.opacity = "1";
		setTimeout(function () { label.style.opacity = "0"; }, 1500);
	}

	function btn(text, handler, title) {
		var b = document.createElement("button");
		b.type = "button";
		b.textContent = text;
		if (title) b.title = title;
		b.addEventListener("click", function (e) {
			e.preventDefault();
			e.stopPropagation();
			handler();
		});
		return b;
	}

	function buildToolbar() {
		if (document.getElementById("adminToolbar")) return;
		var bar = document.createElement("div");
		bar.id = "adminToolbar";

		var label = document.createElement("span");
		label.id = "adminSelectionLabel";
		label.textContent = "Tap Select, then a block";
		bar.appendChild(label);

		var selectBtn = btn("Select: OFF", function () { setSelectMode(!state.selectMode); }, "Toggle: tap a block to select it");
		selectBtn.id = "adminSelectToggle";
		bar.appendChild(selectBtn);
		bar.appendChild(btn("Cut", cutBlock, "Cut selected block (then tap target to paste)"));
		bar.appendChild(btn("Copy", copyBlock, "Copy selected block (then tap target to paste)"));
		bar.appendChild(btn("Undo", undo));
		bar.appendChild(btn("Redo", redo));
		bar.appendChild(btn("Discard", discard, "Reload from disk"));
		bar.appendChild(btn("Submit PR", submitEdit, "Submit as a GitHub Pull Request"));
		bar.appendChild(btn("\u2699", openSettings, "Admin settings (token, sign out)"));
		bar.appendChild(btn("\u2715", disableAdminMode, "Exit admin mode"));

		var flash = document.createElement("span");
		flash.id = "adminFlash";
		bar.appendChild(flash);

		document.body.appendChild(bar);
		state.toolbarEl = bar;
	}

	function showAdminBadge() {
		var badge = document.createElement("div");
		badge.id = "adminBadge";
		badge.textContent = "ADMIN";
		document.body.appendChild(badge);
	}

	// ============================================================
	// Boot
	// ============================================================

	function activate() {
		if (state.active) return;
		log("activate: turning admin mode ON");
		state.active = true;
		makeEditable();
		buildToolbar();
		showAdminBadge();
		if (document.body) {
			document.body.classList.add("admin-active");
		}
		document.addEventListener("click", onDocumentClick, true);
	}

	function boot() {
		log("boot: setting up tap-burst handler, page =", window.location.pathname);
		installTapBurstHandler();
		// Catch surprise navigations while admin is editing.
		window.addEventListener("beforeunload", function (e) {
			log("BEFOREUNLOAD active=" + state.active +
				" pasteMode=" + state.pasteMode +
				" hasClipboard=" + (!!state.clipboardHtml));
		});
		// Ask Flutter if the admin session was already unlocked. If yes,
		// activate silently (no passphrase prompt on every page nav).
		if (hasFlutterBridge()) {
			callBridge({ action: "isAdminActive" })
				.then(function (ok) {
					log("boot isAdminActive =", ok);
					if (ok === true || ok === "true") activate();
				})
				.catch(function (err) { log("boot isAdminActive error", err); });
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", boot);
	} else {
		boot();
	}

	// Expose a tiny API in case Flutter wants to push commands in.
	window.__admin = {
		activate: activate,
		disable: disableAdminMode,
		isActive: function () { return state.active; },
		getCurrentFilePath: getCurrentFilePath,
	};
})();
