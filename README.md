# OneDay

Недельный планер на React Native (Expo), без WebView: все экраны — нативные компоненты.

- **Сегодня** — кольцо прогресса дня, до 3 задач, регулярные дела, свободные слоты.
- **Календарь** — неделя (нагрузка, перенос, замена с сегодняшним днём), день по часам (свободные окна, задачи на время), месяц.
- **Помощник** — расскажите о дне текстом или диктовкой с клавиатуры; Claude разбирает рассказ на сделанное, план, регулярное и бэклог, а приложение предлагает раскладку по дням.
- Проекты и бэклог, регулярные дела с напоминаниями, итоги недели, резервная копия.

Данные хранятся на устройстве (AsyncStorage). Ключ Claude API вводится в «Настройки → Помощник» и тоже хранится только на устройстве.

## Структура

```
App.tsx                корень: вкладки, кнопка помощника, слои
src/core/              логика без UI
  dates.ts             даты и форматирование
  store.ts             состояние, сохранение, тосты, вибрация
  planner.ts           лимиты дня, расстановка задач, календарь, итоги
  actions.ts           действия с отменой
  ai.ts                промпты и вызов Claude, применение ответа
  reminders.ts         напоминания, пока приложение открыто
src/ui/                тема, иконки, базовые компоненты, плитки
src/screens/           Сегодня, Календарь, листы, вложенные экраны
```

## Запуск для разработки

```bash
npm install
npx expo start
```

## Сборка в Xcode

Папка `ios/` генерируется из `app.json` (в git её нет). Если `pod install` падает с `Unicode Normalization not appropriate for ASCII-8BIT`, задайте UTF-8 локаль: `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.

```bash
npx expo prebuild --platform ios
open ios/OneDay.xcworkspace
```

В Xcode: выберите Team в Signing & Capabilities, устройство или симулятор, затем Run. Bundle ID задан в `app.json` (`kz.icon.oneday`) — поменяйте при необходимости и заново выполните `npx expo prebuild --clean`.

Или одной командой на симулятор:

```bash
npx expo run:ios
```

## GitHub

```bash
git init
git add .
git commit -m "OneDay: React Native app"
gh repo create oneday --private --source=. --push
```
