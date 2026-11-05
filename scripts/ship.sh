#!/usr/bin/env bash
# Сначала превью, потом main:
#   1. коммитит изменения в ветку preview и пушит её
#   2. открывает (или обновляет) PR preview → main и ждёт проверки CI
#   3. после подтверждения сливает PR в main
set -euo pipefail

msg="${1:-}"
if [ -z "$msg" ]; then
  echo "Использование: npm run ship -- \"сообщение коммита\"" >&2
  exit 1
fi

git fetch origin --quiet
if git show-ref --verify --quiet refs/heads/preview; then
  git checkout preview
else
  git checkout -b preview
fi
git merge --quiet --no-edit origin/main || { echo "Конфликт с main — разрешите и запустите снова." >&2; exit 1; }

git add -A
git diff --cached --quiet || git commit -m "$msg"
git push -u origin preview

if ! gh pr view preview --json state -q .state 2>/dev/null | grep -q OPEN; then
  gh pr create --base main --head preview --title "$msg" --body "Превью перед выкладкой в main."
fi

echo "Превью: $(gh pr view preview --json url -q .url)"
echo "Ждём проверки CI…"
sleep 5
gh pr checks preview --watch || { echo "Проверки не прошли — в main не пушим." >&2; exit 1; }

read -r -p "Превью ок. Пушим в main? [y/N] " ok
[ "$ok" = "y" ] || [ "$ok" = "Y" ] || { echo "Отменено, изменения остались в preview."; exit 0; }

gh pr merge preview --merge
git checkout main
git pull --ff-only origin main
git checkout preview
git merge --ff-only main
echo "Готово: изменения в main."
