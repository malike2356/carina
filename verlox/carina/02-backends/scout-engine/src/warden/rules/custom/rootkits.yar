rule LinuxRootkitHints
{
  meta:
    description = "Common Linux rootkit / Diamorphine-style markers"
    severity = "critical"
  strings:
    $a = "diamorphine" ascii nocase
    $b = "hide_pid" ascii
    $c = "hacked_getdents" ascii
    $d = "module_hide" ascii
  condition:
    any of them
}
