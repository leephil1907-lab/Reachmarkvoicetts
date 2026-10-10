#!/usr/bin/env bash
# Composes brand art: og-image.png + PWA manifest screenshots (promo frames, real studio names).
set -e
cd "$(dirname "$0")/../web/assets"
LG=/tmp/lg-full.png
FB="font DejaVu-Sans-Bold"; FR="font DejaVu-Sans"

# ---------- OG banner 1200x630 ----------
magick -size 1200x630 xc:'#151310' \
  \( "$LG" -resize 400x400! \) -geometry +90+115 -composite \
  -pointsize 46 -fill '#f2f5ee' -$FB -draw "text 560,250 'REACHMARK AUDIO'" \
  -pointsize 24 -fill '#9aa5b5' -$FR -draw "text 562,300 'The AI voice studio by Reachmark Digital'" \
  -fill '#d3f36b' -draw 'rectangle 562,336 682,341' \
  -pointsize 20 -fill '#d3f36b' -$FR -draw "text 562,392 'Neural TTS  ·  Voice Match  ·  Dubbing  ·  Lip Sync'" \
  -fill '#c9c4b4' -draw "text 562,428 'Character Agents  ·  Voice Changer  ·  40+ languages'" \
  og-image.png

# ---------- Desktop screenshot 1280x800 ----------
{
echo "-size 1280x800 xc:'#151310'"
echo "-fill '#1b1813' -draw 'rectangle 0,0 300,800'"
echo "-fill '#d3f36b' -draw 'roundrectangle 20,140 280,186 12,12'"
} > /tmp/d.args
magick -size 1280x800 xc:'#151310' \
  -fill '#1b1813' -draw 'rectangle 0,0 300,800' \
  \( "$LG" -resize 64x64! \) -geometry +32+32 -composite \
  -pointsize 21 -fill '#f2f5ee' -$FB -draw "text 112,62 'Reachmark Audio'" \
  -pointsize 12 -fill '#8a8578' -$FR -draw "text 112,84 'by Reachmark Digital'" \
  -fill '#d3f36b' -draw 'roundrectangle 20,140 280,186 12,12' \
  -pointsize 16 -fill '#151310' -$FB -draw "text 44,170 'Dashboard'" \
  -pointsize 16 -fill '#b9b4a6' -$FR \
  -draw "text 44,226 'Studios'" -draw "text 44,282 'Voice Library'" \
  -draw "text 44,338 'Character Agents'" -draw "text 44,394 'Account & Billing'" \
  -pointsize 34 -fill '#f2f5ee' -$FB -draw "text 340,96 'Good day, Creator'" \
  -pointsize 15 -fill '#9aa5b5' -$FR -draw "text 342,128 'Your studio, your voices, your credits — all in one place.'" \
  -fill '#201d16' -draw 'roundrectangle 340,160 550,256 16,16' -draw 'roundrectangle 570,160 780,256 16,16' \
  -draw 'roundrectangle 790,160 1000,256 16,16' -draw 'roundrectangle 1010,160 1220,256 16,16' \
  -pointsize 12 -fill '#9aa5b5' -$FR -draw "text 360,192 'CREDITS'" -draw "text 590,192 'VOICES'" -draw "text 810,192 'RENDERS'" -draw "text 1030,192 'MINUTES'" \
  -pointsize 26 -fill '#f2f5ee' -$FB -draw "text 360,232 '10,000'" -draw "text 590,232 '42'" -draw "text 810,232 '128'" -draw "text 1030,232 '96'" \
  -fill '#201d16' \
  -draw 'roundrectangle 340,290 630,440 16,16' -draw 'roundrectangle 650,290 940,440 16,16' -draw 'roundrectangle 960,290 1250,440 16,16' \
  -draw 'roundrectangle 340,460 630,610 16,16' -draw 'roundrectangle 650,460 940,610 16,16' -draw 'roundrectangle 960,460 1250,610 16,16' \
  -fill '#d3f36b' -draw 'circle 366,318 366,312' -draw 'circle 676,318 676,312' -draw 'circle 986,318 986,312' \
  -fill '#ff9a4d' -draw 'circle 366,488 366,482' -draw 'circle 676,488 676,482' -draw 'circle 986,488 986,482' \
  -pointsize 17 -fill '#f2f5ee' -$FB \
  -draw "text 360,362 'Text to Speech'" -draw "text 670,362 'Voice Match'" -draw "text 980,362 'Voice Changer'" \
  -draw "text 360,532 'Dubbing Studio'" -draw "text 670,532 'Lip Sync'" -draw "text 980,532 'Voice Design'" \
  -pointsize 12 -fill '#9aa5b5' -$FR \
  -draw "text 360,392 'Type it — hear it in any voice'" -draw "text 670,392 'Clone a voice in seconds'" -draw "text 980,392 'Pitch, timbre and FX chains'" \
  -draw "text 360,562 'Translate and re-voice video'" -draw "text 670,562 'Match speech to footage'" -draw "text 980,562 'Design voices from traits'" \
  -pointsize 13 -fill '#8a8578' -$FR -draw "text 342,760 'Reachmark Audio — a product of Reachmark Digital'" \
  screenshot-desktop.png

# ---------- Mobile screenshot 750x1334 ----------
magick -size 750x1334 xc:'#151310' \
  -fill '#1b1813' -draw 'rectangle 0,0 750,120' -draw 'rectangle 0,1214 750,1334' \
  \( "$LG" -resize 64x64! \) -geometry +32+28 -composite \
  -pointsize 27 -fill '#f2f5ee' -$FB -draw "text 116,66 'Reachmark Audio'" \
  -pointsize 13 -fill '#8a8578' -$FR -draw "text 116,92 'by Reachmark Digital'" \
  -fill '#d3f36b' -draw 'roundrectangle 560,44 710,78 17,17' \
  -pointsize 14 -fill '#151310' -$FB -draw "text 582,67 '10,000 credits'" \
  -pointsize 40 -fill '#f2f5ee' -$FB -draw "text 48,214 'Good day, Creator'" \
  -pointsize 19 -fill '#9aa5b5' -$FR -draw "text 50,258 'Your studio is ready. What shall we voice today?'" \
  -fill '#201d16' -draw 'roundrectangle 40,310 360,450 18,18' -draw 'roundrectangle 390,310 710,450 18,18' \
  -draw 'roundrectangle 40,470 360,610 18,18' -draw 'roundrectangle 390,470 710,610 18,18' \
  -pointsize 14 -fill '#9aa5b5' -$FR -draw "text 64,348 'CREDITS'" -draw "text 414,348 'VOICES'" -draw "text 64,508 'RENDERS'" -draw "text 414,508 'MINUTES'" \
  -pointsize 30 -fill '#f2f5ee' -$FB -draw "text 64,404 '10,000'" -draw "text 414,404 '42'" -draw "text 64,564 '128'" -draw "text 414,564 '96'" \
  -pointsize 22 -fill '#f2f5ee' -$FB -draw "text 48,690 'Studios'" \
  -fill '#201d16' \
  -draw 'roundrectangle 40,720 710,806 16,16' -draw 'roundrectangle 40,822 710,908 16,16' \
  -draw 'roundrectangle 40,924 710,1010 16,16' -draw 'roundrectangle 40,1026 710,1112 16,16' \
  -fill '#d3f36b' -draw 'circle 76,763 76,755' -draw 'circle 76,865 76,857' \
  -fill '#ff9a4d' -draw 'circle 76,967 76,959' -draw 'circle 76,1069 76,1061' \
  -pointsize 21 -fill '#f2f5ee' -$FB -draw "text 106,771 'Text to Speech'" -draw "text 106,873 'Voice Match'" \
  -draw "text 106,975 'Dubbing Studio'" -draw "text 106,1077 'Character Agents'" \
  -pointsize 15 -fill '#9aa5b5' -$FR -draw "text 106,795 'Any voice, any language'" -draw "text 106,897 'Instant voice clone'" \
  -draw "text 106,999 'Translate and re-voice'" -draw "text 106,1101 'Agents that act and call'" \
  -pointsize 16 -fill '#d3f36b' -$FB -draw "text 90,1284 'Home'" \
  -pointsize 16 -fill '#8a8578' -$FR -draw "text 260,1284 'Studios'" -draw "text 450,1284 'Agents'" -draw "text 610,1284 'Account'" \
  screenshot-mobile.png

identify og-image.png screenshot-desktop.png screenshot-mobile.png | awk '{print $1, $3}'
