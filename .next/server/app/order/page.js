(()=>{var e={};e.id=778,e.ids=[778],e.modules={5403:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external")},4749:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external")},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},5528:e=>{"use strict";e.exports=require("next/dist\\client\\components\\action-async-storage.external.js")},1877:e=>{"use strict";e.exports=require("next/dist\\client\\components\\request-async-storage.external.js")},5319:e=>{"use strict";e.exports=require("next/dist\\client\\components\\static-generation-async-storage.external.js")},4300:e=>{"use strict";e.exports=require("buffer")},6113:e=>{"use strict";e.exports=require("crypto")},2361:e=>{"use strict";e.exports=require("events")},3685:e=>{"use strict";e.exports=require("http")},5687:e=>{"use strict";e.exports=require("https")},5477:e=>{"use strict";e.exports=require("punycode")},2781:e=>{"use strict";e.exports=require("stream")},7310:e=>{"use strict";e.exports=require("url")},3837:e=>{"use strict";e.exports=require("util")},9796:e=>{"use strict";e.exports=require("zlib")},2595:(e,t,s)=>{"use strict";s.r(t),s.d(t,{GlobalError:()=>l.a,__next_app__:()=>x,originalPathname:()=>m,pages:()=>c,routeModule:()=>u,tree:()=>o});var r=s(7096),a=s(6132),i=s(7284),l=s.n(i),n=s(2564),d={};for(let e in n)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(d[e]=()=>n[e]);s.d(t,d);let o=["",{children:["order",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(s.bind(s,4130)),"C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\order\\page.tsx"]}]},{}]},{layout:[()=>Promise.resolve().then(s.bind(s,5345)),"C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\layout.tsx"],"not-found":[()=>Promise.resolve().then(s.t.bind(s,9291,23)),"next/dist/client/components/not-found-error"]}],c=["C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\order\\page.tsx"],m="/order/page",x={require:s,loadChunk:()=>Promise.resolve()},u=new r.AppPageRouteModule({definition:{kind:a.x.APP_PAGE,page:"/order/page",pathname:"/order",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:o}})},7983:(e,t,s)=>{Promise.resolve().then(s.bind(s,8448))},8448:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>OrderPage});var r=s(784),a=s(9885),i=s(9708),l=s(7094),n=s(1264),d=s(9697),o=s(1210),c=s(9546),m=s(92),x=s(5808),u=s(5894),p=s(2385),g=s(8375),h=s(6206),b=s(4155),y=s(7820);function OrderPage(){let[e,t]=(0,a.useState)(!1),[s,f]=(0,a.useState)(""),[v,j]=(0,a.useState)(null),[w,N]=(0,a.useState)([]),[_,k]=(0,a.useState)([]),[S,D]=(0,a.useState)(null),[P,F]=(0,a.useState)([]),[q,C]=(0,a.useState)("home"),[O,$]=(0,a.useState)(!1),[L,T]=(0,a.useState)(!0),[A,z]=(0,a.useState)(""),[H,E]=(0,a.useState)(""),[I,Z]=(0,a.useState)(!1),[M,U]=(0,a.useState)(!1),[R,B]=(0,a.useState)(!1),[Y,G]=(0,a.useState)(null),[Q,V]=(0,a.useState)("delivery");(0,a.useEffect)(()=>{let initializeApp=async()=>{T(!0);let e=localStorage.getItem("order_authenticated"),s=localStorage.getItem("order_location");if("true"===e&&s)try{let e=JSON.parse(s);j(e),t(!0),await Promise.all([checkPendingOrders(e.id),fetchPastOrders(e.id),fetchProducts(e.brand_id)])}catch(e){console.error("Error parsing saved data:",e),clearSession()}setTimeout(()=>{T(!1)},800)};initializeApp()},[]),(0,a.useEffect)(()=>{if(!v)return;let e=i.O.channel("order-updates").on("postgres_changes",{event:"*",schema:"public",table:"customer_orders",filter:`location_id=eq.${v.id}`},e=>{console.log("Order update received:",e),("UPDATE"===e.eventType||"INSERT"===e.eventType||"DELETE"===e.eventType)&&(checkPendingOrders(v.id),fetchPastOrders(v.id))}).subscribe();return()=>{i.O.removeChannel(e)}},[v]),(0,a.useEffect)(()=>{S&&"products"===q&&C("home")},[S,q]),(0,a.useEffect)(()=>{if(!v?.brand_id)return;let e=i.O.channel("order-products-changes").on("postgres_changes",{event:"*",schema:"public",table:"products",filter:`brand_id=eq.${v.brand_id}`},()=>{O||fetchProducts(v.brand_id)}).subscribe();return()=>{i.O.removeChannel(e)}},[v?.brand_id,O]);let W=(e=>{if(!e?.brand)return"blue";switch(e.brand.slug){case"mychoice":return"green";case"gelatofilipino":return"red";case"mang-sorbetes":return"yellow";default:return"blue"}})(v),clearSession=()=>{t(!1),j(null),N([]),k([]),D(null),C("home"),z(""),E(""),T(!1),localStorage.removeItem("order_authenticated"),localStorage.removeItem("order_location"),localStorage.removeItem("order_cart_draft")},handleLocationAuth=async e=>{e.preventDefault(),$(!0),z("");try{let{data:e,error:r}=await i.O.from("locations").select("*, brand:brands(*)").eq("passkey",s).single();if(r)throw r;j(e),t(!0),localStorage.setItem("order_authenticated","true"),localStorage.setItem("order_location",JSON.stringify(e)),await Promise.all([checkPendingOrders(e.id),fetchPastOrders(e.id),fetchProducts(e.brand_id)])}catch(e){z("Invalid location passcode. Please try again."),f("")}finally{$(!1)}},fetchProducts=async e=>{try{let{data:t,error:s}=await i.O.from("inventory_summary").select("*").eq("brand_id",e).order("category, product_name");if(s)throw s;N(t||[])}catch(e){console.error("Error fetching products:",e)}},checkPendingOrders=async e=>{try{let{data:t,error:s}=await i.O.from("customer_orders").select(`
          id, status, created_at, total_amount, delivery_type, deposit_slip_url,
          order_details (
            id, product_id, quantity, unit_price,
            products (id, name, price, unit, category)
          )
        `).eq("location_id",e).in("status",["pending","approved","released","paid"]).order("created_at",{ascending:!1}).limit(1);if(s)throw s;t&&t.length>0?D(t[0]):D(null)}catch(e){console.error("Error checking pending orders:",e)}},fetchPastOrders=async e=>{try{let{data:t,error:s}=await i.O.from("customer_orders").select(`
          id, status, created_at, total_amount, delivery_type, deposit_slip_url,
          order_details (
            id, product_id, quantity, unit_price,
            products (id, name, price, unit, category)
          )
        `).eq("location_id",e).in("status",["released","paid","complete","cancelled"]).order("created_at",{ascending:!1});if(s)throw s;F(t||[])}catch(e){console.error("Error fetching past orders:",e)}},getAvailableStock=e=>e.available_stock||0,getCartItemAvailableStock=e=>{let t=w.find(t=>(t.product_id||t.id)===e.product_id);if(t){if("modify"===q&&S){let s=S.order_details?.find(t=>t.product_id===e.product_id);if(s)return(t.available_stock||0)+s.quantity}return t.available_stock||0}return getAvailableStock(e.product)},addToCart=e=>{let t=e.product_id||e.id,s=_.find(e=>e.product_id===t);s?k(e=>e.map(e=>e.product_id===t?{...e,quantity:e.quantity+1}:e)):k(s=>[...s,{product_id:t,quantity:1,product:e}])},updateCartQuantity=(e,t)=>{t<=0?k(t=>t.filter(t=>t.product_id!==e)):k(s=>s.map(s=>s.product_id===e?{...s,quantity:t}:s))},removeFromCart=e=>{k(t=>t.filter(t=>t.product_id!==e))},calculateTotal=()=>{let e=_.reduce((e,t)=>e+(t.product.price||0)*t.quantity,0);return"delivery"===Q?e>=1e4?e:e+500:e>=1e4?.95*e:e},calculateSubtotal=()=>_.reduce((e,t)=>e+(t.product.price||0)*t.quantity,0),calculateItemCount=()=>_.reduce((e,t)=>e+t.quantity,0),getProductsByCategory=()=>{let e=w.reduce((e,t)=>{let s=t.category||"Other";return e[s]||(e[s]=[]),e[s].push(t),e},{});return e},validateStockAvailability=async()=>{let e=[];if(v?.brand_id)try{let{data:t,error:s}=await i.O.from("inventory_summary").select("*").eq("brand_id",v.brand_id);if(s)throw s;N(t||[]);let r=_.map(e=>{let s=t?.find(t=>(t.product_id||t.id)===e.product_id);return s?{...e,product:s}:e});for(let s of(k(r),r)){let r=t?.find(e=>(e.product_id||e.id)===s.product_id);if(r){let t=r.available_stock||0;if("modify"===q&&S){let e=S.order_details?.find(e=>e.product_id===s.product_id);e&&(t+=e.quantity)}s.quantity>t&&e.push(`${r.product_name||r.name}: Requested ${s.quantity}, Available ${t}`)}}}catch(t){for(let s of(console.error("Error fetching fresh product data:",t),_)){let t=getCartItemAvailableStock(s);s.quantity>t&&e.push(`${s.product.product_name||s.product.name}: Requested ${s.quantity}, Available ${t}`)}}return e},handleSubmitOrder=async()=>{if(!v||0===_.length){z("Please add items to your order.");return}let e=await validateStockAvailability();if(e.length>0){z(`Insufficient stock for the following items:
${e.join("\n")}`);return}$(!0),z("");try{for(let e of _){let{error:t}=await i.O.from("products").update({reserved:(e.product.reserved||0)+e.quantity,updated_at:new Date().toISOString()}).eq("id",e.product_id);if(t)throw t}let e=calculateTotal(),{data:t,error:s}=await i.O.from("customer_orders").insert([{location_id:v.id,brand_id:v.brand_id,customer_name:`${v.name} Order`,status:"pending",total_amount:e,delivery_type:Q}]).select();if(s)throw s;let r=_.map(e=>({order_id:t[0].id,product_id:e.product_id,quantity:e.quantity,unit_price:e.product.price||0})),{error:a}=await i.O.from("order_details").insert(r);if(a)throw a;E("Order submitted successfully!"),k([]),await checkPendingOrders(v.id),C("home"),U(!1)}catch(e){console.error("Error submitting order:",e),z("Failed to submit order. Please try again.")}finally{$(!1)}},handleUpdateOrder=async()=>{if(!S||0===_.length)return;let e=await validateStockAvailability();if(e.length>0){z(`Insufficient stock for the following items:
${e.join("\n")}`);return}$(!0),z("");try{if(S.order_details)for(let e of S.order_details){let{error:t}=await i.O.from("products").update({reserved:(e.products.reserved||0)-e.quantity,updated_at:new Date().toISOString()}).eq("id",e.product_id);if(t)throw t}for(let e of(await i.O.from("order_details").delete().eq("order_id",S.id),_)){let{error:t}=await i.O.from("products").update({reserved:(e.product.reserved||0)+e.quantity,updated_at:new Date().toISOString()}).eq("id",e.product_id);if(t)throw t}let e=_.map(e=>({order_id:S.id,product_id:e.product_id,quantity:e.quantity,unit_price:e.product.price||0}));await i.O.from("order_details").insert(e);let t=calculateTotal();await i.O.from("customer_orders").update({total_amount:t,delivery_type:Q}).eq("id",S.id),E("Order updated successfully!"),k([]),await checkPendingOrders(v.id),C("home"),U(!1)}catch(e){console.error("Error updating order:",e),z("Failed to update order. Please try again.")}finally{$(!1)}},getTotalAmount=e=>e.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0),handlePhotoUpload=async(e,t)=>{B(!0),G(e);try{let s=t.name.split(".").pop(),r=`${e}_${Date.now()}.${s}`,{data:a,error:l}=await i.O.storage.from("deposit-slips").upload(r,t);if(l)throw l;let{data:{publicUrl:n}}=i.O.storage.from("deposit-slips").getPublicUrl(r),{error:d}=await i.O.from("customer_orders").update({deposit_slip_url:n,status:"paid",updated_at:new Date().toISOString()}).eq("id",e);if(d)throw d;E("Deposit slip uploaded successfully! Order status updated to Paid."),v&&await Promise.all([checkPendingOrders(v.id),fetchPastOrders(v.id)])}catch(e){console.error("Error uploading photo:",e),z("Failed to upload deposit slip. Please try again.")}finally{B(!1),G(null)}},printReceipt=e=>{let t=window.open("","_blank");t&&(t.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - Order ${e.id.slice(0,8)}</title>
          <style>
            
            * { box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 10px; 
              background: white;
              color: black;
              line-height: 1.4;
            }
            
            .receipt-container {
              max-width: 100%;
              width: 100%;
              margin: 0;
              background: white;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
              border-radius: 12px;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              min-height: 100vh;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .header { 
              text-align: center; 
              padding: 24px 20px;
              background: ${"green"===W?"linear-gradient(135deg, #10b981 0%, #059669 100%)":"red"===W?"linear-gradient(135deg, #ef4444 0%, #dc2626 100%)":"yellow"===W?"linear-gradient(135deg, #f59e0b 0%, #d97706 100%)":"linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"};
              color: white;
              border-bottom: none;
            }
            
            .company-name { 
              font-size: 26px; 
              font-weight: 700; 
              margin-bottom: 6px;
              color: white;
              letter-spacing: 0.025em;
            }
            
            .receipt-title { 
              font-size: 16px; 
              font-weight: 400; 
              color: rgba(255, 255, 255, 0.9);
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            
            .order-info { 
              padding: 16px 20px; 
              background: #f8fafc;
              border-bottom: 1px solid #e2e8f0;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
              gap: 12px 16px;
            }
            
            .info-item {
              display: flex;
              flex-direction: column;
              text-align: center;
            }
            
            .info-label { 
              font-weight: 600; 
              color: #6b7280;
              font-size: 11px;
              text-transform: uppercase;
              margin-bottom: 4px;
              letter-spacing: 0.025em;
            }
            
            .info-value { 
              font-weight: 600; 
              color: #111827;
              font-size: 13px;
            }
            
            .status-badge {
              display: inline-block;
              padding: 2px 6px;
              border: 1px solid black;
              font-size: 11px;
              font-weight: normal;
              text-transform: uppercase;
            }
            
            .status-pending { background: white; color: black; }
            .status-approved { background: white; color: black; }
            .status-released { background: black; color: white; }
            .status-cancelled { background: white; color: black; }
            
            .items { 
              padding: 16px 20px;
              flex: 1;
              background: white;
            }
            
            .items-title {
              font-size: 14px;
              font-weight: 700;
              margin-bottom: 12px;
              color: #111827;
              text-transform: uppercase;
              letter-spacing: 0.025em;
            }
            
            .items-header {
              display: grid;
              grid-template-columns: 2fr 1fr 1fr 1fr;
              gap: 12px;
              padding: 8px 0;
              border-bottom: 2px solid #e5e7eb;
              margin-bottom: 8px;
              background: #f9fafb;
            }
            
            .header-cell {
              font-size: 12px;
              font-weight: 600;
              color: #374151;
              text-transform: uppercase;
              letter-spacing: 0.025em;
            }
            
            .header-item { text-align: left; }
            .header-qty { text-align: center; }
            .header-price { text-align: center; }
            .header-total { text-align: right; }
            
            .item-row {
              display: grid;
              grid-template-columns: 2fr 1fr 1fr 1fr;
              gap: 12px;
              align-items: center;
              padding: 8px 0;
              border-bottom: 1px solid #f3f4f6;
            }
            
            .item-row:last-child {
              border-bottom: none;
            }
            
            .item-name {
              font-weight: normal;
              color: black;
              margin-bottom: 1px;
              font-size: 12px;
            }
            
            .item-details {
              font-size: 10px;
              color: #666;
            }
            
            .item-quantity {
              text-align: center;
              font-weight: normal;
              color: black;
              font-size: 12px;
            }
            
            .item-unit-price {
              text-align: center;
              font-weight: normal;
              color: black;
              font-size: 12px;
            }
            
            .item-price {
              text-align: right;
              font-weight: bold;
              color: black;
              font-size: 12px;
            }
            
            .category-summary {
              padding: 12px 16px;
              background: #f8fafc;
              border-top: 1px solid #e2e8f0;
              margin-bottom: 8px;
            }
            
            .category-title {
              font-size: 13px;
              font-weight: 600;
              color: #374151;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.025em;
            }
            
            .category-row {
              display: grid;
              grid-template-columns: 2fr 1fr 1fr;
              gap: 8px;
              align-items: center;
              padding: 4px 0;
              border-bottom: 1px solid #e2e8f0;
            }
            
            .category-row:last-child {
              border-bottom: none;
            }
            
            .category-label {
              font-size: 12px;
              color: #374151;
              font-weight: 500;
            }
            
            .category-quantity {
              font-size: 11px;
              color: #6b7280;
              text-align: center;
            }
            
            .category-amount {
              font-size: 12px;
              color: #374151;
              font-weight: 600;
              text-align: right;
            }
            
            .total-section { 
              padding: 12px 16px;
              background: white;
              border-top: 2px solid #e2e8f0;
            }
            
            .total-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 6px;
              padding: 2px 0;
            }
            
            .total-label {
              font-weight: 500;
              color: #374151;
              font-size: 12px;
            }
            
            .total-value {
              font-weight: 600;
              color: #374151;
              font-size: 12px;
            }
            
            .grand-total {
              border-top: 2px solid #374151;
              padding-top: 8px;
              margin-top: 8px;
              font-weight: 700;
            }
            
            .grand-total .total-label {
              font-size: 14px;
              font-weight: 700;
              color: #111827;
            }
            
            .grand-total .total-value {
              font-size: 14px;
              font-weight: 700;
              color: #111827;
            }
            
            .footer { 
              text-align: center; 
              padding: 16px 20px;
              background: #f8fafc;
              color: #6b7280;
              margin-top: auto;
              border-top: 1px solid #e2e8f0;
            }
            
            .footer-text {
              font-size: 13px;
              margin-bottom: 4px;
              font-weight: 600;
              color: #374151;
            }
            
            .footer-date {
              font-size: 11px;
              color: #6b7280;
            }
            
            .notes {
              padding: 12px 16px;
              background: #fef3c7;
              border: 1px solid #f59e0b;
              margin: 8px 16px;
              border-radius: 6px;
            }
            
            .notes-title {
              font-weight: 600;
              color: #92400e;
              margin-bottom: 4px;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.025em;
            }
            
            .notes-text {
              color: #78350f;
              font-size: 12px;
              line-height: 1.4;
            }
            
            @media print { 
              body { margin: 0; padding: 0; }
              .receipt-container { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="company-name">${e.brand?.name||v?.brand?.name||"GFC"}</div>
              <div class="receipt-title">Order Receipt</div>
            </div>
            
            <div class="order-info">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Order ID</span>
                  <span class="info-value">${e.id.slice(0,8)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Date</span>
                  <span class="info-value">${(0,y.iI)(e.created_at,{dateStyle:"short"})}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Location</span>
                  <span class="info-value">${e.location?.name||v?.name||"N/A"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Logistics</span>
                  <span class="info-value">${"delivery"===e.delivery_type?"Delivery":"Pickup"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Status</span>
                  <span class="info-value">${e.status}</span>
                </div>
              </div>
            </div>
            
            <div class="items">
              <div class="items-header">
                <div class="header-cell header-item">Item</div>
                <div class="header-cell header-qty">Quantity</div>
                <div class="header-cell header-price">Unit Price</div>
                <div class="header-cell header-total">Total</div>
              </div>
              ${e.order_details.map(e=>`
                <div class="item-row">
                  <div>
                    <div class="item-name">${e.product?.name||e.products?.name}</div>
                    <div class="item-details">
                      ${e.product?.sku||e.products?.sku?`SKU: ${e.product?.sku||e.products?.sku}`:""}
                    </div>
                  </div>
                  <div class="item-quantity">${e.quantity} ${e.product?.unit||e.products?.unit}</div>
                  <div class="item-unit-price">₱${e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                  <div class="item-price">₱${(e.unit_price*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                </div>
              `).join("")}
            </div>
            
            ${e.notes?`
              <div class="notes">
                <div class="notes-title">Notes</div>
                <div class="notes-text">${e.notes}</div>
              </div>
            `:""}
            
            <div class="category-summary">
              ${(()=>{let t={};return e.order_details.forEach(e=>{let s=e.product?.category||e.products?.category||"General";t[s]||(t[s]={quantity:0,amount:0}),t[s].quantity+=e.quantity,t[s].amount+=e.unit_price*e.quantity}),Object.entries(t).map(([e,t])=>`
                  <div class="category-row">
                    <span class="category-label">${e}</span>
                    <span class="category-quantity">${t.quantity} items</span>
                    <span class="category-amount">₱${t.amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                  </div>
                `).join("")})()}
            </div>
            
            <div class="total-section">
              ${(()=>{let t=e.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0),s=0,r=t;return"delivery"===e.delivery_type?t<1e4&&(r=t+500):"pickup"===e.delivery_type&&t>=1e4&&(s=.05*t,r=t-s),`
                  <div class="total-row">
                    <span class="total-label">Subtotal</span>
                    <span class="total-value">₱${t.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                  </div>
                  ${"delivery"===e.delivery_type?`
                    <div class="total-row">
                      <span class="total-label">Delivery Fee</span>
                      <span class="total-value">${t>=1e4?"FREE (Order over ₱10k)":"+₱500.00"}</span>
                    </div>
                  `:""}
                  ${"pickup"===e.delivery_type&&t>=1e4?`
                    <div class="total-row">
                      <span class="total-label">Pickup Discount (5%)</span>
                      <span class="total-value">-₱${s.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                    </div>
                  `:""}
                  ${"pickup"===e.delivery_type&&t<1e4?`
                    <div class="total-row">
                      <span class="total-label">Pickup Discount</span>
                      <span class="total-value">Not available (Order under ₱10k)</span>
                    </div>
                  `:""}
                  <div class="total-row grand-total">
                    <span class="total-label">Total Amount</span>
                    <span class="total-value">₱${r.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                  </div>
                `})()}
            </div>
            
            <div class="footer">
              <div class="footer-text">Thank you for your order!</div>
              <div class="footer-date">Generated on ${new Date().toLocaleString()}</div>
            </div>
          </div>
        </body>
        </html>
      `),t.document.close(),t.focus(),t.print(),t.close())};return L?r.jsx("div",{className:"min-h-screen bg-gray-50 flex items-center justify-center",children:(0,r.jsxs)("div",{className:"text-center",children:[r.jsx("div",{className:`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 ${"green"===W?"bg-green-100":"red"===W?"bg-red-100":"yellow"===W?"bg-yellow-100":"bg-blue-100"}`,children:r.jsx("div",{className:`animate-spin rounded-full h-8 w-8 border-b-2 ${"green"===W?"border-green-600":"red"===W?"border-red-600":"yellow"===W?"border-yellow-600":"border-blue-600"}`})}),r.jsx("h2",{className:"text-xl font-semibold text-gray-900 mb-2",children:"Loading Order System"}),r.jsx("p",{className:"text-gray-600",children:"Please wait while we check your session..."})]})}):e?H?r.jsx("div",{className:"min-h-screen bg-gray-50 flex items-center justify-center p-4",children:(0,r.jsxs)("div",{className:"max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center",children:[r.jsx("div",{className:`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${"green"===W?"bg-green-100":"red"===W?"bg-red-100":"yellow"===W?"bg-yellow-100":"bg-blue-100"}`,children:r.jsx(n.Z,{className:`h-6 w-6 ${"green"===W?"text-green-600":"red"===W?"text-red-600":"yellow"===W?"text-yellow-600":"text-blue-600"}`})}),r.jsx("h2",{className:"text-2xl font-bold text-gray-900 mb-2",children:"Success!"}),r.jsx("p",{className:"text-gray-600 mb-6",children:H}),r.jsx("button",{onClick:()=>{E(""),C("home")},className:`w-full px-4 py-3 text-white rounded-lg transition-colors ${"green"===W?"bg-green-600 hover:bg-green-700":"red"===W?"bg-red-600 hover:bg-red-700":"yellow"===W?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:"Continue"})]})}):(0,r.jsxs)("div",{className:"min-h-screen bg-gray-50 overflow-x-hidden",children:[r.jsx("div",{className:"bg-white shadow-sm border-b",children:r.jsx("div",{className:"max-w-7xl mx-auto px-2 sm:px-4 py-4",children:(0,r.jsxs)("div",{className:"flex justify-between items-center",children:[(0,r.jsxs)("div",{className:"flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1",children:[r.jsx(d.Z,{className:`h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0 ${"green"===W?"text-green-600":"red"===W?"text-red-600":"yellow"===W?"text-yellow-600":"text-blue-600"}`}),(0,r.jsxs)("div",{className:"min-w-0 flex-1",children:[r.jsx("h1",{className:"text-lg sm:text-2xl font-bold text-gray-900 truncate",children:v?.brand?.name||"Order System"}),(0,r.jsxs)("p",{className:"text-xs sm:text-sm text-gray-500 flex items-center",children:[r.jsx(l.Z,{className:"h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0"}),r.jsx("span",{className:"truncate",children:v?.name})]})]})]}),(0,r.jsxs)("div",{className:"flex items-center space-x-1 sm:space-x-2 flex-shrink-0",children:["home"!==q&&(0,r.jsxs)("button",{onClick:()=>C("home"),className:"flex items-center space-x-1 px-2 sm:px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-xs sm:text-sm",children:[r.jsx(o.Z,{className:"h-3 w-3 sm:h-4 sm:w-4"}),r.jsx("span",{className:"hidden sm:inline",children:"Home"})]}),(0,r.jsxs)("button",{onClick:()=>Z(!0),className:"flex items-center space-x-1 px-2 sm:px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-xs sm:text-sm",children:[r.jsx(c.Z,{className:"h-3 w-3 sm:h-4 sm:w-4"}),r.jsx("span",{className:"hidden sm:inline",children:"Past Orders"})]}),(0,r.jsxs)("button",{onClick:clearSession,className:"flex items-center space-x-1 px-2 sm:px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-xs sm:text-sm",children:[r.jsx(m.Z,{className:"h-3 w-3 sm:h-4 sm:w-4"}),r.jsx("span",{className:"hidden sm:inline",children:"Logout"})]})]})]})})}),(0,r.jsxs)("div",{className:"max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8",children:["home"===q&&(0,r.jsxs)("div",{className:"space-y-6",children:[A&&r.jsx("div",{className:"bg-red-50 border border-red-200 rounded-lg p-4",children:r.jsx("p",{className:"text-red-800 whitespace-pre-line",children:A})}),S?(0,r.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:[(0,r.jsxs)("div",{className:`flex items-center justify-between p-4 rounded-lg mb-6 ${"approved"===S.status?"bg-green-50 border border-green-200":"released"===S.status?"bg-orange-50 border border-orange-200":"paid"===S.status?"bg-blue-50 border border-blue-200":"bg-yellow-50 border border-yellow-200"}`,children:[(0,r.jsxs)("div",{className:"flex items-center",children:[r.jsx("div",{className:"flex-shrink-0",children:"approved"===S.status?r.jsx(n.Z,{className:"h-5 w-5 text-green-400"}):"released"===S.status?r.jsx("div",{className:"h-5 w-5 rounded-full bg-orange-400"}):"paid"===S.status?r.jsx("div",{className:"h-5 w-5 rounded-full bg-blue-400"}):r.jsx("div",{className:"animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-400"})}),(0,r.jsxs)("div",{className:"ml-3",children:[r.jsx("h3",{className:`text-lg font-medium ${"approved"===S.status?"text-green-800":"released"===S.status?"text-orange-800":"paid"===S.status?"text-blue-800":"text-yellow-800"}`,children:"approved"===S.status?"Order Approved":"released"===S.status?"Order Released":"paid"===S.status?"Payment Received":"Pending Order"}),r.jsx("p",{className:`text-sm ${"approved"===S.status?"text-green-700":"released"===S.status?"text-orange-700":"paid"===S.status?"text-blue-700":"text-yellow-700"}`,children:"approved"===S.status?"Your order has been approved and is being processed.":"released"===S.status?"Your order has been released. Please complete payment to proceed.":"paid"===S.status?"Payment received. Your order is being prepared for completion.":"Your order is pending approval. You can modify it if needed."})]})]}),(0,r.jsxs)("div",{className:"text-right",children:[(0,r.jsxs)("p",{className:"text-2xl font-bold text-gray-900",children:["₱",S.total_amount?.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})||"0.00"]}),(0,r.jsxs)("p",{className:"text-sm text-gray-500",children:["Order #",S.id.slice(-8)]})]})]}),(0,r.jsxs)("div",{className:"space-y-4",children:[r.jsx("h4",{className:"font-medium text-gray-900",children:"Order Items"}),S.order_details?.map(e=>r.jsxs("div",{className:"flex justify-between items-center p-3 bg-gray-50 rounded-lg",children:[r.jsxs("div",{children:[r.jsx("p",{className:"font-medium text-gray-900",children:e.products.name}),r.jsxs("p",{className:"text-sm text-gray-600",children:["₱",e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})," per ",e.products.unit]})]}),r.jsxs("div",{className:"text-right",children:[r.jsxs("p",{className:"font-medium text-gray-900",children:[e.quantity," ",e.products.unit]}),r.jsxs("p",{className:"text-sm text-gray-600",children:["₱",(e.quantity*e.unit_price).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]},e.id)),r.jsx("div",{className:"mt-4 pt-4 border-t border-gray-200",children:(0,r.jsxs)("div",{className:"space-y-2",children:[(0,r.jsxs)("div",{className:"flex justify-between items-center",children:[r.jsx("span",{className:"text-sm text-gray-600",children:"Subtotal:"}),(0,r.jsxs)("span",{className:"text-sm text-gray-600",children:["₱",getTotalAmount(S).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"delivery"===S.delivery_type&&(0,r.jsxs)("div",{className:"flex justify-between items-center",children:[r.jsx("span",{className:"text-sm text-gray-600",children:"Delivery Fee:"}),getTotalAmount(S)>=1e4?r.jsx("span",{className:"text-sm text-green-600",children:"FREE (Order over ₱10k)"}):r.jsx("span",{className:"text-sm text-gray-600",children:"+₱500.00"})]}),"pickup"===S.delivery_type&&getTotalAmount(S)>=1e4&&(0,r.jsxs)("div",{className:"flex justify-between items-center",children:[r.jsx("span",{className:"text-sm text-gray-600",children:"Pickup Discount (5%):"}),(0,r.jsxs)("span",{className:"text-sm text-green-600",children:["-₱",(.05*getTotalAmount(S)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"pickup"===S.delivery_type&&1e4>getTotalAmount(S)&&(0,r.jsxs)("div",{className:"flex justify-between items-center",children:[r.jsx("span",{className:"text-sm text-gray-500",children:"Pickup Discount:"}),r.jsx("span",{className:"text-sm text-gray-500",children:"Not available (Order under ₱10k)"})]}),(0,r.jsxs)("div",{className:"flex justify-between items-center border-t pt-2",children:[r.jsx("span",{className:"font-medium text-base",children:"Total:"}),(0,r.jsxs)("span",{className:"font-semibold text-green-600 text-lg",children:["₱",S.total_amount?.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})||"0.00"]})]})]})})]}),(0,r.jsxs)("div",{className:"mt-6 flex space-x-4",children:["pending"===S.status&&(0,r.jsxs)("button",{onClick:()=>{if(S?.order_details&&"pending"===S.status){let e=S.order_details.map(e=>({product_id:e.product_id,quantity:e.quantity,product:e.products}));k(e),V(S.delivery_type||"delivery"),C("modify")}},className:`flex items-center space-x-2 px-6 py-3 text-white rounded-lg transition-colors ${"green"===W?"bg-green-600 hover:bg-green-700":"red"===W?"bg-red-600 hover:bg-red-700":"yellow"===W?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[r.jsx(x.Z,{className:"h-4 w-4"}),r.jsx("span",{children:"Modify Order"})]}),"released"===S.status&&(0,r.jsxs)("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full",children:[r.jsx("div",{className:"text-center sm:text-left",children:r.jsx("p",{className:"text-sm text-gray-600",children:"Your order has been released. Please upload your deposit slip to complete payment."})}),(0,r.jsxs)("div",{className:"flex justify-center sm:justify-end gap-2",children:[S.deposit_slip_url&&(0,r.jsxs)("button",{onClick:()=>window.open(S.deposit_slip_url,"_blank"),className:"flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-h-[44px] sm:min-h-0 w-full sm:w-auto justify-center",children:[(0,r.jsxs)("svg",{className:"h-4 w-4 sm:h-5 w-5",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:[r.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M15 12a3 3 0 11-6 0 3 3 0 016 0z"}),r.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"})]}),r.jsx("span",{className:"text-sm sm:text-base",children:"View"})]}),r.jsx("input",{type:"file",id:"deposit-slip-upload",accept:"image/*",onChange:e=>{let t=e.target.files?.[0];t&&handlePhotoUpload(S.id,t)},className:"hidden",disabled:R&&Y===S.id}),r.jsx("label",{htmlFor:"deposit-slip-upload",className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors cursor-pointer min-h-[44px] sm:min-h-0 w-full sm:w-auto justify-center ${R&&Y===S.id?"bg-gray-400 cursor-not-allowed":"green"===W?"bg-green-600 hover:bg-green-700":"red"===W?"bg-red-600 hover:bg-red-700":"yellow"===W?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:R&&Y===S.id?(0,r.jsxs)(r.Fragment,{children:[r.jsx("div",{className:"animate-spin rounded-full h-4 w-4 sm:h-5 w-5 border-b-2 border-white"}),r.jsx("span",{className:"text-sm sm:text-base",children:"Uploading..."})]}):(0,r.jsxs)(r.Fragment,{children:[r.jsx("svg",{className:"h-4 w-4 sm:h-5 w-5",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:r.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"})}),r.jsx("span",{className:"text-sm sm:text-base",children:"Upload Deposit Slip"})]})})]})]}),"approved"===S.status&&r.jsx("div",{className:"text-center w-full",children:r.jsx("p",{className:"text-sm text-gray-600 mb-4",children:"You have an approved order. Please wait for it to be processed before creating a new order."})}),"paid"===S.status&&(0,r.jsxs)("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full",children:[r.jsx("div",{className:"text-center sm:text-left",children:r.jsx("p",{className:"text-sm text-gray-600",children:"Payment received. Your order is being prepared for completion."})}),(0,r.jsxs)("div",{className:"flex justify-center sm:justify-end gap-2",children:[S.deposit_slip_url&&(0,r.jsxs)("button",{onClick:()=>window.open(S.deposit_slip_url,"_blank"),className:"flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-h-[44px] sm:min-h-0 w-full sm:w-auto justify-center",children:[(0,r.jsxs)("svg",{className:"h-4 w-4 sm:h-5 w-5",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:[r.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M15 12a3 3 0 11-6 0 3 3 0 016 0z"}),r.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"})]}),r.jsx("span",{className:"text-sm sm:text-base",children:"View"})]}),r.jsx("input",{type:"file",id:"deposit-slip-reupload",accept:"image/*",onChange:e=>{let t=e.target.files?.[0];t&&handlePhotoUpload(S.id,t)},className:"hidden",disabled:R&&Y===S.id}),r.jsx("label",{htmlFor:"deposit-slip-reupload",className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors cursor-pointer min-h-[44px] sm:min-h-0 w-full sm:w-auto justify-center ${R&&Y===S.id?"bg-gray-400 cursor-not-allowed":"green"===W?"bg-green-600 hover:bg-green-700":"red"===W?"bg-red-600 hover:bg-red-700":"yellow"===W?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:R&&Y===S.id?(0,r.jsxs)(r.Fragment,{children:[r.jsx("div",{className:"animate-spin rounded-full h-4 w-4 sm:h-5 w-5 border-b-2 border-white"}),r.jsx("span",{className:"text-sm sm:text-base",children:"Uploading..."})]}):(0,r.jsxs)(r.Fragment,{children:[r.jsx("svg",{className:"h-4 w-4 sm:h-5 w-5",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:r.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"})}),r.jsx("span",{className:"text-sm sm:text-base",children:"Re-upload Deposit Slip"})]})})]})]})]})]}):(0,r.jsxs)(r.Fragment,{children:[P.filter(e=>"released"===e.status).length>0&&(0,r.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:[(0,r.jsxs)("div",{className:"flex items-center justify-between mb-4",children:[r.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"Outstanding Balance"}),(0,r.jsxs)("span",{className:"text-sm text-gray-500",children:[P.filter(e=>"released"===e.status).length," order(s)"]})]}),P.filter(e=>"released"===e.status).map(e=>(0,r.jsxs)("div",{className:"bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4",children:[(0,r.jsxs)("div",{className:"flex items-center justify-between",children:[(0,r.jsxs)("div",{children:[(0,r.jsxs)("h4",{className:"font-medium text-orange-900",children:["Order #",e.id.slice(-8)]}),(0,r.jsxs)("p",{className:"text-sm text-orange-700",children:["Released on ",new Date(e.created_at).toLocaleDateString()]})]}),(0,r.jsxs)("div",{className:"text-right",children:[(0,r.jsxs)("p",{className:"text-2xl font-bold text-orange-900",children:["₱",e.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),r.jsx("p",{className:"text-sm text-orange-700",children:"Balance Due"})]})]}),(0,r.jsxs)("div",{className:"mt-4 space-y-3",children:[(0,r.jsxs)("div",{className:"text-sm text-orange-700",children:[r.jsx("p",{children:"Please upload your deposit slip to complete payment"}),(0,r.jsxs)("div",{className:"mt-2 text-xs text-orange-600",children:["delivery"===e.delivery_type?"Delivery Order":"Pickup Order",getTotalAmount(e)>=1e4&&"delivery"===e.delivery_type&&" • Free delivery (Order over ₱10k)",getTotalAmount(e)>=1e4&&"pickup"===e.delivery_type&&" • 5% discount applied"]})]}),(0,r.jsxs)("label",{className:`flex items-center justify-center space-x-2 px-3 py-2 sm:px-4 sm:py-2 text-white rounded-lg transition-colors cursor-pointer w-full sm:w-auto min-h-[44px] sm:min-h-0 ${"green"===W?"bg-green-600 hover:bg-green-700 active:bg-green-800":"red"===W?"bg-red-600 hover:bg-red-700 active:bg-red-800":"yellow"===W?"bg-yellow-600 hover:bg-yellow-700 active:bg-yellow-800":"bg-blue-600 hover:bg-blue-700 active:bg-blue-800"}`,children:[r.jsx("input",{type:"file",accept:"image/*",onChange:t=>{let s=t.target.files?.[0];s&&handlePhotoUpload(e.id,s)},className:"hidden",disabled:R&&Y===e.id}),R&&Y===e.id?r.jsx("div",{className:"animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"}):(0,r.jsxs)(r.Fragment,{children:[r.jsx("svg",{className:"h-4 w-4 sm:h-5 sm:w-5",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:r.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"})}),r.jsx("span",{className:"text-sm font-medium",children:"Upload Deposit Slip"})]})]})]})]},e.id))]}),(0,r.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-8 text-center",children:[r.jsx(u.Z,{className:`mx-auto h-16 w-16 mb-4 ${"green"===W?"text-green-400":"red"===W?"text-red-400":"yellow"===W?"text-yellow-400":"text-blue-400"}`}),r.jsx("h2",{className:"text-2xl font-bold text-gray-900 mb-2",children:"No Pending Orders"}),r.jsx("p",{className:"text-gray-600 mb-6",children:"You can start a new order by clicking the button below."}),(0,r.jsxs)("button",{onClick:()=>{S||C("products")},className:`flex items-center space-x-2 px-6 py-3 text-white rounded-lg transition-colors mx-auto ${"green"===W?"bg-green-600 hover:bg-green-700":"red"===W?"bg-red-600 hover:bg-red-700":"yellow"===W?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[r.jsx(p.Z,{className:"h-4 w-4"}),r.jsx("span",{children:"Start New Order"})]})]})]})]}),"products"===q&&!S&&(0,r.jsxs)("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8",children:[r.jsx("div",{className:"lg:col-span-2 min-w-0",children:(0,r.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-3 sm:p-6",children:[(0,r.jsxs)("h2",{className:"text-lg sm:text-xl font-semibold mb-4 sm:mb-6 truncate",children:[v?.brand?.name," Products"]}),r.jsx("div",{className:"space-y-6",children:Object.entries(getProductsByCategory()).map(([e,t])=>(0,r.jsxs)("div",{children:[r.jsx("h3",{className:`text-sm font-semibold mb-3 px-4 py-3 border-l-4 rounded-r-md ${"green"===W?"border-green-500 bg-green-100 text-green-800":"red"===W?"border-red-500 bg-red-100 text-red-800":"yellow"===W?"border-yellow-500 bg-yellow-100 text-yellow-800":"border-blue-500 bg-blue-100 text-blue-800"}`,children:e}),r.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4",children:t.map(e=>{let t=e.product_id||e.id,s=_.some(e=>e.product_id===t),a=_.find(e=>e.product_id===t)?.quantity||0,i=getAvailableStock(e);return(0,r.jsxs)("div",{className:`border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors min-w-0 ${s?"border-blue-400 bg-blue-50":"border-gray-200"}`,children:[(0,r.jsxs)("div",{className:"flex justify-between items-start mb-2 min-w-0",children:[r.jsx("h4",{className:"font-medium text-gray-900 text-sm sm:text-base pr-2 truncate min-w-0 flex-1",children:e.product_name||e.name}),(0,r.jsxs)("div",{className:"flex items-center space-x-2 flex-shrink-0",children:[a>0&&r.jsx("span",{className:"bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full",children:a}),r.jsx("span",{className:"text-xs sm:text-sm text-gray-500",children:e.unit})]})]}),(0,r.jsxs)("p",{className:"text-base sm:text-lg font-semibold text-green-600 mb-2 sm:mb-3",children:["₱",(e.price||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,r.jsxs)("div",{className:"flex justify-between items-center min-w-0",children:[(0,r.jsxs)("span",{className:`text-xs sm:text-sm font-medium ${i>0?"text-green-600":"text-red-600"}`,children:["Stock: ",i]}),r.jsx("button",{onClick:()=>addToCart(e),disabled:0===i||s&&a>=i,className:`px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${i>0&&(!s||a<i)?"green"===W?"bg-green-600 text-white hover:bg-green-700":"red"===W?"bg-red-600 text-white hover:bg-red-700":"yellow"===W?"bg-yellow-600 text-white hover:bg-yellow-700":"bg-blue-600 text-white hover:bg-blue-700":"bg-gray-400 text-gray-200 cursor-not-allowed"}`,children:0===i?"Out":s&&a>=i?"Max":s?"More":"Add"})]})]},t)})})]},e))})]})}),r.jsx("div",{className:"hidden lg:block lg:col-span-1",children:(0,r.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6 sticky top-8",children:[(0,r.jsxs)("h3",{className:"text-lg font-semibold mb-4",children:["Cart (",calculateItemCount()," items)"]}),0===_.length?(0,r.jsxs)("div",{className:"text-center py-8",children:[r.jsx("p",{className:"text-gray-500 mb-4",children:"No items in cart"}),(0,r.jsxs)("button",{onClick:()=>U(!0),className:`w-full flex items-center justify-center space-x-2 px-4 py-3 text-white rounded-lg transition-colors ${"green"===W?"bg-green-600 hover:bg-green-700":"red"===W?"bg-red-600 hover:bg-red-700":"yellow"===W?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[r.jsx(u.Z,{className:"h-5 w-5"}),r.jsx("span",{children:"View Cart"})]})]}):(0,r.jsxs)(r.Fragment,{children:[r.jsx("div",{className:"space-y-3 mb-6",children:_.map(e=>{let t=getCartItemAvailableStock(e),s=e.quantity>t;return(0,r.jsxs)("div",{className:`flex justify-between items-center p-3 rounded-lg ${s?"bg-red-50 border border-red-200":"bg-gray-50"}`,children:[(0,r.jsxs)("div",{className:"flex-1",children:[r.jsx("p",{className:"text-sm font-medium",children:e.product.product_name||e.product.name}),(0,r.jsxs)("p",{className:"text-xs text-gray-500",children:["₱",(e.product.price||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})," per ",e.product.unit]}),(0,r.jsxs)("div",{className:"flex items-center space-x-2 mt-1",children:[r.jsx("button",{onClick:()=>updateCartQuantity(e.product_id,e.quantity-1),className:"p-1 text-gray-400 hover:text-gray-600",children:r.jsx(g.Z,{className:"h-3 w-3"})}),r.jsx("span",{className:`text-sm w-8 text-center ${s?"text-red-600 font-semibold":"text-gray-600"}`,children:e.quantity}),r.jsx("button",{onClick:()=>updateCartQuantity(e.product_id,e.quantity+1),disabled:e.quantity>=t,className:"p-1 text-gray-400 hover:text-gray-600 disabled:text-gray-300",children:r.jsx(p.Z,{className:"h-3 w-3"})})]}),(0,r.jsxs)("p",{className:`text-xs mt-1 ${s?"text-red-600 font-medium":"text-gray-500"}`,children:["Max: ",t," | Total: ₱",((e.product.price||0)*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),r.jsx("button",{onClick:()=>removeFromCart(e.product_id),className:"text-red-500 hover:text-red-700 ml-2",children:r.jsx(h.Z,{className:"h-4 w-4"})})]},e.product_id)})}),(0,r.jsxs)("div",{className:"border-t pt-4",children:[(0,r.jsxs)("div",{className:"mb-4",children:[r.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Delivery Type"}),(0,r.jsxs)("div",{className:"flex space-x-4",children:[(0,r.jsxs)("label",{className:"flex items-center",children:[r.jsx("input",{type:"radio",name:"deliveryType",value:"delivery",checked:"delivery"===Q,onChange:e=>V(e.target.value),className:"mr-2"}),r.jsx("span",{className:"text-sm",children:"Delivery (+₱500)"})]}),(0,r.jsxs)("label",{className:"flex items-center",children:[r.jsx("input",{type:"radio",name:"deliveryType",value:"pickup",checked:"pickup"===Q,onChange:e=>V(e.target.value),className:"mr-2"}),r.jsx("span",{className:"text-sm",children:"Pickup (5% off)"})]})]})]}),(0,r.jsxs)("div",{className:"space-y-2 mb-4",children:[(0,r.jsxs)("div",{className:"flex justify-between items-center",children:[r.jsx("span",{className:"text-sm text-gray-600",children:"Subtotal:"}),(0,r.jsxs)("span",{className:"text-sm text-gray-600",children:["₱",calculateSubtotal().toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"delivery"===Q&&(0,r.jsxs)("div",{className:"flex justify-between items-center",children:[r.jsx("span",{className:"text-sm text-gray-600",children:"Delivery Fee:"}),calculateSubtotal()>=1e4?r.jsx("span",{className:"text-sm text-green-600",children:"FREE (Order over ₱10k)"}):r.jsx("span",{className:"text-sm text-gray-600",children:"+₱500.00"})]}),"pickup"===Q&&calculateSubtotal()>=1e4&&(0,r.jsxs)("div",{className:"flex justify-between items-center",children:[r.jsx("span",{className:"text-sm text-gray-600",children:"Pickup Discount (5%):"}),(0,r.jsxs)("span",{className:"text-sm text-green-600",children:["-₱",(.05*calculateSubtotal()).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"pickup"===Q&&1e4>calculateSubtotal()&&(0,r.jsxs)("div",{className:"flex justify-between items-center",children:[r.jsx("span",{className:"text-sm text-gray-500",children:"Pickup Discount:"}),r.jsx("span",{className:"text-sm text-gray-500",children:"Not available (Order under ₱10k)"})]}),(0,r.jsxs)("div",{className:"flex justify-between items-center border-t pt-2",children:[r.jsx("span",{className:"font-medium",children:"Total:"}),(0,r.jsxs)("span",{className:"font-semibold text-green-600 text-lg",children:["₱",calculateTotal().toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]}),(0,r.jsxs)("button",{onClick:()=>U(!0),className:`w-full flex items-center justify-center space-x-2 px-4 py-3 text-white rounded-lg transition-colors ${"green"===W?"bg-green-600 hover:bg-green-700":"red"===W?"bg-red-600 hover:bg-red-700":"yellow"===W?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[r.jsx(u.Z,{className:"h-5 w-5"}),r.jsx("span",{children:"View Cart"})]})]})]})]})})]}),"products"===q&&!S&&r.jsx("div",{className:"lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40",children:(0,r.jsxs)("div",{className:"px-2 py-2",children:[(0,r.jsxs)("div",{className:"flex justify-between items-center mb-2 min-w-0",children:[(0,r.jsxs)("span",{className:"font-medium text-sm truncate",children:["Items: ",calculateItemCount()," • ","delivery"===Q?"Delivery":"Pickup"]}),(0,r.jsxs)("span",{className:"font-bold text-base text-green-600 flex-shrink-0 ml-2",children:["₱",calculateTotal().toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),(0,r.jsxs)("button",{onClick:()=>U(!0),disabled:S,className:`w-full flex items-center justify-center space-x-1 px-2 py-2 rounded-lg transition-colors text-xs sm:text-sm min-w-0 disabled:opacity-50 disabled:cursor-not-allowed ${"green"===W?"bg-green-600 hover:bg-green-700 text-white":"red"===W?"bg-red-600 hover:bg-red-700 text-white":"yellow"===W?"bg-yellow-600 hover:bg-yellow-700 text-white":"bg-blue-600 hover:bg-blue-700 text-white"}`,children:[r.jsx(u.Z,{className:"h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0"}),r.jsx("span",{className:"truncate",children:"View Cart"})]})]})}),"products"===q&&!S&&r.jsx("div",{className:"lg:hidden pb-20"}),"modify"===q&&(0,r.jsxs)("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8",children:[r.jsx("div",{className:"lg:col-span-2 min-w-0",children:(0,r.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-3 sm:p-6",children:[r.jsx("h2",{className:"text-lg sm:text-xl font-semibold mb-4 sm:mb-6 truncate",children:"Modify Order - Draft Mode"}),r.jsx("div",{className:"bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6",children:(0,r.jsxs)("p",{className:"text-yellow-800 text-xs sm:text-sm",children:[r.jsx("strong",{children:"Note:"}),' Changes are saved as draft. Click "Update Order" to save changes permanently.']})}),r.jsx("div",{className:"space-y-6",children:Object.entries(getProductsByCategory()).map(([e,t])=>(0,r.jsxs)("div",{children:[r.jsx("h3",{className:`text-sm font-semibold mb-3 px-4 py-3 border-l-4 rounded-r-md ${"green"===W?"border-green-500 bg-green-100 text-green-800":"red"===W?"border-red-500 bg-red-100 text-red-800":"yellow"===W?"border-yellow-500 bg-yellow-100 text-yellow-800":"border-blue-500 bg-blue-100 text-blue-800"}`,children:e}),r.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4",children:t.map(e=>{let t=e.product_id||e.id,s=_.some(e=>e.product_id===t),a=_.find(e=>e.product_id===t)?.quantity||0,i=getAvailableStock(e);return(0,r.jsxs)("div",{className:`border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors min-w-0 ${s?"border-blue-400 bg-blue-50":"border-gray-200"}`,children:[(0,r.jsxs)("div",{className:"flex justify-between items-start mb-2 min-w-0",children:[r.jsx("h4",{className:"font-medium text-gray-900 text-sm sm:text-base pr-2 truncate min-w-0 flex-1",children:e.product_name||e.name}),(0,r.jsxs)("div",{className:"flex items-center space-x-2 flex-shrink-0",children:[a>0&&r.jsx("span",{className:"bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full",children:a}),r.jsx("span",{className:"text-xs sm:text-sm text-gray-500",children:e.unit})]})]}),(0,r.jsxs)("p",{className:"text-base sm:text-lg font-semibold text-green-600 mb-2 sm:mb-3",children:["₱",(e.price||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,r.jsxs)("div",{className:"flex justify-between items-center min-w-0",children:[(0,r.jsxs)("span",{className:`text-xs sm:text-sm font-medium ${i>0?"text-green-600":"text-red-600"}`,children:["Stock: ",i]}),r.jsx("button",{onClick:()=>addToCart(e),disabled:0===i||s&&a>=i,className:`px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${i>0&&(!s||a<i)?"green"===W?"bg-green-600 text-white hover:bg-green-700":"red"===W?"bg-red-600 text-white hover:bg-red-700":"yellow"===W?"bg-yellow-600 text-white hover:bg-yellow-700":"bg-blue-600 text-white hover:bg-blue-700":"bg-gray-400 text-gray-200 cursor-not-allowed"}`,children:0===i?"Out":s&&a>=i?"Max":s?"More":"Add"})]})]},t)})})]},e))})]})}),r.jsx("div",{className:"hidden lg:block lg:col-span-1",children:(0,r.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6 sticky top-8",children:[(0,r.jsxs)("h3",{className:"text-lg font-semibold mb-4",children:["Order Draft (",calculateItemCount()," items)"]}),0===_.length?r.jsx("p",{className:"text-gray-500 text-center py-8",children:"No items in draft"}):(0,r.jsxs)(r.Fragment,{children:[r.jsx("div",{className:"space-y-3 mb-6",children:_.map(e=>{let t=getCartItemAvailableStock(e),s=e.quantity>t;return(0,r.jsxs)("div",{className:`flex justify-between items-center p-3 rounded-lg ${s?"bg-red-50 border border-red-200":"bg-gray-50"}`,children:[(0,r.jsxs)("div",{className:"flex-1",children:[r.jsx("p",{className:"text-sm font-medium",children:e.product.product_name||e.product.name}),(0,r.jsxs)("p",{className:"text-xs text-gray-500",children:["₱",(e.product.price||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})," per ",e.product.unit]}),(0,r.jsxs)("div",{className:"flex items-center space-x-2 mt-1",children:[r.jsx("button",{onClick:()=>updateCartQuantity(e.product_id,e.quantity-1),className:"p-1 text-gray-400 hover:text-gray-600",children:r.jsx(g.Z,{className:"h-3 w-3"})}),r.jsx("span",{className:`text-sm w-8 text-center ${s?"text-red-600 font-semibold":"text-gray-600"}`,children:e.quantity}),r.jsx("button",{onClick:()=>updateCartQuantity(e.product_id,e.quantity+1),disabled:e.quantity>=t,className:"p-1 text-gray-400 hover:text-gray-600 disabled:text-gray-300",children:r.jsx(p.Z,{className:"h-3 w-3"})})]}),(0,r.jsxs)("p",{className:`text-xs mt-1 ${s?"text-red-600 font-medium":"text-gray-500"}`,children:["Max: ",t," | Total: ₱",((e.product.price||0)*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),r.jsx("button",{onClick:()=>removeFromCart(e.product_id),className:"text-red-500 hover:text-red-700 ml-2",children:r.jsx(h.Z,{className:"h-4 w-4"})})]},e.product_id)})}),(0,r.jsxs)("div",{className:"border-t pt-4",children:[(0,r.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[r.jsx("span",{className:"font-medium",children:"Total:"}),(0,r.jsxs)("span",{className:"font-semibold text-green-600 text-lg",children:["₱",calculateTotal().toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),(0,r.jsxs)("button",{onClick:()=>U(!0),className:`w-full flex items-center justify-center space-x-2 px-4 py-3 text-white rounded-lg transition-colors ${"green"===W?"bg-green-600 hover:bg-green-700":"red"===W?"bg-red-600 hover:bg-red-700":"yellow"===W?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[r.jsx(x.Z,{className:"h-5 w-5"}),r.jsx("span",{children:"View Changes"})]})]})]})]})})]}),"modify"===q&&r.jsx("div",{className:"lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40",children:(0,r.jsxs)("div",{className:"px-2 py-2",children:[(0,r.jsxs)("div",{className:"flex justify-between items-center mb-2 min-w-0",children:[(0,r.jsxs)("span",{className:"font-medium text-sm truncate",children:["Draft: ",calculateItemCount()," items • ","delivery"===Q?"Delivery":"Pickup"]}),(0,r.jsxs)("span",{className:"font-bold text-base text-green-600 flex-shrink-0 ml-2",children:["₱",calculateTotal().toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),(0,r.jsxs)("button",{onClick:()=>U(!0),className:`w-full flex items-center justify-center space-x-1 px-2 py-2 rounded-lg transition-colors text-xs sm:text-sm min-w-0 ${"green"===W?"bg-green-600 hover:bg-green-700 text-white":"red"===W?"bg-red-600 hover:bg-red-700 text-white":"yellow"===W?"bg-yellow-600 hover:bg-yellow-700 text-white":"bg-blue-600 hover:bg-blue-700 text-white"}`,children:[r.jsx(x.Z,{className:"h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0"}),r.jsx("span",{className:"truncate",children:"View Changes"})]})]})}),"modify"===q&&r.jsx("div",{className:"lg:hidden pb-20"})]}),M&&(!S||"modify"===q)&&r.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4",children:(0,r.jsxs)("div",{className:"bg-white rounded-t-lg sm:rounded-lg w-full max-w-md max-h-[80vh] overflow-hidden",children:[(0,r.jsxs)("div",{className:"flex items-center justify-between p-3 sm:p-4 border-b min-w-0",children:[(0,r.jsxs)("h2",{className:"text-base sm:text-lg font-semibold truncate min-w-0 flex-1",children:["modify"===q?"Order Draft":"Your Cart"," (",calculateItemCount()," items)"]}),r.jsx("button",{onClick:()=>U(!1),className:"p-2 text-gray-400 hover:text-gray-600 flex-shrink-0",children:r.jsx(h.Z,{className:"h-4 w-4 sm:h-5 sm:w-5"})})]}),r.jsx("div",{className:"p-3 sm:p-4 max-h-96 overflow-y-auto",children:0===_.length?(0,r.jsxs)("p",{className:"text-gray-500 text-center py-8",children:["No items in ","modify"===q?"draft":"cart"]}):r.jsx("div",{className:"space-y-3",children:_.map(e=>{let t=getCartItemAvailableStock(e),s=e.quantity>t;return(0,r.jsxs)("div",{className:`flex justify-between items-center p-2 sm:p-3 rounded-lg min-w-0 ${s?"bg-red-50 border border-red-200":"bg-gray-50"}`,children:[(0,r.jsxs)("div",{className:"flex-1 min-w-0",children:[r.jsx("p",{className:"text-sm font-medium text-gray-900 truncate",children:e.product.product_name||e.product.name}),(0,r.jsxs)("p",{className:"text-xs text-gray-500",children:["₱",(e.product.price||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})," per ",e.product.unit]}),(0,r.jsxs)("div",{className:"flex items-center space-x-2 mt-1",children:[r.jsx("button",{onClick:()=>updateCartQuantity(e.product_id,e.quantity-1),className:"p-1 text-gray-400 hover:text-gray-600 flex-shrink-0",children:r.jsx(g.Z,{className:"h-3 w-3"})}),r.jsx("span",{className:`text-sm w-6 sm:w-8 text-center ${s?"text-red-600 font-semibold":"text-gray-600"}`,children:e.quantity}),r.jsx("button",{onClick:()=>updateCartQuantity(e.product_id,e.quantity+1),disabled:e.quantity>=t,className:"p-1 text-gray-400 hover:text-gray-600 disabled:text-gray-300 flex-shrink-0",children:r.jsx(p.Z,{className:"h-3 w-3"})})]}),(0,r.jsxs)("p",{className:`text-xs mt-1 ${s?"text-red-600 font-medium":"text-gray-500"}`,children:["Max: ",t," | Total: ₱",((e.product.price||0)*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),r.jsx("button",{onClick:()=>removeFromCart(e.product_id),className:"text-red-500 hover:text-red-700 ml-2 flex-shrink-0",children:r.jsx(h.Z,{className:"h-3 w-3 sm:h-4 sm:w-4"})})]},e.product_id)})})}),_.length>0&&(0,r.jsxs)("div",{className:"p-3 sm:p-4 border-t bg-gray-50",children:[(0,r.jsxs)("div",{className:"mb-3 sm:mb-4",children:[r.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Delivery Type"}),(0,r.jsxs)("div",{className:"flex space-x-4",children:[(0,r.jsxs)("label",{className:"flex items-center",children:[r.jsx("input",{type:"radio",name:"deliveryTypeModal",value:"delivery",checked:"delivery"===Q,onChange:e=>V(e.target.value),className:"mr-2"}),r.jsx("span",{className:"text-sm",children:"Delivery (+₱500)"})]}),(0,r.jsxs)("label",{className:"flex items-center",children:[r.jsx("input",{type:"radio",name:"deliveryTypeModal",value:"pickup",checked:"pickup"===Q,onChange:e=>V(e.target.value),className:"mr-2"}),r.jsx("span",{className:"text-sm",children:"Pickup (5% off)"})]})]})]}),(0,r.jsxs)("div",{className:"space-y-2 mb-3 sm:mb-4",children:[(0,r.jsxs)("div",{className:"flex justify-between items-center",children:[r.jsx("span",{className:"text-sm text-gray-600",children:"Subtotal:"}),(0,r.jsxs)("span",{className:"text-sm text-gray-600",children:["₱",calculateSubtotal().toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"delivery"===Q&&(0,r.jsxs)("div",{className:"flex justify-between items-center",children:[r.jsx("span",{className:"text-sm text-gray-600",children:"Delivery Fee:"}),calculateSubtotal()>=1e4?r.jsx("span",{className:"text-sm text-green-600",children:"FREE (Order over ₱10k)"}):r.jsx("span",{className:"text-sm text-gray-600",children:"+₱500.00"})]}),"pickup"===Q&&calculateSubtotal()>=1e4&&(0,r.jsxs)("div",{className:"flex justify-between items-center",children:[r.jsx("span",{className:"text-sm text-gray-600",children:"Pickup Discount (5%):"}),(0,r.jsxs)("span",{className:"text-sm text-green-600",children:["-₱",(.05*calculateSubtotal()).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"pickup"===Q&&1e4>calculateSubtotal()&&(0,r.jsxs)("div",{className:"flex justify-between items-center",children:[r.jsx("span",{className:"text-sm text-gray-500",children:"Pickup Discount:"}),r.jsx("span",{className:"text-sm text-gray-500",children:"Not available (Order under ₱10k)"})]}),(0,r.jsxs)("div",{className:"flex justify-between items-center border-t pt-2",children:[r.jsx("span",{className:"font-medium text-sm sm:text-base",children:"Total:"}),(0,r.jsxs)("span",{className:"font-semibold text-green-600 text-base sm:text-lg flex-shrink-0 ml-2",children:["₱",calculateTotal().toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]}),A&&r.jsx("div",{className:"bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4",children:r.jsx("p",{className:"text-red-800 text-xs sm:text-sm whitespace-pre-line",children:A})}),r.jsx("div",{className:"space-y-2",children:"modify"===q?(0,r.jsxs)(r.Fragment,{children:[(0,r.jsxs)("button",{onClick:handleUpdateOrder,disabled:O||0===_.length,className:`w-full flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-3 text-white rounded-lg disabled:opacity-50 transition-colors text-sm sm:text-base ${"green"===W?"bg-green-600 hover:bg-green-700":"red"===W?"bg-red-600 hover:bg-red-700":"yellow"===W?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[O?r.jsx("div",{className:"animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white flex-shrink-0"}):r.jsx(x.Z,{className:"h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"}),r.jsx("span",{className:"truncate",children:O?"Updating...":"Update Order"})]}),r.jsx("button",{onClick:()=>{k([]),C("home"),U(!1)},className:"w-full px-3 sm:px-4 py-2 sm:py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm sm:text-base",children:"Cancel Changes"})]}):(0,r.jsxs)("button",{onClick:handleSubmitOrder,disabled:O||0===_.length,className:`w-full flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-3 text-white rounded-lg disabled:opacity-50 transition-colors text-sm sm:text-base ${"green"===W?"bg-green-600 hover:bg-green-700":"red"===W?"bg-red-600 hover:bg-red-700":"yellow"===W?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[O?r.jsx("div",{className:"animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white flex-shrink-0"}):r.jsx(u.Z,{className:"h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"}),r.jsx("span",{className:"truncate",children:O?"Submitting...":"Submit Order"})]})})]})]})}),I&&r.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4",children:(0,r.jsxs)("div",{className:"bg-white rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden",children:[(0,r.jsxs)("div",{className:"flex items-center justify-between p-4 border-b",children:[r.jsx("h2",{className:"text-lg font-semibold",children:"Past Orders"}),r.jsx("button",{onClick:()=>Z(!1),className:"p-2 text-gray-400 hover:text-gray-600",children:r.jsx(h.Z,{className:"h-5 w-5"})})]}),r.jsx("div",{className:"p-6 max-h-96 overflow-y-auto",children:0===P.length?r.jsx("p",{className:"text-gray-500 text-center py-8",children:"No past orders found"}):r.jsx("div",{className:"space-y-4",children:P.map(e=>(0,r.jsxs)("div",{className:"border rounded-lg p-4 hover:bg-gray-50",children:[(0,r.jsxs)("div",{className:"flex justify-between items-start mb-3",children:[(0,r.jsxs)("div",{children:[(0,r.jsxs)("h3",{className:"font-medium text-gray-900",children:["Order #",e.id.slice(-8)]}),(0,r.jsxs)("p",{className:"text-sm text-gray-500",children:[new Date(e.created_at).toLocaleDateString()," at ",new Date(e.created_at).toLocaleTimeString()]})]}),(0,r.jsxs)("div",{className:"text-right",children:[r.jsx("span",{className:`px-2 py-1 rounded-full text-xs font-medium ${"released"===e.status?"bg-green-100 text-green-800":"paid"===e.status?"bg-blue-100 text-blue-800":"complete"===e.status?"bg-purple-100 text-purple-800":"bg-red-100 text-red-800"}`,children:e.status.charAt(0).toUpperCase()+e.status.slice(1)}),(0,r.jsxs)("p",{className:"text-lg font-semibold text-gray-900 mt-1",children:["₱",e.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]}),(0,r.jsxs)("div",{className:"space-y-2",children:[e.order_details.map(e=>(0,r.jsxs)("div",{className:"flex justify-between items-center text-sm",children:[r.jsx("span",{className:"text-gray-900",children:e.products.name}),(0,r.jsxs)("span",{className:"text-gray-600",children:[e.quantity," \xd7 ₱",e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})," = ₱",(e.quantity*e.unit_price).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]},e.id)),r.jsx("div",{className:"mt-3 pt-3 border-t border-gray-200",children:(0,r.jsxs)("div",{className:"space-y-1",children:[(0,r.jsxs)("div",{className:"flex justify-between items-center text-sm",children:[r.jsx("span",{className:"text-gray-600",children:"Subtotal:"}),(0,r.jsxs)("span",{className:"text-gray-600",children:["₱",getTotalAmount(e).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"delivery"===e.delivery_type&&(0,r.jsxs)("div",{className:"flex justify-between items-center text-sm",children:[r.jsx("span",{className:"text-gray-600",children:"Delivery Fee:"}),getTotalAmount(e)>=1e4?r.jsx("span",{className:"text-green-600",children:"FREE (Order over ₱10k)"}):r.jsx("span",{className:"text-gray-600",children:"+₱500.00"})]}),"pickup"===e.delivery_type&&getTotalAmount(e)>=1e4&&(0,r.jsxs)("div",{className:"flex justify-between items-center text-sm",children:[r.jsx("span",{className:"text-gray-600",children:"Pickup Discount (5%):"}),(0,r.jsxs)("span",{className:"text-green-600",children:["-₱",(.05*getTotalAmount(e)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"pickup"===e.delivery_type&&1e4>getTotalAmount(e)&&(0,r.jsxs)("div",{className:"flex justify-between items-center text-sm",children:[r.jsx("span",{className:"text-gray-500",children:"Pickup Discount:"}),r.jsx("span",{className:"text-gray-500",children:"Not available (Order under ₱10k)"})]})]})})]}),r.jsx("div",{className:"mt-4 pt-3 border-t border-gray-200",children:(0,r.jsxs)("div",{className:"flex flex-wrap gap-2",children:[(0,r.jsxs)("button",{onClick:()=>printReceipt(e),className:`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${"green"===W?"bg-green-100 text-green-700 hover:bg-green-200":"red"===W?"bg-red-100 text-red-700 hover:bg-red-200":"yellow"===W?"bg-yellow-100 text-yellow-700 hover:bg-yellow-200":"bg-blue-100 text-blue-700 hover:bg-blue-200"}`,children:[r.jsx(b.Z,{className:"h-4 w-4"}),r.jsx("span",{children:"Print Receipt"})]}),"paid"===e.status&&e.deposit_slip_url&&r.jsx("a",{href:e.deposit_slip_url,target:"_blank",rel:"noopener noreferrer",className:"flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors",children:r.jsx("span",{children:"View Deposit Slip"})})]})})]},e.id))})})]})}),r.jsx("div",{className:"bg-white border-t py-4 mt-8",children:r.jsx("div",{className:"max-w-7xl mx-auto px-2 sm:px-4",children:r.jsx("p",{className:"text-center text-xs text-gray-500",children:"\xa9 Gilnaks Food Corporation"})})})]}):r.jsx("div",{className:"min-h-screen bg-gray-50 flex items-center justify-center p-4",children:(0,r.jsxs)("div",{className:"max-w-md w-full bg-white rounded-lg shadow-md p-8",children:[(0,r.jsxs)("div",{className:"text-center mb-8",children:[r.jsx("div",{className:`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${"green"===W?"bg-green-100":"red"===W?"bg-red-100":"yellow"===W?"bg-yellow-100":"bg-blue-100"}`,children:r.jsx(l.Z,{className:`h-6 w-6 ${"green"===W?"text-green-600":"red"===W?"text-red-600":"yellow"===W?"text-yellow-600":"text-blue-600"}`})}),r.jsx("h2",{className:"text-2xl font-bold text-gray-900",children:"GFC Order Portal"}),r.jsx("p",{className:"text-gray-600 mt-2",children:"Enter your location passcode to continue"})]}),(0,r.jsxs)("form",{onSubmit:handleLocationAuth,className:"space-y-6",children:[(0,r.jsxs)("div",{children:[r.jsx("label",{htmlFor:"passcode",className:"block text-sm font-medium text-gray-700 mb-2",children:"Location Passcode"}),r.jsx("input",{type:"text",id:"passcode",value:s,onChange:e=>f(e.target.value.replace(/\D/g,"").slice(0,6)),className:`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 text-center text-lg tracking-wider ${"green"===W?"focus:ring-green-500 focus:border-green-500":"red"===W?"focus:ring-red-500 focus:border-red-500":"yellow"===W?"focus:ring-yellow-500 focus:border-yellow-500":"focus:ring-blue-500 focus:border-blue-500"}`,placeholder:"Enter 6-digit code",maxLength:6,required:!0})]}),A&&r.jsx("div",{className:"bg-red-50 border border-red-200 rounded-lg p-3",children:r.jsx("p",{className:"text-red-800 text-sm whitespace-pre-line",children:A})}),(0,r.jsxs)("button",{type:"submit",disabled:O,className:`w-full flex items-center justify-center space-x-2 px-4 py-3 text-white rounded-lg transition-colors font-medium disabled:opacity-50 ${"green"===W?"bg-green-600 hover:bg-green-700":"red"===W?"bg-red-600 hover:bg-red-700":"yellow"===W?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[O?r.jsx("div",{className:"animate-spin rounded-full h-5 w-5 border-b-2 border-white"}):r.jsx(l.Z,{className:"h-5 w-5"}),r.jsx("span",{children:O?"Signing in...":"Continue to Order"})]})]})]})})}},4130:(e,t,s)=>{"use strict";s.r(t),s.d(t,{$$typeof:()=>l,__esModule:()=>i,default:()=>d});var r=s(5153);let a=(0,r.createProxy)(String.raw`C:\Users\John\Desktop\gfc\inventory-system\app\order\page.tsx`),{__esModule:i,$$typeof:l}=a,n=a.default,d=n}};var t=require("../../webpack-runtime.js");t.C(e);var __webpack_exec__=e=>t(t.s=e),s=t.X(0,[862,866,637,697,956,982],()=>__webpack_exec__(2595));module.exports=s})();