/**
 * v0.1.5 does not send a device id. Those requests stay valid until
 * LEGACY_DEVICE_GRACE_UNTIL is set to a time that has passed.
 *
 * Leave the variable unset until Microsoft Store customers can install the
 * update. A missing or unreadable value does not lock customers out.
 * Setting a future time extends the window. Setting a past time ends it.
 * Unset it again to roll a bad cutoff back. Do not deploy a past date.
 */
function legacyDeviceGraceEndsAt(env = process.env) {
  const configured = typeof env.LEGACY_DEVICE_GRACE_UNTIL === 'string' ? env.LEGACY_DEVICE_GRACE_UNTIL.trim() : ''
  if (!configured) return null
  const parsed = Date.parse(configured)
  return Number.isFinite(parsed) ? parsed : null
}

function legacyDeviceValidationAllowed(now = new Date(), env = process.env) {
  const endsAt = legacyDeviceGraceEndsAt(env)
  if (endsAt === null) return true
  return now.getTime() <= endsAt
}

module.exports = {
  legacyDeviceGraceEndsAt,
  legacyDeviceValidationAllowed,
}
