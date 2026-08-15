$f = [IO.File]::ReadAllBytes('build/icons/win/icon.ico')
$count = [BitConverter]::ToUInt16($f, 4)
Write-Host "images: $count"
for ($i = 0; $i -lt $count; $i++) {
  $o = 6 + $i * 16
  $w = $f[$o]
  $h = $f[$o + 1]
  $bpp = [BitConverter]::ToUInt16($f, $o + 6)
  $size = [BitConverter]::ToUInt32($f, $o + 8)
  $ww = if ($w -eq 0) { 256 } else { $w }
  $hh = if ($h -eq 0) { 256 } else { $h }
  Write-Host ("  {0}x{1} bpp={2} bytes={3}" -f $ww, $hh, $bpp, $size)
}
