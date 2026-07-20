import { File } from "expo-file-system";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { WebView } from "react-native-webview";

import { Box, Text } from "@/components/atoms";
import { LINE_SPACING, useAppStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

export interface PdfSearchResult {
  page: number;
  before: string;
  match: string;
  after: string;
  ny0?: number;
  ny1?: number;
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
}

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

function fontStack(fam: string): string {
  if (fam === "serif") return "'Literata', Georgia, 'Times New Roman', serif";
  if (fam === "dys")
    return "'Atkinson Hyperlegible', 'Segoe UI', system-ui, sans-serif";
  return "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
}

function buildHtml(
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
  @import url('https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=Hanken+Grotesk:wght@400;500;600&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap');
  :root {
    --fs: ${s.baseFs}px;
    --lh: ${s.lh};
    --fg: ${s.fg};
    --bg: ${s.bg};
    --faint: ${s.faint};
    --hl: ${s.hl};
    --ff: ${s.fontFamily};
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; background: var(--bg); }
  body {
    color: var(--fg);
    padding: 0 22px 96px;
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
  section { scroll-margin-top: 12px; }
  #content p {
    font-size: var(--fs);
    line-height: var(--lh);
    margin: 0 0 1.1em;
    word-break: break-word;
    overflow-wrap: break-word;
  }
  #content img {
    display: block;
    max-width: 100%;
    height: auto;
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
  var RENDER_SCALE = 1.0;
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
  };

  window.setChromeOffset = function(px){
    var pad = document.getElementById('chrome-pad');
    if (pad) pad.style.height = (${topInset} + 16 + px) + 'px';
  };

  window.scrollToPage = function(n){
    var el = document.querySelector('section[data-page="' + n + '"]');
    if (el) el.scrollIntoView({ block: 'start' });
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

  window.highlightMatch = function(q, idx){
    cancelHitTimers();
    clearMarks();
    if (!q) return;
    var ql = q.toLowerCase();
    var secs = document.querySelectorAll('section[data-page]');
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

  /* ---- focus mode: scroll-driven spotlight ----
     The block whose box crosses the reading line (45% down the screen — a
     bit above center, where eyes actually rest) is lit; the rest stay dim.
     Recomputed from the same scroll rAF that reports the page. */
  var focusOn = false;
  var litEl = null;
  function updateSpotlight(){
    if (!focusOn) return;
    var blocks = document.querySelectorAll('#content p, #content img');
    if (!blocks.length) return;
    var beam = window.innerHeight * 0.45;
    var best = null, bestD = Infinity;
    for (var i = 0; i < blocks.length; i++){
      var r = blocks[i].getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) continue;  // off-screen
      var d = (r.top <= beam && r.bottom >= beam)
        ? 0
        : Math.min(Math.abs(r.top - beam), Math.abs(r.bottom - beam));
      if (d < bestD) { bestD = d; best = blocks[i]; }
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
        document.documentElement.style.setProperty('--fs', pendingFs + 'px');
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
      else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject ||
               fn === OPS.paintInlineImageXObject) {
        images.push(ctm.slice());
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
      if (cur && Math.abs(y - cur.y) < 3) {
        cur.text += str;
        cur.x0 = Math.min(cur.x0, x);
        cur.x1 = Math.max(cur.x1, x + w);
        cur.h = Math.max(cur.h, it.height || 0);
      }
      else {
        if (cur) lines.push(cur);
        cur = { y: y, text: str, item: it, x0: x, x1: x + w, h: it.height || 10 };
      }
      if (it.hasEOL && cur) { lines.push(cur); cur = null; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /* Merge lines into paragraphs, carrying color. */
  function toParagraphs(lines){
    var gaps = [];
    for (var j = 1; j < lines.length; j++){
      var g = lines[j-1].y - lines[j].y;
      if (g > 0) gaps.push(g);
    }
    gaps.sort(function(a,b){ return a-b; });
    var median = gaps.length ? gaps[Math.floor(gaps.length/2)] : 0;

    var paras = [];
    var buf = null;
    var prevY = null;
    for (var k = 0; k < lines.length; k++){
      var text = (lines[k].text || '').replace(/\\s+/g, ' ').trim();
      if (!text) { if (buf) { paras.push(buf); buf = null; } prevY = null; continue; }
      var brk = false;
      if (prevY !== null) {
        var gap = prevY - lines[k].y;
        if (gap < 0 || (median > 0 && gap > median * 1.5)) brk = true;
      }
      if (brk && buf) { paras.push(buf); buf = null; }
      if (!buf) buf = { y: lines[k].y, y2: lines[k].y, runs: [], geo: [] };
      buf.runs.push({ text: text, color: lines[k].color || null });
      // one geometry record per run: the source line's box in page space
      buf.geo.push({ x0: lines[k].x0, x1: lines[k].x1, y: lines[k].y, h: lines[k].h || 10 });
      buf.y2 = lines[k].y;   // last line — bottom of the paragraph
      prevY = lines[k].y;
    }
    if (buf) paras.push(buf);
    return paras;
  }

  function paragraphEl(para){
    var p = document.createElement('p');
    var uniform = true;
    for (var i = 1; i < para.runs.length; i++){
      if (para.runs[i].color !== para.runs[0].color) { uniform = false; break; }
    }
    if (uniform) {
      if (para.runs[0].color) p.style.color = para.runs[0].color;
      p.textContent = para.runs.map(function(r){ return r.text; }).join(' ');
    } else {
      for (var j = 0; j < para.runs.length; j++){
        var span = document.createElement('span');
        if (para.runs[j].color) span.style.color = para.runs[j].color;
        span.textContent = (j ? ' ' : '') + para.runs[j].text;
        p.appendChild(span);
      }
    }
    return p;
  }

  async function processPage(pdf, pageNo, content){
    var page = await pdf.getPage(pageNo);
    var viewport = page.getViewport({ scale: RENDER_SCALE });
    var ops = await page.getOperatorList();
    var info = scanOps(ops);

    // Only rasterize when we actually need pixels (images or colored text).
    var canvas = null, ctx = null;
    if (info.images.length || info.hasColor) {
      canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    }

    var tc = await page.getTextContent();
    var lines = toLines(tc.items);

    // sample one color per line from the rendered page
    if (ctx) {
      for (var i = 0; i < lines.length; i++){
        var it = lines[i].item;
        if (!it || !it.transform) continue;
        var pt = pdfjsLib.Util.applyTransform([it.transform[4], it.transform[5]], viewport.transform);
        var hgt = Math.max(4, (it.height || 10) * RENDER_SCALE);
        var wid = Math.max(4, (it.width || 40) * RENDER_SCALE);
        lines[i].color = sampleColor(ctx, canvas, { x: pt[0], y: pt[1] - hgt, w: wid, h: hgt });
      }
    }

    var paras = toParagraphs(lines);

    // crop images out of the rendered page
    var imgs = [];
    if (ctx) {
      for (var m = 0; m < info.images.length; m++){
        var box = boxOf(info.images[m], viewport);
        if (box.w < 24 || box.h < 24) continue; // skip rules/bullets/artifacts
        var sx = Math.max(0, Math.floor(box.x));
        var sy = Math.max(0, Math.floor(box.y));
        var sw = Math.min(canvas.width - sx, Math.ceil(box.w));
        var sh = Math.min(canvas.height - sy, Math.ceil(box.h));
        if (sw <= 0 || sh <= 0) continue;
        var c2 = document.createElement('canvas');
        c2.width = sw; c2.height = sh;
        c2.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        try {
          imgs.push({ top: box.y, src: c2.toDataURL('image/jpeg', 0.85), w: sw, h: sh });
        } catch (e) { /* tainted canvas — skip */ }
      }
    }

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
          var len = d2.runs[g].text.length;
          var gl = d2.geo && d2.geo[g];
          if (gl && len) {
            var g0 = pdfjsLib.Util.applyTransform([gl.x0, gl.y], viewport.transform);
            var g1 = pdfjsLib.Util.applyTransform([gl.x1, gl.y], viewport.transform);
            var gh = Math.max(6, gl.h);   // device px at RENDER_SCALE 1
            geo.push({
              o: off, l: len,
              x0: +(g0[0] / viewport.width).toFixed(4),
              x1: +(g1[0] / viewport.width).toFixed(4),
              y0: +((g0[1] - gh) / viewport.height).toFixed(4),
              y1: +((g0[1] + gh * 0.28) / viewport.height).toFixed(4)
            });
          }
          off += len + 1;
        }
        pEl.setAttribute('data-geom', JSON.stringify(geo));
        section.appendChild(pEl);
      }
      else {
        var im = document.createElement('img');
        im.src = blocks[q].data.src;
        im.width = blocks[q].data.w;
        im.height = blocks[q].data.h;
        section.appendChild(im);
      }
    }
    content.appendChild(section);
    page.cleanup();
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

    pdfjsLib.getDocument({ data: b64ToBytes('${b64}') }).promise.then(async function(pdf){
      for (var p = 1; p <= pdf.numPages; p++){
        try { await processPage(pdf, p, content); }
        catch (e) { /* skip unreadable page */ }
        if (!firstPaint && content.childNodes.length) {
          firstPaint = true;
          document.getElementById('status').className = 'hidden';
          post({ type: 'firstpaint' });
        }
        post({ type: 'progress', page: p, total: pdf.numPages });
        if (p === INITIAL_PAGE) window.scrollToPage(INITIAL_PAGE);
      }
      post({ type: 'done', pages: pdf.numPages });
      if (INITIAL_PAGE > 1) window.scrollToPage(INITIAL_PAGE);
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

const SKELETON_LINES = [
  [96, 100, 92, 74],
  [100, 88, 97, 100, 61],
  [93, 100, 79],
];

function ReflowSkeleton({ topInset }: { topInset: number }) {
  const t = useProtoTheme();
  const [pulse] = useState(() => new Animated.Value(0.35));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: pulse,
        paddingTop: topInset + 24,
        paddingHorizontal: 22,
      }}
    >
      {SKELETON_LINES.map((para, pi) => (
        <Box gap={11} key={pi} style={{ marginBottom: 30 }}>
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
  initialPage?: number;
  gotoPage?: { page: number; seq: number };
  topInset?: number;
  chromeOffset?: number;
  searchQuery?: string;
  highlight?: { query: string; index: number; seq: number };
  focusMode?: boolean;
  onPageChange?: (page: number) => void;
  onSearchResults?: (results: PdfSearchResult[]) => void;
  onSingleTap?: () => void;
  onIndexed?: () => void;
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
  onPageChange,
  onSearchResults,
  onSingleTap,
  onIndexed,
}: Props) {
  const t = useProtoTheme();
  const textSize = useAppStore((s) => s.textSize);
  const zoom = useAppStore((s) => s.zoom);
  const lineSp = useAppStore((s) => s.lineSp);
  const fontFam = useAppStore((s) => s.fontFam);

  const webRef = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("reading");

  const settings: Settings = useMemo(
    () => ({
      baseFs: textSize,
      zoomedFs: Math.round((textSize * zoom) / 100),
      lh: LINE_SPACING[lineSp] ?? 1.75,
      fontFamily: fontStack(fontFam),
      fg: t.readerInk,
      bg: t.page,
      faint: t.faint,
      hl: t.hl,
    }),
    [textSize, zoom, lineSp, fontFam, t.readerInk, t.page, t.faint, t.hl],
  );

  const settingsRef = useRef<Settings>(settings);
  const initialPageRef = useRef<number>(initialPage);
  const topInsetRef = useRef<number>(topInset);
  useEffect(() => {
    settingsRef.current = settings;
    initialPageRef.current = initialPage;
    topInsetRef.current = topInset;
  }, [settings, initialPage, topInset]);

  useEffect(() => {
    let cancelled = false;
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

  useEffect(() => {
    if (status !== "ready") return;
    webRef.current?.injectJavaScript(
      `window.applySettings && window.applySettings(${JSON.stringify(settings)}); true;`,
    );
  }, [settings, status]);

  useEffect(() => {
    if (status !== "ready") return;
    webRef.current?.injectJavaScript(
      `window.setChromeOffset && window.setChromeOffset(${chromeOffset}); true;`,
    );
  }, [chromeOffset, status]);

  useEffect(() => {
    if (status !== "ready" || !gotoPage) return;
    webRef.current?.injectJavaScript(
      `window.scrollToPage && window.scrollToPage(${gotoPage.page}); true;`,
    );
  }, [gotoPage, status]);

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
    webRef.current?.injectJavaScript(
      `window.clearHighlight && window.clearHighlight();` +
        `window.searchText && window.searchText(${JSON.stringify(q)}); true;`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, status, indexSeq]);

  useEffect(() => {
    if (status !== "ready") return;
    webRef.current?.injectJavaScript(
      `window.setFocusMode && window.setFocusMode(${focusMode ? "true" : "false"}); true;`,
    );
  }, [focusMode, status]);

  useEffect(() => {
    if (status !== "ready" || !highlight?.query) return;
    webRef.current?.injectJavaScript(
      `window.highlightMatch && window.highlightMatch(${JSON.stringify(
        highlight.query,
      )}, ${highlight.index}); true;`,
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
          It may be a scanned/image-only PDF with no text layer. Try Page view.
        </Text>
      </Box>
    );
  }

  return (
    <Box bg={t.page} flex={1}>
      {html ? (
        <WebView
          allowFileAccess
          androidLayerType="hardware"
          onMessage={(e) => {
            try {
              const msg = JSON.parse(e.nativeEvent.data) as {
                type: string;
                page?: number;
                total?: number;
                results?: PdfSearchResult[];
              };
              if (msg.type === "firstpaint") setStatus("ready");
              else if (msg.type === "page" && msg.page)
                onPageChange?.(msg.page);
              else if (msg.type === "tap") onSingleTap?.();
              else if (msg.type === "error") setStatus("error");
              else if (msg.type === "searchresults")
                onSearchResults?.(msg.results ?? []);
              else if (msg.type === "done") {
                onIndexed?.();
                if (queryRef.current) setIndexSeq((n) => n + 1);
              } else if (msg.type === "progress") {
                if (queryRef.current && msg.page && msg.page % 5 === 0)
                  setIndexSeq((n) => n + 1);
              }
            } catch {}
          }}
          originWhitelist={["*"]}
          ref={webRef}
          source={{ html, baseUrl: "https://lexipdf.local/" }}
          style={{ flex: 1, backgroundColor: t.page }}
        />
      ) : null}

      {status !== "ready" ? (
        <Box bg={t.page} style={{ position: "absolute", inset: 0 }}>
          <ReflowSkeleton topInset={topInset} />
        </Box>
      ) : null}
    </Box>
  );
}
