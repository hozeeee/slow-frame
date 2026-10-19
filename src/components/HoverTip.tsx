import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const TIP_WIDTH = 300
const MARGIN = 12

interface HoverTipProps {
  tip: ReactNode
  children: ReactNode
}

/** 悬停或聚焦时显示的说明气泡；挂到 body 上，避免被侧栏的滚动容器裁掉。 */
export function HoverTip({ tip, children }: HoverTipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [style, setStyle] = useState<CSSProperties | null>(null)

  useEffect(() => {
    if (!style)
      return
    const hide = () => setStyle(null)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [style])

  const show = () => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect)
      return
    const left = Math.max(MARGIN, Math.min(window.innerWidth - TIP_WIDTH - MARGIN, rect.left + rect.width / 2 - TIP_WIDTH / 2))
    // 靠近窗口底部时改为显示在上方。
    const vertical = rect.bottom > window.innerHeight * 0.6
      ? { bottom: window.innerHeight - rect.top + 8 }
      : { top: rect.bottom + 8 }
    setStyle({ left, width: TIP_WIDTH, ...vertical })
  }
  const hide = () => setStyle(null)

  return (
    <span ref={anchorRef} className="hover-tip-anchor" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onClickCapture={hide}>
      {children}
      {style && createPortal(<div className="hover-tip" role="tooltip" style={style}>{tip}</div>, document.body)}
    </span>
  )
}
