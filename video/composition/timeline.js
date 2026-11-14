/* global gsap */
// Línea de tiempo del video. Todo se anima sobre una sola timeline de GSAP en pausa;
// el render la posiciona cuadro a cuadro con window.__seek(segundos).

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
const num = (v) => Math.round(v).toLocaleString("es-AR");

/** Parte un texto en palabras animables. */
function words(el, text) {
  el.textContent = "";
  const parts = String(text).split(" ");
  return parts.map((word, i) => {
    const s = document.createElement("span");
    s.className = "w";
    s.textContent = word + (i < parts.length - 1 ? " " : "");
    el.appendChild(s);
    return s;
  });
}

/** Dos líneas: la primera en blanco, la segunda en gris (como en el sitio). */
function lines(el, list) {
  el.textContent = "";
  return list.flatMap((text, i) => {
    const line = document.createElement("span");
    line.className = "line" + (i > 0 ? " mute" : "");
    el.appendChild(line);
    return words(line, text);
  });
}

async function build() {
  const [guion, meta] = await Promise.all([
    fetch("../guion.json").then((r) => r.json()),
    fetch("../captures/meta.json").then((r) => r.json()),
  ]);
  const T = guion.tiempos;
  const END = guion.duracion;
  const K = 672 / meta.phone.width; // píxeles de pantalla del celular por píxel de la captura
  const VIEW = 1358 / K; // alto visible de la página dentro del celular, en píxeles de la captura

  // ── Textos ────────────────────────────────────────────────────────
  $$("[data-t]").forEach((el) => (el.textContent = get(guion, el.dataset.t) ?? ""));
  const W = new Map();
  $$("[data-lines]").forEach((el) => W.set(el, lines(el, get(guion, el.dataset.lines))));
  $$("[data-words]").forEach((el) => W.set(el, words(el, get(guion, el.dataset.words))));

  const pains = guion.problema.tachados.map((text) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${text}<i class="strike"></i></span>`;
    $("[data-pains]").appendChild(li);
    return li;
  });

  const payCards = guion.cobro.tarjetas.map((c, i) => {
    const d = document.createElement("div");
    d.className = "pay" + (i === 0 ? " first" : "");
    d.innerHTML = `<p class="zone">${c.zona}</p><p class="name">${c.medio}</p>
      <div class="bottom"><p class="detail">${c.detalle}</p><p class="price">${c.precio}<small>${c.moneda}</small></p></div>`;
    $("[data-pay]").appendChild(d);
    return d;
  });

  const benefits = guion.beneficios.map((text, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="rule"></span><i>0${i + 1}</i><span class="txt"></span>`;
    $("[data-benefits]").appendChild(li);
    return { li, rule: $(".rule", li), idx: $("i", li), words: words($(".txt", li), text) };
  });

  // Ventas reales de la demo (producto, medio y monto; sin emails).
  const sales = (meta.sales ?? []).slice(0, 4).map((s) => {
    const li = document.createElement("li");
    const left = document.createElement("span");
    left.textContent = s.producto;
    const small = document.createElement("small");
    small.textContent = `${s.medio} · Pagada`;
    left.appendChild(small);
    const b = document.createElement("b");
    b.textContent = s.monto;
    li.append(left, b);
    $("[data-sales]").appendChild(li);
    return li;
  });

  // Fondo de portadas del catálogo (apertura y cierre).
  const covers = meta.covers.map((c) => `/public${c}`);
  const drifts = $$("[data-drift]").map((box, b) =>
    [0, 1, 2].map((c) => {
      const col = document.createElement("div");
      col.className = "col";
      for (let i = 0; i < 6; i++) {
        const img = document.createElement("img");
        img.src = covers[(c * 2 + i + b) % covers.length];
        col.appendChild(img);
      }
      box.appendChild(col);
      return col;
    }),
  );

  // Videos que se reproducen dentro del celular: se ubican sobre su lugar en la captura.
  const place = (el, r) => Object.assign(el.style, { left: `${r.x * K}px`, top: `${r.y * K}px`, width: `${r.w * K}px`, height: `${r.h * K}px` });
  place($("#a-video"), meta.detail.media);
  place($("#b-video"), meta.ver.player);

  await document.fonts.ready;
  await Promise.all([
    ...$$("img").map((img) => (img.complete ? img.decode().catch(() => {}) : new Promise((r) => (img.onload = img.onerror = r)))),
    ...$$("video").map((v) => (v.readyState >= 2 ? null : new Promise((r) => (v.onloadeddata = v.onerror = r)))),
  ]);

  // ── Timeline ──────────────────────────────────────────────────────
  const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
  /** Videos en movimiento: { el, start, end } → entre start y end muestran el instante (t - start). */
  const clips = [];

  const IN = { autoAlpha: 0, y: 36, filter: "blur(18px)" };
  const reveal = (targets, at, extra = {}) =>
    tl.fromTo(targets, IN, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.85, stagger: 0.06, ...extra }, at);

  const scene = (id, start, end) => {
    const el = $(id);
    tl.set(el, { visibility: "visible" }, start);
    if (end != null) {
      tl.to(el, { autoAlpha: 0, y: -44, filter: "blur(14px)", duration: 0.45, ease: "power2.in" }, end - 0.45);
    }
    return el;
  };

  const tap = (el, x, y, at) => {
    tl.set(el, { left: x, top: y }, at - 0.01);
    tl.fromTo(el, { scale: 0.35, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.22, ease: "power2.out" }, at);
    tl.to(el, { scale: 1.5, opacity: 0, duration: 0.4, ease: "power1.out" }, at + 0.24);
  };

  const phoneIn = (el, at) =>
    tl.fromTo(
      el,
      { autoAlpha: 0, y: 320, scale: 0.94, filter: "blur(16px)" },
      { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 1.05 },
      at,
    );

  const drift = (cols, start, dur) =>
    cols.forEach((col, i) =>
      tl.fromTo(col, { y: i === 1 ? -520 : -160 }, { y: i === 1 ? -260 : -440, duration: dur, ease: "none" }, start),
    );

  // 1 · Apertura
  {
    const s = T.apertura;
    const el = scene("#s-apertura", s, T.problema);
    drift(drifts[0], s, T.problema - s);
    tl.fromTo($(".drift", el), { opacity: 0 }, { opacity: 0.3, duration: 1.4, ease: "power1.out" }, s);
    reveal($(".brand", el), s + 0.25);
    reveal(W.get($(".hero", el)), s + 0.55, { stagger: 0.09 });
  }

  // 2 · Problema
  {
    const s = T.problema;
    scene("#s-problema", s, T.tienda);
    pains.forEach((li, i) => {
      reveal(li, s + 0.1 + i * 0.32);
      tl.fromTo($(".strike", li), { scaleX: 0 }, { scaleX: 1, duration: 0.38, ease: "power2.inOut" }, s + 1.55 + i * 0.28);
      tl.to(li, { color: "#5c5c5c", duration: 0.3 }, s + 1.7 + i * 0.28);
    });
    tl.to(pains, { autoAlpha: 0, y: -50, filter: "blur(14px)", duration: 0.45, stagger: 0.05, ease: "power2.in" }, s + 2.75);
    reveal(W.get($(".remate")), s + 3.2, { stagger: 0.1 });
  }

  // 3 · La tienda
  {
    const s = T.tienda;
    const el = scene("#s-tienda", s, T.cobro);
    const caption = $(".caption", el);
    const phone = $("#phone-a");
    const home = $("#a-home");
    const detail = $("#a-detail");
    const tiles = meta.home.tiles;

    reveal(W.get(caption), s);
    phoneIn(phone, s + 0.3);

    // Scroll por la grilla hasta el video protagonista (segundo en la lista).
    const stop1 = tiles[0].y - 80;
    const stop2 = tiles[1].y - 60;
    tl.to(home, { y: -stop1 * K, duration: 1.4, ease: "power2.inOut" }, s + 1.6);
    tl.to(home, { y: -stop2 * K, duration: 1.3, ease: "power2.inOut" }, s + 3.3);

    // Toque en el video → página de detalle, con el tráiler en movimiento.
    tap($("#a-tap"), 336, (tiles[1].y - stop2 + Math.min(tiles[1].h, VIEW) / 2) * K, s + 4.9);
    tl.set(detail, { x: 672 }, 0);
    tl.to(home, { x: -220, opacity: 0, duration: 0.7, ease: "power3.inOut" }, s + 5.25);
    tl.to(detail, { x: 0, duration: 0.7, ease: "power3.inOut" }, s + 5.25);
    clips.push({ el: $("#a-video"), start: s + 5.25, end: T.cobro });

    // La cámara baja hasta los botones de pago.
    const maxScroll = Math.max(0, meta.detail.height - VIEW);
    tl.to(W.get(caption), { autoAlpha: 0, y: -30, filter: "blur(12px)", duration: 0.45, stagger: 0.03, ease: "power2.in" }, s + 6.25);
    tl.to(phone, { y: -360, duration: 1.2, ease: "power2.inOut" }, s + 6.4);
    tl.to(detail, { y: -maxScroll * K, duration: 1.2, ease: "power2.inOut" }, s + 6.4);

    const btn = meta.detail.payFirst;
    tap($("#a-tap"), 336, (btn.y + btn.h / 2 - maxScroll) * K, s + 7.95);
  }

  // 4 · El cobro
  {
    const s = T.cobro;
    const el = scene("#s-cobro", s, T.entrega);
    reveal(W.get($(".caption", el)), s);
    payCards.forEach((card, i) => {
      tl.fromTo(
        card,
        { autoAlpha: 0, y: 120, scale: 0.96, filter: "blur(16px)" },
        { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.95 },
        s + 0.9 + i * 1.7,
      );
      tl.fromTo($(".price", card), { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.7 }, s + 1.35 + i * 1.7);
    });
    reveal($(".note", el), s + 4.6);
  }

  // 5 · La entrega
  {
    const s = T.entrega;
    const el = scene("#s-entrega", s, T.panel);
    reveal(W.get($(".caption", el)), s);

    const ring = $("#ok-ring");
    const check = $("#ok-check");
    gsap.set(ring, { strokeDasharray: 340, rotation: -90, transformOrigin: "50% 50%" });
    gsap.set(check, { strokeDasharray: 70 });
    tl.set("#approved", { autoAlpha: 1 }, s);
    tl.fromTo(ring, { strokeDashoffset: 340 }, { strokeDashoffset: 0, duration: 0.6, ease: "power2.inOut" }, s + 0.5);
    tl.fromTo(check, { strokeDashoffset: 70 }, { strokeDashoffset: 0, duration: 0.35, ease: "power2.out" }, s + 1.0);
    tl.fromTo("#approved span", { autoAlpha: 0, x: -24, filter: "blur(10px)" }, { autoAlpha: 1, x: 0, filter: "blur(0px)", duration: 0.6 }, s + 0.85);

    const mail = $("#mail");
    tl.fromTo(mail, { autoAlpha: 0, y: 110, filter: "blur(16px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.9 }, s + 1.6);
    const btn = $(".mail-btn");
    tap($("#mail-tap"), btn.offsetLeft + btn.offsetWidth / 2, btn.offsetTop + btn.offsetHeight / 2, s + 3.2);
    tl.to(["#approved", mail], { autoAlpha: 0, y: -70, filter: "blur(14px)", duration: 0.45, stagger: 0.05, ease: "power2.in" }, s + 3.6);

    // Biblioteca → el video comprado, reproduciéndose → el pack de fotos.
    const phone = $("#phone-b");
    phoneIn(phone, s + 3.85);
    const tile = meta.biblioteca.tiles[0];
    tap($("#b-tap"), 336, (tile.y + Math.min(tile.h, VIEW - tile.y) / 2) * K, s + 5.4);
    tl.fromTo("#b-ver", { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" }, s + 5.7);
    clips.push({ el: $("#b-video"), start: s + 5.7, end: s + 8.4 });

    tl.set("#b-gal", { x: 672 }, 0);
    tl.to("#b-ver", { x: -220, opacity: 0, duration: 0.7, ease: "power3.inOut" }, s + 7.7);
    tl.to("#b-gal", { x: 0, duration: 0.7, ease: "power3.inOut" }, s + 7.7);
    const galScroll = Math.min(Math.max(0, meta.galeria.height - VIEW), 380);
    tl.to("#b-gal", { y: -galScroll * K, duration: 1.4, ease: "power2.inOut" }, s + 8.45);
  }

  // 6 · El panel
  {
    const s = T.panel;
    const el = scene("#s-panel", s, T.beneficios);
    const p = guion.panel;
    reveal(W.get($(".caption", el)), s);
    tl.fromTo("#window", { autoAlpha: 0, y: 140, filter: "blur(16px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.95 }, s + 0.4);
    tl.set("#tab-videos", { color: "#f2f2f2" }, 0);

    // Se completa el formulario.
    const typed = { n: 0 };
    tl.to(typed, { n: p.video.length, duration: 1.15, ease: "none", onUpdate: () => ($("#f-title").textContent = p.video.slice(0, Math.round(typed.n))) }, s + 1.15);
    tl.set("#caret", { autoAlpha: 0 }, s + 2.45);

    const usd = { n: 0 };
    const usdText = String(p.usd);
    tl.to(usd, { n: usdText.length, duration: 0.25, ease: "none", onUpdate: () => ($("#f-usd").textContent = usdText.slice(0, Math.round(usd.n))) }, s + 2.55);
    const ars = { v: 0 };
    tl.set("#f-ars", { autoAlpha: 0 }, 0);
    tl.set("#f-ars", { autoAlpha: 1 }, s + 2.9);
    tl.to(ars, { v: p.ars, duration: 0.6, ease: "power2.out", onUpdate: () => ($("#f-ars").textContent = num(ars.v)) }, s + 2.9);

    // Subida del archivo.
    tl.fromTo([".input.file", ".bar"], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, s + 3.6);
    const up = { v: 0 };
    tl.to(up, {
      v: 100,
      duration: 1.8,
      ease: "power1.inOut",
      onUpdate: () => {
        $("#f-pct").textContent = `${Math.round(up.v)}%`;
        $("#f-bar").style.width = `${up.v}%`;
      },
    }, s + 3.95);
    tl.fromTo("#st-proc", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, s + 4.1);
    tl.to("#st-proc", { autoAlpha: 0, duration: 0.2 }, s + 5.8);
    tl.fromTo("#st-pub", { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, s + 5.9);

    // Pestaña de ventas: la lista de ventas de la demo.
    tl.to("#win-form", { autoAlpha: 0, x: -60, filter: "blur(12px)", duration: 0.4, ease: "power2.in" }, s + 6.65);
    tl.to("#tab-videos", { color: "#8c8c8c", duration: 0.3 }, s + 6.8);
    tl.to("#tab-ventas", { color: "#f2f2f2", duration: 0.3 }, s + 6.8);
    tl.fromTo("#win-sales", { autoAlpha: 0, x: 60, filter: "blur(12px)" }, { autoAlpha: 1, x: 0, filter: "blur(0px)", duration: 0.6 }, s + 7.0);
    tl.fromTo(sales, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.12 }, s + 7.15);
  }

  // 7 · Beneficios
  {
    const s = T.beneficios;
    scene("#s-beneficios", s, T.cierre);
    benefits.forEach((b, i) => {
      const at = s + 0.15 + i * 0.5;
      tl.fromTo(b.rule, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power2.inOut" }, at);
      tl.fromTo(b.idx, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, at + 0.15);
      reveal(b.words, at + 0.15, { duration: 0.75 });
    });
  }

  // 8 · Cierre
  {
    const s = T.cierre;
    const el = scene("#s-cierre", s, null);
    drift(drifts[1], s, END - s);
    tl.fromTo($(".drift", el), { opacity: 0 }, { opacity: 0.3, duration: 1.2, ease: "power1.out" }, s);
    reveal($(".brand", el), s + 0.2);
    reveal(W.get($(".hero", el)), s + 0.5, { stagger: 0.09 });
    reveal($(".contact", el), s + 1.7);
  }

  tl.set({}, {}, END); // fija la duración total
  return { tl, guion, clips };
}

/** Lleva un <video> a un instante exacto y espera a que ese cuadro esté listo para dibujarse. */
function seekVideo(el, time) {
  const target = Math.max(0, Math.min(time, (el.duration || 1) - 0.04));
  if (Math.abs(el.currentTime - target) < 0.001) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      el.removeEventListener("seeked", done);
      resolve();
    };
    el.addEventListener("seeked", done);
    el.currentTime = target;
    setTimeout(done, 1500); // por si el navegador no avisa
  });
}

window.__ready = build().then(({ tl, guion, clips }) => {
  window.__duration = guion.duracion;
  window.__fps = guion.fps;
  window.__cuts = Object.values(guion.tiempos);
  window.__seek = async (t) => {
    const time = Math.min(t, guion.duracion);
    tl.seek(time, false);
    await Promise.all(clips.filter((c) => time >= c.start - 0.1 && time <= c.end).map((c) => seekVideo(c.el, time - c.start)));
    // Un cuadro de espera para que el navegador pinte el video ya posicionado.
    await new Promise((r) => requestAnimationFrame(() => r()));
  };
  // Vista previa en el navegador: abrir con ?play
  if (location.search.includes("play")) {
    tl.play(0);
    gsap.ticker.add(() => clips.forEach((c) => {
      const time = tl.time();
      if (time >= c.start && time <= c.end && Math.abs(c.el.currentTime - (time - c.start)) > 0.2) c.el.currentTime = time - c.start;
    }));
  } else {
    return window.__seek(0);
  }
});
