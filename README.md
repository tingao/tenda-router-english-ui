# Tenda Router — English UI (Chrome extension)

Forces the **Tenda Mesh12X / MX12 with CN firmware** web UI to render in
**English**, with **nothing installed on the router, no server, and no proxy**.

- Works on **any address** you reach the router on — `192.168.0.1`, `10.x`,
  `172.16–31.x`, `192.168.1.254`, `tenda.local`, `tenda.lan`,
  `tendawifi.com`, whatever you use.
- Is **inert on every other website** (see "Safety" below).
- Survives firmware-independent: it does not depend on any particular build's
  file contents.

---

## Install (Chrome / Edge / Brave)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select this folder (`tenda-en-extension`).
5. Open the router UI and **reload the page** (the script must run before the
   page's own JavaScript, so the first load after installing needs a refresh).

No configuration, no options page.

---

## Why this is needed

Your router is a **CN-region build**. Its i18n engine (`/lang/b28n.js`) already
contains complete English strings — English is literally the built-in default:

```js
L.defaultLang = "en";
L.supportLang = CONFIG_MULTI_LANGUAGE_SORFWARE.split(",");
```

But the CN firmware declares:

```js
// /js/macro_config.js
var CONFIG_MULTI_LANGUAGE_SORFWARE = "cn";
```

which makes `support === ["cn"]`, and that has two consequences:

1. `getLang()` can never return `"en"` — even if you set the `bLanguage=en`
   cookie, `isSupport("en")` fails and the code falls back to `support[0]`,
   i.e. `"cn"`.
2. The UI's language dropdown is hidden, because it only renders when
   `support.length > 1`.

Meanwhile `loadDomain()` short-circuits when the selected language *is* the
default:

```js
if (idDefaultLang && lang === defaultLang) {
    // lang === "en": skip fetching /lang/<lang>/translate.json entirely
    // and use the built-in ENGLISH source strings
} else {
    // fetch /lang/cn/translate.json   (1521 token -> Chinese entries)
}
```

So the Chinese you see comes from a runtime-fetched pack
(`/lang/cn/translate.json`), and **English needs no pack at all** — it just
needs the engine to select it.

## How the extension does it

A content script runs in the page's **MAIN world** at **`document_start`**,
i.e. before any page script:

1. It pre-installs `CONFIG_MULTI_LANGUAGE_SORFWARE` on `window` as an
   **accessor property**:

   ```js
   Object.defineProperty(window, KEY, {
     get: () => value === null ? undefined : value,
     set: v  => { value = normalise(v); setLangCookie(); }
   });
   ```

2. When the firmware's own line `var CONFIG_MULTI_LANGUAGE_SORFWARE = "cn"`
   executes, `var` does **not** redefine the existing property, and the value
   assignment invokes **our setter**, which appends `"en"` →
   `"cn,en"`.

3. Because `/js/macro_config.js` is loaded **before** `/lang/b28n.js`, the
   engine captures the patched list at init. `getLang()` now returns `"en"`,
   `loadDomain()` takes the English short-circuit, and the whole UI — login
   page *and* dashboard — renders from the firmware's own English strings.

A side benefit: the **language dropdown reappears** in the top-right, because
`support.length` is now `2`. You get a real EN/CN switcher.

## Safety

- The accessor is **inert** unless a page assigns that variable, which is
  essentially unique to Tenda firmware. On any other site it reads back
  `undefined` and behaves as if untouched.
- The `bLanguage=en` cookie is written **only** when either:
  - the firmware actually assigns that variable (definitive proof), or
  - the hostname is a private/LAN address (so the cookie is in place on the
    first paint).
  Public sites never receive it.
- Nothing is sent anywhere. There is no network code in the extension, no
  background worker, and no remote permissions.
- **Nothing is written to the router.** No firmware change, no NVRAM change.

## Verifying it yourself

Open the router UI and look at the top-right: you should see **"English"** and
the page should read *Login*, *Forgot Password?*, *Network Status*,
*Wi-Fi Settings*, etc.

To confirm the extension is the cause, disable it in `chrome://extensions` and
reload — the UI returns to Chinese.

## Limitations

- **User-visible text only.** It changes the language the UI *renders*; it does
  not change the firmware, the device's region, or any behaviour.
- Requires the page to load `/js/macro_config.js` **after** the content script
  runs. A hard refresh (Ctrl-Shift-R) right after installing is recommended.
- If Tenda ever removes the English strings from a build, or hard-codes the
  language server-side, this stops working. It cannot fix a build that has no
  English strings — though every MX12/Mesh12X build examined so far has them.
- Chrome/Edge/Brave only. Firefox uses a different extension model.

## Why not just flash English firmware?

Because the router **refuses it**, and that refusal is protecting you: Tenda
ships separate firmware per **hardware revision** (the MX12 family spans
V1.0–V4.0 with different silicon — Broadcom `br` vs MediaTek `mt`), and your
unit is **V1.0** while the common English download is **V2.0**. Cross-flashing
that combination is the classic hard-brick, and there is no documented recovery
procedure for this model. This extension gets you the same outcome with none of
that risk.
