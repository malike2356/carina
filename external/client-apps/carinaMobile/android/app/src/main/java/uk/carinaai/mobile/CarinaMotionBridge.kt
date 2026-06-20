package uk.carinaai.mobile

object CarinaMotionBridge {
  var onActivityTransition: ((activity: String, transition: String, timestamp: Long) -> Unit)? = null
}
