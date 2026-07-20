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
import { File } from "expo-file-system";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { WebView } from "react-native-webview";

import { Box, Text } from "@/components/atoms";
import { LINE_SPACING, useAppStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

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

function fontStack(fam: string): string {
  if (fam === "serif") return "'Literata', Georgia, 'Times New Roman', serif";
  if (fam === "dys") return "'Comic Sans MS', 'Segoe UI', system-ui, sans-serif";
  return "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
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
  @import url('https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=swap');
  :root {
    --fs: ${s.baseFs}px;
    --lh: ${s.lh};
    --fg: ${s.fg};
    --bg: ${s.bg};
    --faint: ${s.faint};
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
    transition: height 260ms cubic-bezier(0.33, 0.01, 0.2, 1);
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

  /* Group text items into visual lines. */
  function toLines(items){
    var lines = [];
    var cur = null;
    for (var i = 0; i < items.length; i++){
      var it = items[i];
      var str = it.str || '';
      var y = it.transform ? it.transform[5] : 0;
      if (cur && Math.abs(y - cur.y) < 3) { cur.text += str; }
      else { if (cur) lines.push(cur); cur = { y: y, text: str, item: it }; }
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
      if (!buf) buf = { y: lines[k].y, runs: [] };
      buf.runs.push({ text: text, color: lines[k].color || null });
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
      blocks.push({ top: pt2[1], kind: 'p', data: paras[a] });
    }
    for (var b = 0; b < imgs.length; b++){
      blocks.push({ top: imgs[b].top, kind: 'img', data: imgs[b] });
    }
    blocks.sort(function(x, y){ return x.top - y.top; });

    var section = document.createElement('section');
    section.setAttribute('data-page', String(pageNo));
    for (var q = 0; q < blocks.length; q++){
      if (blocks[q].kind === 'p') section.appendChild(paragraphEl(blocks[q].data));
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

/** Line widths (%) that read like paragraphs of text while loading. */
const SKELETON_LINES = [
  [96, 100, 92, 74],
  [100, 88, 97, 100, 61],
  [93, 100, 79],
];

/** Placeholder text bars shown while the document is being extracted. */
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
  /** Page to scroll to on first load (keeps position across mode switches). */
  initialPage?: number;
  /** Bumped by the parent to re-scroll an already-loaded document. */
  gotoPage?: { page: number; seq: number };
  /** Safe-area top padding, since the toolbar floats over the content. */
  topInset?: number;
  /** Extra top space for the visible toolbar; 0 in distraction-free mode. */
  chromeOffset?: number;
  onPageChange?: (page: number) => void;
  onSingleTap?: () => void;
}

export function PdfReflowView({
  uri,
  initialPage = 1,
  gotoPage,
  topInset = 0,
  chromeOffset = 0,
  onPageChange,
  onSingleTap,
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
    }),
    [textSize, zoom, lineSp, fontFam, t.readerInk, t.page, t.faint],
  );

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

  // Read the file and build the page once per document.
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

  // push settings updates into the live page without re-extracting
  useEffect(() => {
    if (status !== "ready") return;
    webRef.current?.injectJavaScript(
      `window.applySettings && window.applySettings(${JSON.stringify(settings)}); true;`,
    );
  }, [settings, status]);

  // keep text clear of the toolbar as it shows/hides
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
              };
              if (msg.type === "firstpaint") setStatus("ready");
              else if (msg.type === "page" && msg.page) onPageChange?.(msg.page);
              else if (msg.type === "tap") onSingleTap?.();
              else if (msg.type === "error") setStatus("error");
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

      {status !== "ready" ? (
        <Box bg={t.page} style={{ position: "absolute", inset: 0 }}>
          <ReflowSkeleton topInset={topInset} />
        </Box>
      ) : null}
    </Box>
  );
}
