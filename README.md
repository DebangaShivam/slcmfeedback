# ⚡ MUJ SLCM Feedback Auto-Pilot

> Automatically fills all 90+ questions with **YES**, selects positive ratings, writes comments, submits, closes confirmation popups, and loops through **every pending teacher** until 100% complete.

---

## 🚀 Quick Start (Zero Installation)

Works on **Chrome, Brave, Edge, and Safari**.

1. Open [MUJ SLCM](https://mujslcm.jaipur.manipal.edu) and go to your **Course Feedback** page (either the list of teachers or inside any form).
2. Open the browser **Console**:
   - **Chrome / Brave / Edge**: Press `F12` (or `Ctrl + Shift + J` on Windows / `Cmd + Option + J` on Mac).
   - **Safari**: Press `Cmd + Option + C` *(enable Develop menu in Safari Settings → Advanced if needed)*.
3. Open [**`slcm_autopilot.js`**](slcm_autopilot.js), copy the entire code (`Ctrl+A` / `Cmd+A` → Copy), paste it into the console, and hit **Enter**.
4. A floating control widget will appear at the bottom-right:
   - Click **🤖 Auto-Pilot ALL**.
   - Sit back and watch it complete all pending teachers automatically in under 60 seconds!

---

## ✨ Features

- **All YES**: Every single one of the 90+ sub-questions is checked to **YES**.
- **Questions 10 & 11**: Automatically sets dropdown ratings to **YES** / **Strongly Agree**.
- **Constructive Comments**: Generates realistic, professional faculty evaluation remarks.
- **Auto-Closes Popups**: Detects and clicks the portal's post-submit confirmation popup (`"undefined"` modal) so you don't have to click Close manually.
- **Auto-Loop**: Automatically opens each pending teacher, waits for questions to load, submits, returns to the list, and repeats until all are done.
- **Console Sandbox**: Uses a persistent workspace iframe so full-page reloads won't kill the script in DevTools.

---

## 🎛️ Widget Buttons

| Button | What it does |
|---|---|
| **⚡ Fill This Form** | Fills all fields on the current open form (no submit). |
| **🚀 Fill & Submit** | Fills current form, submits, and closes the popup. |
| **🤖 Auto-Pilot ALL** | Loops through every pending teacher until all are completed. |
| **⛔ Stop** | Immediately stops the auto-pilot. |

*To reset state in console:*
```javascript
localStorage.removeItem('slcm_autorun');
sessionStorage.removeItem('slcm_done_courses');
```

---

## 📂 Other Options

- [**`slcm_autopilot.js`**](slcm_autopilot.js) — **Primary script** (use this for Chrome / Brave / Safari console).
- [**`tampermonkey_slcm.user.js`**](tampermonkey_slcm.user.js) — Install once via Tampermonkey or Safari Userscripts extension for automatic activation on page load.
- [**`autofill.js`**](autofill.js) — Lightweight one-shot script to quickly fill only 1 open form.
- [**`bookmarklet.txt`**](bookmarklet.txt) — 1-click button for your browser's bookmarks bar.
