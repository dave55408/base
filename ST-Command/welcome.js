(() => {
  'use strict';
  const dialog = document.getElementById('welcome-screen');
  const dismiss = document.getElementById('welcome-dismiss');
  const preferenceKey = 'st-command-hide-welcome';
  let resume = false;
  try {
    if (localStorage.getItem(preferenceKey) === 'true') return;
  } catch (_) { /* Welcome remains usable when browser storage is unavailable. */ }

  dialog.showModal();
  window.addEventListener('DOMContentLoaded', () => {
    if (dialog.open && window.STCommand && !STCommand.state.paused) {
      resume = true;
      STCommand.pause();
    }
  }, {once: true});

  document.getElementById('welcome-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    try {
      if (dismiss.checked) localStorage.setItem(preferenceKey, 'true');
      else localStorage.removeItem(preferenceKey);
    } catch (_) { /* Closing must work even if the preference cannot be saved. */ }
    if (resume && window.STCommand?.state.paused) STCommand.pause();
    resume = false;
  });
  // Keep flight shortcuts out of the modal while retaining native form keys.
  for (const type of ['keydown', 'keyup']) {
    window.addEventListener(type, event => {
      if (!dialog.open) return;
      event.stopImmediatePropagation();
      if (type === 'keydown' && event.key === 'Escape') {
        event.preventDefault();
        dialog.close();
      }
    }, {capture: true});
  }
})();
