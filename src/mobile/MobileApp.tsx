import type { ChangeEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { flipTransform, formatBytes, formatTime, isFlipped } from '../timeMap'
import { switchMode } from '../uiMode'
import { useEditor } from '../useEditor'
import { CropOverlay } from './components/CropOverlay'
import { CropTab } from './components/CropTab'
import { ExportTab } from './components/ExportTab'
import { RangesTab } from './components/RangesTab'
import { Sheet } from './components/Sheet'
import { Timeline } from './components/Timeline'
import './mobile.css'

type Tab = 'ranges' | 'crop' | 'export'

/** 导出期间保持屏幕常亮，避免手机自动锁屏导致页面被挂起、编码中断。 */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator))
      return
    let sentinel: WakeLockSentinel | null = null
    let disposed = false
    const request = () => navigator.wakeLock.request('screen')
      .then((next) => {
        if (disposed)
          void next.release()
        else sentinel = next
      })
      .catch(() => undefined)
    const onVisibility = () => {
      if (document.visibilityState === 'visible')
        void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release()
    }
  }, [active])
}

export default function MobileApp() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sessionInputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('ranges')
  const [menuOpen, setMenuOpen] = useState(false)
  const editor = useEditor()
  const {
    videoRef,
    file,
    mediaUrl,
    info,
    ranges,
    orderedRanges,
    trim,
    crop,
    cropAspect,
    cropEditing,
    flip,
    selectedId,
    currentTime,
    isPreviewPlaying,
    muted,
    loading,
    error,
    notice,
    exporting,
    progress,
    resultUrl,
    pendingRestore,
    sessionReady,
    dirty,
    saveStatus,
    activeSpeed,
    finalDuration,
    isTrimmed,
  } = editor

  useWakeLock(exporting)

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0]
    event.target.value = ''
    if (nextFile) {
      setTab('ranges')
      void editor.chooseFile(nextFile)
    }
  }

  const onSessionFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (picked)
      void editor.importSession(picked)
  }

  const selectRange = (id: string | null) => {
    editor.setSelectedId(id)
    if (id)
      setTab('ranges')
  }

  const addRange = () => {
    editor.addRange()
    setTab('ranges')
  }

  const closeMenu = () => setMenuOpen(false)
  const hiddenInputs = (
    <>
      <input ref={fileInputRef} className="m-file-input" type="file" accept="video/*,.mkv,.webm,.mov,.mp4" onChange={onFileChange} />
      <input ref={sessionInputRef} className="m-file-input" type="file" accept=".json,application/json" onChange={onSessionFileChange} />
    </>
  )
  const toast = notice && <div className="m-toast" role="status">{notice}</div>

  if (!file) {
    return (
      <div className="m-app m-welcome">
        <header className="m-welcome-bar">
          <span className="m-brand">
            <span className="m-brand-mark">S</span>
            Slow Frame
          </span>
          <span className="m-privacy">
            <i />
            本地处理
          </span>
        </header>
        <section className="m-hero">
          <p className="m-kicker">LOCAL VIDEO RETIMER</p>
          <h1>
            让关键帧，
            <br />
            <em>慢一点。</em>
          </h1>
          <p>在时间轴上框选任意片段，设置慢放或加速倍率。视频不会上传，处理和导出都在你的手机浏览器里完成。</p>
          <ul className="m-features">
            <li>MP4 / MOV / WebM</li>
            <li>多区间独立变速</li>
            <li>裁剪</li>
            <li>音画同步</li>
          </ul>
        </section>
        {error && <div className="m-error" role="alert">{error}</div>}
        <div className="m-welcome-actions">
          <button type="button" className="m-block-button primary large" onClick={() => fileInputRef.current?.click()}>
            <span aria-hidden="true">↗</span>
            选择视频
          </button>
          <small>文件只停留在当前页面，不会被上传 · 编辑会缓存在本浏览器</small>
          <button type="button" className="m-switch-link" onClick={() => switchMode('desktop')}>切换到桌面版</button>
        </div>
        {toast}
        {hiddenInputs}
      </div>
    )
  }

  const cropBadge = isTrimmed || crop || isFlipped(flip)
  return (
    <div className={`m-app m-workspace ${cropEditing ? 'cropping' : ''}`}>
      <header className="m-topbar">
        <button type="button" className="m-icon-button" aria-label="更换视频" onClick={editor.leaveWorkspace}>‹</button>
        <div className="m-title">
          <strong>{file.name}</strong>
          <small>
            {formatBytes(file.size)}
            {info && ` · ${info.width}×${info.height} · ${info.fps.toFixed(1)} fps · ${info.videoCodec.toUpperCase()}`}
          </small>
        </div>
        <button type="button" className="m-icon-button" aria-label="编辑记录与更多操作" onClick={() => setMenuOpen(true)}>
          ⋯
          {dirty && <i className="m-dot" />}
        </button>
      </header>

      {error && <div className="m-error" role="alert">{error}</div>}

      {loading || !info
        ? (
            <div className="m-loading">
              <span className="m-spinner" />
              正在分析视频轨道…
            </div>
          )
        : (
            <>
              <div className="m-stage">
                <video
                  ref={(node) => {
                    videoRef.current = node
                    if (node)
                      node.preservesPitch = false
                  }}
                  src={mediaUrl ?? undefined}
                  playsInline
                  preload="metadata"
                  style={{ transform: flipTransform(flip) }}
                  onClick={cropEditing ? undefined : editor.togglePreview}
                />
                <CropOverlay videoWidth={info.width} videoHeight={info.height} crop={crop} aspect={cropAspect} editing={cropEditing} onChange={editor.updateCrop} />
                {!cropEditing && (
                  <>
                    <div className="m-badge">
                      <b>
                        {activeSpeed}
                        ×
                      </b>
                      {activeSpeed < 0.1 ? '逐帧预览 · 静音' : '实时预览'}
                    </div>
                    {!isPreviewPlaying && <span className="m-stage-play" aria-hidden="true">▶</span>}
                  </>
                )}
              </div>

              {cropEditing
                ? (
                    <div className="m-transport crop">
                      <span>拖动框体移动 · 拖动四角缩放</span>
                      <button type="button" onClick={() => editor.setCropEditing(false)}>✓ 完成</button>
                    </div>
                  )
                : (
                    <div className="m-transport">
                      <button type="button" className="m-play" aria-label={isPreviewPlaying ? '暂停' : '播放'} onClick={editor.togglePreview}>{isPreviewPlaying ? 'Ⅱ' : '▶'}</button>
                      <div className="m-clock">
                        <strong>{formatTime(currentTime)}</strong>
                        <small>
                          {'/ '}
                          {formatTime(info.duration, false)}
                        </small>
                      </div>
                      <div className="m-output">
                        <small>预计导出</small>
                        <strong>{formatTime(finalDuration)}</strong>
                      </div>
                      <button type="button" className="m-icon-button" aria-label={muted ? '打开声音' : '静音'} onClick={() => editor.setMuted(value => !value)}>{muted ? '🔇' : '♫'}</button>
                    </div>
                  )}

              <Timeline
                duration={info.duration}
                currentTime={currentTime}
                ranges={ranges}
                trim={trim}
                selectedId={selectedId}
                onSeek={editor.seek}
                onSelect={selectRange}
                onRangesChange={editor.setRanges}
                onTrimChange={editor.updateTrim}
              />

              <div className="m-scroll">
                {tab === 'ranges' && (
                  <RangesTab
                    ranges={orderedRanges}
                    trim={trim}
                    duration={info.duration}
                    frameStep={1 / Math.max(1, info.fps)}
                    currentTime={currentTime}
                    selectedId={selectedId}
                    invalid={editor.invalidRanges}
                    onAdd={addRange}
                    onSelect={editor.setSelectedId}
                    onSeek={editor.seek}
                    onUpdate={editor.updateRange}
                    onDelete={editor.deleteRange}
                  />
                )}
                {tab === 'crop' && (
                  <CropTab
                    info={info}
                    trim={trim}
                    crop={crop}
                    cropAspect={cropAspect}
                    cropEditing={cropEditing}
                    flip={flip}
                    currentTime={currentTime}
                    frameStep={1 / Math.max(1, info.fps)}
                    exporting={exporting}
                    isTrimmed={isTrimmed}
                    outputWidth={editor.outputWidth}
                    outputHeight={editor.outputHeight}
                    onTrimChange={editor.updateTrim}
                    onTrimReset={editor.resetTrim}
                    onAspectChange={editor.chooseAspect}
                    onCropReset={editor.resetCrop}
                    onToggleEditing={() => editor.setCropEditing(value => !value)}
                    onToggleFlip={editor.toggleFlip}
                  />
                )}
                {tab === 'export' && (
                  <ExportTab
                    info={info}
                    quality={editor.quality}
                    format={editor.format}
                    finalDuration={finalDuration}
                    originalSize={file.size}
                    outputSize={editor.resultSize}
                    outputName={editor.outputName}
                    resultUrl={resultUrl}
                    exporting={exporting}
                    progress={progress}
                    disabled={editor.invalidRanges}
                    onQualityChange={editor.setQuality}
                    onFormatChange={editor.setFormat}
                    onExport={() => void editor.beginExport()}
                    onCancel={editor.cancelExport}
                    onNotice={editor.setNotice}
                  />
                )}
              </div>

              <nav className="m-tabbar" aria-label="编辑面板">
                <button type="button" className={tab === 'ranges' ? 'active' : ''} aria-current={tab === 'ranges'} onClick={() => setTab('ranges')}>
                  <span className="m-tab-icon">⌁</span>
                  变速
                  {ranges.length > 0 && <em>{ranges.length}</em>}
                </button>
                <button type="button" className={tab === 'crop' ? 'active' : ''} aria-current={tab === 'crop'} onClick={() => setTab('crop')}>
                  <span className="m-tab-icon">⌗</span>
                  裁剪
                  {cropBadge && <i className="m-dot" />}
                </button>
                <button type="button" className={tab === 'export' ? 'active' : ''} aria-current={tab === 'export'} onClick={() => setTab('export')}>
                  <span className="m-tab-icon">↓</span>
                  导出
                  {exporting
                    ? (
                        <em>
                          {Math.round(progress * 100)}
                          %
                        </em>
                      )
                    : resultUrl && <em className="done">✓</em>}
                </button>
              </nav>
            </>
          )}

      {pendingRestore && info && (
        <Sheet kicker="RESTORE" title="发现上次的编辑记录">
          <p>
            这个视频在
            {' '}
            <b>{new Date(pendingRestore.updatedAt).toLocaleString()}</b>
            {' '}
            留有编辑记录：
          </p>
          <div className="m-restore-summary">{editor.restoreSummary}</div>
          <p className="m-hint">
            {editor.restoreHint}
            选择“从头开始”后，新的编辑会覆盖这份缓存。
          </p>
          <div className="m-sheet-actions">
            <button type="button" className="m-block-button primary" onClick={editor.restoreSession}>导入上次编辑</button>
            <button type="button" className="m-block-button outline" onClick={editor.discardRestore}>从头开始</button>
          </div>
        </Sheet>
      )}

      {menuOpen && (
        <Sheet kicker="RECORD" title="编辑记录" onClose={closeMenu}>
          {saveStatus && (
            <p className={`m-save-status ${dirty ? 'dirty' : ''}`}>
              <i />
              {saveStatus}
            </p>
          )}
          <div className="m-menu">
            <button
              type="button"
              disabled={!sessionReady || exporting}
              onClick={() => {
                closeMenu()
                sessionInputRef.current?.click()
              }}
            >
              导入编辑记录
              <small>从 .slowframe.json 文件恢复</small>
            </button>
            <button
              type="button"
              disabled={!sessionReady}
              onClick={() => {
                closeMenu()
                editor.exportSession()
              }}
            >
              ↓ 导出编辑记录
              <small>保存为 JSON，之后可再导入</small>
            </button>
            <button
              type="button"
              onClick={() => {
                closeMenu()
                editor.leaveWorkspace()
              }}
            >
              更换视频
            </button>
            <button type="button" onClick={() => switchMode('desktop')}>
              切换到桌面版
              <small>会记住这次选择，编辑已自动缓存，可在桌面版恢复</small>
            </button>
          </div>
          <button type="button" className="m-block-button ghost" onClick={closeMenu}>取消</button>
        </Sheet>
      )}

      {toast}
      {hiddenInputs}
    </div>
  )
}
