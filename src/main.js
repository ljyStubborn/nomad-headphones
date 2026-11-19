import "./styles.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createScene } from "./scene.js";

gsap.registerPlugin(ScrollTrigger);

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------- loader --- */

const loader = $("#loader");
const loaderBar = $(".loader-bar i");
const loaderNum = $(".loader-num");
let loadPct = 0;
let displayed = 0;
let modelReady = false;

function paintLoader(value) {
  const pct = Math.round(value * 100);
  loaderBar.style.width = `${pct}%`;
  loaderNum.textContent = String(pct).padStart(2, "0");
}

const loaderTimer = window.setInterval(() => {
  const target = modelReady ? 1 : Math.min(0.9, loadPct);
  displayed = Math.min(1, displayed + (target - displayed) * 0.14 + 0.004);
  paintLoader(displayed);
  if (displayed > 0.994 && modelReady) {
    window.clearInterval(loaderTimer);
    paintLoader(1);
    window.setTimeout(() => loader.classList.add("is-done"), 240);
  }
}, 60);

/* ----------------------------------------------------------------- scene --- */

const sectionEls = [".hero", "#anatomy", "#fold", "#finishes", "#buy"].map($);
let centers = [0, 1, 2, 3, 4];
let scene = null;

function showPoster() {
  document.body.classList.add("no-webgl");
  const img = $("#poster");
  if (img && !img.src) img.src = "/poster.png";
}

try {
  scene = createScene({
    canvas: $("#scene"),
    labelHost: $("#labels"),
    reduced,
    onProgress: (event) => {
      if (event && event.total) loadPct = Math.min(0.9, event.loaded / event.total);
    },
  });
} catch (err) {
  console.error("[nomad] webgl 不可用", err);
  showPoster();
}

function measure() {
  const vh = window.innerHeight;
  const next = sectionEls.map((el) => {
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return rect.top + window.scrollY + rect.height / 2 - vh / 2;
  });
  for (let i = 1; i < next.length; i++) next[i] = Math.max(next[i], next[i - 1] + 1);
  centers = next;
}

function filmFromScroll() {
  const y = window.scrollY;
  const last = centers.length - 1;
  if (y <= centers[0]) return 0;
  if (y >= centers[last]) return last;
  let i = 0;
  while (i < last - 1 && y > centers[i + 1]) i++;
  const span = Math.max(1, centers[i + 1] - centers[i]);
  return i + Math.min(1, Math.max(0, (y - centers[i]) / span));
}

async function boot() {
  measure();
  if (!scene) {
    loader.classList.add("is-done");
    return;
  }

  const ok = await scene.init();
  if (!ok) {
    showPoster();
    loader.classList.add("is-done");
    return;
  }

  modelReady = true;
  measure();
  scene.start();

  if (!reduced) {
    ScrollTrigger.create({
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      onUpdate: () => scene.setFilm(filmFromScroll()),
      onRefresh: () => {
        measure();
        scene.setFilm(filmFromScroll());
      },
    });
  }

  window.addEventListener(
    "resize",
    () => {
      measure();
      scene.resize();
      scene.setFilm(filmFromScroll());
    },
    { passive: true },
  );
}

boot();

/* ------------------------------------------------------------- scrim side --- */

const scrim = $(".scrim");
if (!reduced) {
  ScrollTrigger.create({
    trigger: "#fold",
    start: "top 65%",
    end: "bottom 35%",
    onEnter: () => (scrim.dataset.side = "right"),
    onEnterBack: () => (scrim.dataset.side = "right"),
    onLeave: () => (scrim.dataset.side = "left"),
    onLeaveBack: () => (scrim.dataset.side = "left"),
  });
}

/* ---------------------------------------------------------------- reveals --- */

const revealTargets = $$(".hero-copy > *, .chapter-copy > *, .chapter-list, .spec-table, .buy-copy > *");

if (reduced) {
  gsap.set(revealTargets, { opacity: 1, y: 0 });
} else {
  for (const el of revealTargets) {
    gsap.from(el, {
      opacity: 0,
      y: 20,
      duration: 0.9,
      ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  }
}

/* ----------------------------------------------------------------- 配色 --- */

const finishLabel = { graphite: "石墨", bone: "骨白", steel: "钢灰", ember: "焦橙" };
let currentFinish = "graphite";

for (const btn of $$(".swatch")) {
  btn.addEventListener("click", () => {
    const key = btn.dataset.finish;
    if (!key || key === currentFinish) return;
    currentFinish = key;
    for (const b of $$(".swatch")) b.setAttribute("aria-pressed", String(b === btn));
    document.documentElement.dataset.finish = finishLabel[key] ? key : "graphite";
    scene?.setFinish(key);
  });
}

/* ----------------------------------------------------------------- 预约 --- */

const form = $("#reserve");
const email = $("#email");
const note = $("#form-note");

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = (email?.value || "").trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

  note.classList.remove("is-ok", "is-error");

  if (!valid) {
    note.textContent = "请检查邮箱格式。";
    note.classList.add("is-error");
    email?.focus();
    return;
  }

  note.textContent = "已登记。开售当天会通知你。";
  note.classList.add("is-ok");
  form.reset();
});

/* ------------------------------------------------------------------- nav --- */

const nav = $(".nav");
const toggleNav = (active) => nav.classList.toggle("is-scrolled", active);
toggleNav(window.scrollY > 24);
ScrollTrigger.create({
  start: 24,
  end: "max",
  onToggle: (self) => toggleNav(self.isActive),
});

/* 字体加载完成后重新测量，避免章节高度变化导致机位错位 */
if (document.fonts?.ready) {
  document.fonts.ready.then(() => {
    measure();
    ScrollTrigger.refresh();
  });
}
window.addEventListener("load", () => {
  measure();
  ScrollTrigger.refresh();
});
