# Liqrai

Liqrai is a reading app for PDFs and books that lets you actually talk to
what you're reading.

## Why

Reading something dense on your own is slow. You hit a paragraph that
doesn't make sense, a claim that sounds off, a name you don't recognize —
and there's no one there to ask. Liqrai puts a companion right next to the
page that has read the document with you, so you can just ask it.

## What it does

- **Talk to your book.** Open any PDF and ask Liqrai about it — not a
  generic chatbot, one that knows what page you're on and what the book is
  actually arguing.
- **Voice, not just text.** Speak your question and hear Liqrai answer back,
  so you don't have to stop reading to start typing.
- **A second opinion on the page.** Liqrai quietly checks what you're
  reading for claims that look wrong, outdated, or unsupported, and marks
  them right on the page. It's not a verdict — it's a nudge to look closer,
  and you can ask Liqrai to argue its case or take the book's side.
- **Reads the way you like to read.** Fonts, layout, and page reflow are
  yours to set, and Liqrai remembers your preferences.
- **Start reading immediately.** No account needed to open a book and start
  asking questions — Liqrai only asks you to sign in once you've used it
  enough that it's worth remembering who you are, and everything you've done
  carries over the moment you do.

## Running it locally

You'll need [pnpm](https://pnpm.io) and the [Liqrai API](../liqrai-api)
running alongside it.

```bash
pnpm install
pnpm start
```

Then open the app in a development build, an Android/iOS simulator, or
Expo Go, following the options Expo prints to the terminal.
