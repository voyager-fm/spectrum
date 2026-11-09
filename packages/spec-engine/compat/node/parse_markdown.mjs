// Read original source with locked npm parsers; preserve legacy response fields.
import fs from "node:fs"
import yaml from "js-yaml"
import MarkdownIt from "markdown-it"
import wikilinks from "@global-torque/markdown-it-wikilinks"
import frontMatter from "markdown-it-front-matter"
import anchors from "markdown-it-anchor"

const engineering = process.argv.includes("--engineering")
const structured = engineering || process.argv.includes("--structured")
let frontmatter = ""
const parser = new MarkdownIt("commonmark")
    .enable("table")
    .use(frontMatter, (value) => {
        frontmatter = value
    })
    .use(wikilinks())
    .use(anchors, {
        slugify: (title) =>
            title
                .trim()
                .toLowerCase()
                .replaceAll(" ", "-")
                .replace(/[^\p{L}\p{N}_\- ]/gu, ""),
        uniqueSlugStartIndex: 1,
    })

function byteLineStarts(source) {
    const starts = [0]
    let offset = 0
    const lines = source.split("\n")
    for (let index = 0; index < lines.length - 1; index++) {
        offset += Buffer.byteLength(lines[index], "utf8") + 1
        starts.push(offset)
    }
    return starts
}

function byteRange(starts, map, source) {
    if (!map) return null
    const end = map[1] < starts.length ? starts[map[1]] : Buffer.byteLength(source, "utf8")
    return { start: starts[map[0]], end }
}

function yamlInlineCommentStart(value) {
    let singleQuoted = false
    let doubleQuoted = false
    let escaped = false
    for (let index = 0; index < value.length; index++) {
        const char = value[index]
        if (doubleQuoted) {
            if (escaped) {
                escaped = false
                continue
            }
            if (char === "\\") {
                escaped = true
                continue
            }
            if (char === '"') doubleQuoted = false
            continue
        }
        if (singleQuoted) {
            if (char === "'" && value[index + 1] === "'") {
                index++
                continue
            }
            if (char === "'") singleQuoted = false
            continue
        }
        if (char === '"') {
            doubleQuoted = true
            continue
        }
        if (char === "'") {
            singleQuoted = true
            continue
        }
        if (char === "#" && (index === 0 || /\s/.test(value[index - 1]))) {
            return index
        }
    }
    return -1
}

function frontmatterInfo(source, starts) {
    const lines = source.split("\n")
    if (!lines.length || lines[0].replace(/\r$/, "") !== "---") {
        return { range: null, fields: [] }
    }
    let endLine = -1
    for (let index = 1; index < lines.length; index++) {
        if (lines[index].replace(/\r$/, "") === "---") {
            endLine = index
            break
        }
    }
    if (endLine < 0) return { range: null, fields: [] }

    const fields = []
    for (let index = 1; index < endLine; index++) {
        const raw = lines[index].replace(/\r$/, "")
        if (/^[ \t]/.test(raw)) continue
        const match = raw.match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/)
        if (!match) continue
        const key = match[1]
        const rawValue = match[2]
        const lineStart = starts[index]
        const valueStart = raw.length - rawValue.length
        const prefix = raw.slice(0, valueStart)
        const commentStart = yamlInlineCommentStart(rawValue)
        let scalarEnd = commentStart >= 0 ? commentStart : rawValue.length
        while (scalarEnd > 0 && /\s/.test(rawValue[scalarEnd - 1])) scalarEnd--
        const scalarValue = rawValue.slice(0, scalarEnd)
        const empty = scalarValue === ""
        const editable = !empty && !/^[|>&*!]/.test(scalarValue)
        fields.push({
            key,
            line: index + 1,
            empty,
            editable,
            has_inline_comment: commentStart >= 0,
            line_range: {
                start: lineStart,
                end: lineStart + Buffer.byteLength(raw, "utf8"),
            },
            value_range: {
                start: lineStart + Buffer.byteLength(prefix, "utf8"),
                end: lineStart + Buffer.byteLength(prefix + scalarValue, "utf8"),
            },
            key_range: {
                start: lineStart,
                end: lineStart + Buffer.byteLength(key, "utf8"),
            },
        })
    }
    const end = endLine + 1 < starts.length ? starts[endLine + 1] : Buffer.byteLength(source, "utf8")
    return { range: { start: 0, end }, fields }
}

const documents = JSON.parse(fs.readFileSync(0, "utf8"))
const results = documents.map((source) => {
    frontmatter = ""
    const starts = byteLineStarts(source)
    const tokens = parser.parse(source, {})
    const references = []
    const links = []
    const titles = []
    const ids = []
    const sections = []
    const fences = []
    const protectedRanges = []
    for (const [index, block] of tokens.entries()) {
        const protectedBlock = ["fence", "code_block", "html_block"].includes(block.type)
        if (structured && protectedBlock && block.map) {
            protectedRanges.push({
                kind: block.type,
                lines: { start: block.map[0] + 1, end: block.map[1] },
                range: byteRange(starts, block.map, source),
            })
        }
        for (const token of block.children || []) {
            if (token.type === "link_open") {
                const target = token.attrGet("href")
                references.push([target, false])
                if (structured) links.push({ target, wiki: false, range: byteRange(starts, block.map, source) })
            }
            if (token.type === "wikilink") {
                references.push([token.meta.target, true])
                if (structured) links.push({ target: token.meta.target, wiki: true, range: byteRange(starts, block.map, source) })
            }
        }
        if (block.type === "heading_open") {
            const title = tokens[index + 1].children
                .filter((token) => ["text", "code_inline"].includes(token.type))
                .map((token) => token.content)
                .join("")
            titles.push(title)
            ids.push(block.attrGet("id"))
            if (structured) {
                const level = Number(block.tag.slice(1))
                let end = index + 3
                while (
                    end < tokens.length &&
                    !(tokens[end].type === "heading_open" && Number(tokens[end].tag.slice(1)) <= level)
                ) end++
                const content = tokens.slice(index + 3, end)
                const nextHeading = tokens[end]
                const bodyStartLine = block.map ? block.map[1] : null
                const bodyEndLine = nextHeading?.map ? nextHeading.map[0] : source.split("\n").length
                const bodyRange =
                    bodyStartLine === null
                        ? null
                        : {
                              start: bodyStartLine < starts.length ? starts[bodyStartLine] : Buffer.byteLength(source, "utf8"),
                              end: bodyEndLine < starts.length ? starts[bodyEndLine] : Buffer.byteLength(source, "utf8"),
                          }
                sections.push({
                    title,
                    level,
                    line: block.map ? block.map[0] + 1 : null,
                    id: block.attrGet("id"),
                    heading_range: byteRange(starts, block.map, source),
                    body_range: bodyRange,
                    code: content.filter((token) => ["fence", "code_block"].includes(token.type)).map((token) => ({ info: token.info, content: token.content })),
                    text: content
                        .filter((token, contentIndex) => token.type === "inline" && content[contentIndex - 1]?.type !== "heading_open")
                        .map((token) => (token.children || [])
                            .filter((child) => ["text", "code_inline"].includes(child.type))
                            .map((child) => child.content)
                            .join(""))
                        .join("\n"),
                })
            }
        }
        if (structured && block.type === "fence") {
            fences.push({
                info: block.info,
                content: block.content,
                line: block.map ? block.map[0] + 1 : null,
                range: byteRange(starts, block.map, source),
            })
        }
    }

    const result = { references, titles, ids }
    if (structured) {
        const fm = frontmatterInfo(source, starts)
        try {
            result.metadata = frontmatter ? yaml.load(frontmatter, { schema: yaml.JSON_SCHEMA }) : {}
            JSON.stringify(result.metadata)
        } catch (error) {
            result.metadata = {}
            result.metadata_error = String(error.message)
        }
        result.frontmatter_range = fm.range
        result.metadata_fields = fm.fields
        result.sections = sections
        result.links = links
        result.fences = fences
        result.protected_ranges = protectedRanges
    }
    return result
})
process.stdout.write(JSON.stringify(results))
