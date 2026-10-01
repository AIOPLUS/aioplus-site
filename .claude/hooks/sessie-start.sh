#!/usr/bin/env bash
# SessionStart-hook voor de repo's van AIO Plus. Kopie staat in elke repo als .claude/hooks/sessie-start.sh.
# Alleen in cloud-chats (claude.ai/code): pakketten installeren en de centrale instructies uit de hub ophalen.
# Lokaal staat de hub al als ../CLAUDE.md naast de repo, dus dan doet dit script niets.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if [ -f package-lock.json ] && [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund --loglevel=error >&2 || echo "npm ci mislukt; draai het zelf voor npm run check." >&2
fi

HUB="$(dirname "$PWD")/claude"
[ -d "$HUB" ] || git clone -q --depth 1 https://github.com/AIOPLUS/claude.git "$HUB" 2>/dev/null

if [ -f "$HUB/CLAUDE.md" ]; then
  echo "Centrale instructies van AIO Plus (hub AIOPLUS/claude, opgehaald in $HUB; ook docs/, besluiten.md en startprompts/ staan daar):"
  echo
  cat "$HUB/CLAUDE.md"
else
  echo "Let op: de hub AIOPLUS/claude (centrale instructies) kon niet worden opgehaald. Meld dit aan Jordan: de Claude GitHub-app heeft waarschijnlijk geen toegang tot die privé repo."
  echo "Volg intussen: werk op een branch, draai npm run check, open een PR en merge pas na een groene check en Jordans akkoord. Werk in het Nederlands; Jordan is geen developer."
fi
exit 0
