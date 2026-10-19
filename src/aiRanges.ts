import type { MediaInfo } from './media'
import type { SpeedRange, TrimRange } from './timeMap'
import { clampRange, formatTime, MAX_SPEED, MIN_RANGE_SECONDS, MIN_SPEED, sortRanges } from './timeMap'

/** 单次导入的区间上限，防止异常数据让界面卡顿。 */
export const MAX_IMPORT_RANGES = 200
const DEFAULT_SPEED = 0.5
const MAX_NAME = 40

export type RangeImportMode = 'replace' | 'append'

export interface RangeImport {
  ranges: SpeedRange[]
  /** 时间或速度无法识别、超出视频时长或被重叠完全覆盖而丢弃的条目数。 */
  dropped: number
  /** 因超出视频范围、速度越界或与前一个区间重叠而被修正的条目数。 */
  adjusted: number
}

const seconds = (value: number) => value.toFixed(3)

/** 悬停提示和移动端说明共用的使用步骤。 */
export const PROMPT_STEPS = [
  '点击复制提示词，其中已带上当前视频的时长、帧率和分辨率。',
  '打开支持上传视频的 AI（如 Gemini），上传这段视频并粘贴提示词。',
  '可在提示词的「我的要求」里补充想标注的动作和慢放倍率。',
]

export const IMPORT_STEPS = [
  '复制 AI 返回的 JSON，整段回复也可以，会自动提取其中的代码块。',
  '粘贴后核对识别出的区间，再选择替换或追加到现有区间。',
  '时间按原视频秒数计算；超出时长或互相重叠的区间会自动修正。',
]

/** 生成交给外部 AI 的提示词：附上视频参数和输出格式，让 AI 返回可直接导入的区间 JSON。 */
export function buildRangePrompt(info: MediaInfo, fileName: string, trim: TrimRange): string {
  const trimmed = trim.start > 1e-3 || trim.end < info.duration - 1e-3
  const frame = info.fps > 0 ? 1 / info.fps : 0
  return [
    '你是一名体育 / 运动视频剪辑助手。我会附上一段视频，请仔细观看，找出其中的关键击球、得分和其他高光时刻，为每个时刻生成一个「慢放区间」。结果会被导入视频变速工具 Slow Frame。',
    '',
    '## 视频信息',
    `- 文件名：${fileName}`,
    `- 总时长：${seconds(info.duration)} 秒（${formatTime(info.duration)}）`,
    `- 帧率：约 ${info.fps.toFixed(2)} fps${frame ? `（1 帧 ≈ ${seconds(frame)} 秒）` : ''}`,
    `- 分辨率：${info.width}×${info.height}`,
    ...(trimmed ? [`- 成片只保留 ${seconds(trim.start)} – ${seconds(trim.end)} 秒，请只标注这一段内的时刻`] : []),
    '',
    '## 我的要求',
    '（可在此补充，例如：只标记扣杀和反手；慢放统一 0.25 倍；每个区间前后多留 0.5 秒……没有补充就按下面的规则处理。）',
    '',
    '## 标注规则',
    '1. 时间单位为秒，从视频开头 0 秒起算，按原视频的时间轴计算（不要考虑变速后的时长），保留 3 位小数，尽量精确到帧。',
    '2. 每个区间要覆盖动作的完整过程：从引拍 / 起跳前约 0.3–0.8 秒开始，到击球后随挥结束或球飞出约 0.3–0.8 秒为止；单个区间一般 0.5–4 秒。',
    `3. speed 为播放倍速：0.5 表示半速，0.25 表示四分之一速。越精彩的瞬间越慢，建议 0.2–0.5；允许范围 ${MIN_SPEED}–${MAX_SPEED}，大于 1 表示加速，仅在我明确要求压缩平淡片段时使用。`,
    `4. 区间之间不能重叠，按 start 从小到大排列；end 必须大于 start，且不超过视频总时长 ${seconds(info.duration)} 秒。`,
    '5. name 用不超过 20 个字的中文简短描述，例如「第 3 拍 正手扣杀」。',
    '6. 只标注你在画面里确实看到的动作，不确定的宁可不标，不要编造时间点。',
    '',
    '## 输出格式',
    '只输出一个 JSON 代码块，不要附加任何解释。下面的数值只是格式示意：',
    '```json',
    '{',
    '  "app": "slow-frame-ranges",',
    '  "version": 1,',
    '  "ranges": [',
    '    { "name": "正手扣杀", "start": 3.200, "end": 4.650, "speed": 0.25 },',
    '    { "name": "网前挑球", "start": 8.100, "end": 9.000, "speed": 0.5 }',
    '  ]',
    '}',
    '```',
  ].join('\n')
}

/** 从 AI 回复里取出 JSON：兼容 ```json 代码块和前后夹杂的说明文字。 */
function extractJson(text: string): string {
  const fenced = /```(?:json)?([\s\S]*?)```/i.exec(text)
  const body = (fenced ? fenced[1] : text).trim()
  const start = body.search(/[[{]/)
  if (start <= 0)
    return body
  const end = body.lastIndexOf(body[start] === '{' ? '}' : ']')
  return end > start ? body.slice(start, end + 1) : body.slice(start)
}

/** 接受秒数（数字或 "12.5" / "12.5s"）以及 "mm:ss.sss"、"hh:mm:ss" 形式的时间码。 */
function parseSeconds(value: unknown): number | null {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : null
  if (typeof value !== 'string')
    return null
  const text = value.trim().replace(/s$/i, '').replace(',', '.').trim()
  if (/^\d+(?:\.\d+)?$/.test(text))
    return Number(text)
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(text)
  return match ? Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null
}

/** 接受数字或 "0.25x" / "0.25×" 形式的倍速。 */
function parseSpeed(value: unknown): number | null {
  if (value === undefined || value === null)
    return DEFAULT_SPEED
  if (typeof value === 'number')
    return Number.isFinite(value) && value > 0 ? value : null
  if (typeof value !== 'string')
    return null
  const match = /^(\d+(?:\.\d+)?)\s*[x×]?$/i.exec(value.trim())
  return match && Number(match[1]) > 0 ? Number(match[1]) : null
}

function rangeItems(data: unknown): unknown[] | null {
  if (Array.isArray(data))
    return data
  const record = (data ?? {}) as { ranges?: unknown, edit?: { ranges?: unknown } }
  if (Array.isArray(record.ranges))
    return record.ranges
  // 也接受 Slow Frame 自己导出的编辑记录。
  const nested = record.edit?.ranges
  return Array.isArray(nested) ? nested : null
}

/** 解析 AI 返回的区间 JSON，并校正到当前视频的合法范围内；无法得到任何可用区间时抛出错误。 */
export function parseRangeJson(text: string, duration: number): RangeImport {
  if (!text.trim())
    throw new Error('请先粘贴 AI 返回的 JSON。')
  let data: unknown
  try {
    data = JSON.parse(extractJson(text))
  }
  catch {
    throw new Error('无法解析为 JSON，请确认复制了 AI 返回的完整代码块。')
  }
  const items = rangeItems(data)
  if (!items)
    throw new Error('JSON 中没有找到 ranges 数组。')
  if (!items.length)
    throw new Error('ranges 数组是空的，AI 没有标注任何区间。')

  let dropped = Math.max(0, items.length - MAX_IMPORT_RANGES)
  const adjusted = new Set<string>()
  const candidates: SpeedRange[] = []
  for (const raw of items.slice(0, MAX_IMPORT_RANGES)) {
    const item = (raw ?? {}) as Record<string, unknown>
    const start = parseSeconds(item.start ?? item.startTime ?? item.from)
    const end = parseSeconds(item.end ?? item.endTime ?? item.to)
    const speed = parseSpeed(item.speed)
    if (start === null || end === null || speed === null || end <= 0 || start >= duration || end - start < MIN_RANGE_SECONDS) {
      dropped++
      continue
    }
    const label = item.name ?? item.label ?? item.title
    const name = typeof label === 'string' ? label.trim().slice(0, MAX_NAME) || undefined : undefined
    const range = clampRange({ id: crypto.randomUUID(), name, start, end, speed }, duration)
    if (Math.abs(range.start - start) > 1e-6 || Math.abs(range.end - end) > 1e-6 || range.speed !== speed)
      adjusted.add(range.id)
    candidates.push(range)
  }

  // AI 给的前后余量常会互相重叠：把后一个区间的开头挪到前一个的结尾，挪完太短的直接丢弃。
  const ranges: SpeedRange[] = []
  for (const range of sortRanges(candidates)) {
    const previous = ranges[ranges.length - 1]
    if (!previous || range.start >= previous.end - 1e-6) {
      ranges.push(range)
      continue
    }
    if (range.end - previous.end < MIN_RANGE_SECONDS) {
      dropped++
      adjusted.delete(range.id)
      continue
    }
    ranges.push({ ...range, start: previous.end })
    adjusted.add(range.id)
  }

  if (!ranges.length)
    throw new Error('没有可用的区间：请检查时间是否在视频时长内，且 end 大于 start。')
  return { ranges, dropped, adjusted: adjusted.size }
}

/** 追加导入的区间，跳过与现有区间重叠的部分。 */
export function appendRanges(existing: SpeedRange[], incoming: SpeedRange[]): { ranges: SpeedRange[], skipped: number } {
  const kept = incoming.filter(range => !existing.some(other => range.start < other.end - 1e-6 && other.start < range.end - 1e-6))
  return { ranges: [...existing, ...kept], skipped: incoming.length - kept.length }
}

/** 导入预览里展示的提醒：哪些条目被忽略、修正，或落在裁掉的部分。 */
export function importWarnings(result: RangeImport, trim: TrimRange): string[] {
  const outside = result.ranges.filter(range => range.end <= trim.start || range.start >= trim.end).length
  const warnings: string[] = []
  if (result.dropped)
    warnings.push(`${result.dropped} 条无法识别或超出视频时长，已忽略`)
  if (result.adjusted)
    warnings.push(`${result.adjusted} 个区间超出范围或互相重叠，已自动修正`)
  if (outside)
    warnings.push(`${outside} 个区间位于已裁掉的部分，不会出现在成片中`)
  return warnings
}

/** 文本为空时不报错，只是没有结果。 */
export function tryParseRangeJson(text: string, duration: number): { result: RangeImport | null, error: string | null } {
  if (!text.trim())
    return { result: null, error: null }
  try {
    return { result: parseRangeJson(text, duration), error: null }
  }
  catch (reason) {
    return { result: null, error: reason instanceof Error ? reason.message : '无法识别该 JSON。' }
  }
}
