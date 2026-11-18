'use strict';
document.querySelectorAll('[data-app-preview]').forEach(preview => {
  const frame = preview.querySelector('iframe');
  function stopSlideshow() {
    const play = document.querySelector('#slide-play');
    if (play?.getAttribute('aria-pressed') === 'true') play.click();
  }
  frame.addEventListener('pointerenter', stopSlideshow);
  frame.addEventListener('focus', stopSlideshow);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      frame.contentWindow?.postMessage({ type:'footprint-demo-visibility', active:entries[0].isIntersecting && !frame.hidden },location.origin);
    }, {threshold:.1});
    observer.observe(frame);
  }
});
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.data?.type !== 'footprint-demo-interaction') return;
  const known = [...document.querySelectorAll('[data-app-preview] iframe')].some(frame => frame.contentWindow === event.source);
  if (known && document.querySelector('#slide-play')?.getAttribute('aria-pressed') === 'true') document.querySelector('#slide-play').click();
});
