rule CryptoMinerHints
{
  meta:
    description = "Crypto miner indicators"
    severity = "high"
  strings:
    $a = "stratum+tcp" ascii
    $b = "xmrig" ascii nocase
    $c = "cryptonight" ascii nocase
    $d = "mining pool" ascii nocase
  condition:
    any of them
}
