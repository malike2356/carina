rule ReverseShellHints
{
  meta:
    description = "Reverse shell / backdoor markers"
    severity = "critical"
  strings:
    $a = "/dev/tcp/" ascii
    $b = "bash -i >&" ascii
    $c = "nc -e /bin/sh" ascii
    $d = "python -c 'import socket" ascii
  condition:
    any of them
}
