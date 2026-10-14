import type { ReactNode } from 'react'

interface SheetProps {
  title: string
  kicker?: string
  /** 提供时点击遮罩可关闭；不提供则必须通过面板内的按钮做出选择。 */
  onClose?: () => void
  children: ReactNode
}

/** 从屏幕底部弹出的面板，替代桌面端居中的模态框。 */
export function Sheet({ title, kicker, onClose, children }: SheetProps) {
  return (
    <div className="m-sheet-backdrop" onClick={onClose}>
      <div className="m-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()}>
        <i className="m-sheet-grabber" />
        {kicker && <p className="m-kicker">{kicker}</p>}
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}
