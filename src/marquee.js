const instances = new WeakMap()

class Marquee {
  constructor(element) {
    if (instances.has(element)) return instances.get(element)
    instances.set(element, this)
    element.marquee = this

    this.element = element
    this.speed = parseFloat(element.dataset.speed) || 128
    this.infinite = "infinite" in element.dataset
    this.pausable = "pausable" in element.dataset
    this.draggable = "draggable" in element.dataset

    this.sub = document.createElement("div")
    this.sub.className = "marquee-sub"
    this.sub.append(...element.children)

    this.track = document.createElement("div")
    this.track.className = "marquee-track"
    this.track.append(this.sub)

    this.measure = document.createElement("div")
    this.measure.className = "marquee-measure"
    this.measure.append(this.sub.cloneNode(true))

    element.append(this.track, this.measure)

    this.clones = []
    this.offset = 0
    this.subWidth = 0
    this.momentum = 0
    this.hoverPaused = false
    this.clickPaused = false
    this.pointerDown = false
    this.dragging = false
    this._lastPointerType = "mouse"
    this.visible = true
    this.scrolling = false
    this.pauseMultiplier = 1
    this._rafId = 0
    this._lastFrame = 0
    this._refreshScheduled = false

    element.classList.add("marquee-initialised")
    if (this.draggable) element.classList.add("marquee-draggable")

    this._setupObservers()
    if (this.pausable) this._setupPausable()
    if (this.draggable) this._setupDrag()

    this._refresh()
  }

  _setupObservers() {
    this._resizeObserver = new ResizeObserver(() => this._scheduleRefresh())
    this._resizeObserver.observe(this.element)
    this._resizeObserver.observe(this.measure)

    for (const img of this.measure.querySelectorAll("img")) {
      if (img.complete) continue
      const handler = () => this._scheduleRefresh()
      img.addEventListener("load", handler, { once: true })
      img.addEventListener("error", handler, { once: true })
    }

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

  _setupPausable() {
    this._onEnter = () => {
      this.hoverPaused = true
      this._updateLoop()
    }
    this._onLeave = () => {
      this.hoverPaused = false
      this._updateLoop()
    }
    this._onPointerUpType = e => {
      this._lastPointerType = e.pointerType
    }
    this._onClick = () => {
      if (this._lastPointerType === "mouse") {
        this.clickPaused = true
      } else {
        this.clickPaused = !this.clickPaused
      }
      this._updateLoop()
    }
    this._onOutsidePointer = e => {
      if (this.element.contains(e.target)) return
      if (this.clickPaused) {
        this.clickPaused = false
        this._updateLoop()
      }
    }
    this.element.addEventListener("mouseenter", this._onEnter)
    this.element.addEventListener("mouseleave", this._onLeave)
    this.element.addEventListener("pointerup", this._onPointerUpType)
    this.element.addEventListener("click", this._onClick)
    document.addEventListener("pointerdown", this._onOutsidePointer)
  }

  _setupDrag() {
    let startX = 0
    let startOffset = 0
    let lastX = 0
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
      startX = e.clientX
      lastX = e.clientX
      lastTime = performance.now()
      startOffset = this.offset
      samples.length = 0
      samples.push({ x: e.clientX, t: lastTime })
      this.pointerDown = true
      this._updateLoop()
    }

    const onMove = e => {
      if (e.pointerId !== activePointerId) return
      const dx = e.clientX - startX
      if (!moved) {
        if (Math.abs(dx) <= 3) return
        moved = true
        this.dragging = true
        this.momentum = 0
        startX = e.clientX
        startOffset = this.offset
        this.element.classList.add("marquee-dragging")
        this._updateLoop()
        return
      }
      this._setOffset(startOffset - (e.clientX - startX))
      const now = performance.now()
      samples.push({ x: e.clientX, t: now })
      while (samples.length > 6) samples.shift()
      lastX = e.clientX
      lastTime = now
    }

    const onUp = e => {
      if (e.pointerId !== activePointerId) return
      activePointerId = null
      this.pointerDown = false

      if (this.dragging) {
        this.dragging = false
        this.element.classList.remove("marquee-dragging")

        if (samples.length >= 2) {
          const now = performance.now()
          const recent = samples.filter(s => now - s.t < 120)
          if (recent.length >= 2) {
            const first = recent[0]
            const last = recent[recent.length - 1]
            const dt = (last.t - first.t) / 1000
            if (dt > 0) {
              const pointerVelocity = (last.x - first.x) / dt
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
      } else if (this.pausable && e.pointerType !== "mouse") {
        this.tapPaused = !this.tapPaused
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
    const measureWidth = this.measure.firstElementChild.offsetWidth
    if (!measureWidth) return

    this.subWidth = measureWidth
    const containerWidth = this.element.clientWidth
    const shouldScroll = this.infinite || measureWidth > containerWidth

    this.scrolling = shouldScroll
    this.element.classList.toggle("marquee-scrolling", shouldScroll)

    if (!shouldScroll) {
      while (this.clones.length) this.clones.pop().remove()
      this.offset = 0
      this._applyTransform()
      this._stopLoop()
      return
    }

    const needClones = Math.ceil(containerWidth / measureWidth) + 1
    while (this.clones.length > needClones) {
      this.clones.pop().remove()
    }
    while (this.clones.length < needClones) {
      const clone = this.sub.cloneNode(true)
      clone.classList.add("marquee-clone")
      this.track.append(clone)
      this._runScripts(clone)
      this.clones.push(clone)
    }

    this._setOffset(this.offset)
    this._updateLoop()
  }

  _setOffset(value) {
    if (this.subWidth > 0) {
      value = value % this.subWidth
      if (value < 0) value += this.subWidth
    }
    this.offset = value
    this._applyTransform()
  }

  _applyTransform() {
    this.track.style.transform = `translateX(${-this.offset}px)`
  }

  _pauseTarget() {
    return this.hoverPaused || this.clickPaused || this.pointerDown ? 0 : 1
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

  pause() {
    this.hoverPaused = true
    this._updateLoop()
  }

  resume() {
    this.hoverPaused = false
    this.tapPaused = false
    this._updateLoop()
  }

  destroy() {
    this._stopLoop()
    this._resizeObserver?.disconnect()
    this._visibilityObserver?.disconnect()

    if (this.pausable) {
      this.element.removeEventListener("mouseenter", this._onEnter)
      this.element.removeEventListener("mouseleave", this._onLeave)
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
      "marquee-initialised",
      "marquee-scrolling",
      "marquee-draggable",
      "marquee-dragging"
    )

    delete this.element.marquee
    instances.delete(this.element)
  }

  static init(element) {
    const root = element?.closest?.(".marquee")
    if (!root) return null
    return new Marquee(root)
  }

  static initAll(root = document) {
    return [...root.querySelectorAll(".marquee:not(.marquee-initialised)")].map(el => new Marquee(el))
  }

  static get(element) {
    const root = element?.closest?.(".marquee")
    return root ? instances.get(root) : undefined
  }
}

if (typeof window !== "undefined") {
  window.Marquee = Marquee

  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", () => Marquee.initAll())
  } else {
    Marquee.initAll()
  }
}

export default Marquee
