#!/bin/sh
# Génère les icônes PNG de la PWA depuis les SVG de `public/icons/` (ImageMagick).
# Les PNG sont commités : ce script ne sert qu'après une modification des SVG (`pnpm icons`).
set -eu
cd "$(dirname "$0")/../../public/icons"
render() { convert -background none -density 1200 "$1" -resize "$2x$2" -strip -depth 8 "$3"; }
render icon.svg 192 icon-192.png
render icon.svg 512 icon-512.png
render icon-maskable.svg 512 icon-maskable-512.png
# iOS ignore le manifeste et arrondit lui-même les coins : fond plein, sans transparence.
render icon-maskable.svg 180 apple-touch-icon.png
