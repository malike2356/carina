rule C2ChannelHints
{
  meta:
    description = "C2 beacon / staging markers"
    severity = "high"
  strings:
    $a = "User-Agent: Mozilla/5.0 (compatible; MSIE 10.0" ascii
    $b = "beacon.dll" ascii nocase
    $c = "cobaltstrike" ascii nocase
    $d = "meterpreter" ascii nocase
  condition:
    any of them
}
