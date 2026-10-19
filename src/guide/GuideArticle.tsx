import type { ReactNode } from 'react'
import type { GuideBlock, GuideSection } from './content'
import { Fragment, useEffect, useState } from 'react'
import { copyText } from '../clipboard'
import './guide.css'

interface GuideArticleProps {
  sections: GuideSection[]
  /** 搜索词高亮规则，null 表示不高亮。 */
  highlight: RegExp | null
  /** 点击正文里的 #guide-xxx 链接时跳转到对应章节。 */
  onJump: (id: string) => void
}

const INLINE_PATTERN = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g
const LINK_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/
const JUMP_PREFIX = '#guide-'

/** 按正则切分文本，奇数位是匹配到的片段；key 用片段在原文中的偏移量。 */
function splitWithOffsets(text: string, pattern: RegExp) {
  let offset = 0
  return text.split(pattern).map((part, order) => {
    const piece = { part, key: offset, matched: order % 2 === 1 }
    offset += part.length
    return piece
  })
}

function mark(text: string, highlight: RegExp | null): ReactNode {
  if (!highlight)
    return text
  const pieces = splitWithOffsets(text, highlight)
  if (pieces.length === 1)
    return text
  return pieces.map(({ part, key, matched }) => matched ? <mark key={key}>{part}</mark> : <Fragment key={key}>{part}</Fragment>)
}

function Inline({ text, highlight, onJump }: { text: string, highlight: RegExp | null, onJump: (id: string) => void }) {
  return splitWithOffsets(text, INLINE_PATTERN).map(({ part, key, matched }) => {
    if (!matched)
      return <Fragment key={key}>{mark(part, highlight)}</Fragment>
    if (part.startsWith('`'))
      return <code key={key}>{mark(part.slice(1, -1), highlight)}</code>
    if (part.startsWith('**'))
      return <strong key={key}><Inline text={part.slice(2, -2)} highlight={highlight} onJump={onJump} /></strong>
    const [, label, href] = LINK_PATTERN.exec(part)!
    if (href.startsWith(JUMP_PREFIX)) {
      return (
        <a
          key={key}
          href={href}
          onClick={(event) => {
            event.preventDefault()
            onJump(href.slice(JUMP_PREFIX.length))
          }}
        >
          {mark(label, highlight)}
        </a>
      )
    }
    return <a key={key} href={href} target="_blank" rel="noreferrer">{mark(label, highlight)}</a>
  })
}

function CodeBlock({ title, code, highlight }: { title?: string, code: string, highlight: RegExp | null }) {
  const [copiedAt, setCopiedAt] = useState<number | null>(null)

  useEffect(() => {
    if (copiedAt === null)
      return
    const timer = window.setTimeout(setCopiedAt, 1600, null)
    return () => window.clearTimeout(timer)
  }, [copiedAt])

  return (
    <figure className="guide-code">
      {title && <figcaption>{mark(title, highlight)}</figcaption>}
      <div className="guide-code-body">
        {splitWithOffsets(code, /\n/).map(({ part: line, key }) => {
          const trimmed = line.trim()
          if (!trimmed)
            return <div key={key} className="guide-code-gap" />
          if (trimmed.startsWith('#'))
            return <div key={key} className="guide-code-line comment"><code>{mark(line, highlight)}</code></div>
          return (
            <div key={key} className="guide-code-line">
              <code>{mark(line, highlight)}</code>
              <button
                type="button"
                className={`guide-copy ${copiedAt === key ? 'copied' : ''}`}
                aria-label={`复制命令：${trimmed}`}
                onClick={() => {
                  void copyText(trimmed).then(ok => ok && setCopiedAt(key))
                }}
              >
                {copiedAt === key ? '已复制' : '复制'}
              </button>
            </div>
          )
        })}
      </div>
    </figure>
  )
}

function blockKey(block: GuideBlock): string {
  switch (block.kind) {
    case 'p':
    case 'note':
      return block.text
    case 'list':
      return block.items[0]
    case 'code':
      return block.code
    case 'links':
      return block.items[0].href
  }
}

function Block({ block, highlight, onJump }: { block: GuideBlock, highlight: RegExp | null, onJump: (id: string) => void }) {
  switch (block.kind) {
    case 'p':
      return <p><Inline text={block.text} highlight={highlight} onJump={onJump} /></p>
    case 'note':
      return (
        <div className={`guide-note ${block.tone}`}>
          <b>{block.tone === 'warn' ? '注意' : '提示'}</b>
          <p><Inline text={block.text} highlight={highlight} onJump={onJump} /></p>
        </div>
      )
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul'
      return (
        <ListTag>
          {block.items.map(item => <li key={item}><Inline text={item} highlight={highlight} onJump={onJump} /></li>)}
        </ListTag>
      )
    }
    case 'code':
      return <CodeBlock title={block.title} code={block.code} highlight={highlight} />
    case 'links':
      return (
        <ul className="guide-links">
          {block.items.map(link => (
            <li key={link.href}>
              <a href={link.href} target="_blank" rel="noreferrer">
                {mark(link.label, highlight)}
                <span aria-hidden="true">↗</span>
              </a>
              {link.note && <small>{mark(link.note, highlight)}</small>}
            </li>
          ))}
        </ul>
      )
  }
}

/** 说明文档正文：按章节渲染，并高亮搜索词。桌面端弹窗与移动端全屏面板共用。 */
export function GuideArticle({ sections, highlight, onJump }: GuideArticleProps) {
  return (
    <article className="guide-article">
      {sections.map((section, order) => (
        <Fragment key={section.id}>
          {sections[order - 1]?.chapter !== section.chapter && <p className="guide-chapter">{section.chapter}</p>}
          <section id={`guide-${section.id}`} className="guide-section">
            <h3>{mark(section.title, highlight)}</h3>
            {section.blocks.map(block => <Block key={blockKey(block)} block={block} highlight={highlight} onJump={onJump} />)}
          </section>
        </Fragment>
      ))}
    </article>
  )
}
