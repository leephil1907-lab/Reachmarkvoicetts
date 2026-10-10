#!/usr/bin/env bash
# Composes Reachmark brand art with REAL section glyphs (same shapes as the in-app icon set):
# shortcut icons, widget screenshot, PWA store screenshots, og-image.
set -e
cd "$(dirname "$0")/../web/assets"
LG=/tmp/lg-full.png
FB="font DejaVu-Sans-Bold"; FR="font DejaVu-Sans"
LIME='#d3f36b'; ORANGE='#ff9a4d'; DARK='#1F1D16'; CARD='#201d16'; TXT='#f2f5ee'; MUT='#9aa5b5'

# ---------- real section glyphs (match web/js/core.js icon paths) ----------
glyph_text() { # 3 rounded bars = 'text' icon
  echo "-fill '$LIME' -stroke none -draw 'roundrectangle $1,$2 $(( $1+44 )),$(( $2+8 )) 4,4' -draw 'roundrectangle $1,$(( $2+18 )) $(( $1+32 )),$(( $2+26 )) 4,4' -draw 'roundrectangle $1,$(( $2+36 )) $(( $1+38 )),$(( $2+44 )) 4,4'";
}
glyph_copy() { # two overlapping rounded rects = 'copy' icon
  echo "-fill none -stroke '$LIME' -strokewidth 6 -draw 'roundrectangle $(( $1+12 )),$1 $(( $1+46 )),$(( $1+34 )) 8,8' -draw 'roundrectangle $1,$(( $1+12 )) $(( $1+34 )),$(( $1+46 )) 8,8'";
}
glyph_lifebuoy() { # circle + inner circle + 4 spokes = 'lifebuoy'
  echo "-fill none -stroke '$LIME' -strokewidth 6 -draw 'circle $(( $1+23 )),$(( $1+23 )) $(( $1+23 )),$(( $1-1 ))' -draw 'circle $(( $1+23 )),$(( $1+23 )) $(( $1+23 )),$(( $1+13 ))' -stroke '$ORANGE' -strokewidth 5 -draw 'line $(( $1+7 )),$(( $1+7 )) $(( $1+15 )),$(( $1+15 ))' -draw 'line $(( $1+31 )),$(( $1+31 )) $(( $1+39 )),$(( $1+39 ))' -draw 'line $(( $1+39 )),$(( $1+7 )) $(( $1+31 )),$(( $1+15 ))' -draw 'line $(( $1+7 )),$(( $1+39 )) $(( $1+15 )),$(( $1+31 ))'";
}
glyph_globe() { echo "-fill none -stroke '$LIME' -strokewidth 5 -draw 'circle $(( $1+22 )),$(( $1+22 )) $(( $1+22 )),$1' -draw 'ellipse $(( $1+22 )) $(( $1+22 )) 10,22 0,360' -draw 'line $1,$(( $1+22 )) $(( $1+44 )),$(( $1+22 ))'"; }
glyph_film() { echo "-fill none -stroke '$LIME' -strokewidth 5 -draw 'roundrectangle $1,$(( $1+4 )) $(( $1+44 )),$(( $1+40 )) 6,6' -draw 'line $(( $1+10 )),$(( $1+4 )) $(( $1+10 )),$(( $1+40 ))' -draw 'line $(( $1+34 )),$(( $1+4 )) $(( $1+34 )),$(( $1+40 ))'"; }
glyph_wand() { echo "-stroke '$LIME' -strokewidth 6 -fill none -draw 'line $1,$(( $1+44 )) $(( $1+30 )),$(( $1+14 ))' -fill '$ORANGE' -stroke none -draw 'circle $(( $1+36 )),$(( $1+8 )) $(( $1+39 )),$(( $1+8 ))' -draw 'circle $(( $1+16 )),$(( $1+10 )) $(( $1+18 )),$(( $1+10 ))'"; }
glyph_bot() { echo "-fill none -stroke '$LIME' -strokewidth 5 -draw 'roundrectangle $1,$(( $1+10 )) $(( $1+44 )),$(( $1+40 )) 10,10' -draw 'line $(( $1+22 )),$(( $1+10 )) $(( $1+22 )),$1' -fill '$LIME' -stroke none -draw 'circle $(( $1+14 )),$(( $1+25 )) $(( $1+16 )),$(( $1+25 ))' -draw 'circle $(( $1+30 )),$(( $1+25 )) $(( $1+32 )),$(( $1+25 ))'"; }
glyph_swap() { echo "-stroke '$LIME' -strokewidth 6 -fill none -draw 'line $1,$(( $1+14 )) $(( $1+38 )),$(( $1+14 ))' -draw 'line $(( $1+6 )),$(( $1+32 )) $(( $1+44 )),$(( $1+32 ))' -fill '$LIME' -stroke none -draw 'polygon $(( $1+38 )),$(( $1+6 )) $(( $1+38 )),$(( $1+22 )) $(( $1+48 )),$(( $1+14 ))' -draw 'polygon $(( $1+6 )),$(( $1+24 )) $(( $1+6 )),$(( $1+40 )) $(( $1-4 )),$(( $1+32 ))'"; }

base96() { magick -size 96x96 xc:none -fill "$DARK" -draw 'roundrectangle 0,0 95,95 22,22' "$@"; }

# ---------- shortcut icons (real per-section glyphs) ----------
eval "base96 $(glyph_text 26 26)" shortcut-tts-96.png
eval "base96 $(glyph_copy 30 26)" shortcut-match-96.png
eval "base96 $(glyph_lifebuoy 26 26)" shortcut-support-96.png

# ---------- widget screenshot 600x400 ----------
magick -size 600x400 xc:'#151310' \
  -fill "$CARD" -draw 'roundrectangle 30,30 570,370 24,24' \
  \( "$LG" -resize 72x72! \) -geometry +58+58 -composite \
  -pointsize 26 -fill "$TXT" -$FB -draw "text 148,96 'Reachmark Audio'" \
  -pointsize 14 -fill "$MUT" -$FR -draw "text 150,124 'Quick studio widget · by Reachmark Digital'" \
  -fill "$LIME" -draw 'roundrectangle 58,250 250,306 28,28' \
  -pointsize 18 -fill '#151310' -$FB -draw "text 92,285 'Open the studio'" \
  -pointsize 15 -fill "$MUT" -$FR -draw "text 280,285 '6 studios · 40+ languages'" \
  -fill '#2a2620' -draw 'roundrectangle 58,160 542,214 14,14' \
  -pointsize 15 -fill "$MUT" -$FR -draw "text 76,193 'Neural TTS · Voice Match · Dubbing · Lip Sync · Agents'" \
  widget-screenshot.png

# ---------- OG banner ----------
magick -size 1200x630 xc:'#151310' \
  \( "$LG" -resize 400x400! \) -geometry +90+115 -composite \
  -pointsize 46 -fill "$TXT" -$FB -draw "text 560,250 'REACHMARK AUDIO'" \
  -pointsize 24 -fill "$MUT" -$FR -draw "text 562,300 'The AI voice studio by Reachmark Digital'" \
  -fill "$LIME" -draw 'rectangle 562,336 682,341' \
  -pointsize 20 -fill "$LIME" -$FR -draw "text 562,392 'Neural TTS  ·  Voice Match  ·  Dubbing  ·  Lip Sync'" \
  -fill '#c9c4b4' -draw "text 562,428 'Character Agents  ·  Voice Changer  ·  40+ languages'" \
  og-image.png

# ---------- Desktop screenshot 1280x800 (real glyphs, honest specs) ----------
magick -size 1280x800 xc:'#151310' \
  -fill '#1b1813' -draw 'rectangle 0,0 300,800' \
  \( "$LG" -resize 64x64! \) -geometry +32+32 -composite \
  -pointsize 21 -fill "$TXT" -$FB -draw "text 112,62 'Reachmark Audio'" \
  -pointsize 12 -fill '#8a8578' -$FR -draw "text 112,84 'by Reachmark Digital'" \
  -fill "$LIME" -draw 'roundrectangle 20,140 280,186 12,12' \
  -pointsize 16 -fill '#151310' -$FB -draw "text 44,170 'Dashboard'" \
  -pointsize 16 -fill '#b9b4a6' -$FR \
  -draw "text 44,226 'Studios'" -draw "text 44,282 'Voice Library'" \
  -draw "text 44,338 'Character Agents'" -draw "text 44,394 'Account & Billing'" \
  -pointsize 34 -fill "$TXT" -$FB -draw "text 340,96 'Good day, Creator'" \
  -pointsize 15 -fill "$MUT" -$FR -draw "text 342,128 'Your studio, your voices, your credits — all in one place.'" \
  -fill "$CARD" -draw 'roundrectangle 340,160 550,256 16,16' -draw 'roundrectangle 570,160 780,256 16,16' \
  -draw 'roundrectangle 790,160 1000,256 16,16' -draw 'roundrectangle 1010,160 1220,256 16,16' \
  -pointsize 12 -fill "$MUT" -$FR -draw "text 360,192 'CREDITS'" -draw "text 590,192 'STUDIOS'" -draw "text 810,192 'LANGUAGES'" -draw "text 1030,192 'VOICE CLONE'" \
  -pointsize 26 -fill "$TXT" -$FB -draw "text 360,232 '10,000'" -draw "text 590,232 '6'" -draw "text 810,232 '40+'" -draw "text 1030,232 '10 s'" \
  -fill "$CARD" \
  -draw 'roundrectangle 340,290 630,440 16,16' -draw 'roundrectangle 650,290 940,440 16,16' -draw 'roundrectangle 960,290 1250,440 16,16' \
  -draw 'roundrectangle 340,460 630,610 16,16' -draw 'roundrectangle 650,460 940,610 16,16' -draw 'roundrectangle 960,460 1250,610 16,16' \
  -pointsize 17 -fill "$TXT" -$FB \
  -draw "text 420,362 'Text to Speech'" -draw "text 730,362 'Voice Match'" -draw "text 1040,362 'Voice Changer'" \
  -draw "text 420,532 'Dubbing Studio'" -draw "text 730,532 'Lip Sync'" -draw "text 1040,532 'Voice Design'" \
  -pointsize 12 -fill "$MUT" -$FR \
  -draw "text 420,392 'Type it — hear it in any voice'" -draw "text 730,392 'Clone a voice in seconds'" -draw "text 1040,392 'Pitch, timbre and FX chains'" \
  -draw "text 420,562 'Translate and re-voice video'" -draw "text 730,562 'Match speech to footage'" -draw "text 1040,562 'Design voices from traits'" \
  -pointsize 13 -fill '#8a8578' -$FR -draw "text 342,760 'Reachmark Audio — a product of Reachmark Digital'" \
  screenshot-desktop-base.png
# glyphs onto cards (drawn at card icon positions)
eval "magick screenshot-desktop-base.png $(glyph_text 360 310) $(glyph_copy 680 310) $(glyph_swap 1000 310) $(glyph_globe 360 480) $(glyph_film 680 480) $(glyph_wand 1000 480) screenshot-desktop.png"
rm -f screenshot-desktop-base.png

# ---------- Mobile screenshot 750x1334 ----------
magick -size 750x1334 xc:'#151310' \
  -fill '#1b1813' -draw 'rectangle 0,0 750,120' -draw 'rectangle 0,1214 750,1334' \
  \( "$LG" -resize 64x64! \) -geometry +32+28 -composite \
  -pointsize 27 -fill "$TXT" -$FB -draw "text 116,66 'Reachmark Audio'" \
  -pointsize 13 -fill '#8a8578' -$FR -draw "text 116,92 'by Reachmark Digital'" \
  -fill "$LIME" -draw 'roundrectangle 560,44 710,78 17,17' \
  -pointsize 14 -fill '#151310' -$FB -draw "text 582,67 '10,000 credits'" \
  -pointsize 40 -fill "$TXT" -$FB -draw "text 48,214 'Good day, Creator'" \
  -pointsize 19 -fill "$MUT" -$FR -draw "text 50,258 'Your studio is ready. What shall we voice today?'" \
  -fill "$CARD" -draw 'roundrectangle 40,310 360,450 18,18' -draw 'roundrectangle 390,310 710,450 18,18' \
  -draw 'roundrectangle 40,470 360,610 18,18' -draw 'roundrectangle 390,470 710,610 18,18' \
  -pointsize 14 -fill "$MUT" -$FR -draw "text 64,348 'CREDITS'" -draw "text 414,348 'STUDIOS'" -draw "text 64,508 'LANGUAGES'" -draw "text 414,508 'VOICE CLONE'" \
  -pointsize 30 -fill "$TXT" -$FB -draw "text 64,404 '10,000'" -draw "text 414,404 '6'" -draw "text 64,564 '40+'" -draw "text 414,564 '10 s'" \
  -pointsize 22 -fill "$TXT" -$FB -draw "text 48,690 'Studios'" \
  -fill "$CARD" \
  -draw 'roundrectangle 40,720 710,806 16,16' -draw 'roundrectangle 40,822 710,908 16,16' \
  -draw 'roundrectangle 40,924 710,1010 16,16' -draw 'roundrectangle 40,1026 710,1112 16,16' \
  -pointsize 21 -fill "$TXT" -$FB -draw "text 136,771 'Text to Speech'" -draw "text 136,873 'Voice Match'" \
  -draw "text 136,975 'Dubbing Studio'" -draw "text 136,1077 'Character Agents'" \
  -pointsize 15 -fill "$MUT" -$FR -draw "text 136,795 'Any voice, any language'" -draw "text 136,897 'Instant voice clone'" \
  -draw "text 136,999 'Translate and re-voice'" -draw "text 136,1101 'Agents that act and call'" \
  -pointsize 16 -fill "$LIME" -$FB -draw "text 90,1284 'Home'" \
  -pointsize 16 -fill '#8a8578' -$FR -draw "text 260,1284 'Studios'" -draw "text 450,1284 'Agents'" -draw "text 610,1284 'Account'" \
  screenshot-mobile-base.png
eval "magick screenshot-mobile-base.png $(glyph_text 62 740) $(glyph_copy 62 842) $(glyph_globe 62 944) $(glyph_bot 62 1046) screenshot-mobile.png"
rm -f screenshot-mobile-base.png

identify shortcut-tts-96.png shortcut-match-96.png shortcut-support-96.png widget-screenshot.png screenshot-desktop.png screenshot-mobile.png og-image.png | awk '{print $1, $3}'
