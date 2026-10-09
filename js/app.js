/* Отмазино: экраны, оплата, прокрут, билет, мессенджер, режиссёрские клавиши. */
(() => {
  const D = window.OTM_DATA, S = window.Sound, { Reel, Lever } = window.Engine;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const html = document.documentElement;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const st = {
    screen: null, run: 0,
    tokens: 0, unlimited: false,
    pack: 5, paying: false,
    sit: 'late', spinning: false, spins: 0, last: [-1, -1, -1],
    excuse: null, ticketNo: 4216, ticketOut: false, sends: 0
  };

  /* таймеры текущего экрана: при смене экрана все сбрасываются */
  let timers = [];
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const clearLater = () => { timers.forEach(clearTimeout); timers = []; };

  /* ---------- жетоны ---------- */
  const navTok = $('#navTok'), led = $('#led'), ledBox = $('#ledBox');
  function renderTokens(bump) {
    navTok.textContent = st.unlimited ? '∞' : st.tokens;
    led.textContent = st.unlimited ? '∞' : String(st.tokens).padStart(2, '0');
    if (bump) restart(navTok, 'bump');
  }
  const hasTokens = () => st.unlimited || st.tokens > 0;

  /* ---------- лампочки по периметру ---------- */
  function buildBulbs() {
    const rem = window.Engine.remPx();
    $$('[data-bulbs]').forEach(box => {
      const sp = parseFloat(box.dataset.bulbs) * rem, w = box.offsetWidth, h = box.offsetHeight;
      if (!w) return;
      const nx = Math.max(2, Math.round(w / sp)), ny = Math.max(2, Math.round(h / sp)), pts = [];
      for (let i = 0; i < nx; i++) pts.push([i / nx, 0]);
      for (let i = 0; i < ny; i++) pts.push([1, i / ny]);
      for (let i = 0; i < nx; i++) pts.push([1 - i / nx, 1]);
      for (let i = 0; i < ny; i++) pts.push([0, 1 - i / ny]);
      box.innerHTML = pts.map(([x, y], i) =>
        `<i class="bulb" style="left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%;--ph:${(-((3 - i % 3) % 3) / 3).toFixed(3)}"></i>`).join('');
    });
  }

  /* ================= навигация между экранами ================= */
  const screens = Object.fromEntries($$('.screen').map(s => [s.dataset.screen, s]));
  const enter = {}, leave = {};
  function go(name) {
    clearLater();
    st.run++;
    const prevName = st.screen, prev = screens[prevName];
    if (prev && prevName !== name) {
      leave[prevName] && leave[prevName]();
      prev.classList.remove('is-on');
      prev.classList.add('is-leaving');
      setTimeout(() => prev.classList.remove('is-leaving'), 800);
    } else if (prev) {
      leave[prevName] && leave[prevName]();
    }
    st.screen = name;
    html.dataset.screen = name;
    screens[name].classList.add('is-on');
    enter[name] && enter[name]();
  }
  /* долгое нажатие на логотип = клавиша R (режиссёрский сброс без клавиатуры, для телефона) */
  let pressTimer = 0, longPressed = false;
  const navLogo = $('.nav-logo');
  navLogo.addEventListener('pointerdown', () => {
    longPressed = false;
    pressTimer = setTimeout(() => { longPressed = true; resetAll(); S.play('clack'); go('home'); }, 800);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => navLogo.addEventListener(ev, () => clearTimeout(pressTimer)));
  navLogo.addEventListener('contextmenu', e => e.preventDefault());
  $$('[data-go]').forEach(b => b.addEventListener('click', () => {
    if (b === navLogo && longPressed) { longPressed = false; return; }
    S.play('pop'); go(b.dataset.go);
  }));

  /* ================= 1. ГЛАВНАЯ ================= */
  $('#winFeed').innerHTML = (() => {
    const h = D.wins.map(([who, combo, res, ago]) =>
      `<li class="win"><span class="win-who">${who}</span><span class="win-ago">${ago} назад</span><span class="win-combo emo">${combo}</span><span class="win-res">${res}</span></li>`).join('');
    return h + h;
  })();
  $('#mTicker').innerHTML = (() => {
    const h = D.wins.map(([who, combo, res]) => `<span class="m-item"><span class="emo">${combo}</span>${who}<b>${res}</b></span>`).join('');
    return h + h;
  })();
  $('#odds').innerHTML = D.odds.map(([e, label, p], i) =>
    `<li><div class="odd-top"><span class="emo">${e}</span>${label}<b>${p}%</b></div><div class="odd-bar"><i style="--p:${p / 34};--i:${i}"></i></div></li>`).join('');

  const mini = $$('.mini .reel').map((el, i) => {
    const r = new Reel(el, { items: D.mini[i], cell: 9, max: 900, reduced: RM, render: e => `<span class="emo">${e}</span>` });
    r.setIndex(i * 2);
    return r;
  });
  let miniTimer = 0, wonTimer = 0, won = 312;
  function miniCycle() {
    mini.forEach((r, i) => later(() => r.start(), i * 70));
    mini.forEach((r, i) => later(() => r.stopAt(rnd(7)), 650 + i * 320));
  }
  function wonTick() {
    wonTimer = setTimeout(() => {
      won += 1 + rnd(2);
      const b = $('#wonCount'); b.textContent = won; restart(b, 'bump');
      wonTick();
    }, 2400 + rnd(2600));
  }
  enter.home = () => {
    later(miniCycle, 900);
    miniTimer = setInterval(miniCycle, 3400);
    wonTick();
  };
  leave.home = () => { clearInterval(miniTimer); clearTimeout(wonTimer); mini.forEach(r => r.halt()); };
  const ctaPull = $('#ctaPull');
  ctaPull.addEventListener('click', () => { S.play('clack'); go(hasTokens() ? 'game' : 'pay'); });

  /* ================= 2. ОПЛАТА ================= */
  const payBtn = $('#payBtn'), packs = $$('.pack');
  const card = { num: $('#cardNum'), name: $('#cardName'), exp: $('#cardExp'), cvc: $('#cardCvc') };
  const CARD = [['num', '4242 4242 4242 4242', 55], ['name', 'ОПОЗДАЛОВ И. И.', 38], ['exp', '12/29', 60], ['cvc', '•••', 90]];
  const ODO = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '∞', ' '];
  $('#odo').innerHTML = '<div class="odo-w"><div class="odo-s"></div></div><div class="odo-w"><div class="odo-s"></div></div>';
  const odoStrips = $$('#odo .odo-s');
  odoStrips.forEach(s => { s.innerHTML = ODO.map(c => `<i>${c}</i>`).join(''); });
  function setOdo(v) {
    const idx = v === '∞' ? [11, 10] : [Math.floor(v / 10) % 10, v % 10];
    odoStrips.forEach((s, i) => { s.style.transform = `translateY(${-idx[i] * 3.6}rem)`; });
  }
  function selectPack(n) {
    st.pack = n;
    packs.forEach(p => p.classList.toggle('is-sel', +p.dataset.n === n));
    if (!st.paying) payBtn.textContent = `Оплатить ${packs.find(p => +p.dataset.n === n).dataset.price} ₽`;
  }
  packs.forEach(p => p.addEventListener('click', () => { if (st.paying) return; S.play('pop'); selectPack(+p.dataset.n); }));

  function typeCard() {
    let t = 450;
    CARD.forEach(([k, txt, sp]) => {
      const el = card[k];
      later(() => el.classList.add('typing'), t);
      [...txt].forEach((ch, i) => later(() => { el.textContent += ch; if (ch !== ' ') S.play('type'); }, t + i * sp));
      t += txt.length * sp + 140;
      later(() => el.classList.remove('typing'), t - 40);
    });
  }
  function fillCard() { CARD.forEach(([k, txt]) => { card[k].textContent = txt; card[k].classList.remove('typing'); }); }

  enter.pay = () => {
    st.paying = false;
    payBtn.className = 'cta pay-btn';
    selectPack(st.pack);
    Object.values(card).forEach(el => { el.textContent = ''; el.classList.remove('typing'); });
    $('#coinDrop').innerHTML = '';
    setOdo(st.unlimited ? '∞' : Math.min(st.tokens, 99));
    typeCard();
  };

  function coinHTML(layers) {
    let h = '<i class="cf" style="transform:translateZ(.14em)">₽</i>';
    for (let i = 0; i < layers; i++) {
      const z = layers === 1 ? 0 : -0.12 + (0.24 * i) / (layers - 1);
      h += `<i class="ce" style="transform:translateZ(${z.toFixed(3)}em);background:${i % 2 ? '#9a6a1c' : '#b5801f'}"></i>`;
    }
    return h + '<i class="cf" style="transform:rotateY(180deg) translateZ(.14em)">₽</i>';
  }

  /* монета вылетает из выбранного пакета, по дуге летит к щели, вращаясь, и уходит внутрь.
     x и y — на разных слоях, чтобы траектория была параболой, а не прямой. */
  function dropCoin(delay) {
    const zone = $('#coinDrop'), rem = window.Engine.remPx();
    const w = document.createElement('div');
    w.className = 'pcoin';
    w.innerHTML = `<div class="py"><div class="coin">${coinHTML(5)}</div></div>`;
    zone.appendChild(w);
    const py = w.firstChild, coin = py.firstChild;
    const zr = zone.getBoundingClientRect(), pr = (packs.find(p => p.classList.contains('is-sel')) || packs[1]).getBoundingClientRect();
    const half = 3.5 * rem;
    const x0 = pr.left + pr.width / 2 - (zr.left + zr.width / 2) + (Math.random() * 2 - 1) * rem;
    const y0 = pr.top + pr.height * 0.55 - zr.top - half;
    const yEnd = zr.height - half, yApex = Math.min(y0, yEnd) - 7 * rem;
    const dur = RM ? 400 : 1150;
    w.style.opacity = 0;
    w.animate([
      { transform: `translateX(${x0}px)`, opacity: 0, easing: 'cubic-bezier(.25,.1,.45,1)' },
      { opacity: 1, offset: 0.1 },
      { transform: 'translateX(0)', opacity: 1, offset: 0.8 },
      { transform: 'translateX(0)', opacity: 1 }
    ], { duration: dur, delay, fill: 'forwards' });
    py.animate([
      { transform: `translateY(${y0}px) scale(.55)`, easing: 'cubic-bezier(.33,1,.68,1)' },
      { transform: `translateY(${yApex}px) scale(1)`, offset: 0.34, easing: 'cubic-bezier(.45,0,.85,.4)' },
      { transform: `translateY(${yEnd}px) scale(1)`, offset: 0.8, easing: 'cubic-bezier(.5,0,1,1)' },
      { transform: `translateY(${yEnd + 4.1 * rem}px) scale(1)` }
    ], { duration: dur, delay, fill: 'forwards' });
    coin.animate([
      { transform: 'perspective(40rem) rotateX(22deg) rotateY(0deg)', easing: 'cubic-bezier(.3,.6,.4,1)' },
      { transform: 'perspective(40rem) rotateX(4deg) rotateY(1080deg)', offset: 0.8 },
      { transform: 'perspective(40rem) rotateX(0deg) rotateY(1080deg)' }
    ], { duration: dur, delay, fill: 'forwards' });
    setTimeout(() => w.remove(), delay + dur + 100);
    return sleep(delay + dur * 0.86);
  }

  async function pay() {
    if (st.paying || st.screen !== 'pay') return;
    st.paying = true;
    const run = st.run;
    clearLater(); fillCard();
    S.play('pop');
    payBtn.classList.add('press');
    await sleep(140);
    payBtn.classList.remove('press');
    payBtn.classList.add('busy');
    payBtn.innerHTML = '<i class="spinner"></i>Проверяем карту…';
    await sleep(RM ? 300 : 950); if (run !== st.run) return;
    payBtn.classList.add('ok');
    payBtn.textContent = 'Оплачено';
    S.play('chaching');
    const n = st.pack === 99 ? 6 : st.pack, gap = RM ? 120 : 280;
    if (st.unlimited) st.tokens = 0;
    for (let i = 0; i < n; i++) {
      dropCoin(200 + i * gap).then(() => {
        if (run !== st.run) return;
        st.tokens++;
        setOdo(Math.min(st.tokens, 99));
        renderTokens(true);
        S.play('coin', { pitch: 1 + i * 0.03 });
      });
    }
    await sleep(200 + (n - 1) * gap + (RM ? 500 : 1100)); if (run !== st.run) return;
    if (st.pack === 99) { st.unlimited = true; setOdo('∞'); renderTokens(true); S.play('chaching'); }
    payBtn.textContent = 'Жетоны зачислены';
    await sleep(1100); if (run !== st.run) return;
    go('game');
  }
  payBtn.addEventListener('click', pay);

  /* ================= 3. ГЕНЕРАТОР ================= */
  const sitsEl = $('#sits'), hint = $('#hint'), actions = $('#actions'), topper = $('#topper');
  const ticket = $('#ticket'), leverHint = $('#leverHint');
  sitsEl.innerHTML = Object.entries(D.sits).map(([k, s]) =>
    `<button class="sit${k === st.sit ? ' is-on' : ''}" data-sit="${k}" role="tab">${s.label}</button>`).join('');
  $('#paytable').innerHTML = D.paytable.map(([c, t, top]) => `<li${top ? ' class="top"' : ''}><span class="c emo">${c}</span><b>${t}</b></li>`).join('');

  const sitItems = k => { const s = D.sits[k]; return [s.who, s.what, s.out]; };
  const renderCell = it => `<span class="emo">${it.e}</span><span class="lbl">${it.l}</span>`;
  const onTick = () => S.play('tick');
  const reels = $$('#window .reel').map((el, i) => {
    const r = new Reel(el, {
      items: sitItems(st.sit)[i], cell: 8.4, reduced: RM, render: renderCell, onTick,
      onLand: kind => {
        if (kind === 'near') { S.play('thunk', { soft: true }); hint.textContent = 'Почти!'; }
        else if (kind === 'back') S.play('clack');
        else S.play('thunk');
      }
    });
    r.setIndex(rnd(7));
    return r;
  });

  const lever = new Lever($('#lever'), { L: 13, onFire: () => { S.play('clack'); spin(); }, onRelease: () => S.play('boing') });
  let lastTock = 0;
  lever.onStop = () => { const now = performance.now(); if (now - lastTock > 200) { lastTock = now; S.play('tock'); } };
  $('#spinBtn').addEventListener('click', () => lever.pull());
  $('#againBtn').addEventListener('click', () => lever.pull());
  $('#sendBtn').addEventListener('click', () => { if (!st.excuse) return; S.play('whoosh'); go('chat'); });

  sitsEl.addEventListener('click', e => {
    const b = e.target.closest('.sit');
    if (!b || st.spinning || b.dataset.sit === st.sit) return;
    st.sit = b.dataset.sit; st.last = [-1, -1, -1];
    $$('.sit', sitsEl).forEach(x => x.classList.toggle('is-on', x === b));
    S.play('pop');
    const items = sitItems(st.sit);
    reels.forEach((r, i) => {
      later(() => r.start(), i * 60);
      later(() => r.setItems(items[i]), 230 + i * 60);
      later(() => r.stopAt(rnd(7)), 420 + i * 150);
    });
    hint.textContent = 'Тяните рычаг';
  });

  function form(str, g) { return str.replace(/\{([^}]+)\}/g, (_, alts) => alts.split('|')[g]); }
  function buildExcuse(sitKey, res) {
    const s = D.sits[sitKey], who = s.who[res[0]], what = s.what[res[1]], out = s.out[res[2]];
    const op = pick(s.open);
    const lower = !/[.!?]$/.test(op);
    const w = lower ? who.s : who.s[0].toUpperCase() + who.s.slice(1);
    return {
      sit: sitKey,
      text: `${op} ${w} ${form(what.t, who.g)}. ${out.t}`,
      combo: [who.e, what.e, out.e],
      who: who.l.toLowerCase()
    };
  }
  function randomExcuse(sitKey) { return buildExcuse(sitKey, [rnd(7), rnd(7), rnd(7)]); }

  function noTokens() {
    S.play('buzz');
    restart(ledBox, 'blink');
    hint.textContent = 'Жетоны кончились';
    later(() => go('pay'), 1300);
  }

  function tearTicket() {
    if (!st.ticketOut) return;
    st.ticketOut = false;
    ticket.getAnimations().forEach(a => a.cancel());
    ticket.style.transform = 'translateY(-101%)';
    ticket.animate([
      { transform: 'translateY(0)', opacity: 1 },
      { transform: 'translateY(16%) rotate(2.5deg)', opacity: 0 }
    ], { duration: 280, easing: 'cubic-bezier(.23,1,.32,1)' });
  }
  function printTicket(ex) {
    st.ticketNo++;
    $('#tSit').textContent = D.sits[ex.sit].label;
    $('#tNo').textContent = '№ ' + String(st.ticketNo).padStart(6, '0');
    $('#tCombo').innerHTML = `<span class="emo">${ex.combo.join(' ')}</span>`;
    $('#tText').textContent = ex.text;
    $('#tProb').textContent = (91 + rnd(9)) + '%';
    $('#tValid').textContent = 'Действует до ' + pick(['18:00', 'пятницы', 'конца недели', 'обеда']);
    ticket.getAnimations().forEach(a => a.cancel());
    ticket.parentNode.style.height = (ticket.offsetHeight / window.Engine.remPx() + 0.2).toFixed(2) + 'rem';
    st.ticketOut = true;
    if (RM) { ticket.style.transform = 'translateY(0)'; return; }
    const E = 'cubic-bezier(.23,1,.32,1)';
    const a = ticket.animate([
      { transform: 'translateY(-101%)', easing: E },
      { transform: 'translateY(-76%)', offset: 0.16 },
      { transform: 'translateY(-76%)', offset: 0.24, easing: E },
      { transform: 'translateY(-50%)', offset: 0.4 },
      { transform: 'translateY(-50%)', offset: 0.48, easing: E },
      { transform: 'translateY(-24%)', offset: 0.64 },
      { transform: 'translateY(-24%)', offset: 0.72, easing: E },
      { transform: 'translateY(1.5%)', offset: 0.9, easing: 'ease-in-out' },
      { transform: 'translateY(0)' }
    ], { duration: 1500, fill: 'forwards' });
    a.onfinish = () => { ticket.style.transform = 'translateY(0)'; a.cancel(); };
    [0, 360, 720, 1080].forEach(t => later(() => S.play('print'), t));
  }

  function addHistory(ex) {
    const list = $('#hist');
    $('.hist-empty', list)?.remove();
    const li = document.createElement('li');
    li.className = 'new';
    li.innerHTML = `<div class="h-top"><span>${D.sits[ex.sit].label}</span><span>№ ${String(st.ticketNo).padStart(6, '0')}</span></div>
      <div class="h-combo emo">${ex.combo.join(' ')}</div><p>${esc(ex.text)}</p>`;
    list.prepend(li);
    while (list.children.length > 4) list.lastElementChild.remove();
  }

  /* дождь из монет: фонтан из топпера автомата, дальше гравитация */
  function coinRain() {
    const rain = $('#rain'), tr = topper.getBoundingClientRect();
    const ox = tr.left + tr.width / 2, oy = tr.top + tr.height / 2, vh = innerHeight, vw = innerWidth;
    const N = 36, BATCH = 12;
    /* создаём пачками по кадрам, чтобы не было одного тяжёлого кадра на старте */
    const batch = from => {
      for (let i = from; i < Math.min(N, from + BATCH); i++) spawn(i);
      if (from + BATCH < N) requestAnimationFrame(() => batch(from + BATCH));
    };
    batch(0);
    function spawn() {
      const w = document.createElement('div');
      w.className = 'rc';
      w.style.left = ox + 'px'; w.style.top = oy + 'px';
      w.innerHTML = `<div class="ry"><div class="coin">${coinHTML(1)}</div></div>`;
      rain.appendChild(w);
      const y = w.firstChild, c = y.firstChild;
      const delay = Math.random() * 380, T = 1500 + Math.random() * 900;
      const dx = (Math.random() * 2 - 1) * vw * 0.42, up = vh * (0.12 + Math.random() * 0.26), fall = vh - oy + 80;
      const sc = 0.7 + Math.random() * 0.6, spinN = 2 + rnd(4), tilt = 10 + rnd(50);
      w.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], { duration: T, delay, easing: 'cubic-bezier(.2,.6,.5,1)', fill: 'both' });
      y.animate([
        { transform: `translateY(0) scale(${sc * 0.6})`, opacity: 0, easing: 'cubic-bezier(.33,1,.68,1)' },
        { transform: `translateY(${-up}px) scale(${sc})`, opacity: 1, offset: 0.3, easing: 'cubic-bezier(.32,0,.67,0)' },
        { transform: `translateY(${fall}px) scale(${sc})`, opacity: 1 }
      ], { duration: T, delay, fill: 'both' });
      const a = c.animate([
        { transform: `perspective(30rem) rotateX(${tilt}deg) rotateY(0deg)` },
        { transform: `perspective(30rem) rotateX(${tilt}deg) rotateY(${spinN * 360}deg)` }
      ], { duration: T, delay, fill: 'both' });
      a.onfinish = () => w.remove();
    }
  }

  function burst() {
    const b = $('#burst'), wr = $('#window').getBoundingClientRect();
    b.style.top = (wr.top + wr.height / 2) + 'px';
    b.style.left = (wr.left + wr.width / 2) + 'px';
    if (RM) {
      b.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1400 });
      return;
    }
    b.animate([
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.55) rotate(-5deg)', easing: 'cubic-bezier(.23,1,.32,1)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.08) rotate(2deg)', offset: 0.16, easing: 'ease-in-out' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', offset: 0.28 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.03) rotate(0deg)', offset: 0.78, easing: 'cubic-bezier(.23,1,.32,1)' },
      { opacity: 0, transform: 'translate(-50%,-62%) scale(1.1) rotate(0deg)' }
    ], { duration: 1800 });
  }

  function jackpot() {
    topper.classList.add('jack');
    html.classList.add('flash');
    later(() => { topper.classList.remove('jack'); html.classList.remove('flash'); }, 3200);
    S.play('fanfare');
    burst();
    if (RM) return;
    restart($('#shaker'), 'shake');
    coinRain();
    for (let i = 0; i < 12; i++) later(() => S.play('coin', { pitch: 0.9 + Math.random() * 0.3, vol: 0.6 }), 260 + i * 95 + rnd(50));
  }

  async function spin() {
    if (st.spinning || st.screen !== 'game') return;
    if (!hasTokens()) { noTokens(); return; }
    st.spinning = true;
    const run = st.run;
    if (!st.unlimited) { st.tokens--; renderTokens(true); }
    leverHint.classList.add('gone');
    sitsEl.classList.add('locked');
    actions.classList.remove('is-in');
    hint.textContent = 'Крутим…';
    tearTicket();
    html.classList.add('fast');

    const lists = sitItems(st.sit);
    const res = lists.map((arr, i) => { let k; do { k = rnd(arr.length); } while (k === st.last[i]); return k; });
    st.last = res;
    const near = !RM && (st.spins === 0 || Math.random() < 0.45);

    reels.forEach((r, i) => later(() => r.start(), i * 90));
    const T = RM ? [380, 160, 160] : [1150, 520, 560];
    await sleep(T[0]); if (run !== st.run) return;
    const p0 = reels[0].stopAt(res[0]);
    await sleep(T[1]); if (run !== st.run) return;
    const p1 = reels[1].stopAt(res[1]);
    await sleep(T[2]); if (run !== st.run) return;
    if (near) hint.textContent = 'Ещё чуть-чуть…';
    const p2 = reels[2].stopAt(res[2], { near });
    await Promise.all([p0, p1, p2]); if (run !== st.run) return;

    html.classList.remove('fast');
    st.spins++;
    st.excuse = buildExcuse(st.sit, res);
    hint.textContent = 'Выигрыш!';
    jackpot();
    await sleep(RM ? 300 : 950); if (run !== st.run) return;
    printTicket(st.excuse);
    addHistory(st.excuse);
    await sleep(RM ? 300 : 1500); if (run !== st.run) return;
    actions.classList.add('is-in');
    sitsEl.classList.remove('locked');
    hint.textContent = hasTokens() ? 'Ещё разок?' : 'Жетоны кончились';
    st.spinning = false;
  }

  enter.game = () => {
    if (!hasTokens() && !st.excuse) { st.tokens = 5; }
    renderTokens();
    if (!st.spinning) hint.textContent = st.ticketOut ? 'Ещё разок?' : 'Тяните рычаг';
  };
  leave.game = () => {
    if (st.spinning) {
      reels.forEach(r => r.halt());
      st.spinning = false;
      sitsEl.classList.remove('locked');
      if (st.excuse && st.ticketOut) actions.classList.add('is-in');
    }
    html.classList.remove('fast', 'flash');
    topper.classList.remove('jack');
  };

  /* ================= 4. МЕССЕНДЖЕР ================= */
  const chatBody = $('#chatBody'), field = $('#chatField'), bossStatus = $('#bossStatus'), chatSend = $('#chatSend'), chatSide = $('#chatSide');
  const addMin = (time, m) => { const [h, mm] = time.split(':').map(Number); const t = h * 60 + mm + m; return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  function setStatus(txt, typing) { bossStatus.textContent = txt; bossStatus.classList.toggle('is-typing', !!typing); bossStatus.classList.toggle('dots', !!typing); }

  /* Исход отправки: первая отправка всегда прокатывает, вторая всегда нет, дальше честная монетка 50/50. Счёт сбрасывается клавишей R */
  const verdict = $('#verdict');
  const fillWho = (str, who) => str.replace(/\{Who\}/g, who[0].toUpperCase() + who.slice(1)).replace(/\{who\}/g, who);
  function bossMsg(text, time) {
    const m = document.createElement('div');
    m.className = 'msg in enter';
    m.innerHTML = `${esc(text)}<span class="meta">${time}</span>`;
    chatBody.appendChild(m);
  }
  function typingOn() {
    setStatus('печатает', true);
    if ($('.typing-b', chatBody)) return;
    const ty = document.createElement('div');
    ty.className = 'typing-b'; ty.innerHTML = '<i></i><i></i><i></i>';
    chatBody.appendChild(ty);
  }
  function typingOff() { $('.typing-b', chatBody)?.remove(); setStatus('в сети'); }

  enter.chat = () => {
    if (!st.excuse) st.excuse = randomExcuse(st.sit);
    const ex = st.excuse, b = D.boss[ex.sit], myTime = addMin(b.time, 3), replyTime = addMin(myTime, 1);
    const ok = st.sends === 0 ? true : st.sends === 1 ? false : Math.random() < 0.5;
    st.sends++;
    const reply = pick(ok ? b.ok : b.fail).map(r => fillWho(r, ex.who || 'кот'));
    chatSide.classList.remove('is-in');
    verdict.className = 'verdict';
    setStatus('был недавно');
    field.textContent = '';
    chatBody.innerHTML = `<div class="day">Сегодня</div><div class="msg in">${b.msg}<span class="meta">${b.time}</span></div>`;

    const text = ex.text, step = 3, sp = 16;
    let t = 900;
    for (let i = 0; i < text.length; i += step) {
      later(() => { field.textContent = text.slice(0, i + step); if (i % 12 === 0) S.play('type'); }, t + (i / step) * sp);
    }
    t += Math.ceil(text.length / step) * sp + 450;
    later(() => chatSend.classList.add('press'), t);
    later(() => {
      chatSend.classList.remove('press');
      field.textContent = '';
      S.play('whoosh');
      const m = document.createElement('div');
      m.className = 'msg out enter';
      m.innerHTML = `${esc(text)}<span class="meta">${myTime} <i class="chk">✓</i></span>`;
      chatBody.appendChild(m);
    }, t + 120);
    t += 1200;
    later(() => { const c = $('.msg.out .chk', chatBody); if (c) { c.textContent = '✓✓'; c.classList.add('read'); } setStatus('в сети'); }, t);
    t += 800;

    /* при провале шеф начинает печатать, замолкает и печатает снова */
    if (!ok) {
      later(typingOn, t); t += 1300;
      later(typingOff, t); t += 900;
    }
    reply.forEach((msg, i) => {
      later(typingOn, t);
      t += Math.min(2600, 900 + msg.length * 32) + (i ? 0 : 400);
      later(() => { typingOff(); bossMsg(msg, replyTime); S.play(i ? 'pop' : 'ding'); }, t);
      t += 700;
    });

    t += 300;
    later(() => {
      const mine = $('.msg.out', chatBody);
      if (mine) { const r = document.createElement('span'); r.className = 'react emo'; r.textContent = ok ? '👍' : '🤡'; mine.appendChild(r); }
      verdict.innerHTML = ok ? 'ПРОКАТИЛО!' : 'НЕ<br>ПРОКАТИЛО';
      verdict.className = 'verdict ' + (ok ? 'ok' : 'fail') + ' in';
      S.play(ok ? 'win' : 'fail');
    }, t);
    later(() => chatSide.classList.add('is-in'), t + 900);
  };
  $('#chatAgain').addEventListener('click', () => { S.play('pop'); go('game'); });

  /* ================= звук, клавиши, сброс ================= */
  const snd = $('#snd'), mus = $('#mus');
  const syncSnd = () => {
    snd.setAttribute('aria-pressed', S.on ? 'true' : 'false');
    mus.setAttribute('aria-pressed', S.on && S.music ? 'true' : 'false');
  };
  snd.addEventListener('click', () => { S.toggle(); syncSnd(); });
  const toggleMusic = () => { if (!S.on) { S.toggle(); if (!S.music) S.toggleMusic(); } else S.toggleMusic(); };
  mus.addEventListener('click', () => { toggleMusic(); syncSnd(); });
  syncSnd();
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, () => S.unlock(), { passive: true }));

  function resetAll() {
    st.tokens = 0; st.unlimited = false; st.pack = 5; st.spins = 0; st.excuse = null; st.last = [-1, -1, -1];
    st.ticketOut = false; st.spinning = false; st.ticketNo = 4216; st.sends = 0;
    reels.forEach(r => r.halt());
    ticket.getAnimations().forEach(a => a.cancel());
    ticket.style.transform = 'translateY(-101%)';
    actions.classList.remove('is-in');
    leverHint.classList.remove('gone');
    sitsEl.classList.remove('locked');
    $('#hist').innerHTML = '<li class="hist-empty">Пока пусто. Тяните рычаг, и&nbsp;первая отмазка появится здесь.</li>';
    $('#rain').innerHTML = '';
    if (st.sit !== 'late') {
      st.sit = 'late';
      $$('.sit', sitsEl).forEach(x => x.classList.toggle('is-on', x.dataset.sit === 'late'));
      reels.forEach((r, i) => r.setItems(sitItems('late')[i]));
    }
    reels.forEach(r => r.setIndex(rnd(7)));
    won = 312; $('#wonCount').textContent = won;
    renderTokens();
  }

  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.code) {
      case 'KeyR': resetAll(); go('home'); break;
      case 'Digit1': case 'Numpad1': go('home'); break;
      case 'Digit2': case 'Numpad2': go('pay'); break;
      case 'Digit3': case 'Numpad3': go('game'); break;
      case 'Digit4': case 'Numpad4': go('chat'); break;
      case 'KeyM': S.toggle(); syncSnd(); break;
      case 'KeyB': toggleMusic(); syncSnd(); break;
      case 'Space': case 'Enter':
        if (e.target.closest && e.target.closest('button') && e.code === 'Enter') return;
        e.preventDefault();
        if (e.repeat) return;
        if (st.screen === 'game') lever.pull();
        else if (st.screen === 'pay') pay();
        else if (st.screen === 'home') ctaPull.click();
        break;
      default: return;
    }
  });

  /* старт */
  renderTokens();
  setOdo(0);
  go('home');
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  fontsReady.then(buildBulbs);
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(buildBulbs, 150); });
})();
