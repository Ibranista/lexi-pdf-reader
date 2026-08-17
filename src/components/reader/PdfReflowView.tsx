/**
 * Reflow reader for real PDFs (Foxit-style).
 *
 * Extracts the document with pdf.js inside a WebView and re-lays it out as
 * reflowed HTML: text wraps to the screen width, images are kept inline, and
 * text colors are preserved. Tap-and-hold selects, double-tap zooms the font
 * to the user's Smart Zoom level, single tap toggles distraction-free mode.
 *
 * How images/colors survive: `getTextContent()` carries neither, so each page
 * that needs them is also rendered to an offscreen canvas. Image placement
 * comes from the operator list (CTM tracking) and is cropped out of that
 * canvas; text color is sampled from the canvas under each line. Pages that
 * are plain black text skip the canvas render entirely (the fast path).
 *
 * The PDF bytes stay on the device; only pdf.js and the reader font are
 * fetched from a CDN.
 */
import { Directory, File, Paths } from "expo-file-system";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Box, Text } from "@/components/atoms";
import { Tap } from "@/components/lexi-components";
// One bridge batch per upload request — a local constant would drift and
// silently double the number of POSTs.
import { CONTEXT_CHUNK_PAGES } from "@/services/lexi-ai";
import { LINE_SPACING, useAppStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";
import { fontStack, READ_WIDTH_PX, softInk } from "@/utils/reader-typography";

export interface PdfOutlineEntry {
  title: string;
  page: number;
  /** 0 = top level, 1 = nested (embedded outlines only). */
  level: number;
}

export interface PdfSearchResult {
  page: number;
  before: string;
  match: string;
  after: string;
  /**
   * Vertical span of the matched paragraph on its original page, as 0–1
   * fractions of page height. Fallback locator when word boxes are missing —
   * the native PDF has no text/highlight API of its own.
   */
  ny0?: number;
  ny1?: number;
  /**
   * Boxes around the matched characters themselves (one per line the match
   * spans), as 0–1 fractions of page width/height. X is interpolated by
   * character position within the line, so it's word-accurate, not exact
   * glyph metrics.
   */
  boxes?: { x0: number; y0: number; x1: number; y1: number }[];
}

const PDFJS_VERSION = "3.11.174";
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

type Status = "reading" | "extracting" | "ready" | "error";

interface Settings {
  baseFs: number;
  zoomedFs: number;
  lh: number;
  fontFamily: string;
  fg: string;
  bg: string;
  faint: string;
  hl: string;
  /** Horizontal body padding in px — the "reading width & margins" setting.
   *  A wider margin (narrower column) is a larger value. */
  px: number;
}

/** Rough luminance test on a #rrggbb / #rgb theme color. */
function isDark(color: string): boolean {
  const hex = color.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (full.length < 6) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

export function buildHtml(
  b64: string,
  s: Settings,
  initialPage: number,
  topInset: number,
): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=Hanken+Grotesk:wght@400;500;600&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Comic+Relief:wght@400;700&display=swap');
  :root {
    --fs: ${s.baseFs}px;
    --lh: ${s.lh};
    --fg: ${s.fg};
    --bg: ${s.bg};
    --faint: ${s.faint};
    --hl: ${s.hl};
    --ff: ${s.fontFamily};
    --px: ${s.px}px;
  }
  /* Saved highlights. Alpha rather than a flat fill so the reader's own text
     colour still carries the contrast — a solid pastel behind light text in
     dark mode is unreadable. */
  mark.lexi-hl {
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
    background: rgba(239,197,126,.42);
  }
  mark.lexi-hl[data-c="sage"] { background: rgba(180,212,180,.42); }
  mark.lexi-hl[data-c="sky"]  { background: rgba(174,203,232,.42); }
  mark.lexi-hl[data-c="rose"] { background: rgba(232,184,180,.42); }

  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; background: var(--bg); }
  body {
    color: var(--fg);
    padding: 0 var(--px) 96px;
    font-family: var(--ff);
    -webkit-user-select: text;
    user-select: text;
  }
  /* spacer keeps text clear of the floating toolbar; animating its height
     shifts content without ever resizing the WebView itself */
  #chrome-pad {
    height: ${topInset + 16}px;
    transition: height 380ms cubic-bezier(0.33, 0.01, 0.2, 1);
  }
  /* This is what makes pinching drag. --fs lives on :root, so every change
     invalidates layout for every paragraph in the book at once — a 300-page
     PDF is tens of thousands of them, re-wrapped on every frame of the
     gesture. content-visibility lets the engine skip layout entirely for
     sections that aren't near the viewport, so a pinch only re-wraps what you
     can actually see. The "auto" in contain-intrinsic-size makes a section
     remember its real height once measured, so the scrollbar settles instead
     of drifting as you move through the document.
     (No-op on WebKit before iOS 18 — degrades to today's behaviour.) */
  section {
    scroll-margin-top: 12px;
    content-visibility: auto;
    contain-intrinsic-size: auto 1200px;
  }
  /* One page flows straight into the next, which reads as a single endless
     page — mark the seam so the reader can feel the page turn. Pure CSS on
     the data-page attribute every section already carries, so it costs no
     markup, and a glance at the last label also shows exactly how far
     extraction reached. Styled off the theme variables, so it follows font
     and dark/light changes live like everything else. */
  #content section + section::before {
    content: 'Page ' attr(data-page);
    display: block;
    text-align: center;
    font-family: var(--ff);
    font-size: 10px;
    letter-spacing: 0.14em;
    color: var(--fg);
    opacity: 0.35;
    border-top: 1px solid var(--faint);
    padding-top: 1.1em;
    margin: 1.8em 0 1.6em;
  }
  #content p {
    font-size: var(--fs);
    line-height: var(--lh);
    margin: 0 0 1.1em;
    word-break: break-word;
    overflow-wrap: break-word;
  }
  #content table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.2em 0;
    font-size: var(--fs);
    line-height: var(--lh);
    color: var(--fg);
    table-layout: fixed;
  }
  #content th, #content td {
    border: 1px solid var(--faint);
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  #content th {
    font-weight: 600;
    background: rgba(128,128,128,0.08);
  }
  #content tr:nth-child(even) {
    background: rgba(128,128,128,0.04);
  }
  /* Each figure carries an inline width — its size on the page, not its pixel
     count — so a small mark keeps its size instead of being blown up to the
     column and turning to mush. Height stays auto and both caps only shrink;
     for a replaced element that means the ratio is held on the way down, so a
     figure taller than the screen loses width to match rather than squashing.
     Setting width:auto here would defeat all of it: author styles outrank the
     size attribute, and the figure would resolve to its bitmap width. */
  #content img {
    display: block;
    height: auto;
    max-width: 100%;
    max-height: 78vh;
    margin: 1.2em auto;
    border-radius: 4px;
  }
  /* focus mode: scroll-driven spotlight — the block under the reading line
     stays bright, everything else recedes */
  #content p, #content img { transition: opacity 320ms ease; }
  #content.focus p, #content.focus img { opacity: 0.27; }
  #content.focus .f-lit { opacity: 1; }
  /* the tapped search hit — flashes, holds long enough to be spotted, then
     fades out (same lifecycle as Page view's locator) */
  mark.lexi-hit {
    background: var(--hl);
    color: inherit;
    border-radius: 3px;
    padding: 0 2px;
    margin: 0 -2px;
    animation: lexi-flash 1.4s ease-out 1;
    transition: background 450ms ease;
  }
  p.lexi-hit-p {
    background: var(--hl);
    border-radius: 4px;
    transition: background 450ms ease;
  }
  mark.lexi-hit.lexi-hit-fade, p.lexi-hit-p.lexi-hit-fade {
    background: transparent;
  }
  @keyframes lexi-flash {
    0%, 55% { box-shadow: 0 0 0 3px var(--hl); }
    100% { box-shadow: 0 0 0 0 transparent; }
  }
  #status {
    position: fixed; inset: 0; display: flex; align-items: center;
    justify-content: center; color: var(--faint);
    font-family: var(--ff); font-size: 14px; background: var(--bg);
  }
  #status.hidden { display: none; }
</style>
</head>
<body>
<div id="status">Extracting…</div>
<div id="chrome-pad"></div>
<div id="content"></div>
<script src="${PDFJS_BASE}/pdf.min.js"></script>
<script>
  var BASE_FS = ${s.baseFs};
  var ZOOM_FS = ${s.zoomedFs};
  var INITIAL_PAGE = ${initialPage};
  /* Geometry (paragraph spans, search boxes) is measured at 1x — those are all
     ratios, so density buys nothing. Figures are a different story: cropping
     them out of a 1x raster and then letting CSS stretch them to the column
     lands them at roughly a third of the screen's real pixels. Pages carrying
     images rasterize at device density instead. */
  var IMG_SCALE = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  var DARK_BG = ${isDark(s.bg) ? "true" : "false"};
  var zoomed = false;

  function post(obj){
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }
  }

  window.applySettings = function(s){
    var r = document.documentElement.style;
    BASE_FS = s.baseFs; ZOOM_FS = s.zoomedFs;
    setFs(zoomed ? ZOOM_FS : BASE_FS);
    r.setProperty('--lh', String(s.lh));
    r.setProperty('--fg', s.fg);
    r.setProperty('--bg', s.bg);
    r.setProperty('--faint', s.faint);
    r.setProperty('--hl', s.hl);
    r.setProperty('--ff', s.fontFamily);
    r.setProperty('--px', s.px + 'px');
  };

  window.setChromeOffset = function(px){
    var pad = document.getElementById('chrome-pad');
    if (pad) pad.style.height = (${topInset} + 16 + px) + 'px';
  };

  /* ---- page jumps ----
     Pages arrive one at a time, so a jump to page 40 of a long book asks for a
     section that hasn't been extracted yet. Rather than no-op (which used to
     strand you wherever extraction had reached, and then let the end-of-run
     scroll drop you back on the page you opened at), the target is held and
     retried as each page lands. Touching the document clears it — once you've
     started reading somewhere, a queued jump yanking you away is wrong. */
  var pendingScroll = 0;

  function tryPendingScroll(){
    if (!pendingScroll) return;
    var el = document.querySelector('section[data-page="' + pendingScroll + '"]');
    if (!el) return;             // not extracted yet — try again next page
    el.scrollIntoView({ block: 'start' });
    pendingScroll = 0;
  }

  window.scrollToPage = function(n){
    pendingScroll = n > 1 ? n : 0;
    if (n <= 1) window.scrollTo(0, 0);
    tryPendingScroll();
  };

  window.searchText = function(q){
    var results = [];
    if (!q) { post({type:'searchresults',results:[]}); return; }
    var ql = q.toLowerCase();
    var secs = document.querySelectorAll('section[data-page]');
    for (var i = 0; i < secs.length; i++) {
      var pg = parseInt(secs[i].getAttribute('data-page'), 10);
      var ps = secs[i].querySelectorAll('p');
      for (var j = 0; j < ps.length; j++) {
        var txt = ps[j].textContent || '';
        var tl = txt.toLowerCase();
        var ix = tl.indexOf(ql);
        if (ix >= 0) {
          // Box just the matched characters: find the line(s) the hit spans
          // and interpolate x by character position within each line.
          var boxes = [];
          try {
            var geo = JSON.parse(ps[j].getAttribute('data-geom') || '[]');
            for (var g = 0; g < geo.length && boxes.length < 3; g++) {
              var ln = geo[g];
              var s = Math.max(ix, ln.o);
              var e = Math.min(ix + q.length, ln.o + ln.l);
              if (e <= s) continue;
              var f0 = (s - ln.o) / ln.l;
              var f1 = (e - ln.o) / ln.l;
              boxes.push({
                x0: ln.x0 + (ln.x1 - ln.x0) * f0,
                x1: ln.x0 + (ln.x1 - ln.x0) * f1,
                y0: ln.y0, y1: ln.y1
              });
            }
          } catch (e2) { /* malformed geom — fall back to the band */ }
          results.push({
            page: pg,
            before: txt.slice(Math.max(0, ix - 34), ix),
            match: txt.slice(ix, ix + q.length),
            after: txt.slice(ix + q.length, ix + q.length + 44),
            ny0: parseFloat(ps[j].getAttribute('data-ny0') || '-1'),
            ny1: parseFloat(ps[j].getAttribute('data-ny1') || '-1'),
            boxes: boxes
          });
          if (results.length >= 50) break;
        }
      }
      if (results.length >= 50) break;
    }
    post({type:'searchresults',results:results});
  };

  /* ---- marking the tapped result ----
     searchText records the first hit per paragraph, in document order, so a
     result's position in the list is the same as its position in this walk.
     That index is all we need to find the exact word again. */
  function clearMarks(){
    var marks = document.querySelectorAll('mark.lexi-hit');
    for (var i = 0; i < marks.length; i++){
      var m = marks[i], parent = m.parentNode;
      if (!parent) continue;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();  // re-join the split text nodes for the next search
    }
    var ps = document.querySelectorAll('p.lexi-hit-p');
    for (var j = 0; j < ps.length; j++) ps[j].classList.remove('lexi-hit-p');
  }

  /* Wrap [start, start+len) of a paragraph's text in a <mark>. The offset is
     into textContent, which may span several nodes when the paragraph has
     colored runs — so walk the text nodes to map it back. */
  function markInParagraph(p, start, len){
    var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
    var node, pos = 0, sNode = null, sOff = 0, eNode = null, eOff = 0;
    while ((node = walker.nextNode())) {
      var l = node.nodeValue.length;
      if (!sNode && pos + l > start) { sNode = node; sOff = start - pos; }
      if (sNode && pos + l >= start + len) { eNode = node; eOff = start + len - pos; break; }
      pos += l;
    }
    if (sNode && eNode) {
      var range = document.createRange();
      range.setStart(sNode, sOff);
      range.setEnd(eNode, eOff);
      var mark = document.createElement('mark');
      mark.className = 'lexi-hit';
      try {
        range.surroundContents(mark);
        mark.scrollIntoView({ block: 'center' });
        return;
      } catch (e) {
        // match straddles element boundaries — fall through to the paragraph
      }
    }
    p.classList.add('lexi-hit-p');
    p.scrollIntoView({ block: 'center' });
  }

  // hold → fade → unwrap, so the mark never lingers; timers are cancelled
  // when a newer highlight (or search) supersedes this one
  var hitHoldTimer = null, hitFadeTimer = null;
  function cancelHitTimers(){
    if (hitHoldTimer) { clearTimeout(hitHoldTimer); hitHoldTimer = null; }
    if (hitFadeTimer) { clearTimeout(hitFadeTimer); hitFadeTimer = null; }
  }
  function scheduleHitFade(){
    hitHoldTimer = setTimeout(function(){
      hitHoldTimer = null;
      var els = document.querySelectorAll('mark.lexi-hit, p.lexi-hit-p');
      for (var i = 0; i < els.length; i++) els[i].classList.add('lexi-hit-fade');
      hitFadeTimer = setTimeout(function(){
        hitFadeTimer = null;
        clearMarks();
      }, 480);
    }, 2200);
  }

  window.highlightMatch = function(q, idx, page){
    cancelHitTimers();
    clearMarks();
    if (!q) return;
    var ql = q.toLowerCase();
    // When a page is given (a flash from My Notes), look only on that page and
    // its overflow onto the next section, and take the first occurrence there —
    // so the tapped note/word lights up where it actually sits rather than at
    // some earlier mention elsewhere in the book.
    var secs;
    if (page) {
      var pageSec = document.querySelector('section[data-page="' + page + '"]');
      secs = pageSec ? [pageSec, pageSec.nextElementSibling].filter(Boolean) : [];
      idx = 0;
    } else {
      secs = document.querySelectorAll('section[data-page]');
    }
    var seen = 0;
    for (var i = 0; i < secs.length; i++) {
      var ps = secs[i].querySelectorAll('p');
      for (var j = 0; j < ps.length; j++) {
        var txt = ps[j].textContent || '';
        var ix = txt.toLowerCase().indexOf(ql);
        if (ix < 0) continue;
        if (seen !== idx) { seen++; continue; }
        markInParagraph(ps[j], ix, q.length);
        scheduleHitFade();
        return;
      }
    }
  };

  window.clearHighlight = function(){ cancelHitTimers(); clearMarks(); };

  /* ---- extracted text, out to the reader ----
     Liqrai answers from the whole document, so the server needs its text
     (POST /ai/context). Extraction already happened to build this DOM, so
     this walks what is here rather than parsing the PDF a second time.

     Posted in page-sized batches: a long book's text is several megabytes,
     and one message that size stalls the bridge and the upload behind it. */
  window.sendContext = function(batch){
    var secs = document.querySelectorAll('section[data-page]');
    var out = [];
    for (var i = 0; i < secs.length; i++) {
      var ps = secs[i].querySelectorAll('p');
      var buf = [];
      for (var j = 0; j < ps.length; j++) {
        var txt = ps[j].textContent || '';
        if (txt) buf.push(txt);
      }
      out.push({
        page: parseInt(secs[i].getAttribute('data-page'), 10),
        // Double-escaped on purpose: this whole script is a JS template
        // literal, so a single-escaped newline here would emit a real line
        // break inside a quoted string in the generated HTML — a syntax error
        // that kills the entire injected script (which left reflow's skeleton
        // spinning forever). The doubled form survives into the page as the
        // newline escape we actually want.
        text: buf.join('\\n')
      });
      if (out.length >= batch) {
        post({ type: 'context', pages: out, done: false });
        out = [];
      }
    }
    // Always fires, empty tail included — it's what tells the reader the
    // document is fully uploaded.
    post({ type: 'context', pages: out, done: true });
  };

  /* ---- focus mode: scroll-driven spotlight ----
     The block whose box crosses the reading line (45% down the screen — a
     bit above center, where eyes actually rest) is lit; the rest stay dim.
     Recomputed from the same scroll rAF that reports the page. */
  var focusOn = false;
  var litEl = null;
  function updateSpotlight(){
    if (!focusOn || (pinch && pinch.active)) return;
    // Measure per section, not per paragraph: the old sweep took a rect off
    // every block in the document on every scroll frame, which in a long PDF
    // is tens of thousands of reads to find one winner that was always within
    // a screen of the beam. Sections are in document order, so we can walk to
    // the viewport and stop at the far edge.
    var secs = document.querySelectorAll('#content section');
    var beam = window.innerHeight * 0.45;
    var best = null, bestD = Infinity;
    for (var i = 0; i < secs.length; i++){
      var sr = secs[i].getBoundingClientRect();
      if (sr.bottom < 0) continue;
      if (sr.top > window.innerHeight) break;
      var blocks = secs[i].children;
      for (var j = 0; j < blocks.length; j++){
        var r = blocks[j].getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue;  // off-screen
        var d = (r.top <= beam && r.bottom >= beam)
          ? 0
          : Math.min(Math.abs(r.top - beam), Math.abs(r.bottom - beam));
        if (d < bestD) { bestD = d; best = blocks[j]; }
      }
    }
    if (!best || best === litEl) return;
    if (litEl) litEl.classList.remove('f-lit');
    litEl = best;
    litEl.classList.add('f-lit');
  }

  window.setFocusMode = function(on){
    focusOn = !!on;
    var content = document.getElementById('content');
    if (!content) return;
    if (focusOn) {
      content.classList.add('focus');
      updateSpotlight();
    } else {
      content.classList.remove('focus');
      if (litEl) { litEl.classList.remove('f-lit'); litEl = null; }
    }
  };

  /* ---- gestures ----
     single tap = immersive · double tap = smart zoom · pinch = live zoom.
     A touch only counts as a tap if the finger barely moved and lifted
     quickly — otherwise scrolling would register as a tap on every swipe. */
  var TAP_SLOP = 10;      // px of movement still considered a tap
  var TAP_TIME = 250;     // ms; longer is a press, not a tap
  var DBL_WINDOW = 240;   // ms between taps that makes a double-tap
  var MIN_FS = 10, MAX_FS = 56;
  // Pinch is damped: font scales by (fingerRatio ^ PINCH_SENS), so pulling
  // your fingers twice as far apart grows the text ~1.4x rather than 2x.
  // 1:1 felt violent because a small pinch is a large ratio.
  var PINCH_SENS = 0.45;
  var PINCH_DEADZONE = 12; // px of finger travel before zoom engages
  var lastTap = 0, tapTimer = null;
  var startX = 0, startY = 0, startT = 0, moved = true;
  var curFs = BASE_FS;
  var pinch = null;
  var fsRaf = false, pendingFs = 0;

  /* A font change resizes the pages above you as well as the one you're on, so
     the whole document slides under your fingers while you pinch — which reads
     as the gesture sticking and fighting back. Pin the block at the reading
     line and put the scroll position back after the reflow, so the text grows
     around where you're looking instead of running away from it. */
  function anchorAt(beam){
    var secs = document.querySelectorAll('#content section');
    for (var i = 0; i < secs.length; i++){
      var sr = secs[i].getBoundingClientRect();
      if (sr.bottom < beam) continue;
      if (sr.top > beam) break;               // sections are in document order
      var kids = secs[i].children;
      for (var j = 0; j < kids.length; j++){
        var r = kids[j].getBoundingClientRect();
        if (r.bottom >= beam) return { el: kids[j], top: r.top };
      }
    }
    return null;
  }

  // batched via rAF so continuous pinching reflows at frame rate, not
  // once per touchmove event
  function setFs(v){
    // whole pixels only — fractional sizes cause constant re-wrapping
    var next = Math.max(MIN_FS, Math.min(MAX_FS, Math.round(v)));
    if (next === curFs) return;
    curFs = next;
    pendingFs = next;
    if (!fsRaf) {
      fsRaf = true;
      requestAnimationFrame(function(){
        fsRaf = false;
        var a = anchorAt(window.innerHeight * 0.4);
        document.documentElement.style.setProperty('--fs', pendingFs + 'px');
        if (a) {
          var drift = a.el.getBoundingClientRect().top - a.top;
          if (drift) window.scrollBy(0, drift);
        }
      });
    }
  }

  function distOf(touches){
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
  }

  document.addEventListener('touchstart', function(e){
    if (e.touches.length === 2) {
      moved = true;
      if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; }
      pinch = { dist: distOf(e.touches), fs: curFs, active: false };
      return;
    }
    if (e.touches.length !== 1) { moved = true; return; }
    // reading where you are outranks a jump still waiting on extraction
    pendingScroll = 0;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startT = Date.now();
    moved = false;
  }, { passive: true });

  document.addEventListener('touchmove', function(e){
    if (pinch && e.touches.length === 2) {
      e.preventDefault(); // keep the browser from panning while we zoom
      var d = distOf(e.touches);
      if (d > 0 && pinch.dist > 0) {
        if (!pinch.active) {
          if (Math.abs(d - pinch.dist) < PINCH_DEADZONE) return;
          // re-baseline on engage so the text doesn't jump by the deadzone
          pinch.active = true;
          pinch.dist = d;
          pinch.fs = curFs;
          return;
        }
        setFs(pinch.fs * Math.pow(d / pinch.dist, PINCH_SENS));
      }
      return;
    }
    if (moved || !e.touches.length) return;
    if (Math.abs(e.touches[0].clientX - startX) > TAP_SLOP ||
        Math.abs(e.touches[0].clientY - startY) > TAP_SLOP) {
      moved = true;
      if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; }
    }
  }, { passive: false });

  document.addEventListener('touchend', function(e){
    if (pinch) { if (e.touches.length < 2) pinch = null; return; }
    if (moved) return;                              // was a scroll/drag
    if (Date.now() - startT > TAP_TIME) return;     // was a long press
    if (window.getSelection().toString() !== '') return;
    // A tap on a saved highlight opens it, rather than toggling the chrome.
    // Taken before the double-tap timer so it responds on the first tap.
    var onMark = e.target && e.target.closest
      ? e.target.closest('mark.lexi-hl')
      : null;
    if (onMark) {
      if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; }
      e.preventDefault();
      post({ type: 'highlighttap', id: onMark.getAttribute('data-id') || '' });
      return;
    }
    var now = Date.now();
    if (now - lastTap < DBL_WINDOW) {
      if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; }
      zoomed = curFs !== ZOOM_FS;
      setFs(zoomed ? ZOOM_FS : BASE_FS);
      e.preventDefault();
    } else {
      if (tapTimer) clearTimeout(tapTimer);
      tapTimer = setTimeout(function(){ tapTimer = null; post({ type: 'tap' }); }, DBL_WINDOW);
    }
    lastTap = now;
  }, { passive: false });

  // a fling that's still settling shouldn't leave a pending tap queued
  window.addEventListener('scroll', function(){
    if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; }
  }, { passive: true });

  /* ---- report reading position ---- */
  var ticking = false;
  window.addEventListener('scroll', function(){
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function(){
      ticking = false;
      var secs = document.querySelectorAll('section[data-page]');
      var best = null;
      for (var i = 0; i < secs.length; i++){
        if (secs[i].getBoundingClientRect().top <= 80) best = secs[i];
        else break;
      }
      if (best) post({ type: 'page', page: parseInt(best.getAttribute('data-page'), 10) });
      updateSpotlight();
    });
  }, { passive: true });

  /* Selection → RN, so the reader can offer highlight/note on it. Reported on
     settle rather than on every change: Android fires selectionchange for each
     handle movement, and the action bar shouldn't flicker while you drag. */
  var selTimer = null;
  var lastSel = '';
  document.addEventListener('selectionchange', function(){
    clearTimeout(selTimer);
    selTimer = setTimeout(function(){
      var sel = window.getSelection();
      var text = sel ? sel.toString().trim() : '';
      if (text === lastSel) return;
      lastSel = text;
      if (!text) { post({ type: 'selection', text: '' }); return; }
      // page comes from the section the selection starts in, so a passage
      // spanning a page break is filed on the page it began
      var node = sel.anchorNode;
      var el = node && (node.nodeType === 1 ? node : node.parentElement);
      var sec = el && el.closest ? el.closest('section[data-page]') : null;
      post({
        type: 'selection',
        text: text,
        page: sec ? parseInt(sec.getAttribute('data-page'), 10) : 0,
      });
    }, 320);
  });

  /* ===== saved highlights =====
     Re-found by text rather than stored as offsets: reflow rebuilds the DOM
     whenever the typeface or size changes, so any offset we recorded would go
     stale. Matching the passage again survives all of that. */

  /* Whitespace-collapsed copy of a string, plus a map back to the original
     indices — reflow's text nodes carry the PDF's own line breaks, which the
     selected string doesn't. */
  function normMap(s){
    var out = '', map = [], ws = false;
    for (var i = 0; i < s.length; i++){
      var ch = s[i];
      // ch <= ' ' catches space, newline, tab and carriage return without
      // escape sequences, which inside this template literal would need
      // double-escaping to survive into the page.
      if (ch <= ' ') {
        if (ws) continue;
        out += ' '; map.push(i); ws = true;
      } else {
        out += ch; map.push(i); ws = false;
      }
    }
    return { text: out, map: map };
  }

  function textNodesOf(root){
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    return nodes;
  }

  /* Wraps one passage. Works per text node so a passage crossing paragraphs
     still marks — surroundContents throws on a range that straddles elements,
     but never on one confined to a single text node. */
  function markPassage(sec, needle, color, id){
    var nodes = textNodesOf(sec);
    if (!nodes.length) return false;
    var full = '', starts = [];
    for (var i = 0; i < nodes.length; i++){
      starts.push(full.length);
      full += nodes[i].nodeValue;
    }
    var nm = normMap(full);
    var want = normMap(needle).text.trim();
    if (!want) return false;
    var at = nm.text.indexOf(want);
    if (at < 0) return false;
    var from = nm.map[at], to = nm.map[at + want.length - 1] + 1;

    for (var j = 0; j < nodes.length; j++){
      var ns = starts[j], ne = ns + nodes[j].nodeValue.length;
      var s = Math.max(from, ns), e = Math.min(to, ne);
      if (s >= e) continue;
      try {
        var r = document.createRange();
        r.setStart(nodes[j], s - ns);
        r.setEnd(nodes[j], e - ns);
        var m = document.createElement('mark');
        m.className = 'lexi-hl';
        m.setAttribute('data-c', color);
        if (id) m.setAttribute('data-id', id);
        r.surroundContents(m);
      } catch (err) { /* node vanished mid-pass — skip it */ }
    }
    return true;
  }

  var savedHighlights = [];
  /* Highlights whose page hasn't been extracted yet. Kept as a count so the
     extraction loop can skip the repaint entirely once everything has landed
     — the scan below walks the document, which grows with every page. */
  var pendingHighlights = 0;

  function unwrap(m){
    var parent = m.parentNode;
    if (!parent) return;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();   // re-join, or the next match sees a split string
  }

  /* Brings the page in line with the saved list, touching only what changed.
     Tearing every mark out and re-finding all of them — which is what this
     used to do — costs a pass over the whole document each time, so on a long
     book adding one highlight made every other one blink off and back on
     while the search ran. Marks already in place are left alone; a recolour
     is done on the mark itself; only a deleted passage is unwrapped. */
  window.applyHighlights = function(list){
    if (list) savedHighlights = list;

    var wanted = {};
    for (var i = 0; i < savedHighlights.length; i++){
      wanted[savedHighlights[i].id] = savedHighlights[i];
    }

    var placed = {};
    var marks = document.querySelectorAll('mark.lexi-hl');
    for (var j = 0; j < marks.length; j++){
      var m = marks[j], id = m.getAttribute('data-id') || '';
      var h = wanted[id];
      if (!h) { unwrap(m); continue; }
      if (m.getAttribute('data-c') !== h.color) m.setAttribute('data-c', h.color);
      placed[id] = true;
    }

    pendingHighlights = 0;
    for (var k = 0; k < savedHighlights.length; k++){
      var hl = savedHighlights[k];
      if (placed[hl.id]) continue;
      var sec = document.querySelector('section[data-page="' + hl.page + '"]');
      if (!sec) { pendingHighlights++; continue; }   // retried as the page lands
      if (markPassage(sec, hl.text, hl.color, hl.id)) continue;
      // A passage can run past its own page break; the next section is the
      // only other place it can be — and it may not have been extracted yet.
      if (sec.nextElementSibling) {
        markPassage(sec.nextElementSibling, hl.text, hl.color, hl.id);
      } else {
        pendingHighlights++;
      }
    }
  };

  window.clearTextSelection = function(){
    try { window.getSelection().removeAllRanges(); } catch (e) {}
    lastSel = '';
    post({ type: 'selection', text: '' });
  };

  function b64ToBytes(b64){
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  /* Walk the operator list to find image placements and whether the page
     uses any non-black fill. CTM is tracked through save/restore/transform. */
  function scanOps(ops){
    var OPS = pdfjsLib.OPS, Util = pdfjsLib.Util;
    var ctm = [1,0,0,1,0,0];
    var stack = [];
    var images = [];
    var hasColor = false;
    for (var i = 0; i < ops.fnArray.length; i++){
      var fn = ops.fnArray[i];
      var args = ops.argsArray[i];
      if (fn === OPS.save) { stack.push(ctm.slice()); }
      else if (fn === OPS.restore) { ctm = stack.pop() || [1,0,0,1,0,0]; }
      else if (fn === OPS.transform) { ctm = Util.transform(ctm, args); }
      else if (fn === OPS.setFillRGBColor) {
        if (args[0] > 40 || args[1] > 40 || args[2] > 40) hasColor = true;
      }
      else if (fn === OPS.setFillGray) { if (args[0] > 0.25) hasColor = true; }
      else if (fn === OPS.setFillCMYKColor) {
        if (args[0] > 0.1 || args[1] > 0.1 || args[2] > 0.1) hasColor = true;
      }
      // The object name matters as much as the placement: it's the handle to
      // the image's own bitmap, which beats anything croppable off the page.
      else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject ||
               fn === OPS.paintImageXObjectRepeat) {
        images.push({ ctm: ctm.slice(), name: args[0] });
      }
      else if (fn === OPS.paintInlineImageXObject) {
        // inline images carry their pixels in the operand, not the object store
        images.push({ ctm: ctm.slice(), name: null });
      }
    }
    return { images: images, hasColor: hasColor };
  }

  /* Device-space box of the unit square under matrix m. */
  function boxOf(m, viewport){
    var Util = pdfjsLib.Util;
    var full = Util.transform(viewport.transform, m);
    var pts = [
      Util.applyTransform([0,0], full), Util.applyTransform([1,0], full),
      Util.applyTransform([0,1], full), Util.applyTransform([1,1], full)
    ];
    var xs = pts.map(function(p){ return p[0]; });
    var ys = pts.map(function(p){ return p[1]; });
    return {
      x: Math.min.apply(null, xs), y: Math.min.apply(null, ys),
      w: Math.max.apply(null, xs) - Math.min.apply(null, xs),
      h: Math.max.apply(null, ys) - Math.min.apply(null, ys)
    };
  }

  /* Publishers routinely emit one figure as a stack of strips — scanner output,
     sliced exports, gradient tiles. Left alone each strip becomes its own
     <img> with margins between them and the figure arrives shredded, so union
     placements that touch or overlap before anything gets cropped. */
  function mergeBoxes(entries, viewport){
    var boxes = [];
    for (var i = 0; i < entries.length; i++){
      var b = boxOf(entries[i].ctm, viewport);
      b.parts = [entries[i]];
      boxes.push(b);
    }
    var joined = true;
    while (joined) {
      joined = false;
      for (var a = 0; a < boxes.length && !joined; a++){
        for (var c = a + 1; c < boxes.length && !joined; c++){
          var p = boxes[a], q = boxes[c];
          // touching counts, not just overlapping — strips usually abut exactly
          var gapX = Math.max(p.x, q.x) - Math.min(p.x + p.w, q.x + q.w);
          var gapY = Math.max(p.y, q.y) - Math.min(p.y + p.h, q.y + q.h);
          if (gapX > 2 || gapY > 2) continue;
          var x0 = Math.min(p.x, q.x), y0 = Math.min(p.y, q.y);
          var x1 = Math.max(p.x + p.w, q.x + q.w);
          var y1 = Math.max(p.y + p.h, q.y + q.h);
          boxes[a] = { x: x0, y: y0, w: x1 - x0, h: y1 - y0,
                       parts: p.parts.concat(q.parts) };
          boxes.splice(c, 1);
          joined = true;
        }
      }
    }
    return boxes;
  }

  /* Page-local XObjects live on the page, ones shared across pages on the
     document, and the naming that tells them apart has moved between pdf.js
     releases — so ask both. Either store throws rather than waits if the
     worker hasn't resolved the object yet, hence the guards; a miss is not a
     failure, it just means we crop instead. The objects exist by now only
     because the page render above forced them to resolve. */
  function imageSource(pdf, page, name){
    if (!name) return null;
    var stores = [page.objs, pdf.commonObjs];
    for (var i = 0; i < stores.length; i++){
      try {
        if (stores[i] && stores[i].has(name)) return stores[i].get(name);
      } catch (e) { /* not resolved in this store — try the next */ }
    }
    return null;
  }

  /* pdf.js hands back either a decoded ImageBitmap or a raw pixel buffer
     tagged with its ImageKind. Unpack whichever arrived into a canvas at the
     image's own resolution. */
  function toCanvas(obj){
    if (!obj) return null;
    var cv = document.createElement('canvas');
    if (obj.bitmap) {
      cv.width = obj.bitmap.width; cv.height = obj.bitmap.height;
      cv.getContext('2d').drawImage(obj.bitmap, 0, 0);
      return cv;
    }
    var w = obj.width, h = obj.height, src = obj.data;
    if (!src || !w || !h || w * h > 3e7) return null;
    cv.width = w; cv.height = h;
    var c = cv.getContext('2d');
    var id = c.createImageData(w, h);
    var out = id.data;
    var K = pdfjsLib.ImageKind || {};
    if (obj.kind === K.RGBA_32BPP || src.length === w * h * 4) {
      out.set(src.subarray(0, w * h * 4));
    }
    else if (obj.kind === K.RGB_24BPP || src.length === w * h * 3) {
      for (var i = 0, j = 0; i < w * h; i++, j += 3){
        out[i*4] = src[j]; out[i*4+1] = src[j+1];
        out[i*4+2] = src[j+2]; out[i*4+3] = 255;
      }
    }
    else if (obj.kind === K.GRAYSCALE_1BPP) {
      // rows are byte-aligned and a set bit is white (pdf.js' packing)
      var rowBytes = (w + 7) >> 3;
      for (var y = 0; y < h; y++){
        for (var x = 0; x < w; x++){
          var v = (src[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0;
          var o = (y * w + x) * 4;
          out[o] = out[o+1] = out[o+2] = v; out[o+3] = 255;
        }
      }
    }
    else return null;
    c.putImageData(id, 0, 0);
    return cv;
  }

  /* Redraw the bitmap through its own CTM into a buffer shaped like its
     on-page box. Going through the transform rather than a plain blit means
     rotation and mirroring land exactly as the page has them, and any stretch
     the PDF itself applies is reproduced — that's the document's design. What
     we never do is add a stretch of our own. */
  function redraw(src, entry, viewport, box){
    var Util = pdfjsLib.Util;
    // don't manufacture pixels the source doesn't have
    var fit = Math.sqrt((src.width * src.height) / Math.max(1, box.w * box.h));
    var k = Math.min(1, fit);
    var w = Math.max(1, Math.round(box.w * k));
    var h = Math.max(1, Math.round(box.h * k));
    if (w * h > 1.6e7) return null;
    var out = document.createElement('canvas');
    out.width = w; out.height = h;
    var c = out.getContext('2d');
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    var m = Util.transform(viewport.transform, entry.ctm);           // unit → page
    m = Util.transform([k, 0, 0, k, -box.x * k, -box.y * k], m);     // page → box
    m = Util.transform(m, [1/src.width, 0, 0, -1/src.height, 0, 1]); // bitmap → unit
    c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    c.drawImage(src, 0, 0);
    return out;
  }

  /* JPEG rings badly around the hard edges in diagrams, charts and
     screenshots, and it has no alpha at all, so a logo on a transparent
     background comes back as a black brick. Sample the result: transparency or
     a small palette means line art, which wants PNG. Everything else is
     photographic, where JPEG is smaller and indistinguishable. */
  function encode(cv){
    var alpha = false, flat = true;
    try {
      var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      var px = cv.width * cv.height;
      var step = Math.max(1, Math.floor(px / 4096)) * 4;
      var seen = {}, n = 0;
      for (var i = 0; i < d.length; i += step){
        if (d[i+3] < 250) { alpha = true; break; }
        var key = (d[i] >> 4) + '|' + (d[i+1] >> 4) + '|' + (d[i+2] >> 4);
        if (!seen[key]) { seen[key] = 1; if (++n > 48) { flat = false; break; } }
      }
      return cv.toDataURL(alpha || flat ? 'image/png' : 'image/jpeg', 0.92);
    } catch (e) { return null; }   // tainted canvas
  }

  /* Neutral (black/gray) text inherits the theme color — otherwise body text
     sampled as black would be invisible on a dark page. Only genuinely
     colored text is preserved, lifted for contrast on dark backgrounds. */
  function normalizeColor(rgb){
    var r = rgb[0], g = rgb[1], b = rgb[2];
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 30) return null;
    if (DARK_BG) {
      var lum = 0.299*r + 0.587*g + 0.114*b;
      if (lum < 110) {
        var f = 110 / Math.max(lum, 1);
        r = Math.min(255, Math.round(r * f));
        g = Math.min(255, Math.round(g * f));
        b = Math.min(255, Math.round(b * f));
      }
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* Dominant non-background color inside a box (used for text color). */
  function sampleColor(ctx, canvas, box){
    try {
      var x = Math.max(0, Math.floor(box.x));
      var y = Math.max(0, Math.floor(box.y));
      var w = Math.min(canvas.width - x, Math.ceil(box.w));
      var h = Math.min(canvas.height - y, Math.ceil(box.h));
      if (w <= 0 || h <= 0) return null;
      var d = ctx.getImageData(x, y, w, h).data;
      var best = null, bestLum = 999;
      for (var i = 0; i < d.length; i += 4){
        if (d[i+3] < 128) continue;
        var lum = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
        if (lum < bestLum) { bestLum = lum; best = [d[i], d[i+1], d[i+2]]; }
      }
      if (!best || bestLum > 210) return null; // nothing drawn / background only
      return normalizeColor(best);
    } catch (e) { return null; }
  }

  /* Group text items into visual lines, tracking each line's horizontal
     extent so a search hit can later be boxed at word precision. */
  function toLines(items){
    var lines = [];
    var cur = null;
    for (var i = 0; i < items.length; i++){
      var it = items[i];
      var str = it.str || '';
      var y = it.transform ? it.transform[5] : 0;
      var x = it.transform ? it.transform[4] : 0;
      var w = it.width || 0;
      var h = it.height || 0;
      // Baseline tolerance scales with the type size. A flat 3 units split
      // superscripts, footnote markers and inline font changes off the line
      // they visually belong to, and each orphan then became its own
      // paragraph — the "one word on a line of its own" symptom.
      var tol = cur ? Math.max(3, Math.min(cur.h, h || cur.h) * 0.55) : 3;
      /* Sharing a baseline is not enough to share a line:

         - A drop cap is set to sit on the baseline of the last line it spans,
           so it lands mid-stream on an ordinary line's baseline. Merged, it
           turned "…in a decade as" into "…in a decade asT" and the cap could
           never be recognised or moved to the front of its paragraph.
         - A fragment lying entirely left of where this line starts belongs to
           another column or block. Rows of a two-column page share baselines,
           and merging them interleaves the two columns' text. */
      var ratio = cur && h && cur.h ? Math.max(cur.h, h) / Math.min(cur.h, h) : 1;
      var joins = cur &&
        Math.abs(y - cur.y) <= tol &&
        ratio < 1.8 &&
        x + w > cur.x0 + 1;
      if (joins) {
        // pdf.js only emits a space character when the font actually draws
        // one; a wide x-jump is a word boundary the stream left implicit.
        var needSpace = str && cur.text &&
          !/\\s$/.test(cur.text) && !/^\\s/.test(str) &&
          x - cur.x1 > Math.max(1, cur.h * 0.2);
        cur.text += (needSpace ? ' ' : '') + str;
        cur.x0 = Math.min(cur.x0, x);
        cur.x1 = Math.max(cur.x1, x + w);
        cur.h = Math.max(cur.h, h);
      }
      else {
        if (cur) lines.push(cur);
        // para is the enclosing structure element in a tagged PDF, taken
        // from the line's first fragment; null when the file isn't tagged.
        cur = {
          y: y, text: str, item: it, x0: x, x1: x + w, h: h || 10,
          para: it._para || null
        };
      }
      // hasEOL ends a line in the content stream, which is not always the
      // end of a visual line — a wrapped run can be chopped mid-line. Trust
      // it only when the next fragment really does sit on another baseline.
      if (it.hasEOL && cur) {
        var nxt = items[i + 1];
        var ny = nxt && nxt.transform ? nxt.transform[5] : null;
        if (ny === null || Math.abs(ny - cur.y) > tol) { lines.push(cur); cur = null; }
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /* ── table detection ───────────────────────────────────────────────
     PDF has no table markup — tables are just positioned text with lines.
     We reverse-engineer them by looking for items that fall into consistent
     vertical columns across multiple rows. */
  function detectTable(items, ops, viewport) {
    if (items.length < 6) return null;

    // Signal 1: does the page draw ruled paths/rectangles at all?
    var hasRuleSignal = false;
    var OPS = pdfjsLib.OPS;
    for (var oi = 0; oi < ops.fnArray.length; oi++) {
      var fn = ops.fnArray[oi];
      var args = ops.argsArray[oi];
      if (fn === OPS.rectangle) { hasRuleSignal = true; break; }
      if (fn === OPS.constructPath && args && args[0] && args[0].length) {
        hasRuleSignal = true;
      }
    }

    var source = [];
    for (var si = 0; si < items.length; si++) if (items[si] && items[si].transform) source.push(items[si]);
    if (source.length < 6) return null;

    // Sort top→bottom in PDF coordinates (higher y first).
    source.sort(function(a, b) { return b.transform[5] - a.transform[5]; });

    // Segment page into vertical bands so headers/footers/body don't pollute one cluster.
    var bandBreak = Math.max(18, viewport.height * 0.045);
    var bands = [];
    var curBand = [source[0]];
    for (var bi = 1; bi < source.length; bi++) {
      var prevY = source[bi - 1].transform[5];
      var y = source[bi].transform[5];
      if (Math.abs(prevY - y) > bandBreak) {
        bands.push(curBand);
        curBand = [source[bi]];
      } else {
        curBand.push(source[bi]);
      }
    }
    if (curBand.length) bands.push(curBand);

    function clusterRows(bandItems, yTol) {
      var rows = [];
      for (var i = 0; i < bandItems.length; i++) {
        var it = bandItems[i];
        var y = it.transform[5];
        var hit = -1;
        for (var r = 0; r < rows.length; r++) {
          if (Math.abs(rows[r].y - y) <= yTol) { hit = r; break; }
        }
        if (hit < 0) {
          rows.push({ y: y, count: 1, items: [it] });
        } else {
          var row = rows[hit];
          var n = row.count;
          row.y = (row.y * n + y) / (n + 1);
          row.count = n + 1;
          row.items.push(it);
        }
      }
      rows.sort(function(a, b) { return b.y - a.y; });
      return rows;
    }

    function evalBand(bandItems) {
      if (bandItems.length < 6) return null;
      var yTol = Math.max(2, viewport.height * 0.0065);
      var rows = clusterRows(bandItems, yTol).filter(function(r) { return r.items.length >= 2; });
      if (rows.length < 3) return null;

      var allXs = [];
      for (var ri = 0; ri < rows.length; ri++) {
        for (var ii = 0; ii < rows[ri].items.length; ii++) {
          var it = rows[ri].items[ii];
          allXs.push({ x: it.transform[4], width: it.width || 0 });
        }
      }
      if (allXs.length < 6) return null;
      allXs.sort(function(a, b) { return a.x - b.x; });

      var xTol = Math.max(4, viewport.width * 0.012);
      var cols = [];
      for (var xi = 0; xi < allXs.length; xi++) {
        var item = allXs[xi];
        var merged = false;
        for (var c = 0; c < cols.length; c++) {
          if (Math.abs(cols[c].x - item.x) <= xTol) {
            var n = cols[c].count;
            cols[c].x = (cols[c].x * n + item.x) / (n + 1);
            cols[c].count = n + 1;
            merged = true;
            break;
          }
        }
        if (!merged) cols.push({ x: item.x, count: 1 });
      }
      if (cols.length < 2 || cols.length > 10) return null;
      cols.sort(function(a, b) { return a.x - b.x; });

      // Column consistency per row.
      var consistentRows = 0;
      for (var rj = 0; rj < rows.length; rj++) {
        var rowXs = rows[rj].items.map(function(it) { return it.transform[4]; });
        var matchedCols = 0;
        for (var cj = 0; cj < cols.length; cj++) {
          for (var rx = 0; rx < rowXs.length; rx++) {
            if (Math.abs(rowXs[rx] - cols[cj].x) <= xTol) { matchedCols++; break; }
          }
        }
        if (matchedCols >= Math.max(2, cols.length * 0.6)) consistentRows++;
      }
      var structure = consistentRows / rows.length;

      // Row-spacing regularity helps reject prose.
      var gaps = [];
      for (var g = 1; g < rows.length; g++) gaps.push(Math.abs(rows[g - 1].y - rows[g].y));
      var regularity = 0;
      if (gaps.length >= 2) {
        var mean = gaps.reduce(function(a, b) { return a + b; }, 0) / gaps.length;
        if (mean > 0) {
          var variance = 0;
          for (var gv = 0; gv < gaps.length; gv++) {
            var d = gaps[gv] - mean;
            variance += d * d;
          }
          variance /= gaps.length;
          var cv = Math.sqrt(variance) / mean;
          regularity = Math.max(0, 1 - Math.min(1, cv));
        }
      }

      var density = Math.min(1, allXs.length / Math.max(1, rows.length * cols.length));
      var score = structure * 0.62 + regularity * 0.23 + density * 0.15 + (hasRuleSignal ? 0.08 : 0);

      // Accept if very table-like, or reasonably table-like with ruling signal.
      if (!(score >= 0.68 || (hasRuleSignal && score >= 0.56 && structure >= 0.45))) return null;

      var grid = [];
      var tableItems = [];
      for (var rk = 0; rk < rows.length; rk++) {
        var row = rows[rk];
        row.items.sort(function(a, b) { return a.transform[4] - b.transform[4]; });
        var rowCells = [];
        var rowUsed = [];
        for (var ck = 0; ck < cols.length; ck++) {
          var colX = cols[ck].x;
          var cellBits = [];
          for (var ik = 0; ik < row.items.length; ik++) {
            var rit = row.items[ik];
            if (Math.abs(rit.transform[4] - colX) <= xTol) {
              var txt = (rit.str || '').trim();
              if (txt) cellBits.push(txt);
              rowUsed.push(rit);
            }
          }
          rowCells.push(cellBits.join(' ').trim());
        }
        var hasContent = rowCells.some(function(c2) { return c2.length > 0; });
        if (hasContent) {
          grid.push(rowCells);
          tableItems = tableItems.concat(rowUsed);
        }
      }

      if (grid.length < 2) return null;
      var header = false;
      if (grid.length > 1) {
        var firstShort = grid[0].every(function(c3) { return c3.length < 36; });
        var secondHasData = grid[1].some(function(c4) { return c4.length >= 8; });
        header = firstShort && secondHasData;
      }
      return { rows: grid, header: header, tableItems: tableItems, score: score };
    }

    var best = null;
    for (var b = 0; b < bands.length; b++) {
      if (bands[b].length < 6) continue;
      var cand = evalBand(bands[b]);
      if (!cand) continue;
      if (!best || cand.score > best.score) best = cand;
    }

    if (!best) return null;
    return { rows: best.rows, header: best.header, tableItems: best.tableItems };
  }

  /* Structure roles that stand for a paragraph of their own in a tagged PDF. */
  var PARA_TAGS = {
    P: 1, H: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
    LI: 1, LBody: 1, Title: 1, Caption: 1, Blockquote: 1
  };

  /* A drop cap is one or two outsized characters opening a paragraph, with the
     next few lines set beside it rather than under it. Left alone it wrecks the
     opening of every chapter twice over: the letter becomes a paragraph of its
     own, and each line tucked beside it starts well right of the margin, so it
     reads as an indent and gets split off too.

     So find the cap, put it back at the head of the paragraph it opens, and
     flag the lines beside it as the cap's own — they are exempt from the indent
     rule, and the run after the cap joins with no space, which is what turns
     "T" + "he lamps" back into "The lamps". */
  function markDropCaps(lines, bodyH){
    if (!bodyH) return lines;

    var caps = [];
    for (var i = 0; i < lines.length; i++){
      var cap = lines[i];
      var txt = (cap.text || '').trim();
      if (!txt || txt.length > 2) continue;
      if (cap.h < bodyH * 1.8) continue;      // a big word, not an initial
      // The cap's baseline sits at the bottom of the lines it spans, so its
      // block runs from its own baseline up by its height.
      var top = cap.y + cap.h;
      var bottom = cap.y - bodyH * 0.25;
      var beside = [];
      for (var j = 0; j < lines.length; j++){
        if (j === i) continue;
        var l = lines[j];
        if (!(l.text || '').trim()) continue;
        if (l.y <= top && l.y >= bottom && l.x0 >= cap.x1 - bodyH * 0.5) {
          beside.push(l);
        }
      }
      if (!beside.length) continue;           // an initial with nothing beside it
      caps.push({ cap: cap, first: beside[0] });
      cap.isCap = true;
      for (var b = 0; b < beside.length; b++) beside[b].besideCap = true;
    }
    if (!caps.length) return lines;

    // Rebuild in reading order: each cap moves from wherever its baseline put
    // it in the stream to immediately before the first line set beside it.
    var out = [];
    for (var n = 0; n < lines.length; n++){
      var ln = lines[n];
      if (ln.isCap) continue;                 // re-inserted below, with its text
      for (var c = 0; c < caps.length; c++){
        if (caps[c].first === ln) out.push(caps[c].cap);
      }
      out.push(ln);
    }
    return out;
  }

  /* Merge lines into the paragraphs the printed page shows, carrying color.

     A vertical gap alone is a weak signal: it fires on every heading and
     figure, and misses the flush paragraph breaks that carry no extra
     leading. So we measure the block first — its body leading and its left
     and right margins — and then read the same cues a person does: a line
     that stops short of the right margin ended its paragraph, and a line
     that starts in from the left margin began one. */
  function toParagraphs(inputLines){
    // Body type size, as the median line height — the yardstick both the drop
    // cap test and the leading fallback are measured against.
    var heights = [];
    for (var hi = 0; hi < inputLines.length; hi++){
      if ((inputLines[hi].text || '').trim()) heights.push(inputLines[hi].h || 10);
    }
    heights.sort(function(a,b){ return a-b; });
    var bodyH = heights.length ? heights[Math.floor(heights.length / 2)] : 0;

    var lines = markDropCaps(inputLines, bodyH);

    // Body leading, as the median of the *tight* gaps. Taking the median of
    // every gap let one heading or figure gap drag the estimate up until real
    // paragraph breaks stopped clearing the threshold.
    var gaps = [];
    for (var j = 1; j < lines.length; j++){
      var g = lines[j-1].y - lines[j].y;
      if (g > 1) gaps.push(g);
    }
    gaps.sort(function(a,b){ return a-b; });
    var median = gaps.length ? gaps[Math.floor(gaps.length/2)] : 0;
    if (gaps.length > 4 && median > 0) {
      var tight = [];
      for (var tg = 0; tg < gaps.length; tg++){
        if (gaps[tg] <= median * 1.25) tight.push(gaps[tg]);
      }
      if (tight.length) median = tight[Math.floor(tight.length/2)];
    }

    // Margins of the *dominant* text block, found by bucketing left edges and
    // taking the most popular one. Page-wide margins are meaningless as soon
    // as a page carries a sidebar, a figure or two columns: the leftmost
    // element sets the left margin and the widest sets the right, and then
    // every line of a narrow column reads as indented and gets split off.
    var real = [];
    for (var m = 0; m < lines.length; m++){
      if ((lines[m].text || '').trim()) real.push(lines[m]);
    }
    var span = 0;
    for (var s1 = 0; s1 < real.length; s1++){
      if (real[s1].x1 > span) span = real[s1].x1;
    }
    var eps = Math.max(6, span * 0.012);

    var block = null;
    for (var a = 0; a < real.length; a++){
      var n = 0, lo = real[a].x0, hi = -Infinity;
      for (var b = 0; b < real.length; b++){
        if (Math.abs(real[b].x0 - real[a].x0) <= eps) {
          n++;
          if (real[b].x0 < lo) lo = real[b].x0;
          if (real[b].x1 > hi) hi = real[b].x1;
        }
      }
      if (!block || n > block.n) block = { n: n, left: lo, right: hi };
    }
    var left = block ? block.left : 0;
    var right = block ? block.right : 0;
    var width = right - left;
    if (!(width > 0)) width = 0;

    // The short-line rule only means something in justified text, where
    // nearly every line reaches the right margin. In ragged-right text line
    // ends vary by design, and trusting them would cut every single line into
    // its own paragraph — the worst version of this bug.
    var flush = 0, counted = 0;
    for (var f = 0; f < real.length; f++){
      if (Math.abs(real[f].x0 - left) > eps) continue;   // block lines only
      counted++;
      if (real[f].x1 >= right - Math.max(6, width * 0.02)) flush++;
    }
    var justified = counted >= 4 && width > 0 && flush / counted >= 0.6;

    var shortBy = Math.max(12, width * 0.12);   // stops short of the margin
    var indentBy = Math.max(6, width * 0.03);   // starts in from the margin

    // Only lines sitting inside the dominant block's horizontal span get the
    // margin cues; anything else (other column, caption, diagram label) falls
    // back to vertical spacing alone.
    function inBlock(l){
      return width > 0 && l.x0 >= left - eps && l.x1 <= right + eps;
    }

    /* When the document tags its own paragraphs, that IS the page flow, and no
       amount of geometry beats reading it straight off the file. Only trusted
       when nearly every line carries a tag, so a half-tagged page doesn't end
       up grouped by two schemes at once. */
    var tagged = 0;
    for (var tt = 0; tt < real.length; tt++){
      if (real[tt].para) tagged++;
    }
    var useTags = real.length >= 3 && tagged / real.length >= 0.9;

    var paras = [];
    var buf = null;
    var prev = null;
    for (var k = 0; k < lines.length; k++){
      var text = (lines[k].text || '').replace(/\\s+/g, ' ').trim();
      if (!text) { if (buf) { paras.push(buf); buf = null; } prev = null; continue; }
      var brk = false;
      if (prev) {
        if (useTags) {
          brk = lines[k].para !== prev.para;
        } else {
          var gap = prev.y - lines[k].y;
          var lead = median > 0 ? median : Math.max(prev.h, lines[k].h, 8) * 1.2;
          if (gap < -lead * 0.35) {
            brk = true;             // jumped back up the page: new column/block
          } else if (gap > lead * 1.55) {
            brk = true;             // blank space opened up between the lines
          } else if (gap > lead * 0.5) {
            /* A genuine next line — only now do the margin cues apply. Without
               that guard, leftover same-baseline fragments (whose x1 is of
               course short) broke paragraphs mid-sentence.

               The indent test is against the previous line rather than the
               page's left margin, which is what makes it survive columns: a
               narrow block sitting to the right of the body still has every
               line at the same x0, so nothing reads as indented. Measured off
               the page margin instead, every line of a sidebar looked like a
               fresh paragraph. */
            if (justified && inBlock(prev) && inBlock(lines[k]) &&
                prev.x1 < right - shortBy) {
              brk = true;
            } else if (!lines[k].besideCap && lines[k].x0 > prev.x0 + indentBy) {
              brk = true;
            }
          }
        }
        // A cap and the lines set beside it are one paragraph by construction:
        // their geometry says otherwise (the cap's baseline is lines below the
        // text it opens), so it must not get a vote here.
        if (prev.isCap) brk = false;
      }
      // The cap itself always opens a paragraph.
      if (lines[k].isCap) brk = true;

      if (brk && buf) { paras.push(buf); buf = null; }
      if (!buf) buf = { y: lines[k].y, y2: lines[k].y, runs: [], geo: [] };
      buf.runs.push({
        text: text,
        color: lines[k].color || null,
        // No space after a drop cap — its letter opens the following word.
        sep: prev && prev.isCap && buf.runs.length ? '' : ' '
      });
      // one geometry record per run: the source line's box in page space
      buf.geo.push({ x0: lines[k].x0, x1: lines[k].x1, y: lines[k].y, h: lines[k].h || 10 });
      buf.y2 = lines[k].y;   // last line — bottom of the paragraph
      prev = lines[k];
    }
    if (buf) paras.push(buf);
    return paras;
  }

  /* Each run carries the separator that goes in front of it — a single space
     between ordinary lines, but empty after a drop cap, whose letter is the
     first character of the word it opens rather than a word of its own. The
     data-geom offsets in processPage are walked the same way, so a search hit
     or a highlight still maps back to the line it came from. */
  function runsText(runs){
    var out = '';
    for (var i = 0; i < runs.length; i++){
      out += (i ? runs[i].sep : '') + runs[i].text;
    }
    return out;
  }

  function paragraphEl(para){
    var p = document.createElement('p');
    var uniform = true;
    for (var i = 1; i < para.runs.length; i++){
      if (para.runs[i].color !== para.runs[0].color) { uniform = false; break; }
    }
    if (uniform) {
      if (para.runs[0].color) p.style.color = para.runs[0].color;
      p.textContent = runsText(para.runs);
    } else {
      for (var j = 0; j < para.runs.length; j++){
        var span = document.createElement('span');
        if (para.runs[j].color) span.style.color = para.runs[j].color;
        span.textContent = (j ? para.runs[j].sep : '') + para.runs[j].text;
        p.appendChild(span);
      }
    }
    return p;
  }

  async function processPage(pdf, pageNo, content){
    var page = await pdf.getPage(pageNo);
    // All geometry stays in 1x page space; only the raster gets scaled up.
    var viewport = page.getViewport({ scale: 1 });
    var ops = await page.getOperatorList();
    var info = scanOps(ops);

    // Only rasterize when we actually need pixels (images or colored text),
    // and only pay for device density when there are figures to keep sharp.
    var imgScale = info.images.length ? IMG_SCALE : 1;
    var rv = page.getViewport({ scale: imgScale });
    var canvas = null, ctx = null;
    if (info.images.length || info.hasColor) {
      canvas = document.createElement('canvas');
      canvas.width = Math.ceil(rv.width);
      canvas.height = Math.ceil(rv.height);
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      await page.render({ canvasContext: ctx, viewport: rv }).promise;
    }

    /* Marked content is asked for so a tagged PDF can be grouped by its own
       structure rather than by geometry. It interleaves begin/end markers with
       the text items, so they are unwound here and every text item comes out
       carrying the paragraph element it belongs to; everything downstream sees
       the same plain item list it always did. */
    var tc = await page.getTextContent({ includeMarkedContent: true });
    var items = [];
    var markStack = [], paraSeq = 0, curPara = 0;
    for (var mi = 0; mi < tc.items.length; mi++){
      var raw = tc.items[mi];
      var ty = raw.type;
      if (ty === 'beginMarkedContent' || ty === 'beginMarkedContentProps') {
        markStack.push(curPara);
        if (PARA_TAGS[raw.tag]) { paraSeq++; curPara = paraSeq; }
        continue;
      }
      if (ty === 'endMarkedContent') {
        curPara = markStack.length ? markStack.pop() : 0;
        continue;
      }
      raw._para = curPara || null;
      items.push(raw);
    }

    // ── try tables first ──────────────────────────────────────────
    // Pass the operator list so we can detect ruling lines
    var tableInfo = detectTable(items, ops, viewport);
    var tableEl = null;
    var tableItemIds = new Set(); // Use a set for O(1) lookup

    if (tableInfo && tableInfo.rows.length >= 2) {
      tableEl = document.createElement('table');
      tableEl.style.cssText =
        'width:100%;border-collapse:collapse;margin:1.2em 0;font-size:var(--fs);line-height:var(--lh);color:var(--fg);table-layout:fixed;';
      for (var trIdx = 0; trIdx < tableInfo.rows.length; trIdx++) {
        var tr = document.createElement('tr');
        var isHeader = tableInfo.header && trIdx === 0;
        for (var tdIdx = 0; tdIdx < tableInfo.rows[trIdx].length; tdIdx++) {
          var td = document.createElement(isHeader ? 'th' : 'td');
          td.textContent = tableInfo.rows[trIdx][tdIdx];
          td.style.cssText =
            'border:1px solid var(--faint);padding:5px 8px;text-align:left;vertical-align:top;overflow-wrap:break-word;word-break:break-word;';
          if (isHeader) td.style.fontWeight = '600';
          // Distribute columns somewhat evenly
          td.style.width = 100 / tableInfo.rows[trIdx].length + '%';
          tr.appendChild(td);
        }
        tableEl.appendChild(tr);
      }

      // Mark table items for exclusion
      for (var ti = 0; ti < tableInfo.tableItems.length; ti++) {
        // Use object reference or create a weak key
        // Since we can't use WeakSet easily, filter by checking if item
        // is in the tableItemSet by reference
        tableItemIds.add(tableInfo.tableItems[ti]);
      }
    }

    // Filter: exclude items that are in the table set
    // We use a simple approach: check if item's y matches a table row
    // AND x matches a table column
    var nonTableItems = items;
    if (tableInfo && tableInfo.tableItems.length > 0) {
      var tableYs = [];
      var tableXs = [];
      var tTol = Math.max(3, viewport.height * 0.008);
      var xTol2 = Math.max(4, viewport.width * 0.015);

      // Get unique row Ys and col Xs from table items
      for (var tj = 0; tj < tableInfo.tableItems.length; tj++) {
        var ty = tableInfo.tableItems[tj].transform[5];
        var tx = tableInfo.tableItems[tj].transform[4];
        var hasY = false, hasX = false;
        for (var yy = 0; yy < tableYs.length; yy++) {
          if (Math.abs(tableYs[yy] - ty) < tTol) {
            hasY = true;
            break;
          }
        }
        for (var xx = 0; xx < tableXs.length; xx++) {
          if (Math.abs(tableXs[xx] - tx) < xTol2) {
            hasX = true;
            break;
          }
        }
        if (!hasY) tableYs.push(ty);
        if (!hasX) tableXs.push(tx);
      }

      nonTableItems = items.filter(function(it) {
        if (!it.transform) return true;
        if (tableItemIds.has(it)) return false;
        var iy = it.transform[5];
        var ix = it.transform[4];
        var inTableY = false;
        for (var vy = 0; vy < tableYs.length; vy++) {
          if (Math.abs(tableYs[vy] - iy) < tTol) {
            inTableY = true;
            break;
          }
        }
        if (!inTableY) return true;
        var inTableX = false;
        for (var vx = 0; vx < tableXs.length; vx++) {
          if (Math.abs(tableXs[vx] - ix) < xTol2) {
            inTableX = true;
            break;
          }
        }
        return !inTableX; // keep if not in table x-range
      });
    }

    var lines = toLines(nonTableItems);

    // sample one color per line from the rendered page
    if (ctx) {
      for (var i = 0; i < lines.length; i++){
        var it = lines[i].item;
        if (!it || !it.transform) continue;
        var pt = pdfjsLib.Util.applyTransform([it.transform[4], it.transform[5]], rv.transform);
        var hgt = Math.max(4, (it.height || 10) * imgScale);
        var wid = Math.max(4, (it.width || 40) * imgScale);
        lines[i].color = sampleColor(ctx, canvas, { x: pt[0], y: pt[1] - hgt, w: wid, h: hgt });
      }
    }

    var paras = toParagraphs(lines);

    // lift the figures off the page
    var imgs = [];
    if (ctx && info.images.length) {
      var textLen = 0;
      for (var t = 0; t < lines.length; t++) textLen += (lines[t].text || '').length;
      var pageArea = rv.width * rv.height;
      var boxes = mergeBoxes(info.images, rv);

      for (var m = 0; m < boxes.length; m++){
        var box = boxes[m];
        var minSide = 24 * imgScale;
        if (box.w < minSide || box.h < minSide) continue;  // rules, bullets
        // extreme aspect ratios are borders and dividers, not figures
        var aspect = box.w / box.h;
        if (aspect > 25 || aspect < 0.04) continue;
        // A page-sized image sitting behind real text is a scan backdrop or a
        // watermark. Emitting it would stack a picture of the whole page on
        // top of that same page's text.
        if (box.w * box.h > pageArea * 0.8 && textLen > 200) continue;

        var out = null;
        // Preferred path: the image's own bitmap, redrawn under its own CTM.
        // Cropping the composited page cost us two things — the figure came
        // out at page-raster density, and whatever the page drew over it
        // (captions, rules, watermarks) came along for the ride.
        if (box.parts.length === 1) {
          var native = toCanvas(imageSource(pdf, page, box.parts[0].name));
          if (native) out = redraw(native, box.parts[0], rv, box);
        }
        if (!out) {
          // Inline images, soft-masked art, merged strips: crop the raster.
          var sx = Math.max(0, Math.floor(box.x));
          var sy = Math.max(0, Math.floor(box.y));
          var sw = Math.min(canvas.width - sx, Math.ceil(box.w));
          var sh = Math.min(canvas.height - sy, Math.ceil(box.h));
          if (sw <= 0 || sh <= 0) continue;
          out = document.createElement('canvas');
          out.width = sw; out.height = sh;
          out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        }

        var data = encode(out);
        if (!data) continue;
        // Display size is the figure's size on the page, in CSS pixels — the
        // extra pixels live in the backing store, where they belong. Sizing
        // from the bitmap instead would blow a high-res icon up to a banner.
        imgs.push({
          top: box.y / imgScale,
          src: data,
          w: Math.max(1, Math.round(box.w / imgScale)),
          h: Math.max(1, Math.round(box.h / imgScale))
        });
      }
    }
    if (canvas) { canvas.width = 0; canvas.height = 0; }  // release early

    // merge text + images in visual order (device y, top-down)
    var blocks = [];
    for (var a = 0; a < paras.length; a++){
      var pt2 = pdfjsLib.Util.applyTransform([0, paras[a].y], viewport.transform);
      var pb = pdfjsLib.Util.applyTransform([0, paras[a].y2], viewport.transform);
      blocks.push({ top: pt2[1], bottom: pb[1], kind: 'p', data: paras[a] });
    }
    for (var b = 0; b < imgs.length; b++){
      blocks.push({ top: imgs[b].top, kind: 'img', data: imgs[b] });
    }
    blocks.sort(function(x, y){ return x.top - y.top; });

    var section = document.createElement('section');
    section.setAttribute('data-page', String(pageNo));

    // If we detected a table, prepend it before the text blocks
    if (tableEl) section.appendChild(tableEl);

    for (var q = 0; q < blocks.length; q++){
      if (blocks[q].kind === 'p') {
        var pEl = paragraphEl(blocks[q].data);
        // Normalized page-space span, kept for Page view's locator band.
        // top is the first baseline, so back up ~a line height to cover it.
        pEl.setAttribute('data-ny0',
          (Math.max(0, blocks[q].top - 13) / viewport.height).toFixed(4));
        pEl.setAttribute('data-ny1',
          (Math.min(viewport.height, blocks[q].bottom + 5) / viewport.height).toFixed(4));
        // Per-line boxes keyed by character offset into textContent (runs
        // join with single spaces), so a hit can be boxed at word precision.
        var d2 = blocks[q].data;
        var off = 0, geo = [];
        for (var g = 0; g < d2.runs.length; g++){
          if (g) off += d2.runs[g].sep.length;   // matches runsText exactly
          var len = d2.runs[g].text.length;
          var gl = d2.geo && d2.geo[g];
          if (gl && len) {
            var g0 = pdfjsLib.Util.applyTransform([gl.x0, gl.y], viewport.transform);
            var g1 = pdfjsLib.Util.applyTransform([gl.x1, gl.y], viewport.transform);
            var gh = Math.max(6, gl.h);   // 1x page space, same as viewport
            geo.push({
              o: off, l: len,
              x0: +(g0[0] / viewport.width).toFixed(4),
              x1: +(g1[0] / viewport.width).toFixed(4),
              y0: +((g0[1] - gh) / viewport.height).toFixed(4),
              y1: +((g0[1] + gh * 0.28) / viewport.height).toFixed(4)
            });
          }
          off += len;
        }
        pEl.setAttribute('data-geom', JSON.stringify(geo));
        section.appendChild(pEl);
      }
      else {
        var im = document.createElement('img');
        im.src = blocks[q].data.src;
        // inline width, so nothing in the sheet can quietly outrank it
        im.style.width = blocks[q].data.w + 'px';
        im.setAttribute('width', blocks[q].data.w);
        im.setAttribute('height', blocks[q].data.h);
        im.decoding = 'async';
        section.appendChild(im);
      }
    }
    content.appendChild(section);
    page.cleanup();
    return items.map(function(item){ return item.str || ''; }).join(' ').trim().split(/\s+/).filter(Boolean).length;
  }

  /* ---- outline ----
     Preferred source is the PDF's embedded outline (real destinations, so
     page numbers are exact). Failing that — most PDFs have none — look for a
     printed "Contents" page among the opening pages and parse its rows. */
  async function embeddedOutline(pdf){
    var out = [];
    var ol = await pdf.getOutline();
    if (!ol || !ol.length) return out;
    async function walk(items, level){
      for (var i = 0; i < items.length; i++){
        var it = items[i];
        var title = (it.title || '').replace(/\\s+/g, ' ').trim();
        var pageNo = null;
        try {
          var dest = it.dest;
          if (typeof dest === 'string') dest = await pdf.getDestination(dest);
          if (dest && dest[0]) pageNo = (await pdf.getPageIndex(dest[0])) + 1;
        } catch (e) { /* unresolvable destination — skip the row */ }
        if (title && pageNo) out.push({ title: title, page: pageNo, level: level });
        // one level of nesting is plenty for a reading drawer
        if (it.items && it.items.length && level < 1) await walk(it.items, level + 1);
      }
    }
    await walk(ol, 0);
    return out;
  }

  /* Rows look like "Chapter 1  Fire and Tallow ......... 3" — title, then a
     leader of dots/spaces, then the printed page number. */
  function parseContentsRows(texts, startIdx){
    var rows = [];
    for (var j = startIdx; j < texts.length; j++){
      var line = texts[j];
      if (!line || line.length > 120) continue;
      var m = line.match(/^(.*?)[\\s.·—–-]{2,}(\\d{1,4})$/) ||
              line.match(/^(.+?)\\s+(\\d{1,4})$/);
      if (!m) continue;
      var title = m[1].replace(/[.\\s·—–-]+$/, '').trim();
      var num = parseInt(m[2], 10);
      if (!title || title.length < 2 || !num) continue;
      if (/^(page|contents)$/i.test(title)) continue;
      rows.push({ title: title, page: num, level: 0 });
    }
    return rows;
  }

  /* Note: no page.cleanup() in here. This runs concurrently with the main
     extraction loop, which holds the same page proxies — cleaning up under
     it would discard a render it's still using. It cleans up its own pages. */
  async function printedOutline(pdf){
    var limit = Math.min(pdf.numPages, 12);
    for (var p = 1; p <= limit; p++){
      var pg = await pdf.getPage(p);
      var tc = await pg.getTextContent();
      var texts = toLines(tc.items).map(function(l){
        return (l.text || '').replace(/\\s+/g, ' ').trim();
      });
      var headIdx = -1;
      for (var i = 0; i < Math.min(texts.length, 8); i++){
        if (/^(table of contents|contents)$/i.test(texts[i])) { headIdx = i; break; }
      }
      if (headIdx < 0) continue;

      var rows = parseContentsRows(texts, headIdx + 1);
      // a contents list can run onto the next page or two
      for (var k = p + 1; k <= Math.min(pdf.numPages, p + 2); k++){
        var pg2 = await pdf.getPage(k);
        var tc2 = await pg2.getTextContent();
        var texts2 = toLines(tc2.items).map(function(l){
          return (l.text || '').replace(/\\s+/g, ' ').trim();
        });
        var more = parseContentsRows(texts2, 0);
        if (more.length < 2) break;   // no longer a contents list
        rows = rows.concat(more);
      }
      if (rows.length >= 2) return rows;
    }
    return [];
  }

  async function buildOutline(pdf){
    var entries = [], source = 'embedded';
    try { entries = await embeddedOutline(pdf); } catch (e) { entries = []; }
    if (!entries.length) {
      source = 'printed';
      try { entries = await printedOutline(pdf); } catch (e) { entries = []; }
      // Printed numbers are the book's own, which front matter can offset
      // from the PDF's page order — drop anything out of range and keep the
      // list monotonic so taps never jump backwards.
      var clean = [], last = 0;
      for (var i = 0; i < entries.length; i++){
        var e = entries[i];
        if (e.page < 1 || e.page > pdf.numPages || e.page < last) continue;
        last = e.page;
        clean.push(e);
      }
      entries = clean;
    }
    if (entries.length) post({ type: 'outline', entries: entries, source: source });
    return entries;   // also baked into the cache, so a cached open has it too
  }

  function run(){
    if (typeof pdfjsLib === 'undefined') {
      document.getElementById('status').textContent = 'Reflow needs a connection the first time.';
      post({ type: 'error', message: 'pdfjs failed to load' });
      return;
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_BASE}/pdf.worker.min.js';
    var content = document.getElementById('content');
    var firstPaint = false;
    // Opening straight to a deep page (from My Notes / Recents): hold the reveal
    // until that page has been extracted and scrolled into view, so the reader
    // never sees page 1 first and then a jump. reveal() scrolls first, THEN
    // uncovers, so what appears is already in place — no flicker.
    var needTarget = INITIAL_PAGE > 1;

    // pdf is passed in because reveal is defined outside the getDocument().then
    // callback, so it cannot close over that callback's parameter.
    function reveal(pdf){
      if (firstPaint) return;
      firstPaint = true;
      tryPendingScroll();
      document.getElementById('status').className = 'hidden';
      post({ type: 'firstpaint' });
      buildOutline(pdf); // not awaited — the outline arrives as pages extract
    }

    pdfjsLib.getDocument({ data: b64ToBytes('${b64}') }).promise.then(async function(pdf){
      // pdf.js, its worker and the document all loaded — tell the native side
      // so its boot watchdog stands down and only genuine load failures (this
      // message never arriving) surface as an error.
      post({ type: 'booting', pages: pdf.numPages });
      var wordCounts = [];
      if (INITIAL_PAGE > 1) pendingScroll = INITIAL_PAGE;
      for (var p = 1; p <= pdf.numPages; p++){
        try { wordCounts[p - 1] = await processPage(pdf, p, content); }
        catch (e) { /* skip unreadable page */ }
        if (!firstPaint && content.childNodes.length) {
          // Reveal at once when we're opening at the top; otherwise wait for the
          // target page's section to exist so we can land on it directly.
          if (!needTarget || document.querySelector('section[data-page="' + INITIAL_PAGE + '"]')) {
            reveal(pdf);
          }
        }
        post({ type: 'progress', page: p, total: pdf.numPages });
        // The page this landed on may be the one being waited for, and may
        // carry highlights that had nowhere to attach until now. Both are
        // no-ops once satisfied, so they're cheap to keep trying.
        tryPendingScroll();
        if (pendingHighlights) window.applyHighlights();
        /* Hand the thread back between pages. Extraction and everything the
           reader injects — a new highlight, a page jump, a settings change —
           share one JS thread in here, so without a yield a command posted
           mid-run waits behind however long the current page takes. That wait
           is what made highlighting a big book feel unresponsive. */
        await new Promise(function(resolve){ setTimeout(resolve, 0); });
      }
      // Target never materialised (e.g. a page past the end) — reveal anyway
      // rather than holding the loading state forever.
      reveal(pdf);
      post({ type: 'done', pages: pdf.numPages, wordCounts: wordCounts });
      tryPendingScroll();
    }).catch(function(err){
      document.getElementById('status').textContent = 'Could not extract text from this PDF.';
      post({ type: 'error', message: String(err && err.message || err) });
    });
  }

  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run);
</script>
</body>
</html>`;
}

/** Placeholder paragraph shapes, cycled to fill the screen while extracting. */
const SKELETON_PARAGRAPHS: number[][] = [
  [98, 100, 94, 72],
  [100, 90, 97, 100, 64],
  [95, 100, 82],
  [100, 96, 100, 88, 70],
  [92, 100, 100, 60],
  [100, 85, 98, 100, 76],
];

/**
 * A full-screen reading skeleton shown while the document is being extracted —
 * paragraph bars filling the whole reading column (not just the top), pulsing
 * softly. The bottom progress bar tracks real extraction alongside it.
 */
function ReflowSkeleton({ topInset }: { topInset: number }) {
  const t = useProtoTheme();
  const [pulse] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Repeat the templates enough to overflow any screen; overflow is clipped so
  // the placeholder reads as a full page of text rather than a few lines up top.
  const paras = Array.from(
    { length: 14 },
    (_, i) => SKELETON_PARAGRAPHS[i % SKELETON_PARAGRAPHS.length],
  );

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: pulse,
        overflow: "hidden",
        paddingTop: topInset + 24,
        paddingHorizontal: 22,
      }}
    >
      {paras.map((para, pi) => (
        <Box gap={11} key={pi} style={{ marginBottom: 26 }}>
          {para.map((w, li) => (
            <Box
              bg={t.chip}
              height={13}
              key={li}
              rounded={4}
              style={{ width: `${w}%` }}
            />
          ))}
        </Box>
      ))}
    </Animated.View>
  );
}

interface Props {
  uri: string;
  /** Page to scroll to on first load (keeps position across mode switches). */
  initialPage?: number;
  /** Bumped by the parent to re-scroll an already-loaded document. */
  gotoPage?: { page: number; seq: number };
  /** Safe-area top padding, since the toolbar floats over the content. */
  topInset?: number;
  /** Extra top space for the visible toolbar; 0 in distraction-free mode. */
  chromeOffset?: number;
  /** Query string to search; results returned via onSearchResults. */
  searchQuery?: string;
  /**
   * Match to mark and scroll to. `index` is the hit's position in the last
   * result list; `seq` is bumped to re-mark the same hit again. `page` scopes
   * the mark to one page (a flash from My Notes), so it lands on the tapped
   * occurrence rather than an earlier one elsewhere in the book.
   */
  highlight?: { query: string; index: number; seq: number; page?: number };
  /** Dim everything but the block under the reading line (focus mode). */
  focusMode?: boolean;
  onPageChange?: (page: number) => void;
  onSearchResults?: (results: PdfSearchResult[]) => void;
  onSingleTap?: () => void;
  /** Text selected in the reflowed page, '' when cleared. */
  onSelection?: (text: string, page: number) => void;
  /** Bump to drop the page's own selection; seq-based like `gotoPage`. */
  clearSelectionSeq?: number;
  /** Saved highlights to paint into the text. */
  highlights?: { id: string; page: number; text: string; color: string }[];
  /** A saved highlight was tapped in the page. */
  onHighlightPress?: (id: string) => void;
  /** Fires once every page has been extracted — search is then complete. */
  onIndexed?: () => void;
  /** The document's outline, embedded or parsed off a contents page. */
  onOutline?: (entries: PdfOutlineEntry[]) => void;
  /** Word counts extracted per PDF page, used for time-based progress. */
  onWordCounts?: (counts: number[]) => void;
  /**
   * The document's text, batched, once extraction has finished — for
   * `POST /ai/context`, so Liqrai can answer from the book and not just the page
   * in view. `done` marks the final batch. Omit the prop and nothing is walked.
   */
  onContext?: (pages: { page: number; text: string }[], done: boolean) => void;
  /** Lets the reader drop to Page view from the reflow error screen. */
  onSwitchToPage?: () => void;
}

/**
 * The reader's typography and theme, in the shape the page wants them. Shared
 * with the background preloader so a warmed document is extracted under exactly
 * the settings the reader would have used itself.
 */
export function useReflowSettings(): Settings {
  const t = useProtoTheme();
  const textSize = useAppStore((s) => s.textSize);
  const zoom = useAppStore((s) => s.zoom);
  const lineSp = useAppStore((s) => s.lineSp);
  const fontFam = useAppStore((s) => s.fontFam);
  const readWidth = useAppStore((s) => s.readWidth);
  const contrast = useAppStore((s) => s.contrast);

  return useMemo(
    () => ({
      baseFs: textSize,
      zoomedFs: Math.round((textSize * zoom) / 100),
      lh: LINE_SPACING[lineSp] ?? 1.75,
      fontFamily: fontStack(fontFam),
      fg: contrast === "soft" ? softInk(t.readerInk, t.page, 0.16) : t.readerInk,
      bg: t.page,
      faint: t.faint,
      hl: t.hl,
      px: READ_WIDTH_PX[readWidth] ?? READ_WIDTH_PX.comfort,
    }),
    [
      textSize,
      zoom,
      lineSp,
      fontFam,
      readWidth,
      contrast,
      t.readerInk,
      t.page,
      t.faint,
      t.hl,
    ],
  );
}

// The removed reflow cache (2026-07) left its entries under Paths.cache/reflow
// — up to ~96MB of dead files nothing reads anymore. Swept once per app run,
// from here because this is the only module that knew the directory existed.
let sweptDeadCacheDir = false;
function sweepDeadCacheDir() {
  if (sweptDeadCacheDir) return;
  sweptDeadCacheDir = true;
  try {
    const dir = new Directory(Paths.cache, "reflow");
    if (dir.exists) dir.delete();
  } catch {
    // best effort — the OS reclaims cache storage eventually anyway
  }
}

export function PdfReflowView({
  uri,
  initialPage = 1,
  gotoPage,
  topInset = 0,
  chromeOffset = 0,
  searchQuery,
  highlight,
  focusMode = false,
  clearSelectionSeq = 0,
  highlights,
  onHighlightPress,
  onPageChange,
  onSearchResults,
  onSelection,
  onSingleTap,
  onIndexed,
  onOutline,
  onWordCounts,
  onContext,
  onSwitchToPage,
}: Props) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("reading");
  // Extraction progress, shown as a thin bar along the bottom edge (like the
  // web reader) instead of a full-screen skeleton. `extracting` stays true from
  // open until the whole document is walked, so the bar tracks background
  // extraction that continues after the first page is on screen.
  const [extracting, setExtracting] = useState(true);
  const barWidth = useRef(new Animated.Value(0.04)).current;
  // Cleared the moment the WebView posts anything back — even "extracting page
  // 1". If it stays armed, pdf.js (or its worker, fetched from a CDN) never
  // loaded, which is what left the skeleton spinning forever with no error. We
  // surface the recoverable error instead of hanging. Extraction being merely
  // slow can't trip this: the first `progress`/`firstpaint` message disarms it.
  const bootTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gotFirstMessage = useRef(false);
  // Bumped when extraction finishes, so highlights get a second pass once
  // every page is in the DOM.
  const [extractedSeq, setExtractedSeq] = useState(0);

  const settings = useReflowSettings();

  // Latest values, read only inside effects — so building the page once
  // doesn't re-run when a setting changes (those are pushed live instead).
  const settingsRef = useRef<Settings>(settings);
  const initialPageRef = useRef<number>(initialPage);
  const topInsetRef = useRef<number>(topInset);
  useEffect(() => {
    settingsRef.current = settings;
    initialPageRef.current = initialPage;
    topInsetRef.current = topInset;
  }, [settings, initialPage, topInset]);

  // Read the file and build the page once per document. The reflow cache that
  // used to sit in front of this was removed: it truncated books on Android's
  // bridge and then served blank pages from disk — extraction is the slow but
  // correct path, every open.
  useEffect(() => {
    let cancelled = false;
    gotFirstMessage.current = false;
    sweepDeadCacheDir();
    (async () => {
      try {
        const data = await new File(uri).base64();
        if (cancelled) return;
        setHtml(
          buildHtml(
            data,
            settingsRef.current,
            initialPageRef.current,
            topInsetRef.current,
          ),
        );
        setStatus("extracting");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  // Watchdog: once the page is built, the WebView should report back within
  // seconds (extracting page 1). Silence past the timeout means pdf.js never
  // came up — almost always no network to fetch it on first open. Show the
  // error rather than an endless skeleton. Reset per document.
  useEffect(() => {
    if (!html) return;
    if (bootTimer.current) clearTimeout(bootTimer.current);
    bootTimer.current = setTimeout(() => {
      if (!gotFirstMessage.current) setStatus("error");
    }, 25000);
    return () => {
      if (bootTimer.current) clearTimeout(bootTimer.current);
    };
  }, [html]);

  // push settings updates into the live page without re-extracting
  useEffect(() => {
    if (status !== "ready") return;
    webRef.current?.injectJavaScript(
      `window.applySettings && window.applySettings(${JSON.stringify(settings)}); true;`,
    );
  }, [settings, status]);

  // Keep the WebView's spacer in sync with the native chrome animation.
  // CSS interpolates its height, so reflow text glides rather than jumping.
  useEffect(() => {
    if (status !== "ready") return;
    webRef.current?.injectJavaScript(
      `window.setChromeOffset && window.setChromeOffset(${chromeOffset}); true;`,
    );
  }, [chromeOffset, status]);

  // re-scroll when the parent switches back into reflow
  useEffect(() => {
    if (status !== "ready" || !gotoPage) return;
    webRef.current?.injectJavaScript(
      `window.scrollToPage && window.scrollToPage(${gotoPage.page}); true;`,
    );
  }, [gotoPage, status]);

  // Search the extracted text when the query changes. `indexSeq` re-runs the
  // same query as more pages land, so a search started mid-extraction keeps
  // picking up matches instead of freezing on the first few pages.
  const [indexSeq, setIndexSeq] = useState(0);
  const queryRef = useRef<string>("");
  useEffect(() => {
    if (status !== "ready") return;
    const q = searchQuery?.trim() ?? "";
    queryRef.current = q;
    if (!q) {
      onSearchResults?.([]);
      return;
    }
    // a new query invalidates whatever hit is currently marked
    webRef.current?.injectJavaScript(
      `window.clearHighlight && window.clearHighlight();` +
        `window.searchText && window.searchText(${JSON.stringify(q)}); true;`,
    );
    // onSearchResults is a stable setter from useState — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, status, indexSeq]);

  /**
   * Repaint saved highlights whenever they change, and again once extraction
   * finishes — pages arrive progressively, so a highlight on a later page has
   * nothing to attach to on the first pass.
   */
  useEffect(() => {
    if (status !== "ready") return;
    webRef.current?.injectJavaScript(
      `window.applyHighlights && window.applyHighlights(${JSON.stringify(
        highlights ?? [],
      )}); true;`,
    );
  }, [highlights, status, extractedSeq]);

  // Drop the selection when the reader dismisses the annotate bar, so the
  // handles go away and a stale selection can't re-open it.
  useEffect(() => {
    if (status !== "ready" || !clearSelectionSeq) return;
    webRef.current?.injectJavaScript(
      `window.clearTextSelection && window.clearTextSelection(); true;`,
    );
  }, [clearSelectionSeq, status]);

  // toggle the focus-mode spotlight in the live page
  useEffect(() => {
    if (status !== "ready") return;
    webRef.current?.injectJavaScript(
      `window.setFocusMode && window.setFocusMode(${focusMode ? "true" : "false"}); true;`,
    );
  }, [focusMode, status]);

  // Mark and scroll to the tapped result / flashed passage. Fires ONLY when a
  // new highlight is requested (or on first ready) — deliberately not tied to
  // extraction progress: re-running it when background extraction finished was
  // yanking the reader back to an old target after they'd scrolled away. The
  // target page is already in the DOM by the time this runs, because Reflow
  // holds its reveal until that page is extracted.
  useEffect(() => {
    if (status !== "ready" || !highlight?.query) return;
    webRef.current?.injectJavaScript(
      `window.highlightMatch && window.highlightMatch(${JSON.stringify(
        highlight.query,
      )}, ${highlight.index}, ${highlight.page ?? 0}); true;`,
    );
  }, [highlight, status]);

  if (status === "error") {
    return (
      <Box
        align="center"
        bg={t.page}
        flex={1}
        gap={8}
        justify="center"
        paddingX={32}
      >
        <Text align="center" size={15} weight="600">
          Couldn&apos;t reflow this document
        </Text>
        <Text align="center" color={t.sub} lh={20} size={13}>
          Reflow needs a connection the first time it opens a document. If
          you&apos;re online, this may be a scanned/image-only PDF with no text
          layer.
        </Text>
        {onSwitchToPage ? (
          <Tap onPress={onSwitchToPage} scale={0.97} style={{ marginTop: 8 }}>
            <Box align="center" bg={t.accent} paddingX={22} paddingY={12} rounded={12}>
              <Text color={t.onAccent} size={14} weight="600">
                Switch to Page view
              </Text>
            </Box>
          </Tap>
        ) : null}
      </Box>
    );
  }

  return (
    <Box bg={t.page} flex={1}>
      {html ? (
        <WebView
          allowFileAccess
          androidLayerType="hardware"
          // Replace the system text-selection menu with just Copy and Select
          // all — supplying our own list is what drops Android's injected
          // "Translate" (and "Web search") item the reader didn't want. Both
          // are re-implemented with document.execCommand so no clipboard module
          // is needed; the app's own AnnotateBar still handles translate.
          menuItems={[
            { key: "lexiCopy", label: "Copy" },
            { key: "lexiSelectAll", label: "Select all" },
          ]}
          onCustomMenuSelection={(e) => {
            const key = e.nativeEvent.key;
            if (key === "lexiCopy") {
              webRef.current?.injectJavaScript(
                `try{document.execCommand('copy');}catch(e){} true;`,
              );
            } else if (key === "lexiSelectAll") {
              webRef.current?.injectJavaScript(
                `try{document.execCommand('selectAll');}catch(e){} true;`,
              );
            }
          }}
          onMessage={(e) => {
            // Any message means pdf.js is alive — disarm the boot watchdog.
            if (!gotFirstMessage.current) {
              gotFirstMessage.current = true;
              if (bootTimer.current) clearTimeout(bootTimer.current);
            }
            try {
              const msg = JSON.parse(e.nativeEvent.data) as {
                type: string;
                id?: string;
                page?: number;
                total?: number;
                text?: string;
                results?: PdfSearchResult[];
                entries?: PdfOutlineEntry[];
                wordCounts?: number[];
                pages?: { page: number; text: string }[];
                done?: boolean;
              };
              if (msg.type === "firstpaint") setStatus("ready");
              else if (msg.type === "page" && msg.page)
                onPageChange?.(msg.page);
              else if (msg.type === "highlighttap")
                onHighlightPress?.(msg.id ?? "");
              else if (msg.type === "selection")
                onSelection?.(msg.text ?? "", msg.page ?? 0);
              else if (msg.type === "tap") onSingleTap?.();
              else if (msg.type === "error") {
                setStatus("error");
                setExtracting(false);
              } else if (msg.type === "searchresults")
                onSearchResults?.(msg.results ?? []);
              else if (msg.type === "outline" && msg.entries?.length)
                onOutline?.(msg.entries);
              else if (msg.type === "context")
                onContext?.(msg.pages ?? [], msg.done ?? false);
              else if (msg.type === "done") {
                onIndexed?.();
                onWordCounts?.(msg.wordCounts ?? []);
                // Only walked when someone is listening — the text is only
                // wanted for the AI upload, and it isn't free to serialise.
                if (onContext) {
                  webRef.current?.injectJavaScript(
                    `window.sendContext(${CONTEXT_CHUNK_PAGES}); true;`,
                  );
                }
                // fill the bar, then retire it once extraction is complete
                Animated.timing(barWidth, {
                  toValue: 1,
                  duration: 180,
                  useNativeDriver: false,
                }).start(() => setExtracting(false));
                // every page exists now, so highlights on later ones can land
                setExtractedSeq((n) => n + 1);
                if (queryRef.current) setIndexSeq((n) => n + 1);
              } else if (msg.type === "progress") {
                if (msg.total) {
                  Animated.timing(barWidth, {
                    toValue: Math.max(0.04, (msg.page ?? 0) / msg.total),
                    duration: 180,
                    useNativeDriver: false,
                  }).start();
                }
                // refresh an in-flight search every few pages, not every page
                if (queryRef.current && msg.page && msg.page % 5 === 0)
                  setIndexSeq((n) => n + 1);
              }
            } catch {
              // ignore malformed messages
            }
          }}
          originWhitelist={["*"]}
          ref={webRef}
          source={{ html, baseUrl: "https://lexipdf.local/" }}
          style={{ flex: 1, backgroundColor: t.page }}
        />
      ) : null}

      {/* Full-screen reading skeleton until the first page (or the target page,
          when opening deep) is in place; the bottom bar tracks real progress. */}
      {status !== "ready" ? (
        <Box bg={t.page} style={{ position: "absolute", inset: 0 }}>
          <ReflowSkeleton topInset={topInset} />
        </Box>
      ) : null}

      {/* Extraction progress, as a thin bar along the bottom edge — the same
          affordance the web reader uses, sitting above the Android nav bar. */}
      {extracting ? (
        <Box
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: insets.bottom,
            height: 3,
          }}
        >
          <Animated.View
            style={{
              height: 3,
              backgroundColor: t.accent,
              width: barWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            }}
          />
        </Box>
      ) : null}
    </Box>
  );
}
