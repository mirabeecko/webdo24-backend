#!/bin/bash
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd /Users/mb/dev/webdo24-backend

echo "=================================="
echo "  ZÁLOHA TABŮ PROHLÍŽEČŮ"
echo "=================================="
echo ""

npm run backup:tabs
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    osascript -e 'display notification "Záloha byla úspěšně nahrána do Google Sheets" with title "✅ Zálohovat Taby" sound name "Glass"'
else
    osascript -e 'display notification "Záloha se nezdařila – zkontroluj Terminál" with title "❌ Zálohovat Taby" sound name "Basso"'
fi

echo ""
read -p "Stiskni Enter pro zavření..."
