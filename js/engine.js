/* Механика автомата: общий rAF-цикл, 3D-барабан с физикой остановки, рычаг на пружине. */
(() => {
  const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;

  /* Один requestAnimationFrame на всё; сам засыпает, когда двигать нечего */
  const Loop = (() => {
    const fns = new Set();
    let last = 0, raf = 0;
    function frame(t) {
      const dt = Math.min(0.05, (t - last) / 1000 || 0);
      last = t;
      fns.forEach(f => { if (f(dt) === false) fns.delete(f); });
      raf = fns.size ? requestAnimationFrame(frame) : 0;
    }
    return {
      add(f) { fns.add(f); if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
      remove(f) { fns.delete(f); }
    };
  })();

  /* Барабан: 2×N граней по кругу (rotateX + translateZ), вращаем весь цилиндр.
     Фазы: windup (замах назад) → spin (разгон) → decel (торможение со степенной кривой,
     скорость на входе совпадает с текущей) → [hold — «почти выигрыш»] → spring (отскок). */
  class Reel {
    constructor(el, o) {
      this.el = el;
      this.cell = o.cell;
      this.render = o.render;
      this.onTick = o.onTick || null;
      this.onLand = o.onLand || null;
      this.max = o.max || 1150;
      this.acc = 5600;
      this.reduced = !!o.reduced;
      el.innerHTML = '<div class="drum"></div><div class="reel-streak"></div><div class="reel-shade"></div>';
      this.drum = el.children[0];
      this.streak = el.children[1];
      this.theta = 0; this.omega = 0; this.phase = 'idle'; this.tickIdx = 0; this._s = -1;
      this.step = this.step.bind(this);
      this.setItems(o.items);
    }
    setItems(items) {
      this.items = items;
      const n = items.length * 2;
      this.n = n;
      this.alpha = 360 / n;
      this.r = this.cell / (2 * Math.tan(Math.PI / n));
      this.drum.style.height = this.cell + 'rem';
      this.drum.style.marginTop = (-this.cell / 2) + 'rem';
      let h = '';
      for (let i = 0; i < n; i++) {
        h += `<div class="face" style="height:${this.cell}rem;transform:rotateX(${(i * this.alpha).toFixed(4)}deg) translateZ(${this.r.toFixed(3)}rem)">${this.render(items[i % items.length])}</div>`;
      }
      this.drum.innerHTML = h;
      this.apply();
    }
    setIndex(k) { this.theta = k * this.alpha; this.omega = 0; this.apply(); }
    apply() {
      this.drum.style.transform = `translateZ(${(-this.r).toFixed(3)}rem) rotateX(${(-this.theta).toFixed(3)}deg)`;
      const s = Math.round(Math.min(0.93, Math.max(0, (Math.abs(this.omega) - 240) / 620)) * 50) / 50;
      if (s !== this._s) { this.streak.style.opacity = s; this._s = s; }
      const ti = Math.round(this.theta / this.alpha);
      if (ti !== this.tickIdx) { this.tickIdx = ti; this.onTick && this.onTick(); }
    }
    start() {
      this.req = null;
      this.t = 0; this.theta0 = this.theta; this.omega = 0;
      this.phase = this.reduced ? 'spin' : 'windup';
      Loop.add(this.step);
    }
    stopAt(k, o = {}) {
      return new Promise(res => { this.req = { k, near: !!o.near && !this.reduced, res }; });
    }
    halt() {
      Loop.remove(this.step);
      this.phase = 'idle'; this.omega = 0; this.req = null;
      this.theta = Math.round(this.theta / this.alpha) * this.alpha;
      this.apply();
    }
    plan() {
      const { k, near } = this.req, a = this.alpha, L = this.items.length;
      this.pow = near ? 4 : 3;
      const decelT = this.reduced ? 0.32 : near ? 1.75 : 0.78;
      const minDist = this.omega * decelT / this.pow;
      let j = Math.ceil((this.theta + minDist) / a);
      j += (((k - j) % L) + L) % L;
      this.near = near;
      this.over = near ? a : 0.22 * a;
      this.thF = j * a;
      this.th0 = this.theta;
      this.dist = this.thF + this.over - this.th0;
      this.omega0 = this.omega;
      this.D = this.pow * this.dist / this.omega0;
      this.u = 0;
      this.phase = 'decel';
    }
    land() {
      this.omega = 0;
      this.theta = this.thF + this.over;
      if (this.near) {
        this.phase = 'hold'; this.t = 0;
        this.onLand && this.onLand('near');
      } else {
        this.onLand && this.onLand('stop');
        this.spring(this.over, 520, 0.3);
      }
    }
    spring(x0, k, z) {
      this.x = x0; this.v = 0; this.k = k; this.c = 2 * z * Math.sqrt(k);
      this.phase = 'spring';
    }
    step(dt) {
      switch (this.phase) {
        case 'windup': {
          this.t += dt;
          const p = Math.min(1, this.t / 0.16);
          this.theta = this.theta0 - 0.32 * this.alpha * (1 - (1 - p) * (1 - p));
          if (p >= 1) this.phase = 'spin';
          break;
        }
        case 'spin':
          this.omega = Math.min(this.max, this.omega + this.acc * dt);
          this.theta += this.omega * dt;
          if (this.req && this.omega >= this.max * 0.6) this.plan();
          break;
        case 'decel': {
          this.u += dt / this.D;
          if (this.u >= 1) { this.land(); break; }
          const q = 1 - this.u;
          this.theta = this.th0 + this.dist * (1 - Math.pow(q, this.pow));
          this.omega = this.omega0 * Math.pow(q, this.pow - 1);
          break;
        }
        case 'hold':
          this.t += dt;
          if (this.t >= 0.42) { this.onLand && this.onLand('back'); this.spring(this.alpha, 240, 0.5); }
          break;
        case 'spring': {
          const h = dt / 4;
          for (let i = 0; i < 4; i++) {
            const acc = -this.k * this.x - this.c * this.v;
            this.v += acc * h; this.x += this.v * h;
          }
          this.theta = this.thF + this.x;
          this.omega = this.v * 0.2;
          if (Math.abs(this.x) < 0.12 && Math.abs(this.v) < 4) {
            this.theta = this.thF; this.omega = 0; this.phase = 'idle';
            this.apply();
            const r = this.req; this.req = null;
            r && r.res();
            return false;
          }
          break;
        }
        default:
          return false;
      }
      this.apply();
      return true;
    }
  }

  /* Рычаг: угол φ от 0 (вверх) до ~150° (вниз, к зрителю). Шток — scaleY(cos φ) от оси,
     шар едет вниз и подрастает (приближается к камере). Отпустили — пружина с упором. */
  class Lever {
    constructor(el, o) {
      this.el = el;
      this.L = o.L;
      this.onFire = o.onFire;
      this.onRelease = o.onRelease || null;
      this.rod = el.querySelector('.lever-rod');
      this.knob = el.querySelector('.lever-knob');
      this.phi = 0; this.v = 0; this.state = 'rest'; this.fired = false;
      this.step = this.step.bind(this);
      this.render();
      const grab = e => this.down(e);
      this.knob.addEventListener('pointerdown', grab);
      this.rod.addEventListener('pointerdown', grab);
      this.knob.addEventListener('pointermove', e => this.move(e));
      this.knob.addEventListener('pointerup', e => this.up(e));
      this.knob.addEventListener('pointercancel', e => this.up(e));
    }
    render() {
      const r = this.phi * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
      this.rod.style.transform = `scaleY(${c.toFixed(4)})`;
      this.knob.style.transform = `translateY(${(this.L * (1 - c)).toFixed(3)}rem) scale(${(1 + 0.26 * s).toFixed(4)})`;
    }
    down(e) {
      if (this.state === 'auto') return;
      e.preventDefault();
      this.knob.setPointerCapture(e.pointerId);
      Loop.remove(this.step);
      this.state = 'drag'; this.fired = false;
      this.startY = e.clientY;
      this.y0 = -this.L * Math.cos(this.phi * Math.PI / 180);
      this.moved = 0;
      this.el.classList.add('is-grab');
    }
    move(e) {
      if (this.state !== 'drag') return;
      const dy = (e.clientY - this.startY) / remPx();
      this.moved = Math.max(this.moved, Math.abs(e.clientY - this.startY));
      const y = this.y0 + dy;
      const c = Math.max(-0.866, Math.min(1, -y / this.L));
      this.phi = Math.acos(c) * 180 / Math.PI;
      this.render();
      if (!this.fired && this.phi > 138) { this.fired = true; this.onFire(); }
    }
    up() {
      if (this.state !== 'drag') return;
      this.el.classList.remove('is-grab');
      if (this.moved < 6) { this.state = 'rest'; this.pull(); return; }
      if (!this.fired && this.phi > 95) { this.fired = true; this.onFire(); }
      this.release();
    }
    pull() {
      if (this.state !== 'rest' && this.state !== 'spring') return;
      Loop.remove(this.step);
      this.state = 'auto'; this.t = 0; this.from = this.phi; this.fired = false;
      Loop.add(this.step);
    }
    release() {
      this.state = 'spring'; this.v = 0;
      this.onRelease && this.onRelease();
      Loop.add(this.step);
    }
    step(dt) {
      if (this.state === 'auto') {
        this.t += dt;
        const p = Math.min(1, this.t / 0.26);
        this.phi = this.from + (148 - this.from) * p * p;
        this.render();
        if (p >= 1) {
          if (!this.fired) { this.fired = true; this.onFire(); }
          if (this.t >= 0.34) this.release();
        }
        return true;
      }
      if (this.state === 'spring') {
        const k = 210, c = 2 * 0.46 * Math.sqrt(k), h = dt / 4;
        for (let i = 0; i < 4; i++) {
          this.v += (-k * this.phi - c * this.v) * h;
          this.phi += this.v * h;
          if (this.phi < -16) { this.phi = -16; this.v = -this.v * 0.3; this.onStop && this.onStop(); }
        }
        this.render();
        if (Math.abs(this.phi) < 0.3 && Math.abs(this.v) < 2) {
          this.phi = 0; this.render(); this.state = 'rest';
          return false;
        }
        return true;
      }
      return false;
    }
  }

  window.Engine = { Loop, Reel, Lever, remPx };
})();
