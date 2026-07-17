import { CHANGELOG } from './changelog'
import { FAQ_ITEMS } from './faq'
import { HELP_ARTICLES, HELP_CATEGORIES } from './helpArticles'
import { SITE } from '../config/site'

export type SupportKnowledgePayload = {
  version: string
  supportEmail: string
  helpCenterPath: string
  contactPath: string
  websiteUrl: string
  categories: typeof HELP_CATEGORIES
  articles: {
    slug: string
    category: string
    title: string
    summary: string
    steps: string[]
    tips?: string[]
  }[]
  faq: { question: string; answer: string }[]
  recentChangelogHighlights: string[]
}

export function buildSupportKnowledgePayload(): SupportKnowledgePayload {
  return {
    version: SITE.currentVersion,
    supportEmail: SITE.supportEmail,
    helpCenterPath: SITE.paths.help,
    contactPath: SITE.paths.contact,
    websiteUrl: SITE.websiteUrl,
    categories: HELP_CATEGORIES,
    articles: HELP_ARTICLES.map((article) => ({
      slug: article.slug,
      category: article.category,
      title: article.title,
      summary: article.summary,
      steps: article.steps,
      tips: article.tips,
    })),
    faq: FAQ_ITEMS.map((item) => ({
      question: item.question,
      answer: item.answer,
    })),
    recentChangelogHighlights: CHANGELOG[0]?.highlights ?? [],
  }
}

export function formatSupportKnowledgeContext(payload: SupportKnowledgePayload): string {
  const lines: string[] = [
    `SlipUpClipz current public version: ${payload.version}`,
    `Support email: ${payload.supportEmail}`,
    `Help Center path: ${payload.helpCenterPath}`,
    `Contact path: ${payload.contactPath}`,
    '',
    '=== Help Center categories ===',
    ...payload.categories.map(
      (category) => `- ${category.title}: ${category.description}`,
    ),
    '',
    '=== Help Center articles ===',
  ]

  for (const article of payload.articles) {
    lines.push(`## ${article.title} (${article.slug})`)
    lines.push(article.summary)
    article.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step}`)
    })
    if (article.tips?.length) {
      lines.push(`Tips: ${article.tips.join(' ')}`)
    }
    lines.push('')
  }

  lines.push('=== FAQ ===')
  for (const item of payload.faq) {
    lines.push(`Q: ${item.question}`)
    lines.push(`A: ${item.answer}`)
    lines.push('')
  }

  if (payload.recentChangelogHighlights.length > 0) {
    lines.push('=== Recent release highlights ===')
    for (const highlight of payload.recentChangelogHighlights) {
      lines.push(`- ${highlight}`)
    }
  }

  return lines.join('\n')
}
