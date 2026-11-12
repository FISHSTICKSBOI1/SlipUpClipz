const { jsonResponse } = require('../lib/commerce.cjs')
const {
  validateSurveySubmission,
  clientAddress,
  hashClientAddress,
  parseJsonBody,
  clearClaimCookieHeader,
} = require('../lib/survey.cjs')
const { consumeRateLimit, saveFeedbackResponse, feedbackId } = require('../lib/feedback-store.cjs')

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

    const ipHash = hashClientAddress(clientAddress(event), event)
    const rate = await consumeRateLimit(ipHash, event, Date.now(), body.submissionId ? feedbackId(body.submissionId, ipHash) : null)
    if (!rate.allowed) {
      return jsonResponse(429, {
        error: 'Too many survey submissions from this network. You can try again tomorrow.',
      })
    }

    await saveFeedbackResponse({
      answers: validation.answers,
      submissionId: body.submissionId,
      ipHash,
      event,
    })

    return jsonResponse(
      200,
      { ok: true },
      { 'Set-Cookie': clearClaimCookieHeader() },
    )
  } catch (error) {
    if (Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 500) {
      return jsonResponse(error.statusCode, { error: error.message })
    }
    const missingSalt = error?.code === 'survey-salt-missing'
    console.error('submit-survey failed', { category: missingSalt ? 'survey-salt-missing' : 'storage', statusCode: 503 })
    return jsonResponse(503, {
      error: missingSalt ? error.message : 'We could not confirm that your feedback was saved. Please try again later.',
    })
  }
}
