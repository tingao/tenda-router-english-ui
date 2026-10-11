/*
 * Tenda Router — English UI
 * ---------------------------------------------------------------------------
 * Makes the Tenda Mesh12X / MX12 (CN firmware) admin UI render in English,
 * no matter what address you reach the router on.
 *
 * Works for 192.168.0.1, 10.x, 172.16-31.x, tenda.local, tenda.lan,
 * tendawifi.com, or anything else — it does NOT key off the address at all.
 *
 * Runs in the page's MAIN world at document_start, i.e. BEFORE any page script.
 *
 *
 * HOW IT WORKS
 *
 * Tenda's i18n engine (/lang/b28n.js) does:
 *     L.defaultLang = "en"                                    // English = default
 *     L.supportLang = CONFIG_MULTI_LANGUAGE_SORFWARE.split(",")
 *
 * then:
 *     getLang() {
 *       t = cookie "bLanguage" || navigator.language;
 *       a = this.isSupport(t);            // "en" supported? -> false on a CN build
 *       a = a || (support.indexOf(defaultLang) < 0 ? support[0] : defaultLang);
 *       return a;                          // -> "cn"
 *     }
 *     loadDomain() {
 *       if (idDefaultLang && lang === defaultLang) {
 *         // lang === "en"  ->  SKIP fetching /lang/<lang>/translate.json
 *         //                    and use the built-in ENGLISH source strings
 *       } else {
 *         // fetch /lang/cn/translate.json   (1521 token -> Chinese entries)
 *       }
 *     }
 *
 * English is therefore already the built-in default; the CN build just refuses
 * to *select* it. Two things are needed:
 *
 *   1. "en" must appear in the supported-language list.
 *      /js/macro_config.js does:   var CONFIG_MULTI_LANGUAGE_SORFWARE = "cn";
 *      We pre-install that global as an ACCESSOR property, so the firmware's own
 *      assignment flows through our setter, which appends "en".
 *      (`var X = ...` does not redefine an existing property, and the value
 *       assignment then invokes our setter — so this wins cleanly.)
 *
 *   2. The bLanguage cookie must say "en", so getLang() selects it.
 *
 * /js/macro_config.js is loaded BEFORE /lang/b28n.js, so b28n captures the
 * patched list at init time. Nothing on the router is modified.
 *
 *
 * WHY THIS IS SAFE ON UNRELATED SITES
 *
 * The accessor is inert unless a page assigns CONFIG_MULTI_LANGUAGE_SORFWARE,
 * which is essentially unique to Tenda firmware. The bLanguage cookie is only
 * written when we see one of:
 *   - the firmware actually assigning that variable (definitive proof), or
 *   - a hostname that is a private/LAN address (so the cookie is already in
 *     place on the first paint).
 * Public sites never receive the cookie.
 */
(function () {
  "use strict";

  var KEY = "CONFIG_MULTI_LANGUAGE_SORFWARE";
  var WANT = "en";

  /* ---- cookie helper: only ever touched on LAN-ish hosts ---------------- */
  function setLangCookie() {
    try {
      if (!/(^|;\s*)bLanguage=en(;|$)/.test(document.cookie)) {
        document.cookie = "bLanguage=" + WANT + "; path=/";
      }
    } catch (e) { /* cookies may be blocked; harmless */ }
  }

  function looksLikeLan(host) {
    if (!host) return false;
    var h = host.toLowerCase();
    if (h === "localhost" || h.slice(-6) === ".local" || h.slice(-4) === ".lan" ||
        h.slice(-5) === ".home" || h.slice(-6) === ".internal") return true;
    if (h.indexOf("tenda") !== -1 || h.indexOf("tendawifi") !== -1) return true;
    var m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
      var a = +m[1], b = +m[2];
      if (a === 10 || a === 127) return true;                 // 10/8, loopback
      if (a === 192 && b === 168) return true;                // 192.168/16
      if (a === 172 && b >= 16 && b <= 31) return true;       // 172.16/12
      if (a === 169 && b === 254) return true;                // link-local
    }
    return false;
  }

  // Prime the cookie before first paint when we are clearly on a LAN device.
  try {
    if (looksLikeLan(location.hostname)) setLangCookie();
  } catch (e) { /* ignore */ }

  /* ---- intercept the firmware's language-list assignment ---------------- */
  // null until the firmware assigns it, so on any non-Tenda page this global
  // keeps behaving exactly as if we had never touched it (i.e. undefined).
  var value = null;

  function normalise(v) {
    var list = String(v == null ? "" : v)
      .split(",")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    if (list.indexOf(WANT) === -1) list.push(WANT);
    return list.join(",");
  }

  try {
    Object.defineProperty(window, KEY, {
      configurable: true,
      enumerable: true,
      get: function () { return value === null ? undefined : value; },
      set: function (v) {
        value = normalise(v);
        // Definitive proof we are on Tenda firmware -> safe to set the cookie.
        setLangCookie();
      }
    });
  } catch (e) {
    try {
      if (window[KEY] != null) window[KEY] = normalise(window[KEY]);
    } catch (e2) {}
  }

  // Safety net: only relevant once the firmware has already assigned it, in
  // case the property was later replaced by a plain value.
  try {
    if (value !== null) {
      var cur = window[KEY];
      var fixed = normalise(cur);
      if (cur !== fixed) {
        try { window[KEY] = fixed; } catch (e3) {}
      }
    }
  } catch (e4) { /* ignore */ }
})();
