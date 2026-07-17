import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OWNER = 'FISHSTICKSBOI1'
const REPO = 'SlipUpClipz'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJsonPath = path.join(root, 'package.json')

function fail(message) {
  console.error(`[preflight:release] ${message}`)
  process.exit(1)
}

function getToken() {
  const token = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '').trim()
  if (!token) {
    fail(
      'GH_TOKEN is not set. In Command Prompt run: set GH_TOKEN=your_github_token',
    )
  }
  return token
}

function readPackageVersion() {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  if (!pkg.version || typeof pkg.version !== 'string') {
    fail('package.json is missing a version field.')
  }
  return pkg.version
}

function compareSemver(a, b) {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i += 1) {
    const av = pa[i] ?? 0
    const bv = pb[i] ?? 0
    if (av > bv) return 1
    if (av < bv) return -1
  }
  return 0
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'SlipUpClipz-release-preflight',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (response.status === 404) {
    return { status: 404, body: null }
  }

  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  if (!response.ok) {
    fail(`GitHub API error ${response.status} for ${url}: ${text}`)
  }

  return { status: response.status, body }
}

const version = readPackageVersion()
const token = getToken()
const tag = `v${version}`

console.log(`[preflight:release] Checking version ${version} (tag ${tag})…`)

const exact = await githubJson(
  `https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${encodeURIComponent(tag)}`,
  token,
)

if (exact.status !== 404 && exact.body) {
  const assets = Array.isArray(exact.body.assets) ? exact.body.assets : []
  const publishedAt = exact.body.published_at
    ? Date.parse(exact.body.published_at)
    : null
  const ageHours =
    publishedAt != null ? (Date.now() - publishedAt) / (3600 * 1000) : null

  if (!exact.body.draft && ageHours != null && ageHours > 2) {
    fail(
      `GitHub release ${tag} already exists and was published more than 2 hours ago. ` +
        `electron-builder will skip uploading files. Bump package.json to a new version first.`,
    )
  }

  if (assets.length > 0) {
    fail(
      `GitHub release ${tag} already has ${assets.length} asset(s). ` +
        `Publishing again may skip or overwrite files unpredictably. Bump the version or delete that release first.`,
    )
  }

  console.log(
    `[preflight:release] Release ${tag} exists but has no assets yet — continuing.`,
  )
}

const latest = await githubJson(
  `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`,
  token,
)

if (latest.status !== 404 && latest.body?.tag_name) {
  const latestTag = String(latest.body.tag_name).replace(/^v/, '')
  if (compareSemver(version, latestTag) <= 0) {
    fail(
      `package.json version ${version} is not greater than the latest GitHub release ${latest.body.tag_name}. ` +
        `Increase the version in package.json before publishing.`,
    )
  }
  console.log(
    `[preflight:release] Latest GitHub release is ${latest.body.tag_name}; publishing ${version} is newer.`,
  )
} else {
  console.log('[preflight:release] No latest GitHub release found — first publish is OK.')
}

console.log('[preflight:release] OK — safe to publish.')
