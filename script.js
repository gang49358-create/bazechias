let products = [
  {id:1,name:"Phantom Blue 01",category:"running",type:"RUNNING / 01",price:8490,oldPrice:9990,label:"BESTSELLER",desc:"Лёгкий силуэт и энергия для каждого километра.",image:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85",sizes:[39,40,41,42,43,44,45]},
  {id:2,name:"Midnight Runner",category:"running",type:"RUNNING / 02",price:7290,label:"NEW DROP",desc:"Глубокий чёрный. Максимальный комфорт в движении.",image:"https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=85",sizes:[39,40,41,42,43,44]},
  {id:3,name:"Blue District",category:"street",type:"STREETWEAR / 01",price:9690,label:"LIMITED",desc:"Выразительная пара для тех, кто задаёт тренды.",image:"https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=900&q=85",sizes:[40,41,42,43,44,45]},
  {id:4,name:"Cloud Shift",category:"classic",type:"CLASSIC / 01",price:6790,label:"EVERYDAY",desc:"Чистые линии и универсальный стиль на каждый день.",image:"https://images.unsplash.com/photo-1495555961986-6d4c1ecb7be3?auto=format&fit=crop&w=900&q=85",sizes:[38,39,40,41,42,43,44]},
  {id:5,name:"Electric Wave",category:"street",type:"STREETWEAR / 02",price:10990,label:"EDITOR'S PICK",desc:"Контрастные детали и смелая городская геометрия.",image:"https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=85",sizes:[39,40,41,42,43,44,45]},
  {id:6,name:"Core Mono",category:"classic",type:"CLASSIC / 02",price:5990,label:"CORE SERIES",desc:"Минималистичная база, которая сочетается со всем.",image:"https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=85",sizes:[38,39,40,41,42,43,44]}
];
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

// Supabase client: publishable key is intended for browser use; database RLS protects writes.
const SUPABASE_URL = "https://mpmdhxhhsljllouqrbtr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_wZfkO7LLjZyX8Z0D7_b4GA_YhLXsdP9";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let isAdmin = false;
let productsLoadedFromDb = false;
const fallbackProducts = products.map(p => ({...p, sizes:[...p.sizes]}));

function mapProductRow(row){
  return {id:Number(row.id), name:row.name, category:row.category, type:row.type || `${String(row.category||"classic").toUpperCase()} / CUSTOM`, price:Number(row.price), oldPrice:row.old_price==null?null:Number(row.old_price), label:row.label||"NEW", desc:row.description||"", image:row.image||"", sizes:Array.isArray(row.sizes)&&row.sizes.length?row.sizes:[39,40,41,42,43,44,45]};
}
function productToRow(p){
  return {name:p.name,category:p.category,type:p.type,price:p.price,old_price:p.oldPrice||null,label:p.label||"NEW",description:p.desc||"",image:p.image||"",sizes:p.sizes||[39,40,41,42,43,44,45]};
}
async function refreshProductsFromDb(){
  const {data,error}=await supabaseClient.from("products").select("*").order("id",{ascending:true});
  if(error){console.error("Supabase products read failed:",error.message);showToast("Не удалось загрузить товары из базы");return false;}
  productsLoadedFromDb=Boolean(data && data.length);
  if(data.length){products=data.map(mapProductRow);}
  else {products=fallbackProducts.map(p=>({...p,sizes:[...p.sizes]}));}
  // Remove cart entries for products that no longer exist in the active catalog.
  cart=cart.filter(item=>products.some(p=>p.id===item.id));saveCart();renderProducts();renderCart();
  return true;
}
async function verifyAdminSession(){
  const {data:{user},error:authError}=await supabaseClient.auth.getUser();
  if(authError||!user)return false;
  const {data,error}=await supabaseClient.from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle();
  if(error){console.error("Admin check failed:",error.message);return false;}
  return Boolean(data);
}
async function seedProductsIfEmpty(){
  const {data,error}=await supabaseClient.from("products").select("id").limit(1);
  if(error)throw error;
  if(data.length)return;
  const seed=fallbackProducts.map(productToRow);
  const {error:insertError}=await supabaseClient.from("products").insert(seed);
  if(insertError)throw insertError;
  await refreshProductsFromDb();
}
let activeCategory = "all", searchTerm = "", sortMode = "featured";
let cart = JSON.parse(localStorage.getItem("bazeCart") || "[]");
let favorites = JSON.parse(localStorage.getItem("bazeFavorites") || "[]");
let currentProduct = null, selectedSize = 42, toastTimer;

function saveCart(){ localStorage.setItem("bazeCart",JSON.stringify(cart)); }
function saveFavorites(){ localStorage.setItem("bazeFavorites",JSON.stringify(favorites)); }
function visibleProducts(){
  let list = products.filter(p => (activeCategory==="all" || p.category===activeCategory) && (p.name+" "+p.type+" "+p.desc).toLowerCase().includes(searchTerm.toLowerCase()));
  if(sortMode==="low") list.sort((a,b)=>a.price-b.price);
  if(sortMode==="high") list.sort((a,b)=>b.price-a.price);
  return list;
}
function renderProducts(){
  const list=visibleProducts();
  $("#resultCount").textContent=String(list.length).padStart(2,"0")+" моделей";
  $("#productGrid").innerHTML=list.length?list.map(p=>`
    <article class="product-card">
      <div class="product-image" data-view="${p.id}" tabindex="0" role="button" aria-label="Подробнее: ${p.name}">
        <span class="product-label">${p.label}</span>
        <button class="favorite ${favorites.includes(p.id)?"active":""}" data-fav="${p.id}" aria-label="Добавить ${p.name} в избранное">${favorites.includes(p.id)?"♥":"♡"}</button>
        <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.opacity='.15'">
      </div>
      <div class="product-info"><div class="product-meta"><span>${p.type}</span><span>★ 4.9</span></div>
      <h3 class="product-name">${p.name}</h3><p class="product-desc">${p.desc}</p>
      <div class="product-bottom"><div class="price">${money(p.price)} ${p.oldPrice?`<span class="old-price">${money(p.oldPrice)}</span>`:""}</div><button class="add-btn" data-add="${p.id}" aria-label="Добавить ${p.name} в корзину">+</button></div></div>
    </article>`).join(""):`<div class="no-results"><strong>Ничего не найдено</strong>Попробуй изменить поиск или выбрать другую категорию.</div>`;
}
function showToast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2400)}
function addToCart(id,size=42){const p=products.find(x=>x.id===id);if(!p)return;const found=cart.find(x=>x.id===id&&x.size===size);if(found)found.qty++;else cart.push({id,size,qty:1});saveCart();renderCart();showToast(`${p.name} добавлен в корзину`)}
function cartQuantity(){return cart.reduce((sum,x)=>sum+x.qty,0)}
function cartTotal(){return cart.reduce((sum,x)=>{const p=products.find(item=>item.id===x.id);return sum+(p?p.price*x.qty:0)},0)}
function renderCart(){
  $("#cartCount").textContent=cartQuantity();$("#drawerCount").textContent=`(${cartQuantity()})`;
  $("#cartTotal").textContent=money(Math.max(0,cartTotal()-promoDiscount()));$("#checkoutTotal").textContent=money(Math.max(0,cartTotal()-promoDiscount()));
  const promoLine=$("#promoDiscountLine");if(promoLine){promoLine.hidden=!appliedPromo;promoLine.textContent=appliedPromo?"Промокод "+appliedPromo.code+": −"+money(promoDiscount()):"";}
  const empty=cart.length===0;$("#cartEmpty").style.display=empty?"block":"none";$("#cartBottom").style.display=empty?"none":"block";
  $("#cartItems").innerHTML=cart.map(item=>{const p=products.find(x=>x.id===item.id);if(!p)return "";return `<div class="cart-line"><img src="${p.image}" alt=""><div><h3>${p.name}</h3><p>Размер: EU ${item.size}</p><span class="line-price">${money(p.price)}</span><div class="qty-control"><button data-qty="${p.id}" data-size="${item.size}" data-delta="-1" aria-label="Уменьшить">−</button><span>${item.qty}</span><button data-qty="${p.id}" data-size="${item.size}" data-delta="1" aria-label="Увеличить">+</button></div></div><button class="remove-item" data-remove="${p.id}" data-size="${item.size}" aria-label="Удалить">×</button></div>`}).join("");
}
function openCart(){ $("#overlay").classList.add("open");$("#cartDrawer").classList.add("open");$("#cartDrawer").setAttribute("aria-hidden","false");document.body.classList.add("locked")}
function closeCart(){ $("#overlay").classList.remove("open");$("#cartDrawer").classList.remove("open");$("#cartDrawer").setAttribute("aria-hidden","true");document.body.classList.remove("locked")}
function openProduct(id){const p=products.find(x=>x.id===id);if(!p)return;currentProduct=p;selectedSize=p.sizes.includes(42)?42:p.sizes[0];$("#modalContent").innerHTML=`<div class="modal-product"><div class="modal-product-image product-3d-viewer" id="product3dViewer" aria-label="Интерактивный просмотр ${p.name}"><div class="product-3d-stage" id="product3dStage"><img id="product3dImage" src="${p.image}" alt="${p.name} — вращайте для осмотра" draggable="false"></div><span class="viewer-badge"><span>✳</span> 3D VIEW</span><button class="viewer-reset" id="viewerReset" type="button" aria-label="Сбросить угол просмотра" title="Сбросить угол">↺</button><div class="viewer-hint">Зажми и веди мышью · на телефоне — пальцем</div></div><div class="modal-product-copy"><div class="eyebrow"><span class="eyebrow-line"></span> ${p.type}</div><h2>${p.name}</h2><p>${p.desc} Подходит для повседневного движения и городских маршрутов.</p><div class="modal-price">${money(p.price)} ${p.oldPrice?`<span class="old-price">${money(p.oldPrice)}</span>`:""}</div><span class="size-label">ВЫБЕРИ РАЗМЕР (EU)</span><div class="size-options">${p.sizes.map(s=>`<button class="size-option ${s===selectedSize?"selected":""}" data-size-select="${s}">${s}</button>`).join("")}</div><button class="button button-primary modal-add" id="modalAdd">Добавить в корзину <span>↗</span></button></div></div>`;
  const viewer=$("#product3dViewer"),stage=$("#product3dStage");let down=false,lastX=0,lastY=0,rotY=-12,rotX=0;
  const paint=()=>{stage.style.transform=`rotateX(${rotX}deg) rotateY(${rotY}deg)`};
  viewer.addEventListener("pointerdown",e=>{if(e.target.closest("button"))return;down=true;lastX=e.clientX;lastY=e.clientY;viewer.classList.add("dragging");viewer.setPointerCapture?.(e.pointerId)});
  viewer.addEventListener("pointermove",e=>{if(!down)return;rotY+=(e.clientX-lastX)*.8;rotX=Math.max(-18,Math.min(18,rotX-(e.clientY-lastY)*.35));lastX=e.clientX;lastY=e.clientY;paint()});
  const stop=()=>{down=false;viewer.classList.remove("dragging")};viewer.addEventListener("pointerup",stop);viewer.addEventListener("pointercancel",stop);viewer.addEventListener("lostpointercapture",stop);
  $("#viewerReset").addEventListener("click",()=>{rotY=-12;rotX=0;paint()});
  $("#productModal").classList.add("open");document.body.classList.add("locked");
}
function closeProduct(){$("#productModal").classList.remove("open");if(!$("#cartDrawer").classList.contains("open")&&!$("#checkoutModal").classList.contains("open"))document.body.classList.remove("locked")}
function openCheckout(){if(!cart.length){showToast("Сначала добавь товар в корзину");return}closeCart();$("#checkoutModal").classList.add("open");document.body.classList.add("locked");$("#checkoutForm").hidden=false;$("#orderSuccess").hidden=true}
function closeCheckout(){$("#checkoutModal").classList.remove("open");document.body.classList.remove("locked")}
function toggleFavorite(id){favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];saveFavorites();renderProducts();showToast(favorites.includes(id)?"Добавлено в избранное":"Удалено из избранного")}

$("#productGrid").addEventListener("click",e=>{
 const fav=e.target.closest("[data-fav]");if(fav){e.stopPropagation();toggleFavorite(Number(fav.dataset.fav));return}
 const add=e.target.closest("[data-add]");if(add){addToCart(Number(add.dataset.add));return}
 const view=e.target.closest("[data-view]");if(view)openProduct(Number(view.dataset.view));
});
$("#productGrid").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-view]")){e.preventDefault();openProduct(Number(e.target.dataset.view))}});
$$(".filter").forEach(btn=>btn.addEventListener("click",()=>{activeCategory=btn.dataset.category;$$(".filter").forEach(b=>b.classList.toggle("active",b===btn));renderProducts()}));
$("#searchInput").addEventListener("input",e=>{searchTerm=e.target.value;renderProducts()});
$(".search-open").addEventListener("click",()=>{$("#searchInput").focus();$("#catalog").scrollIntoView({behavior:"smooth"})});
$("#sortSelect").addEventListener("change",e=>{sortMode=e.target.value;renderProducts()});
$("#openCart").addEventListener("click",openCart);$("#closeCart").addEventListener("click",closeCart);$("#overlay").addEventListener("click",closeCart);$("#continueShopping").addEventListener("click",()=>{closeCart();$("#catalog").scrollIntoView({behavior:"smooth"})});
$("#cartItems").addEventListener("click",e=>{
 const qty=e.target.closest("[data-qty]");if(qty){const item=cart.find(x=>x.id===Number(qty.dataset.qty)&&x.size===Number(qty.dataset.size));if(item){item.qty+=Number(qty.dataset.delta);if(item.qty<=0)cart=cart.filter(x=>x!==item);saveCart();renderCart()}return}
 const rem=e.target.closest("[data-remove]");if(rem){cart=cart.filter(x=>!(x.id===Number(rem.dataset.remove)&&x.size===Number(rem.dataset.size)));saveCart();renderCart()}
});
$("#closeModal").addEventListener("click",closeProduct);$("#productModal").addEventListener("click",e=>{if(e.target===$("#productModal"))closeProduct()});
$("#modalContent").addEventListener("click",e=>{const s=e.target.closest("[data-size-select]");if(s){selectedSize=Number(s.dataset.sizeSelect);$$(".size-option").forEach(b=>b.classList.toggle("selected",Number(b.dataset.sizeSelect)===selectedSize));return}if(e.target.closest("#modalAdd")){addToCart(currentProduct.id,selectedSize);closeProduct();openCart()}});
$("#checkoutBtn").addEventListener("click",openCheckout);$("#closeCheckout").addEventListener("click",closeCheckout);$("#checkoutModal").addEventListener("click",e=>{if(e.target===$("#checkoutModal"))closeCheckout()});
$("#checkoutForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!cart.length){showToast("Корзина пуста");return}
 if(!productsLoadedFromDb){showToast("Каталог ещё не загружен в базу. Попроси администратора войти в панель и проверить товары.");return}
 const form=e.currentTarget;
 const submitButton=form.querySelector('button[type="submit"]');
 const data=new FormData(form);
 const items=cart.map(item=>({product_id:Number(item.id),size:Number(item.size),quantity:Number(item.qty)}));
 submitButton.disabled=true;submitButton.textContent="Сохраняем заказ…";
 try{
  const orderArgs={
   p_customer_name:String(data.get("name")||"").trim(),
   p_phone:String(data.get("phone")||"").trim(),
   p_address:String(data.get("address")||"").trim(),
   p_items:items,
   p_email:String(data.get("email")||"").trim()||null,
   p_comment:"Способ доставки: "+String(data.get("delivery")||"Курьер")
  };
  // Use the original order RPC when no promo is applied; promo wrapper only when needed.
  const {data:orderId,error}=appliedPromo
   ? await supabaseClient.rpc("create_store_order_with_promo",{...orderArgs,p_promo_code:appliedPromo.code})
   : await supabaseClient.rpc("create_store_order",orderArgs);
  if(error)throw error;
  if(!orderId)throw new Error("База не вернула номер заказа");
  $("#successText").textContent=`${String(data.get("name")).trim()}, спасибо! Заказ №${orderId} сохранён. Продавец сможет подтвердить его после проверки. Онлайн-оплаты пока нет.`;
  $("#checkoutForm").hidden=true;$("#orderSuccess").hidden=false;
  cart=[];saveCart();renderCart();form.reset();
 }catch(err){
  console.error("Order submission failed:",err);
  const msg=String(err?.message||"");
  if(msg.includes("Product not found"))showToast("Товары ещё не заведены в базе. Войди в админ-панель и проверь каталог.");
  else if(msg.includes("Invalid product size"))showToast("Выбранный размер недоступен. Обнови каталог и попробуй снова.");
  else showToast("Не удалось сохранить заказ. Проверь функцию create_store_order в Supabase.");
 }finally{submitButton.disabled=false;submitButton.innerHTML='Отправить заказ <span>↗</span>'}
});
$("#finishOrder").addEventListener("click",()=>{closeCheckout();$("#catalog").scrollIntoView({behavior:"smooth"})});
$("#newsletterForm").addEventListener("submit",e=>{e.preventDefault();const email=$("#emailInput").value.trim();if(!email)return;$("#newsletterMessage").textContent="Спасибо! Подписка сохранена только в рамках этой демонстрации.";$("#newsletterMessage").style.color="#245bff";e.currentTarget.reset();showToast("Ты в списке Baze China ✳")});
$("#menuToggle").addEventListener("click",()=>$(".nav").classList.toggle("open"));
$$(".nav a").forEach(a=>a.addEventListener("click",()=>$(".nav").classList.remove("open")));
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeCart();closeProduct();closeCheckout();$(".nav").classList.remove("open")}});
renderProducts();renderCart();


// Demo content for community, editorial news and browser-only admin panel.
const defaultReviews=[
 {id:101,name:"Артём",rating:5,text:"Очень стильная подача и удобный интерфейс. Визуально прям то, что нужно для streetwear.",date:"12.10.2026"},
 {id:102,name:"Милана",rating:5,text:"Понравились синие акценты и подборка моделей. Хочется увидеть ещё больше новых дропов.",date:"08.10.2026"},
 {id:103,name:"Даниил",rating:4,text:"Классная концепция магазина. Особенно понравилась возможность выбрать размер прямо в карточке.",date:"02.10.2026"}
];
const defaultNews=[
 {id:201,date:"19 OCT 2026",tag:"NEW DROP",title:"Скоро: новая волна синего",text:"Вдохновение ночным городом, электрические оттенки и свежие силуэты. Следи за обновлениями Baze China.",symbol:"DROP 02"},
 {id:202,date:"12 OCT 2026",tag:"BRAND NOTES",title:"Почему мы выбираем синий",text:"Синий — это движение, глубина и уверенность. Он стал визуальным кодом нашей концепции streetwear.",symbol:"BLUE"},
 {id:203,date:"04 OCT 2026",tag:"COMMUNITY",title:"Твой стиль — твои правила",text:"Baze China задуман как пространство для тех, кто смешивает направления и создаёт собственные правила.",symbol:"MOVE"}
];
// Новости и отзывы загружаются из Supabase, а не из localStorage.
let reviews=[];
let newsItems=[];
let adminTab="products";
let appliedPromo=null;
function promoDiscount(){return appliedPromo?Math.round(cartTotal()*appliedPromo.discount_percent/100):0;}
function promoCodeValue(){return String($("#promoCodeInput")?.value||"").trim().toUpperCase();}
function mapNewsRow(row){
 let displayDate = "НОВОСТЬ";
 if (row.date) {
  const rawDate = String(row.date);
  if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
   const [year, month, day] = rawDate.slice(0, 10).split("-");
   displayDate = `${day}.${month}.${year}`;
  } else {
   displayDate = rawDate;
  }
 } else if (row.created_at) {
  displayDate = new Date(row.created_at).toLocaleDateString("ru-RU");
 }
 return {id:row.id,date:displayDate,tag:row.tag||row.category||"BAZE NEWS",title:row.title||"",text:row.text||row.content||row.body||"",symbol:row.symbol||"B/C"};
}
function mapReviewRow(row){
 let displayDate = "СЕГОДНЯ";
 if (row.date) {
  const rawDate = String(row.date);
  if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
   const [year, month, day] = rawDate.slice(0, 10).split("-");
   displayDate = `${day}.${month}.${year}`;
  } else {
   displayDate = rawDate;
  }
 } else if (row.created_at) {
  displayDate = new Date(row.created_at).toLocaleDateString("ru-RU");
 }
 return {id:row.id,name:row.name||row.author_name||"Покупатель",rating:Math.max(1,Math.min(5,Number(row.rating)||5)),text:row.text||row.content||row.review_text||"",date:displayDate};
}
async function loadCommunityContent(){
 const [newsResult,reviewsResult]=await Promise.all([
  supabaseClient.from("news_items").select("*"),
  supabaseClient.from("reviews").select("*")
 ]);
 if(newsResult.error){console.error("Supabase news load failed:",newsResult.error.message);newsItems=[];}
 else newsItems=(newsResult.data||[]).map(mapNewsRow).sort((a,b)=>Number(b.id)-Number(a.id));
 if(reviewsResult.error){console.error("Supabase reviews load failed:",reviewsResult.error.message);reviews=[];}
 else reviews=(reviewsResult.data||[]).map(mapReviewRow).sort((a,b)=>Number(b.id)-Number(a.id));
 renderNews();renderReviews();
}
function renderReviews(){
 const sorted=[...reviews].sort((a,b)=>b.id-a.id);
 $("#reviewGrid").innerHTML=sorted.length?sorted.map(r=>`<article class="review-card"><div class="review-top"><span class="review-avatar">${escapeHtml(r.name.slice(0,1).toUpperCase())}</span><span class="review-name">${escapeHtml(r.name)}</span><span class="stars">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</span></div><p>${escapeHtml(r.text)}</p><span class="review-date">${escapeHtml(r.date||"СЕГОДНЯ")}</span></article>`).join(""):`<div class="admin-empty">Пока нет отзывов. Стань первым!</div>`;
 const avg=reviews.length?reviews.reduce((s,r)=>s+r.rating,0)/reviews.length:0;
 $(".review-score").innerHTML=`${avg.toFixed(1)}<span>/5</span>`;
 $(".review-summary small").textContent=`${reviews.length} отзыв(ов) · отзывы загружаются из базы`;
}
function renderNews(){
 $("#newsGrid").innerHTML=newsItems.length?newsItems.map(n=>`<article class="news-card"><div class="news-image"><span>${escapeHtml(n.symbol||"B/C")}</span></div><div class="news-body"><div class="news-meta">${escapeHtml(n.tag||"BAZE NEWS")} · ${escapeHtml(n.date||"НОВОСТЬ")}</div><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.text)}</p><button class="news-read" data-news-read="${n.id}">Читать заметку ↗</button></div></article>`).join(""):`<div class="admin-empty">Новостей пока нет.</div>`;
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
function openReview(){ $("#reviewModal").classList.add("open");document.body.classList.add("locked")}
function closeReview(){ $("#reviewModal").classList.remove("open");if(!$("#adminModal").classList.contains("open")&&!$("#checkoutModal").classList.contains("open")&&!$("#productModal").classList.contains("open"))document.body.classList.remove("locked")}
function openAdmin(){
 const modal=$("#adminModal");
 if(!modal){console.error("Admin modal #adminModal not found");return}
 modal.classList.add("open");
 document.body.classList.add("locked");
}
// Robust delegated handler: also supports header buttons and links added later.
document.addEventListener("click",e=>{
 const el=e.target.closest('a[href="#admin"], [data-open-admin], [data-admin-open], #openAdmin, #adminButton, .open-admin, .admin-open');
 const label=(e.target.closest("a,button")?.textContent||"").trim().toLowerCase();
 if(!el && !/админ.?панел|admin.?panel/.test(label))return;
 e.preventDefault();
 openAdmin();
},true);
function closeAdmin(){ $("#adminModal").classList.remove("open");document.body.classList.remove("locked")}
function adminTabButtons(){ $$(".admin-tab").forEach(b=>b.classList.toggle("active",b.dataset.adminTab===adminTab))}
async function loadAdminOrders(root){
 root.innerHTML='<div class="admin-empty">Загружаем заказы…</div>';
 const {data:orders,error}=await supabaseClient.from("orders").select("id,customer_name,phone,email,delivery_address,customer_comment,status,total,created_at").order("created_at",{ascending:false}).limit(100);
 if(error){console.error("Orders read failed:",error);root.innerHTML='<div class="admin-empty">Не удалось загрузить заказы. Проверь RLS и права администратора.</div>';return}
 if(!orders.length){root.innerHTML='<div class="admin-empty">Заказов пока нет. Новые заказы появятся здесь.</div>';return}
 const ids=orders.map(o=>o.id);
 const {data:items,error:itemError}=await supabaseClient.from("order_items").select("order_id,product_name,size,quantity,unit_price").in("order_id",ids);
 if(itemError){console.error("Order items read failed:",itemError);root.innerHTML='<div class="admin-empty">Не удалось загрузить состав заказов. Проверь права доступа к order_items.</div>';return}
 const byOrder={};for(const item of items||[]){(byOrder[item.order_id] ||= []).push(item)}
 const statuses={new:"Новый",confirmed:"Подтверждён",shipped:"Отправлен",completed:"Завершён",cancelled:"Отменён"};
 root.innerHTML=`<p class="admin-note">Последние ${orders.length} заказ(ов). Оплата на сайте не подключена; уточняй детали и оплату с покупателем отдельно.</p><div class="admin-list">${orders.map(o=>{
  const orderItems=(byOrder[o.id]||[]).map(i=>`${escapeHtml(i.product_name)} · EU ${i.size} × ${i.quantity} (${money(Number(i.unit_price)*i.quantity)})`).join('<br>');
  const created=new Date(o.created_at).toLocaleString('ru-RU');
  return `<article class="admin-list-item order-admin-item"><div class="admin-item-copy"><strong>Заказ №${o.id} · ${money(Number(o.total))}</strong><small>${escapeHtml(created)} · ${escapeHtml(o.customer_name)} · ${escapeHtml(o.phone)}</small><small>${o.email?escapeHtml(o.email)+" · ":""}${escapeHtml(o.delivery_address)}</small><small>${escapeHtml(o.customer_comment||"")}</small><small>${orderItems||"Состав заказа недоступен"}</small><label class="order-status-label">Статус <select data-order-status="${o.id}">${Object.entries(statuses).map(([value,label])=>`<option value="${value}" ${o.status===value?"selected":""}>${label}</option>`).join("")}</select></label></div></article>`;
 }).join("")}</div>`;
}
function renderAdmin(){
 adminTabButtons();const root=$("#adminPanelContent");
 if(adminTab==="orders"){
  loadAdminOrders(root);
 }else if(adminTab==="products"){
  root.innerHTML=`<form class="admin-form" id="adminProductForm"><label>Название<input name="name" required placeholder="Название модели"></label><label>Цена, ₽<input name="price" type="number" min="1" required placeholder="7990"></label><label>Категория<select name="category"><option value="running">Running</option><option value="street">Streetwear</option><option value="classic">Classic</option></select></label><label>URL фото<input name="image" type="url" placeholder="https://..."></label><label class="wide">Описание<textarea name="desc" rows="2" required placeholder="Коротко о модели"></textarea></label><button class="button button-primary" type="submit">Добавить товар +</button></form><div class="admin-list">${products.map(p=>`<div class="admin-list-item"><img src="${p.image}" alt=""><div class="admin-item-copy"><strong>${escapeHtml(p.name)}</strong><small>${money(p.price)} · ${p.category}</small></div><button data-admin-delete-product="${p.id}">Удалить</button></div>`).join("")}</div><p class="admin-note">Товары, новости, отзывы, заказы и промокоды управляются через Supabase.</p>`;
  $("#adminProductForm").addEventListener("submit",async e=>{e.preventDefault();if(!isAdmin){showToast("Сначала войди как администратор");return}const d=new FormData(e.currentTarget);const category=d.get("category");const product={name:d.get("name").trim(),category,type:category.toUpperCase()+" / CUSTOM",price:Number(d.get("price")),oldPrice:null,label:"NEW",desc:d.get("desc").trim(),image:d.get("image").trim()||"https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85",sizes:[39,40,41,42,43,44,45]};const {error}=await supabaseClient.from("products").insert(productToRow(product));if(error){console.error(error);showToast("Не удалось сохранить товар. Проверь политики Supabase");return}await refreshProductsFromDb();renderAdmin();e.currentTarget.reset();showToast("Товар сохранён в Supabase")});
 }else if(adminTab==="promos"){
   const {data:promoRows,error}=await supabaseClient.from("promo_codes").select("id,code,discount_percent,is_active,max_uses,used_count,expires_at").order("created_at",{ascending:false});
   if(error){console.error("Promo list failed:",error);root.innerHTML='<div class="admin-empty">Не удалось загрузить промокоды. Выполни SQL-миграцию promo-codes.sql.</div>';return}
   root.innerHTML='<div class="promo-admin-intro"><span class="promo-admin-kicker">BAZE / PRIVATE OFFERS</span><h3>Промокоды <span>и привилегии.</span></h3><p>Создавай персональные скидки для сообщества Baze China.</p></div><form class="admin-form promo-admin-form" id="adminPromoForm"><label>Название кода<input name="code" required minlength="3" maxlength="32" pattern="[A-Za-z0-9_-]+" placeholder="BAZE10"></label><label>Скидка, %<input name="discount_percent" type="number" min="1" max="80" required value="10"></label><label>Лимит активаций<input name="max_uses" type="number" min="1" placeholder="Без лимита"></label><label>Действует до<input name="expires_at" type="date"></label><button class="button button-primary" type="submit">＋ Создать предложение</button></form><div class="promo-admin-grid">' + promoRows.map(p=>'<article class="promo-admin-card '+(p.is_active?"is-active":"is-paused")+'"><div class="promo-admin-card-top"><span>'+(p.is_active?"ACTIVE DROP":"PAUSED")+'</span><b>'+p.discount_percent+'%</b></div><strong class="promo-admin-code">'+escapeHtml(p.code)+'</strong><small class="promo-admin-usage">Использовано: '+(p.used_count||0)+(p.max_uses?" / "+p.max_uses:" · без лимита")+'</small><small class="promo-admin-expiry">'+(p.expires_at?"До "+escapeHtml(p.expires_at):"Без срока действия")+'</small><div class="promo-admin-actions"><button type="button" data-promo-toggle="'+p.id+'" data-active="'+p.is_active+'">'+(p.is_active?"Приостановить":"Активировать")+'</button><button type="button" data-promo-delete="'+p.id+'">Удалить</button></div></article>').join("")+'</div><p class="admin-note">Скидка повторно проверяется на сервере при оформлении заказа. Максимальная скидка — 80%.</p>';
   $("#adminPromoForm").addEventListener("submit",async e=>{e.preventDefault();if(!isAdmin){showToast("Нет прав администратора");return}const d=new FormData(e.currentTarget);const payload={code:String(d.get("code")).trim().toUpperCase(),discount_percent:Number(d.get("discount_percent")),max_uses:d.get("max_uses")?Number(d.get("max_uses")):null,expires_at:d.get("expires_at")||null,is_active:true};const {error}=await supabaseClient.from("promo_codes").insert(payload);if(error){console.error("Promo create failed:",error);showToast("Не удалось создать промокод: "+error.message);return}showToast("Промокод создан");renderAdmin()});
  }else if(adminTab==="news"){
  root.innerHTML=`<form class="admin-form" id="adminNewsForm"><label>Заголовок<input name="title" required placeholder="Заголовок новости"></label><label>Категория<input name="tag" placeholder="BRAND NOTES" value="BAZE NEWS"></label><label class="wide">Текст<textarea name="text" required minlength="10" rows="3" placeholder="Текст новости"></textarea></label><button class="button button-primary" type="submit">Опубликовать новость +</button></form><div class="admin-list">${newsItems.map(n=>`<div class="admin-list-item"><div class="admin-item-copy"><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(n.tag||"BAZE NEWS")} · ${escapeHtml(n.date||"")}</small></div><button data-admin-delete-news="${n.id}">Удалить</button></div>`).join("")||'<div class="admin-empty">Опубликованных новостей пока нет.</div>'}</div>`;
  $("#adminNewsForm").addEventListener("submit", async e => {
   e.preventDefault();
   if (!isAdmin) { showToast("Нет прав администратора"); return; }
   const form = e.currentTarget;
   const d = new FormData(form);
   const button = form.querySelector('button[type="submit"]');
   const title = String(d.get("title") || "").trim();
   const content = String(d.get("text") || d.get("content") || "").trim();
   if (!title) { showToast("Введите заголовок новости"); return; }
   if (!content) { showToast("Введите текст новости"); return; }
   const payload = {
    title,
    content,
    text: content,
    tag: String(d.get("tag") || "").trim() || "BAZE NEWS",
    date: new Date().toISOString().slice(0, 10),
    symbol: "B/C"
   };
   button.disabled = true;
   button.textContent = "Публикуем…";
   try {
    const { data, error } = await supabaseClient.from("news_items").insert(payload).select("*").single();
    if (error) throw error;
    newsItems = [mapNewsRow(data), ...newsItems.filter(n => n.id !== data.id)];
    renderNews();
    renderAdmin();
    form.reset();
    showToast("Новость опубликована в Supabase");
   } catch (err) {
    console.error("News publish failed:", err);
    showToast("Ошибка публикации: " + (err.message || err.details || err.hint || "Неизвестная ошибка"));
   } finally {
    button.disabled = false;
    button.textContent = "Опубликовать новость +";
   }
  });
 }else{
  root.innerHTML=`<div class="admin-list">${reviews.length?reviews.map(r=>`<div class="admin-list-item"><div class="admin-item-copy"><strong>${escapeHtml(r.name)} · ${"★".repeat(r.rating)}</strong><small>${escapeHtml(r.text)}</small></div><button data-admin-delete-review="${r.id}">Удалить</button></div>`).join(""):`<div class="admin-empty">Отзывы отсутствуют.</div>`}</div><p class="admin-note">Отзывы загружаются из Supabase.</p>`;
 }
}
$("#writeReview").addEventListener("click",openReview);
$("#closeReview").addEventListener("click",closeReview);
$("#reviewModal").addEventListener("click",e=>{if(e.target===$("#reviewModal"))closeReview()});
$("#reviewForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const form=e.currentTarget;
 const d=new FormData(form);
 const button=form.querySelector('button[type="submit"]');
 const name=String(d.get("reviewName")||d.get("name")||form.querySelector('[name="reviewName"], [name="name"]')?.value||"").trim();
 // Support all known textarea field names; use the actual textarea value as a final fallback.
 const textValue=String(d.get("reviewText")||d.get("content")||d.get("text")||form.querySelector('textarea[name="reviewText"], textarea[name="content"], textarea[name="text"], textarea')?.value||"").trim();
 const rating=Math.max(1,Math.min(5,Number(d.get("rating")||form.querySelector('[name="rating"]')?.value)||5));
 if(!name||!textValue){showToast("Заполни имя и текст отзыва");console.warn("Review form fields:",{namePresent:Boolean(name),textPresent:Boolean(textValue),formDataKeys:[...d.keys()]});return;}
 if(textValue.length<3){showToast("Напиши отзыв чуть подробнее");return;}
 button.disabled=true;
 const originalLabel=button.textContent;
 button.textContent="Сохраняем…";
 try{
  // Both columns are NOT NULL in this database; send the same review text to both.
  const payload={name,rating,content:textValue,text:textValue,date:new Date().toISOString().slice(0,10)};
  console.info("Submitting review payload:",{...payload});
  const {data,error}=await supabaseClient.from("reviews").insert(payload).select("*").single();
  if(error)throw error;
  if(!data)throw new Error("Supabase не вернул сохранённый отзыв");
  reviews=[mapReviewRow(data),...reviews.filter(r=>String(r.id)!==String(data.id))];
  renderReviews();
  form.reset();
  closeReview();
  showToast("Спасибо! Отзыв сохранён в базе данных");
 }catch(err){
  console.error("Review submit failed:",err);
  const detail=err.message||err.details||err.hint||"Неизвестная ошибка";
  showToast("Не удалось сохранить отзыв: "+detail);
 }finally{
  button.disabled=false;
  button.textContent=originalLabel;
 }
});
$("#closeAdmin").addEventListener("click",closeAdmin);
$("#adminModal").addEventListener("click",e=>{if(e.target===$("#adminModal"))closeAdmin()});
async function loginAdmin(){
 const email=$("#adminEmail").value.trim();const password=$("#adminPassword").value;
 if(!email||!password){showToast("Введи email и пароль");return}
 const btn=$("#adminLoginBtn");btn.disabled=true;btn.textContent="Входим…";
 try{
  const {error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error)throw error;
  isAdmin=await verifyAdminSession();
  if(!isAdmin){await supabaseClient.auth.signOut();throw new Error("Этот аккаунт не добавлен в список администраторов")}
  await seedProductsIfEmpty();
  $("#adminLogin").hidden=true;$("#adminDashboard").hidden=false;adminTab="products";renderAdmin();showToast("Вход администратора выполнен");
 }catch(err){console.error(err);showToast(err.message||"Не удалось войти. Проверь данные входа")}
 finally{btn.disabled=false;btn.innerHTML='Войти <span>↗</span>'}
}
$("#adminLoginBtn").addEventListener("click",loginAdmin);
$("#adminPassword").addEventListener("keydown",e=>{if(e.key==="Enter")loginAdmin()});
$$('a[href="#admin"]').forEach(a=>a.addEventListener("click",e=>{e.preventDefault();openAdmin()}));
$("#adminDashboard").addEventListener("change",async e=>{
 const statusSelect=e.target.closest("[data-order-status]");if(!statusSelect)return;
 if(!isAdmin){showToast("Нет прав администратора");return}
 const orderId=Number(statusSelect.dataset.orderStatus);const status=statusSelect.value;
 statusSelect.disabled=true;
 const {error}=await supabaseClient.from("orders").update({status}).eq("id",orderId);
 if(error){console.error("Order status update failed:",error);showToast("Не удалось изменить статус заказа");statusSelect.disabled=false;return}
 showToast("Статус заказа обновлён");statusSelect.disabled=false;
});
$("#adminDashboard").addEventListener("click",e=>{
 const tab=e.target.closest("[data-admin-tab]");if(tab){adminTab=tab.dataset.adminTab;renderAdmin();return}
 const pt=e.target.closest("[data-promo-toggle]");if(pt){(async()=>{if(!isAdmin)return;const {error}=await supabaseClient.from("promo_codes").update({is_active:pt.dataset.active!=="true"}).eq("id",Number(pt.dataset.promoToggle));if(error){showToast("Не удалось изменить промокод");console.error(error);return}renderAdmin()})();return}
 const pd=e.target.closest("[data-promo-delete]");if(pd){(async()=>{if(!isAdmin)return;if(!confirm("Удалить промокод?"))return;const {error}=await supabaseClient.from("promo_codes").delete().eq("id",Number(pd.dataset.promoDelete));if(error){showToast("Не удалось удалить промокод");console.error(error);return}renderAdmin()})();return}
 const dp=e.target.closest("[data-admin-delete-product]");if(dp){(async()=>{const id=Number(dp.dataset.adminDeleteProduct);if(!isAdmin){showToast("Нет прав администратора");return}const {error}=await supabaseClient.from("products").delete().eq("id",id);if(error){console.error(error);showToast("Не удалось удалить товар");return}await refreshProductsFromDb();renderAdmin();showToast("Товар удалён из Supabase")})();return}
 const dn=e.target.closest("[data-admin-delete-news]");if(dn){(async()=>{if(!isAdmin){showToast("Нет прав администратора");return}const id=dn.dataset.adminDeleteNews;const {error}=await supabaseClient.from("news_items").delete().eq("id",id);if(error){console.error("News delete failed:",error);showToast("Не удалось удалить новость: "+error.message);return}newsItems=newsItems.filter(n=>String(n.id)!==String(id));renderNews();renderAdmin();showToast("Новость удалена из Supabase")})();return}
 const dr=e.target.closest("[data-admin-delete-review]");if(dr){(async()=>{if(!isAdmin){showToast("Нет прав администратора");return}const id=dr.dataset.adminDeleteReview;const {error}=await supabaseClient.from("reviews").delete().eq("id",id);if(error){console.error("Review delete failed:",error);showToast("Не удалось удалить отзыв: "+error.message);return}reviews=reviews.filter(r=>String(r.id)!==String(id));renderReviews();renderAdmin();showToast("Отзыв удалён")})();return}
});
$("#newsGrid").addEventListener("click",e=>{const b=e.target.closest("[data-news-read]");if(!b)return;const n=newsItems.find(x=>x.id===Number(b.dataset.newsRead));if(n)showToast(n.title+" — "+n.text)});
const oldEscapeHandler = null;
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeReview();closeAdmin()}});
renderReviews();renderNews();
loadCommunityContent();
refreshProductsFromDb();

/* BAZE CHINA — loading screen and signature cursor */
(()=> {
 const loader=document.getElementById('bcLoader');
 const hideLoader=()=>{if(loader){loader.classList.add('is-hidden');window.setTimeout(()=>loader.remove(),900)}};
 if(document.readyState==='complete') window.setTimeout(hideLoader,650);
 else window.addEventListener('load',()=>window.setTimeout(hideLoader,650),{once:true});
 window.setTimeout(hideLoader,3200);
 const cursor=document.getElementById('bcCursor');
 if(cursor && window.matchMedia('(pointer:fine)').matches){
   let x=-40,y=-40,tx=-40,ty=-40;
   document.addEventListener('mousemove',e=>{tx=e.clientX;ty=e.clientY;cursor.style.opacity='1'},{passive:true});
   const move=()=>{x+=(tx-x)*.22;y+=(ty-y)*.22;cursor.style.left=x+'px';cursor.style.top=y+'px';requestAnimationFrame(move)};
   cursor.style.opacity='0';move();
   document.addEventListener('mouseover',e=>{if(e.target.closest('a,button,[role="button"],input,select,textarea,.product-card'))cursor.classList.add('is-hover');else cursor.classList.remove('is-hover')},{passive:true});
 }
})();

/* BAZE CHINA — wishlist filter, order lookup, hero interaction, PWA */
let showFavoritesOnly = false;
const favFilterButton = document.getElementById("favoritesFilter");
const favCountNode = document.getElementById("favoritesCount");
const baseVisibleProducts = visibleProducts;
visibleProducts = function(){
  const list = baseVisibleProducts();
  return showFavoritesOnly ? list.filter(p=>favorites.includes(p.id)) : list;
};
const originalRenderProducts = renderProducts;
renderProducts = function(){
  originalRenderProducts();
  if(favCountNode) favCountNode.textContent=String(favorites.length);
  if(favFilterButton) {
    favFilterButton.classList.toggle("active",showFavoritesOnly);
    favFilterButton.setAttribute("aria-pressed",String(showFavoritesOnly));
  }
};
if(favFilterButton) favFilterButton.addEventListener("click",()=>{
 showFavoritesOnly=!showFavoritesOnly;
 if(showFavoritesOnly){activeCategory="all";$$(".filter[data-category]").forEach(b=>b.classList.toggle("active",b.dataset.category==="all"))}
 renderProducts();
 if(showFavoritesOnly) $("#catalog").scrollIntoView({behavior:"smooth",block:"start"});
});
/* Secure-by-filter lookup: only request the matching order id + checkout phone. RLS remains enforced by Supabase. */
$("#orderLookupForm")?.addEventListener("submit",async e=>{
 e.preventDefault();
 const form=e.currentTarget, data=new FormData(form), orderId=String(data.get("orderId")||"").trim(), phone=String(data.get("phone")||"").trim();
 const result=$("#orderLookupResult"), button=form.querySelector('button[type="submit"]');
 result.hidden=false;result.innerHTML='<p>Проверяем данные заказа…</p>';button.disabled=true;
 try{
  const {data,error}=await supabaseClient.rpc("lookup_order_status",{p_order_id:orderId,p_phone:phone});
  if(error)throw error;
  const order=Array.isArray(data)?data[0]:data;
  if(!order){result.innerHTML='<strong>Заказ не найден</strong><p>Проверь номер и телефон, указанные при оформлении. Если заказ только что создан, попробуй ещё раз позже.</p>';return}
  const statusLabels={new:"Принят",confirmed:"Подтверждён",shipped:"Отправлен",completed:"Завершён",cancelled:"Отменён"};
  const stages=["new","confirmed","shipped","completed"], active=stages.indexOf(order.status);
  const date=order.created_at?new Date(order.created_at).toLocaleString("ru-RU"):"";
  result.innerHTML='<div class="tracking-status">'+escapeHtml(statusLabels[order.status]||order.status||"Статус обновляется")+'</div><h3>Заказ №'+escapeHtml(order.id)+'</h3><p>'+(date?'Создан: '+escapeHtml(date):'')+(order.total!=null?' · Сумма: '+escapeHtml(money(Number(order.total))):'')+'</p><div class="tracking-steps">'+stages.map((s,i)=>'<span class="tracking-step '+(active>=i?'is-active':'')+'">'+escapeHtml(statusLabels[s])+'</span>').join("")+'</div>';
 }catch(err){
  console.error("Order lookup failed:",err);
  result.innerHTML='<strong>Не удалось проверить заказ</strong><p>База данных не разрешила просмотр статуса или временно недоступна. Проверь настройки RLS в Supabase; сайт не показывает чужие заказы.</p>';
 }finally{button.disabled=false}
});
/* Gentle pointer-driven depth on desktop only. */
(()=>{
 const art=$("#heroArt");
 if(!art||!window.matchMedia("(pointer:fine)").matches||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 const hero=art.closest(".hero");
 hero?.addEventListener("mousemove",e=>{
  const r=hero.getBoundingClientRect(),nx=(e.clientX-r.left)/r.width-.5,ny=(e.clientY-r.top)/r.height-.5;
  art.style.transform='perspective(1000px) rotateY('+(nx*5).toFixed(2)+'deg) rotateX('+(-ny*3).toFixed(2)+'deg) translate3d('+(nx*8).toFixed(1)+'px,'+(ny*6).toFixed(1)+'px,0)';
 });
 hero?.addEventListener("mouseleave",()=>{art.style.transform=""});
})();
/* PWA installation and same-origin offline shell; works with project-page relative paths. */
let deferredInstallPrompt=null;
const installButton=$("#installApp");
window.addEventListener("beforeinstallprompt",event=>{
 event.preventDefault();deferredInstallPrompt=event;
 if(installButton)installButton.hidden=false;
});
installButton?.addEventListener("click",async()=>{
 if(!deferredInstallPrompt){showToast("Открой меню браузера и выбери «Установить приложение» или «На экран Домой»");return}
 deferredInstallPrompt.prompt();
 await deferredInstallPrompt.userChoice;
 deferredInstallPrompt=null;installButton.hidden=true;
});
window.addEventListener("appinstalled",()=>{if(installButton)installButton.hidden=true;showToast("Baze China добавлен на устройство")});
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
 window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(err=>console.warn("PWA offline cache unavailable:",err)));
}

// BAZE promo validation; checkout recalculates the discount securely on the server.
$("#applyPromoBtn").addEventListener("click",async()=>{const code=promoCodeValue();const status=$("#promoStatus");const button=$("#applyPromoBtn");if(!code){status.textContent="Введи промокод.";return}button.disabled=true;button.textContent="Проверяем…";try{const {data,error}=await supabaseClient.rpc("validate_store_promo",{p_code:code,p_subtotal:cartTotal()});if(error)throw error;const result=Array.isArray(data)?data[0]:data;if(!result||!result.valid){appliedPromo=null;status.textContent=result?.message||"Промокод недействителен или срок его действия истёк.";showToast("Промокод не подошёл")}else{appliedPromo={code,discount_percent:Number(result.discount_percent)};status.textContent=code+" активирован · скидка "+appliedPromo.discount_percent+"%";showToast("Скидка Baze активирована")}renderCart()}catch(err){console.error("Promo validation failed:",err);appliedPromo=null;status.textContent="Ошибка проверки: "+String(err?.message||err?.details||"RPC недоступен");showToast("Не удалось проверить промокод")}finally{button.disabled=false;button.textContent="Применить";renderCart()}});
$("#promoCodeInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("#applyPromoBtn").click()}});
