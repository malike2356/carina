rule WebshellHints
{
  meta:
    description = "Common webshell markers"
    severity = "high"
  strings:
    $a = "eval($_POST" ascii
    $b = "assert($_REQUEST" ascii
    $c = "cmd.exe /c" ascii nocase
    $d = "passthru(" ascii
  condition:
    any of them
}
