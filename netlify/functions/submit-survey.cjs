const { jsonResponse } = require('../lib/commerce.cjs')
const {
  validateSurveySubmission,
  clientAddress,
  hashClientAddress,
  parseJsonBody,
  clearClaimCookieHeader,
} = require('../lib/survey.cjs')
const { consumeRateLimit, saveFeedbackResponse } = require('../lib/feedback-store.cjs')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    const body = parseJsonBody(event)
    const validation = validateSurveySubmission(body)
    if (!validation.ok) {
      return jsonResponse(400, { error: validation.error })
    }

    const ipHash = hashClientAddress(clientAddress(event))
    const rate = await consumeRateLimit(ipHash, event)
    if (!rate.allowed) {
      return jsonResponse(429, {
        error: 'Too many survey submissions from this network. You can try again tomorrow.',
      })
    }

    await saveFeedbackResponse({
      answers: validation.answers,
      ipHash,
      event,
    })

    return jsonResponse(
      200,
      { ok: true },
      { 'Set-Cookie': clearClaimCookieHeader() },
    )
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500
    if (statusCode >= 500) console.error('submit-survey failed', error)
    const reveal = statusCode < 500 || error?.code === 'survey-salt-missing'
    return jsonResponse(statusCode, {
      error: reveal ? error.message || 'Unable to save feedback right now.' : 'Unable to save feedback right now.',
    })
  }
}
