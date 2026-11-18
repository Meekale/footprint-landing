'use strict';
(() => {
  const canvas = document.querySelector('#demo');
  const demoFeature = new URLSearchParams(location.search).get('feature');
  const find = selector => canvas.querySelector(selector);
  const text = selector => find(selector)?.textContent.trim() || '';
  let pending;
  function snapshot() {
    const state = { feature:demoFeature, ready:!!find('h1') };
    if (!state.ready) return state;
    if (demoFeature === 'games') {
      state.mode = find('#country') ? 'country' : 'boxing';
      state.countries = [...(find('#country')?.options || [])].map(option => ({value:option.value,label:option.text}));
      state.country = find('#country')?.value;
      state.progress = text('#route-percent');
      state.boxingActive = text('#boxing-start') === 'Pause round';
      state.hitReady = state.boxingActive && text('.boxing-status').includes('HIT NOW');
      state.boxingStatus = text('.boxing-status');
      state.hits = text('#boxing-hits'); state.score = text('#boxing-score');
    } else if (demoFeature === 'reps') {
      state.own = text('#own-reps'); state.friend = text('#friend-reps');
      state.feedback = text('#battle-feedback'); state.finished = !!find('#rep-add')?.disabled;
    } else if (demoFeature === 'calories') {
      state.calories = text('#pet-calories'); state.mood = text('#pet-mood');
      state.feedback = text('#pet-dialogue'); state.full = !!find('#pet-feed')?.disabled;
    } else if (demoFeature === 'progress') {
      state.mode = find('.rank-stage') ? 'ranks' : 'badges';
      state.part = find('[data-part].selected')?.dataset.part || 'arms';
      state.rank = text('.rank-info h2'); state.first = !!find('#rank-prev')?.disabled;
      state.last = !!find('#rank-next')?.disabled; state.feedback = text('#badge-detail');
      state.badge = find('[data-badge].active')?.dataset.badge || '0';
    } else if (demoFeature === 'metrics') {
      state.split = Number(find('#comparison-slider')?.value || 50);
      state.feedback = text('#photo-status');
    }
    return state;
  }
  function publish() {
    pending = undefined;
    parent.postMessage({type:'footprint-demo-state',state:snapshot()},location.origin);
  }
  function schedule() { if (pending === undefined) pending = requestAnimationFrame(publish); }
  function click(selector) { const element = find(selector); if (element && !element.disabled) element.click(); }
  function change(selector,value) {
    const element = find(selector); if (!element) return;
    element.value = value;
    element.dispatchEvent(new Event(element.type === 'range' ? 'input' : 'change',{bubbles:true}));
  }
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== location.origin) return;
    if (event.data?.type === 'footprint-demo-request-state') { schedule(); return; }
    if (event.data?.type !== 'footprint-demo-command' || !find('h1')) return;
    const {action,value,file} = event.data;
    if (demoFeature === 'games') {
      if (action === 'game-mode' && ['country','boxing'].includes(value)) click(`[data-game="${value}"]`);
      if (action === 'country' && [...(find('#country')?.options||[])].some(option=>option.value===value)) change('#country',value);
      if (action === 'team-step') click('#team-step');
      if (action === 'route-reset') click('#route-reset');
      if (action === 'boxing-toggle') click('#boxing-start');
      if (action === 'boxing-hit') click('.mitt');
    } else if (demoFeature === 'reps') {
      const commands = {'rep':'#rep-add','friend-rep':'#friend-add','battle-reset':'#battle-reset'};
      if (commands[action]) click(commands[action]);
    } else if (demoFeature === 'calories') {
      const commands = {'meal':'#pet-feed','pet':'.pet-head','pet-reset':'#pet-reset'};
      if (commands[action]) click(commands[action]);
    } else if (demoFeature === 'progress') {
      if (action === 'progress-mode' && ['ranks','badges'].includes(value)) {
        click(`[data-rank-tab="${value}"]`);
        if (value === 'badges') click('[data-badge="0"]');
      }
      if (action === 'part' && ['arms','chest','shoulders','back','core','legs'].includes(value)) click(`[data-part="${value}"]`);
      if (action === 'next-rank') click('#rank-next');
      if (action === 'previous-rank') click('#rank-prev');
      if (action === 'badge' && /^[0-5]$/.test(String(value))) click(`[data-badge="${value}"]`);
    } else if (demoFeature === 'metrics') {
      if (action === 'split' && Number.isFinite(Number(value))) change('#comparison-slider',Math.max(0,Math.min(100,Number(value))));
      if (action === 'photo-reset') click('#photo-reset');
      if (action === 'photo-file' && ['a','b'].includes(value) && file instanceof File && file.type.startsWith('image/') && file.size <= 10*1024*1024) {
        const transfer = new DataTransfer(); transfer.items.add(file);
        find('#photo-'+value).files = transfer.files;
        find('#photo-'+value).dispatchEvent(new Event('change',{bubbles:true}));
      }
    }
    schedule();
  });
  new MutationObserver(schedule).observe(canvas,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','aria-pressed','class']});
  canvas.addEventListener('input',schedule);
  canvas.addEventListener('change',schedule);
  canvas.addEventListener('click',schedule);
  schedule();
})();
