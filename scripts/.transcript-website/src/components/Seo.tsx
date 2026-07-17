import { useEffect } from 'react'
import { SITE } from '../config/site'

type SeoProps = {
  title: string
  description: string
  path?: string
}

export function Seo({ title, description, path = '/' }: SeoProps) {
  const fullTitle = title.includes('SlipUpClipz') ? title : `${title} · SlipUpClipz`
  const url = `${SITE.websiteUrl}${path}`

  useEffect(() => {
    document.title = fullTitle

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        if (selector.includes('property=')) {
          el.setAttribute('property', selector.match(/property="([^"]+)"/)?.[1] ?? '')
        } else {
          el.setAttribute('name', selector.match(/name="([^"]+)"/)?.[1] ?? '')
        }
        document.head.appendChild(el)
      }
      el.setAttribute(attr, value)
    }

    setMeta('meta[name="description"]', 'content', description)
    setMeta('meta[property="og:title"]', 'content', fullTitle)
    setMeta('meta[property="og:description"]', 'content', description)
    setMeta('meta[property="og:url"]', 'content', url)
    setMeta('meta[property="og:image"]', 'content', `${SITE.websiteUrl}/images/og-preview.svg`)
    setMeta('meta[name="twitter:title"]', 'content', fullTitle)
    setMeta('meta[name="twitter:description"]', 'content', description)

    let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = url
  }, [fullTitle, description, url])

  return null
}
