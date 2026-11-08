#!/bin/zsh
# usage: extract.sh clip  -> ../assets/frames/<clip>/full/NNNN.webp at 24 fps, native clip size (max 1920 wide), cwebp q75.
# Phones and desktops load the same frames; frames.js keeps only a small decoded window around the playhead.
c=$1; out=../assets/frames/$c; tmp=png/$c
rm -rf $out $tmp; mkdir -p $out/full $tmp
ffmpeg -loglevel error -y -i clips/$c.mp4 -vf "fps=24,scale='min(1920,iw)':-2:flags=lanczos" $tmp/%04d.png
ls $tmp | sed 's/\.png$//' | xargs -P 6 -I{} cwebp -quiet -q 75 -m 4 $tmp/{}.png -o $out/full/{}.webp
rm -rf $tmp
echo "$c $(ls $out/full | wc -l | tr -d ' ') $(du -sh $out/full | cut -f1)"
