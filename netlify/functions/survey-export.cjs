const { timingSafeEqual } = require('node:crypto')
const { jsonResponse } = require('../lib/commerce.cjs')
const { summarizeResponses } = require('../lib/survey.cjs')
const { listSurveyResponses } = require('../lib/feedback-store.cjs')

function tokensMatch(provided, expected) {
  const left = Buffer.from(String(provided || ''))
  const right = Buffer.from(String(expected || ''))
  if (left.length === 0 || right.length === 0 || left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function readAdminToken(event) {
  const headers = event?.headers || {}
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() !== 'x-survey-admin-token') continue
    return Array.isArray(value) ? value[0] : value
  }
  return ''
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const expected = String(process.env.SURVEY_ADMIN_TOKEN || '').trim()
  if (!expected) {
    return jsonResponse(503, {
      error: 'Survey review is not configured. Set SURVEY_ADMIN_TOKEN on the server.',
    })
  }
  if (!tokensMatch(readAdminToken(event), expected)) {
    return jsonResponse(401, { error: 'Unauthorized' })
  }

  try {
    const listed = await listSurveyResponses(event)
    return jsonResponse(200, {
      summary: summarizeResponses(listed.responses),
      truncated: listed.truncated,
      environment: listed.environment,
      responses: listed.responses,
    })
  } catch (error) {
    console.error('survey-export failed', error)
    return jsonResponse(500, { error: 'Unable to read survey responses' })
  }
}
