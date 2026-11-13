// Supabase Edge Function: telegram-order-notify
// Trigger this function from a Database Webhook on INSERT into public.orders.
// Required secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_IDS, WEBHOOK_SECRET.
// Required custom Supabase Edge Function secret: BAZE_SERVICE_KEY (your secret API key).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const webhookSecret = Deno.env.get("WEBHOOK_SECRET") ?? "";
  if (!webhookSecret || req.headers.get("x-webhook-secret") !== webhookSecret) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const chatIds = (Deno.env.get("TELEGRAM_CHAT_IDS") ?? "")
    .split(",").map((id) => id.trim()).filter(Boolean);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

  const secretKey = Deno.env.get("BAZE_SERVICE_KEY") ?? "";

  if (!botToken || !chatIds.length || !supabaseUrl || !secretKey) {
    return new Response("Server configuration is incomplete", { status: 500, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const orderId = payload?.record?.id;
    if (!orderId) return new Response("Missing order id", { status: 400, headers: corsHeaders });

    // Secret API keys belong in apikey only; they are not JWT bearer tokens.
    const headers = { apikey: secretKey };
    const base = supabaseUrl.replace(/\/$/, "");
    const orderResponse = await fetch(
      `${base}/rest/v1/orders?id=eq.${encodeURIComponent(String(orderId))}&select=id,customer_name,phone,email,delivery_address,customer_comment,status,total,created_at`,
      { headers },
    );
    if (!orderResponse.ok) { const detail = await orderResponse.text(); console.error("orders REST error", orderResponse.status, detail.slice(0, 300)); throw new Error(`orders REST HTTP ${orderResponse.status}: ${detail.slice(0, 200)}`); }
    const orders = await orderResponse.json();
    const order = orders?.[0];
    if (!order) return new Response("Order not found", { status: 404, headers: corsHeaders });

    const dedupeResponse = await fetch(
      `${base}/rest/v1/telegram_order_notifications?order_id=eq.${encodeURIComponent(String(orderId))}&select=order_id`,
      { headers },
    );
    if (!dedupeResponse.ok) { const detail = await dedupeResponse.text(); console.error("dedupe REST error", dedupeResponse.status, detail.slice(0, 300)); throw new Error(`notification-check REST HTTP ${dedupeResponse.status}: ${detail.slice(0, 200)}`); }
    if ((await dedupeResponse.json()).length) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itemsResponse = await fetch(
      `${base}/rest/v1/order_items?order_id=eq.${encodeURIComponent(String(orderId))}&select=product_name,size,quantity,unit_price`,
      { headers },
    );
    if (!itemsResponse.ok) { const detail = await itemsResponse.text(); console.error("order_items REST error", itemsResponse.status, detail.slice(0, 300)); throw new Error(`order_items REST HTTP ${itemsResponse.status}: ${detail.slice(0, 200)}`); }
    const items = await itemsResponse.json();
    const itemLines = (items ?? []).map((item: any) =>
      `• ${escapeHtml(item.product_name)} — EU ${escapeHtml(item.size)} × ${escapeHtml(item.quantity)} — ${Number(item.unit_price * item.quantity).toLocaleString("ru-RU")} ₽`
    ).join("\n") || "Состав заказа не найден";

    const created = order.created_at
      ? new Date(order.created_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })
      : "не указано";
    const message = [
      "🛍 <b>НОВЫЙ ЗАКАЗ · BAZE CHINA</b>",
      `<b>Заказ:</b> #${escapeHtml(order.id)}`,
      `<b>Дата:</b> ${escapeHtml(created)}`,
      "",
      "<b>ПОКУПАТЕЛЬ</b>",
      `Имя: ${escapeHtml(order.customer_name)}`,
      `Телефон: ${escapeHtml(order.phone)}`,
      order.email ? `Email: ${escapeHtml(order.email)}` : "",
      `Адрес: ${escapeHtml(order.delivery_address)}`,
      order.customer_comment ? `Комментарий: ${escapeHtml(order.customer_comment)}` : "",
      "",
      "<b>ТОВАРЫ</b>",
      itemLines,
      "",
      `<b>ИТОГО: ${Number(order.total).toLocaleString("ru-RU")} ₽</b>`,
      "Оплата на сайте не подключена — свяжитесь с покупателем для подтверждения заказа.",
    ].filter(Boolean).join("\n");

    const sentTo: string[] = [];
    for (const chatId of chatIds) {
      const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML", disable_web_page_preview: true }),
      });
      const result = await telegramResponse.json();
      if (!telegramResponse.ok || !result.ok) {
        throw new Error(`Telegram send failed for a configured chat (HTTP ${telegramResponse.status})`);
      }
      sentTo.push(chatId);
    }

    const logResponse = await fetch(`${base}/rest/v1/telegram_order_notifications`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ order_id: orderId, sent_at: new Date().toISOString() }),
    });
    if (!logResponse.ok) { const detail = await logResponse.text(); console.error("notification log REST error", logResponse.status, detail.slice(0, 300)); throw new Error(`notification-log REST HTTP ${logResponse.status}: ${detail.slice(0, 200)}`); }

    return new Response(JSON.stringify({ ok: true, recipients: sentTo.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("telegram-order-notify:", message);
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
