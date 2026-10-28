# ⚡ MUJ SLCM Course & Faculty Feedback Auto-Pilot

> **Autonomous, zero-click feedback automation for Manipal University Jaipur (MUJ) SLCM Portal.**  
> Automatically answers 90+ questions per teacher, fills positive ratings, writes realistic comments, submits, dismisses portal popups, and loops through all pending courses until complete.

---

## 📌 Context: What Are We Solving?

At the end of every academic semester at Manipal University Jaipur, students are required to complete mandatory course and faculty evaluations on the **MUJ SLCM portal** (`mujslcm.jaipur.manipal.edu`).

### The Problem
* **Portal Lockout**: Until every feedback questionnaire is submitted, critical portal modules (grades, exam hall tickets, subject registrations, and attendance summaries) remain locked.
* **Extreme Tedium & Scale**:
  - Each individual course questionnaire contains **11 sections** with **over 90+ separate sub-questions**.
  - Almost all questions require clicking individual `YES` / `NO` toggle buttons or radio inputs.
  - Section 10 (*"I liked this course"*) and Section 11 (*"I feel this course is relevant"*) require dropdown selections.
  - A qualitative comment box is mandatory for each teacher.
  - Multiplied by 9+ registered subjects, a student has to manually click **800 to 1,000+ individual elements**.
* **Sluggish Portal & Modal Glitches**:
  - Submitting 90+ answers creates substantial server-side AJAX latency.
  - Upon submission, the portal displays a modal dialog with the message `"undefined"` and a `Close` button. The form will not redirect back to the dashboard until this button is clicked.
  - Navigating back and forth between the course table and individual forms by hand takes 15–20 minutes of repetitive clicking.

---

## 🚀 What We Made: The Solution

**MUJ SLCM Auto-Pilot** is an intelligent, browser-native automation suite that completes the entire evaluation process in under **60 seconds**.

### Core Capabilities
- **Universal "YES" Policy**: Automatically identifies and selects `YES` on all 90+ questionnaire items across all 11 sections.
- **Smart Dropdown Ratings**: Automatically selects `"YES"` for Questions 10 & 11, and prioritizes `"STRONGLY AGREE"` / `"EXCELLENT"` for Likert-scale questions.
- **Contextual Comments**: Injects varied, realistic, and constructive positive comments from a rotating feedback bank.
- **Persistent Popup Dismissal Engine**:
  - Fixes the classic Safari bug where fixed-position modal overlays return `offsetParent === null`.
  - Uses `getBoundingClientRect()` and active polling to immediately dismiss the portal's post-submit confirmation popup (`"undefined"` modal) without manual intervention.
- **True Autonomous Loop**:
  - Start from the **course list** or from **inside any form**.
  - Automatically clicks the next pending teacher, waits up to 12 seconds for the server to load the questions (`waitForFormReady`), fills all fields, submits, dismisses the modal, returns to the list, and repeats.
- **Framework-Aware Event Dispatching**: Dispatches native synthetic events (`mousedown`, `mouseup`, `click`, `input`, `change`, and Angular `ngModel` synchronization) so the portal's underlying Angular / jQuery scripts register every answer.
- **Native Alert Neutralization**: Overrides blocking `window.alert()` and `window.confirm()` calls so the browser never pauses unattended execution.
- **Emergency AI Failsafe**: Includes an optional Google Gemini API fallback layer that can inspect and resolve novel DOM structures if the portal markup is ever modified.

---

## 📂 Repository File Structure

| File | Description | Recommended For |
|---|---|---|
| [**`slcm_autopilot.js`**](file:///Users/dds/Developer/SlcmAuto/slcm_autopilot.js) | **Flagship Script (v2.1)**. Full autonomous loop, floating dark-mode UI panel, modal auto-dismiss, and state detection. | **Best overall** (paste into Console or run in Userscript) |
| [**`tampermonkey_slcm.user.js`**](file:///Users/dds/Developer/SlcmAuto/tampermonkey_slcm.user.js) | Formatted Userscript with `@match` metadata. Automatically runs whenever SLCM is opened in Safari or Chrome. | **Set-and-forget automation** |
| [**`autofill.js`**](file:///Users/dds/Developer/SlcmAuto/autofill.js) | Standalone single-form script. Fills current open form, clicks submit, and auto-closes the popup. | Quick one-off form completion |
| [**`bookmarklet.txt`**](file:///Users/dds/Developer/SlcmAuto/bookmarklet.txt) | Minified, one-click browser bookmarklet code. | Instant bookmark bar click |

---

## 🛠️ How to Use (Choose Your Method)

### ⚡ Method 1: Safari DevTools Console (Fastest & Zero Installation)

No extensions or downloads required. Runs directly inside your browser:

#### Step 1: Enable Safari Developer Menu (First-time only)
1. Open **Safari** → Click **Safari** in the top macOS menu bar → **Settings...** (`⌘ + ,`).
2. Navigate to the **Advanced** tab.
3. Check **"Show features for web developers"** (or *"Show Develop menu in menu bar"*).

#### Step 2: Launch Auto-Pilot
1. Open the [MUJ SLCM Portal](https://mujslcm.jaipur.manipal.edu) and navigate to the **Course Feedback** page (either the list of teachers or inside any form).
2. Open the Safari Console: press `Option + Command + C` (`⌥ + ⌘ + C`).
3. *(Optional)* Clear any previous autorun state:
   ```javascript
   localStorage.removeItem('slcm_autorun');
   ```
4. Open [**`slcm_autopilot.js`**](file:///Users/dds/Developer/SlcmAuto/slcm_autopilot.js), copy the entire file (`⌘ + A` → `⌘ + C`), paste it into the console, and hit **Enter**.
5. A floating control widget will appear at the bottom-right of your screen:
   - Click **🤖 Auto-Pilot ALL** and confirm.
   - The bot will loop through every pending faculty member, fill all questions, submit, dismiss popups, and finish automatically!

---

### 🤖 Method 2: Set-and-Forget Userscript (Tampermonkey / Userscripts)

Ideal for fully automated execution across full page reloads:

#### For Safari (macOS):
1. Install the free **[Userscripts extension](https://apps.apple.com/app/userscripts/id1463298887)** from the Mac App Store.
2. Enable it in **Safari Settings** → **Extensions**.
3. Click the Userscripts icon in your Safari toolbar → click the **`+`** button to create a new script.
4. Paste the entire code from [**`tampermonkey_slcm.user.js`**](file:///Users/dds/Developer/SlcmAuto/tampermonkey_slcm.user.js) and save.
5. Whenever you visit the SLCM Feedback page, the helper panel appears automatically.

#### For Chrome / Brave / Edge:
1. Install the **[Tampermonkey](https://www.tampermonkey.net/)** extension.
2. Click **Create a new script**, paste [**`tampermonkey_slcm.user.js`**](file:///Users/dds/Developer/SlcmAuto/tampermonkey_slcm.user.js), and save (`⌘ + S`).

---

### 🔖 Method 3: One-Click Browser Bookmarklet

1. In Safari or Chrome, bookmark any page and name it **"⚡ Auto SLCM"**.
2. Open your Bookmark Manager, edit the bookmark's URL/address, and replace it with the code from [**`bookmarklet.txt`**](file:///Users/dds/Developer/SlcmAuto/bookmarklet.txt).
3. Whenever you are on an SLCM feedback form, click the bookmark once. It will fill all answers, click submit, and close the confirmation popup.

---

## 🧠 Under the Hood: How It Works

```
                                [ Start Auto-Pilot ]
                                         │
                                         ▼
                             ┌───────────────────────┐
                             │ Check Current Page   │
                             └──────────┬────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
       [ Course List Page ]                          [ Feedback Form Page ]
                 │                                             │
      Find rows with "Pending"                      Answer 90+ YES/NO questions
                 │                                             │
     Click next pending teacher                     Select Positive Ratings (YES/Agree)
                 │                                             │
      Wait for AJAX questions                       Inject constructive comment
        (waitForFormReady)                                     │
                 │                                        Click Submit
                 │                                             │
                 │                              Wait for modal & dismiss Close
                 │                               (waitForSubmitAndDismiss)
                 │                                             │
                 │                                   Return to Course List
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        │
                                        ▼
                         [ Are there pending courses? ]
                                   /         \
                              YES /           \ NO
                                 ▼             ▼
                           [ Next Loop ]   [ 🎉 All Done! ]
```

### 1. Element Visibility Engine (`isVisible`)
Standard jQuery/DOM automations often rely on `el.offsetParent !== null`. However, on modern browsers, elements located inside `position: fixed` or `position: absolute` dialogs return `null` for `offsetParent`.  
Our engine inspects `window.getComputedStyle(el)` and checks bounding dimensions via `getBoundingClientRect()`, ensuring modal buttons and dialogs are always detected.

### 2. The Post-Submit "Undefined" Modal Resolver
After submitting 93 answers, SLCM calls an internal function that renders:
```html
<div class="modal ...">
  <div class="modal-body">undefined</div>
  <button class="btn btn-primary">Close</button>
</div>
```
The `dismissPopups()` function actively monitors the DOM for 15 seconds post-submit. The moment any element matching `/^(close|ok|dismiss|done|got it)$/i` or `[data-dismiss="modal"]` appears, it triggers a synthetic mouse sequence (`mousedown` → `mouseup` → `click`), instantly releasing the page to redirect back to the course list.

### 3. State Settlement & Race-Condition Prevention
When transitioning between pages, questions are loaded asynchronously over AJAX. The script utilizes `waitForFormReady(12000)` and `waitForListReady(8000)` polling mechanisms, preventing false errors or premature exits while the university server is responding.

---

## 🎛️ Floating UI Panel Reference

When [**`slcm_autopilot.js`**](file:///Users/dds/Developer/SlcmAuto/slcm_autopilot.js) is injected, a modern dark-mode widget appears at the bottom-right:

| Button | Action |
|---|---|
| **⚡ Fill This Form** | Fills all YES answers, dropdowns, and comments on the open form without submitting. Perfect for manual review. |
| **🚀 Fill & Submit** | Fills the open form, clicks submit, and auto-closes the confirmation modal. |
| **🤖 Auto-Pilot ALL** | Starts the fully autonomous loop across all pending teachers from start to finish. |
| **⛔ Stop** | Immediately cancels auto-pilot and removes the background running state. |

---

## 🛡️ Privacy & Safety
- **100% Client-Side**: All scripts execute locally inside your browser context. No student credentials, personal data, or evaluation answers are sent to any external server.
- **Rate-Limited Actions**: Actions include configurable sleep delays (80ms–350ms) between clicks to simulate natural interaction and avoid overloading the university portal.
- **Non-Destructive**: Only interacts with survey form elements (`YES` buttons, rating selects, textareas, and submit controls).

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><b>1. Will all answers definitely be set to YES?</b></summary>
Yes. All 90+ sub-question radio/button elements are checked to "YES". Dropdowns for Questions 10 & 11 prioritize "YES", and comment textareas receive positive faculty evaluations.
</details>

<details>
<summary><b>2. How do I stop the auto-pilot if I need to cancel?</b></summary>
Click the red <b>⛔ Stop</b> button in the floating panel, or run <code>localStorage.removeItem('slcm_autorun')</code> in your console.
</details>

<details>
<summary><b>3. Why does the portal show an "undefined" popup after submitting?</b></summary>
This is an existing bug in Manipal SLCM's client-side script (it attempts to read a server response message property that is undefined). Our script handles this gracefully by detecting the popup and clicking "Close" immediately.
</details>

<details>
<summary><b>4. What if a course takes a long time to open?</b></summary>
v2.1 includes an active 12-second polling watchdog (<code>waitForFormReady</code>) that continuously checks for question elements to render before attempting to fill, ensuring slow server responses don't break the loop.
</details>
