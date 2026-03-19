
// ==================== FONT SIZE / ZOOM ====================

ivritFont = parseInt(localStorage.getItem("ivritFont")) || 28;
othersFont = parseInt(localStorage.getItem("othersFont")) || 23;
updateFont();

function updateFont() {
	var html = document.getElementsByTagName('html')[0];
	html.style.cssText =
		"--fontSizeIvrit:" + ivritFont + "px;" +
		"--fontSizeOthers:" + othersFont + "px;";
}

function zoomIn() {
	ivritFont = Math.min(ivritFont + 2, 60);
	othersFont = Math.min(othersFont + 2, 55);
	localStorage.setItem("ivritFont", ivritFont);
	localStorage.setItem("othersFont", othersFont);
	updateFont();
	showZoomToast();
}

function zoomOut() {
	ivritFont = Math.max(ivritFont - 2, 12);
	othersFont = Math.max(othersFont - 2, 10);
	localStorage.setItem("ivritFont", ivritFont);
	localStorage.setItem("othersFont", othersFont);
	updateFont();
	showZoomToast();
}

function zoomReset() {
	ivritFont = 28;
	othersFont = 23;
	localStorage.setItem("ivritFont", ivritFont);
	localStorage.setItem("othersFont", othersFont);
	updateFont();
	showZoomToast();
}

var zoomToastTimer = null;
function showZoomToast() {
	var t = document.getElementById('zoomToast');
	if (!t) return;
	t.textContent = Math.round((ivritFont / 28) * 100) + '%';
	t.classList.add('visible');
	clearTimeout(zoomToastTimer);
	zoomToastTimer = setTimeout(function () { t.classList.remove('visible'); }, 1200);
}

function initZoomControls() {
	if (document.getElementById('zoomControls')) return;

	var bar = document.createElement('div');
	bar.id = 'zoomControls';
	bar.innerHTML =
		"<button onclick='zoomOut()'>A-</button>" +
		"<button onclick='zoomReset()' style='font-size:12px'>100%</button>" +
		"<button onclick='zoomIn()'>A+</button>";
	document.body.appendChild(bar);

	var toast = document.createElement('div');
	toast.id = 'zoomToast';
	document.body.appendChild(toast);
}

function initPinchZoom() {
	var origDist = 0, scaling = false;
	document.body.addEventListener("touchstart", function (e) {
		if (e.touches.length === 2) {
			origDist = Math.hypot(
				e.touches[0].pageX - e.touches[1].pageX,
				e.touches[0].pageY - e.touches[1].pageY);
			scaling = true;
		}
	});

	document.body.addEventListener("touchmove", function (e) {
		if (!scaling || e.touches.length < 2) return;
		var curDist = Math.hypot(
			e.touches[0].pageX - e.touches[1].pageX,
			e.touches[0].pageY - e.touches[1].pageY);
		var ratio = curDist / origDist;
		if (ratio > 1.08) {
			zoomIn();
			origDist = curDist;
		} else if (ratio < 0.92) {
			zoomOut();
			origDist = curDist;
		}
	});

	document.body.addEventListener("touchend", function () {
		scaling = false;
		origDist = 0;
	});
}


// ==================== ACCORDION / NAV ====================

function accordionOpenClose(id) {
	var panel = document.getElementById(id);
	var btn = panel.previousElementSibling;
	if (panel.style.maxHeight) {
		panel.style.maxHeight = null;
		if (btn) btn.classList.remove('open');
	} else {
		panel.style.maxHeight = panel.scrollHeight + "px";
		if (btn) btn.classList.add('open');
	}
}

function saveLastVisited() {
	localStorage.setItem('lastVisited', window.location.href);
}

function openNav() {
	document.getElementById("mySidenav").style.width = "55%";
	document.getElementById("mySidenav").style.border = "1px solid #31567f";
	document.getElementById("buttonNav").style.display = "none";
}

function closeNav() {
	document.getElementById("mySidenav").style.width = "0";
	document.getElementById("mySidenav").style.border = "0px";
	document.getElementById("buttonNav").style.display = "";
}

function hideShowById(id) {
	var x = document.getElementById(id);
	if (x.style.display === "none") {
		x.style.display = "";
	} else {
		x.style.display = "none";
	}
}


// ==================== COMMENTARY TOGGLE ====================

var activeClasses;

function initClassesBasedOnCookies() {
	initPinchZoom();
	saveLastVisited();

	activeClasses = localStorage.getItem('actives');
	if (activeClasses == null) {
		activeClasses = {
			onkelos: true, yonatan: true, passukEn: true, passukFr: false,
			rashi: true, siftey: true, ibnEzra: true, ramban: true,
			sforno: true, baalHaturim: true, orHaHaim: true, kliYakar: true,
			daatZkenim: true, haemekDavar: true, abarbanel: true, rashbam: true,
			gurarie: true, malbim: true, ralbag: true, mezudatDavid: true,
			mezudatZion: true, passukFrHa: true, passukEnHa: true, rashiHa: true
		};
		localStorage.setItem('actives', JSON.stringify(activeClasses));
	} else {
		activeClasses = JSON.parse(activeClasses);
	}

	if (activeClasses["haemekDavar"] == null) {
		activeClasses["haemekDavar"] = true;
		activeClasses["abarbanel"] = true;
		activeClasses["rashbam"] = true;
		localStorage.setItem('actives', JSON.stringify(activeClasses));
	}
	if (activeClasses["gurarie"] == null) {
		activeClasses["gurarie"] = true;
		localStorage.setItem('actives', JSON.stringify(activeClasses));
	}

	var keys = Object.keys(activeClasses);
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var appear = activeClasses[key];
		if (document.getElementById(key) != null) {
			makeDisappearAppearDivsBasedOnClass(key, appear);
			if (appear) {
				document.getElementById(key).className =
					document.getElementById(key).className.replace("button", "button active");
			} else {
				document.getElementById(key).className =
					document.getElementById(key).className.replace("button active", "button");
			}
		}
	}
	makeDisappearAppearDivsBasedOnClass("theContent", true);
}

function hideShow(theClass, obj) {
	if (obj.className == "button") {
		obj.className = obj.className.replace("button", "button active");
		activeClasses[theClass] = true;
	} else {
		obj.className = obj.className.replace("button active", "button");
		activeClasses[theClass] = false;
	}
	localStorage.setItem('actives', JSON.stringify(activeClasses));

	var elements = document.getElementsByClassName(theClass);
	for (var i = 0; i < elements.length; i++) {
		elements[i].style.display = elements[i].style.display === 'none' ? 'inline-block' : 'none';
	}
}

function makeDisappearAppearDivsBasedOnClass(theClass, toAppear) {
	var elements = document.getElementsByClassName(theClass);
	for (var i = 0; i < elements.length; i++) {
		elements[i].style.display = toAppear ? 'inline-block' : 'none';
	}
}


// ==================== DIACRITICS UTILS ====================

function stripDiacritics(str) {
	return str.replace(/[\u0591-\u05C7]/g, '');
}

function buildOriginalPosMap(text) {
	var map = [];
	for (var i = 0; i < text.length; i++) {
		var code = text.charCodeAt(i);
		if (code < 0x0591 || code > 0x05C7) {
			map.push(i);
		}
	}
	map.push(text.length);
	return map;
}


// ==================== SEARCH: SOURCES & STATE ====================

var torahSources = [
	{ id: 'passukIvrit', label: 'פסוק', labelShort: 'פסוק' },
	{ id: 'passukEn', label: 'English', labelShort: 'EN' },
	{ id: 'passukFr', label: 'Français', labelShort: 'FR' },
	{ id: 'onkelos', label: 'אונקלוס', labelShort: 'אונקלוס' },
	{ id: 'yonatan', label: 'יונתן', labelShort: 'יונתן' },
	{ id: 'rashi', label: "רש\"י", labelShort: "רש\"י" },
	{ id: 'siftey', label: 'שפתי חכמים', labelShort: 'שפ"ח' },
	{ id: 'ibnEzra', label: 'אבן עזרא', labelShort: "אב\"ע" },
	{ id: 'ramban', label: "הרמב\"ן", labelShort: "רמב\"ן" },
	{ id: 'sforno', label: 'ספורנו', labelShort: 'ספורנו' },
	{ id: 'baalHaturim', label: 'בעל הטורים', labelShort: 'בעה"ט' },
	{ id: 'orHaHaim', label: 'אור החיים', labelShort: 'אוה"ח' },
	{ id: 'kliYakar', label: 'כלי יקר', labelShort: 'כ"י' },
	{ id: 'daatZkenim', label: 'דעת זקנים', labelShort: 'דע"ז' },
	{ id: 'haemekDavar', label: 'העמק דבר', labelShort: 'העמ"ד' },
	{ id: 'abarbanel', label: 'אברבנאל', labelShort: 'אברבנאל' },
	{ id: 'rashbam', label: "רשב\"ם", labelShort: "רשב\"ם" },
	{ id: 'gurarie', label: 'גור אריה', labelShort: 'גו"א' }
];

var haftarahSources = [
	{ id: 'passukIvritHa', cssClass: 'passukIvrit', label: 'פסוק', labelShort: 'פסוק' },
	{ id: 'passukEnHa', label: 'English', labelShort: 'EN' },
	{ id: 'passukFrHa', label: 'Français', labelShort: 'FR' },
	{ id: 'rashiHa', label: "רש\"י", labelShort: "רש\"י" },
	{ id: 'malbim', label: "מלבי\"ם", labelShort: "מלבי\"ם" },
	{ id: 'ralbag', label: "רלב\"ג", labelShort: "רלב\"ג" },
	{ id: 'mezudatDavid', label: 'מצודת דוד', labelShort: 'מצ"ד' },
	{ id: 'mezudatZion', label: 'מצודת ציון', labelShort: 'מצ"צ' }
];

var searchSources = torahSources.concat(haftarahSources);

var sourceMap = {};
searchSources.forEach(function (s) { sourceMap[s.id] = s; });

var torahSourceIds = {};
torahSources.forEach(function (s) { torahSourceIds[s.id] = true; });
var haftarahSourceIds = {};
haftarahSources.forEach(function (s) { haftarahSourceIds[s.id] = true; });

function getSourceCssClass(srcId) {
	var s = sourceMap[srcId];
	return s ? (s.cssClass || s.id) : srcId;
}

function isHaftarahPage() {
	return /\/8\.html(\?|$|#)/.test(window.location.pathname);
}

var searchMatches = [];
var searchCurrentIdx = -1;
var searchSelectedSources = {};
var searchTemporarilyShown = [];
searchSources.forEach(function (s) { searchSelectedSources[s.id] = true; });

var parshaFolders = [
	'Bereshit', 'Noah', 'LehLeha', 'Vayera', 'HayeSara', 'Toldot',
	'Vayetze', 'Vayishlah', 'Vayeshev', 'Miketz', 'Vayigash', 'Vayehi',
	'Shemot', 'Vaera', 'Bo', 'Beshalah', 'Yitro', 'Mishpatim',
	'Terouma', 'Tetzave', 'KiTissa', 'Vayakhel', 'Pekoudey',
	'Vayikra', 'Zav', 'Shemini', 'Tazria', 'Mezora', 'AhareiMot',
	'Kedoshim', 'Emor', 'Behar', 'Behoukotay',
	'Bamidbar', 'Nasso', 'Behaaloteha', 'ShelahLeha', 'Korah',
	'Hukat', 'Balak', 'Pinhas', 'Matot', 'Massey',
	'Devarim', 'Vaethanan', 'Ekev', 'Reeh', 'Shoftim', 'KiTztze',
	'KiTavo', 'Nizavim', 'Vayeleh', 'Haazinu', 'VezotHaberaha'
];

var parshaHebrew = {
	'Bereshit': 'בראשית', 'Noah': 'נח', 'LehLeha': 'לך לך', 'Vayera': 'וירא',
	'HayeSara': 'חיי שרה', 'Toldot': 'תולדות', 'Vayetze': 'ויצא',
	'Vayishlah': 'וישלח', 'Vayeshev': 'וישב', 'Miketz': 'מקץ',
	'Vayigash': 'ויגש', 'Vayehi': 'ויחי', 'Shemot': 'שמות',
	'Vaera': 'וארא', 'Bo': 'בא', 'Beshalah': 'בשלח', 'Yitro': 'יתרו',
	'Mishpatim': 'משפטים', 'Terouma': 'תרומה', 'Tetzave': 'תצוה',
	'KiTissa': 'כי תשא', 'Vayakhel': 'ויקהל', 'Pekoudey': 'פקודי',
	'Vayikra': 'ויקרא', 'Zav': 'צו', 'Shemini': 'שמיני',
	'Tazria': 'תזריע', 'Mezora': 'מצורע', 'AhareiMot': 'אחרי מות',
	'Kedoshim': 'קדושים', 'Emor': 'אמור', 'Behar': 'בהר',
	'Behoukotay': 'בחוקותי', 'Bamidbar': 'במדבר', 'Nasso': 'נשא',
	'Behaaloteha': 'בהעלותך', 'ShelahLeha': 'שלח לך', 'Korah': 'קרח',
	'Hukat': 'חקת', 'Balak': 'בלק', 'Pinhas': 'פינחס', 'Matot': 'מטות',
	'Massey': 'מסעי', 'Devarim': 'דברים', 'Vaethanan': 'ואתחנן',
	'Ekev': 'עקב', 'Reeh': 'ראה', 'Shoftim': 'שופטים',
	'KiTztze': 'כי תצא', 'KiTavo': 'כי תבוא', 'Nizavim': 'ניצבים',
	'Vayeleh': 'וילך', 'Haazinu': 'האזינו', 'VezotHaberaha': 'וזאת הברכה'
};


// ==================== LOCAL SEARCH (parsha pages) ====================

function initSearchUI() {
	if (document.getElementById('searchPanel')) return;
	if (!document.querySelector('.theContent')) return;

	var icon = document.createElement('button');
	icon.id = 'searchIcon';
	icon.innerHTML = '&#x1F50D;';
	icon.title = 'חיפוש';
	icon.onclick = toggleSearchPanel;
	document.body.appendChild(icon);

	var panel = document.createElement('div');
	panel.id = 'searchPanel';

	var pageSources = isHaftarahPage() ? haftarahSources : torahSources;
	var presentSources = [];
	pageSources.forEach(function (s) {
		var cssClass = s.cssClass || s.id;
		if (document.getElementsByClassName(cssClass).length > 0) presentSources.push(s);
	});

	var savedActives = null;
	try {
		var raw = localStorage.getItem('actives');
		if (raw) savedActives = JSON.parse(raw);
	} catch (e) {}

	var filtersHtml = '';
	presentSources.forEach(function (s) {
		var cssClass = s.cssClass || s.id;
		var isActive = cssClass === 'passukIvrit' ||
			(savedActives && savedActives[s.id] === true);
		var sel = isActive ? ' selected' : '';
		filtersHtml +=
			"<span class='sf" + sel + "' data-src='" + s.id + "' onclick='toggleSourceFilter(this)'>" +
			s.labelShort + "</span>";
	});

	panel.innerHTML =
		"<div class='sRow'>" +
		"<a class='sBack' href='../index.html'>תורה &larr;</a>" +
		"<input type='text' id='searchInput' placeholder='חיפוש בדף...' dir='auto' />" +
		"<button class='sBtn' onclick='doSearch()'>&#x1F50D;</button>" +
		"<button class='sClose' onclick='closeSearchPanel()'>&times;</button>" +
		"</div>" +
		"<div class='sRow'>" +
		"<button class='sNav' onclick='searchPrev()'>&lsaquo;</button>" +
		"<span class='sInfo' id='searchInfo'></span>" +
		"<button class='sNav' onclick='searchNext()'>&rsaquo;</button>" +
		"<span style='flex:1'></span>" +
		"<button class='sToggle' onclick='toggleSourceFiltersPanel()'>&#9881; מקורות</button>" +
		"</div>" +
		"<div class='sFilters' id='sourceFilters'>" +
		"<div style='display:flex;gap:4px;margin-bottom:6px;justify-content:flex-end'>" +
		"<button class='sToggle' onclick='selectAllSources()'>&#10003; הכל</button>" +
		"<button class='sToggle' onclick='selectNoneSources()'>&#10007; כלום</button>" +
		"</div>" +
		filtersHtml + "</div>";

	document.body.appendChild(panel);

	document.getElementById('searchInput').addEventListener('keydown', function (e) {
		if (e.key === 'Enter') doSearch();
	});
}

function toggleSearchPanel() {
	var p = document.getElementById('searchPanel');
	if (!p) return;
	if (p.style.display === 'block') {
		closeSearchPanel();
	} else {
		p.style.display = 'block';
		document.getElementById('searchInput').focus();
	}
}

function closeSearchPanel() {
	var p = document.getElementById('searchPanel');
	if (p) p.style.display = 'none';
	clearSearchHighlights();
	clearSearchState();
	var nav = document.getElementById('searchAliyotNav');
	if (nav) nav.style.display = 'none';
}

function toggleSourceFiltersPanel() {
	var f = document.getElementById('sourceFilters');
	if (f) f.classList.toggle('open');
}

function toggleSourceFilter(el) {
	var src = el.getAttribute('data-src');
	el.classList.toggle('selected');
	searchSelectedSources[src] = el.classList.contains('selected');
	autoRefreshSearch(el);
}

function selectAllSources() {
	var els = document.querySelectorAll('#sourceFilters .sf');
	for (var i = 0; i < els.length; i++) {
		els[i].classList.add('selected');
		searchSelectedSources[els[i].getAttribute('data-src')] = true;
	}
	var inp = document.getElementById('searchInput');
	if (inp && inp.value.trim()) doSearch();
}

function selectNoneSources() {
	var els = document.querySelectorAll('#sourceFilters .sf');
	for (var i = 0; i < els.length; i++) {
		els[i].classList.remove('selected');
		searchSelectedSources[els[i].getAttribute('data-src')] = false;
	}
	var inp = document.getElementById('searchInput');
	if (inp && inp.value.trim()) doSearch();
}

function autoRefreshSearch(el) {
	var isLocal = el.closest('#sourceFilters');
	var isGlobal = el.closest('#gsFilters');
	if (isLocal) {
		var inp = document.getElementById('searchInput');
		if (inp && inp.value.trim()) doSearch();
	} else if (isGlobal) {
		var inp = document.getElementById('gsInput');
		if (inp && inp.value.trim()) startGlobalSearch();
	}
}

function clearSearchHighlights() {
	var marks = document.querySelectorAll('.searchHighlight, .searchHighlightCurrent');
	for (var i = 0; i < marks.length; i++) {
		var parent = marks[i].parentNode;
		parent.replaceChild(document.createTextNode(marks[i].textContent), marks[i]);
		parent.normalize();
	}
	searchMatches = [];
	searchCurrentIdx = -1;
	var info = document.getElementById('searchInfo');
	if (info) info.textContent = '';

	for (var i = 0; i < searchTemporarilyShown.length; i++) {
		searchTemporarilyShown[i].style.display = 'none';
	}
	searchTemporarilyShown = [];
}

function isElementVisible(el) {
	while (el && el !== document.body) {
		if (el.style && el.style.display === 'none') return false;
		var computed = window.getComputedStyle(el);
		if (computed.display === 'none') return false;
		el = el.parentNode;
	}
	return true;
}

function revealForSearch(el) {
	var node = el;
	while (node && node !== document.body) {
		if (node.style && node.style.display === 'none') {
			node.style.display = '';
			if (searchTemporarilyShown.indexOf(node) === -1) {
				searchTemporarilyShown.push(node);
			}
		}
		node = node.parentNode;
	}
}

function doSearch() {
	clearSearchHighlights();
	var query = document.getElementById('searchInput').value.trim();
	if (!query) return;

	var activeSources = [];
	var chipEls = document.querySelectorAll('#sourceFilters .sf.selected');
	for (var i = 0; i < chipEls.length; i++) {
		activeSources.push(chipEls[i].getAttribute('data-src'));
	}
	if (activeSources.length === 0) {
		document.getElementById('searchInfo').textContent = 'בחר מקורות';
		return;
	}

	var normalizedQuery = stripDiacritics(query).toLowerCase();
	activeSources.forEach(function (srcId) {
		var cssClass = getSourceCssClass(srcId);
		var elements = document.getElementsByClassName(cssClass);
		for (var i = 0; i < elements.length; i++) {
			var wasHidden = !isElementVisible(elements[i]);
			highlightInElement(elements[i], normalizedQuery, !wasHidden, cssClass);
			if (wasHidden && elements[i].querySelectorAll('.searchHighlight').length > 0) {
				revealForSearch(elements[i]);
			}
		}
	});

	searchMatches = document.querySelectorAll('.searchHighlight');
	if (searchMatches.length > 0) {
		searchCurrentIdx = 0;
		updateSearchNav();
	} else {
		document.getElementById('searchInfo').textContent = 'לא נמצא';
	}
	saveSearchState(query, activeSources);
	searchOtherAliyot(normalizedQuery, activeSources, searchMatches.length);
}

function isInOtherSource(textNode, rootEl, sourceClass) {
	var node = textNode.parentNode;
	while (node && node !== rootEl) {
		if (node.classList) {
			for (var c = 0; c < node.classList.length; c++) {
				if (sourceClassSet[node.classList[c]] && node.classList[c] !== sourceClass) return true;
			}
		}
		node = node.parentNode;
	}
	return false;
}

function isTextNodeHidden(textNode, rootEl) {
	var node = textNode.parentNode;
	while (node && node !== rootEl) {
		if (node.style && node.style.display === 'none') return true;
		node = node.parentNode;
	}
	return false;
}

function highlightInElement(el, normalizedQuery, skipHidden, sourceClass) {
	var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
	var textNodes = [];
	while (walker.nextNode()) {
		var node = walker.currentNode;
		if (node.parentNode.classList &&
			(node.parentNode.classList.contains('searchHighlight') ||
				node.parentNode.classList.contains('searchHighlightCurrent'))) continue;
		if (isInOtherSource(node, el, sourceClass)) continue;
		if (skipHidden && isTextNodeHidden(node, el)) continue;
		textNodes.push(node);
	}

	for (var i = 0; i < textNodes.length; i++) {
		var node = textNodes[i];
		var originalText = node.textContent;
		var strippedText = stripDiacritics(originalText).toLowerCase();
		var posMap = buildOriginalPosMap(originalText);

		var idx = strippedText.indexOf(normalizedQuery);
		if (idx === -1) continue;

		var parts = [];
		var lastOrigIdx = 0;
		while (idx !== -1) {
			var origStart = posMap[idx];
			var origEnd = posMap[idx + normalizedQuery.length];

			if (origStart > lastOrigIdx)
				parts.push(document.createTextNode(originalText.substring(lastOrigIdx, origStart)));

			var span = document.createElement('span');
			span.className = 'searchHighlight';
			span.textContent = originalText.substring(origStart, origEnd);
			parts.push(span);

			lastOrigIdx = origEnd;
			idx = strippedText.indexOf(normalizedQuery, idx + normalizedQuery.length);
		}
		if (lastOrigIdx < originalText.length)
			parts.push(document.createTextNode(originalText.substring(lastOrigIdx)));

		var parent = node.parentNode;
		for (var j = 0; j < parts.length; j++) parent.insertBefore(parts[j], node);
		parent.removeChild(node);
	}
}

function updateSearchNav() {
	searchMatches = document.querySelectorAll('.searchHighlight, .searchHighlightCurrent');
	if (searchMatches.length === 0) return;

	for (var i = 0; i < searchMatches.length; i++) searchMatches[i].className = 'searchHighlight';
	searchMatches[searchCurrentIdx].className = 'searchHighlightCurrent';
	searchMatches[searchCurrentIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });

	document.getElementById('searchInfo').textContent =
		(searchCurrentIdx + 1) + ' / ' + searchMatches.length;
}

function searchNext() {
	if (searchMatches.length === 0) return;
	searchCurrentIdx = (searchCurrentIdx + 1) % searchMatches.length;
	updateSearchNav();
}

function searchPrev() {
	if (searchMatches.length === 0) return;
	searchCurrentIdx = (searchCurrentIdx - 1 + searchMatches.length) % searchMatches.length;
	updateSearchNav();
}


// ==================== GLOBAL SEARCH (index page) ====================

var globalSearchAbort = false;

function initGlobalSearchUI() {
	if (document.getElementById('globalSearchBox')) return;

	var box = document.createElement('div');
	box.id = 'globalSearchBox';
	box.innerHTML =
		"<div class='gsTitle'>&#x1F50D; חיפוש בכל התורה</div>" +
		"<div class='gsInputRow'>" +
		"<input type='text' id='gsInput' placeholder='הקלד מילה לחיפוש...' dir='auto' />" +
		"<button class='gsBtn' onclick='startGlobalSearch()'>חפש</button>" +
		"</div>" +
		"<div class='gsInputRow' style='flex-wrap:wrap;gap:4px;margin-top:6px'>" +
		"<button class='sToggle' onclick='gsToggleFilters()'>&#9881; מקורות</button>" +
		"</div>" +
		"<div class='sFilters' id='gsFilters'>" +
		buildGlobalFilterChips() + "</div>" +
		"<div id='gsProgress' style='display:none'>" +
		"<div class='gsProgressBar'><div class='gsProgressFill' id='gsProgressFill'></div></div>" +
		"<span class='gsProgressText' id='gsProgressText'>0%</span>" +
		"<button class='gsStopBtn' onclick='stopGlobalSearch()'>&#10005; עצור</button>" +
		"</div>" +
		"<div id='gsResultsHeader' style='display:none'>" +
		"<button class='gsCloseBtn' onclick='closeGlobalSearch()'>&times; סגור תוצאות</button>" +
		"</div>" +
		"<div id='gsResults'></div>";

	var body = document.body;
	var firstAccordion = body.querySelector('.accordion');
	if (firstAccordion) {
		body.insertBefore(box, firstAccordion);
	} else {
		body.insertBefore(box, body.firstChild);
	}

	document.getElementById('gsInput').addEventListener('keydown', function (e) {
		if (e.key === 'Enter') startGlobalSearch();
	});
}

function buildGlobalFilterChips() {
	var html = "<div class='sGroupHeader'>" +
		"<span class='sGroupLabel'>תורה</span>" +
		"<span class='sGroupBtns'>" +
		"<button class='sToggle sToggleSm' onclick='gsGroupSelect(\"torah\",true)'>&#10003;</button>" +
		"<button class='sToggle sToggleSm' onclick='gsGroupSelect(\"torah\",false)'>&#10007;</button>" +
		"</span></div>";
	torahSources.forEach(function (s) {
		var sel = s.id === 'passukIvrit' ? ' selected' : '';
		html += "<span class='sf" + sel + "' data-src='" + s.id +
			"' data-group='torah' onclick='toggleSourceFilter(this)'>" + s.labelShort + "</span>";
	});
	html += "<div class='sGroupHeader'>" +
		"<span class='sGroupLabel'>הפטרה</span>" +
		"<span class='sGroupBtns'>" +
		"<button class='sToggle sToggleSm' onclick='gsGroupSelect(\"haftarah\",true)'>&#10003;</button>" +
		"<button class='sToggle sToggleSm' onclick='gsGroupSelect(\"haftarah\",false)'>&#10007;</button>" +
		"</span></div>";
	haftarahSources.forEach(function (s) {
		html += "<span class='sf' data-src='" + s.id +
			"' data-group='haftarah' onclick='toggleSourceFilter(this)'>" + s.labelShort + "</span>";
	});
	return html;
}

function gsToggleFilters() {
	var f = document.getElementById('gsFilters');
	if (f) f.classList.toggle('open');
}

function gsGroupSelect(group, selectAll) {
	var els = document.querySelectorAll('#gsFilters .sf[data-group="' + group + '"]');
	for (var i = 0; i < els.length; i++) {
		if (selectAll) {
			els[i].classList.add('selected');
		} else {
			els[i].classList.remove('selected');
		}
		searchSelectedSources[els[i].getAttribute('data-src')] = selectAll;
	}
	var inp = document.getElementById('gsInput');
	if (inp && inp.value.trim()) startGlobalSearch();
}

function stopGlobalSearch() {
	globalSearchAbort = true;
}

function closeGlobalSearch() {
	var results = document.getElementById('gsResults');
	if (results) results.innerHTML = '';
	var progress = document.getElementById('gsProgress');
	if (progress) progress.style.display = 'none';
	var totalCounter = document.getElementById('gsTotalCount');
	if (totalCounter) { totalCounter.style.display = 'none'; totalCounter.textContent = ''; }
	var rh = document.getElementById('gsResultsHeader');
	if (rh) rh.style.display = 'none';
	globalSearchAbort = true;
	clearSearchState();
}

function startGlobalSearch() {
	var query = document.getElementById('gsInput').value.trim();
	if (!query) return;

	var activeSources = [];
	var els = document.querySelectorAll('#gsFilters .sf.selected');
	for (var i = 0; i < els.length; i++) activeSources.push(els[i].getAttribute('data-src'));
	if (activeSources.length === 0) {
		document.getElementById('gsResults').innerHTML =
			"<div class='gsNoResults'>בחר מקורות לחיפוש</div>";
		return;
	}

	saveSearchState(query, activeSources);
	globalSearchAbort = false;

	var progress = document.getElementById('gsProgress');
	var fill = document.getElementById('gsProgressFill');
	var text = document.getElementById('gsProgressText');
	var results = document.getElementById('gsResults');
	progress.style.display = 'flex';
	fill.style.width = '0%';
	text.textContent = '0%';
	results.innerHTML = '';

	var totalCounter = document.getElementById('gsTotalCount');
	if (!totalCounter) {
		totalCounter = document.createElement('div');
		totalCounter.id = 'gsTotalCount';
		totalCounter.className = 'gsTotalCount';
		results.parentNode.insertBefore(totalCounter, results);
	}
	totalCounter.textContent = '';
	totalCounter.style.display = 'none';

	var normalizedQuery = stripDiacritics(query).toLowerCase();
	var allFiles = [];
	parshaFolders.forEach(function (folder) {
		for (var n = 1; n <= 8; n++) allFiles.push({ folder: folder, num: n });
	});

	var totalFiles = allFiles.length;
	var processed = 0;
	var totalMatches = 0;
	var concurrency = 4;
	var fileIdx = 0;
	var groupedResults = {};

	function processNext() {
		if (globalSearchAbort || fileIdx >= totalFiles) {
			if (processed >= totalFiles || globalSearchAbort) {
				progress.style.display = 'none';
				if (totalMatches === 0 && !globalSearchAbort) {
					results.innerHTML = "<div class='gsNoResults'>לא נמצאו תוצאות</div>";
				}
				if (globalSearchAbort) {
					results.innerHTML += "<div class='gsNoResults'>החיפוש הופסק</div>";
				}
				if (totalMatches > 0) {
					totalCounter.textContent = 'סה"כ ' + totalMatches + ' תוצאות';
					totalCounter.style.display = 'block';
					saveSearchResults(groupedResults);
					renderGroupedResults(groupedResults, query);
					var rh = document.getElementById('gsResultsHeader');
					if (rh) rh.style.display = 'block';
				}
			}
			return;
		}

		var file = allFiles[fileIdx++];
		var url = file.folder + '/' + file.num + '.html';

		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.onload = function () {
			processed++;
			var pct = Math.round((processed / totalFiles) * 100);
			fill.style.width = pct + '%';
			text.textContent = pct + '%';

			if ((xhr.status === 200 || xhr.status === 0) && xhr.responseText) {
				var isHaftarahFile = file.num === 8;
				var pageSources = [];
				for (var j = 0; j < activeSources.length; j++) {
					if (isHaftarahFile ? haftarahSourceIds[activeSources[j]] : torahSourceIds[activeSources[j]]) {
						pageSources.push(activeSources[j]);
					}
				}
				if (pageSources.length > 0) {
					var matches = searchInHtml(xhr.responseText, normalizedQuery, pageSources);
					if (matches.length > 0) {
						totalMatches += matches.length;
						if (!groupedResults[file.folder]) groupedResults[file.folder] = {};
						groupedResults[file.folder][file.num] = matches;
					}
				}
			}
			processNext();
		};
		xhr.onerror = function () {
			processed++;
			var pct = Math.round((processed / totalFiles) * 100);
			fill.style.width = pct + '%';
			text.textContent = pct + '%';
			processNext();
		};
		xhr.send();
	}

	for (var c = 0; c < concurrency; c++) processNext();
}

var sourceClassSet = {};
searchSources.forEach(function (s) { sourceClassSet[s.cssClass || s.id] = true; });

function getOwnTextContent(el, sourceClass) {
	var clone = el.cloneNode(true);
	var seen = {};
	var selectors = [];
	searchSources.forEach(function (s) {
		var css = s.cssClass || s.id;
		if (css !== sourceClass && !seen[css]) {
			seen[css] = true;
			selectors.push('.' + css);
		}
	});
	if (selectors.length > 0) {
		var nested = clone.querySelectorAll(selectors.join(','));
		for (var i = 0; i < nested.length; i++) {
			if (nested[i].parentNode) nested[i].parentNode.removeChild(nested[i]);
		}
	}
	return clone.textContent;
}

function searchInHtml(html, normalizedQuery, sources) {
	var parser = new DOMParser();
	var doc = parser.parseFromString(html, 'text/html');
	var matches = [];

	sources.forEach(function (srcId) {
		var cssClass = getSourceCssClass(srcId);
		var elements = doc.getElementsByClassName(cssClass);
		for (var i = 0; i < elements.length; i++) {
			var text = getOwnTextContent(elements[i], cssClass);
			var stripped = stripDiacritics(text).toLowerCase();
			var idx = stripped.indexOf(normalizedQuery);
			while (idx !== -1) {
				var posMap = buildOriginalPosMap(text);
				var origIdx = posMap[idx];
				var snippetStart = Math.max(0, origIdx - 40);
				var snippetEnd = Math.min(text.length, origIdx + normalizedQuery.length + 60);
				var snippet = (snippetStart > 0 ? '...' : '') +
					text.substring(snippetStart, snippetEnd).trim() +
					(snippetEnd < text.length ? '...' : '');
				matches.push({ source: srcId, snippet: snippet });
				idx = stripped.indexOf(normalizedQuery, idx + normalizedQuery.length);
			}
		}
	});
	return matches;
}

function renderGroupedResults(groupedResults, query) {
	var results = document.getElementById('gsResults');
	results.innerHTML = '';

	parshaFolders.forEach(function (folder) {
		if (!groupedResults[folder]) return;
		var parashaData = groupedResults[folder];

		var parashaTotal = 0;
		var aliyahNums = [];
		for (var num in parashaData) {
			parashaTotal += parashaData[num].length;
			aliyahNums.push(parseInt(num));
		}
		aliyahNums.sort(function (a, b) { return a - b; });

		var heb = parshaHebrew[folder] || folder;

		var group = document.createElement('div');
		group.className = 'gsParashaGroup';

		var header = document.createElement('div');
		header.className = 'gsParashaHeader';
		header.innerHTML =
			"<span class='gsParsha'>" + heb + "</span>" +
			"<span class='gsCount'>" + parashaTotal + " תוצאות</span>" +
			"<span class='gsToggleIcon'>&#9660;</span>";
		header.onclick = function () { group.classList.toggle('collapsed'); };
		group.appendChild(header);

		var body = document.createElement('div');
		body.className = 'gsParashaBody';

		aliyahNums.forEach(function (num) {
			var matches = parashaData[num];
			var aliyahLabel = num === 8 ? 'הפטרה' : 'עליה ' + num;

			var card = document.createElement('div');
			card.className = 'gsAliyahCard';
			card.onclick = function (e) {
				e.stopPropagation();
				var selectedSrcs = [];
				var chips = document.querySelectorAll('#gsFilters .sf.selected');
				for (var i = 0; i < chips.length; i++) selectedSrcs.push(chips[i].getAttribute('data-src'));
				saveSearchState(query, selectedSrcs);
				window.location.replace(folder + '/' + num + '.html');
			};

			var cardHeader = "<div class='gsAliyahHeader'>" +
				"<span class='gsAliyah'>" + aliyahLabel + "</span>" +
				"<span class='gsCount'>" + matches.length + " תוצאות</span>" +
				"</div>";

			var snippetsHtml = '';
			var max = Math.min(matches.length, 3);
			for (var i = 0; i < max; i++) {
				var srcLabel = '';
				searchSources.forEach(function (s) { if (s.id === matches[i].source) srcLabel = s.labelShort; });
				snippetsHtml +=
					"<div class='gsSnippet'>" +
					"<span class='gsSnippetSrc'>" + srcLabel + "</span> " +
					escapeHtml(matches[i].snippet) +
					"</div>";
			}
			if (matches.length > 3) {
				snippetsHtml += "<div class='gsMore'>+" + (matches.length - 3) + " עוד...</div>";
			}

			card.innerHTML = cardHeader + snippetsHtml;
			body.appendChild(card);
		});

		group.appendChild(body);
		results.appendChild(group);
	});
}

function escapeHtml(text) {
	var div = document.createElement('div');
	div.appendChild(document.createTextNode(text));
	return div.innerHTML;
}


// ==================== PERSISTENT SEARCH STATE ====================

function saveSearchState(term, sources) {
	if (!term) return;
	localStorage.setItem('searchState', JSON.stringify({ term: term, sources: sources }));
}

function saveSearchResults(groupedResults) {
	var compact = {};
	for (var folder in groupedResults) {
		compact[folder] = {};
		for (var num in groupedResults[folder]) {
			compact[folder][num] = groupedResults[folder][num].length;
		}
	}
	localStorage.setItem('searchResults', JSON.stringify(compact));
	localStorage.setItem('searchResultsFull', JSON.stringify(groupedResults));
}

function getSearchResults() {
	var raw = localStorage.getItem('searchResultsFull');
	if (!raw) return null;
	try { return JSON.parse(raw); } catch (e) { return null; }
}

function getSearchResultsCounts() {
	var raw = localStorage.getItem('searchResults');
	if (!raw) return null;
	try { return JSON.parse(raw); } catch (e) { return null; }
}

function clearSearchState() {
	localStorage.removeItem('searchState');
	localStorage.removeItem('searchResults');
	localStorage.removeItem('searchResultsFull');
	localStorage.removeItem('parashaSearchResults');
}

function getSearchState() {
	var raw = localStorage.getItem('searchState');
	if (!raw) return null;
	try { return JSON.parse(raw); } catch (e) { return null; }
}

function applySourceChips(containerSelector, sources) {
	if (!sources) return;
	var chips = document.querySelectorAll(containerSelector + ' .sf');
	for (var i = 0; i < chips.length; i++) {
		var src = chips[i].getAttribute('data-src');
		if (sources.indexOf(src) >= 0) {
			chips[i].classList.add('selected');
		} else {
			chips[i].classList.remove('selected');
		}
	}
}

function restoreSearchOnParshaPage() {
	var state = getSearchState();
	if (!state || !state.term) return;

	setTimeout(function () {
		var panel = document.getElementById('searchPanel');
		var input = document.getElementById('searchInput');
		if (panel && input) {
			if (state.sources) {
				applySourceChips('#sourceFilters', state.sources);
			}
			adjustSearchPanelTop();
			panel.style.display = 'block';
			input.value = state.term;
			doSearch();
		}
	}, 500);
}

function adjustSearchPanelTop() {
	var nav = document.getElementById('searchAliyotNav');
	var panel = document.getElementById('searchPanel');
	if (panel && nav && nav.style.display === 'flex') {
		panel.style.top = nav.offsetHeight + 'px';
	}
}

function restoreSearchOnIndexPage() {
	var state = getSearchState();
	if (!state || !state.term) return;

	setTimeout(function () {
		var input = document.getElementById('gsInput');
		if (input) {
			input.value = state.term;
			if (state.sources) {
				applySourceChips('#gsFilters', state.sources);
			}
			var cached = getSearchResults();
			if (cached) {
				var totalMatches = 0;
				for (var f in cached) {
					for (var n in cached[f]) totalMatches += cached[f][n].length;
				}
				var totalCounter = document.getElementById('gsTotalCount');
				if (!totalCounter) {
					totalCounter = document.createElement('div');
					totalCounter.id = 'gsTotalCount';
					totalCounter.className = 'gsTotalCount';
					var results = document.getElementById('gsResults');
					results.parentNode.insertBefore(totalCounter, results);
				}
				totalCounter.textContent = 'סה"כ ' + totalMatches + ' תוצאות';
				totalCounter.style.display = 'block';
				renderGroupedResults(cached, state.term);
				var rh = document.getElementById('gsResultsHeader');
				if (rh) rh.style.display = 'block';
			} else {
				startGlobalSearch();
			}
		}
	}, 300);
}


function getCurrentParashaAndNum() {
	var path = window.location.pathname;
	var parts = path.replace(/^\/+/, '').split('/');
	for (var i = 0; i < parts.length; i++) {
		for (var j = 0; j < parshaFolders.length; j++) {
			if (parts[i] === parshaFolders[j]) {
				var numMatch = (parts[i + 1] || '').match(/^(\d+)\.html/);
				return { folder: parshaFolders[j], num: numMatch ? parseInt(numMatch[1]) : null };
			}
		}
	}
	return null;
}

function searchOtherAliyot(normalizedQuery, activeSources, currentPageCount) {
	var current = getCurrentParashaAndNum();
	if (!current || !current.num) return;

	var parashaResults = {};
	parashaResults[current.num] = currentPageCount;

	var aliyotToScan = [];
	for (var n = 1; n <= 8; n++) {
		if (n !== current.num) aliyotToScan.push(n);
	}

	var processed = 0;
	var total = aliyotToScan.length;

	aliyotToScan.forEach(function (num) {
		var url = num + '.html';
		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.onload = function () {
			processed++;
			if ((xhr.status === 200 || xhr.status === 0) && xhr.responseText) {
				var isHaftarahFile = (num === 8);
				var pageSources = [];
				for (var j = 0; j < activeSources.length; j++) {
					if (isHaftarahFile ? haftarahSourceIds[activeSources[j]] : torahSourceIds[activeSources[j]]) {
						pageSources.push(activeSources[j]);
					}
				}
				if (pageSources.length > 0) {
					var matches = searchInHtml(xhr.responseText, normalizedQuery, pageSources);
					if (matches.length > 0) {
						parashaResults[num] = matches.length;
					}
				}
			}
			if (processed === total) {
				saveParashaSearchResults(current.folder, parashaResults);
				renderAliyotNav(current.folder, current.num, parashaResults);
			}
		};
		xhr.onerror = function () {
			processed++;
			if (processed === total) {
				saveParashaSearchResults(current.folder, parashaResults);
				renderAliyotNav(current.folder, current.num, parashaResults);
			}
		};
		xhr.send();
	});
}

function saveParashaSearchResults(folder, results) {
	localStorage.setItem('parashaSearchResults', JSON.stringify({ folder: folder, results: results }));
}

function getParashaSearchResults() {
	var raw = localStorage.getItem('parashaSearchResults');
	if (!raw) return null;
	try { return JSON.parse(raw); } catch (e) { return null; }
}

function renderAliyotNav(folder, currentNum, parashaResults) {
	var existing = document.getElementById('searchAliyotNav');
	if (existing) existing.parentNode.removeChild(existing);

	var nums = [];
	for (var n in parashaResults) {
		if (parashaResults[n] > 0) nums.push(parseInt(n));
	}
	if (nums.length === 0) return;
	nums.sort(function (a, b) { return a - b; });

	var heb = parshaHebrew[folder] || folder;
	var bar = document.createElement('div');
	bar.id = 'searchAliyotNav';
	bar.style.display = 'flex';

	var html = "<span class='sanLabel'>" + heb + ":</span>";
	nums.forEach(function (num) {
		var label = num === 8 ? 'הפ' : num;
		var count = parashaResults[num];
		var cls = 'sanBtn' + (num === currentNum ? ' sanCurrent' : '');
		html += "<a class='" + cls + "' href='" + num + ".html'>" +
			label + "<span class='sanCount'>" + count + "</span></a>";
	});
	bar.innerHTML = html;
	document.body.appendChild(bar);
	adjustSearchPanelTop();
}

function showSearchAliyotNav() {
	var cached = getParashaSearchResults();
	if (!cached) {
		var globalCounts = getSearchResultsCounts();
		if (!globalCounts) return;
		var current = getCurrentParashaAndNum();
		if (!current || !current.num) return;
		var parashaData = globalCounts[current.folder];
		if (!parashaData) return;
		renderAliyotNav(current.folder, current.num, parashaData);
		return;
	}

	var current = getCurrentParashaAndNum();
	if (!current || !current.num) return;

	if (cached.folder === current.folder) {
		renderAliyotNav(current.folder, current.num, cached.results);
	} else {
		var globalCounts = getSearchResultsCounts();
		if (globalCounts && globalCounts[current.folder]) {
			renderAliyotNav(current.folder, current.num, globalCounts[current.folder]);
		}
	}
}

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', function () {
	var isIndexPage = document.body.classList.contains('theBodyMain');
	var isParshaPage = document.body.classList.contains('theBody');

	if (isIndexPage) {
		initGlobalSearchUI();
		restoreSearchOnIndexPage();
	}

	if (isParshaPage) {
		initSearchUI();
		initZoomControls();
		showSearchAliyotNav();
		restoreSearchOnParshaPage();
	}
});
