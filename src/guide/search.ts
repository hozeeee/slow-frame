import type { GuideBlock, GuideSection } from './content'
import { GUIDE_SECTIONS } from './content'

/** 搜索框为空时展示的快捷词，对应用户最常遇到的问题。 */
export const GUIDE_SUGGESTIONS = ['412', 'cookies', 'ffmpeg', 'macOS', 'Windows', '镜像', '代理', '两个文件']

/** 拆分搜索词：按空白分隔、忽略大小写；多个词需要同时出现在同一章节里。 */
export function parseQuery(query: string): string[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  return [...new Set(terms)]
}

/** 去掉行内标记符号，避免搜索词被 ** 或 ` 隔断；链接只保留文字部分。 */
function plain(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*|`/g, '')
}

function blockText(block: GuideBlock): string {
  switch (block.kind) {
    case 'p':
    case 'note':
      return plain(block.text)
    case 'list':
      return block.items.map(plain).join('\n')
    case 'code':
      return `${block.title ?? ''}\n${block.code}`
    case 'links':
      return block.items.map(link => `${link.label} ${link.note ?? ''} ${link.href}`).join('\n')
  }
}

const searchIndex = new Map<string, string>(GUIDE_SECTIONS.map(section => [
  section.id,
  [section.chapter, section.title, section.keywords ?? '', ...section.blocks.map(blockText)].join('\n').toLowerCase(),
]))

export function searchGuide(terms: string[]): GuideSection[] {
  if (!terms.length)
    return GUIDE_SECTIONS
  return GUIDE_SECTIONS.filter((section) => {
    const text = searchIndex.get(section.id) ?? ''
    return terms.every(term => text.includes(term))
  })
}

/** 用于在正文中高亮搜索词；长词优先，避免短词抢先匹配。 */
export function highlightPattern(terms: string[]): RegExp | null {
  if (!terms.length)
    return null
  const escaped = [...terms]
    .sort((a, b) => b.length - a.length)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`(${escaped.join('|')})`, 'gi')
}

/** 把搜索结果按章节分组，供目录展示。 */
export function groupByChapter(sections: GuideSection[]): { chapter: string, sections: GuideSection[] }[] {
  const groups: { chapter: string, sections: GuideSection[] }[] = []
  for (const section of sections) {
    const last = groups.at(-1)
    if (last?.chapter === section.chapter)
      last.sections.push(section)
    else
      groups.push({ chapter: section.chapter, sections: [section] })
  }
  return groups
}
