(()=>{var e={};e.id=778,e.ids=[778],e.modules={5403:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external")},4749:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external")},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},5528:e=>{"use strict";e.exports=require("next/dist\\client\\components\\action-async-storage.external.js")},1877:e=>{"use strict";e.exports=require("next/dist\\client\\components\\request-async-storage.external.js")},5319:e=>{"use strict";e.exports=require("next/dist\\client\\components\\static-generation-async-storage.external.js")},4300:e=>{"use strict";e.exports=require("buffer")},6113:e=>{"use strict";e.exports=require("crypto")},2361:e=>{"use strict";e.exports=require("events")},3685:e=>{"use strict";e.exports=require("http")},5687:e=>{"use strict";e.exports=require("https")},5477:e=>{"use strict";e.exports=require("punycode")},2781:e=>{"use strict";e.exports=require("stream")},7310:e=>{"use strict";e.exports=require("url")},3837:e=>{"use strict";e.exports=require("util")},9796:e=>{"use strict";e.exports=require("zlib")},2595:(e,t,s)=>{"use strict";s.r(t),s.d(t,{GlobalError:()=>l.a,__next_app__:()=>x,originalPathname:()=>m,pages:()=>c,routeModule:()=>u,tree:()=>o});var r=s(7096),a=s(6132),i=s(7284),l=s.n(i),d=s(2564),n={};for(let e in d)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(n[e]=()=>d[e]);s.d(t,n);let o=["",{children:["order",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(s.bind(s,4130)),"C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\order\\page.tsx"]}]},{}]},{layout:[()=>Promise.resolve().then(s.bind(s,5345)),"C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\layout.tsx"],"not-found":[()=>Promise.resolve().then(s.t.bind(s,9291,23)),"next/dist/client/components/not-found-error"]}],c=["C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\order\\page.tsx"],m="/order/page",x={require:s,loadChunk:()=>Promise.resolve()},u=new r.AppPageRouteModule({definition:{kind:a.x.APP_PAGE,page:"/order/page",pathname:"/order",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:o}})},7983:(e,t,s)=>{Promise.resolve().then(s.bind(s,8448))},8448:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>OrderPage});var r=s(784),a=s(9885),i=s(9708),l=s(7094),d=s(1264),n=s(9697),o=s(1210),c=s(9546),m=s(92),x=s(5808),u=s(5894),p=s(2385),g=s(8375),h=s(6206),b=s(4155),f=s(7820);function OrderPage(){let[e,t]=(0,a.useState)(!1),[s,y]=(0,a.useState)(""),[v,w]=(0,a.useState)(null),[j,N]=(0,a.useState)([]),[_,k]=(0,a.useState)([]),[q,C]=(0,a.useState)(null),[$,O]=(0,a.useState)([]),[S,P]=(0,a.useState)("home"),[F,T]=(0,a.useState)(!1),[I,A]=(0,a.useState)(!0),[Z,z]=(0,a.useState)(""),[D,E]=(0,a.useState)(""),[M,U]=(0,a.useState)(!1),[L,G]=(0,a.useState)(!1);(0,a.useEffect)(()=>{let initializeApp=async()=>{A(!0);let e=localStorage.getItem("order_authenticated"),s=localStorage.getItem("order_location");if("true"===e&&s)try{let e=JSON.parse(s);w(e),t(!0),await Promise.all([checkPendingOrders(e.id),fetchPastOrders(e.id),fetchProducts(e.brand_id)])}catch(e){console.error("Error parsing saved data:",e),clearSession()}setTimeout(()=>{A(!1)},800)};initializeApp()},[]),(0,a.useEffect)(()=>{q&&"products"===S&&P("home")},[q,S]),(0,a.useEffect)(()=>{if(!v?.brand_id)return;let e=i.O.channel("order-products-changes").on("postgres_changes",{event:"*",schema:"public",table:"products",filter:`brand_id=eq.${v.brand_id}`},()=>{F||fetchProducts(v.brand_id)}).subscribe();return()=>{i.O.removeChannel(e)}},[v?.brand_id,F]);let Q=(e=>{if(!e?.brand)return"blue";switch(e.brand.slug){case"mychoice":return"green";case"gelatofilipino":return"red";case"mang-sorbetes":return"yellow";default:return"blue"}})(v),clearSession=()=>{t(!1),w(null),N([]),k([]),C(null),P("home"),z(""),E(""),A(!1),localStorage.removeItem("order_authenticated"),localStorage.removeItem("order_location"),localStorage.removeItem("order_cart_draft")},handleLocationAuth=async e=>{e.preventDefault(),T(!0),z("");try{let{data:e,error:r}=await i.O.from("locations").select("*, brand:brands(*)").eq("passkey",s).single();if(r)throw r;w(e),t(!0),localStorage.setItem("order_authenticated","true"),localStorage.setItem("order_location",JSON.stringify(e)),await Promise.all([checkPendingOrders(e.id),fetchPastOrders(e.id),fetchProducts(e.brand_id)])}catch(e){z("Invalid location passcode. Please try again."),y("")}finally{T(!1)}},fetchProducts=async e=>{try{let{data:t,error:s}=await i.O.from("inventory_summary").select("*").eq("brand_id",e).order("category, product_name");if(s)throw s;N(t||[])}catch(e){console.error("Error fetching products:",e)}},checkPendingOrders=async e=>{try{let{data:t,error:s}=await i.O.from("customer_orders").select(`
          id, status, created_at, total_amount,
          order_details (
            id, product_id, quantity, unit_price,
            products (id, name, price, unit)
          )
        `).eq("location_id",e).in("status",["pending","approved"]).order("created_at",{ascending:!1}).limit(1);if(s)throw s;t&&t.length>0?C(t[0]):C(null)}catch(e){console.error("Error checking pending orders:",e)}},fetchPastOrders=async e=>{try{let{data:t,error:s}=await i.O.from("customer_orders").select(`
          id, status, created_at, total_amount,
          order_details (
            id, product_id, quantity, unit_price,
            products (id, name, price, unit)
          )
        `).eq("location_id",e).in("status",["released","cancelled"]).order("created_at",{ascending:!1});if(s)throw s;O(t||[])}catch(e){console.error("Error fetching past orders:",e)}},getAvailableStock=e=>e.available_stock||0,getCartItemAvailableStock=e=>{let t=j.find(t=>(t.product_id||t.id)===e.product_id);if(t){if("modify"===S&&q){let s=q.order_details?.find(t=>t.product_id===e.product_id);if(s)return(t.available_stock||0)+s.quantity}return t.available_stock||0}return getAvailableStock(e.product)},addToCart=e=>{let t=e.product_id||e.id,s=_.find(e=>e.product_id===t);s?k(e=>e.map(e=>e.product_id===t?{...e,quantity:e.quantity+1}:e)):k(s=>[...s,{product_id:t,quantity:1,product:e}])},updateCartQuantity=(e,t)=>{t<=0?k(t=>t.filter(t=>t.product_id!==e)):k(s=>s.map(s=>s.product_id===e?{...s,quantity:t}:s))},removeFromCart=e=>{k(t=>t.filter(t=>t.product_id!==e))},calculateTotal=()=>_.reduce((e,t)=>e+(t.product.price||0)*t.quantity,0),calculateItemCount=()=>_.reduce((e,t)=>e+t.quantity,0),getProductsByCategory=()=>{let e=j.reduce((e,t)=>{let s=t.category||"Other";return e[s]||(e[s]=[]),e[s].push(t),e},{});return e},validateStockAvailability=async()=>{let e=[];if(v?.brand_id)try{let{data:t,error:s}=await i.O.from("inventory_summary").select("*").eq("brand_id",v.brand_id);if(s)throw s;N(t||[]);let r=_.map(e=>{let s=t?.find(t=>(t.product_id||t.id)===e.product_id);return s?{...e,product:s}:e});for(let s of(k(r),r)){let r=t?.find(e=>(e.product_id||e.id)===s.product_id);if(r){let t=r.available_stock||0;if("modify"===S&&q){let e=q.order_details?.find(e=>e.product_id===s.product_id);e&&(t+=e.quantity)}s.quantity>t&&e.push(`${r.product_name||r.name}: Requested ${s.quantity}, Available ${t}`)}}}catch(t){for(let s of(console.error("Error fetching fresh product data:",t),_)){let t=getCartItemAvailableStock(s);s.quantity>t&&e.push(`${s.product.product_name||s.product.name}: Requested ${s.quantity}, Available ${t}`)}}return e},handleSubmitOrder=async()=>{if(!v||0===_.length){z("Please add items to your order.");return}let e=await validateStockAvailability();if(e.length>0){z(`Insufficient stock for the following items:
${e.join("\n")}`);return}T(!0),z("");try{for(let e of _){let{error:t}=await i.O.from("products").update({reserved:(e.product.reserved||0)+e.quantity,updated_at:new Date().toISOString()}).eq("id",e.product_id);if(t)throw t}let e=calculateTotal(),{data:t,error:s}=await i.O.from("customer_orders").insert([{location_id:v.id,brand_id:v.brand_id,customer_name:`${v.name} Order`,status:"pending",total_amount:e}]).select();if(s)throw s;let r=_.map(e=>({order_id:t[0].id,product_id:e.product_id,quantity:e.quantity,unit_price:e.product.price||0})),{error:a}=await i.O.from("order_details").insert(r);if(a)throw a;E("Order submitted successfully!"),k([]),await checkPendingOrders(v.id),P("home"),G(!1)}catch(e){console.error("Error submitting order:",e),z("Failed to submit order. Please try again.")}finally{T(!1)}},handleUpdateOrder=async()=>{if(!q||0===_.length)return;let e=await validateStockAvailability();if(e.length>0){z(`Insufficient stock for the following items:
${e.join("\n")}`);return}T(!0),z("");try{if(q.order_details)for(let e of q.order_details){let{error:t}=await i.O.from("products").update({reserved:(e.products.reserved||0)-e.quantity,updated_at:new Date().toISOString()}).eq("id",e.product_id);if(t)throw t}for(let e of(await i.O.from("order_details").delete().eq("order_id",q.id),_)){let{error:t}=await i.O.from("products").update({reserved:(e.product.reserved||0)+e.quantity,updated_at:new Date().toISOString()}).eq("id",e.product_id);if(t)throw t}let e=_.map(e=>({order_id:q.id,product_id:e.product_id,quantity:e.quantity,unit_price:e.product.price||0}));await i.O.from("order_details").insert(e);let t=calculateTotal();await i.O.from("customer_orders").update({total_amount:t}).eq("id",q.id),E("Order updated successfully!"),k([]),await checkPendingOrders(v.id),P("home"),G(!1)}catch(e){console.error("Error updating order:",e),z("Failed to update order. Please try again.")}finally{T(!1)}},getTotalItems=e=>e.order_details.reduce((e,t)=>e+t.quantity,0),getTotalAmount=e=>e.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0),printReceipt=e=>{let t=window.open("","_blank");t&&(t.document.write(`
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
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              border-radius: 8px;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              min-height: 100vh;
            }
            
            .header { 
              text-align: center; 
              padding: 16px 20px;
              background: white;
              color: black;
              border-bottom: 2px solid black;
            }
            
            .company-name { 
              font-size: 23px; 
              font-weight: bold; 
              margin-bottom: 4px;
              color: black;
            }
            
            .receipt-title { 
              font-size: 15px; 
              font-weight: normal; 
              color: black;
            }
            
            .order-info { 
              padding: 8px 12px; 
              background: white;
              border-bottom: 1px solid black;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
              gap: 4px 12px;
            }
            
            .info-item {
              display: flex;
              flex-direction: column;
            }
            
            .info-label { 
              font-weight: normal; 
              color: #666;
              font-size: 12px;
              text-transform: uppercase;
              margin-bottom: 1px;
            }
            
            .info-value { 
              font-weight: normal; 
              color: black;
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
              padding: 8px 12px;
              flex: 1;
            }
            
            .items-title {
              font-size: 13px;
              font-weight: bold;
              margin-bottom: 6px;
              color: black;
              text-transform: uppercase;
            }
            
            .items-header {
              display: grid;
              grid-template-columns: 30px 2fr 1fr 1fr 1fr;
              gap: 8px;
              padding: 4px 0;
              border-bottom: 1px solid black;
              margin-bottom: 4px;
            }
            
            .header-cell {
              font-size: 11px;
              font-weight: bold;
              color: black;
              text-transform: uppercase;
            }
            
            .header-checkbox { text-align: center; }
            .header-item { text-align: left; }
            .header-qty { text-align: center; }
            .header-price { text-align: center; }
            .header-total { text-align: right; }
            
            .item-checkbox {
              text-align: center;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            
            .checkbox {
              width: 14px;
              height: 14px;
              border: 1px solid black;
              background: white;
              cursor: pointer;
            }
            
            .item-row {
              display: grid;
              grid-template-columns: 30px 2fr 1fr 1fr 1fr;
              gap: 8px;
              align-items: center;
              padding: 4px 0;
              border-bottom: 1px solid #ccc;
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
            
            .total-section { 
              padding: 8px 12px;
              background: white;
              border-top: 1px solid black;
            }
            
            .total-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 4px;
            }
            
            .total-label {
              font-weight: normal;
              color: black;
              font-size: 12px;
            }
            
            .total-value {
              font-weight: normal;
              color: black;
              font-size: 12px;
            }
            
            .grand-total {
              border-top: 1px solid black;
              padding-top: 4px;
              margin-top: 4px;
            }
            
            .grand-total .total-label {
              font-size: 13px;
              font-weight: bold;
            }
            
            .grand-total .total-value {
              font-size: 14px;
              font-weight: bold;
              color: black;
            }
            
            .footer { 
              text-align: center; 
              padding: 6px 12px;
              background: black;
              color: white;
              margin-top: auto;
            }
            
            .footer-text {
              font-size: 11px;
              margin-bottom: 2px;
            }
            
            .footer-date {
              font-size: 10px;
            }
            
            .notes {
              padding: 6px 12px;
              background: white;
              border: 1px solid black;
              margin: 0 12px 8px;
            }
            
            .notes-title {
              font-weight: bold;
              color: black;
              margin-bottom: 2px;
              font-size: 11px;
            }
            
            .notes-text {
              color: black;
              font-size: 11px;
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
                  <span class="info-label">Date (PST)</span>
                  <span class="info-value">${(0,f.iI)(e.created_at,{dateStyle:"short"})}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Location</span>
                  <span class="info-value">${e.location?.name||v?.name||"N/A"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Customer</span>
                  <span class="info-value">${e.customer_name||"Walk-in"}</span>
                </div>
              </div>
            </div>
            
            <div class="items">
              <div class="items-header">
                <div class="header-cell header-checkbox">✓</div>
                <div class="header-cell header-item">Item</div>
                <div class="header-cell header-qty">Quantity</div>
                <div class="header-cell header-price">Unit Price</div>
                <div class="header-cell header-total">Total</div>
              </div>
              ${e.order_details.map(e=>`
                <div class="item-row">
                  <div class="item-checkbox">
                    <div class="checkbox"></div>
                  </div>
                  <div>
                    <div class="item-name">${e.product?.name||e.products?.name}</div>
                    <div class="item-details">
                      ${e.product?.sku||e.products?.sku?`SKU: ${e.product?.sku||e.products?.sku}`:""}
                    </div>
                  </div>
                  <div class="item-quantity">${e.quantity} ${e.product?.unit||e.products?.unit}</div>
                  <div class="item-unit-price">₱${e.unit_price.toFixed(2)}</div>
                  <div class="item-price">₱${(e.unit_price*e.quantity).toFixed(2)}</div>
                </div>
              `).join("")}
            </div>
            
            ${e.notes?`
              <div class="notes">
                <div class="notes-title">Notes</div>
                <div class="notes-text">${e.notes}</div>
              </div>
            `:""}
            
            <div class="total-section">
              <div class="total-row">
                <span class="total-label">Total Items</span>
                <span class="total-value">${getTotalItems(e)}</span>
              </div>
              <div class="total-row grand-total">
                <span class="total-label">Total Amount</span>
                <span class="total-value">₱${getTotalAmount(e).toFixed(2)}</span>
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-text">Thank you for your order!</div>
              <div class="footer-date">Generated on ${new Date().toLocaleString()}</div>
            </div>
          </div>
        </body>
        </html>
      `),t.document.close(),t.focus(),t.print(),t.close())};return I?r.jsx("div",{className:"min-h-screen bg-gray-50 flex items-center justify-center",children:(0,r.jsxs)("div",{className:"text-center",children:[r.jsx("div",{className:`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 ${"green"===Q?"bg-green-100":"red"===Q?"bg-red-100":"yellow"===Q?"bg-yellow-100":"bg-blue-100"}`,children:r.jsx("div",{className:`animate-spin rounded-full h-8 w-8 border-b-2 ${"green"===Q?"border-green-600":"red"===Q?"border-red-600":"yellow"===Q?"border-yellow-600":"border-blue-600"}`})}),r.jsx("h2",{className:"text-xl font-semibold text-gray-900 mb-2",children:"Loading Order System"}),r.jsx("p",{className:"text-gray-600",children:"Please wait while we check your session..."})]})}):e?D?r.jsx("div",{className:"min-h-screen bg-gray-50 flex items-center justify-center p-4",children:(0,r.jsxs)("div",{className:"max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center",children:[r.jsx("div",{className:`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${"green"===Q?"bg-green-100":"red"===Q?"bg-red-100":"yellow"===Q?"bg-yellow-100":"bg-blue-100"}`,children:r.jsx(d.Z,{className:`h-6 w-6 ${"green"===Q?"text-green-600":"red"===Q?"text-red-600":"yellow"===Q?"text-yellow-600":"text-blue-600"}`})}),r.jsx("h2",{className:"text-2xl font-bold text-gray-900 mb-2",children:"Success!"}),r.jsx("p",{className:"text-gray-600 mb-6",children:D}),r.jsx("button",{onClick:()=>{E(""),P("home")},className:`w-full px-4 py-3 text-white rounded-lg transition-colors ${"green"===Q?"bg-green-600 hover:bg-green-700":"red"===Q?"bg-red-600 hover:bg-red-700":"yellow"===Q?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:"Continue"})]})}):(0,r.jsxs)("div",{className:"min-h-screen bg-gray-50 overflow-x-hidden",children:[r.jsx("div",{className:"bg-white shadow-sm border-b",children:r.jsx("div",{className:"max-w-7xl mx-auto px-2 sm:px-4 py-4",children:(0,r.jsxs)("div",{className:"flex justify-between items-center",children:[(0,r.jsxs)("div",{className:"flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1",children:[r.jsx(n.Z,{className:`h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0 ${"green"===Q?"text-green-600":"red"===Q?"text-red-600":"yellow"===Q?"text-yellow-600":"text-blue-600"}`}),(0,r.jsxs)("div",{className:"min-w-0 flex-1",children:[r.jsx("h1",{className:"text-lg sm:text-2xl font-bold text-gray-900 truncate",children:v?.brand?.name||"Order System"}),(0,r.jsxs)("p",{className:"text-xs sm:text-sm text-gray-500 flex items-center",children:[r.jsx(l.Z,{className:"h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0"}),r.jsx("span",{className:"truncate",children:v?.name})]})]})]}),(0,r.jsxs)("div",{className:"flex items-center space-x-1 sm:space-x-2 flex-shrink-0",children:["home"!==S&&(0,r.jsxs)("button",{onClick:()=>P("home"),className:"flex items-center space-x-1 px-2 sm:px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-xs sm:text-sm",children:[r.jsx(o.Z,{className:"h-3 w-3 sm:h-4 sm:w-4"}),r.jsx("span",{className:"hidden sm:inline",children:"Home"})]}),(0,r.jsxs)("button",{onClick:()=>U(!0),className:"flex items-center space-x-1 px-2 sm:px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-xs sm:text-sm",children:[r.jsx(c.Z,{className:"h-3 w-3 sm:h-4 sm:w-4"}),r.jsx("span",{className:"hidden sm:inline",children:"Past Orders"})]}),(0,r.jsxs)("button",{onClick:clearSession,className:"flex items-center space-x-1 px-2 sm:px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-xs sm:text-sm",children:[r.jsx(m.Z,{className:"h-3 w-3 sm:h-4 sm:w-4"}),r.jsx("span",{className:"hidden sm:inline",children:"Logout"})]})]})]})})}),(0,r.jsxs)("div",{className:"max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8",children:["home"===S&&(0,r.jsxs)("div",{className:"space-y-6",children:[Z&&r.jsx("div",{className:"bg-red-50 border border-red-200 rounded-lg p-4",children:r.jsx("p",{className:"text-red-800 whitespace-pre-line",children:Z})}),q?(0,r.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:[(0,r.jsxs)("div",{className:`flex items-center justify-between p-4 rounded-lg mb-6 ${"approved"===q.status?"bg-green-50 border border-green-200":"bg-yellow-50 border border-yellow-200"}`,children:[(0,r.jsxs)("div",{className:"flex items-center",children:[r.jsx("div",{className:"flex-shrink-0",children:"approved"===q.status?r.jsx(d.Z,{className:"h-5 w-5 text-green-400"}):r.jsx("div",{className:"animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-400"})}),(0,r.jsxs)("div",{className:"ml-3",children:[r.jsx("h3",{className:`text-lg font-medium ${"approved"===q.status?"text-green-800":"text-yellow-800"}`,children:"approved"===q.status?"Order Approved":"Pending Order"}),r.jsx("p",{className:`text-sm ${"approved"===q.status?"text-green-700":"text-yellow-700"}`,children:"approved"===q.status?"Your order has been approved and is being processed.":"Your order is pending approval. You can modify it if needed."})]})]}),(0,r.jsxs)("div",{className:"text-right",children:[(0,r.jsxs)("p",{className:"text-2xl font-bold text-gray-900",children:["₱",q.total_amount?.toFixed(2)||"0.00"]}),(0,r.jsxs)("p",{className:"text-sm text-gray-500",children:["Order #",q.id.slice(-8)]})]})]}),(0,r.jsxs)("div",{className:"space-y-4",children:[r.jsx("h4",{className:"font-medium text-gray-900",children:"Order Items"}),q.order_details?.map(e=>r.jsxs("div",{className:"flex justify-between items-center p-3 bg-gray-50 rounded-lg",children:[r.jsxs("div",{children:[r.jsx("p",{className:"font-medium text-gray-900",children:e.products.name}),r.jsxs("p",{className:"text-sm text-gray-600",children:["₱",e.unit_price.toFixed(2)," per ",e.products.unit]})]}),r.jsxs("div",{className:"text-right",children:[r.jsxs("p",{className:"font-medium text-gray-900",children:[e.quantity," ",e.products.unit]}),r.jsxs("p",{className:"text-sm text-gray-600",children:["₱",(e.quantity*e.unit_price).toFixed(2)]})]})]},e.id))]}),(0,r.jsxs)("div",{className:"mt-6 flex space-x-4",children:["pending"===q.status&&(0,r.jsxs)("button",{onClick:()=>{if(q?.order_details&&"pending"===q.status){let e=q.order_details.map(e=>({product_id:e.product_id,quantity:e.quantity,product:e.products}));k(e),P("modify")}},className:`flex items-center space-x-2 px-6 py-3 text-white rounded-lg transition-colors ${"green"===Q?"bg-green-600 hover:bg-green-700":"red"===Q?"bg-red-600 hover:bg-red-700":"yellow"===Q?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[r.jsx(x.Z,{className:"h-4 w-4"}),r.jsx("span",{children:"Modify Order"})]}),"approved"===q.status&&r.jsx("div",{className:"text-center",children:r.jsx("p",{className:"text-sm text-gray-600 mb-4",children:"You have an approved order. Please wait for it to be processed before creating a new order."})})]})]}):(0,r.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-8 text-center",children:[r.jsx(u.Z,{className:`mx-auto h-16 w-16 mb-4 ${"green"===Q?"text-green-400":"red"===Q?"text-red-400":"yellow"===Q?"text-yellow-400":"text-blue-400"}`}),r.jsx("h2",{className:"text-2xl font-bold text-gray-900 mb-2",children:"No Pending Orders"}),r.jsx("p",{className:"text-gray-600 mb-6",children:"You can start a new order by clicking the button below."}),(0,r.jsxs)("button",{onClick:()=>{q||P("products")},className:`flex items-center space-x-2 px-6 py-3 text-white rounded-lg transition-colors mx-auto ${"green"===Q?"bg-green-600 hover:bg-green-700":"red"===Q?"bg-red-600 hover:bg-red-700":"yellow"===Q?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[r.jsx(p.Z,{className:"h-4 w-4"}),r.jsx("span",{children:"Start New Order"})]})]})]}),"products"===S&&!q&&(0,r.jsxs)("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8",children:[r.jsx("div",{className:"lg:col-span-2 min-w-0",children:(0,r.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-3 sm:p-6",children:[(0,r.jsxs)("h2",{className:"text-lg sm:text-xl font-semibold mb-4 sm:mb-6 truncate",children:[v?.brand?.name," Products"]}),r.jsx("div",{className:"space-y-6",children:Object.entries(getProductsByCategory()).map(([e,t])=>(0,r.jsxs)("div",{children:[r.jsx("h3",{className:"text-sm font-semibold text-gray-700 mb-3 px-2 border-l-4 border-gray-300",children:e}),r.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4",children:t.map(e=>{let t=e.product_id||e.id,s=_.some(e=>e.product_id===t),a=_.find(e=>e.product_id===t)?.quantity||0,i=getAvailableStock(e);return(0,r.jsxs)("div",{className:`border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors min-w-0 ${s?"border-blue-400 bg-blue-50":"border-gray-200"}`,children:[(0,r.jsxs)("div",{className:"flex justify-between items-start mb-2 min-w-0",children:[r.jsx("h4",{className:"font-medium text-gray-900 text-sm sm:text-base pr-2 truncate min-w-0 flex-1",children:e.product_name||e.name}),(0,r.jsxs)("div",{className:"flex items-center space-x-2 flex-shrink-0",children:[a>0&&r.jsx("span",{className:"bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full",children:a}),r.jsx("span",{className:"text-xs sm:text-sm text-gray-500",children:e.unit})]})]}),(0,r.jsxs)("p",{className:"text-base sm:text-lg font-semibold text-green-600 mb-2 sm:mb-3",children:["₱",(e.price||0).toFixed(2)]}),(0,r.jsxs)("div",{className:"flex justify-between items-center min-w-0",children:[(0,r.jsxs)("span",{className:`text-xs sm:text-sm font-medium ${i>0?"text-green-600":"text-red-600"}`,children:["Stock: ",i]}),r.jsx("button",{onClick:()=>addToCart(e),disabled:0===i||s&&a>=i,className:`px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${i>0&&(!s||a<i)?"green"===Q?"bg-green-600 text-white hover:bg-green-700":"red"===Q?"bg-red-600 text-white hover:bg-red-700":"yellow"===Q?"bg-yellow-600 text-white hover:bg-yellow-700":"bg-blue-600 text-white hover:bg-blue-700":"bg-gray-400 text-gray-200 cursor-not-allowed"}`,children:0===i?"Out":s&&a>=i?"Max":s?"More":"Add"})]})]},t)})})]},e))})]})}),r.jsx("div",{className:"hidden lg:block lg:col-span-1",children:(0,r.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6 sticky top-8",children:[(0,r.jsxs)("h3",{className:"text-lg font-semibold mb-4",children:["Cart (",calculateItemCount()," items)"]}),0===_.length?r.jsx("p",{className:"text-gray-500 text-center py-8",children:"No items in cart"}):(0,r.jsxs)(r.Fragment,{children:[r.jsx("div",{className:"space-y-3 mb-6",children:_.map(e=>{let t=getCartItemAvailableStock(e),s=e.quantity>t;return(0,r.jsxs)("div",{className:`flex justify-between items-center p-3 rounded-lg ${s?"bg-red-50 border border-red-200":"bg-gray-50"}`,children:[(0,r.jsxs)("div",{className:"flex-1",children:[r.jsx("p",{className:"text-sm font-medium",children:e.product.product_name||e.product.name}),(0,r.jsxs)("p",{className:"text-xs text-gray-500",children:["₱",(e.product.price||0).toFixed(2)," per ",e.product.unit]}),(0,r.jsxs)("div",{className:"flex items-center space-x-2 mt-1",children:[r.jsx("button",{onClick:()=>updateCartQuantity(e.product_id,e.quantity-1),className:"p-1 text-gray-400 hover:text-gray-600",children:r.jsx(g.Z,{className:"h-3 w-3"})}),r.jsx("span",{className:`text-sm w-8 text-center ${s?"text-red-600 font-semibold":"text-gray-600"}`,children:e.quantity}),r.jsx("button",{onClick:()=>updateCartQuantity(e.product_id,e.quantity+1),disabled:e.quantity>=t,className:"p-1 text-gray-400 hover:text-gray-600 disabled:text-gray-300",children:r.jsx(p.Z,{className:"h-3 w-3"})})]}),(0,r.jsxs)("p",{className:`text-xs mt-1 ${s?"text-red-600 font-medium":"text-gray-500"}`,children:["Max: ",t," | Total: ₱",((e.product.price||0)*e.quantity).toFixed(2)]})]}),r.jsx("button",{onClick:()=>removeFromCart(e.product_id),className:"text-red-500 hover:text-red-700 ml-2",children:r.jsx(h.Z,{className:"h-4 w-4"})})]},e.product_id)})}),(0,r.jsxs)("div",{className:"border-t pt-4",children:[(0,r.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[r.jsx("span",{className:"font-medium",children:"Total:"}),(0,r.jsxs)("span",{className:"font-semibold text-green-600 text-lg",children:["₱",calculateTotal().toFixed(2)]})]}),(0,r.jsxs)("button",{onClick:()=>G(!0),className:"w-full flex items-center justify-center space-x-2 px-4 py-3 text-white rounded-lg transition-colors ${ currentTheme === 'green' ? 'bg-green-600 hover:bg-green-700' : currentTheme === 'red' ? 'bg-red-600 hover:bg-red-700' : currentTheme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700' }",children:[r.jsx(u.Z,{className:"h-5 w-5"}),r.jsx("span",{children:"View Cart"})]})]})]})]})})]}),"products"===S&&!q&&r.jsx("div",{className:"lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40",children:(0,r.jsxs)("div",{className:"px-2 py-2",children:[(0,r.jsxs)("div",{className:"flex justify-between items-center mb-2 min-w-0",children:[(0,r.jsxs)("span",{className:"font-medium text-sm truncate",children:["Items: ",calculateItemCount()]}),(0,r.jsxs)("span",{className:"font-bold text-base text-green-600 flex-shrink-0 ml-2",children:["₱",calculateTotal().toFixed(2)]})]}),(0,r.jsxs)("button",{onClick:()=>G(!0),disabled:q,className:`w-full flex items-center justify-center space-x-1 px-2 py-2 rounded-lg transition-colors text-xs sm:text-sm min-w-0 disabled:opacity-50 disabled:cursor-not-allowed ${"green"===Q?"bg-green-600 hover:bg-green-700 text-white":"red"===Q?"bg-red-600 hover:bg-red-700 text-white":"yellow"===Q?"bg-yellow-600 hover:bg-yellow-700 text-white":"bg-blue-600 hover:bg-blue-700 text-white"}`,children:[r.jsx(u.Z,{className:"h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0"}),r.jsx("span",{className:"truncate",children:"View Cart"})]})]})}),"products"===S&&!q&&r.jsx("div",{className:"lg:hidden pb-20"}),"modify"===S&&(0,r.jsxs)("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8",children:[r.jsx("div",{className:"lg:col-span-2 min-w-0",children:(0,r.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-3 sm:p-6",children:[r.jsx("h2",{className:"text-lg sm:text-xl font-semibold mb-4 sm:mb-6 truncate",children:"Modify Order - Draft Mode"}),r.jsx("div",{className:"bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6",children:(0,r.jsxs)("p",{className:"text-yellow-800 text-xs sm:text-sm",children:[r.jsx("strong",{children:"Note:"}),' Changes are saved as draft. Click "Update Order" to save changes permanently.']})}),r.jsx("div",{className:"space-y-6",children:Object.entries(getProductsByCategory()).map(([e,t])=>(0,r.jsxs)("div",{children:[r.jsx("h3",{className:"text-sm font-semibold text-gray-700 mb-3 px-2 border-l-4 border-gray-300",children:e}),r.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4",children:t.map(e=>{let t=e.product_id||e.id,s=_.some(e=>e.product_id===t),a=_.find(e=>e.product_id===t)?.quantity||0,i=getAvailableStock(e);return(0,r.jsxs)("div",{className:`border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors min-w-0 ${s?"border-blue-400 bg-blue-50":"border-gray-200"}`,children:[(0,r.jsxs)("div",{className:"flex justify-between items-start mb-2 min-w-0",children:[r.jsx("h4",{className:"font-medium text-gray-900 text-sm sm:text-base pr-2 truncate min-w-0 flex-1",children:e.product_name||e.name}),(0,r.jsxs)("div",{className:"flex items-center space-x-2 flex-shrink-0",children:[a>0&&r.jsx("span",{className:"bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full",children:a}),r.jsx("span",{className:"text-xs sm:text-sm text-gray-500",children:e.unit})]})]}),(0,r.jsxs)("p",{className:"text-base sm:text-lg font-semibold text-green-600 mb-2 sm:mb-3",children:["₱",(e.price||0).toFixed(2)]}),(0,r.jsxs)("div",{className:"flex justify-between items-center min-w-0",children:[(0,r.jsxs)("span",{className:`text-xs sm:text-sm font-medium ${i>0?"text-green-600":"text-red-600"}`,children:["Stock: ",i]}),r.jsx("button",{onClick:()=>addToCart(e),disabled:0===i||s&&a>=i,className:`px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${i>0&&(!s||a<i)?"green"===Q?"bg-green-600 text-white hover:bg-green-700":"red"===Q?"bg-red-600 text-white hover:bg-red-700":"yellow"===Q?"bg-yellow-600 text-white hover:bg-yellow-700":"bg-blue-600 text-white hover:bg-blue-700":"bg-gray-400 text-gray-200 cursor-not-allowed"}`,children:0===i?"Out":s&&a>=i?"Max":s?"More":"Add"})]})]},t)})})]},e))})]})}),r.jsx("div",{className:"hidden lg:block lg:col-span-1",children:(0,r.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6 sticky top-8",children:[(0,r.jsxs)("h3",{className:"text-lg font-semibold mb-4",children:["Order Draft (",calculateItemCount()," items)"]}),0===_.length?r.jsx("p",{className:"text-gray-500 text-center py-8",children:"No items in draft"}):(0,r.jsxs)(r.Fragment,{children:[r.jsx("div",{className:"space-y-3 mb-6",children:_.map(e=>{let t=getCartItemAvailableStock(e),s=e.quantity>t;return(0,r.jsxs)("div",{className:`flex justify-between items-center p-3 rounded-lg ${s?"bg-red-50 border border-red-200":"bg-gray-50"}`,children:[(0,r.jsxs)("div",{className:"flex-1",children:[r.jsx("p",{className:"text-sm font-medium",children:e.product.product_name||e.product.name}),(0,r.jsxs)("p",{className:"text-xs text-gray-500",children:["₱",(e.product.price||0).toFixed(2)," per ",e.product.unit]}),(0,r.jsxs)("div",{className:"flex items-center space-x-2 mt-1",children:[r.jsx("button",{onClick:()=>updateCartQuantity(e.product_id,e.quantity-1),className:"p-1 text-gray-400 hover:text-gray-600",children:r.jsx(g.Z,{className:"h-3 w-3"})}),r.jsx("span",{className:`text-sm w-8 text-center ${s?"text-red-600 font-semibold":"text-gray-600"}`,children:e.quantity}),r.jsx("button",{onClick:()=>updateCartQuantity(e.product_id,e.quantity+1),disabled:e.quantity>=t,className:"p-1 text-gray-400 hover:text-gray-600 disabled:text-gray-300",children:r.jsx(p.Z,{className:"h-3 w-3"})})]}),(0,r.jsxs)("p",{className:`text-xs mt-1 ${s?"text-red-600 font-medium":"text-gray-500"}`,children:["Max: ",t," | Total: ₱",((e.product.price||0)*e.quantity).toFixed(2)]})]}),r.jsx("button",{onClick:()=>removeFromCart(e.product_id),className:"text-red-500 hover:text-red-700 ml-2",children:r.jsx(h.Z,{className:"h-4 w-4"})})]},e.product_id)})}),(0,r.jsxs)("div",{className:"border-t pt-4",children:[(0,r.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[r.jsx("span",{className:"font-medium",children:"Total:"}),(0,r.jsxs)("span",{className:"font-semibold text-green-600 text-lg",children:["₱",calculateTotal().toFixed(2)]})]}),(0,r.jsxs)("button",{onClick:()=>G(!0),className:`w-full flex items-center justify-center space-x-2 px-4 py-3 text-white rounded-lg transition-colors ${"green"===Q?"bg-green-600 hover:bg-green-700":"red"===Q?"bg-red-600 hover:bg-red-700":"yellow"===Q?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[r.jsx(x.Z,{className:"h-5 w-5"}),r.jsx("span",{children:"View Draft & Update"})]})]})]})]})})]}),"modify"===S&&r.jsx("div",{className:"lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40",children:(0,r.jsxs)("div",{className:"px-2 py-2",children:[(0,r.jsxs)("div",{className:"flex justify-between items-center mb-2 min-w-0",children:[(0,r.jsxs)("span",{className:"font-medium text-sm truncate",children:["Draft: ",calculateItemCount()," items"]}),(0,r.jsxs)("span",{className:"font-bold text-base text-green-600 flex-shrink-0 ml-2",children:["₱",calculateTotal().toFixed(2)]})]}),(0,r.jsxs)("button",{onClick:()=>G(!0),className:`w-full flex items-center justify-center space-x-1 px-2 py-2 rounded-lg transition-colors text-xs sm:text-sm min-w-0 ${"green"===Q?"bg-green-600 hover:bg-green-700 text-white":"red"===Q?"bg-red-600 hover:bg-red-700 text-white":"yellow"===Q?"bg-yellow-600 hover:bg-yellow-700 text-white":"bg-blue-600 hover:bg-blue-700 text-white"}`,children:[r.jsx(x.Z,{className:"h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0"}),r.jsx("span",{className:"truncate",children:"View Draft & Update"})]})]})}),"modify"===S&&r.jsx("div",{className:"lg:hidden pb-20"})]}),L&&(!q||"modify"===S)&&r.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4",children:(0,r.jsxs)("div",{className:"bg-white rounded-t-lg sm:rounded-lg w-full max-w-md max-h-[80vh] overflow-hidden",children:[(0,r.jsxs)("div",{className:"flex items-center justify-between p-3 sm:p-4 border-b min-w-0",children:[(0,r.jsxs)("h2",{className:"text-base sm:text-lg font-semibold truncate min-w-0 flex-1",children:["modify"===S?"Order Draft":"Your Cart"," (",calculateItemCount()," items)"]}),r.jsx("button",{onClick:()=>G(!1),className:"p-2 text-gray-400 hover:text-gray-600 flex-shrink-0",children:r.jsx(h.Z,{className:"h-4 w-4 sm:h-5 sm:w-5"})})]}),r.jsx("div",{className:"p-3 sm:p-4 max-h-96 overflow-y-auto",children:0===_.length?(0,r.jsxs)("p",{className:"text-gray-500 text-center py-8",children:["No items in ","modify"===S?"draft":"cart"]}):r.jsx("div",{className:"space-y-3",children:_.map(e=>{let t=getCartItemAvailableStock(e),s=e.quantity>t;return(0,r.jsxs)("div",{className:`flex justify-between items-center p-2 sm:p-3 rounded-lg min-w-0 ${s?"bg-red-50 border border-red-200":"bg-gray-50"}`,children:[(0,r.jsxs)("div",{className:"flex-1 min-w-0",children:[r.jsx("p",{className:"text-sm font-medium text-gray-900 truncate",children:e.product.product_name||e.product.name}),(0,r.jsxs)("p",{className:"text-xs text-gray-500",children:["₱",(e.product.price||0).toFixed(2)," per ",e.product.unit]}),(0,r.jsxs)("div",{className:"flex items-center space-x-2 mt-1",children:[r.jsx("button",{onClick:()=>updateCartQuantity(e.product_id,e.quantity-1),className:"p-1 text-gray-400 hover:text-gray-600 flex-shrink-0",children:r.jsx(g.Z,{className:"h-3 w-3"})}),r.jsx("span",{className:`text-sm w-6 sm:w-8 text-center ${s?"text-red-600 font-semibold":"text-gray-600"}`,children:e.quantity}),r.jsx("button",{onClick:()=>updateCartQuantity(e.product_id,e.quantity+1),disabled:e.quantity>=t,className:"p-1 text-gray-400 hover:text-gray-600 disabled:text-gray-300 flex-shrink-0",children:r.jsx(p.Z,{className:"h-3 w-3"})})]}),(0,r.jsxs)("p",{className:`text-xs mt-1 ${s?"text-red-600 font-medium":"text-gray-500"}`,children:["Max: ",t," | Total: ₱",((e.product.price||0)*e.quantity).toFixed(2)]})]}),r.jsx("button",{onClick:()=>removeFromCart(e.product_id),className:"text-red-500 hover:text-red-700 ml-2 flex-shrink-0",children:r.jsx(h.Z,{className:"h-3 w-3 sm:h-4 sm:w-4"})})]},e.product_id)})})}),_.length>0&&(0,r.jsxs)("div",{className:"p-3 sm:p-4 border-t bg-gray-50",children:[(0,r.jsxs)("div",{className:"flex justify-between items-center mb-3 sm:mb-4 min-w-0",children:[r.jsx("span",{className:"font-medium text-sm sm:text-base",children:"Total:"}),(0,r.jsxs)("span",{className:"font-semibold text-green-600 text-base sm:text-lg flex-shrink-0 ml-2",children:["₱",calculateTotal().toFixed(2)]})]}),Z&&r.jsx("div",{className:"bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4",children:r.jsx("p",{className:"text-red-800 text-xs sm:text-sm whitespace-pre-line",children:Z})}),r.jsx("div",{className:"space-y-2",children:"modify"===S?(0,r.jsxs)(r.Fragment,{children:[(0,r.jsxs)("button",{onClick:handleUpdateOrder,disabled:F||0===_.length,className:`w-full flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-3 text-white rounded-lg disabled:opacity-50 transition-colors text-sm sm:text-base ${"green"===Q?"bg-green-600 hover:bg-green-700":"red"===Q?"bg-red-600 hover:bg-red-700":"yellow"===Q?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[F?r.jsx("div",{className:"animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white flex-shrink-0"}):r.jsx(x.Z,{className:"h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"}),r.jsx("span",{className:"truncate",children:F?"Updating...":"Update Order"})]}),r.jsx("button",{onClick:()=>{k([]),P("home"),G(!1)},className:"w-full px-3 sm:px-4 py-2 sm:py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm sm:text-base",children:"Cancel Changes"})]}):(0,r.jsxs)("button",{onClick:handleSubmitOrder,disabled:F||0===_.length,className:`w-full flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-3 text-white rounded-lg disabled:opacity-50 transition-colors text-sm sm:text-base ${"green"===Q?"bg-green-600 hover:bg-green-700":"red"===Q?"bg-red-600 hover:bg-red-700":"yellow"===Q?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[F?r.jsx("div",{className:"animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white flex-shrink-0"}):r.jsx(u.Z,{className:"h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"}),r.jsx("span",{className:"truncate",children:F?"Submitting...":"Submit Order"})]})})]})]})}),M&&r.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4",children:(0,r.jsxs)("div",{className:"bg-white rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden",children:[(0,r.jsxs)("div",{className:"flex items-center justify-between p-4 border-b",children:[r.jsx("h2",{className:"text-lg font-semibold",children:"Past Orders"}),r.jsx("button",{onClick:()=>U(!1),className:"p-2 text-gray-400 hover:text-gray-600",children:r.jsx(h.Z,{className:"h-5 w-5"})})]}),r.jsx("div",{className:"p-6 max-h-96 overflow-y-auto",children:0===$.length?r.jsx("p",{className:"text-gray-500 text-center py-8",children:"No past orders found"}):r.jsx("div",{className:"space-y-4",children:$.map(e=>(0,r.jsxs)("div",{className:"border rounded-lg p-4 hover:bg-gray-50",children:[(0,r.jsxs)("div",{className:"flex justify-between items-start mb-3",children:[(0,r.jsxs)("div",{children:[(0,r.jsxs)("h3",{className:"font-medium text-gray-900",children:["Order #",e.id.slice(-8)]}),(0,r.jsxs)("p",{className:"text-sm text-gray-500",children:[new Date(e.created_at).toLocaleDateString()," at ",new Date(e.created_at).toLocaleTimeString()]})]}),(0,r.jsxs)("div",{className:"text-right",children:[r.jsx("span",{className:`px-2 py-1 rounded-full text-xs font-medium ${"released"===e.status?"bg-green-100 text-green-800":"bg-red-100 text-red-800"}`,children:e.status.charAt(0).toUpperCase()+e.status.slice(1)}),(0,r.jsxs)("p",{className:"text-lg font-semibold text-gray-900 mt-1",children:["₱",e.total_amount.toFixed(2)]})]})]}),r.jsx("div",{className:"space-y-2",children:e.order_details.map(e=>(0,r.jsxs)("div",{className:"flex justify-between items-center text-sm",children:[r.jsx("span",{className:"text-gray-900",children:e.products.name}),(0,r.jsxs)("span",{className:"text-gray-600",children:[e.quantity," \xd7 ₱",e.unit_price.toFixed(2)," = ₱",(e.quantity*e.unit_price).toFixed(2)]})]},e.id))}),r.jsx("div",{className:"mt-4 pt-3 border-t border-gray-200",children:(0,r.jsxs)("button",{onClick:()=>printReceipt(e),className:`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${"green"===Q?"bg-green-100 text-green-700 hover:bg-green-200":"red"===Q?"bg-red-100 text-red-700 hover:bg-red-200":"yellow"===Q?"bg-yellow-100 text-yellow-700 hover:bg-yellow-200":"bg-blue-100 text-blue-700 hover:bg-blue-200"}`,children:[r.jsx(b.Z,{className:"h-4 w-4"}),r.jsx("span",{children:"Print Receipt"})]})})]},e.id))})})]})}),r.jsx("div",{className:"bg-white border-t py-4 mt-8",children:r.jsx("div",{className:"max-w-7xl mx-auto px-2 sm:px-4",children:r.jsx("p",{className:"text-center text-xs text-gray-500",children:"\xa9 Gilnaks Food Corporation"})})})]}):r.jsx("div",{className:"min-h-screen bg-gray-50 flex items-center justify-center p-4",children:(0,r.jsxs)("div",{className:"max-w-md w-full bg-white rounded-lg shadow-md p-8",children:[(0,r.jsxs)("div",{className:"text-center mb-8",children:[r.jsx("div",{className:`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${"green"===Q?"bg-green-100":"red"===Q?"bg-red-100":"yellow"===Q?"bg-yellow-100":"bg-blue-100"}`,children:r.jsx(l.Z,{className:`h-6 w-6 ${"green"===Q?"text-green-600":"red"===Q?"text-red-600":"yellow"===Q?"text-yellow-600":"text-blue-600"}`})}),r.jsx("h2",{className:"text-2xl font-bold text-gray-900",children:"GFC Order Portal"}),r.jsx("p",{className:"text-gray-600 mt-2",children:"Enter your location passcode to continue"})]}),(0,r.jsxs)("form",{onSubmit:handleLocationAuth,className:"space-y-6",children:[(0,r.jsxs)("div",{children:[r.jsx("label",{htmlFor:"passcode",className:"block text-sm font-medium text-gray-700 mb-2",children:"Location Passcode"}),r.jsx("input",{type:"text",id:"passcode",value:s,onChange:e=>y(e.target.value.replace(/\D/g,"").slice(0,6)),className:`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 text-center text-lg tracking-wider ${"green"===Q?"focus:ring-green-500 focus:border-green-500":"red"===Q?"focus:ring-red-500 focus:border-red-500":"yellow"===Q?"focus:ring-yellow-500 focus:border-yellow-500":"focus:ring-blue-500 focus:border-blue-500"}`,placeholder:"Enter 6-digit code",maxLength:6,required:!0})]}),Z&&r.jsx("div",{className:"bg-red-50 border border-red-200 rounded-lg p-3",children:r.jsx("p",{className:"text-red-800 text-sm whitespace-pre-line",children:Z})}),(0,r.jsxs)("button",{type:"submit",disabled:F,className:`w-full flex items-center justify-center space-x-2 px-4 py-3 text-white rounded-lg transition-colors font-medium disabled:opacity-50 ${"green"===Q?"bg-green-600 hover:bg-green-700":"red"===Q?"bg-red-600 hover:bg-red-700":"yellow"===Q?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[F?r.jsx("div",{className:"animate-spin rounded-full h-5 w-5 border-b-2 border-white"}):r.jsx(l.Z,{className:"h-5 w-5"}),r.jsx("span",{children:F?"Signing in...":"Continue to Order"})]})]})]})})}},4130:(e,t,s)=>{"use strict";s.r(t),s.d(t,{$$typeof:()=>l,__esModule:()=>i,default:()=>n});var r=s(5153);let a=(0,r.createProxy)(String.raw`C:\Users\John\Desktop\gfc\inventory-system\app\order\page.tsx`),{__esModule:i,$$typeof:l}=a,d=a.default,n=d}};var t=require("../../webpack-runtime.js");t.C(e);var __webpack_exec__=e=>t(t.s=e),s=t.X(0,[862,866,997,56,956,982],()=>__webpack_exec__(2595));module.exports=s})();