import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Static preview only. Never allow a browser test to send data to external services.
test.beforeEach(async ({ context }) => {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://127.0.0.1:4174') return route.abort()
    if (url.pathname.startsWith('/.netlify/')) {
      const body = url.pathname.endsWith('/pricing-quote') ?
        { verified: false, source: 'advertised', regularCents: 499, firstYearCents: 399, discountCents: 100, currency: 'usd', interval: 'year', livemode: null } :
        { error: 'Offline preview: no external service was called.' }
      return route.fulfill({ status: url.pathname.endsWith('/pricing-quote') ? 200 : 503, json: body })
    }
    return route.continue()
  })
})

const routes = ['/', '/features', '/how-it-works', '/pricing', '/download', '/help', '/contact', '/faq', '/changelog', '/privacy', '/terms', '/refund', '/cookies']
for (const path of routes) {
  test(`route, media, accessibility ${path}`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('h1')).toHaveCount(1)
    for (const img of await page.locator('img').all()) {
      await img.scrollIntoViewIfNeeded()
      await expect(img).toHaveJSProperty('complete',true)
    }
    const broken = await page.locator('img').evaluateAll(images => images.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src))
    expect(broken).toEqual([])
    const results = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
    expect(results.violations.map(v => ({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('every rendered internal route and anchor resolves, including help articles', async ({ page }) => {
  const pending = [...routes]
  const seen = new Set<string>()
  while (pending.length) {
    const path = pending.shift()!
    if (seen.has(path)) continue
    seen.add(path)
    await page.goto(path)
    await expect(page.getByText('Page not found', { exact: true })).toHaveCount(0)
    if (path.includes('#')) {
      expect(await page.evaluate(() => !!document.getElementById(decodeURIComponent(location.hash.slice(1))))).toBe(true)
    }
    const links = await page.locator('a[href]').evaluateAll(links => links.map(a => (a as HTMLAnchorElement).href))
    for (const href of links) {
      const u = new URL(href)
      if (u.origin !== 'http://127.0.0.1:4174' || u.pathname.startsWith('/.netlify/') || u.pathname === '/download/latest') continue
      const target = u.pathname + u.hash
      if (!seen.has(target) && !pending.includes(target)) pending.push(target)
    }
    expect(seen.size).toBeLessThan(130)
  }
  expect(seen.size).toBeGreaterThan(25)
})

test('desktop disclosure hover, pointer bridge, keyboard, escape and outside click', async ({ page }) => {
  await page.goto('/')
  const explore=page.getByRole('button',{name:'Explore',exact:true})
  await explore.hover()
  await expect(explore).toHaveAttribute('aria-expanded','true')
  await page.getByRole('link',{name:'Features Clipping',exact:false}).hover()
  await expect(page.locator('.nav-dropdown:visible')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(explore).toBeFocused()
  await explore.press('ArrowDown')
  await expect(page.getByRole('link',{name:'Features Clipping',exact:false})).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(explore).toHaveAttribute('aria-expanded','false')
  await explore.hover()
  await page.locator('.nav-backdrop').click({position:{x:20,y:700}})
  await expect(page.locator('.nav-backdrop')).toHaveCount(0)
})

test('same-route, repeated and cross-route survey anchors focus and highlight', async ({ page }) => {
  await page.goto('/pricing')
  for(let i=0;i<2;i++) {
    await page.getByRole('link',{name:'Take the Survey — $1 offer details'}).click()
    await expect(page.locator('#feedback')).toBeFocused()
    await expect(page.locator('#feedback')).toHaveClass(/anchor-highlight/)
    expect(await page.locator('#feedback').evaluate(el=>el.getBoundingClientRect().top)).toBeGreaterThan(70)
  }
  await page.goto('/')
  await page.getByRole('link',{name:'Take the Survey — $1 offer details'}).click()
  await expect(page).toHaveURL(/pricing#feedback$/)
  await expect(page.locator('#feedback')).toBeFocused()
})

test('survey validation, saved confirmation, stable retry ID, offer and safe close', async ({page}) => {
  const requests: Record<string,unknown>[]=[]
  await page.route('**/.netlify/functions/submit-survey', async route=> {
    requests.push(route.request().postDataJSON())
    return route.fulfill({status: requests.length===1?503:200,json:requests.length===1?{error:'Try again'}:{ok:true}})
  })
  await page.goto('/pricing#feedback')
  await page.getByRole('button',{name:'Take the Survey',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('YouTube',{exact:true}).check()
  await dialog.getByLabel('Official Website',{exact:true}).check()
  await dialog.getByRole('button',{name:'Submit feedback'}).click()
  await expect(dialog.getByRole('alert')).toHaveText('Try again')
  await dialog.getByRole('button',{name:'Submit feedback'}).click()
  await expect(dialog.getByRole('status')).toContainText('Your feedback was saved')
  expect(requests[0].submissionId).toBe(requests[1].submissionId)
  await dialog.getByRole('button',{name:'View the $1 first-year offer'}).click()
  await expect(dialog).toContainText('Availability is confirmed at checkout')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button',{name:'Take the Survey',exact:true})).toBeFocused()
})

test('license recovery is collapsed, generic and calls the management endpoint', async ({page})=>{
  let sent: unknown
  await page.route('**/.netlify/functions/billing-recovery',async route=>{
    sent=route.request().postDataJSON()
    return route.fulfill({json:{ok:true,message:'If that email has a website Pro subscription, we sent a link that expires in 60 minutes.'}})
  })
  await page.goto('/pricing#manage')
  await expect(page.getByRole('button',{name:'Email me a management link'})).not.toBeVisible()
  await page.getByText('Lost your license key?',{exact:true}).click()
  await page.locator('details').getByLabel('Purchase email').fill('synthetic@example.test')
  await page.getByRole('button',{name:'Email me a management link'}).click()
  expect(sent).toEqual({email:'synthetic@example.test'})
  await expect(page.locator('details').getByRole('status')).toContainText('If that email')
})

test('untrusted portal URL is rejected and token removed from the address bar', async ({page})=>{
  let calls=0
  await page.route('**/.netlify/functions/billing-recovery-redeem',async route=>{calls++;return route.fulfill({json:{url:'https://evil.example.test/'}})})
  await page.goto('/pricing?billing='+'a'.repeat(64))
  await expect(page.getByRole('alert')).toContainText('unexpected address')
  expect(calls).toBe(1)
  expect(new URL(page.url()).searchParams.has('billing')).toBe(false)
})

test('checkout failure stays on site with a useful error, no payment attempted',async({page})=>{
  await page.goto('/pricing')
  await page.getByRole('button',{name:'Buy Pro',exact:false}).first().click()
  await expect(page.getByRole('alert').first()).toContainText('Offline preview')
  await expect(page).toHaveURL(/pricing$/)
})

test('demo opens only on request, closes; feature loops pause and reduced motion is static',async({page})=>{
  await page.goto('/')
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.getByRole('button',{name:'Watch Demo',exact:true}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('iframe')).toHaveCount(0)
  const demo=page.locator('.feature-demo').first()
  await demo.scrollIntoViewIfNeeded()
  await demo.getByRole('button',{name:'Pause animation'}).click()
  await expect(demo).toHaveAttribute('data-playing','false')
  await page.emulateMedia({reducedMotion:'reduce'})
  expect(await page.locator('.demo-selection').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none')
})

for (const width of [360,390,768,1024,1440]) {
  test(`responsive navigation and overflow ${width}`, async ({page})=>{
    await page.setViewportSize({width,height:900})
    for(const path of ['/', '/pricing', '/help', '/contact']) {
      await page.goto(path)
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    }
    if(width<1024) {
      await page.getByRole('button',{name:'Menu',exact:true}).click()
      await page.getByRole('button',{name:'Resources',exact:true}).click()
      await page.getByRole('link',{name:'FAQ Quick answers',exact:false}).click()
      await expect(page).toHaveURL(/faq$/)
      await expect(page.getByRole('button',{name:'Menu',exact:true})).toHaveAttribute('aria-expanded','false')
    }
  })
}

test('official community destinations and release links are preserved',async({page})=>{
  await page.goto('/')
  for(const [name,href] of [['TikTok','https://www.tiktok.com/@slipupclipz.com'],['YouTube','https://www.youtube.com/@SlipUpClipz'],['Instagram','https://www.instagram.com/slipupclipz/']]) {
    const link=page.getByRole('link',{name:`${name} (opens in a new tab)`,exact:true})
    await expect(link).toHaveAttribute('href',href)
    await expect(link).toHaveAttribute('rel','noopener noreferrer')
  }
  await expect(page.locator('a[href="/.netlify/functions/download-latest"]').first()).toBeVisible()
  await expect(page.locator('a[href*="9N89SSLR9769"]').first()).toBeVisible()
})


test('gallery tabs, modal focus containment and audio playback remain usable', async ({page})=>{
  await page.goto('/#ai-voice-cloning')
  const tabs=page.getByRole('tab')
  await tabs.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true')
  await expect(tabs.nth(1)).toBeFocused()
  await page.getByRole('button',{name:/Enlarge Generate and preview/}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  for(let i=0;i<5;i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  const player=page.getByRole('button',{name:'Play Original voice',exact:true})
  await player.click()
  await expect(page.locator('audio').first()).toHaveJSProperty('paused',false)
  await page.getByRole('button',{name:'Pause Original voice',exact:true}).click()
  await expect(page.locator('audio').first()).toHaveJSProperty('paused',true)
})

test('FAQ expands with keyboard; support assistant mock reply and feedback work',async({page})=>{
  await page.goto('/faq')
  const toggles=page.locator('main h3 button')
  await toggles.nth(1).focus(); await page.keyboard.press('Enter')
  await expect(toggles.nth(1)).toHaveAttribute('aria-expanded','true')
  await page.goto('/help')
  await page.route('**/.netlify/functions/support-assistant',r=>r.fulfill({json:{reply:'Synthetic response: check your output device.'}}))
  await page.getByLabel('Your question').fill('Where do I select my output device?')
  await page.getByRole('button',{name:'Send',exact:true}).click()
  await expect(page.getByText('Synthetic response: check your output device.',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Helpful answer',exact:true}).click()
  await expect(page.getByRole('button',{name:'Helpful answer',exact:true})).toHaveAttribute('aria-pressed','true')
  page.once('dialog',d=>d.accept())
  await page.getByRole('button',{name:'Clear conversation'}).click()
  await expect(page.getByText('Synthetic response: check your output device.',{exact:true})).toHaveCount(0)
})

test('contact form reports validation and upstream errors then confirms mocked delivery',async({page})=>{
  let sends=0
  await page.route('**/.netlify/functions/contact-support',route=>{
    sends++
    return route.fulfill({status:sends===1?503:200,json:sends===1?{error:'Synthetic delivery unavailable'}:{success:true}})
  })
  await page.goto('/contact')
  await page.getByRole('button',{name:'Send message',exact:true}).click()
  expect(sends).toBe(0)
  await page.getByLabel('Name (required)',{exact:true}).fill('Synthetic QA')
  await page.getByLabel('Email (required)',{exact:true}).fill('synthetic@example.test')
  await page.getByLabel('Subject (required)',{exact:true}).fill('Local QA only')
  await page.getByLabel('Message (required)',{exact:true}).fill('This message only exercises the intercepted local preview form.')
  await page.getByRole('button',{name:'Send message',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Synthetic delivery unavailable')
  await page.getByRole('button',{name:'Send message',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('sent')
  expect(sends).toBe(2)
})

test('survey dialog and dropdown accessibility, keyboard exit and mobile reduced-motion anchors',async({page})=>{
  await page.goto('/pricing')
  await page.getByRole('button',{name:'Resources',exact:true}).press('ArrowDown')
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([])
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Take the Survey',exact:true}).click()
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([])
  await page.keyboard.press('Escape')
  await page.setViewportSize({width:390,height:844}); await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto('/pricing')
  await page.getByRole('link',{name:'Take the Survey — $1 offer details'}).click()
  await expect(page.locator('#feedback')).toBeFocused()
  expect(await page.locator('#feedback').evaluate(el=>el.getBoundingClientRect().top)).toBeGreaterThan(70)
})

test('survey FAQ makes the offer conditional and privacy explains retry scope', async ({ page }) => {
  await page.goto('/faq')
  await page.getByRole('button', { name: 'How does the $1 survey discount work?' }).click()
  await expect(page.getByText(/SURVEY20 is the advertised code/)).toContainText('Confirm your eligibility and the actual discount in Stripe Checkout')
  await page.goto('/privacy')
  await expect(page.getByText(/recognize retries of the same submission/)).toContainText('A separate submission can still be saved.')
})

test('demo embed shares only its origin and offers a safe fallback on desktop and mobile', async ({ page }) => {
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 850 })
    await page.goto('/')
    const trigger = page.getByRole('button', { name: 'Watch Demo', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'SlipUpClipz demo' })
    const iframe = dialog.locator('iframe')
    await expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin')
    await expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/SwqrNqYVWMs')
    await expect(iframe).toHaveAttribute('title', 'SlipUpClipz product demo on YouTube')
    const size = await iframe.boundingBox()
    expect(size?.height).toBeGreaterThanOrEqual(200)
    const fallback = dialog.getByRole('link', { name: 'Watch on YouTube' })
    await expect(fallback).toHaveAttribute('href', /^https:\/\/youtu\.be\/SwqrNqYVWMs(?:\?|$)/)
    await expect(fallback).toHaveAttribute('target', '_blank')
    await expect(fallback).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'same-origin')
    if (width === 1440) await page.keyboard.press('Escape')
    else await dialog.getByRole('button', { name: 'Close demo video' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.locator('iframe')).toHaveCount(0)
    await expect(trigger).toBeFocused()
  }
})

test('static preview explains unavailable survey, checkout and installer actions', async ({ page, context }) => {
  await context.unroute('**/*')
  await context.route('**/*', route =>
    new URL(route.request().url()).origin === 'http://127.0.0.1:4174' ? route.continue() : route.abort())
  await page.goto('/pricing#feedback')
  await page.getByRole('button', { name: 'Take the Survey', exact: true }).click()
  const survey = page.getByRole('dialog')
  await survey.getByLabel('YouTube', { exact: true }).check()
  await survey.getByLabel('Official Website', { exact: true }).check()
  await survey.getByRole('button', { name: 'Submit feedback' }).click()
  await expect(survey.getByRole('alert')).toContainText('Your answers were not saved.')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Buy Pro', exact: false }).first().click()
  await expect(page.getByRole('alert').first()).toContainText('No payment was started.')
  await page.goto('/.netlify/functions/download-latest')
  await expect(page.getByRole('status')).toContainText('direct installer download is unavailable')
})

test('workflow illustrations synchronize cursor and action states without moving the card', async ({ page }) => {
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    for (const kind of ['replay', 'trim', 'soundboard']) {
      const demo = page.locator('.demo-' + kind + '.feature-demo')
      await demo.scrollIntoViewIfNeeded()
      await expect(demo).toHaveAttribute('data-playing', 'true')
      const states = await demo.evaluate((card, workflow) => {
        const animations = card.getAnimations({ subtree: true })
        const cursor = card.querySelector('.demo-cursor')!
        const action = card.querySelector(workflow === 'replay' ? '.demo-library .demo-result' :
          workflow === 'trim' ? '.demo-selection' : '.demo-pad-stop')!
        const samples = [0, 0.65].map(progress => {
          for (const animation of animations) {
            animation.pause()
            animation.currentTime = 6500 * progress
          }
          const style = getComputedStyle(action)
          return {
            transform: getComputedStyle(cursor).transform,
            action: workflow === 'trim' ? style.left : style.visibility,
            height: card.getBoundingClientRect().height,
          }
        })
        return { durations: animations.map(a => a.effect?.getTiming().duration), samples }
      }, kind)
      expect(states.durations.length).toBeGreaterThan(1)
      expect(states.durations.every(duration => duration === 6500)).toBe(true)
      expect(states.samples[0].transform).not.toBe(states.samples[1].transform)
      expect(states.samples[0].action).not.toBe(states.samples[1].action)
      expect(states.samples[0].height).toBe(states.samples[1].height)
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const cursor of await page.locator('.demo-cursor').all()) await expect(cursor).toBeHidden()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
  }
})

test('slideshow icon pauses autoplay from the keyboard and honors reduced motion', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  const pause = page.getByRole('button', { name: 'Pause slideshow' })
  await pause.scrollIntoViewIfNeeded()
  await pause.press('Space')
  const resume = page.getByRole('button', { name: 'Play slideshow' })
  await expect(resume).toBeFocused()
  await expect(resume).toHaveText('')
  const activeTab = page.getByRole('tab', { selected: true })
  const before = await activeTab.innerText()
  await resume.evaluate(button => button.blur())
  await page.clock.fastForward(6000)
  await expect(activeTab).toHaveText(before)
  await resume.press('Enter')
  await expect(pause).toBeFocused()
  await pause.evaluate(button => button.blur())
  await page.clock.fastForward(6000)
  await expect(activeTab).not.toHaveText(before)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(pause).toBeHidden()
  const stopped = await activeTab.innerText()
  await page.clock.fastForward(6000)
  await expect(activeTab).toHaveText(stopped)
})

test('Manage Pro centers its column and aligns the recovery and primary forms', async ({ page }) => {
  await page.goto('/pricing#manage')
  const card = page.locator('#manage')
  await card.getByText('Lost your license key?', { exact: true }).click()
  for (const width of [1440, 768, 360]) {
    await page.setViewportSize({ width, height: 900 })
    const bounds = await card.evaluate(el => {
      const rect = (node: Element) => {
        const { left, right } = node.getBoundingClientRect()
        return { left, right }
      }
      return {
        card: rect(el),
        fields: [...el.querySelectorAll('h2, input, form button[type=submit]')].map(rect),
      }
    })
    const [column] = bounds.fields
    expect(Math.abs(column.left - bounds.card.left - (bounds.card.right - column.right))).toBeLessThan(2)
    for (const field of bounds.fields) {
      expect(Math.abs(field.left - column.left)).toBeLessThan(2)
      expect(Math.abs(field.right - column.right)).toBeLessThan(2)
    }
  }
})
