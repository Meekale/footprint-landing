'use strict';
(() => {
  const canvas = document.querySelector('#demo');
  let pending;
  function fit() {
    pending = undefined;
    const width = Math.min(340, Math.max(280, window.innerWidth - 8));
    canvas.style.setProperty('--preview-width', width + 'px');
    const height = Math.max(canvas.offsetHeight, canvas.scrollHeight);
    const scale = Math.min(1, (window.innerWidth - 8) / width, (window.innerHeight - 8) / Math.max(1, height));
    canvas.style.setProperty('--preview-scale', String(scale));
  }
  function schedule() {
    if (pending === undefined) pending = requestAnimationFrame(fit);
  }
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(canvas);
  else new MutationObserver(schedule).observe(canvas, { childList:true, subtree:true });
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);
  document.fonts?.ready.then(schedule);
  schedule();
})();
