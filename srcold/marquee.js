function runMarqueeScripts(root) {
  const scripts = root.querySelectorAll("script")
  for (const oldScript of scripts) {
    const s = document.createElement("script")

    for (const { name, value } of Array.from(oldScript.attributes)) {
      s.setAttribute(name, value)
    }

    s.textContent = oldScript.textContent

    oldScript.replaceWith(s)
  }
}

function initMarquees() {
  const marquees = document.querySelectorAll(".marquee:not(.initialised)")
  for (const marquee of marquees) {
    const div = document.createElement("div")
    div.className = "marquee-sub"
    div.append(...marquee.children)
    marquee.append(div)

    const measure = div.cloneNode(true)
    measure.classList.add("marquee-measure")
    marquee.append(measure)

    const pxPerSec = marquee.dataset.speed ? parseFloat(marquee.dataset.speed) : 128
    let lastWidth = marquee.clientWidth

    function adjust() {
      const base = marquee.querySelector(".marquee-sub")
      const measureWidth = measure.clientWidth
      const needClones = Math.ceil(marquee.clientWidth / measureWidth)

      const clones = marquee.querySelectorAll(".marquee-sub.clone")
      const current = clones.length

      if (current > needClones) {
        for (let i = needClones; i < current; i++) clones[i].remove()
      } else if (current < needClones) {
        for (let i = current; i < needClones; i++) {
          const clone = base.cloneNode(true)
          clone.classList.add("clone")
          marquee.insertBefore(clone, measure)
          runMarqueeScripts(clone)
        }
      }

      const duration = measureWidth / pxPerSec
      marquee.querySelectorAll(".marquee-sub").forEach(sub => {
        sub.style.animation = "none"
        void sub.offsetWidth
        sub.style.animation = `marquee ${duration}s linear infinite`
      })

      if (!("infinite" in marquee.dataset)) {
        marquee.classList.toggle("scrolling", measureWidth > marquee.clientWidth)
      }

      lastWidth = marquee.clientWidth
    }

    setTimeout(adjust, 0)
    window.addEventListener("resize", () => {
      if (marquee.clientWidth !== lastWidth) adjust()
    })

    marquee.classList.add("initialised")

    if ("infinite" in marquee.dataset) marquee.classList.add("scrolling")

    if ("pausable" in marquee.dataset) {
      let paused = false
      const pause = () => marquee.classList.add("paused")
      const resume = () => marquee.classList.remove("paused")

      marquee.addEventListener("mouseenter", pause)
      marquee.addEventListener("mouseleave", () => {
        paused = false
        resume()
      })

      marquee.addEventListener("touchstart", () => {
        paused = !paused
        if (paused) pause()
        else resume()
      })
    }

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll("img[loading='lazy']").forEach(img => {
            img.loading = "eager"
          })
          observer.unobserve(entry.target)
        }
      }
    })
    observer.observe(marquee)
  }
}

if (document.readyState === "loading") {
  addEventListener("DOMContentLoaded", initMarquees)
} else {
  initMarquees()
}