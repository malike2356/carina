rule ScoutSelfTamperHint
{
  meta:
    description = "Patterns associated with Scout disablement"
    severity = "critical"
  strings:
    $a = "WARDEN_ENABLED=false" ascii
    $b = "kill_switch_on_critical: false" ascii
    $c = "dry_run: false" ascii
    $d = "remove_requires_confirmation: false" ascii
  condition:
    2 of them
}
