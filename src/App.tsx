import type { ChangeEvent, DragEvent } from 'react'
import type { OverlayKind } from './overlay'
import { useRef, useState } from 'react'
import { CropOverlay } from './components/CropOverlay'
import { CropPanel } from './components/CropPanel'
import { ExportPanel } from './components/ExportPanel'
import { GuideDialog } from './components/GuideDialog'
import { MobileSuggestion } from './components/MobileSuggestion'
import { OverlayCanvas } from './components/OverlayCanvas'
import { OverlayPanel } from './components/OverlayPanel'
import { OverlayStage } from './components/OverlayStage'
import { RangePanel } from './components/RangePanel'
import { Timeline } from './components/Timeline'
import { flipTransform, formatBytes, formatTime } from './timeMap'
import { switchMode } from './uiMode'
import { useEditor } from './useEditor'
import './styles.css'

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sessionInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  /** 图片选择的用途：null 表示新建图片图层，否则为要替换图片的图层 id。 */
  const imageTargetRef = useRef<string | null>(null)
  const [draggingFile, setDraggingFile] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
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
    overlays,
    selectedOverlay,
    overlayMarks,
    imageBitmaps,
    missingImageCount,
    keyframeSnap,
    isImageMissing,
    currentTime,
    isPreviewPlaying,
    muted,
    loading,
    error,
    notice,
    quality,
    format,
    exporting,
    progress,
    resultUrl: visibleResultUrl,
    resultSize: visibleResultSize,
    sessionReady,
    pendingRestore,
    restoreSummary,
    restoreHint,
    dirty,
    saveStatus,
    invalidRanges,
    finalDuration,
    activeSpeed,
    isTrimmed,
    outputName,
    outputWidth,
    outputHeight,
    setRanges,
    setSelectedId,
    setCropEditing,
    setMuted,
    setQuality,
    setFormat,
    chooseFile,
    restoreSession,
    discardRestore,
    leaveWorkspace,
    exportSession,
    importSession,
    addRange,
    updateRange,
    deleteRange,
    importRanges,
    updateTrim,
    resetTrim,
    updateCrop,
    chooseAspect,
    resetCrop,
    toggleFlip,
    seek,
    selectOverlay,
    addOverlay,
    updateOverlay,
    setOverlaySpan,
    deleteOverlay,
    moveOverlay,
    setOverlayBox,
    addKeyframeHere,
    deleteKeyframe,
    jumpKeyframe,
    setOverlayImage,
    togglePreview,
    beginExport,
    cancelExport,
  } = useEditor()

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0]
    if (nextFile)
      void chooseFile(nextFile)
    event.target.value = ''
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDraggingFile(false)
    const nextFile = event.dataTransfer.files[0]
    if (nextFile)
      void chooseFile(nextFile)
  }

  const onSessionFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (picked)
      void importSession(picked)
  }

  const requestImage = (layerId: string | null) => {
    imageTargetRef.current = layerId
    imageInputRef.current?.click()
  }

  const onImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked)
      return
    const target = imageTargetRef.current
    if (target)
      void setOverlayImage(target, picked)
    else void addOverlay('image', picked)
  }

  const onAddOverlay = (kind: OverlayKind) => {
    if (kind === 'image')
      requestImage(null)
    else void addOverlay(kind)
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <span>Slow Frame</span>
        </div>
        <div className="topbar-actions">
          <button type="button" className="guide-button" onClick={() => setGuideOpen(true)}>
            <b aria-hidden="true">?</b>
            <span>视频下载说明</span>
          </button>
          <div className="privacy-pill">
            <span className="status-dot" />
            100% 浏览器本地处理
          </div>
        </div>
      </header>

      {!file
        ? (
            <section className="welcome">
              <div className="hero-copy">
                <p className="eyebrow">LOCAL VIDEO RETIMER</p>
                <h1>
                  让关键帧，
                  <br />
                  <em>慢一点。</em>
                </h1>
                <p className="lead">在时间轴上框选任意片段，设置慢放或加速倍率。视频不会上传，处理和导出都在你的浏览器完成。</p>
                <div className="feature-row">
                  <span>MP4 / MOV / WebM</span>
                  <i />
                  <span>多区间独立变速</span>
                  <i />
                  <span>裁剪</span>
                  <i />
                  <span>水印 / 打码</span>
                  <i />
                  <span>音画同步</span>
                </div>
                <button type="button" className="hero-guide-link" onClick={() => setGuideOpen(true)}>没有本地视频？查看如何用 yt-dlp 下载网站视频 →</button>
              </div>
              <div
                className={`dropzone ${draggingFile ? 'dragging' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDraggingFile(true)
                }}
                onDragLeave={() => setDraggingFile(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="drop-icon">↗</div>
                <h2>拖入一个视频</h2>
                <p>或点击选择本地文件</p>
                <button className="primary-button">选择视频</button>
                <small>文件只停留在当前页面，不会被上传 · 编辑会缓存在本浏览器</small>
              </div>
              {error && <div className="global-error">{error}</div>}
            </section>
          )
        : (
            <section className="workspace">
              <div className="workspace-heading">
                <div className="heading-title">
                  <button className="back-button" onClick={leaveWorkspace}>← 更换视频</button>
                  <h1>{file.name}</h1>
                  <p>
                    {formatBytes(file.size)}
                    {' '}
                    {info && `· ${info.width}×${info.height} · ${info.fps.toFixed(1)} fps · ${info.videoCodec.toUpperCase()}`}
                  </p>
                </div>
                <div className="heading-side">
                  {info && (
                    <div className="record-tools">
                      <span className={`save-status ${dirty ? 'dirty' : ''}`}>
                        <i />
                        {saveStatus}
                      </span>
                      <div>
                        <button className="secondary-button" disabled={!sessionReady || exporting} onClick={() => sessionInputRef.current?.click()}>导入记录</button>
                        <button className="secondary-button" disabled={!sessionReady} onClick={exportSession}>↓ 导出记录</button>
                      </div>
                    </div>
                  )}
                  <div className="duration-summary">
                    <span>预计导出时长</span>
                    <strong>{formatTime(finalDuration)}</strong>
                    {info && (
                      <small>
                        原始
                        {formatTime(info.duration)}
                      </small>
                    )}
                  </div>
                </div>
              </div>

              {error && <div className="global-error">{error}</div>}
              {loading || !info
                ? (
                    <div className="loading-card">
                      <span className="spinner" />
                      正在分析视频轨道…
                    </div>
                  )
                : (
                    <div className="editor-grid">
                      <div className="editor-main">
                        <div className={`video-card ${cropEditing ? 'cropping' : ''}`}>
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
                            onClick={togglePreview}
                          />
                          <OverlayCanvas videoRef={videoRef} videoWidth={info.width} videoHeight={info.height} flip={flip} overlays={overlays} images={imageBitmaps} currentTime={currentTime} playing={isPreviewPlaying} />
                          <CropOverlay videoWidth={info.width} videoHeight={info.height} crop={crop} aspect={cropAspect} editing={cropEditing} onChange={updateCrop} />
                          <OverlayStage
                            videoWidth={info.width}
                            videoHeight={info.height}
                            flip={flip}
                            layer={selectedOverlay}
                            currentTime={currentTime}
                            active={!isPreviewPlaying && !cropEditing && !exporting}
                            imageMissing={Boolean(selectedOverlay && isImageMissing(selectedOverlay))}
                            snap={keyframeSnap}
                            onChange={(box) => {
                              if (selectedOverlay)
                                setOverlayBox(selectedOverlay.id, box)
                            }}
                            onRequestImage={() => {
                              if (selectedOverlay)
                                requestImage(selectedOverlay.id)
                            }}
                          />
                          {cropEditing
                            ? (
                                <div className="crop-toolbar">
                                  <span>拖动框体移动 · 拖动四角缩放</span>
                                  <button onClick={() => setCropEditing(false)}>✓ 完成</button>
                                </div>
                              )
                            : (
                                <>
                                  <div className="preview-badge">
                                    <span>
                                      {activeSpeed}
                                      ×
                                    </span>
                                    {activeSpeed < 0.1 ? '逐帧预览 · 静音' : '实时预览'}
                                  </div>
                                  <div className="video-controls">
                                    <button aria-label={isPreviewPlaying ? '暂停' : '播放'} onClick={togglePreview}>{isPreviewPlaying ? 'Ⅱ' : '▶'}</button>
                                    <span>{formatTime(currentTime, false)}</span>
                                    <input aria-label="播放进度" type="range" min="0" max={info.duration} step="0.001" value={currentTime} onChange={event => seek(Number(event.target.value))} />
                                    <span>{formatTime(info.duration, false)}</span>
                                    <button aria-label={muted ? '打开声音' : '静音'} onClick={() => setMuted(value => !value)}>{muted ? '🔇' : '♫'}</button>
                                  </div>
                                </>
                              )}
                        </div>
                        <div className="timeline-card">
                          <div className="section-title-row">
                            <div>
                              <p className="section-kicker">TIMELINE</p>
                              <h2>速度时间轴</h2>
                            </div>
                            <button className="secondary-button" onClick={addRange}>＋ 在播放头添加区间</button>
                          </div>
                          <Timeline duration={info.duration} currentTime={currentTime} ranges={ranges} trim={trim} selectedId={selectedId} onSeek={seek} onSelect={setSelectedId} onRangesChange={setRanges} onTrimChange={updateTrim} overlayMarks={overlayMarks} />
                          <div className="legend">
                            <span className="slow-swatch" />
                            慢放 &lt; 1×
                            {' '}
                            <span className="fast-swatch" />
                            加速 &gt; 1×
                            {' '}
                            <span className="trim-swatch" />
                            裁掉
                            {overlayMarks && (
                              <>
                                {' '}
                                <span className="keyframe-swatch" />
                                图层关键帧
                              </>
                            )}
                          </div>
                        </div>
                        <CropPanel
                          info={info}
                          trim={trim}
                          crop={crop}
                          cropAspect={cropAspect}
                          cropEditing={cropEditing}
                          flip={flip}
                          currentTime={currentTime}
                          exporting={exporting}
                          isTrimmed={isTrimmed}
                          outputWidth={outputWidth}
                          outputHeight={outputHeight}
                          onTrimChange={updateTrim}
                          onTrimReset={resetTrim}
                          onAspectChange={chooseAspect}
                          onCropReset={resetCrop}
                          onToggleEditing={() => setCropEditing(value => !value)}
                          onToggleFlip={toggleFlip}
                        />
                        <OverlayPanel
                          info={info}
                          overlays={overlays}
                          selected={selectedOverlay}
                          currentTime={currentTime}
                          snap={keyframeSnap}
                          exporting={exporting}
                          isImageMissing={isImageMissing}
                          onAdd={onAddOverlay}
                          onSelect={selectOverlay}
                          onUpdate={updateOverlay}
                          onSpanChange={setOverlaySpan}
                          onDelete={deleteOverlay}
                          onMove={moveOverlay}
                          onAddKeyframe={addKeyframeHere}
                          onDeleteKeyframe={deleteKeyframe}
                          onJumpKeyframe={jumpKeyframe}
                          onSeek={seek}
                          onRequestImage={requestImage}
                        />
                      </div>

                      <aside className="side-panel">
                        <RangePanel ranges={orderedRanges} trim={trim} info={info} fileName={file.name} selectedId={selectedId} invalid={invalidRanges} onSelect={setSelectedId} onUpdate={updateRange} onDelete={deleteRange} onImport={importRanges} />
                        <ExportPanel
                          info={info}
                          quality={quality}
                          format={format}
                          originalSize={file.size}
                          outputSize={visibleResultSize}
                          outputName={outputName}
                          resultUrl={visibleResultUrl}
                          exporting={exporting}
                          progress={progress}
                          disabled={invalidRanges}
                          missingImageCount={missingImageCount}
                          onQualityChange={setQuality}
                          onFormatChange={setFormat}
                          onExport={() => void beginExport()}
                          onCancel={cancelExport}
                        />
                      </aside>
                    </div>
                  )}
            </section>
          )}

      {guideOpen && <GuideDialog onClose={() => setGuideOpen(false)} />}
      {pendingRestore && info && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="restore-title">
          <div className="modal-card">
            <p className="section-kicker">RESTORE</p>
            <h2 id="restore-title">发现上次的编辑记录</h2>
            <p>
              这个视频在
              <b>{new Date(pendingRestore.updatedAt).toLocaleString()}</b>
              {' '}
              留有编辑记录：
            </p>
            <div className="restore-summary">{restoreSummary}</div>
            <p className="modal-hint">
              {restoreHint}
              选择“从头开始”后，新的编辑会覆盖这份缓存。
            </p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={discardRestore}>从头开始</button>
              <button className="primary-button" onClick={restoreSession}>导入上次编辑</button>
            </div>
          </div>
        </div>
      )}
      {!file && <MobileSuggestion />}
      {notice && <div className="toast" role="status">{notice}</div>}
      <input ref={fileInputRef} className="file-input" type="file" accept="video/*,.mkv,.webm,.mov,.mp4" onChange={onFileChange} />
      <input ref={sessionInputRef} className="file-input" type="file" accept=".json,application/json" onChange={onSessionFileChange} />
      <input ref={imageInputRef} className="file-input" type="file" accept="image/*" onChange={onImageFileChange} />
      <footer>
        <span>Slow Frame</span>
        <p>Private by design · No uploads · No tracking</p>
        <button className="footer-link" onClick={() => switchMode('mobile')}>切换到移动版</button>
      </footer>
    </main>
  )
}

export default App
