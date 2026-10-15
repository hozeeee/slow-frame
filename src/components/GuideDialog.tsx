import { useEffect, useMemo, useRef, useState } from 'react'
import { GUIDE_SECTIONS } from '../guide/content'
import { GuideArticle } from '../guide/GuideArticle'
import { groupByChapter, GUIDE_SUGGESTIONS, highlightPattern, parseQuery, searchGuide } from '../guide/search'

interface GuideDialogProps {
  onClose: () => void
}

export function GuideDialog({ onClose }: GuideDialogProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const terms = useMemo(() => parseQuery(query), [query])
  const sections = useMemo(() => searchGuide(terms), [terms])
  const highlight = useMemo(() => highlightPattern(terms), [terms])
  const groups = useMemo(() => groupByChapter(sections), [sections])

  useEffect(() => {
    inputRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (query) {
          setQuery('')
          inputRef.current?.focus()
        }
        else {
          onClose()
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
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
    <div
      className="modal-backdrop guide-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget)
          onClose()
      }}
    >
      <div className="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <header className="guide-head">
          <div>
            <p className="section-kicker">VIDEO DOWNLOAD GUIDE</p>
            <h2 id="guide-title">用 yt-dlp 下载网站视频</h2>
            <p>从安装到排错，帮你把网站视频保存到本地，再导入 Slow Frame。</p>
          </div>
          <button type="button" className="guide-close" aria-label="关闭说明" onClick={onClose}>×</button>
        </header>

        <div className="guide-search-wrap">
          <label className="guide-search">
            <span aria-hidden="true">⌕</span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              placeholder="搜索：412、cookies、ffmpeg、macOS…"
              aria-label="搜索视频下载说明"
              onChange={event => updateQuery(event.target.value)}
            />
            {query && <button type="button" aria-label="清空搜索" onClick={() => updateQuery('')}>×</button>}
          </label>
          <span className="guide-result-meta">{terms.length ? `找到 ${sections.length} 个章节` : `共 ${GUIDE_SECTIONS.length} 个章节`}</span>
        </div>

        {!terms.length && (
          <div className="guide-suggestions" aria-label="快捷搜索">
            <span>快速查找</span>
            {GUIDE_SUGGESTIONS.map(item => <button key={item} type="button" className="guide-chip" onClick={() => updateQuery(item)}>{item}</button>)}
          </div>
        )}

        <div className="guide-layout">
          <nav className="guide-toc" aria-label="说明目录">
            {groups.map(group => (
              <div key={group.chapter}>
                <strong>{group.chapter}</strong>
                {group.sections.map(section => <button key={section.id} type="button" onClick={() => jumpTo(section.id)}>{section.title}</button>)}
              </div>
            ))}
          </nav>
          <div ref={scrollRef} className="guide-scroll">
            {sections.length
              ? <GuideArticle sections={sections} highlight={highlight} onJump={jumpTo} />
              : (
                  <div className="guide-empty">
                    <span aria-hidden="true">⌕</span>
                    <h3>没有找到相关内容</h3>
                    <p>试试“cookies”“412”“ffmpeg”或平台名称。</p>
                    <button type="button" className="secondary-button" onClick={() => updateQuery('')}>清空搜索</button>
                  </div>
                )}
          </div>
        </div>
      </div>
    </div>
  )
}
