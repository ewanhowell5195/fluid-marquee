import CleanCSS from "clean-css"
import { minify } from "terser"
import fs from "node:fs"

const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version

fs.mkdirSync("dist", { recursive: true })

const js = fs.readFileSync("src/fluid-marquee.js", "utf8")
const css = fs.readFileSync("src/fluid-marquee.css", "utf8")

const banner = `/*!
 * fluid-marquee
 * Version  : ${version}
 * License  : MIT
 * Copyright: ${new Date().getFullYear()} Ewan Howell
 */
`

const minifiedJs = (await minify(js, {
  compress: true
})).code

const minifiedCss = new CleanCSS().minify(css).styles

fs.writeFileSync("dist/fluid-marquee.min.js", banner + minifiedJs)
fs.writeFileSync("dist/fluid-marquee.min.css", banner + minifiedCss)

console.log("Built fluid-marquee v" + version)
