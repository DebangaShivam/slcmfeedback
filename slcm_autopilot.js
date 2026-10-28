// ==UserScript==
// @name         SLCM MUJ Feedback Auto-Pilot v2.2
// @namespace    https://mujslcm.jaipur.manipal.edu/
// @version      2.2
// @description  Fully automates MUJ SLCM course feedback for all pending teachers.
//               Survives full-page reloads in both DevTools Console & Tampermonkey,
//               fills YES/NO, dropdowns, comments, submits, and closes popups.
// @author       Debanga Shivam
// @match        *://mujslcm.jaipur.manipal.edu/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Prevent duplicate injection inside the child workspace iframe if running via Userscript
  if (window.name === 'slcm_workspace_frame') {
    try {
      window.alert = (msg) => { console.log('[SLCM-Frame] Alert intercepted:', msg); return true; };
      window.confirm = (msg) => { console.log('[SLCM-Frame] Confirm intercepted:', msg); return true; };
    } catch (e) {}
    return;
  }

  // ─── CONFIG ──────────────────────────────────────────────────────────────
  const CONFIG = {
    defaultAnswer: 'YES',
    dropdownPreference: ['YES', 'STRONGLY AGREE', 'EXCELLENT', 'VERY GOOD', 'AGREE', 'GOOD', 'TRUE'],
    comments: [
      'Excellent teaching methodology, very clear explanations, and engaging lectures.',
      'Concepts were explained thoroughly with relevant practical examples. Very approachable faculty.',
      'Delivered curriculum effectively on time, interactive classroom environment, and great support.',
      'Very supportive and encouraging. Highly clear problem-solving and great subject expertise.',
      'Well-organized course. Faculty is knowledgeable and provides timely feedback on assignments.'
    ],
    yesNoDelay: 10,       // Fast 10ms delay so 90+ questions fill in < 1 second
    actionDelay: 60,      // Delay for dropdowns and comments
    nextCourseDelay: 1000,
    autoRunKey: 'slcm_autorun',
    doneCoursesKey: 'slcm_done_courses'
  };

  let isAutoPilotRunning = false;
  let workspaceIframe = null;

  // ─── NATIVE DIALOG INTERCEPTION ──────────────────────────────────────────
  function patchDialogs(win = window) {
    try {
      win.alert = function (msg) {
        console.log('[SLCM] Intercepted native alert:', msg);
        return true;
      };
      win.confirm = function (msg) {
        console.log('[SLCM] Intercepted native confirm:', msg);
        return true;
      };
    } catch (e) {}
  }
  patchDialogs(window);

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function randomComment() {
    return CONFIG.comments[Math.floor(Math.random() * CONFIG.comments.length)];
  }

  function getDoneCourses() {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(CONFIG.doneCoursesKey) || '[]'));
    } catch (e) {
      return new Set();
    }
  }

  function markCourseDone(key) {
    if (!key) return;
    const set = getDoneCourses();
    set.add(key);
    try {
      sessionStorage.setItem(CONFIG.doneCoursesKey, JSON.stringify(Array.from(set)));
    } catch (e) {}
  }

  function clearDoneCourses() {
    try {
      sessionStorage.removeItem(CONFIG.doneCoursesKey);
    } catch (e) {}
  }

  // ─── ACTIVE DOCUMENT & WINDOW RESOLVER ───────────────────────────────────
  // Works seamlessly whether operating on the main document, the persistent
  // workspace iframe, or nested portal iframes.
  function getActiveWin() {
    if (workspaceIframe && workspaceIframe.isConnected) {
      try {
        if (workspaceIframe.contentWindow && workspaceIframe.contentDocument) {
          patchDialogs(workspaceIframe.contentWindow);
          return workspaceIframe.contentWindow;
        }
      } catch (e) {}
    }
    return window;
  }

  function getActiveDoc() {
    return getActiveWin().document || document;
  }

  function getAllSearchableDocs() {
    const rootDoc = getActiveDoc();
    const docs = [rootDoc];
    try {
      const frames = rootDoc.querySelectorAll('iframe, frame');
      for (const f of frames) {
        if (f.id === 'slcm-workspace') continue;
        try {
          if (f.contentDocument) {
            patchDialogs(f.contentWindow);
            docs.push(f.contentDocument);
          }
        } catch (e) {}
      }
    } catch (e) {}
    return docs;
  }

  function queryAll(selector) {
    const results = [];
    for (const doc of getAllSearchableDocs()) {
      try {
        results.push(...Array.from(doc.querySelectorAll(selector)));
      } catch (e) {}
    }
    return results;
  }

  // ─── PERSISTENT WORKSPACE IFRAME (SURVIVES FULL PAGE RELOADS IN CONSOLE) ─
  async function ensureWorkspaceLoaded() {
    if (workspaceIframe && workspaceIframe.isConnected) {
      return true;
    }

    toast('🛡️ Mounting persistent workspace…', 'info');
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.id = 'slcm-workspace';
      iframe.name = 'slcm_workspace_frame';
      iframe.src = window.location.href;
      iframe.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:none;z-index:999990;background:#fff;';

      let resolved = false;
      const finish = (ok) => {
        if (resolved) return;
        resolved = true;
        if (ok) {
          patchDialogs(iframe.contentWindow);
        }
        resolve(ok);
      };

      const timeout = setTimeout(() => finish(true), 6000);

      iframe.addEventListener('load', () => {
        clearTimeout(timeout);
        patchDialogs(iframe.contentWindow);
        finish(true);
      }, { once: true });

      iframe.addEventListener('error', () => {
        clearTimeout(timeout);
        iframe.remove();
        workspaceIframe = null;
        finish(false);
      }, { once: true });

      document.body.appendChild(iframe);
      workspaceIframe = iframe;
    });
  }

  function destroyWorkspace(reloadMain = false) {
    if (workspaceIframe) {
      let finalHref = null;
      try {
        finalHref = workspaceIframe.contentWindow?.location?.href;
      } catch (e) {}
      workspaceIframe.remove();
      workspaceIframe = null;
      if (reloadMain) {
        if (finalHref && finalHref.includes('jaipur.manipal.edu')) {
          window.location.href = finalHref;
        } else {
          window.location.reload();
        }
      }
    }
  }

  // ─── ROBUST ELEMENT VISIBILITY CHECK ─────────────────────────────────────
  function isVisible(el) {
    if (!el) return false;
    try {
      const win = el.ownerDocument?.defaultView || window;
      const style = win.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch (e) {
      return false;
    }
  }

  // ─── FRAMEWORK-AWARE VALUE SETTER ────────────────────────────────────────
  function nativeSet(element, value) {
    if (!element) return;
    const win = element.ownerDocument?.defaultView || window;
    let protoObj;
    if (element.tagName === 'SELECT') {
      protoObj = win.HTMLSelectElement?.prototype;
    } else if (element.tagName === 'TEXTAREA') {
      protoObj = win.HTMLTextAreaElement?.prototype;
    } else {
      protoObj = win.HTMLInputElement?.prototype;
    }
    const proto = protoObj ? Object.getOwnPropertyDescriptor(protoObj, 'value') : null;
    if (proto && proto.set) {
      proto.set.call(element, value);
    } else {
      element.value = value;
    }
    ['focus', 'input', 'change', 'blur'].forEach(ev =>
      element.dispatchEvent(new win.Event(ev, { bubbles: true }))
    );
  }

  // ─── SINGLE-FIRE SYNTHETIC CLICK (NO DOUBLE-TOGGLE BUG) ──────────────────
  function smartClick(el) {
    if (!el) return;
    try {
      const win = el.ownerDocument?.defaultView || window;
      const opts = { bubbles: true, cancelable: true, view: win };
      el.dispatchEvent(new win.MouseEvent('mousedown', opts));
      el.dispatchEvent(new win.MouseEvent('mouseup', opts));
      if (typeof el.click === 'function') {
        el.click();
      } else {
        el.dispatchEvent(new win.MouseEvent('click', opts));
      }
    } catch (e) {
      try { el.click(); } catch (_) {}
    }
  }

  // ─── TOAST NOTIFICATIONS & STATUS BAR ────────────────────────────────────
  function setStatus(msg) {
    const el = document.getElementById('slcm-st');
    if (el) el.textContent = msg;
  }

  function toast(message, type = 'info') {
    const colors = { info: '#3b82f6', success: '#10b981', warn: '#f59e0b', error: '#ef4444' };
    if (!document.getElementById('slcm-style')) {
      const s = document.createElement('style');
      s.id = 'slcm-style';
      s.textContent = `
        @keyframes slcm-in  { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slcm-out { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-10px)} }
      `;
      document.head.appendChild(s);
    }
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;top:20px;right:20px;z-index:9999999;background:${colors[type] || colors.info};
      color:#fff;padding:12px 18px;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;
      font-size:14px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,0.3);
      animation:slcm-in 0.3s ease;pointer-events:none;`;
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.animation = 'slcm-out 0.3s ease forwards';
      setTimeout(() => t.remove(), 300);
    }, 3000);
  }

  // ─── POPUP & MODAL DISMISSER ──────────────────────────────────────────────
  async function dismissPopups() {
    let dismissed = false;

    const candidateButtons = queryAll(
      'button, a, [role="button"], input[type="button"], input[type="submit"], span.btn, div.btn'
    );

    for (const btn of candidateButtons) {
      if (!isVisible(btn)) continue;
      if (btn.closest('#slcm-panel')) continue;

      const txt = (btn.textContent || btn.value || '').trim();

      if (/^(close|ok|okay|dismiss|done|got it|continue|proceed|confirm)$/i.test(txt)) {
        console.log('[SLCM] Dismissing popup button:', txt);
        smartClick(btn);
        dismissed = true;
        await sleep(300);
        break;
      }

      if (
        btn.getAttribute('data-dismiss') === 'modal' ||
        btn.getAttribute('aria-label') === 'Close' ||
        btn.classList?.contains('close')
      ) {
        console.log('[SLCM] Dismissing modal via close attribute');
        smartClick(btn);
        dismissed = true;
        await sleep(300);
        break;
      }
    }

    if (!dismissed) {
      const modals = queryAll(
        '.modal, [role="dialog"], .bootbox, .swal-overlay, .swal2-container, .modal-dialog, .sweet-alert'
      );
      for (const m of modals) {
        if (isVisible(m) && !m.closest('#slcm-panel')) {
          const actionBtn = m.querySelector('button, a, .btn, input[type="button"], [role="button"]');
          if (actionBtn && isVisible(actionBtn)) {
            console.log('[SLCM] Clicking modal inner action button:', (actionBtn.textContent || actionBtn.value || '').trim());
            smartClick(actionBtn);
            dismissed = true;
            await sleep(300);
            break;
          }
        }
      }
    }

    for (const doc of getAllSearchableDocs()) {
      try {
        const jq = doc.defaultView?.jQuery;
        if (jq && jq('.modal.show, .modal.in').length > 0) {
          jq('.modal').modal('hide');
          dismissed = true;
        }
      } catch (e) {}
    }

    return dismissed;
  }

  async function waitForSubmitAndDismiss(maxWaitMs = 15000) {
    const start = Date.now();
    console.log('[SLCM] Waiting for submit to finalize and auto-closing popup…');

    while (Date.now() - start < maxWaitMs) {
      const dismissed = await dismissPopups();
      if (dismissed) {
        console.log('[SLCM] Submission modal dismissed successfully!');
        toast('✖️ Submission popup closed!', 'success');
        await sleep(900);
        return true;
      }

      if (onListPage() && !onFormPage()) {
        console.log('[SLCM] Returned to course list page.');
        return true;
      }

      await sleep(250);
    }
    return false;
  }

  // ─── FILL YES/NO QUESTIONS (DEDUPLICATED & FAST) ─────────────────────────
  function isAlreadySelected(el) {
    if (!el) return false;
    if (el.checked === true) return true;
    if (el.getAttribute?.('aria-pressed') === 'true' || el.getAttribute?.('aria-checked') === 'true') return true;
    if (el.classList?.contains('active') || el.classList?.contains('selected')) return true;
    const innerRadio = el.querySelector?.('input[type="radio"], input[type="checkbox"]');
    if (innerRadio && innerRadio.checked) return true;
    if (el.tagName === 'LABEL' && el.htmlFor) {
      const linked = el.ownerDocument?.getElementById(el.htmlFor);
      if (linked && linked.checked) return true;
    }
    return false;
  }

  async function fillYesNoQuestions() {
    let count = 0;
    const target = CONFIG.defaultAnswer.toUpperCase();

    // 1. Collect all visible elements whose trimmed text or value is "YES"
    const candidates = queryAll('label, button, input[type="button"], a, span, div, td, [role="button"]').filter(el => {
      if (el.closest('#slcm-panel')) return false;
      if (!isVisible(el)) return false;
      const txt = (el.tagName === 'INPUT' ? el.value : el.textContent || '').trim().toUpperCase();
      return txt === target;
    });

    // 2. Deduplicate nested matches:
    // If a <label> or <button> wraps a <span>YES</span>, keep the <label>/<button>.
    // Otherwise, keep only the innermost element so we never click both parent and child.
    const toClick = candidates.filter(el => {
      const ancLabelOrBtn = el.parentElement?.closest('label, button, a, [role="button"]');
      if (ancLabelOrBtn && candidates.includes(ancLabelOrBtn)) {
        return false; // Let the parent <label> or <button> handle the click
      }
      if (['DIV', 'TD', 'SPAN'].includes(el.tagName)) {
        const hasDescendantCandidate = candidates.some(other => other !== el && el.contains(other));
        if (hasDescendantCandidate) return false;
      }
      return true;
    });

    for (const el of toClick) {
      if (!isAlreadySelected(el)) {
        smartClick(el);
      }
      count++;
      if (CONFIG.yesNoDelay > 0) await sleep(CONFIG.yesNoDelay);
    }

    // 3. Ensure any underlying <input type="radio"> for YES is explicitly checked
    const radios = queryAll('input[type="radio"]');
    const positiveVals = ['YES', 'Y', '1', '5', 'TRUE'];
    for (const radio of radios) {
      if (radio.closest('#slcm-panel')) continue;
      const doc = radio.ownerDocument || document;
      const win = doc.defaultView || window;
      const val = (radio.value || '').trim().toUpperCase();
      const id = (radio.id || '').trim().toUpperCase();
      const forLbl = (radio.id ? doc.querySelector(`label[for="${CSS.escape(radio.id)}"]`)?.textContent : '') || '';
      const parentLbl = radio.closest('label')?.textContent || '';
      const lblText = (forLbl || parentLbl).trim().toUpperCase();

      if (positiveVals.includes(val) || id.includes(target) || lblText === target) {
        if (!radio.checked) {
          radio.checked = true;
          radio.dispatchEvent(new win.Event('input', { bubbles: true }));
          radio.dispatchEvent(new win.Event('change', { bubbles: true }));
          const clickTarget = (radio.id && doc.querySelector(`label[for="${CSS.escape(radio.id)}"]`)) || radio.closest('label') || radio;
          if (isVisible(clickTarget) && !toClick.includes(clickTarget)) {
            smartClick(clickTarget);
          }
          count++;
        }
      }
    }

    console.log(`[SLCM] YES/NO: ${count} filled`);
    return count;
  }

  // ─── FILL DROPDOWNS (QUESTIONS 10 & 11) ──────────────────────────────────
  async function fillDropdowns() {
    let count = 0;
    for (const sel of queryAll('select')) {
      if (sel.closest('#slcm-panel')) continue;
      if (!sel.options || sel.options.length <= 1 || sel.disabled || !isVisible(sel)) continue;

      let bestIdx = 1;
      outer:
      for (const pref of CONFIG.dropdownPreference) {
        for (let i = 1; i < sel.options.length; i++) {
          const optText = sel.options[i].text.trim().toUpperCase();
          const optVal = (sel.options[i].value || '').trim().toUpperCase();
          if (optText === pref || optVal === pref || optText.includes(pref)) {
            bestIdx = i;
            break outer;
          }
        }
      }

      sel.selectedIndex = bestIdx;
      if (sel.options[bestIdx]) {
        sel.options[bestIdx].selected = true;
        nativeSet(sel, sel.options[bestIdx].value);
      }

      try {
        const win = sel.ownerDocument?.defaultView || window;
        const ng = win.angular?.element(sel)?.controller?.('ngModel');
        if (ng) {
          ng.$setViewValue(sel.value);
          ng.$commitViewValue();
        }
      } catch (e) {}

      console.log(`[SLCM] Dropdown → "${sel.options[bestIdx]?.text}"`);
      count++;
      await sleep(CONFIG.actionDelay);
    }
    console.log(`[SLCM] Dropdowns: ${count} filled`);
    return count;
  }

  // ─── FILL COMMENTS ───────────────────────────────────────────────────────
  async function fillComments() {
    let count = 0;
    const inputs = queryAll('textarea, input[type="text"]');
    for (const el of inputs) {
      if (el.closest('#slcm-panel')) continue;
      if (el.readOnly || el.disabled || !isVisible(el)) continue;
      const isComment = el.tagName === 'TEXTAREA' ||
        /comment|feedback|remark/i.test(el.name || el.id || el.placeholder || '');
      if (isComment) {
        if (!el.value.trim()) {
          nativeSet(el, randomComment());
        }
        count++;
        await sleep(CONFIG.actionDelay);
      }
    }
    console.log(`[SLCM] Comments: ${count} filled`);
    return count;
  }

  // ─── FIND & CLICK SUBMIT ─────────────────────────────────────────────────
  function findSubmitButton() {
    const candidates = queryAll(
      'button, input[type="submit"], input[type="button"], a, [role="button"], span.btn, div.btn'
    );
    return candidates.find(el => {
      if (!isVisible(el) || el.closest('#slcm-panel')) return false;
      const txt = (el.textContent || el.value || '').trim();
      const idName = `${el.id || ''} ${el.name || ''}`.toLowerCase();
      return /^(submit|save|submit\s*feedback|submit\s*&\s*save|save\s*&\s*submit)$/i.test(txt) ||
             (/submit/i.test(idName) && !/cancel|close|reset/i.test(txt));
    }) || null;
  }

  async function clickSubmit() {
    const btn = findSubmitButton();
    if (btn) {
      try {
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {}
      await sleep(350);
      smartClick(btn);
      console.log('[SLCM] Submit clicked');
      return true;
    }
    return false;
  }

  // ─── PAGE & STATE DETECTION HELPERS ──────────────────────────────────────
  function countVisibleYesElements() {
    return queryAll('button, label, span, td, a, div, input[type="button"], [role="button"]').filter(el => {
      if (el.closest('#slcm-panel') || !isVisible(el)) return false;
      const txt = (el.tagName === 'INPUT' ? el.value : el.textContent || '').trim().toUpperCase();
      return txt === 'YES';
    }).length;
  }

  function isFormShellVisible() {
    for (const doc of getAllSearchableDocs()) {
      const bodyText = doc.body?.innerText || '';
      if (/Feedback\s*Questionnaire|Course\s*&\s*Faculty\s*Detail|I\s*liked\s*this\s*course/i.test(bodyText)) {
        return true;
      }
    }
    return false;
  }

  function onFormPage() {
    const yesCount = countVisibleYesElements();
    const hasSubmit = Boolean(findSubmitButton());
    const hasSelectsAndComments = queryAll('select').length >= 2 && queryAll('textarea').length >= 1;
    return yesCount >= 2 || (yesCount >= 1 && hasSubmit) || (hasSelectsAndComments && isFormShellVisible());
  }

  function getRowKey(row) {
    if (!row) return '';
    const cells = Array.from(row.querySelectorAll('td'));
    const course = cells[2]?.textContent?.trim() || '';
    const faculty = cells[3]?.textContent?.trim() || '';
    const sNo = cells[0]?.textContent?.trim() || '';
    return `${sNo}|${course}|${faculty}`;
  }

  function getCurrentFormCourseKey() {
    // Extracts Faculty + Course Name on the open form if present
    for (const doc of getAllSearchableDocs()) {
      const text = doc.body?.innerText || '';
      const m = text.match(/Faculty\s*Name[\s\S]{0,80}?([A-Za-z.\s]+)\n/i);
      if (m) return m[1].trim();
    }
    return '';
  }

  function getPendingRows(ignoreSessionFilter = false) {
    const pendingCells = queryAll('td, span, div, a, label, b, strong').filter(el => {
      if (el.closest('#slcm-panel')) return false;
      return /^pending$/i.test(el.textContent.trim()) && isVisible(el);
    });

    const doneSet = getDoneCourses();
    const freshRows = [];
    const fallbackRows = [];
    const seen = new Set();

    for (const cell of pendingCells) {
      const row = cell.closest('tr');
      if (row && !seen.has(row)) {
        seen.add(row);
        const key = getRowKey(row);
        if (!ignoreSessionFilter && key && doneSet.has(key)) {
          fallbackRows.push(row);
        } else {
          freshRows.push(row);
        }
      }
    }

    return freshRows.length > 0 ? freshRows : fallbackRows;
  }

  function onListPage() {
    if (onFormPage() || isFormShellVisible()) return false;
    if (getPendingRows(true).length > 0) return true;

    for (const doc of getAllSearchableDocs()) {
      const text = doc.body?.innerText || '';
      if (/List\s*of\s*Courses/i.test(text) && /Faculty\s*Name/i.test(text)) {
        return true;
      }
    }
    return false;
  }

  async function waitForFormReady(timeoutMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await dismissPopups();
      if (onFormPage()) {
        // Give the portal an extra 400ms to finish rendering all 90+ rows
        await sleep(400);
        return true;
      }
      await sleep(300);
    }
    return onFormPage();
  }

  async function waitForListReady(timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await dismissPopups();
      if (onListPage() && !onFormPage()) return true;
      await sleep(300);
    }
    return onListPage() && !onFormPage();
  }

  // ─── CLICK NEXT PENDING ROW (TARGETS STATUS CELL & COURSE CELL) ──────────
  let lastOpenedRowKey = '';

  async function clickNextPending() {
    const pendingRows = getPendingRows();
    if (pendingRows.length === 0) return false;

    const row = pendingRows[0];
    lastOpenedRowKey = getRowKey(row);
    const cells = Array.from(row.querySelectorAll('td'));
    const courseName = cells[2]?.textContent?.trim() || cells[1]?.textContent?.trim() || 'course';
    const facultyName = cells[3]?.textContent?.trim() || '';

    toast(`📋 Opening: ${courseName} (${facultyName})…`, 'info');
    setStatus(`Opening: ${courseName.slice(0, 18)}…`);
    console.log(`[SLCM] Opening pending course: ${courseName} — ${facultyName}`);

    // Priority 1: Clickable link/button inside Status cell (cells[4]) or anywhere in the row
    const statusCell = cells[4] || cells[cells.length - 1] || row;
    const statusClickable = statusCell.querySelector('a, button, [role="button"], [onclick], input[type="button"], span');
    const rowClickable = row.querySelector('a[href], a, button, [role="button"], [onclick], input[type="button"]');

    const primaryTarget = (statusClickable && isVisible(statusClickable))
      ? statusClickable
      : (rowClickable && isVisible(rowClickable))
        ? rowClickable
        : statusCell;

    // If it's a direct <a> with a real URL and we have our workspace iframe, navigate the workspace directly
    const anchor = primaryTarget.closest?.('a') || row.querySelector('a[href]');
    const href = anchor?.getAttribute('href') || '';
    if (anchor && href && !href.startsWith('#') && !/^javascript:/i.test(href) && workspaceIframe) {
      try {
        workspaceIframe.contentWindow.location.href = anchor.href;
        return true;
      } catch (e) {}
    }

    // Otherwise fire synthetic click on the status cell / link, course cell, and row
    smartClick(primaryTarget);
    await sleep(120);

    if (!onFormPage() && !isFormShellVisible()) {
      if (cells[2] && primaryTarget !== cells[2]) {
        smartClick(cells[2]);
        await sleep(100);
      }
      smartClick(row);
    }

    return true;
  }

  // ─── FILL AND SUBMIT CURRENT FORM ────────────────────────────────────────
  async function fillAndSubmit() {
    toast('⚡ Autofilling form…', 'info');
    setStatus('Filling questions…');
    await sleep(250);

    const y = await fillYesNoQuestions();
    const d = await fillDropdowns();
    const c = await fillComments();
    const total = y + d + c;

    if (total === 0) {
      toast('⚠️ Could not find questions to fill.', 'warn');
      return false;
    }

    toast(`✅ Filled ${total} items! Submitting…`, 'success');
    setStatus(`Filled ${total}! Submitting…`);
    await sleep(350);

    const submitted = await clickSubmit();
    if (!submitted) {
      toast('⚠️ Submit button not found. Please click submit manually.', 'warn');
      setStatus('Submit btn not found');
      return false;
    }

    if (lastOpenedRowKey) {
      markCourseDone(lastOpenedRowKey);
    }
    return true;
  }

  // ─── FULL AUTONOMOUS AUTO-PILOT LOOP ─────────────────────────────────────
  async function autoPilot() {
    if (isAutoPilotRunning) {
      console.log('[SLCM] Auto-Pilot loop is already active.');
      return;
    }
    isAutoPilotRunning = true;
    localStorage.setItem(CONFIG.autoRunKey, 'true');
    setStatus('🤖 Running…');

    try {
      // Mount persistent same-origin workspace iframe so full-page reloads
      // never wipe out our Console script or floating control panel!
      await ensureWorkspaceLoaded();

      let processedCount = 0;
      const MAX_RUNS = 45;

      while (localStorage.getItem(CONFIG.autoRunKey) === 'true' && processedCount < MAX_RUNS) {
        processedCount++;
        await dismissPopups();
        await sleep(300);

        // If the form header is visible but questions are still loading via AJAX, wait for them
        if (isFormShellVisible() && !onFormPage()) {
          setStatus('⏳ Waiting for questions…');
          await waitForFormReady(15000);
        }

        // CASE 1: Inside a teacher's feedback form
        if (onFormPage()) {
          console.log(`[SLCM] [Step #${processedCount}] Form detected (${ getCurrentFormCourseKey() || 'active' }). Filling…`);
          const ok = await fillAndSubmit();
          if (ok) {
            setStatus('⏳ Closing popup…');
            await waitForSubmitAndDismiss(15000);

            toast('📋 Returning to course list…', 'info');
            setStatus('Returning to list…');
            let backOnList = await waitForListReady(6000);

            if (!backOnList) {
              console.log('[SLCM] Navigating back to course list…');
              try {
                getActiveWin().history.back();
              } catch (e) {}
              backOnList = await waitForListReady(7000);
            }

            await sleep(CONFIG.nextCourseDelay);
          } else {
            await sleep(1500);
          }
          continue;
        }

        // CASE 2: On the course list page
        if (onListPage()) {
          const allPending = getPendingRows(true);
          const remainingPending = getPendingRows(false);
          console.log(`[SLCM] Course list detected. Pending rows: ${remainingPending.length} (total visible: ${allPending.length})`);

          if (allPending.length === 0) {
            toast('🎉 All course feedbacks completed!', 'success');
            setStatus('🎉 All Done!');
            localStorage.removeItem(CONFIG.autoRunKey);
            clearDoneCourses();
            await sleep(1200);
            destroyWorkspace(true);
            break;
          }

          const opened = await clickNextPending();
          if (!opened) {
            console.warn('[SLCM] Could not click pending course.');
            break;
          }

          toast('⏳ Loading feedback form…', 'info');
          setStatus('⏳ Loading form…');
          const formReady = await waitForFormReady(20000);
          if (!formReady) {
            console.warn('[SLCM] Form questions did not render within 20s. Retrying…');
            await sleep(1000);
          }
          continue;
        }

        // CASE 3: Page is transitioning / loading over slow portal connection
        console.log('[SLCM] Waiting for portal page to finish loading…');
        setStatus('⏳ Loading page…');
        const settled = await Promise.race([
          waitForFormReady(10000),
          waitForListReady(10000)
        ]);

        if (!settled && !onFormPage() && !onListPage()) {
          await dismissPopups();
          await sleep(2000);
          if (!onFormPage() && !onListPage() && !isFormShellVisible()) {
            toast('⛔ Auto-pilot paused (page unrecognized).', 'warn');
            setStatus('Paused');
            localStorage.removeItem(CONFIG.autoRunKey);
            break;
          }
        }
      }
    } finally {
      isAutoPilotRunning = false;
    }
  }

  // ─── BACKGROUND POPUP DISMISSER ──────────────────────────────────────────
  setInterval(() => {
    if (localStorage.getItem(CONFIG.autoRunKey) === 'true') {
      dismissPopups();
    }
  }, 500);

  // ─── FLOATING CONTROL PANEL ──────────────────────────────────────────────
  function injectPanel() {
    if (document.getElementById('slcm-panel')) return;

    const style = document.createElement('style');
    style.textContent = `
      #slcm-panel{position:fixed;bottom:24px;right:24px;z-index:9999998;width:220px;
        background:#0f172a;border-radius:16px;
        box-shadow:0 20px 60px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.08);
        overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
      #slcm-hd{display:flex;justify-content:space-between;align-items:center;
        padding:12px 16px;background:linear-gradient(135deg,#1e40af,#7c3aed);
        color:#fff;font-weight:700;font-size:13px;}
      #slcm-x{cursor:pointer;opacity:.7;font-size:13px;padding:0 4px;}
      #slcm-x:hover{opacity:1;}
      #slcm-bd{padding:12px;display:flex;flex-direction:column;gap:8px;}
      .slcm-btn{border:none;padding:9px 12px;border-radius:9px;font-weight:600;
        font-size:12px;cursor:pointer;color:#fff;transition:filter .2s,transform .15s;}
      .slcm-btn:hover{filter:brightness(1.15);transform:scale(1.02);}
      .slcm-btn:active{transform:scale(.97);}
      .sb{background:#3b82f6;} .sg{background:#10b981;}
      .sp{background:#8b5cf6;} .sr{background:#ef4444;}
      #slcm-st{font-size:11px;color:#94a3b8;text-align:center;
        padding:4px;border-top:1px solid rgba(255,255,255,.07);margin-top:2px;}
    `;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'slcm-panel';
    panel.innerHTML = `
      <div id="slcm-hd"><span>⚡ SLCM Auto-Pilot v2.2</span><span id="slcm-x">✕</span></div>
      <div id="slcm-bd">
        <button id="slcm-b1" class="slcm-btn sb">⚡ Fill This Form</button>
        <button id="slcm-b2" class="slcm-btn sg">🚀 Fill &amp; Submit</button>
        <button id="slcm-b3" class="slcm-btn sp">🤖 Auto-Pilot ALL</button>
        <button id="slcm-b4" class="slcm-btn sr">⛔ Stop</button>
        <div id="slcm-st">Ready</div>
      </div>`;
    document.body.appendChild(panel);

    document.getElementById('slcm-b1').onclick = async () => {
      setStatus('Filling…');
      const y = await fillYesNoQuestions();
      const d = await fillDropdowns();
      const c = await fillComments();
      toast(`✅ Filled ${y + d + c} items!`, 'success');
      setStatus(`Done (${y + d + c} filled)`);
    };

    document.getElementById('slcm-b2').onclick = async () => {
      setStatus('Filling & submitting…');
      const ok = await fillAndSubmit();
      if (ok) {
        await waitForSubmitAndDismiss(15000);
        setStatus('Submitted & Closed!');
      } else {
        setStatus('Failed to submit.');
      }
    };

    document.getElementById('slcm-b3').onclick = () => {
      clearDoneCourses();
      autoPilot();
    };

    document.getElementById('slcm-b4').onclick = () => {
      localStorage.removeItem(CONFIG.autoRunKey);
      isAutoPilotRunning = false;
      destroyWorkspace(false);
      setStatus('Stopped.');
      toast('⛔ Auto-pilot stopped.', 'warn');
    };

    document.getElementById('slcm-x').onclick = () => {
      localStorage.removeItem(CONFIG.autoRunKey);
      isAutoPilotRunning = false;
      destroyWorkspace(false);
      panel.remove();
    };
  }

  // ─── INITIALIZATION & AUTO-RESUME ────────────────────────────────────────
  async function init() {
    injectPanel();
    await sleep(900);
    if (localStorage.getItem(CONFIG.autoRunKey) === 'true' && !isAutoPilotRunning) {
      toast('🤖 Resuming Auto-Pilot…', 'info');
      autoPilot();
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();