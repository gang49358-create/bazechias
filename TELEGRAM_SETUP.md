# Уведомления о заказах Baze China в Telegram

## 1. Создай бота
1. Открой Telegram и найди **@BotFather**.
2. Отправь `/newbot`, задай имя и username.
3. Скопируй токен. Не публикуй его и не вставляй в GitHub.

## 2. Получи chat_id менеджеров
Каждый получатель должен открыть созданного бота и нажать **Start**.
Затем узнай chat_id каждого получателя через безопасный способ получения updates бота (например, временный диагностический скрипт на своём компьютере) и сохрани числовые ID. Username вроде @dealbin и @klacha82 сам по себе для Bot API не подходит: боту нужен chat_id, а пользователь должен сначала запустить бота.

## 3. Добавь секреты в Supabase
В Supabase открой **Project Settings → Edge Functions → Secrets** и добавь:
- `TELEGRAM_BOT_TOKEN` — токен от BotFather
- `TELEGRAM_CHAT_IDS` — chat_id получателей через запятую, например `123456789,987654321`
- `WEBHOOK_SECRET` — придумай длинную случайную строку и сохрани её отдельно

Не отправляй эти значения в чат и не добавляй в репозиторий.

## 4. Создай Edge Function
Создай функцию с именем `telegram-order-notify` в Supabase → Edge Functions. Скопируй содержимое файла:
`supabase/functions/telegram-order-notify/index.ts`

При развёртывании отключи стандартную проверку JWT для этой функции (Verify JWT = OFF), потому что её будет вызывать Database Webhook. Защита выполняется отдельным заголовком `x-webhook-secret`.

## 5. Подготовь таблицу уведомлений
Выполни SQL из файла `supabase-telegram-notifications.sql` в Supabase → SQL Editor.

## 6. Создай Database Webhook
В Supabase открой **Database → Webhooks → Create a new webhook**:
- Name: `baze-telegram-new-order`
- Table: `public.orders`
- Events: только **Insert**
- Type: **Supabase Edge Functions**
- Function: `telegram-order-notify`
- HTTP header: `x-webhook-secret: ТВОЯ_СТРОКА_WEBHOOK_SECRET`

Сохрани webhook. После этого каждый новый заказ, записанный в `orders`, будет отправлять сообщение в Telegram.

## 7. Проверь
Сначала оба менеджера должны нажать Start у бота. Затем создай тестовый заказ на сайте. Сообщение должно прийти каждому chat_id из списка.

Если бот не присылает сообщения, проверь логи функции в Supabase → Edge Functions → Logs и настройки webhook. Старые заказы автоматически не рассылаются.
