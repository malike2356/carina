rule CarinaBinaryTamperHint
{
  meta:
    description = "Suspicious self-modify strings near Carina runtime"
    severity = "high"
  strings:
    $a = "eval(Buffer.from" ascii
    $b = "child_process" ascii
    $c = "/etc/ld.so.preload" ascii
  condition:
    2 of them
}
