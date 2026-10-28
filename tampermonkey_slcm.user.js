// ==UserScript==
// @name         MUJ SLCM Feedback Auto-Pilot
// @namespace    https://mujslcm.jaipur.manipal.edu/
// @version      2.1
// @description  Automates tedious course & faculty feedback on MUJ SLCM portal.
// @author       Debanga Shivam
// @match        *://mujslcm.jaipur.manipal.edu/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

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
    actionDelay: 80,
    nextCourseDelay: 1200,
    autoRunKey: 'slcm_autorun',
  };

  try {
    window.alert = function (msg) {
      console.log('[SLCM] Intercepted native alert:', msg);
      return true;
    };
  } catch (e) {}

  function randomComment() {
    return CONFIG.comments[Math.floor(Math.random() * CONFIG.comments.length)];
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function isVisible(el) {
    if (!el) return false;
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch (e) {
      return false;
    }
  }

  function nativeSet(element, value) {
    let protoObj;
    if (element.tagName === 'SELECT') {
      protoObj = window.HTMLSelectElement.prototype;
    } else if (element.tagName === 'TEXTAREA') {
      protoObj = window.HTMLTextAreaElement.prototype;
    } else {
      protoObj = window.HTMLInputElement.prototype;
    }
    const proto = Object.getOwnPropertyDescriptor(protoObj, 'value');
    if (proto && proto.set) {
      proto.set.call(element, value);
    } else {
      element.value = value;
    }
    ['input', 'change'].forEach(ev =>
      element.dispatchEvent(new Event(ev, { bubbles: true }))
    );
  }

  function smartClick(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }));
    el.click();
    el.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }));
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
      animation:slcm-in 0.3s ease;`;
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.animation = 'slcm-out 0.3s ease forwards';
      setTimeout(() => t.remove(), 300);
    }, 3200);
  }

  async function dismissPopups() {
    let dismissed = false;
    const candidateButtons = Array.from(
      document.querySelectorAll('button, a, [role="button"], input[type="button"], span.btn, div.btn')
    );

    for (const btn of candidateButtons) {
      if (!isVisible(btn)) continue;
      if (btn.closest('#slcm-panel')) continue;
      if (btn.id === 'slcm-submit-btn') continue;

      const txt = (btn.textContent || btn.value || '').trim();

      if (/^(close|ok|okay|dismiss|done|got it|continue|proceed|confirm)$/i.test(txt)) {
        console.log('[SLCM] Dismissing popup button:', txt);
        smartClick(btn);
        dismissed = true;
        await sleep(350);
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
        await sleep(350);
        break;
      }
    }

    if (!dismissed) {
      const modals = document.querySelectorAll(
        '.modal, [role="dialog"], .bootbox, .swal-overlay, .swal2-container, .modal-dialog, .sweet-alert'
      );
      for (const m of modals) {
        if (isVisible(m) && !m.closest('#slcm-panel')) {
          const actionBtn = m.querySelector('button, a, .btn, [role="button"]');
          if (actionBtn && isVisible(actionBtn)) {
            console.log('[SLCM] Clicking modal inner action button:', actionBtn.textContent.trim());
            smartClick(actionBtn);
            dismissed = true;
            await sleep(350);
            break;
          }
        }
      }
    }

    try {
      if (window.jQuery && window.jQuery('.modal.show, .modal.in').length > 0) {
        window.jQuery('.modal').modal('hide');
        dismissed = true;
      }
    } catch (e) {}

    return dismissed;
  }

  async function waitForSubmitAndDismiss(maxWaitMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const dismissed = await dismissPopups();
      if (dismissed) {
        toast('✖️ Submission popup closed!', 'success');
        await sleep(1000);
        return true;
      }
      if (onListPage() && !onFormPage()) return true;
      await sleep(250);
    }
    return false;
  }

  async function fillYesNoQuestions() {
    let count = 0;
    const target = CONFIG.defaultAnswer.toUpperCase();

    const allEls = Array.from(document.querySelectorAll('button, label, span, a, td, div'));
    for (const el of allEls) {
      if (el.closest('#slcm-panel')) continue;
      if (el.textContent.trim().toUpperCase() === target && isVisible(el)) {
        smartClick(el);
        count++;
        await sleep(CONFIG.actionDelay);
      }
    }

    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    const positiveVals = ['YES', 'Y', '1', '5', 'TRUE'];
    for (const radio of radios) {
      if (radio.closest('#slcm-panel')) continue;
      const val = (radio.value || '').toUpperCase();
      const id  = (radio.id   || '').toUpperCase();
      const lbl = (document.querySelector(`label[for="${radio.id}"]`)?.textContent || '').toUpperCase();
      if (positiveVals.includes(val) || id.includes(target) || lbl.trim() === target) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        count++;
        await sleep(CONFIG.actionDelay);
      }
    }

    console.log(`[SLCM] YES/NO: ${count} filled`);
    return count;
  }

  async function fillDropdowns() {
    let count = 0;
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      if (sel.closest('#slcm-panel')) continue;
      if (!sel.options || sel.options.length <= 1 || sel.disabled || !isVisible(sel)) continue;

      let bestIdx = 1;
      outer:
      for (const pref of CONFIG.dropdownPreference) {
        for (let i = 1; i < sel.options.length; i++) {
          const optText = sel.options[i].text.trim().toUpperCase();
          const optVal  = (sel.options[i].value || '').trim().toUpperCase();
          if (optText.includes(pref) || optVal === pref || optText === pref) {
            bestIdx = i;
            break outer;
          }
        }
      }

      sel.selectedIndex = bestIdx;
      ['input', 'change'].forEach(ev => sel.dispatchEvent(new Event(ev, { bubbles: true })));

      try {
        const ng = window.angular?.element(sel)?.controller?.('ngModel');
        if (ng) {
          ng.$setViewValue(sel.value);
          ng.$commitViewValue();
        }
      } catch (e) {}

      count++;
      await sleep(CONFIG.actionDelay);
    }
    console.log(`[SLCM] Dropdowns: ${count} filled`);
    return count;
  }

  async function fillComments() {
    let count = 0;
    const inputs = Array.from(document.querySelectorAll('textarea, input[type="text"]'));
    for (const el of inputs) {
      if (el.closest('#slcm-panel')) continue;
      const isComment = el.tagName === 'TEXTAREA' ||
        /comment|feedback|remark/i.test(el.name || el.id || el.placeholder || '');
      if (isComment && !el.value.trim() && isVisible(el)) {
        nativeSet(el, randomComment());
        count++;
        await sleep(CONFIG.actionDelay);
      }
    }
    console.log(`[SLCM] Comments: ${count} filled`);
    return count;
  }

  async function clickSubmit() {
    const btn = Array.from(document.querySelectorAll('button, input[type="submit"], a')).find(el => {
      if (!isVisible(el)) return false;
      if (el.closest('#slcm-panel')) return false;
      const txt = (el.textContent || el.value || '').trim();
      return /^(submit|save|submit feedback|submit & save)$/i.test(txt);
    });

    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(400);
      smartClick(btn);
      console.log('[SLCM] Submit clicked');
      return true;
    }
    return false;
  }

  function countVisibleYesElements() {
    return Array.from(document.querySelectorAll('button, label, span, td, a')).filter(
      el => el.textContent.trim().toUpperCase() === 'YES' && isVisible(el) && !el.closest('#slcm-panel')
    ).length;
  }

  function hasSubmitButton() {
    return Array.from(document.querySelectorAll('button, input[type="submit"], a')).some(
      el => isVisible(el) && !el.closest('#slcm-panel') && /^(submit|save|submit feedback)$/i.test((el.textContent || el.value || '').trim())
    );
  }

  function onFormPage() {
    const yesCount = countVisibleYesElements();
    const hasSubmit = hasSubmitButton();
    return yesCount >= 2 || (yesCount >= 1 && hasSubmit);
  }

  function getPendingRows() {
    const pendingCells = Array.from(document.querySelectorAll('td, span, div, a')).filter(el => {
      if (el.closest('#slcm-panel')) return false;
      return /^pending$/i.test(el.textContent.trim()) && isVisible(el);
    });
    const rows = [];
    const seen = new Set();
    for (const cell of pendingCells) {
      const row = cell.closest('tr');
      if (row && !seen.has(row)) {
        seen.add(row);
        rows.push(row);
      }
    }
    return rows;
  }

  function onListPage() {
    if (onFormPage()) return false;
    const hasPending = getPendingRows().length > 0;
    const hasStatusCol = Array.from(document.querySelectorAll('th, td')).some(
      el => /status/i.test(el.textContent) && isVisible(el) && !el.closest('#slcm-panel')
    );
    return hasPending || hasStatusCol;
  }

  async function waitForFormReady(timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await dismissPopups();
      if (onFormPage()) return true;
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

  async function clickNextPending() {
    const pendingRows = getPendingRows();
    if (pendingRows.length === 0) return false;

    const row = pendingRows[0];
    const cells = Array.from(row.querySelectorAll('td'));
    const courseName = cells[2]?.textContent?.trim() || cells[1]?.textContent?.trim() || 'course';
    toast(`📋 Opening: ${courseName}…`, 'info');

    const link = row.querySelector('a[href], button, [role="button"]');
    if (link && isVisible(link)) {
      smartClick(link);
      return true;
    }

    const targetCell = cells[2] || cells[1] || cells[0] || row;
    smartClick(targetCell);

    await sleep(100);
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }

  async function fillAndSubmit() {
    toast('⚡ Autofilling form…', 'info');
    await sleep(300);

    let y = await fillYesNoQuestions();
    let d = await fillDropdowns();
    let c = await fillComments();
    let total = y + d + c;

    if (total === 0) {
      toast('⚠️ Could not find questions to fill.', 'warn');
      return false;
    }

    toast(`✅ ${total} fields filled! Submitting…`, 'success');
    await sleep(500);

    const submitted = await clickSubmit();
    if (!submitted) {
      toast('⚠️ Submit button not found. Please click submit manually.', 'warn');
      return false;
    }
    return true;
  }

  async function autoPilot() {
    localStorage.setItem(CONFIG.autoRunKey, 'true');
    toast('🤖 Auto-Pilot Started!', 'info');

    let processedCount = 0;
    const MAX_RUNS = 40;

    while (localStorage.getItem(CONFIG.autoRunKey) === 'true' && processedCount < MAX_RUNS) {
      processedCount++;
      await dismissPopups();
      await sleep(350);

      if (onFormPage()) {
        const ok = await fillAndSubmit();
        if (ok) {
          await waitForSubmitAndDismiss(15000);
          toast('📋 Returning to course list…', 'info');
          let backOnList = await waitForListReady(8000);

          if (!backOnList) {
            window.history.back();
            backOnList = await waitForListReady(8000);
          }
          await sleep(CONFIG.nextCourseDelay);
        }
        continue;
      }

      if (onListPage()) {
        const pendingRows = getPendingRows();
        if (pendingRows.length === 0) {
          toast('🎉 All course feedbacks completed!', 'success');
          localStorage.removeItem(CONFIG.autoRunKey);
          const st = document.getElementById('slcm-st');
          if (st) st.textContent = '🎉 All Done!';
          break;
        }

        toast(`📋 ${pendingRows.length} pending — opening next…`, 'info');
        const opened = await clickNextPending();
        if (!opened) break;

        toast('⏳ Loading feedback questions…', 'info');
        const formReady = await waitForFormReady(12000);
        if (!formReady) await sleep(1500);
        continue;
      }

      await sleep(1200);

      if (!onFormPage() && !onListPage()) {
        await dismissPopups();
        await sleep(1500);

        if (!onFormPage() && !onListPage()) {
          toast('🔍 Waiting on Feedback page…', 'warn');
          await sleep(2000);
          if (!onFormPage() && !onListPage()) {
            toast('⛔ Auto-pilot paused.', 'warn');
            localStorage.removeItem(CONFIG.autoRunKey);
            break;
          }
        }
      }
    }
  }

  setInterval(() => {
    if (localStorage.getItem(CONFIG.autoRunKey) === 'true') {
      dismissPopups();
    }
  }, 500);

  const resumeAutoPilot = async () => {
    await sleep(1200);
    if (localStorage.getItem(CONFIG.autoRunKey) === 'true') {
      toast('🤖 Resuming Auto-Pilot…', 'info');
      await sleep(500);
      await autoPilot();
    }
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', resumeAutoPilot);
  } else {
    resumeAutoPilot();
  }

  function injectPanel() {
    if (document.getElementById('slcm-panel')) return;

    const style = document.createElement('style');
    style.textContent = `
      #slcm-panel{position:fixed;bottom:24px;right:24px;z-index:9999998;width:215px;
        background:#0f172a;border-radius:16px;
        box-shadow:0 20px 60px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.08);
        overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
      #slcm-hd{display:flex;justify-content:space-between;align-items:center;
        padding:12px 16px;background:linear-gradient(135deg,#1e40af,#7c3aed);
        color:#fff;font-weight:700;font-size:14px;}
      #slcm-x{cursor:pointer;opacity:.7;font-size:13px;}
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
      <div id="slcm-hd"><span>⚡ SLCM Auto-Pilot</span><span id="slcm-x">✕</span></div>
      <div id="slcm-bd">
        <button id="slcm-b1" class="slcm-btn sb">⚡ Fill This Form</button>
        <button id="slcm-b2" class="slcm-btn sg">🚀 Fill &amp; Submit</button>
        <button id="slcm-b3" class="slcm-btn sp">🤖 Auto-Pilot ALL</button>
        <button id="slcm-b4" class="slcm-btn sr">⛔ Stop</button>
        <div id="slcm-st">Ready</div>
      </div>`;
    document.body.appendChild(panel);

    const st = (msg) => {
      const el = document.getElementById('slcm-st');
      if (el) el.textContent = msg;
    };

    document.getElementById('slcm-b1').onclick = async () => {
      st('Filling…');
      await fillYesNoQuestions();
      await fillDropdowns();
      await fillComments();
      st('Done! Review & submit.');
    };

    document.getElementById('slcm-b2').onclick = async () => {
      st('Filling & submitting…');
      const ok = await fillAndSubmit();
      if (ok) {
        await waitForSubmitAndDismiss(15000);
        st('Submitted & Closed!');
      } else {
        st('Failed to submit.');
      }
    };

    document.getElementById('slcm-b3').onclick = () => {
      if (confirm('Auto-Pilot ALL pending teachers? It will fill each form, auto-close popups, and submit.')) {
        st('🤖 Running…');
        autoPilot();
      }
    };

    document.getElementById('slcm-b4').onclick = () => {
      localStorage.removeItem(CONFIG.autoRunKey);
      st('Stopped.');
      toast('⛔ Auto-pilot stopped.', 'warn');
    };

    document.getElementById('slcm-x').onclick = () => panel.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPanel);
  } else {
    injectPanel();
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(injectPanel, 600);
      if (localStorage.getItem(CONFIG.autoRunKey) === 'true') {
        setTimeout(autoPilot, 1000);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

})();
