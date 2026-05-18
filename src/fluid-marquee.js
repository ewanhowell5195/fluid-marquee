const instances = new WeakMap()

class FluidMarquee {
  constructor(element, options = {}) {
    if (instances.has(element)) return instances.get(element)
    instances.set(element, this)
    element.marquee = this

    this.element = element

    const d = element.dataset
    const flag = (key, fallback = false) => {
      if (key in options) return !!options[key]
      return key in d ? true : fallback
    }
    this.speed = "speed" in options ? +options.speed : (d.speed ? parseFloat(d.speed) : 128)
    this.infinite = flag("infinite")
    this.draggable = flag("draggable")
    this.vertical = flag("vertical")
    this.runScripts = flag("runScripts")
    const pausable = flag("pausable")
    this.pauseOnHover = flag("pauseOnHover", pausable)
    this.pauseOnClick = flag("pauseOnClick", pausable)

    this._axis = this.vertical ? "Y" : "X"
    this._clientProp = this.vertical ? "clientY" : "clientX"
    this._sizeProp = this.vertical ? "offsetHeight" : "offsetWidth"
    this._containerProp = this.vertical ? "clientHeight" : "clientWidth"

    this.sub = document.createElement("div")
    this.sub.className = "fluid-marquee-sub"
    this.sub.append(...element.children)

    this.track = document.createElement("div")
    this.track.className = "fluid-marquee-track"
    this.track.append(this.sub)

    this.measure = document.createElement("div")
    this.measure.className = "fluid-marquee-measure"
    this.measure.append(this.sub.cloneNode(true))

    element.append(this.track, this.measure)

    this.clones = []
    this.offset = 0
    this.subSize = 0
    this.momentum = 0
    this.hoverPaused = false
    this.clickPaused = false
    this.apiPaused = false
    this.pointerDown = false
    this.dragging = false
    this.visible = true
    this.scrolling = false
    this.pauseMultiplier = 1
    this._rafId = 0
    this._lastFrame = 0
    this._refreshScheduled = false

    element.classList.add("fluid-marquee-initialised")
    if (this.draggable) element.classList.add("fluid-marquee-draggable")
    if (this.vertical) element.classList.add("fluid-marquee-vertical")

    this._setupObservers()
    if (this.pauseOnHover) this._setupHoverPause()
    if (this.pauseOnClick) this._setupClickPause()
    if (this.draggable) this._setupDrag()

    this._refresh()
  }

  _setupObservers() {
    this._resizeObserver = new ResizeObserver(() => this._scheduleRefresh())
    this._resizeObserver.observe(this.element)
    this._resizeObserver.observe(this.measure)

    this._watchMeasureImages()

    this._visibilityObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        this.visible = entry.isIntersecting
        if (this.visible) {
          for (const img of entry.target.querySelectorAll('img[loading="lazy"]')) {
            img.loading = "eager"
          }
        }
      }
      this._updateLoop()
    })
    this._visibilityObserver.observe(this.element)
  }

  _setupHoverPause() {
    this._onEnter = () => {
      this.hoverPaused = true
      this._updateLoop()
    }
    this._onLeave = () => {
      this.hoverPaused = false
      this._updateLoop()
    }
    this.element.addEventListener("mouseenter", this._onEnter)
    this.element.addEventListener("mouseleave", this._onLeave)
  }

  _setupClickPause() {
    this._onClick = () => {
      this.clickPaused = true
      this._updateLoop()
    }
    this.element.addEventListener("click", this._onClick)
    this._ensureOutsideListener()
  }

  _ensureOutsideListener() {
    if (this._outsideAttached) return
    this._outsideAttached = true
    this._onOutsidePointer = e => {
      if (this.element.contains(e.target)) return
      if (this.clickPaused) {
        this.clickPaused = false
        this._updateLoop()
      }
    }
    document.addEventListener("pointerdown", this._onOutsidePointer)
  }

  _setupDrag() {
    const axis = this._clientProp
    let startPos = 0
    let startOffset = 0
    let lastPos = 0
    let lastTime = 0
    let moved = false
    let activePointerId = null

    const samples = []

    const onDown = e => {
      if (!this.scrolling) return
      if (e.pointerType === "mouse" && e.button !== 0) return
      activePointerId = e.pointerId
      this.element.setPointerCapture(activePointerId)
      moved = false
      startPos = e[axis]
      lastPos = e[axis]
      lastTime = performance.now()
      startOffset = this.offset
      samples.length = 0
      samples.push({ p: e[axis], t: lastTime })
      this.pointerDown = true
      this._updateLoop()
    }

    const onMove = e => {
      if (e.pointerId !== activePointerId) return
      const dp = e[axis] - startPos
      if (!moved) {
        if (Math.abs(dp) <= 3) return
        moved = true
        this.dragging = true
        this.momentum = 0
        startPos = e[axis]
        startOffset = this.offset
        this.element.classList.add("fluid-marquee-dragging")
        this._updateLoop()
        return
      }
      this._setOffset(startOffset - (e[axis] - startPos))
      const now = performance.now()
      samples.push({ p: e[axis], t: now })
      while (samples.length > 6) samples.shift()
      lastPos = e[axis]
      lastTime = now
    }

    const onUp = e => {
      if (e.pointerId !== activePointerId) return
      activePointerId = null
      this.pointerDown = false

      if (this.dragging) {
        this.dragging = false
        this.element.classList.remove("fluid-marquee-dragging")

        if (samples.length >= 2) {
          const now = performance.now()
          const recent = samples.filter(s => now - s.t < 120)
          if (recent.length >= 2) {
            const first = recent[0]
            const last = recent[recent.length - 1]
            const dt = (last.t - first.t) / 1000
            if (dt > 0) {
              const pointerVelocity = (last.p - first.p) / dt
              this.momentum = -pointerVelocity * 0.5
            }
          }
        }

        const suppress = ev => {
          ev.stopPropagation()
          ev.preventDefault()
        }
        this.element.addEventListener("click", suppress, { capture: true, once: true })
        setTimeout(() => {
          this.element.removeEventListener("click", suppress, { capture: true })
        }, 50)
      }

      this._updateLoop()
    }

    this.element.addEventListener("pointerdown", onDown)
    this.element.addEventListener("pointermove", onMove)
    this.element.addEventListener("pointerup", onUp)
    this.element.addEventListener("pointercancel", onUp)

    this._dragHandlers = { onDown, onMove, onUp }
  }

  _scheduleRefresh() {
    if (this._refreshScheduled) return
    this._refreshScheduled = true
    requestAnimationFrame(() => {
      this._refreshScheduled = false
      this._refresh()
    })
  }

  _refresh() {
    const measureSize = this.measure.firstElementChild[this._sizeProp]
    if (!measureSize) return

    this.subSize = measureSize
    const containerSize = this.element[this._containerProp]
    const shouldScroll = this.infinite || measureSize > containerSize

    this.scrolling = shouldScroll
    this.element.classList.toggle("fluid-marquee-scrolling", shouldScroll)

    if (!shouldScroll) {
      while (this.clones.length) this.clones.pop().remove()
      this.offset = 0
      this._applyTransform()
      this._stopLoop()
      return
    }

    const needClones = Math.ceil(containerSize / measureSize) + 1
    while (this.clones.length > needClones) {
      this.clones.pop().remove()
    }
    while (this.clones.length < needClones) {
      const clone = this.sub.cloneNode(true)
      clone.classList.add("fluid-marquee-clone")
      this.track.append(clone)
      if (this.runScripts) this._runScripts(clone)
      this.clones.push(clone)
    }

    this._setOffset(this.offset)
    this._updateLoop()
  }

  _setOffset(value) {
    if (this.subSize > 0) {
      value = value % this.subSize
      if (value < 0) value += this.subSize
    }
    this.offset = value
    this._applyTransform()
  }

  _applyTransform() {
    this.track.style.transform = `translate${this._axis}(${-this.offset}px)`
  }

  _pauseTarget() {
    return this.apiPaused || this.hoverPaused || this.clickPaused || this.pointerDown ? 0 : 1
  }

  _shouldRun() {
    if (!this.scrolling || !this.visible) return false
    if (this.dragging) return true
    if (this.momentum !== 0) return true
    if (this.pauseMultiplier !== this._pauseTarget()) return true
    return this._pauseTarget() === 1
  }

  _updateLoop() {
    if (this._shouldRun()) this._startLoop()
    else this._stopLoop()
  }

  _startLoop() {
    if (this._rafId) return
    this._lastFrame = performance.now()
    const tick = now => {
      this._rafId = 0
      const dt = Math.min(now - this._lastFrame, 100) / 1000
      this._lastFrame = now

      if (!this.dragging) {
        const target = this._pauseTarget()
        if (this.pauseMultiplier !== target) {
          this.pauseMultiplier += (target - this.pauseMultiplier) * (1 - Math.pow(0.0005, dt))
          if (Math.abs(target - this.pauseMultiplier) < 0.001) this.pauseMultiplier = target
        }

        let dx = this.speed * this.pauseMultiplier * dt
        dx += this.momentum * dt
        if (this.momentum !== 0) {
          this.momentum *= Math.pow(0.002, dt)
          if (Math.abs(this.momentum) < 20) this.momentum = 0
        }
        if (dx !== 0) this._setOffset(this.offset + dx)
      }

      if (this._shouldRun()) this._rafId = requestAnimationFrame(tick)
    }
    this._rafId = requestAnimationFrame(tick)
  }

  _stopLoop() {
    if (this._rafId) cancelAnimationFrame(this._rafId)
    this._rafId = 0
  }

  _runScripts(root) {
    for (const old of root.querySelectorAll("script")) {
      const s = document.createElement("script")
      for (const attr of old.attributes) s.setAttribute(attr.name, attr.value)
      s.textContent = old.textContent
      old.replaceWith(s)
    }
  }

  refresh() {
    this._scheduleRefresh()
  }

  get items() {
    return [...this.sub.children]
  }

  add(...newItems) {
    if (!newItems.length) return
    this.sub.append(...newItems)
    this._itemsChanged()
  }

  remove(item) {
    if (item?.parentNode !== this.sub) return
    item.remove()
    this._itemsChanged()
  }

  setItems(newItems) {
    this.sub.replaceChildren(...newItems)
    this._itemsChanged()
  }

  _watchMeasureImages() {
    for (const img of this.measure.querySelectorAll("img")) {
      if (img.complete) continue
      const handler = () => this._scheduleRefresh()
      img.addEventListener("load", handler, { once: true })
      img.addEventListener("error", handler, { once: true })
    }
  }

  _itemsChanged() {
    this.measure.replaceChildren(this.sub.cloneNode(true))
    while (this.clones.length) this.clones.pop().remove()
    this._watchMeasureImages()
    this._scheduleRefresh()
  }

  get paused() {
    return this._pauseTarget() === 0
  }

  pause(sticky = true) {
    if (sticky) {
      this.apiPaused = true
    } else {
      this._ensureOutsideListener()
      this.clickPaused = true
    }
    this._updateLoop()
  }

  resume() {
    this.apiPaused = false
    this.clickPaused = false
    this._updateLoop()
  }

  destroy() {
    this._stopLoop()
    this._resizeObserver?.disconnect()
    this._visibilityObserver?.disconnect()

    if (this.pauseOnHover) {
      this.element.removeEventListener("mouseenter", this._onEnter)
      this.element.removeEventListener("mouseleave", this._onLeave)
    }
    if (this.pauseOnClick) {
      this.element.removeEventListener("click", this._onClick)
    }
    if (this._outsideAttached) {
      document.removeEventListener("pointerdown", this._onOutsidePointer)
    }
    if (this.draggable && this._dragHandlers) {
      const { onDown, onMove, onUp } = this._dragHandlers
      this.element.removeEventListener("pointerdown", onDown)
      this.element.removeEventListener("pointermove", onMove)
      this.element.removeEventListener("pointerup", onUp)
      this.element.removeEventListener("pointercancel", onUp)
    }

    const items = [...this.sub.childNodes]
    this.track.remove()
    this.measure.remove()
    this.element.append(...items)
    this.element.classList.remove(
      "fluid-marquee-initialised",
      "fluid-marquee-scrolling",
      "fluid-marquee-draggable",
      "fluid-marquee-dragging",
      "fluid-marquee-vertical"
    )

    delete this.element.marquee
    instances.delete(this.element)
  }

  static init(element, options) {
    const root = element?.closest?.(".fluid-marquee")
    if (!root) return null
    return new FluidMarquee(root, options)
  }

  static initAll(root = document, options) {
    return [...root.querySelectorAll(".fluid-marquee:not(.fluid-marquee-initialised)")].map(el => new FluidMarquee(el, options))
  }

  static get(element) {
    const root = element?.closest?.(".fluid-marquee")
    return root ? instances.get(root) : undefined
  }
}

if (typeof window !== "undefined") {
  window.FluidMarquee = FluidMarquee

  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", () => FluidMarquee.initAll())
  } else {
    FluidMarquee.initAll()
  }
}

export default FluidMarquee
