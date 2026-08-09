// @vitest-environment node
/**
 * Guards against index.html / manifest.webmanifest declaring a root-relative
 * asset (favicon, manifest icon) that doesn't actually exist under public/.
 * This is exactly the class of bug that shipped a black-splash PWA install
 * and a /favicon.ico rewritten to the SPA shell — nothing else in the suite
 * touches these two files together.
 *
 * File reads happen INSIDE each it(), never at describe-body/module level:
 * a bare readFileSync at collection time throws before any test runs if the
 * file is ever missing on a given machine, failing the whole suite instead
 * of just this one (see workflow.md "env-gated suite" discipline).
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = resolve(__dirname, "../../../")
const INDEX_HTML_PATH = resolve(REPO_ROOT, "index.html")
const MANIFEST_PATH = resolve(REPO_ROOT, "public/manifest.webmanifest")
const PUBLIC_DIR = resolve(REPO_ROOT, "public")

/** Root-relative hrefs on <link> tags in index.html (favicons, manifest). */
function extractIndexHtmlLinkHrefs(html: string): string[] {
  const hrefs: string[] = []
  const linkRe = /<link\b[^>]*\shref="(\/[^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1]
    if (href) hrefs.push(href)
  }
  return hrefs
}

/** icons[].src entries from the manifest (root-relative asset paths). */
function extractManifestIconSrcs(manifestJson: string): string[] {
  const manifest = JSON.parse(manifestJson) as {
    icons?: Array<{ src?: string }>
  }
  return (manifest.icons ?? [])
    .map((icon) => icon.src)
    .filter((src): src is string => typeof src === "string" && src.startsWith("/"))
}

describe("public asset references resolve to real files", () => {
  it("index.html has at least one <link href> asset reference to check", () => {
    const html = readFileSync(INDEX_HTML_PATH, "utf8")
    const hrefs = extractIndexHtmlLinkHrefs(html)
    // A positive control: if this drops to zero, the regex broke, not the assets.
    expect(hrefs.length).toBeGreaterThan(0)
  })

  it("every root-relative <link href> in index.html exists under public/", () => {
    const html = readFileSync(INDEX_HTML_PATH, "utf8")
    const hrefs = extractIndexHtmlLinkHrefs(html)

    const missing = hrefs.filter((href) => !existsSync(resolve(PUBLIC_DIR, href.slice(1))))
    expect(missing).toEqual([])
  })

  it("manifest.webmanifest has at least one icon src to check", () => {
    const manifestJson = readFileSync(MANIFEST_PATH, "utf8")
    const srcs = extractManifestIconSrcs(manifestJson)
    expect(srcs.length).toBeGreaterThan(0)
  })

  it("every icon src in manifest.webmanifest exists under public/", () => {
    const manifestJson = readFileSync(MANIFEST_PATH, "utf8")
    const srcs = extractManifestIconSrcs(manifestJson)

    const missing = srcs.filter((src) => !existsSync(resolve(PUBLIC_DIR, src.slice(1))))
    expect(missing).toEqual([])
  })

  it("index.html declares /favicon.ico as a real multi-size file, not the SPA rewrite", () => {
    const html = readFileSync(INDEX_HTML_PATH, "utf8")
    expect(html).toMatch(/<link\b[^>]*\shref="\/favicon\.ico"/)
    expect(existsSync(resolve(PUBLIC_DIR, "favicon.ico"))).toBe(true)
  })
})
