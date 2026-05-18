# marquee

A lightweight, zero-dependency marquee/scrolling content library using modern JavaScript and CSS.
Just add the `marquee` class to any container!

[![npm version](https://badge.fury.io/js/marquee.svg)](https://www.npmjs.com/package/marquee)
[![jsDelivr](https://data.jsdelivr.com/v1/package/npm/marquee/badge)](https://www.jsdelivr.com/package/npm/marquee)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[**Live Demo**](https://marquee.ewanhowell.com/)

## Features

* No dependencies
* Automatically clones content to fill the container width
* Smooth, infinite horizontal scroll using CSS animations
* Configurable scroll speed
* Optional pause-on-hover (and tap-to-pause on touch)
* Optional click-and-drag / touch-drag with momentum
* Only scrolls when content overflows (with an option to force scrolling)
* Recalculates automatically on container resize and image load
* Automatically pauses when scrolled off-screen and when the tab is backgrounded
* Lazy images are upgraded to eager loading when the marquee scrolls into view
* Pre-init styling means it never renders as a broken half-state
* Programmatic API for manual init, refresh, pause, resume, and destroy
* Works with any HTML content: text, images, components

## Quick Start

### Install via npm
```bash
npm install marquee
```

```js
import "marquee/styles.css"
import "marquee"
```

### Or use via CDN
https://www.jsdelivr.com/package/npm/marquee

### Add a marquee to your page

```html
<div class="marquee">
  <div class="marquee-item">Item 1</div>
  <div class="marquee-item">Item 2</div>
  <div class="marquee-item">Item 3</div>
</div>
```

The marquee will only scroll if its contents overflow its container width. It recalculates automatically when the container resizes or images load.

## Settings

| Attribute | Description |
|---|---|
| `class="marquee"` | Required. Marks an element as a marquee. |
| `class="marquee-item"` | Optional helper class for child items, with sensible default padding and sizing. |
| `data-speed="128"` | Scroll speed in pixels per second. Defaults to `128`. |
| `data-infinite` | Always scroll, even if the content fits inside the container. |
| `data-pause-on-hover` | Pause the scroll while hovered (desktop only). Auto-resumes on mouse leave. |
| `data-pause-on-click` | Click on the marquee to lock pause; click anywhere outside to unlock. |
| `data-pausable` | Shorthand: enables both `data-pause-on-hover` and `data-pause-on-click`. |
| `data-draggable` | Allow click-and-drag (or touch-drag) to scrub through the marquee, with momentum on release. |

## Examples

### Basic marquee

```html
<div class="marquee">
  <div class="marquee-item">Free shipping on all orders over $50</div>
  <div class="marquee-item">New arrivals every week</div>
  <div class="marquee-item">Sign up for 10% off your first order</div>
</div>
```

### Custom speed

```html
<div class="marquee" data-speed="64">
  <div class="marquee-item">Slow and steady</div>
  <div class="marquee-item">Half the default speed</div>
</div>
```

### Always scrolling

By default, the marquee only animates when its contents are wider than the container. Add `data-infinite` to force it to scroll even when its contents would fit:

```html
<div class="marquee" data-infinite>
  <div class="marquee-item">Always scrolling</div>
  <div class="marquee-item">Even when it fits</div>
</div>
```

### Pause on hover / tap

```html
<div class="marquee" data-pausable>
  <div class="marquee-item">Hover to pause</div>
  <div class="marquee-item">Tap to pause on touch</div>
</div>
```

### Drag to scrub

Add `data-draggable` to let users grab the marquee and scrub through it. Works with mouse, touch, and pen via Pointer Events. Vertical page scrolling is preserved on touch (only horizontal drags are captured). Releasing with a flick applies momentum that decays smoothly back into the normal scroll.

```html
<div class="marquee" data-draggable>
  <div class="marquee-item">Drag me</div>
  <div class="marquee-item">Flick to throw</div>
  <div class="marquee-item">Releases with momentum</div>
</div>
```

`data-draggable` combines naturally with `data-pausable`. On touch, a tap toggles pause and a drag scrubs; if you drag past a few pixels, the tap-to-pause is suppressed. Click events fired on items during a drag are also suppressed.

### Images

```html
<div class="marquee" data-speed="96">
  <img class="marquee-item" src="logo1.svg">
  <img class="marquee-item" src="logo2.svg">
  <img class="marquee-item" src="logo3.svg">
</div>
```

Lazy-loaded images (`loading="lazy"`) inside a marquee will be switched to eager loading when the marquee first scrolls into view, so the clone-and-fill logic gets accurate widths. Images that load after init also trigger a recalculation automatically.

## Programmatic API

A `Marquee` class is exported (and also attached to `window.Marquee`) for manual control. Each element also gets an `.marquee` property pointing to its instance.

```js
import Marquee from "marquee"

// Init a specific element (no-op if already initialised). Accepts a child too.
const m = Marquee.init(document.querySelector(".my-marquee"))

// Init all uninitialised marquees within a root (defaults to document)
Marquee.initAll(myContainer)

// Get the instance for an already-initialised element
const existing = Marquee.get(element)
const sameThing = element.marquee
```

### Options

`Marquee.init(el, options)` and `Marquee.initAll(root, options)` accept an optional config object. Options override their corresponding data attributes.

```js
Marquee.init(el, {
  speed: 64,          // pixels per second
  infinite: true,     // always scroll
  pauseOnHover: true, // pause while hovered
  pauseOnClick: true, // lock pause on click
  pausable: true,     // shorthand: both pauseOnHover and pauseOnClick
  draggable: true     // enable drag-to-scrub
})
```

Booleans default to `false`. Pass `false` explicitly to disable a feature that's set via data attribute.

### Instance methods

| Method | Description |
|---|---|
| `m.refresh()` | Recalculate clone count and animation duration. Called automatically on resize and image load. |
| `m.pause()` | Pause the scroll. |
| `m.resume()` | Resume the scroll. |
| `m.destroy()` | Tear down: restore the original DOM, remove clones, disconnect observers, and remove listeners. |

### Auto-init

By default, all `.marquee` elements present at `DOMContentLoaded` are initialised automatically. If you inject marquees later (e.g. via a framework or AJAX), call `Marquee.initAll(root)` after the new content is in the DOM.

## CSS state classes

The library adds these classes to the root `.marquee` element. They're available for custom styling:

| Class | Applied when |
|---|---|
| `marquee-initialised` | JS has set up the marquee. |
| `marquee-scrolling` | The content overflows and is being scrolled. |
| `marquee-draggable` | `data-draggable` is set on the element. |
| `marquee-dragging` | A drag is currently in progress. |

## How it works

1. **Wraps** the marquee's children into a `.marquee-sub` group inside a single `.marquee-track`.
2. **Measures** the group's natural width using a hidden duplicate (`.marquee-measure`).
3. **Clones** the group as many times as needed to fill the container plus one extra so the wrap is seamless.
4. **Animates** the track via a `requestAnimationFrame` loop that updates a single `transform: translateX(...)`. The offset wraps modulo the group width, so the loop is invisible.
5. **Observes** the container, the measure node, and any images, recalculating when any of them change.
6. **Pauses automatically** when the marquee scrolls out of view (via `IntersectionObserver`) and when the tab is backgrounded (via `requestAnimationFrame` natively halting).

If the content fits inside the container and `data-infinite` is not set, the marquee stays static and centered.

The pre-init CSS uses `display: flex` and `justify-content: space-around`, so even if JavaScript fails to load or is delayed, the marquee renders as a clean, evenly-spaced row instead of a broken stack.

## Note on per-item event listeners

Because the library wraps items into `.marquee-sub` and creates clones, listeners attached directly to individual items only fire on the originals, not the clones. Use **event delegation** on the `.marquee` element instead:

```js
document.querySelector(".marquee").addEventListener("click", e => {
  const item = e.target.closest(".marquee-item")
  if (item) console.log("Clicked:", item)
})
```

## License

MIT © [Ewan Howell](https://ewanhowell.com/)
