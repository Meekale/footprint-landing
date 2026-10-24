const dialog = document.querySelector('#info-dialog');
const forestVideo = document.querySelector('.forest-video');
if (forestVideo) {
  const forest = forestVideo.closest('.forest-wallpaper');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let inView = true;
  forestVideo.muted = true;
  forestVideo.defaultMuted = true;
  forestVideo.playbackRate = .9;
  forestVideo.addEventListener('loadedmetadata', () => { forestVideo.playbackRate = .9; });

  function updateForestPlayback() {
    if (reducedMotion.matches || document.hidden || !inView) {
      forestVideo.pause();
      if (reducedMotion.matches) forest.classList.remove('is-video-playing');
      return;
    }
    if (!forestVideo.getAttribute('src')) forestVideo.src = forestVideo.dataset.src;
    forestVideo.play().then(() => {
      if (!reducedMotion.matches && !document.hidden && inView) forest.classList.add('is-video-playing');
      else forestVideo.pause();
    }).catch(() => forest.classList.remove('is-video-playing'));
  }

  forestVideo.addEventListener('error', () => forest.classList.remove('is-video-playing'));
  reducedMotion.addEventListener('change', updateForestPlayback);
  document.addEventListener('visibilitychange', updateForestPlayback);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      updateForestPlayback();
    }, { threshold: 0 });
    observer.observe(forest);
  }
  updateForestPlayback();
}
const wallpaperControl = document.querySelector('.wallpaper-motion');
if (wallpaperControl) {
  wallpaperControl.addEventListener('click', () => {
    const paused = wallpaperControl.closest('.forest-wallpaper').classList.toggle('is-paused');
    wallpaperControl.setAttribute('aria-pressed', String(paused));
    wallpaperControl.setAttribute('aria-label', paused ? 'Play wallpaper animation' : 'Pause wallpaper animation');
    wallpaperControl.firstElementChild.innerHTML = paused ? '&#9654;' : '&#10074;&#10074;';
  });
}
const content = {
  apple: ['Footprint for iPhone', 'The Footprint App Store link is coming soon. An official download link will appear here when the app listing is ready.'],
  android: ['Footprint for Android', 'The Footprint Google Play link is coming soon. An official download link will appear here when the app listing is ready.'],
  instagram: ['Follow Footprint on Instagram', 'Our official Instagram profile will be linked here once it is confirmed.'],
  tiktok: ['Follow Footprint on TikTok', 'Our official TikTok profile will be linked here once it is confirmed.'],
  strava: ['Find Footprint on Strava', 'Our official Strava community link will appear here once it is confirmed.'],
  contact: ['Contact & support', 'The official Footprint support address is being confirmed. This preview does not accept support or personal data requests. Please use the app’s verified support channel when available.']
};
document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', () => {
  const [title, description] = content[button.dataset.dialog];
  document.querySelector('#dialog-title').textContent = title;
  document.querySelector('#dialog-text').textContent = description;
  dialog.showModal();
}));
document.querySelectorAll('.close-dialog, .close-action').forEach(button => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });

const track = document.querySelector('#feature-track');
if (track) {
  const slides = [...track.querySelectorAll('.feature-slide')];
  const dots = [...document.querySelectorAll('.slide-dot')];
  const previous = document.querySelector('#slide-prev');
  const next = document.querySelector('#slide-next');
  const play = document.querySelector('#slide-play');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0;
  let timer;
  let frame;
  let drag;
  let motionFrame;

  function position(index) {
    return track.scrollLeft + slides[index].getBoundingClientRect().left
      - track.getBoundingClientRect().left - parseFloat(getComputedStyle(track).paddingLeft);
  }

  function nearest() {
    let closest = 0;
    slides.forEach((slide, index) => {
      if (Math.abs(position(index) - track.scrollLeft) < Math.abs(position(closest) - track.scrollLeft)) closest = index;
    });
    return closest;
  }

  function update() {
    if (motionFrame !== undefined) return;
    active = nearest();
    render();
  }

  function render() {
    dots.forEach((dot, index) => {
      if (index === active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    previous.disabled = active === 0;
    next.disabled = active === slides.length - 1;
  }

  function go(index) {
    const target = Math.max(0, Math.min(slides.length - 1, index));
    cancelMove();
    active = target;
    render();
    const start = track.scrollLeft;
    const destination = Math.max(0, Math.min(track.scrollWidth - track.clientWidth, position(target)));
    if (reducedMotion.matches || Math.abs(destination - start) < 1) {
      track.scrollTo({ left: destination, behavior: 'instant' });
      update();
      return;
    }
    track.classList.add('is-animating');
    const duration = Math.min(420, 280 + Math.abs(destination - start) * .07);
    let started;
    function animate(now) {
      if (started === undefined) started = now;
      const progress = Math.min(1, (now - started) / duration);
      track.scrollLeft = start + (destination - start) * (1 - Math.pow(1 - progress, 4));
      if (progress < 1) motionFrame = requestAnimationFrame(animate);
      else {
        motionFrame = undefined;
        track.classList.remove('is-animating');
        update();
      }
    }
    motionFrame = requestAnimationFrame(animate);
  }

  function cancelMove() {
    if (motionFrame !== undefined) cancelAnimationFrame(motionFrame);
    motionFrame = undefined;
    track.classList.remove('is-animating');
  }

  function stop() {
    clearInterval(timer);
    timer = undefined;
    play.setAttribute('aria-pressed', 'false');
    play.setAttribute('aria-label', 'Play feature slideshow');
    play.firstElementChild.innerHTML = '&#9654;';
  }

  previous.addEventListener('click', () => { stop(); go(active - 1); });
  next.addEventListener('click', () => { stop(); go(active + 1); });
  dots.forEach((dot, index) => dot.addEventListener('click', () => { stop(); go(index); }));
  play.addEventListener('click', () => {
    if (timer) { stop(); return; }
    play.setAttribute('aria-pressed', 'true');
    play.setAttribute('aria-label', 'Pause feature slideshow');
    play.firstElementChild.innerHTML = '&#10074;&#10074;';
    timer = setInterval(() => go((active + 1) % slides.length), 5500);
  });

  track.addEventListener('scroll', () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = undefined; update(); });
  }, { passive: true });
  track.addEventListener('keydown', event => {
    let target;
    if (event.key === 'ArrowRight') target = active + 1;
    if (event.key === 'ArrowLeft') target = active - 1;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = slides.length - 1;
    if (target !== undefined) { event.preventDefault(); stop(); go(target); }
  });
  track.addEventListener('wheel', () => { stop(); cancelMove(); }, { passive: true });
  track.addEventListener('focusin', stop);
  track.addEventListener('pointerdown', event => {
    stop();
    cancelMove();
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if (event.target.closest('a, button, input')) return;
    drag = { x: event.clientX, left: track.scrollLeft, moved: false };
    track.setPointerCapture(event.pointerId);
  });
  track.addEventListener('pointermove', event => {
    if (!drag) return;
    const distance = event.clientX - drag.x;
    if (Math.abs(distance) > 5) {
      drag.moved = true;
      track.classList.add('is-dragging');
    }
    if (drag.moved) { event.preventDefault(); track.scrollLeft = drag.left - distance; }
  });
  function finishDrag() {
    if (!drag) return;
    const moved = drag.moved;
    drag = undefined;
    track.classList.remove('is-dragging');
    if (moved) go(nearest());
  }
  track.addEventListener('pointerup', finishDrag);
  track.addEventListener('pointercancel', finishDrag);
  track.addEventListener('lostpointercapture', finishDrag);
  track.addEventListener('dragstart', event => event.preventDefault());
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  reducedMotion.addEventListener('change', () => { stop(); go(active); });
  window.addEventListener('resize', () => {
    cancelMove();
    track.scrollTo({ left: position(active), behavior: 'instant' });
    update();
  });
  update();
}
