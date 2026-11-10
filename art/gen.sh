#!/bin/zsh
# 切り絵の元画像を生成する。生画像はリポジトリの外（_art_raw/dont-open-it）に置く。zsh art/gen.sh [名前...]
cd ~/Desktop/claudecode/dont-open-it/art
G=~/.claude/skills/3d-homepage/scripts/codex_imagegen.py
R=~/Desktop/claudecode/_art_raw/dont-open-it
run() { python3 $G $R/$1.png prompts/$1.md ${@:3} --quality high --size $2 > logs/$1.log 2>&1 && echo "$1 ok" || echo "$1 FAIL" }
ks=($@); (( $#ks )) || ks=(hands_a hands_b items misc desk)
for k in $ks; do if [[ $k == desk ]]; then run $k 1024x1536 & else run $k 1536x1024 & fi; done; wait
