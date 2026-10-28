/**
 * SLCM MUJ Course Feedback Auto-Filler (v2.2)
 * Fills YES to all 90+ questions, selects positive dropdowns (Q10 & Q11),
 * adds a constructive comment, clicks Submit, and closes the confirmation modal.
 */
(async function autofillFeedback() {
  console.log('🚀 Starting SLCM Feedback Autofill v2.2...');

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function isVisible(el) {
    if (!el) return false;
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch (e) {
      return false;
    }
  }

  function smartClick(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    if (typeof el.click === 'function') el.click();
    else el.dispatchEvent(new MouseEvent('click', opts));
  }

  function nativeSet(el, value) {
    const protoObj = el.tagName === 'SELECT'
      ? window.HTMLSelectElement.prototype
      : el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const proto = Object.getOwnPropertyDescriptor(protoObj, 'value');
    if (proto && proto.set) proto.set.call(el, value);
    else el.value = value;
    ['focus', 'input', 'change', 'blur'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
  }

  let filledCount = 0;

  // 1. Click all deduplicated "YES" elements
  const candidates = Array.from(
    document.querySelectorAll('label, button, input[type="button"], a, span, div, td, [role="button"]')
  ).filter(el => isVisible(el) && (el.tagName === 'INPUT' ? el.value : el.textContent || '').trim().toUpperCase() === 'YES');

  const toClick = candidates.filter(el => {
    const anc = el.parentElement?.closest('label, button, a, [role="button"]');
    if (anc && candidates.includes(anc)) return false;
    if (['DIV', 'TD', 'SPAN'].includes(el.tagName) && candidates.some(o => o !== el && el.contains(o))) return false;
    return true;
  });

  for (const el of toClick) {
    smartClick(el);
    filledCount++;
    await sleep(8);
  }

  // Radio inputs backup
  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    const val = (radio.value || '').trim().toUpperCase();
    const id = (radio.id || '').trim().toUpperCase();
    if (['YES', 'Y', '1', '5', 'TRUE'].includes(val) || id.includes('YES')) {
      if (!radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        filledCount++;
      }
    }
  });

  // 2. Select positive responses for dropdowns (Questions 10 & 11)
  const dropdownPriority = ['YES', 'STRONGLY AGREE', 'EXCELLENT', 'VERY GOOD', 'AGREE', 'GOOD', 'TRUE'];
  document.querySelectorAll('select').forEach(sel => {
    if (!sel.options || sel.options.length <= 1 || !isVisible(sel)) return;
    let bestIndex = 1;
    outer:
    for (const pref of dropdownPriority) {
      for (let i = 1; i < sel.options.length; i++) {
        const txt = sel.options[i].text.trim().toUpperCase();
        const val = (sel.options[i].value || '').trim().toUpperCase();
        if (txt === pref || val === pref || txt.includes(pref)) {
          bestIndex = i;
          break outer;
        }
      }
    }
    sel.selectedIndex = bestIndex;
    sel.options[bestIndex].selected = true;
    nativeSet(sel, sel.options[bestIndex].value);
    filledCount++;
  });

  // 3. Fill Comments textarea
  document.querySelectorAll('textarea, input[type="text"]').forEach(input => {
    if (input.readOnly || input.disabled || !isVisible(input)) return;
    const isComment = input.tagName === 'TEXTAREA' ||
                      /comment|feedback|remark/i.test(input.name || input.id || input.placeholder || '');
    if (isComment && !input.value.trim()) {
      nativeSet(input, 'Excellent teaching methodology, very clear explanations, and engaging lectures.');
      filledCount++;
    }
  });

  console.log(`✅ Filled ${filledCount} fields!`);

  // 4. Click Submit
  const submitBtn = Array.from(
    document.querySelectorAll('button, input[type="submit"], input[type="button"], a, [role="button"], .btn')
  ).find(b => {
    if (!isVisible(b)) return false;
    const txt = (b.textContent || b.value || '').trim();
    return /^(submit|save|submit\s*feedback|submit\s*&\s*save|save\s*&\s*submit)$/i.test(txt);
  });

  if (submitBtn) {
    submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(350);
    smartClick(submitBtn);
    console.log('🚀 Submit clicked! Monitoring for confirmation popup…');

    const start = Date.now();
    while (Date.now() - start < 15000) {
      await sleep(300);
      const closeBtn = Array.from(
        document.querySelectorAll('button, a, [role="button"], input[type="button"], .btn')
      ).find(b => {
        if (!isVisible(b)) return false;
        const txt = (b.textContent || b.value || '').trim();
        return /^(close|ok|okay|dismiss|done|got it|continue)$/i.test(txt) || b.getAttribute('data-dismiss') === 'modal';
      });

      if (closeBtn) {
        smartClick(closeBtn);
        console.log('🎉 Popup dismissed & feedback submitted!');
        break;
      }
    }
  } else {
    console.warn('⚠️ Submit button not found. Please click submit manually.');
  }
})();