import { useEffect, useMemo, useRef, useState } from 'react'
import { GUIDE_SECTIONS } from '../../guide/content'
import { GuideArticle } from '../../guide/GuideArticle'
import { groupByChapter, GUIDE_SUGGESTIONS, highlightPattern, parseQuery, searchGuide } from '../../guide/search'

interface GuideSheetProps {
  onClose: () => void
}

export function GuideSheet({ onClose }: GuideSheetProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const terms = useMemo(() => parseQuery(query), [query])
  const sections = useMemo(() => searchGuide(terms), [terms])
  const highlight = useMemo(() => highlightPattern(terms), [terms])
  const groups = useMemo(() => groupByChapter(sections), [sections])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape')
        return
      if (query)
        setQuery('')
      else
        onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, query])

  const updateQuery = (value: string) => {
    setQuery(value)
    if (scrollRef.current)
      scrollRef.current.scrollTop = 0
  }

  const jumpTo = (id: string) => {
    const scrollToTarget = () => document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (!sections.some(section => section.id === id)) {
      setQuery('')
      window.requestAnimationFrame(scrollToTarget)
    }
    else {
      scrollToTarget()
    }
  }

  return (
    <section className="m-guide" role="dialog" aria-modal="true" aria-labelledby="m-guide-title">
      <header className="m-guide-bar">
        <div>
          <p className="m-kicker">VIDEO DOWNLOAD GUIDE</p>
          <h2 id="m-guide-title">视频下载说明</h2>
        </div>
        <button type="button" className="m-icon-button" aria-label="关闭说明" onClick={onClose}>×</button>
      </header>

      <div className="m-guide-search">
        <span aria-hidden="true">⌕</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="搜索 412、cookies、ffmpeg…"
          aria-label="搜索视频下载说明"
          onChange={event => updateQuery(event.target.value)}
        />
        {query && <button type="button" aria-label="清空搜索" onClick={() => updateQuery('')}>×</button>}
      </div>

      <div ref={scrollRef} className="m-guide-scroll">
        {!terms.length && (
          <div className="m-chip-row scroll" aria-label="快捷搜索">
            {GUIDE_SUGGESTIONS.map(item => <button key={item} type="button" className="m-chip" onClick={() => updateQuery(item)}>{item}</button>)}
          </div>
        )}

        <details className="m-guide-toc">
          <summary>
            目录 ·
            {' '}
            {sections.length}
            {' '}
            个章节
          </summary>
          {groups.map(group => (
            <div key={group.chapter}>
              <strong>{group.chapter}</strong>
              {group.sections.map(section => <button key={section.id} type="button" onClick={() => jumpTo(section.id)}>{section.title}</button>)}
            </div>
          ))}
        </details>

        <p className="m-guide-meta">{terms.length ? `找到 ${sections.length} 个章节` : `共 ${GUIDE_SECTIONS.length} 个章节 · 命令可逐行复制`}</p>
        {sections.length
          ? <GuideArticle sections={sections} highlight={highlight} onJump={jumpTo} />
          : (
              <div className="m-guide-empty">
                <span aria-hidden="true">⌕</span>
                <h3>没有找到相关内容</h3>
                <p>试试“cookies”“412”“ffmpeg”或平台名称。</p>
                <button type="button" className="m-block-button outline" onClick={() => updateQuery('')}>清空搜索</button>
              </div>
            )}
      </div>
    </section>
  )
}
