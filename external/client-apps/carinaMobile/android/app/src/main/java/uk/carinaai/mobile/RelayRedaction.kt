package uk.carinaai.mobile

object RelayRedaction {
  private val cardPattern = Regex("""\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b""")
  private val pinPattern = Regex("""\bPIN[:\s]+\d{4,6}\b""", RegexOption.IGNORE_CASE)
  private val passwordPattern = Regex("""\bpassword[:\s]+\S+""", RegexOption.IGNORE_CASE)

  fun apply(text: String): String {
    return text
      .replace(cardPattern, "[CARD_REDACTED]")
      .replace(pinPattern, "[PIN_REDACTED]")
      .replace(passwordPattern, "[PASSWORD_REDACTED]")
  }
}
