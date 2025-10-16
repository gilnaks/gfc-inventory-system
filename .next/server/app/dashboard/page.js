(()=>{var e={};e.id=702,e.ids=[702],e.modules={5403:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external")},4749:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external")},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},5528:e=>{"use strict";e.exports=require("next/dist\\client\\components\\action-async-storage.external.js")},1877:e=>{"use strict";e.exports=require("next/dist\\client\\components\\request-async-storage.external.js")},5319:e=>{"use strict";e.exports=require("next/dist\\client\\components\\static-generation-async-storage.external.js")},4300:e=>{"use strict";e.exports=require("buffer")},6113:e=>{"use strict";e.exports=require("crypto")},2361:e=>{"use strict";e.exports=require("events")},3685:e=>{"use strict";e.exports=require("http")},5687:e=>{"use strict";e.exports=require("https")},5477:e=>{"use strict";e.exports=require("punycode")},2781:e=>{"use strict";e.exports=require("stream")},7310:e=>{"use strict";e.exports=require("url")},3837:e=>{"use strict";e.exports=require("util")},9796:e=>{"use strict";e.exports=require("zlib")},9854:(e,t,a)=>{"use strict";a.r(t),a.d(t,{GlobalError:()=>i.a,__next_app__:()=>x,originalPathname:()=>m,pages:()=>c,routeModule:()=>u,tree:()=>o});var s=a(7096),r=a(6132),l=a(7284),i=a.n(l),n=a(2564),d={};for(let e in n)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(d[e]=()=>n[e]);a.d(t,d);let o=["",{children:["dashboard",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(a.bind(a,1618)),"C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\dashboard\\page.tsx"]}]},{}]},{layout:[()=>Promise.resolve().then(a.bind(a,5345)),"C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\layout.tsx"],"not-found":[()=>Promise.resolve().then(a.t.bind(a,9291,23)),"next/dist/client/components/not-found-error"]}],c=["C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\dashboard\\page.tsx"],m="/dashboard/page",x={require:a,loadChunk:()=>Promise.resolve()},u=new s.AppPageRouteModule({definition:{kind:r.x.APP_PAGE,page:"/dashboard/page",pathname:"/dashboard",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:o}})},5537:(e,t,a)=>{Promise.resolve().then(a.bind(a,6974))},6974:(e,t,a)=>{"use strict";a.r(t),a.d(t,{default:()=>DashboardPage});var s=a(784),r=a(3745),l=a.n(r),i=a(9885),n=a.n(i),d=a(9708);let o=(0,i.createContext)(void 0);function BrandsProvider({children:e}){let[t,a]=(0,i.useState)([]),[r,l]=(0,i.useState)(!0),[n,c]=(0,i.useState)(null),fetchBrands=async()=>{try{l(!0),c(null);let{data:e,error:t}=await d.O.from("brands").select("*").order("name");if(t){c(t.message);return}a(e||[])}catch(e){c(e instanceof Error?e.message:"Failed to fetch brands")}finally{l(!1)}};return(0,i.useEffect)(()=>{fetchBrands()},[]),s.jsx(o.Provider,{value:{brands:t,loading:r,error:n,refetch:fetchBrands},children:e})}function useBrands(){let e=(0,i.useContext)(o);if(void 0===e)throw Error("useBrands must be used within a BrandsProvider");return e}function BrandSelector({onBrandChange:e}){let{brands:t,loading:a}=useBrands(),[r,l]=(0,i.useState)(null);(0,i.useEffect)(()=>{t.length>0&&!r&&(l(t[0]),e(t[0]))},[t,r,e]);let handleBrandChange=a=>{let s=t.find(e=>e.id===a);s&&(l(s),e(s))};return a?(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"}),s.jsx("span",{className:"text-gray-600",children:"Loading brands..."})]}):s.jsx("select",{id:"brand-select",value:r?.id||"",onChange:e=>handleBrandChange(e.target.value),className:"px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm min-w-[140px]",children:t.map(e=>s.jsx("option",{value:e.id,children:e.name},e.id))})}var c=a(2032),m=a(2385),x=a(6206),u=a(2995),g=a(9494),p=a(6303),h=a(7820);function ProductManager({selectedBrand:e,theme:t="blue"}){let[a,r]=(0,i.useState)([]),[l,n]=(0,i.useState)(!1),[o,b]=(0,i.useState)(!1),[f,y]=(0,i.useState)(null),[v,j]=(0,i.useState)({name:"",sku:"",category:"",unit:"pcs",price:0,initial_stock:0,production:0,released:0,reserved:0}),[w,N]=(0,i.useState)([]),[_,k]=(0,i.useState)(!1),[S,D]=(0,i.useState)(null),[C,P]=(0,i.useState)(null);(0,i.useEffect)(()=>{if(e){S&&clearTimeout(S);let e=setTimeout(()=>{fetchProducts()},100);D(e)}return()=>{S&&clearTimeout(S),C&&clearTimeout(C)}},[e]),(0,i.useEffect)(()=>{if(!e)return;let t=d.O.channel("products-changes").on("postgres_changes",{event:"*",schema:"public",table:"products",filter:`brand_id=eq.${e.id}`},e=>{console.log("Products realtime update:",e),f?console.log("Skipping realtime refetch - currently editing product"):fetchProducts()}).subscribe();return()=>{d.O.removeChannel(t)}},[e,f]),(0,i.useEffect)(()=>{let e=Array.from(new Set(a.map(e=>e.category).filter(e=>e&&""!==e.trim()))).sort();N(e)},[a]),(0,i.useEffect)(()=>{let handleClickOutside=e=>{let t=e.target;_&&!t.closest(".category-dropdown")&&k(!1)};if(_)return document.addEventListener("mousedown",handleClickOutside),()=>document.removeEventListener("mousedown",handleClickOutside)},[_]);let getBrandPrefix=e=>{switch(e){case"gelatofilipino":return"GF-";case"mychoice":return"MC-";case"mang-sorbetes":return"MS-";default:return"PR-"}},O=(0,i.useCallback)(async t=>{if(!e)return"";try{let a=getBrandPrefix(e.slug),{data:s,error:r}=await d.O.from("products").select("sku").eq("brand_id",t).not("sku","is",null).like("sku",`${a}%`).order("sku",{ascending:!1}).limit(1);if(r)return console.error("Error fetching products for SKU generation:",r),a+"001";let l=0;if(s&&s.length>0){let e=s[0].sku;if(e&&e.startsWith(a)){let t=e.substring(a.length),s=parseInt(t);isNaN(s)||(l=s)}}let i=l+1;return a+i.toString().padStart(3,"0")}catch(t){return console.error("Error generating SKU:",t),getBrandPrefix(e.slug)+"001"}},[e]),fetchProducts=async()=>{if(e){n(!0);try{console.log("Fetching products for brand:",e.name);let{data:t,error:a}=await d.O.from("products").select(`
          id,
          brand_id,
          name,
          sku,
          category,
          unit,
          price,
          initial_stock,
          production,
          released,
          reserved,
          created_at,
          updated_at
        `).eq("brand_id",e.id).order("name");if(a){console.error("Error fetching products:",a),alert("Failed to load products. Please try refreshing the page.");return}if(t){console.log("Products fetched successfully:",t.length,"items");let a=t.map(t=>({...t,product_name:t.name,brand_name:e.name,brand_slug:e.slug,final_stock:(t.initial_stock||0)+(t.production||0)-(t.released||0),available_stock:(t.initial_stock||0)+(t.production||0)-(t.released||0)-(t.reserved||0)}));r(a)}}catch(e){console.error("Error fetching products:",e),alert("Failed to load products. Please check your internet connection and try again.")}finally{n(!1)}}},$=(0,i.useMemo)(()=>{let e=a.reduce((e,t)=>{let a=t.category||"Uncategorized";return e[a]||(e[a]=[]),e[a].push(t),e},{}),t=Object.keys(e).sort((e,t)=>"Uncategorized"===e?1:"Uncategorized"===t?-1:e.localeCompare(t));return t.map(t=>({category:t,products:e[t]}))},[a]),handleAddProduct=async t=>{if(t.preventDefault(),e)try{let{data:t,error:a}=await d.O.from("products").insert([{brand_id:e.id,name:v.name,sku:v.sku||null,category:v.category||null,unit:v.unit,price:v.price,initial_stock:v.initial_stock,production:v.production,released:v.released,reserved:v.reserved}]).select();if(a){console.error("Error adding product:",a),alert("Error adding product: "+a.message);return}t&&(await fetchProducts(),j({name:"",sku:"",category:"",unit:"pcs",price:0,initial_stock:0,production:0,released:0,reserved:0}),b(!1))}catch(e){console.error("Error adding product:",e),alert("Error adding product")}},F=(0,i.useCallback)(async e=>{C&&clearTimeout(C);let t=setTimeout(async()=>{try{let{data:t,error:a}=await d.O.from("products").update({name:e.name,sku:e.sku,category:e.category,unit:e.unit,price:e.price,initial_stock:e.initial_stock,production:e.production,released:e.released,reserved:e.reserved}).eq("id",e.id).select();if(a){console.error("Error updating product:",a),alert("Error updating product: "+a.message);return}t&&(r(t=>t.map(t=>t.id===e.id?{...t,...e,product_name:e.name,final_stock:(e.initial_stock||0)+(e.production||0)-(e.released||0),available_stock:(e.initial_stock||0)+(e.production||0)-(e.released||0)-(e.reserved||0)}:t)),y(null))}catch(e){console.error("Error updating product:",e),alert("Error updating product")}},500);P(t)},[C]),handleDeleteProduct=async e=>{if(confirm("Are you sure you want to delete this product?"))try{let{error:t}=await d.O.from("products").delete().eq("id",e);if(t){console.error("Error deleting product:",t),alert("Error deleting product: "+t.message);return}console.log("Product deleted successfully"),r(a.filter(t=>(t.product_id||t.id)!==e)),setTimeout(async()=>{console.log("Refetching products to ensure consistency"),await fetchProducts()},500)}catch(e){console.error("Error deleting product:",e),alert("Error deleting product")}},handleFinalizeStock=async()=>{if(!e)return;let t=prompt("Please enter Wendy's birthdate to finalize stock:");if("030199"!==t){alert("Invalid birthdate. Stock finalization cancelled.");return}if(confirm("Are you sure you want to finalize the stock? This will add production to initial stock and reset production for all products."))try{let{data:t,error:a}=await d.O.from("products").select("*").eq("brand_id",e.id);if(a){console.error("Error fetching products:",a),alert("Error fetching products for finalization");return}if(!t||0===t.length){alert("No products found to finalize");return}let{data:s,error:r}=await d.O.from("daily_stock_summaries").insert({brand_id:e.id,date:(0,h.sn)(),total_production:t.reduce((e,t)=>e+(t.production||0),0),total_released:t.reduce((e,t)=>e+(t.released||0),0),total_final_stock:t.reduce((e,t)=>e+(t.initial_stock||0)+(t.production||0),0)}).select().single();if(r){console.error("Error creating daily summary:",r),alert("Error creating daily summary");return}for(let e of t){let t=(e.initial_stock||0)+(e.production||0),{error:a}=await d.O.from("products").update({initial_stock:t,production:0,updated_at:new Date().toISOString()}).eq("id",e.id);if(a){console.error(`Error updating product ${e.name}:`,a),alert(`Error updating product ${e.name}`);return}}alert("Stock finalized successfully! Production has been added to initial stock."),await fetchProducts()}catch(e){console.error("Error finalizing stock:",e),alert("Error finalizing stock")}};return e?(0,s.jsxs)("div",{className:"space-y-6",children:[(0,s.jsxs)("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0",children:[(0,s.jsxs)("div",{children:[s.jsx("h1",{className:"text-xl font-semibold text-gray-900",children:"Products & Inventory"}),(0,s.jsxs)("p",{className:"text-sm text-gray-600",children:["Manage products and inventory for ",e.name]})]}),(0,s.jsxs)("div",{className:"flex space-x-3",children:[(0,s.jsxs)("button",{onClick:handleFinalizeStock,className:"flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors bg-orange-600 hover:bg-orange-700",children:[s.jsx(c.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Finalize Stock"})]}),(0,s.jsxs)("button",{onClick:async()=>{let t=await O(e.id);j({...v,sku:t}),b(!0)},className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${"green"===t?"bg-green-600 hover:bg-green-700":"red"===t?"bg-red-600 hover:bg-red-700":"yellow"===t?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[s.jsx(m.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Add Product"})]})]})]}),o&&s.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,s.jsxs)("div",{className:"relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[s.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"Add New Product"}),s.jsx("button",{onClick:()=>{b(!1),j({name:"",sku:"",category:"",unit:"pcs",price:0,initial_stock:0,production:0,released:0,reserved:0})},className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]}),(0,s.jsxs)("form",{onSubmit:handleAddProduct,className:"space-y-4",children:[(0,s.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Product Name *"}),s.jsx("input",{type:"text",required:!0,value:v.name,onChange:e=>j({...v,name:e.target.value}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"Enter product name"})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"SKU (Auto-generated)"}),s.jsx("input",{type:"text",value:v.sku,onChange:e=>j({...v,sku:e.target.value}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50",placeholder:"Auto-generated SKU"}),(0,s.jsxs)("p",{className:"text-xs text-gray-500 mt-1",children:["SKU format: ",getBrandPrefix(e.slug),"XXX (e.g., ",getBrandPrefix(e.slug),"001)"]})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Category"}),(0,s.jsxs)("div",{className:"relative category-dropdown",children:[s.jsx("input",{type:"text",value:v.category,onChange:e=>{j({...v,category:e.target.value}),k(!0)},onFocus:()=>k(!0),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"Enter or select category"}),_&&w.length>0&&s.jsx("div",{className:"absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto",children:w.map(e=>s.jsx("button",{type:"button",onClick:t=>{t.preventDefault(),t.stopPropagation(),j({...v,category:e}),k(!1)},onMouseDown:e=>{e.preventDefault(),e.stopPropagation()},className:"w-full text-left px-3 py-2 hover:bg-gray-100 text-sm text-gray-900",children:e},e))})]})]}),(0,s.jsxs)("div",{className:"grid grid-cols-3 gap-4",children:[(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Initial Stock"}),s.jsx("input",{type:"number",min:"0",value:v.initial_stock,onChange:e=>j({...v,initial_stock:parseInt(e.target.value)||0}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"0"})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Unit"}),(0,s.jsxs)("select",{value:v.unit,onChange:e=>j({...v,unit:e.target.value}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",children:[s.jsx("option",{value:"pans",children:"Pans"}),s.jsx("option",{value:"pcs",children:"Pieces"}),s.jsx("option",{value:"gallons",children:"Gallons"}),s.jsx("option",{value:"liters",children:"Liters"}),s.jsx("option",{value:"kg",children:"Kilograms"}),s.jsx("option",{value:"boxes",children:"Boxes"}),s.jsx("option",{value:"bags",children:"Bags"}),s.jsx("option",{value:"g",children:"Grams"}),s.jsx("option",{value:"bottles",children:"Bottles"}),s.jsx("option",{value:"packs",children:"Packs"})]})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Price (₱)"}),s.jsx("input",{type:"number",min:"0",step:"0.01",value:v.price,onChange:e=>j({...v,price:parseFloat(e.target.value)||0}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"0.00"})]})]})]}),(0,s.jsxs)("div",{className:"flex justify-end space-x-3 pt-4",children:[s.jsx("button",{type:"button",onClick:()=>{b(!1),j({name:"",sku:"",category:"",unit:"pcs",price:0,initial_stock:0,production:0,released:0,reserved:0})},className:"px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors",children:"Cancel"}),(0,s.jsxs)("button",{type:"submit",className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${"green"===t?"bg-green-600 hover:bg-green-700":"red"===t?"bg-red-600 hover:bg-red-700":"yellow"===t?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[s.jsx(u.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Save Product"})]})]})]})]})}),l?s.jsx("div",{className:"space-y-6",children:[void 0,void 0].map((e,t)=>(0,s.jsxs)("div",{className:"bg-white rounded-lg border shadow-sm overflow-hidden",children:[s.jsx("div",{className:"bg-gray-50 px-6 py-3 border-b",children:s.jsx("div",{className:"animate-pulse",children:s.jsx("div",{className:"h-6 bg-gray-200 rounded w-48"})})}),s.jsx("div",{children:(0,s.jsxs)("table",{className:"w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:s.jsx("tr",{children:[...Array(11)].map((e,t)=>s.jsx("th",{className:"px-6 py-3 text-left",children:s.jsx("div",{className:"h-4 bg-gray-200 rounded w-16 animate-pulse"})},t))})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:[void 0,void 0,void 0].map((e,t)=>s.jsx("tr",{children:[...Array(11)].map((e,t)=>s.jsx("td",{className:"px-6 py-2 whitespace-nowrap",children:s.jsx("div",{className:"h-4 bg-gray-200 rounded w-20 animate-pulse"})},t))},t))})]})})]},t))}):0===a.length?(0,s.jsxs)("div",{className:"text-center py-8 text-gray-500",children:[(0,s.jsxs)("p",{children:["No products found for ",e.name]}),s.jsx("p",{className:"text-sm",children:'Click "Add Product" to create your first product'})]}):s.jsx("div",{className:"space-y-6",children:$.map(({category:e,products:a})=>(0,s.jsxs)("div",{className:"bg-white rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 ease-in-out",children:[s.jsx("div",{className:"bg-gray-50 px-6 py-3 border-b hover:bg-gray-100 transition-colors duration-200 ease-in-out",children:(0,s.jsxs)("h3",{className:"text-lg font-medium text-gray-900",children:[e," (",a.length," ",1===a.length?"product":"products",")"]})}),s.jsx("div",{className:"overflow-x-auto",children:(0,s.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:(0,s.jsxs)("tr",{children:[s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48",children:"Product Name"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32",children:"SKU"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Unit"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Price"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Initial Stock"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Prod"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Rel"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Final Stock"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Res"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Available"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Actions"})]})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:a.map(e=>(0,s.jsxs)("tr",{className:"hover:bg-blue-100",children:[s.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm font-medium text-gray-900",children:f?.id===(e.product_id||e.id)?s.jsx("input",{type:"text",value:f.name,onChange:e=>y({...f,name:e.target.value}),className:"w-full max-w-44 px-2 py-1 border border-gray-300 rounded text-sm"}):e.product_name||e.name}),s.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-500",children:f?.id===(e.product_id||e.id)?s.jsx("input",{type:"text",value:f.sku||"",onChange:e=>y({...f,sku:e.target.value}),className:"w-full max-w-28 px-2 py-1 border border-gray-300 rounded text-sm"}):e.sku||"-"}),s.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-500",children:f?.id===(e.product_id||e.id)?(0,s.jsxs)("select",{value:f.unit,onChange:e=>y({...f,unit:e.target.value}),className:"w-full max-w-20 px-2 py-1 border border-gray-300 rounded text-sm",children:[s.jsx("option",{value:"pans",children:"Pans"}),s.jsx("option",{value:"pcs",children:"Pieces"}),s.jsx("option",{value:"gallons",children:"Gallons"}),s.jsx("option",{value:"liters",children:"Liters"}),s.jsx("option",{value:"kg",children:"Kilograms"}),s.jsx("option",{value:"boxes",children:"Boxes"}),s.jsx("option",{value:"bags",children:"Bags"}),s.jsx("option",{value:"g",children:"Grams"}),s.jsx("option",{value:"bottles",children:"Bottles"}),s.jsx("option",{value:"packs",children:"Packs"})]}):e.unit}),s.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm font-medium text-green-600",children:f?.id===(e.product_id||e.id)?s.jsx("input",{type:"number",min:"0",step:"0.01",value:0===f.price?"":f.price||"",onChange:e=>y({...f,price:""===e.target.value?0:parseFloat(e.target.value)||0}),className:"w-full max-w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):`₱${(e.price||0).toFixed(2)}`}),s.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-900",children:f?.id===(e.product_id||e.id)?s.jsx("input",{type:"number",min:"0",value:0===f.initial_stock?"":f.initial_stock||"",onChange:e=>y({...f,initial_stock:""===e.target.value?0:parseInt(e.target.value)||0}),className:"w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):e.initial_stock||0}),s.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-900",children:f?.id===(e.product_id||e.id)?s.jsx("input",{type:"number",min:"0",value:0===f.production?"":f.production||"",onChange:e=>y({...f,production:""===e.target.value?0:parseInt(e.target.value)||0}),className:"w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):e.production||0}),s.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-900",children:f?.id===(e.product_id||e.id)?s.jsx("input",{type:"number",min:"0",value:0===f.released?"":f.released||"",onChange:e=>y({...f,released:""===e.target.value?0:parseInt(e.target.value)||0}),className:"w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):e.released||0}),s.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm font-semibold text-purple-600",children:f?.id===(e.product_id||e.id)?(f.initial_stock||0)+(f.production||0)-(f.released||0):e.final_stock||0}),s.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-900",children:f?.id===(e.product_id||e.id)?s.jsx("input",{type:"number",min:"0",value:0===f.reserved?"":f.reserved||"",onChange:e=>y({...f,reserved:""===e.target.value?0:parseInt(e.target.value)||0}),className:"w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):e.reserved||0}),s.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm font-semibold text-emerald-600",children:f?.id===(e.product_id||e.id)?(f.initial_stock||0)+(f.production||0)-(f.released||0)-(f.reserved||0):e.available_stock||0}),s.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-500",children:s.jsx("div",{className:"flex space-x-2",children:f?.id===(e.product_id||e.id)?(0,s.jsxs)(s.Fragment,{children:[s.jsx("button",{onClick:()=>F(f),className:`p-1 rounded ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-100":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-100":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100":"text-blue-600 hover:text-blue-900 hover:bg-blue-100"}`,title:"Save",children:s.jsx(u.Z,{className:"h-4 w-4"})}),s.jsx("button",{onClick:()=>y(null),className:"p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200",title:"Cancel",children:s.jsx(x.Z,{className:"h-4 w-4"})})]}):(0,s.jsxs)(s.Fragment,{children:[s.jsx("button",{onClick:()=>y({...e,id:e.product_id||e.id,name:e.product_name||e.name}),className:`p-1 rounded ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-100":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-100":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100":"text-blue-600 hover:text-blue-900 hover:bg-blue-100"}`,title:"Edit",children:s.jsx(g.Z,{className:"h-4 w-4"})}),s.jsx("button",{onClick:()=>handleDeleteProduct(e.product_id||e.id),className:"p-1 rounded text-red-600 hover:text-red-900 hover:bg-red-100",title:"Delete",children:s.jsx(p.Z,{className:"h-4 w-4"})})]})})})]},e.product_id||e.id))})]})})]},e))})]}):s.jsx("div",{className:"text-center py-8 text-gray-500",children:s.jsx("p",{children:"Please select a brand to manage products"})})}var b=a(5441),f=a(3303),y=a(7004),v=a(1057),j=a(5894),w=a(3482),N=a(1248),_=a(8626),k=a(8260),S=a(4155);function OrderManager({selectedBrand:e,onOrderUpdate:t,theme:a="blue"}){let[r,l]=(0,i.useState)([]),[n,o]=(0,i.useState)(!1),[m,u]=(0,i.useState)(null),[D,C]=(0,i.useState)(null),[P,O]=(0,i.useState)(!1),[$,F]=(0,i.useState)(null),[A,q]=(0,i.useState)(null),[E,L]=(0,i.useState)([]),[M,T]=(0,i.useState)(!1),[I,R]=(0,i.useState)(1),[z,Z]=(0,i.useState)(1),[H,B]=(0,i.useState)(!1),[U,W]=(0,i.useState)(null),[V,Y]=(0,i.useState)(null),getFranchiseIconColor=()=>{switch(a){case"green":return"text-green-600";case"red":return"text-red-600";case"yellow":return"text-yellow-600";default:return"text-blue-600"}};(0,i.useEffect)(()=>{fetchOrders()},[e]),(0,i.useEffect)(()=>{if(!e)return;let t=d.O.channel("customer-orders-changes").on("postgres_changes",{event:"*",schema:"public",table:"customer_orders",filter:`brand_id=eq.${e.id}`},e=>{console.log("Customer orders realtime update:",e),m?console.log("Skipping realtime refetch - currently updating order"):fetchOrders()}).subscribe();return()=>{d.O.removeChannel(t)}},[e,m]);let fetchOrders=async()=>{o(!0);try{let t=d.O.from("customer_orders").select(`
          *,
          location:locations(
            *,
            brand:brands(*)
          ),
          brand:brands(*),
          order_details(
            *,
            products:products(id, name, sku, unit, category)
          ),
          logistics_assignments(
            id,
            date,
            time_slot,
            status
          )
        `).order("created_at",{ascending:!1});e&&(t=t.eq("brand_id",e.id));let{data:a,error:s}=await t;if(s){console.error("Error fetching orders:",s);return}a&&l(a)}catch(e){console.error("Error fetching orders:",e)}finally{o(!1)}},updateOrderStatus=async(e,a)=>{if(m===e){console.log("Order update already in progress for:",e);return}u(e);try{let{data:s,error:r}=await d.O.from("customer_orders").select(`
          *,
          location:locations(company_owned)
        `).eq("id",e).single();if(r){console.error("Error fetching order:",r),alert("Failed to fetch order data");return}if("fulfilled"===a){let{data:t,error:a}=await d.O.from("order_details").select("product_id, quantity").eq("order_id",e);if(a){console.error("Error fetching order details:",a),alert("Failed to fetch order details");return}let s=t?.map(e=>e.product_id).filter(Boolean)||[];if(s.length>0){let{data:e,error:a}=await d.O.from("products").select("id, initial_stock, released").in("id",s);if(a){console.error("Error fetching product data:",a),alert("Failed to fetch product data");return}let r=new Map(e?.map(e=>[e.id,e]));for(let e of t||[]){let t=r.get(e.product_id);if(!t)continue;let a=Math.max(0,(t.initial_stock||0)-e.quantity),s=Math.max(0,(t.released||0)-e.quantity),{error:l}=await d.O.from("products").update({initial_stock:a,released:s,updated_at:new Date().toISOString()}).eq("id",e.product_id);if(l){console.error("Error updating product quantities:",l),alert("Failed to update product quantities");return}}}}if("in-transit"===a){let{data:t,error:a}=await d.O.from("order_details").select("product_id, quantity").eq("order_id",e);if(a){console.error("Error fetching order details:",a),alert("Failed to fetch order details");return}let s=t?.map(e=>e.product_id).filter(Boolean)||[];if(s.length>0){let{data:e,error:a}=await d.O.from("products").select("id, reserved, released").in("id",s);if(a)console.error("Error fetching product data:",a);else{let a=new Map(e?.map(e=>[e.id,e]));for(let e of t||[]){if(!e.product_id)continue;let t=a.get(e.product_id);if(!t){console.warn("Product not found for product_id:",e.product_id);continue}let s=Math.max(0,(t.reserved||0)-e.quantity),r=(t.released||0)+e.quantity,{error:l}=await d.O.from("products").update({reserved:s,released:r,updated_at:new Date().toISOString()}).eq("id",e.product_id);if(l){console.error("Error updating product quantities:",l),alert("Failed to update product quantities");return}}}}}if("complete"===a&&console.log("Order marked as complete - no inventory changes needed"),"cancelled"===a){let{data:t,error:a}=await d.O.from("order_details").select("product_id, quantity").eq("order_id",e);if(a){console.error("Error fetching order details:",a),alert("Failed to fetch order details");return}let s=t?.map(e=>e.product_id).filter(Boolean)||[];if(s.length>0){let{data:e,error:a}=await d.O.from("products").select("id, reserved, released").in("id",s);if(a)console.error("Error fetching product data:",a);else{let a=new Map(e?.map(e=>[e.id,e]));for(let e of t||[]){if(!e.product_id)continue;let t=a.get(e.product_id);if(!t){console.warn("Product not found for product_id:",e.product_id);continue}let s=t.released||0,r=t.reserved||0,l={updated_at:new Date().toISOString()};if(s>=e.quantity)l.released=Math.max(0,s-e.quantity);else if(r>=e.quantity)l.reserved=Math.max(0,r-e.quantity);else{let t=e.quantity,a=Math.min(t,s),i=t-a;l.released=Math.max(0,s-a),l.reserved=Math.max(0,r-i)}let{error:i}=await d.O.from("products").update(l).eq("id",e.product_id);if(i){console.error("Error updating product quantities:",i),alert("Failed to update product quantities");return}}}}let{error:r}=await d.O.from("logistics_assignments").delete().eq("order_id",e);if(r){console.error("Error deleting logistics assignments:",r),alert("Failed to delete logistics assignments");return}}let{error:l}=await d.O.from("customer_orders").update({status:a,updated_at:new Date().toISOString()}).eq("id",e);if(l){console.error("Error updating order status:",l),alert("Failed to update order status");return}fetchOrders(),t&&t()}catch(e){console.error("Error updating order status:",e),alert("Failed to update order status")}finally{u(null)}},handleDeleteOrder=async e=>{try{u(e);let{data:a,error:s}=await d.O.from("customer_orders").select(`
          *,
          order_details(
            product_id,
            quantity
          )
        `).eq("id",e).single();if(s){console.error("Error fetching order:",s),alert("Failed to fetch order data");return}if("fulfilled"===a.status&&a.order_details)for(let e of a.order_details){if(!e.product_id){console.warn("Skipping order detail with missing product_id:",e);continue}let{data:t,error:a}=await d.O.from("products").select("initial_stock, released").eq("id",e.product_id).single();if(a){console.error("Error fetching product data for product_id:",e.product_id,a);continue}if(!t){console.warn("Product not found for product_id:",e.product_id);continue}let s=(t?.initial_stock||0)+e.quantity,r=Math.max(0,(t?.released||0)-e.quantity),{error:l}=await d.O.from("products").update({initial_stock:s,released:r,updated_at:new Date().toISOString()}).eq("id",e.product_id);if(l){console.error("Error updating product quantities:",l),alert("Failed to update product quantities");return}}if(a.returnable_pans_image_url)try{let e=a.returnable_pans_image_url.split("/"),t=e[e.length-1],{error:s}=await d.O.storage.from("returnable_pans").remove([t]);s&&console.error("Error deleting returnable pans image:",s)}catch(e){console.error("Error processing returnable pans image deletion:",e)}let{error:r}=await d.O.from("logistics_assignments").delete().eq("order_id",e);if(r){console.error("Error deleting logistics assignments:",r),alert("Failed to delete logistics assignments");return}let{error:l}=await d.O.from("order_details").delete().eq("order_id",e);if(l){console.error("Error deleting order details:",l),alert("Failed to delete order details");return}let{error:i}=await d.O.from("customer_orders").delete().eq("id",e);if(i){console.error("Error deleting order:",i),alert("Failed to delete order");return}fetchOrders(),t&&t()}catch(e){console.error("Error deleting order:",e),alert("Failed to delete order")}finally{u(null)}},handleDeleteCompleteOrder=async e=>{try{u(e);let{data:a,error:s}=await d.O.from("customer_orders").select(`
          *,
          order_details(
            product_id,
            quantity
          )
        `).eq("id",e).single();if(s){console.error("Error fetching order:",s),alert("Failed to fetch order data");return}if(a.returnable_pans_image_url)try{let e=a.returnable_pans_image_url.split("/"),t=e[e.length-1],{error:s}=await d.O.storage.from("returnable_pans").remove([t]);s&&console.error("Error deleting returnable pans image:",s)}catch(e){console.error("Error processing returnable pans image deletion:",e)}if(a.deposit_slip_url)try{let e=a.deposit_slip_url.split("/"),t=e[e.length-1],{error:s}=await d.O.storage.from("deposit_slips").remove([t]);s&&console.error("Error deleting deposit slip image:",s)}catch(e){console.error("Error processing deposit slip image deletion:",e)}let{error:r}=await d.O.from("logistics_assignments").delete().eq("order_id",e);if(r){console.error("Error deleting logistics assignments:",r),alert("Failed to delete logistics assignments");return}let{error:l}=await d.O.from("order_details").delete().eq("order_id",e);if(l){console.error("Error deleting order details:",l),alert("Failed to delete order details");return}let{error:i}=await d.O.from("customer_orders").delete().eq("id",e);if(i){console.error("Error deleting order:",i),alert("Failed to delete order");return}fetchOrders(),t&&t(),alert("Complete order deleted successfully")}catch(e){console.error("Error deleting complete order:",e),alert("Failed to delete complete order")}finally{u(null)}},getStatusIcon=e=>{switch(e){case"pending":return s.jsx(b.Z,{className:"h-4 w-4 text-yellow-500"});case"approved":return s.jsx(c.Z,{className:"h-4 w-4 text-blue-500"});case"in-transit":return s.jsx(f.Z,{className:"h-4 w-4 text-orange-500"});case"verified":return s.jsx(c.Z,{className:"h-4 w-4 text-green-500"});case"fulfilled":return s.jsx(y.Z,{className:"h-4 w-4 text-green-500"});case"cancelled":return s.jsx(v.Z,{className:"h-4 w-4 text-red-500"});default:return s.jsx(b.Z,{className:"h-4 w-4 text-gray-500"})}},getStatusColor=e=>{switch(e){case"pending":return"bg-yellow-100 text-yellow-800";case"approved":return"bg-blue-100 text-blue-800";case"in-transit":return"bg-orange-100 text-orange-800";case"verified":case"fulfilled":return"bg-green-100 text-green-800";case"paid":return"bg-purple-100 text-purple-800";case"complete":return"bg-indigo-100 text-indigo-800";case"cancelled":return"bg-red-100 text-red-800";default:return"bg-gray-100 text-gray-800"}},isOrderScheduled=e=>e.logistics_assignments&&e.logistics_assignments.length>0,canDispatchOrder=e=>{if(!isOrderScheduled(e))return!1;let t=new Date;return t.setHours(0,0,0,0),e.logistics_assignments?.some(e=>{let a=new Date(e.date);return a.setHours(0,0,0,0),a<=t})||!1},requiresReturnablePans=e=>{if(console.log("requiresReturnablePans - Order details:",e.order_details?.length),console.log("requiresReturnablePans - Brand:",e.location?.brand),!e.order_details||!e.location?.brand)return console.log("requiresReturnablePans - Missing order_details or brand"),!1;let t=e.location.brand.slug.toLowerCase();console.log("requiresReturnablePans - Brand slug:",t);let a=e.order_details.some(e=>{let a=e.products?.category?.toLowerCase()||"";switch(console.log("requiresReturnablePans - Product:",e.products?.name,"Category:",a),t){case"gelatofilipino":return"gelato"===a;case"mychoice":return"ice cream"===a;case"mang-sorbetes":return"sorbetes"===a;default:return!1}});return console.log("requiresReturnablePans - Has returnable pans products:",a),a},G=(0,i.useCallback)(e=>{if(!e.order_details)return[];let t=new Map;return e.order_details.forEach(e=>{let a=e.products?.category&&""!==e.products.category.trim()?e.products.category:"Uncategorized";t.has(a)||t.set(a,{category:a,totalQuantity:0,totalAmount:0});let s=t.get(a);s.totalQuantity+=e.quantity,s.totalAmount+=e.unit_price*e.quantity}),Array.from(t.values())},[]),Q=(0,i.useCallback)(e=>{let t=e.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0),a=t;return"delivery"===e.delivery_type?a+=t>=1e4?0:500:"pickup"===e.delivery_type&&t>=1e4&&(a-=.05*t),a},[]),K=(0,i.useMemo)(()=>({pending:r.filter(e=>"pending"===e.status),approved:r.filter(e=>"approved"===e.status),"in-transit":r.filter(e=>"in-transit"===e.status),verified:r.filter(e=>"verified"===e.status),fulfilled:r.filter(e=>"fulfilled"===e.status),paid:r.filter(e=>"paid"===e.status),complete:r.filter(e=>"complete"===e.status),cancelled:r.filter(e=>"cancelled"===e.status)}),[r]),J=(0,i.useCallback)(e=>K[e]||[],[K]),X=(0,i.useCallback)((e,t)=>{let a=J(e),s="complete"===e||"cancelled"===e?5:10,r=(t-1)*s,l=r+s;return a.slice(r,l)},[J,10]),ee=(0,i.useCallback)(e=>{let t=J(e),a="complete"===e||"cancelled"===e?5:10;return Math.ceil(t.length/a)},[J,10]),OrderTable=({orders:e,showPagination:t=!1,currentPage:r=1,onPageChange:l=()=>{}})=>0===e.length?(0,s.jsxs)("div",{className:"text-center py-8",children:[s.jsx(j.Z,{className:"h-8 w-8 text-gray-400 mx-auto mb-2"}),s.jsx("p",{className:"text-gray-500",children:"No orders found"})]}):(0,s.jsxs)("div",{className:"bg-white rounded-lg border shadow-sm overflow-hidden",children:[s.jsx("div",{className:"overflow-x-auto",children:(0,s.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:(0,s.jsxs)("tr",{children:[s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Order Details"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Location"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Status"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Date"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Logistics"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Returnable"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Total Amount"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Actions"})]})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:e.map(e=>(0,s.jsxs)("tr",{className:"hover:bg-blue-100",children:[s.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:(0,s.jsxs)("div",{children:[(0,s.jsxs)("div",{className:"text-sm font-medium text-gray-900",children:["#",e.id.slice(-8)]}),s.jsx("div",{className:"text-sm text-gray-500",children:e.brand?.name})]})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:(0,s.jsxs)("div",{className:"flex items-center space-x-1",children:[e.location?.company_owned?s.jsx("div",{title:"Company Owned",children:s.jsx(w.Z,{className:"h-4 w-4 text-blue-600"})}):s.jsx("div",{title:"Franchise",children:s.jsx(N.Z,{className:`h-4 w-4 ${getFranchiseIconColor()}`})}),s.jsx("span",{children:e.location?.name})]})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:(0,s.jsxs)("span",{className:`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(e.status)}`,children:[getStatusIcon(e.status),s.jsx("span",{className:"ml-1 capitalize",children:e.status})]})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:(0,h.iI)(e.created_at,{dateStyle:"short"})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:(0,s.jsxs)("div",{className:"space-y-1",children:[s.jsx("span",{className:`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${"delivery"===e.delivery_type?"bg-blue-100 text-blue-800":"pickup"===e.delivery_type?"bg-green-100 text-green-800":"bg-gray-200 text-gray-700"}`,children:"delivery"===e.delivery_type?"Delivery":"pickup"===e.delivery_type?"Pickup":"None"}),e.logistics_assignments&&e.logistics_assignments.length>0&&s.jsx("div",{className:"text-xs text-gray-500",children:e.logistics_assignments.map((e,t)=>(0,s.jsxs)("div",{className:"flex items-center space-x-1",children:[s.jsx("span",{className:"text-gray-400",children:"•"}),s.jsx("span",{children:new Date(e.date).toLocaleDateString()}),(0,s.jsxs)("span",{className:"capitalize",children:["(",e.time_slot,")"]})]},e.id))})]})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:(()=>{let t=e.order_details.filter(t=>{if(!e.brand&&!e.location?.brand)return!1;let a=(e.brand?.slug||e.location?.brand?.slug)?.toLowerCase(),s=t.products?.category?.toLowerCase()||"";switch(a){case"gelatofilipino":return"gelato"===s;case"mychoice":return"ice cream"===s;case"mang-sorbetes":return"sorbetes"===s;default:return!1}}),a=t.reduce((e,t)=>e+t.quantity,0);return a>0&&e.returnable_pans_image_url?(0,s.jsxs)("button",{onClick:()=>{W(e.returnable_pans_image_url),Y(e),B(!0)},className:"text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer",title:"Click to view returnable pans image",children:[a," pans"]}):a>0?(0,s.jsxs)("span",{className:"text-red-600 font-medium cursor-default",children:[a," pans"]}):s.jsx("span",{className:"text-gray-400",children:"-"})})()}),(0,s.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600",children:["₱",Q(e).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:(0,s.jsxs)("div",{className:"flex space-x-2",children:[s.jsx("button",{onClick:()=>C(e),className:"p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-100",title:"View Details",children:s.jsx(_.Z,{className:"h-4 w-4"})}),"pending"===e.status&&s.jsx("button",{onClick:()=>{let t=requiresReturnablePans(e),a=!!e.returnable_pans_image_url;if(console.log("Order:",e.id.slice(-8)),console.log("Needs returnable pans:",t),console.log("Has image:",a),console.log("Should be disabled:",t&&!a),t&&!a){alert("Returnable pans image is required before approving this order");return}updateOrderStatus(e.id,"approved")},className:`p-1 rounded ${requiresReturnablePans(e)&&!e.returnable_pans_image_url?"text-gray-400 cursor-not-allowed":"text-green-600 hover:text-green-900 hover:bg-green-100"}`,title:requiresReturnablePans(e)&&!e.returnable_pans_image_url?"Returnable pans image required":"Approve Order",children:m===e.id?s.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):s.jsx(c.Z,{className:"h-4 w-4"})}),"approved"===e.status&&s.jsx("button",{onClick:()=>updateOrderStatus(e.id,"in-transit"),disabled:m===e.id||!canDispatchOrder(e),className:`p-1 rounded ${m!==e.id&&canDispatchOrder(e)?"text-orange-600 hover:text-orange-900 hover:bg-orange-100":"text-gray-400 cursor-not-allowed"}`,title:isOrderScheduled(e)?canDispatchOrder(e)?"Dispatch Order":"Delivery date has not arrived yet":"Schedule order in logistics tab first",children:m===e.id?s.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):s.jsx(f.Z,{className:"h-4 w-4"})}),"verified"===e.status&&s.jsx("button",{onClick:()=>{confirm("Are you sure you want to mark this order as fulfilled? This action will subtract items from both initial stock and released inventory and cannot be undone.")&&updateOrderStatus(e.id,"fulfilled")},disabled:m===e.id,className:`p-1 rounded ${m===e.id?"text-gray-400 cursor-not-allowed":"green"===a?"text-green-600 hover:text-green-900 hover:bg-green-100":"red"===a?"text-red-600 hover:text-red-900 hover:bg-red-100":"yellow"===a?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100":"text-blue-600 hover:text-blue-900 hover:bg-blue-100"}`,title:"Mark as Fulfilled",children:m===e.id?s.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):s.jsx(y.Z,{className:"h-4 w-4"})}),("pending"===e.status||"approved"===e.status||"in-transit"===e.status||"verified"===e.status)&&s.jsx("button",{onClick:()=>{confirm("Are you sure you want to cancel this order? This action will return reserved stock to available inventory and cannot be undone.")&&updateOrderStatus(e.id,"cancelled")},disabled:m===e.id,className:`${m===e.id?"text-gray-400 cursor-not-allowed":"text-red-600 hover:text-red-900"}`,title:"Cancel Order",children:m===e.id?s.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):s.jsx(v.Z,{className:"h-4 w-4"})}),"fulfilled"===e.status&&s.jsx("button",{onClick:()=>{confirm("Are you sure you want to mark this order as complete? This will skip the paid status and cannot be undone.")&&updateOrderStatus(e.id,"complete")},disabled:m===e.id,className:`p-1 rounded ${m===e.id?"text-gray-400 cursor-not-allowed":"green"===a?"text-green-600 hover:text-green-900 hover:bg-green-100":"red"===a?"text-red-600 hover:text-red-900 hover:bg-red-100":"yellow"===a?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100":"text-blue-600 hover:text-blue-900 hover:bg-blue-100"}`,title:"Mark as Complete",children:m===e.id?s.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):s.jsx(c.Z,{className:"h-4 w-4"})}),("cancelled"===e.status||"fulfilled"===e.status)&&s.jsx("button",{onClick:()=>{let t="fulfilled"===e.status?"delete this fulfilled order? This will restore the released quantities back to initial stock and cannot be undone.":"delete this order? This action cannot be undone.";confirm(`Are you sure you want to ${t}`)&&handleDeleteOrder(e.id)},disabled:m===e.id,className:`${m===e.id?"text-gray-400 cursor-not-allowed":"text-red-600 hover:text-red-900"}`,title:"fulfilled"===e.status?"Delete Order (Restores inventory)":"Delete Order",children:m===e.id?s.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):s.jsx(p.Z,{className:"h-4 w-4"})}),"complete"===e.status&&s.jsx("button",{onClick:()=>{confirm("Are you sure you want to delete this complete order? This will permanently remove the order and all related data (logistics, images, etc.) but will NOT affect inventory. This action cannot be undone.")&&handleDeleteCompleteOrder(e.id)},disabled:m===e.id,className:`${m===e.id?"text-gray-400 cursor-not-allowed":"text-red-600 hover:text-red-900"}`,title:"Delete Complete Order (No inventory changes)",children:m===e.id?s.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):s.jsx(p.Z,{className:"h-4 w-4"})})]})})]},e.id))})]})}),t&&ee(e[0]?.status||"")>1&&(0,s.jsxs)("div",{className:"bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6",children:[(0,s.jsxs)("div",{className:"flex-1 flex justify-between sm:hidden",children:[s.jsx("button",{onClick:()=>l(Math.max(1,r-1)),disabled:1===r,className:"relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed",children:"Previous"}),s.jsx("button",{onClick:()=>l(Math.min(ee(e[0]?.status||""),r+1)),disabled:r===ee(e[0]?.status||""),className:"ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed",children:"Next"})]}),(0,s.jsxs)("div",{className:"hidden sm:flex-1 sm:flex sm:items-center sm:justify-between",children:[s.jsx("div",{children:(0,s.jsxs)("p",{className:"text-sm text-gray-700",children:["Showing page ",s.jsx("span",{className:"font-medium",children:r})," of"," ",s.jsx("span",{className:"font-medium",children:ee(e[0]?.status||"")})]})}),s.jsx("div",{children:(0,s.jsxs)("nav",{className:"relative z-0 inline-flex rounded-md shadow-sm -space-x-px","aria-label":"Pagination",children:[s.jsx("button",{onClick:()=>l(Math.max(1,r-1)),disabled:1===r,className:"relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed",children:"Previous"}),s.jsx("button",{onClick:()=>l(Math.min(ee(e[0]?.status||""),r+1)),disabled:r===ee(e[0]?.status||""),className:"relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed",children:"Next"})]})})]})]})]}),getSubtotalAmount=e=>e.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0),fetchAvailableProducts=async()=>{if(e)try{let{data:t,error:a}=await d.O.from("inventory_summary").select("*").eq("brand_id",e.id).order("category, product_name");if(a)throw a;L(t||[])}catch(e){console.error("Error fetching products:",e),alert("Failed to fetch products")}},handleSaveOverride=async()=>{if($&&A&&e){T(!0);try{let e=new Map,a=new Set([...A.order_details.map(e=>e.product_id),...$.order_details.map(e=>e.product_id)]);for(let[t,s]of(a.forEach(t=>{let a=A.order_details.find(e=>e.product_id===t)?.quantity||0,s=$.order_details.find(e=>e.product_id===t)?.quantity||0;e.set(t,s-a)}),Array.from(e.entries())))if(s>0){let e=E.find(e=>e.id===t);if(!e&&!(e=E.find(e=>e.product_id===t))){alert(`Product not found: ${t}`);return}let a=A.order_details.find(e=>e.product_id===t)?.quantity||0,r="in-transit"===$.status;if(r){let t=(e.available_stock||0)+a,r=(e.released||0)-a;if(s>t+r){alert(`Insufficient stock for ${e.name}. Available: ${t+r}, Requested: ${s}`);return}}else{let t=(e.available_stock||0)+a;if(s>t){alert(`Insufficient stock for ${e.name}. Available: ${t}, Requested: ${s}`);return}}}for(let[t,a]of Array.from(e.entries()))if(0!==a){let e="in-transit"===$.status,{data:s,error:r}=await d.O.from("products").select("reserved, released").eq("id",t).single();if(r){console.error("Error fetching current product:",r),alert("Failed to fetch current product data");return}let l=e?s.released||0:s.reserved||0,i=l+a,n=e?{released:i,updated_at:new Date().toISOString()}:{reserved:i,updated_at:new Date().toISOString()},{error:o}=await d.O.from("products").update(n).eq("id",t);if(o){console.error("Error updating inventory:",o),alert("Failed to update inventory");return}}let{error:s}=await d.O.from("order_details").delete().eq("order_id",$.id);if(s)throw s;if($.order_details.length>0){let{error:e}=await d.O.from("order_details").insert($.order_details.map(e=>({order_id:$.id,product_id:e.product_id,quantity:e.quantity,unit_price:e.unit_price})));if(e)throw e}let r=calculateOverrideTotal(),{error:l}=await d.O.from("customer_orders").update({total_amount:r,delivery_type:$.delivery_type,updated_at:new Date().toISOString()}).eq("id",$.id);if(l)throw l;await fetchOrders(),t&&t(),console.log("Override - New total calculated:",r),console.log("Override - Editing order details:",$.order_details),console.log("Override - Delivery type:",$.delivery_type),C({...D,total_amount:r,delivery_type:$.delivery_type,order_details:$.order_details}),O(!1),F(null),q(null),alert("Order updated successfully!")}catch(e){console.error("Error updating order:",e),alert("Failed to update order")}finally{T(!1)}}},addProductToOrder=e=>{if(!$)return;let t=e.product_id||e.id,a=$.order_details.find(e=>e.product_id===t),s=a?a.quantity+1:1,r=A.order_details.find(e=>e.product_id===t)?.quantity||0,l=(e.available_stock||0)+r;if(s>l){alert(`Insufficient stock for ${e.product_name||e.name}. Available: ${l}, Requested: ${s}`);return}a?F({...$,order_details:$.order_details.map(e=>e.product_id===t?{...e,quantity:s}:e)}):F({...$,order_details:[...$.order_details,{id:`temp-${Date.now()}`,order_id:$.id,product_id:t,quantity:1,unit_price:e.price||0,products:e}]})},removeProductFromOrder=e=>{$&&F({...$,order_details:$.order_details.filter(t=>t.product_id!==e)})},updateProductQuantity=(e,t)=>{if(!$||t<0)return;if(0===t){removeProductFromOrder(e);return}let a=E.find(t=>(t.product_id||t.id)===e);if(a){let s=A.order_details.find(t=>t.product_id===e)?.quantity||0,r=(a.available_stock||0)+s;if(t>r){alert(`Insufficient stock for ${a.product_name||a.name}. Available: ${r}, Requested: ${t}`);return}}F({...$,order_details:$.order_details.map(a=>a.product_id===e?{...a,quantity:t}:a)})},calculateOverrideTotal=()=>{if(!$)return 0;let e=$.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0),t=e;return"delivery"===$.delivery_type?t+=e>=1e4?0:500:"pickup"===$.delivery_type&&e>=1e4&&(t-=.05*e),t},canIncreaseQuantity=e=>{if(!$||!A)return!1;let t=E.find(t=>(t.product_id||t.id)===e);if(!t)return!1;let a=A.order_details.find(t=>t.product_id===e)?.quantity||0,s=$.order_details.find(t=>t.product_id===e)?.quantity||0,r=(t.available_stock||0)+a;return s<r},canAddProduct=e=>{if(!$||!A)return!1;let t=e.product_id||e.id,a=A.order_details.find(e=>e.product_id===t)?.quantity||0,s=$.order_details.find(e=>e.product_id===t)?.quantity||0,r=(e.available_stock||0)+a;return s<r};return(0,s.jsxs)("div",{className:"space-y-6",children:[s.jsx("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0",children:(0,s.jsxs)("div",{children:[s.jsx("h1",{className:"text-xl font-semibold text-gray-900",children:"Customer Orders"}),s.jsx("p",{className:"text-sm text-gray-600",children:"Manage customer orders and track their status"})]})}),n?s.jsx("div",{className:"space-y-8",children:["Pending","Approved","In-Transit","Verified"].map((e,t)=>(0,s.jsxs)("div",{children:[s.jsx("div",{className:"flex items-center justify-between mb-4",children:(0,s.jsxs)("div",{className:"flex items-center",children:[s.jsx("div",{className:"h-5 w-5 bg-gray-200 rounded mr-2 animate-pulse"}),s.jsx("div",{className:"h-6 bg-gray-200 rounded w-48 animate-pulse"})]})}),s.jsx("div",{className:"bg-white rounded-lg border shadow-sm overflow-hidden",children:s.jsx("div",{children:(0,s.jsxs)("table",{className:"w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:s.jsx("tr",{children:[...Array(7)].map((e,t)=>s.jsx("th",{className:"px-6 py-3 text-left",children:s.jsx("div",{className:"h-4 bg-gray-200 rounded w-20 animate-pulse"})},t))})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:[void 0,void 0].map((e,t)=>s.jsx("tr",{children:[...Array(7)].map((e,t)=>s.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:s.jsx("div",{className:"h-4 bg-gray-200 rounded w-24 animate-pulse"})},t))},t))})]})})})]},t))}):(0,s.jsxs)("div",{className:"space-y-8",children:[(0,s.jsxs)("div",{children:[s.jsx("div",{className:"flex items-center justify-between mb-4",children:(0,s.jsxs)("h4",{className:"text-lg font-semibold text-gray-900 flex items-center",children:[s.jsx(b.Z,{className:"h-5 w-5 text-yellow-500 mr-2"}),"Pending Orders (",J("pending").length,")"]})}),s.jsx(OrderTable,{orders:J("pending")})]}),(0,s.jsxs)("div",{children:[s.jsx("div",{className:"flex items-center justify-between mb-4",children:(0,s.jsxs)("h4",{className:"text-lg font-semibold text-gray-900 flex items-center",children:[s.jsx(c.Z,{className:"h-5 w-5 text-blue-500 mr-2"}),"Approved Orders (",J("approved").length,")"]})}),s.jsx(OrderTable,{orders:J("approved")})]}),(0,s.jsxs)("div",{children:[s.jsx("div",{className:"flex items-center justify-between mb-4",children:(0,s.jsxs)("h4",{className:"text-lg font-semibold text-gray-900 flex items-center",children:[s.jsx(f.Z,{className:"h-5 w-5 text-orange-500 mr-2"}),"In-Transit Orders (",J("in-transit").length,")"]})}),s.jsx(OrderTable,{orders:J("in-transit")})]}),(0,s.jsxs)("div",{children:[s.jsx("div",{className:"flex items-center justify-between mb-4",children:(0,s.jsxs)("h4",{className:"text-lg font-semibold text-gray-900 flex items-center",children:[s.jsx(c.Z,{className:"h-5 w-5 text-green-500 mr-2"}),"Verified Orders (",J("verified").length,")"]})}),s.jsx(OrderTable,{orders:J("verified")})]}),(0,s.jsxs)("div",{children:[s.jsx("div",{className:"flex items-center justify-between mb-4",children:(0,s.jsxs)("h4",{className:"text-lg font-semibold text-gray-900 flex items-center",children:[s.jsx(y.Z,{className:"h-5 w-5 text-green-500 mr-2"}),"Fulfilled Orders (",J("fulfilled").length,")"]})}),s.jsx(OrderTable,{orders:J("fulfilled")})]}),(0,s.jsxs)("div",{children:[s.jsx("div",{className:"flex items-center justify-between mb-4",children:(0,s.jsxs)("h4",{className:"text-lg font-semibold text-gray-900 flex items-center",children:[s.jsx(k.Z,{className:"h-5 w-5 text-purple-500 mr-2"}),"Paid Orders (",J("paid").length,")"]})}),s.jsx(OrderTable,{orders:J("paid")})]}),(0,s.jsxs)("div",{children:[s.jsx("div",{className:"flex items-center justify-between mb-4",children:(0,s.jsxs)("h4",{className:"text-lg font-semibold text-gray-900 flex items-center",children:[s.jsx(c.Z,{className:"h-5 w-5 text-indigo-500 mr-2"}),"Complete Orders (",J("complete").length,")"]})}),s.jsx(OrderTable,{orders:X("complete",I),showPagination:!0,currentPage:I,onPageChange:R})]}),(0,s.jsxs)("div",{children:[s.jsx("div",{className:"flex items-center justify-between mb-4",children:(0,s.jsxs)("h4",{className:"text-lg font-semibold text-gray-900 flex items-center",children:[s.jsx(v.Z,{className:"h-5 w-5 text-red-500 mr-2"}),"Cancelled Orders (",J("cancelled").length,")"]})}),s.jsx(OrderTable,{orders:X("cancelled",z),showPagination:!0,currentPage:z,onPageChange:Z})]})]}),D&&s.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,s.jsxs)("div",{className:"relative top-4 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col overflow-hidden",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center mb-4 flex-shrink-0",children:[(0,s.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Order Details #",D.id.slice(0,8)]}),(0,s.jsxs)("div",{className:"flex space-x-2",children:[("approved"===D.status||"in-transit"===D.status)&&(0,s.jsxs)("button",{onClick:()=>{D&&(q({...D}),F({...D}),O(!0),fetchAvailableProducts())},className:"flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium bg-orange-100 text-orange-700 hover:bg-orange-200",children:[s.jsx(g.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Override"})]}),"pending"!==D.status&&("approved"!==D.status||isOrderScheduled(D))&&(0,s.jsxs)("button",{onClick:()=>{if(!D)return;let e=window.open("","_blank");e&&(e.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - Order ${D.id.slice(0,8)}</title>
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
              padding: 12px 20px;
              background: white;
              color: black;
              border-bottom: 2px solid black;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .company-name { 
              font-size: 23px; 
              font-weight: bold; 
              color: black;
            }
            
            .receipt-title { 
              font-size: 15px; 
              font-weight: normal; 
              color: black;
            }
            
            .generated-date {
              font-size: 10px;
              color: #6b7280;
              text-align: center;
              flex: 1;
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
            .status-fulfilled { background: black; color: white; }
            .status-cancelled { background: white; color: black; }
            
            .items { 
              padding: 8px 12px;
              flex: 1;
            }
            
            .items-multi-column {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            
            .items-column {
              display: flex;
              flex-direction: column;
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
              width: 10px;
              height: 10px;
              border: 1px solid black;
              background: white;
              cursor: pointer;
            }
            
            .item-row {
              display: grid;
              grid-template-columns: 20px 2fr 1fr 1fr 1fr;
              gap: 4px;
              align-items: center;
              padding: 1px 0;
              border-bottom: 1px solid #ccc;
              font-size: 9px;
              min-height: 16px;
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
            
            .signatories {
              margin-top: 20px;
              padding-top: 15px;
              border-top: 1px solid #ddd;
            }
            
            .signatories-row {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr 0.5fr;
              gap: 15px;
              margin-bottom: 15px;
            }
            
            .signatory-item {
              text-align: center;
            }
            
            .signatory-item.returned-pans {
              min-width: 80px;
            }
            
            .signatory-label {
              font-size: 11px;
              color: #333;
              margin-bottom: 25px;
              font-weight: 500;
            }
            
            .signatory-line {
              border-bottom: 1px solid #333;
              height: 20px;
              margin-bottom: 5px;
            }
            
            .signatory-line.small {
              height: 20px;
              width: 60px;
              margin: 0 auto 5px auto;
            }
            
            .signatory-name {
              font-size: 10px;
              color: #666;
              font-style: italic;
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
              <div class="company-name">${D.brand?.name||"Company"}</div>
              <div class="generated-date">Generated on ${new Date().toLocaleString()}</div>
              <div class="receipt-title">Stock Transfer Sheet</div>
            </div>
            
            <div class="order-info">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Order ID</span>
                  <span class="info-value">${D.id.slice(0,8)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Date (PST)</span>
                  <span class="info-value">${(0,h.iI)(D.created_at,{dateStyle:"short"})}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Location</span>
                  <span class="info-value">${D.location?.name||"N/A"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Status</span>
                  <span class="info-value">${D.status}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Logistics</span>
                  <span class="info-value">${"delivery"===D.delivery_type?"Delivery":"pickup"===D.delivery_type?"Pickup":"None"}</span>
                </div>
              </div>
            </div>
            
            <div class="items ${D.order_details.length>15?"items-multi-column":""}">
              ${D.order_details.length>15?`
                <div class="items-column">
                  <div class="items-header">
                    <div class="header-cell header-checkbox">✓</div>
                    <div class="header-cell header-item">Item</div>
                    <div class="header-cell header-qty">Quantity</div>
                    <div class="header-cell header-price">Price</div>
                    <div class="header-cell header-total">Total</div>
                  </div>
                  ${D.order_details.sort((e,t)=>{let a=e.products?.category&&""!==e.products.category.trim()?e.products.category:"Uncategorized",s=t.products?.category&&""!==t.products.category.trim()?t.products.category:"Uncategorized";return a.localeCompare(s)}).slice(0,Math.ceil(D.order_details.length/2)).map(e=>`
                    <div class="item-row">
                      <div class="item-checkbox">
                        <div class="checkbox"></div>
                      </div>
                      <div>
                        <div class="item-name">${e.products.name}</div>
                        <div class="item-details">
                          ${e.products.sku?`SKU: ${e.products.sku}`:""}
                        </div>
                      </div>
                      <div class="item-quantity">${e.quantity} ${e.products.unit}</div>
                      <div class="item-unit-price">₱${e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                      <div class="item-price">₱${(e.unit_price*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                    </div>
                  `).join("")}
                </div>
                <div class="items-column">
                  <div class="items-header">
                    <div class="header-cell header-checkbox">✓</div>
                    <div class="header-cell header-item">Item</div>
                    <div class="header-cell header-qty">Quantity</div>
                    <div class="header-cell header-price">Price</div>
                    <div class="header-cell header-total">Total</div>
                  </div>
                  ${D.order_details.sort((e,t)=>{let a=e.products?.category&&""!==e.products.category.trim()?e.products.category:"Uncategorized",s=t.products?.category&&""!==t.products.category.trim()?t.products.category:"Uncategorized";return a.localeCompare(s)}).slice(Math.ceil(D.order_details.length/2)).map(e=>`
                    <div class="item-row">
                      <div class="item-checkbox">
                        <div class="checkbox"></div>
                      </div>
                      <div>
                        <div class="item-name">${e.products.name}</div>
                        <div class="item-details">
                          ${e.products.sku?`SKU: ${e.products.sku}`:""}
                        </div>
                      </div>
                      <div class="item-quantity">${e.quantity} ${e.products.unit}</div>
                      <div class="item-unit-price">₱${e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                      <div class="item-price">₱${(e.unit_price*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                    </div>
                  `).join("")}
                </div>
              `:`
                <div class="items-header">
                  <div class="header-cell header-checkbox">✓</div>
                  <div class="header-cell header-item">Item</div>
                  <div class="header-cell header-qty">Quantity</div>
                  <div class="header-cell header-price">Price</div>
                  <div class="header-cell header-total">Total</div>
                </div>
                ${D.order_details.sort((e,t)=>{let a=e.products?.category&&""!==e.products.category.trim()?e.products.category:"Uncategorized",s=t.products?.category&&""!==t.products.category.trim()?t.products.category:"Uncategorized";return a.localeCompare(s)}).map(e=>`
                  <div class="item-row">
                    <div class="item-checkbox">
                      <div class="checkbox"></div>
                    </div>
                    <div>
                      <div class="item-name">${e.products.name}</div>
                      <div class="item-details">
                        ${e.products.sku?`SKU: ${e.products.sku}`:""}
                      </div>
                    </div>
                    <div class="item-quantity">${e.quantity} ${e.products.unit}</div>
                    <div class="item-unit-price">₱${e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                    <div class="item-price">₱${(e.unit_price*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                  </div>
                `).join("")}
              `}
            </div>
            
            ${D.notes?`
              <div class="notes">
                <div class="notes-title">Notes</div>
                <div class="notes-text">${D.notes}</div>
              </div>
            `:""}
            
            <div class="total-section">
              ${G(D).map(e=>`
                <div class="total-row">
                  <span class="total-label">${e.category}: ${e.totalQuantity} items</span>
                  <span class="total-value">₱${e.totalAmount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
              `).join("")}
              <div class="total-row">
                <span class="total-label">Subtotal</span>
                <span class="total-value">₱${getSubtotalAmount(D).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
              </div>
              ${"delivery"===D.delivery_type?`
                <div class="total-row">
                  <span class="total-label">Delivery Fee</span>
                  <span class="total-value">${getSubtotalAmount(D)>=1e4?"FREE (Order over ₱10k)":"+₱500.00"}</span>
                </div>
              `:""}
              ${"pickup"===D.delivery_type&&getSubtotalAmount(D)>=1e4?`
                <div class="total-row">
                  <span class="total-label">Pickup Discount (5%)</span>
                  <span class="total-value">-₱${(.05*getSubtotalAmount(D)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
              `:""}
              ${"pickup"===D.delivery_type&&1e4>getSubtotalAmount(D)?`
                <div class="total-row">
                  <span class="total-label">Pickup Discount</span>
                  <span class="total-value">Not available (Order under ₱10k)</span>
                </div>
              `:""}
              ${"none"===D.delivery_type?`
                <div class="total-row">
                  <span class="total-label">Logistics</span>
                  <span class="total-value">None (No discount, no delivery fee)</span>
                </div>
              `:""}
              <div class="total-row grand-total">
                <span class="total-label">Total Amount</span>
                <span class="total-value">₱${Q(D).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
              </div>
            </div>
            
            <div class="signatories">
              <div class="signatories-row">
                <div class="signatory-item">
                  <div class="signatory-label">Prepared by:</div>
                  <div class="signatory-line"></div>
                </div>
                <div class="signatory-item">
                  <div class="signatory-label">Delivered by:</div>
                  <div class="signatory-line"></div>
                </div>
                <div class="signatory-item">
                  <div class="signatory-label">Received by:</div>
                  <div class="signatory-line"></div>
                </div>
                <div class="signatory-item returned-pans">
                  <div class="signatory-label">Returned pans:</div>
                  <div class="signatory-line small"></div>
                </div>
              </div>
            </div>
            
          </div>
        </body>
        </html>
      `),e.document.close(),e.focus(),e.print(),e.close())},className:`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${"green"===a?"bg-green-100 text-green-700 hover:bg-green-200":"red"===a?"bg-red-100 text-red-700 hover:bg-red-200":"yellow"===a?"bg-yellow-100 text-yellow-700 hover:bg-yellow-200":"bg-blue-100 text-blue-700 hover:bg-blue-200"}`,children:[s.jsx(S.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Print Transfer Sheet"})]}),s.jsx("button",{onClick:()=>C(null),className:"text-gray-400 hover:text-gray-600",children:s.jsx(v.Z,{className:"h-6 w-6"})})]})]}),(0,s.jsxs)("div",{className:"space-y-6 flex-1 overflow-y-auto min-h-0",children:[(0,s.jsxs)("div",{className:"bg-gray-50 rounded-lg p-4",children:[(0,s.jsxs)("div",{className:"grid grid-cols-2 md:grid-cols-5 gap-4 text-center",children:[(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Created Date"}),s.jsx("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:(0,h.iI)(D.created_at,{dateStyle:"short",timeStyle:"short"})})]}),(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Status"}),s.jsx("span",{className:`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${"pending"===D.status?"bg-yellow-100 text-yellow-800":"approved"===D.status?"bg-blue-100 text-blue-800":"in-transit"===D.status?"bg-orange-100 text-orange-800":"verified"===D.status?"bg-green-100 text-green-800":"fulfilled"===D.status?"bg-orange-100 text-orange-800":"paid"===D.status?"bg-purple-100 text-purple-800":"complete"===D.status?"bg-indigo-100 text-indigo-800":"cancelled"===D.status?"bg-red-100 text-red-800":"bg-gray-100 text-gray-800"}`,children:D.status.charAt(0).toUpperCase()+D.status.slice(1)})]}),(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Logistics"}),s.jsx("span",{className:`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${"delivery"===D.delivery_type?"bg-blue-100 text-blue-800":"bg-green-100 text-green-800"}`,children:"delivery"===D.delivery_type?"Delivery":"Pickup"})]}),(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Location"}),(0,s.jsxs)("div",{className:"flex items-center space-x-1 mt-1",children:[D.location?.company_owned?s.jsx("div",{title:"Company Owned",children:s.jsx(w.Z,{className:"h-4 w-4 text-blue-600"})}):s.jsx("div",{title:"Franchise",children:s.jsx(N.Z,{className:`h-4 w-4 ${getFranchiseIconColor()}`})}),s.jsx("p",{className:"text-sm font-semibold text-gray-900",children:D.location?.name||"N/A"})]})]}),(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Total Amount"}),(0,s.jsxs)("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:["₱",Q(D).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]}),(0,s.jsxs)("div",{className:"mt-4 pt-4 border-t border-gray-200",children:[(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide mb-2",children:"Category Totals"}),s.jsx("div",{className:"grid grid-cols-2 md:grid-cols-3 gap-2",children:G(D).map((e,t)=>(0,s.jsxs)("div",{className:"bg-white rounded p-2 border text-center",children:[s.jsx("p",{className:"text-xs font-medium text-gray-900",children:e.category}),(0,s.jsxs)("p",{className:"text-xs text-gray-600",children:[e.totalQuantity," items"]}),(0,s.jsxs)("p",{className:"text-xs font-semibold text-green-600",children:["₱",e.totalAmount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]},t))})]}),(0,s.jsxs)("div",{className:"mt-4 pt-4 border-t border-gray-200",children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide mb-2",children:"Pricing Breakdown"}),(0,s.jsxs)("div",{className:"bg-white rounded p-3 space-y-2",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-sm text-gray-600",children:"Subtotal:"}),(0,s.jsxs)("span",{className:"text-sm text-gray-900",children:["₱",getSubtotalAmount(D).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"delivery"===D.delivery_type&&(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-sm text-gray-600",children:"Delivery Fee:"}),getSubtotalAmount(D)>=1e4?s.jsx("span",{className:"text-sm text-green-600",children:"FREE (Order over ₱10k)"}):s.jsx("span",{className:"text-sm text-gray-900",children:"+₱500.00"})]}),"pickup"===D.delivery_type&&getSubtotalAmount(D)>=1e4&&(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-sm text-gray-600",children:"Pickup Discount (5%):"}),(0,s.jsxs)("span",{className:"text-sm text-green-600",children:["-₱",(.05*getSubtotalAmount(D)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"pickup"===D.delivery_type&&1e4>getSubtotalAmount(D)&&(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-sm text-gray-500",children:"Pickup Discount:"}),s.jsx("span",{className:"text-sm text-gray-500",children:"Not available (Order under ₱10k)"})]}),(0,s.jsxs)("div",{className:"flex justify-between items-center pt-2 border-t border-gray-200",children:[s.jsx("span",{className:"text-sm font-semibold text-gray-900",children:"Total Amount:"}),(0,s.jsxs)("span",{className:"text-sm font-semibold text-green-600",children:["₱",Q(D).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]})]})]})]}),D.notes&&(0,s.jsxs)("div",{className:"bg-white border rounded-lg p-4",children:[s.jsx("h4",{className:"text-sm font-semibold text-gray-900 mb-2",children:"Notes"}),s.jsx("p",{className:"text-sm text-gray-700",children:D.notes})]}),D.order_details&&D.order_details.length>0&&(0,s.jsxs)("div",{className:"bg-white border rounded-lg overflow-hidden",children:[s.jsx("div",{className:"px-4 py-3 bg-gray-50 border-b",children:(0,s.jsxs)("h4",{className:"text-sm font-semibold text-gray-900",children:["Order Items (",D.order_details.length,")"]})}),s.jsx("div",{className:"overflow-x-auto",children:(0,s.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:(0,s.jsxs)("tr",{children:[s.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Product"}),s.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Quantity"}),s.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Price"}),s.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Total"})]})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:D.order_details.sort((e,t)=>{let a=(e.products.category||"").localeCompare(t.products.category||"");return 0!==a?a:e.products.name.localeCompare(t.products.name)}).map(e=>(0,s.jsxs)("tr",{className:"hover:bg-gray-50",children:[s.jsx("td",{className:"px-4 py-3 whitespace-nowrap",children:(0,s.jsxs)("div",{children:[s.jsx("div",{className:"text-sm font-medium text-gray-900",children:e.products.name}),e.products.sku&&(0,s.jsxs)("div",{className:"text-xs text-gray-500",children:["SKU: ",e.products.sku]})]})}),(0,s.jsxs)("td",{className:"px-4 py-3 whitespace-nowrap text-sm text-gray-900",children:[e.quantity," ",e.products.unit]}),(0,s.jsxs)("td",{className:"px-4 py-3 whitespace-nowrap text-sm text-gray-900",children:["₱",e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,s.jsxs)("td",{className:"px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900",children:["₱",(e.unit_price*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]},e.id))})]})})]})]})]})}),P&&$&&s.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,s.jsxs)("div",{className:"relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 xl:w-2/3 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col overflow-hidden",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center mb-4 flex-shrink-0",children:[(0,s.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Override Order #",$.id.slice(0,8)]}),s.jsx("button",{onClick:()=>{O(!1),F(null),q(null)},className:"text-gray-400 hover:text-gray-600",children:s.jsx(v.Z,{className:"h-6 w-6"})})]}),(0,s.jsxs)("div",{className:"space-y-6 flex-1 overflow-y-auto min-h-0",children:[(0,s.jsxs)("div",{className:"grid grid-cols-1 lg:grid-cols-2 gap-6",children:[(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Logistics Method"}),(0,s.jsxs)("div",{className:"flex space-x-4",children:[(0,s.jsxs)("label",{className:"flex items-center",children:[s.jsx("input",{type:"radio",name:"delivery_type",value:"delivery",checked:"delivery"===$.delivery_type,onChange:e=>F({...$,delivery_type:e.target.value}),className:"mr-2"}),s.jsx("span",{className:"text-sm",children:"Delivery"})]}),(0,s.jsxs)("label",{className:"flex items-center",children:[s.jsx("input",{type:"radio",name:"delivery_type",value:"pickup",checked:"pickup"===$.delivery_type,onChange:e=>F({...$,delivery_type:e.target.value}),className:"mr-2"}),s.jsx("span",{className:"text-sm",children:"Pickup"})]}),(0,s.jsxs)("label",{className:"flex items-center",children:[s.jsx("input",{type:"radio",name:"delivery_type",value:"none",checked:"none"===$.delivery_type,onChange:e=>F({...$,delivery_type:e.target.value}),className:"mr-2"}),s.jsx("span",{className:"text-sm",children:"None (No discount, no delivery fee)"})]})]})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Category Summary"}),s.jsx("div",{className:"flex flex-wrap gap-2",children:(()=>{let e=$.order_details.reduce((e,t)=>{let a=t.products?.category||"Uncategorized";return e[a]||(e[a]={quantity:0,amount:0}),e[a].quantity+=t.quantity,e[a].amount+=t.unit_price*t.quantity,e},{});return Object.entries(e).map(([e,t])=>(0,s.jsxs)("div",{className:"bg-gray-100 px-3 py-1 rounded-full text-xs",children:[(0,s.jsxs)("span",{className:"font-medium text-gray-900",children:[e,":"]}),(0,s.jsxs)("span",{className:"text-gray-600 ml-1",children:[t.quantity," items"]}),(0,s.jsxs)("span",{className:"text-green-600 ml-1",children:["₱",t.amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]},e))})()})]})]}),(0,s.jsxs)("div",{className:"grid grid-cols-1 lg:grid-cols-2 gap-6",children:[(0,s.jsxs)("div",{children:[s.jsx("h4",{className:"text-md font-medium text-gray-900 mb-3",children:"Current Order Items"}),s.jsx("div",{className:"max-h-96 overflow-y-auto space-y-2",children:$.order_details.map(e=>(0,s.jsxs)("div",{className:"flex items-center justify-between p-3 bg-gray-50 rounded-lg",children:[(0,s.jsxs)("div",{className:"flex-1",children:[s.jsx("div",{className:"font-medium text-gray-900",children:e.products?.product_name||e.products?.name||"Unknown Product"}),(0,s.jsxs)("div",{className:"text-sm text-gray-500",children:["₱",e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})," each"]})]}),(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx("button",{onClick:()=>updateProductQuantity(e.product_id,e.quantity-1),className:"px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200",children:"-"}),s.jsx("span",{className:"w-12 text-center text-gray-900",children:e.quantity}),s.jsx("button",{onClick:()=>updateProductQuantity(e.product_id,e.quantity+1),disabled:!canIncreaseQuantity(e.product_id),className:`px-2 py-1 text-sm rounded ${canIncreaseQuantity(e.product_id)?"bg-green-100 text-green-700 hover:bg-green-200":"bg-gray-100 text-gray-400 cursor-not-allowed"}`,children:"+"}),s.jsx("button",{onClick:()=>removeProductFromOrder(e.product_id),className:"px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 ml-2",children:"Remove"})]})]},e.id))})]}),(0,s.jsxs)("div",{children:[s.jsx("h4",{className:"text-md font-medium text-gray-900 mb-3",children:"Add Products"}),s.jsx("div",{className:"max-h-96 overflow-y-auto space-y-4",children:(()=>{let e=E.reduce((e,t)=>{let a=t.category||"Uncategorized";return e[a]||(e[a]=[]),e[a].push(t),e},{});return Object.entries(e).map(([e,t])=>(0,s.jsxs)("div",{className:"space-y-2",children:[s.jsx("h5",{className:"text-sm font-semibold text-gray-700 border-b border-gray-200 pb-1",children:e}),s.jsx("div",{className:"grid grid-cols-3 gap-2",children:t.map((t,a)=>{let r=canAddProduct(t),l=A?.order_details.find(e=>e.product_id===t.id)?.quantity||0,i=(t.available_stock||0)+l,n=$?.order_details.some(e=>e.product_id===(t.product_id||t.id));return s.jsx("button",{onClick:()=>r&&addProductToOrder(t),disabled:!r,className:`p-3 text-left border rounded text-sm w-full ${n?"border-orange-400 bg-orange-50 hover:bg-orange-100":r?"border-gray-200 hover:bg-gray-50":"border-gray-100 bg-gray-50 cursor-not-allowed"}`,children:(0,s.jsxs)("div",{className:"flex justify-between items-start",children:[(0,s.jsxs)("div",{className:"flex-1",children:[s.jsx("div",{className:`font-medium ${r?"text-gray-900":"text-gray-400"}`,children:t.product_name||t.name}),(0,s.jsxs)("div",{className:`${r?"text-gray-500":"text-gray-400"}`,children:["₱",(t.price||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,s.jsxs)("div",{className:`text-xs ${r?"text-gray-400":"text-gray-300"}`,children:["Available: ",i," / ",t.initial_stock]})]}),n&&s.jsx("div",{className:"ml-2",children:s.jsx("span",{className:"inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800",children:"In Order"})})]})},t.id||`product-${e}-${a}`)})})]},e))})()})]})]}),(0,s.jsxs)("div",{className:"bg-gray-50 p-4 rounded-lg",children:[s.jsx("h4",{className:"text-md font-medium text-gray-900 mb-3",children:"Order Summary"}),(0,s.jsxs)("div",{className:"flex justify-between items-center mb-2",children:[s.jsx("span",{className:"text-sm text-gray-600",children:"Subtotal:"}),(0,s.jsxs)("span",{className:"text-sm font-medium text-gray-900",children:["₱",$.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"delivery"===$.delivery_type&&(0,s.jsxs)("div",{className:"flex justify-between items-center mb-2",children:[s.jsx("span",{className:"text-sm text-gray-600",children:"Delivery Fee:"}),s.jsx("span",{className:"text-sm font-medium text-gray-900",children:$.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0)>=1e4?"FREE (Order over ₱10k)":"+₱500.00"})]}),"pickup"===$.delivery_type&&$.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0)>=1e4&&(0,s.jsxs)("div",{className:"flex justify-between items-center mb-2",children:[s.jsx("span",{className:"text-sm text-gray-600",children:"Pickup Discount (5%):"}),(0,s.jsxs)("span",{className:"text-sm font-medium text-green-600",children:["-₱",(.05*$.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"pickup"===$.delivery_type&&1e4>$.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0)&&(0,s.jsxs)("div",{className:"flex justify-between items-center mb-2",children:[s.jsx("span",{className:"text-sm text-gray-600",children:"Pickup Discount:"}),s.jsx("span",{className:"text-sm font-medium text-gray-500",children:"Not available (Order under ₱10k)"})]}),"none"===$.delivery_type&&(0,s.jsxs)("div",{className:"flex justify-between items-center mb-2",children:[s.jsx("span",{className:"text-sm text-gray-600",children:"Logistics:"}),s.jsx("span",{className:"text-sm font-medium text-gray-500",children:"None (No discount, no delivery fee)"})]}),(0,s.jsxs)("div",{className:"flex justify-between items-center pt-2 border-t border-gray-300",children:[s.jsx("span",{className:"text-lg font-medium text-gray-900",children:"Total Amount:"}),(0,s.jsxs)("span",{className:"text-lg font-bold text-green-600",children:["₱",calculateOverrideTotal().toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]})]}),(0,s.jsxs)("div",{className:"flex justify-end space-x-3 pt-4 border-t bg-gray-50 -mx-5 -mb-5 px-5 pb-5 flex-shrink-0",children:[s.jsx("button",{onClick:()=>{O(!1),F(null),q(null)},className:"px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200",children:"Cancel"}),s.jsx("button",{onClick:()=>{F({...$,total_amount:calculateOverrideTotal()}),handleSaveOverride()},disabled:M,className:"px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50",children:M?"Saving...":"Save Changes"})]})]})}),H&&U&&s.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,s.jsxs)("div",{className:"relative top-4 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center mb-4 flex-shrink-0",children:[(0,s.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Returnable Pans Image",(()=>{let e=V?.order_details?.filter(e=>{if(!V?.brand&&!V?.location?.brand)return!1;let t=(V?.brand?.slug||V?.location?.brand?.slug)?.toLowerCase(),a=e.products?.category?.toLowerCase()||"";switch(t){case"gelatofilipino":return"gelato"===a;case"mychoice":return"ice cream"===a;case"mang-sorbetes":return"sorbetes"===a;default:return!1}})||[],t=e.reduce((e,t)=>e+t.quantity,0);return t>0?` (${t} pans)`:""})()]}),s.jsx("button",{onClick:()=>{B(!1),W(null),Y(null)},className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]}),s.jsx("div",{className:"text-center flex-1 flex items-center justify-center overflow-auto",children:s.jsx("img",{src:U,alt:"Returnable pans",className:"max-h-[70vh] w-auto rounded-lg border"})})]})})]})}var D=a(6388);function BranchManager({selectedBrand:e,theme:t="blue"}){let[a,r]=(0,i.useState)([]),[l,n]=(0,i.useState)([]),[o,c]=(0,i.useState)(!1),[b,f]=(0,i.useState)(!1),[y,v]=(0,i.useState)(null),[j,w]=(0,i.useState)(null),[N,k]=(0,i.useState)([]),[C,P]=(0,i.useState)(!1),[O,$]=(0,i.useState)(!1),[F,A]=(0,i.useState)(null),[q,E]=(0,i.useState)(!1),[L,M]=(0,i.useState)(null),[T,I]=(0,i.useState)(!1),[R,z]=(0,i.useState)(null),[Z,H]=(0,i.useState)(null),[B,U]=(0,i.useState)({name:"",passkey:"",franchisee:"",contact_number:"",company_owned:!1,can_access_order_features:!1,is_remote:!1,brand_id:e?.id||""});(0,i.useEffect)(()=>{e&&(loadData(),U(t=>({...t,brand_id:e.id})),P(!1),w(null),k([]),$(!1),A(null))},[e]),(0,i.useEffect)(()=>{if(!e)return;let t=d.O.channel("branch-orders-changes").on("postgres_changes",{event:"*",schema:"public",table:"customer_orders",filter:`brand_id=eq.${e.id}`},e=>{console.log("Branch orders realtime update:",e),C&&j&&fetchLocationOrders(j.id)}).subscribe();return()=>{d.O.removeChannel(t)}},[e,C,j]);let loadData=async()=>{if(e){c(!0);try{let[t,a]=await Promise.all([d.O.from("locations").select(`
            *,
            brand:brands(*)
          `).eq("brand_id",e.id).order("name"),d.O.from("brands").select("*").order("name")]);t.error?console.error("Error fetching locations:",t.error):t.data&&r(t.data),a.error?console.error("Error fetching brands:",a.error):a.data&&n(a.data)}catch(e){console.error("Error loading data:",e)}finally{c(!1)}}},handleAddLocation=async t=>{if(t.preventDefault(),!B.name||!B.passkey||!B.franchisee||!B.contact_number){alert("Please fill in all required fields");return}try{let{data:t,error:s}=await d.O.from("locations").insert([B]).select();if(s){console.error("Error adding location:",s),alert("Error adding location");return}t&&(r([...a,t[0]]),U({name:"",passkey:"",franchisee:"",contact_number:"",company_owned:!1,can_access_order_features:!1,is_remote:!1,brand_id:e?.id||""}),f(!1))}catch(e){console.error("Error adding location:",e),alert("Error adding location")}},handleUpdateLocation=async e=>{try{let{data:t,error:s}=await d.O.from("locations").update({name:e.name,passkey:e.passkey,franchisee:e.franchisee,contact_number:e.contact_number,company_owned:e.company_owned,can_access_order_features:e.can_access_order_features,is_remote:e.is_remote,brand_id:e.brand_id,updated_at:new Date().toISOString()}).eq("id",e.id).select();if(s){console.error("Error updating location:",s),alert("Error updating location");return}t&&(r(a.map(a=>a.id===e.id?{...t[0],brand:e.brand}:a)),v(null))}catch(e){console.error("Error updating location:",e),alert("Error updating location")}},handleDeleteLocation=async e=>{if(confirm("Are you sure you want to delete this location?"))try{let{error:t}=await d.O.from("locations").delete().eq("id",e);if(t){console.error("Error deleting location:",t),alert("Error deleting location");return}r(a.filter(t=>t.id!==e))}catch(e){console.error("Error deleting location:",e),alert("Error deleting location")}},fetchLocationOrders=async e=>{c(!0);try{let{data:t,error:a}=await d.O.from("customer_orders").select(`
          *,
          location:locations(*),
          brand:brands(*),
          order_details(
            *,
            product:products(id, name, sku, unit, category)
          )
        `).eq("location_id",e).order("created_at",{ascending:!1});if(a){console.error("Error fetching orders:",a);return}t&&k(t)}catch(e){console.error("Error fetching orders:",e)}finally{c(!1)}},handleViewOrderHistory=async e=>{w(e),P(!0),await fetchLocationOrders(e.id)},W=(0,i.useCallback)(e=>e.reduce((e,t)=>e+(t.total_amount||0),0),[]),V=(0,i.useCallback)(e=>e.filter(e=>"paid"===e.status||"complete"===e.status).reduce((e,t)=>e+(t.total_amount||0),0),[]),Y=(0,i.useCallback)(e=>e.filter(e=>"fulfilled"===e.status).reduce((e,t)=>e+(t.total_amount||0),0),[]),copyToClipboard=async e=>{try{await navigator.clipboard.writeText(e),console.log("Passkey copied to clipboard:",e)}catch(a){console.error("Failed to copy passkey:",a);let t=document.createElement("textarea");t.value=e,document.body.appendChild(t),t.select(),document.execCommand("copy"),document.body.removeChild(t)}},getReturnablePans=e=>{if(!e||!e.order_details)return{total:0,hasImage:!1};let t=e.order_details.filter(t=>{if(!e.brand&&!e.location?.brand)return!1;let a=(e.brand?.slug||e.location?.brand?.slug)?.toLowerCase(),s=t.product?.category?.toLowerCase()||"";switch(a){case"gelatofilipino":return"gelato"===s;case"mychoice":return"ice cream"===s;case"mang-sorbetes":return"sorbetes"===s;default:return!1}}),a=t.reduce((e,t)=>e+t.quantity,0),s=!!e.returnable_pans_image_url;return{total:a,hasImage:s}},getStatusBadge=e=>s.jsx("span",{className:`px-2 py-1 rounded-full text-xs font-medium ${{pending:"bg-yellow-100 text-yellow-800",approved:"bg-blue-100 text-blue-800",fulfilled:"bg-green-100 text-green-800",cancelled:"bg-red-100 text-red-800"}[e]||"bg-gray-100 text-gray-800"}`,children:e.charAt(0).toUpperCase()+e.slice(1)});(0,i.useCallback)(e=>e.order_details.reduce((e,t)=>e+t.quantity,0),[]),(0,i.useCallback)(e=>e.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0),[]);let G=(0,i.useCallback)(e=>e.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0),[]),Q=(0,i.useCallback)(e=>{let t=new Map;return e.order_details.forEach(e=>{let a=e.product?.category||"Uncategorized",s=t.get(a)||{category:a,totalQuantity:0,totalAmount:0};s.totalQuantity+=e.quantity,s.totalAmount+=e.unit_price*e.quantity,t.set(a,s)}),Array.from(t.values())},[]),handleViewDetails=e=>{A(e),$(!0)},handlePrintReceipt=e=>{let t=window.open("","_blank");t&&(t.document.write(`
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
              padding: 12px 20px;
              background: white;
              color: black;
              border-bottom: 2px solid black;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .company-name { 
              font-size: 23px; 
              font-weight: bold; 
              color: black;
            }
            
            .receipt-title { 
              font-size: 15px; 
              font-weight: normal; 
              color: black;
            }
            
            .generated-date {
              font-size: 10px;
              color: #6b7280;
              text-align: center;
              flex: 1;
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
            .status-fulfilled { background: black; color: white; }
            .status-cancelled { background: white; color: black; }
            
            .items { 
              padding: 8px 12px;
              flex: 1;
            }
            
            .items-multi-column {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            
            .items-column {
              display: flex;
              flex-direction: column;
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
              width: 10px;
              height: 10px;
              border: 1px solid black;
              background: white;
              cursor: pointer;
            }
            
            .item-row {
              display: grid;
              grid-template-columns: 20px 2fr 1fr 1fr 1fr;
              gap: 4px;
              align-items: center;
              padding: 1px 0;
              border-bottom: 1px solid #ccc;
              font-size: 9px;
              min-height: 16px;
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
              <div class="company-name">${e.brand?.name||"Company"}</div>
              <div class="generated-date">Generated on ${new Date().toLocaleString()}</div>
              <div class="receipt-title">Stock Transfer Sheet</div>
          </div>
          
          <div class="order-info">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Order ID</span>
                  <span class="info-value">${e.id.slice(0,8)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Date (PST)</span>
                  <span class="info-value">${(0,h.iI)(e.created_at,{dateStyle:"short"})}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Location</span>
                  <span class="info-value">${e.location?.name||"N/A"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Franchisee</span>
                  <span class="info-value">${e.location?.franchisee||"N/A"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Logistics</span>
                  <span class="info-value">${"delivery"===e.delivery_type?"Delivery":"Pickup"}</span>
                </div>
              </div>
          </div>
          
          <div class="items ${e.order_details.length>15?"items-multi-column":""}">
              ${e.order_details.length>15?`
                <div class="items-column">
                  <div class="items-header">
                    <div class="header-cell header-checkbox">✓</div>
                    <div class="header-cell header-item">Item</div>
                    <div class="header-cell header-qty">Quantity</div>
                    <div class="header-cell header-price">Price</div>
                    <div class="header-cell header-total">Total</div>
                  </div>
                  ${e.order_details.sort((e,t)=>{let a=e.product?.category&&""!==e.product.category.trim()?e.product.category:"Uncategorized",s=t.product?.category&&""!==t.product.category.trim()?t.product.category:"Uncategorized";return a.localeCompare(s)}).slice(0,Math.ceil(e.order_details.length/2)).map(e=>`
                    <div class="item-row">
                      <div class="item-checkbox">
                        <div class="checkbox"></div>
                      </div>
                      <div>
                        <div class="item-name">${e.product.name}</div>
                        <div class="item-details">
                          ${e.product.sku?`SKU: ${e.product.sku}`:""}
                        </div>
                      </div>
                      <div class="item-quantity">${e.quantity} ${e.product.unit}</div>
                      <div class="item-unit-price">₱${e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                      <div class="item-price">₱${(e.unit_price*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                    </div>
                  `).join("")}
                </div>
                <div class="items-column">
                  <div class="items-header">
                    <div class="header-cell header-checkbox">✓</div>
                    <div class="header-cell header-item">Item</div>
                    <div class="header-cell header-qty">Quantity</div>
                    <div class="header-cell header-price">Price</div>
                    <div class="header-cell header-total">Total</div>
                  </div>
                  ${e.order_details.sort((e,t)=>{let a=e.product?.category&&""!==e.product.category.trim()?e.product.category:"Uncategorized",s=t.product?.category&&""!==t.product.category.trim()?t.product.category:"Uncategorized";return a.localeCompare(s)}).slice(Math.ceil(e.order_details.length/2)).map(e=>`
                    <div class="item-row">
                      <div class="item-checkbox">
                        <div class="checkbox"></div>
                      </div>
                      <div>
                        <div class="item-name">${e.product.name}</div>
                        <div class="item-details">
                          ${e.product.sku?`SKU: ${e.product.sku}`:""}
                        </div>
                      </div>
                      <div class="item-quantity">${e.quantity} ${e.product.unit}</div>
                      <div class="item-unit-price">₱${e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                      <div class="item-price">₱${(e.unit_price*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                    </div>
                  `).join("")}
                </div>
              `:`
                <div class="items-header">
                  <div class="header-cell header-checkbox">✓</div>
                  <div class="header-cell header-item">Item</div>
                  <div class="header-cell header-qty">Quantity</div>
                  <div class="header-cell header-price">Price</div>
                  <div class="header-cell header-total">Total</div>
                </div>
                ${e.order_details.sort((e,t)=>{let a=e.product?.category&&""!==e.product.category.trim()?e.product.category:"Uncategorized",s=t.product?.category&&""!==t.product.category.trim()?t.product.category:"Uncategorized";return a.localeCompare(s)}).map(e=>`
                  <div class="item-row">
                    <div class="item-checkbox">
                      <div class="checkbox"></div>
                    </div>
                    <div>
                      <div class="item-name">${e.product.name}</div>
                      <div class="item-details">
                        ${e.product.sku?`SKU: ${e.product.sku}`:""}
                      </div>
                    </div>
                    <div class="item-quantity">${e.quantity} ${e.product.unit}</div>
                    <div class="item-unit-price">₱${e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                    <div class="item-price">₱${(e.unit_price*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                  </div>
                `).join("")}
              `}
          </div>
          
            ${e.notes?`
              <div class="notes">
                <div class="notes-title">Notes</div>
                <div class="notes-text">${e.notes}</div>
              </div>
            `:""}
            
            <div class="total-section">
              ${Q(e).map(e=>`
                <div class="total-row">
                  <span class="total-label">${e.category}: ${e.totalQuantity} items</span>
                  <span class="total-value">₱${e.totalAmount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
              `).join("")}
              <div class="total-row">
                <span class="total-label">Subtotal</span>
                <span class="total-value">₱${G(e).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
              </div>
              ${"delivery"===e.delivery_type?`
                <div class="total-row">
                  <span class="total-label">Delivery Fee</span>
                  <span class="total-value">${G(e)>=1e4?"FREE (Order over ₱10k)":"+₱500.00"}</span>
                </div>
              `:""}
              ${"pickup"===e.delivery_type&&G(e)>=1e4?`
                <div class="total-row">
                  <span class="total-label">Pickup Discount (5%)</span>
                  <span class="total-value">-₱${(.05*G(e)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
              `:""}
              ${"pickup"===e.delivery_type&&1e4>G(e)?`
                <div class="total-row">
                  <span class="total-label">Pickup Discount</span>
                  <span class="total-value">Not available (Order under ₱10k)</span>
                </div>
              `:""}
              <div class="total-row grand-total">
                <span class="total-label">Total Amount</span>
                <span class="total-value">₱${e.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
              </div>
          </div>
          
          </div>
        </body>
        </html>
      `),t.document.close(),t.focus(),t.print(),t.close())};return C&&j?(0,s.jsxs)("div",{className:"space-y-6",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between",children:[(0,s.jsxs)("div",{children:[s.jsx("h3",{className:"text-xl font-semibold text-gray-900",children:"Order History"}),s.jsx("p",{className:"text-gray-600",children:j.name})]}),(0,s.jsxs)("button",{onClick:()=>{P(!1),w(null)},className:"flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors shadow-sm",children:[s.jsx(x.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Back to Branches"})]})]}),(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:[s.jsx("h4",{className:"text-lg font-medium mb-4",children:"Branch Summary"}),(0,s.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-4 gap-4",children:[(0,s.jsxs)("div",{className:"bg-blue-50 p-4 rounded-lg",children:[s.jsx("p",{className:"text-sm text-blue-600 font-medium",children:"Total Orders"}),s.jsx("p",{className:"text-2xl font-bold text-blue-900",children:N.length})]}),(0,s.jsxs)("div",{className:"bg-green-50 p-4 rounded-lg",children:[s.jsx("p",{className:"text-sm text-green-600 font-medium",children:"Total Revenue"}),(0,s.jsxs)("p",{className:"text-2xl font-bold text-green-900",children:["₱",W(N).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),(0,s.jsxs)("div",{className:"bg-purple-50 p-4 rounded-lg",children:[s.jsx("p",{className:"text-sm text-purple-600 font-medium",children:"Total Paid"}),(0,s.jsxs)("p",{className:"text-2xl font-bold text-purple-900",children:["₱",V(N).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),(0,s.jsxs)("div",{className:"bg-orange-50 p-4 rounded-lg",children:[s.jsx("p",{className:"text-sm text-orange-600 font-medium",children:"Total Receivable"}),(0,s.jsxs)("p",{className:"text-2xl font-bold text-orange-900",children:["₱",Y(N).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]})]}),o?s.jsx("div",{className:"flex items-center justify-center py-12",children:s.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"})}):s.jsx("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden",children:s.jsx("div",{className:"overflow-x-auto",children:(0,s.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:(0,s.jsxs)("tr",{children:[s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Order ID"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Date"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Customer"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Status"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Amount"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Returnable Pans"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Deposit Slip"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Actions"})]})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:N.map(e=>(0,s.jsxs)("tr",{className:"hover:bg-blue-100",children:[(0,s.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900",children:[e.id.slice(0,8),"..."]}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:new Date(e.created_at).toLocaleDateString()}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:j.name}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:getStatusBadge(e.status)}),(0,s.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600",children:["₱",e.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:(()=>{let t=getReturnablePans(e);return t.total>0&&t.hasImage?(0,s.jsxs)("button",{onClick:()=>{z(e.returnable_pans_image_url),H(e),I(!0)},className:"text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer",title:"Click to view returnable pans image",children:[t.total," pans"]}):t.total>0?(0,s.jsxs)("span",{className:"text-red-600 font-medium",children:[t.total," pans"]}):s.jsx("span",{className:"text-gray-400",children:"-"})})()}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:e.deposit_slip_url?s.jsx("button",{onClick:()=>{M(e.deposit_slip_url),E(!0)},className:"text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer",children:"View"}):s.jsx("span",{className:"text-gray-400",children:"N/A"})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:(0,s.jsxs)("div",{className:"flex space-x-2",children:[s.jsx("button",{onClick:()=>handleViewDetails(e),className:"p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out",title:"View Details",children:s.jsx(_.Z,{className:"h-4 w-4"})}),s.jsx("button",{onClick:()=>handlePrintReceipt(e),className:"p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out",title:"Print Receipt",children:s.jsx(S.Z,{className:"h-4 w-4"})})]})})]},e.id))})]})})}),O&&F&&s.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,s.jsxs)("div",{className:"relative top-4 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col overflow-hidden",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center mb-4 flex-shrink-0",children:[(0,s.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Order Details #",F.id.slice(0,8)]}),(0,s.jsxs)("div",{className:"flex space-x-2",children:[(0,s.jsxs)("button",{onClick:()=>handlePrintReceipt(F),className:`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${"green"===t?"bg-green-100 text-green-700 hover:bg-green-200":"red"===t?"bg-red-100 text-red-700 hover:bg-red-200":"yellow"===t?"bg-yellow-100 text-yellow-700 hover:bg-yellow-200":"bg-blue-100 text-blue-700 hover:bg-blue-200"}`,children:[s.jsx(S.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Print Transfer Sheet"})]}),s.jsx("button",{onClick:()=>{$(!1),A(null)},className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]})]}),(0,s.jsxs)("div",{className:"space-y-6 flex-1 overflow-y-auto min-h-0",children:[(0,s.jsxs)("div",{className:"bg-gray-50 rounded-lg p-4",children:[(0,s.jsxs)("div",{className:"grid grid-cols-2 md:grid-cols-5 gap-4 text-center",children:[(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Created Date"}),s.jsx("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:(0,h.iI)(F.created_at,{dateStyle:"short",timeStyle:"short"})})]}),(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Status"}),s.jsx("span",{className:`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${"pending"===F.status?"bg-yellow-100 text-yellow-800":"approved"===F.status?"bg-blue-100 text-blue-800":"fulfilled"===F.status?"bg-orange-100 text-orange-800":"paid"===F.status?"bg-purple-100 text-purple-800":"complete"===F.status?"bg-indigo-100 text-indigo-800":"bg-gray-100 text-gray-800"}`,children:F.status.charAt(0).toUpperCase()+F.status.slice(1)})]}),(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Logistics"}),s.jsx("span",{className:`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${"delivery"===F.delivery_type?"bg-blue-100 text-blue-800":"bg-green-100 text-green-800"}`,children:"delivery"===F.delivery_type?"Delivery":"Pickup"})]}),(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Location"}),s.jsx("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:F.location?.name||"N/A"})]}),(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Total Amount"}),(0,s.jsxs)("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:["₱",F.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]}),(0,s.jsxs)("div",{className:"mt-4 pt-4 border-t border-gray-200",children:[(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide mb-2",children:"Category Totals"}),s.jsx("div",{className:"grid grid-cols-2 md:grid-cols-3 gap-2",children:Q(F).map((e,t)=>(0,s.jsxs)("div",{className:"bg-white rounded p-2 border text-center",children:[s.jsx("p",{className:"text-xs font-medium text-gray-900",children:e.category}),(0,s.jsxs)("p",{className:"text-xs text-gray-600",children:[e.totalQuantity," items"]}),(0,s.jsxs)("p",{className:"text-xs font-semibold text-green-600",children:["₱",e.totalAmount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]},t))})]}),(0,s.jsxs)("div",{className:"mt-4 pt-4 border-t border-gray-200",children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide mb-2",children:"Pricing Breakdown"}),(0,s.jsxs)("div",{className:"bg-white rounded p-3 space-y-2",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-sm text-gray-600",children:"Subtotal:"}),(0,s.jsxs)("span",{className:"text-sm text-gray-900",children:["₱",G(F).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"delivery"===F.delivery_type&&(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-sm text-gray-600",children:"Delivery Fee:"}),G(F)>=1e4?s.jsx("span",{className:"text-sm text-green-600",children:"FREE (Order over ₱10k)"}):s.jsx("span",{className:"text-sm text-gray-900",children:"+₱500.00"})]}),"pickup"===F.delivery_type&&G(F)>=1e4&&(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-sm text-gray-600",children:"Pickup Discount (5%):"}),(0,s.jsxs)("span",{className:"text-sm text-green-600",children:["-₱",(.05*G(F)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"pickup"===F.delivery_type&&1e4>G(F)&&(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-sm text-gray-500",children:"Pickup Discount:"}),s.jsx("span",{className:"text-sm text-gray-500",children:"Not available (Order under ₱10k)"})]}),(0,s.jsxs)("div",{className:"flex justify-between items-center border-t pt-2",children:[s.jsx("span",{className:"text-sm font-semibold text-gray-900",children:"Total Amount:"}),(0,s.jsxs)("span",{className:"text-sm font-semibold text-green-600",children:["₱",F.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]})]})]})]}),F.notes&&(0,s.jsxs)("div",{className:"bg-white border rounded-lg p-4",children:[s.jsx("h4",{className:"text-sm font-semibold text-gray-900 mb-2",children:"Notes"}),s.jsx("p",{className:"text-sm text-gray-600",children:F.notes})]}),(0,s.jsxs)("div",{className:"bg-white border rounded-lg overflow-hidden",children:[s.jsx("div",{className:"px-4 py-3 bg-gray-50 border-b",children:s.jsx("h4",{className:"text-sm font-semibold text-gray-900",children:"Order Items"})}),s.jsx("div",{className:"overflow-x-auto",children:(0,s.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:(0,s.jsxs)("tr",{children:[s.jsx("th",{className:"px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Product"}),s.jsx("th",{className:"px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"SKU"}),s.jsx("th",{className:"px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Unit"}),s.jsx("th",{className:"px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Qty"}),s.jsx("th",{className:"px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Price"}),s.jsx("th",{className:"px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Total"})]})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:F.order_details?.sort((e,t)=>{let a=(e.product?.category||"").localeCompare(t.product?.category||"");return 0!==a?a:(e.product?.name||"").localeCompare(t.product?.name||"")})?.map((e,t)=>s.jsxs("tr",{children:[s.jsx("td",{className:"px-4 py-2 text-sm text-gray-900",children:e.product?.name||"N/A"}),s.jsx("td",{className:"px-4 py-2 text-sm text-gray-500",children:e.product?.sku||"N/A"}),s.jsx("td",{className:"px-4 py-2 text-sm text-gray-500",children:e.product?.unit||"N/A"}),s.jsx("td",{className:"px-4 py-2 text-sm text-gray-900",children:e.quantity}),s.jsxs("td",{className:"px-4 py-2 text-sm text-gray-900",children:["₱",e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),s.jsxs("td",{className:"px-4 py-2 text-sm font-medium text-gray-900",children:["₱",(e.unit_price*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]},t))})]})})]})]})]})}),q&&L&&s.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,s.jsxs)("div",{className:"relative top-4 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center mb-4 flex-shrink-0",children:[s.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"Deposit Slip"}),s.jsx("button",{onClick:()=>{E(!1),M(null)},className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]}),s.jsx("div",{className:"text-center flex-1 flex items-center justify-center overflow-auto",children:s.jsx("img",{src:L,alt:"Deposit slip",className:"max-h-[70vh] w-auto rounded-lg border"})})]})}),T&&R&&s.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,s.jsxs)("div",{className:"relative top-4 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center mb-4 flex-shrink-0",children:[(0,s.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Returnable Pans Image",(()=>{let e=getReturnablePans(Z);return e.total>0?` (${e.total} pans)`:""})()]}),s.jsx("button",{onClick:()=>{I(!1),z(null),H(null)},className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]}),s.jsx("div",{className:"text-center flex-1 flex items-center justify-center overflow-auto",children:s.jsx("img",{src:R,alt:"Returnable pans",className:"max-h-[70vh] w-auto rounded-lg border"})})]})})]}):(0,s.jsxs)("div",{className:"space-y-6",children:[(0,s.jsxs)("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0",children:[(0,s.jsxs)("div",{children:[s.jsx("h1",{className:"text-xl font-semibold text-gray-900",children:"Branches"}),s.jsx("p",{className:"text-sm text-gray-600",children:"Manage branch locations and view order history"})]}),(0,s.jsxs)("button",{onClick:()=>f(!0),className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${"green"===t?"bg-green-600 hover:bg-green-700":"red"===t?"bg-red-600 hover:bg-red-700":"yellow"===t?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[s.jsx(m.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Add Branch"})]})]}),b&&s.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,s.jsxs)("div",{className:"relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[s.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"Add New Branch"}),s.jsx("button",{onClick:()=>f(!1),className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]}),(0,s.jsxs)("form",{onSubmit:handleAddLocation,className:"space-y-4",children:[(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Branch Name *"}),(0,s.jsxs)("div",{className:"flex items-center space-x-3",children:[s.jsx("input",{type:"text",required:!0,value:B.name,onChange:e=>U({...B,name:e.target.value}),className:`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${"green"===t?"focus:ring-green-500":"red"===t?"focus:ring-red-500":"yellow"===t?"focus:ring-yellow-500":"focus:ring-blue-500"}`,placeholder:"Enter branch name"}),(0,s.jsxs)("label",{className:"flex items-center space-x-2 text-sm text-gray-700",children:[s.jsx("input",{type:"checkbox",checked:B.company_owned,onChange:e=>U({...B,company_owned:e.target.checked}),className:"h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"}),s.jsx("span",{children:"Company Owned"})]}),(0,s.jsxs)("label",{className:"flex items-center space-x-2 text-sm text-gray-700",children:[s.jsx("input",{type:"checkbox",checked:B.can_access_order_features,onChange:e=>U({...B,can_access_order_features:e.target.checked}),className:"h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"}),s.jsx("span",{children:"Allow Features"})]}),(0,s.jsxs)("label",{className:"flex items-center space-x-2 text-sm text-gray-700",children:[s.jsx("input",{type:"checkbox",checked:B.is_remote,onChange:e=>U({...B,is_remote:e.target.checked}),className:"h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"}),s.jsx("span",{children:"Remote Branch"})]})]})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Passkey *"}),s.jsx("input",{type:"text",required:!0,value:B.passkey,onChange:e=>U({...B,passkey:e.target.value.replace(/\D/g,"").slice(0,6)}),className:`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${"green"===t?"focus:ring-green-500":"red"===t?"focus:ring-red-500":"yellow"===t?"focus:ring-yellow-500":"focus:ring-blue-500"}`,placeholder:"Enter 6-digit passkey",maxLength:6})]}),(0,s.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Franchisee Name *"}),s.jsx("input",{type:"text",required:!0,value:B.franchisee,onChange:e=>U({...B,franchisee:e.target.value}),className:`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${"green"===t?"focus:ring-green-500":"red"===t?"focus:ring-red-500":"yellow"===t?"focus:ring-yellow-500":"focus:ring-blue-500"}`,placeholder:"Enter franchisee name"})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Contact Number *"}),s.jsx("input",{type:"tel",required:!0,value:B.contact_number,onChange:e=>U({...B,contact_number:e.target.value}),className:`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${"green"===t?"focus:ring-green-500":"red"===t?"focus:ring-red-500":"yellow"===t?"focus:ring-yellow-500":"focus:ring-blue-500"}`,placeholder:"Enter contact number"})]})]}),(0,s.jsxs)("div",{className:"flex justify-end space-x-3 pt-4",children:[s.jsx("button",{type:"button",onClick:()=>f(!1),className:"px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors",children:"Cancel"}),(0,s.jsxs)("button",{type:"submit",className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${"green"===t?"bg-green-600 hover:bg-green-700":"red"===t?"bg-red-600 hover:bg-red-700":"yellow"===t?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[s.jsx(u.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Add Branch"})]})]})]})]})}),o?s.jsx("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden",children:s.jsx("div",{children:(0,s.jsxs)("table",{className:"w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:s.jsx("tr",{children:["Branch Name","Passkey","Franchisee","Contact","Type","Access Features","Remote Branch","Actions"].map((e,t)=>s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:e},t))})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:[void 0,void 0,void 0,void 0,void 0].map((e,t)=>s.jsx("tr",{children:[...Array(8)].map((e,t)=>s.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:s.jsx("div",{className:"h-6 bg-gray-200 rounded animate-pulse"})},t))},t))})]})})}):s.jsx("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden",children:s.jsx("div",{className:"overflow-x-auto",children:(0,s.jsxs)("table",{className:"min-w-full divide-y divide-gray-200 table-fixed",children:[s.jsx("thead",{className:"bg-gray-50 sticky top-0",children:(0,s.jsxs)("tr",{children:[s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48",children:"Branch Name"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32",children:"Passkey"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48",children:"Franchisee"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40",children:"Contact"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36",children:"Type"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36",children:"Access Features"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36",children:"Remote Branch"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32",children:"Actions"})]})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:a.map(e=>(0,s.jsxs)("tr",{className:"hover:bg-blue-100 h-16",children:[s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-middle",children:y?.id===e.id?s.jsx("input",{type:"text",value:y.name,onChange:e=>v({...y,name:e.target.value}),className:"w-full px-2 py-1 border border-gray-300 rounded"}):e.name}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:y?.id===e.id?s.jsx("input",{type:"text",value:y.passkey,onChange:e=>v({...y,passkey:e.target.value.replace(/\D/g,"").slice(0,6)}),className:"w-full px-2 py-1 border border-gray-300 rounded",maxLength:6}):(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx("span",{className:"font-mono",children:e.passkey}),s.jsx("button",{onClick:()=>copyToClipboard(e.passkey),className:`p-1 rounded hover:bg-gray-100 transition-colors ${"green"===t?"text-green-600 hover:text-green-700":"red"===t?"text-red-600 hover:text-red-700":"yellow"===t?"text-yellow-600 hover:text-yellow-700":"text-blue-600 hover:text-blue-700"}`,title:"Copy passkey",children:s.jsx(D.Z,{className:"h-4 w-4"})})]})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:y?.id===e.id?s.jsx("input",{type:"text",value:y.franchisee||"",onChange:e=>v({...y,franchisee:e.target.value}),className:"w-full px-2 py-1 border border-gray-300 rounded"}):e.franchisee||"N/A"}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:y?.id===e.id?s.jsx("input",{type:"tel",value:y.contact_number||"",onChange:e=>v({...y,contact_number:e.target.value}),className:"w-full px-2 py-1 border border-gray-300 rounded"}):e.contact_number||"N/A"}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:y?.id===e.id?(0,s.jsxs)("label",{className:"flex items-center space-x-2",children:[s.jsx("input",{type:"checkbox",checked:y.company_owned||!1,onChange:e=>v({...y,company_owned:e.target.checked}),className:"h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"}),s.jsx("span",{className:"text-xs text-gray-600",children:"Company Owned"})]}):s.jsx("span",{className:`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${e.company_owned?"bg-blue-100 text-blue-800":"bg-gray-100 text-gray-800"}`,children:e.company_owned?"Company Owned":"Franchise"})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:y?.id===e.id?(0,s.jsxs)("label",{className:"flex items-center space-x-2",children:[s.jsx("input",{type:"checkbox",checked:y.can_access_order_features||!1,onChange:e=>v({...y,can_access_order_features:e.target.checked}),className:"h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"}),s.jsx("span",{className:"text-xs text-gray-600",children:"Allow Features"})]}):s.jsx("span",{className:`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${e.can_access_order_features?"bg-green-100 text-green-800":"bg-red-100 text-red-800"}`,children:e.can_access_order_features?"Allowed":"Restricted"})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:y?.id===e.id?(0,s.jsxs)("label",{className:"flex items-center space-x-2",children:[s.jsx("input",{type:"checkbox",checked:y.is_remote||!1,onChange:e=>v({...y,is_remote:e.target.checked}),className:"h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"}),s.jsx("span",{className:"text-xs text-gray-600",children:"Remote Branch"})]}):s.jsx("span",{className:`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${e.is_remote?"bg-purple-100 text-purple-800":"bg-gray-100 text-gray-800"}`,children:e.is_remote?"Remote":"Local"})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle",children:s.jsx("div",{className:"flex space-x-2",children:y?.id===e.id?(0,s.jsxs)(s.Fragment,{children:[s.jsx("button",{onClick:()=>handleUpdateLocation(y),className:`p-1 rounded transition-all duration-200 ease-in-out ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-50":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-50":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50":"text-blue-600 hover:text-blue-900 hover:bg-blue-50"}`,title:"Save",children:s.jsx(u.Z,{className:"h-4 w-4"})}),s.jsx("button",{onClick:()=>v(null),className:"p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 ease-in-out",title:"Cancel",children:s.jsx(x.Z,{className:"h-4 w-4"})})]}):(0,s.jsxs)(s.Fragment,{children:[s.jsx("button",{onClick:()=>v(e),className:`p-1 rounded transition-all duration-200 ease-in-out ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-50":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-50":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50":"text-blue-600 hover:text-blue-900 hover:bg-blue-50"}`,title:"Edit",children:s.jsx(g.Z,{className:"h-4 w-4"})}),s.jsx("button",{onClick:()=>handleViewOrderHistory(e),className:"p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out",title:"View Order History",children:s.jsx(_.Z,{className:"h-4 w-4"})}),s.jsx("button",{onClick:()=>handleDeleteLocation(e.id),className:"p-1 rounded text-red-600 hover:text-red-900 hover:bg-red-50 transition-all duration-200 ease-in-out",title:"Delete",children:s.jsx(p.Z,{className:"h-4 w-4"})})]})})})]},e.id))})]})})})]})}var C=a(1264),P=a(5574);function BillingManager({selectedBrand:e,theme:t="blue"}){let[a,r]=(0,i.useState)([]),[l,n]=(0,i.useState)([]),[o,c]=(0,i.useState)([]),[m,u]=(0,i.useState)(!1),[g,p]=(0,i.useState)(null),[b,f]=(0,i.useState)(!1),[y,v]=(0,i.useState)(0),[j,S]=(0,i.useState)("all"),[D,O]=(0,i.useState)(!1),[$,F]=(0,i.useState)(null),[A,q]=(0,i.useState)(null),[E,L]=(0,i.useState)(!1),[M,T]=(0,i.useState)(null),[I,R]=(0,i.useState)(null),[z,Z]=(0,i.useState)(1),getFranchiseIconColor=()=>{switch(t){case"green":return"text-green-600";case"red":return"text-red-600";case"yellow":return"text-yellow-600";default:return"text-blue-600"}};(0,i.useEffect)(()=>{e&&(fetchPaidOrders(),Z(1))},[e,j]),(0,i.useEffect)(()=>{if(!e)return;let t=d.O.channel("billing-orders-changes").on("postgres_changes",{event:"*",schema:"public",table:"customer_orders",filter:`brand_id=eq.${e.id}`},e=>{console.log("Billing orders realtime update:",e),("UPDATE"===e.eventType||"INSERT"===e.eventType||"DELETE"===e.eventType)&&fetchPaidOrders()}).subscribe();return()=>{d.O.removeChannel(t)}},[e]);let getDateRange=()=>{let e,t;let a=new Date,s=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}),r=s.formatToParts(a),l=parseInt(r.find(e=>"year"===e.type).value),i=parseInt(r.find(e=>"month"===e.type).value)-1,n=parseInt(r.find(e=>"day"===e.type).value);switch(j){case"all":e=new Date(0),t=new Date;break;case"week":let d=new Date(l,i,n-6);e=new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0),t=new Date(l,i,n,23,59,59,999);break;case"month":e=new Date(l,i,1,0,0,0);let o=new Date(l,i+1,0).getDate();t=new Date(l,i,o,23,59,59,999);break;case"year":e=new Date(l,0,1,0,0,0),t=new Date(l,11,31,23,59,59,999);break;default:e=new Date(l,i,n,0,0,0),t=new Date(l,i,n,23,59,59,999)}return{start:e.toISOString(),end:t.toISOString()}},fetchPaidOrders=async()=>{if(e){u(!0);try{let{start:t,end:a}=getDateRange(),{data:s,error:l}=await d.O.from("customer_orders").select(`
          *,
          location:locations(*, brand:brands(*)),
          brand:brands(*),
          order_details(
            *,
            products:products(id, name, sku, unit, category)
          )
        `).eq("brand_id",e.id).in("status",["paid","complete","fulfilled"]).order("created_at",{ascending:!1});if(l){console.error("Error fetching orders:",l);return}if(s){let e=s.filter(e=>"paid"===e.status&&e.created_at>=t&&e.created_at<=a),l=s.filter(e=>"complete"===e.status&&e.created_at>=t&&e.created_at<=a),i=s.filter(e=>"fulfilled"===e.status);r(e),n(l),c(i);let d=i.reduce((e,t)=>e+(t.total_amount||0),0);v(d)}}catch(e){console.error("Error fetching orders:",e)}finally{u(!1)}}},handleMarkComplete=async e=>{if(confirm("Are you sure you want to mark this order as complete?"))try{let{error:t}=await d.O.from("customer_orders").update({status:"complete",updated_at:new Date().toISOString()}).eq("id",e);if(t){console.error("Error updating order:",t),alert("Error updating order");return}r(t=>t.filter(t=>t.id!==e)),g?.id===e&&(f(!1),p(null))}catch(e){console.error("Error updating order:",e),alert("Error updating order")}},handleViewDetails=e=>{p(e),f(!0)},getReturnablePans=e=>{if(!e.order_details)return{total:0,hasImage:!1};let t=e.order_details.filter(t=>{if(!e.brand&&!e.location?.brand)return!1;let a=(e.brand?.slug||e.location?.brand?.slug)?.toLowerCase(),s=t.products?.category?.toLowerCase()||"";switch(a){case"gelatofilipino":return"gelato"===s;case"mychoice":return"ice cream"===s;case"mang-sorbetes":return"sorbetes"===s;default:return!1}}),a=t.reduce((e,t)=>e+t.quantity,0),s=!!e.returnable_pans_image_url;return{total:a,hasImage:s}},H=(0,i.useCallback)(e=>{if(!e.order_details)return[];let t=new Map;return e.order_details.forEach(e=>{console.log("Product data:",e.products);let a=e.products?.category&&""!==e.products.category.trim()?e.products.category:"Uncategorized";t.has(a)||t.set(a,{category:a,totalQuantity:0,totalAmount:0});let s=t.get(a);s.totalQuantity+=e.quantity,s.totalAmount+=e.unit_price*e.quantity}),Array.from(t.values())},[]);(0,i.useCallback)(e=>e.order_details?.reduce((e,t)=>e+t.unit_price*t.quantity,0)||0,[]);let getTotalCompletedPages=()=>Math.ceil(l.length/10),handleCompletedPageChange=e=>{Z(e)},isCompanyOwned=e=>e.location?.company_owned===!0,getSubtotalAmount=e=>e.order_details?.reduce((e,t)=>e+t.unit_price*t.quantity,0)||0,B=(0,i.useMemo)(()=>a.reduce((e,t)=>e+(t.total_amount||0),0),[a]),U=(0,i.useMemo)(()=>l.reduce((e,t)=>e+(t.total_amount||0),0),[l]),W=(0,i.useMemo)(()=>B+U,[B,U]),isMyChoiceCompanyOwned=e=>e.brand?.name?.toLowerCase().includes("mychoice")&&e.location?.company_owned===!0,V=(0,i.useMemo)(()=>{let e=a.filter(e=>isMyChoiceCompanyOwned(e)).reduce((e,t)=>e+(t.total_amount||0),0),t=l.filter(e=>isMyChoiceCompanyOwned(e)).reduce((e,t)=>e+(t.total_amount||0),0);return e+t},[a,l]),Y=(0,i.useMemo)(()=>{let e=a.filter(e=>!isMyChoiceCompanyOwned(e)).reduce((e,t)=>e+(t.total_amount||0),0),t=l.filter(e=>!isMyChoiceCompanyOwned(e)).reduce((e,t)=>e+(t.total_amount||0),0);return e+t},[a,l]),G=(0,i.useMemo)(()=>{let e=a.filter(e=>isMyChoiceCompanyOwned(e)),t=l.filter(e=>isMyChoiceCompanyOwned(e));return[...e,...t]},[a,l]),Q=(0,i.useMemo)(()=>{let e=a.filter(e=>!isMyChoiceCompanyOwned(e)),t=l.filter(e=>!isMyChoiceCompanyOwned(e));return[...e,...t]},[a,l]);return(0,s.jsxs)("div",{className:"space-y-6",children:[s.jsx("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0",children:(0,s.jsxs)("div",{children:[s.jsx("h1",{className:"text-xl font-semibold text-gray-900",children:"Billing"}),s.jsx("p",{className:"text-sm text-gray-600",children:"Track unpaid orders and manage paid orders by status"})]})}),s.jsx("div",{className:"bg-white rounded-lg shadow-sm border p-4",children:(0,s.jsxs)("div",{className:"flex items-center space-x-4",children:[s.jsx("label",{className:"text-sm font-medium text-gray-700",children:"Time Period:"}),s.jsx("div",{className:"flex space-x-2",children:["all","week","month","year"].map(e=>s.jsx("button",{onClick:()=>S(e),className:`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${j===e?"green"===t?"bg-green-100 text-green-700 border border-green-300":"red"===t?"bg-red-100 text-red-700 border border-red-300":"yellow"===t?"bg-yellow-100 text-yellow-700 border border-yellow-300":"bg-blue-100 text-blue-700 border border-blue-300":"bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"}`,children:"all"===e?"All Time":e.charAt(0).toUpperCase()+e.slice(1)},e))})]})}),m?(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:[s.jsx("div",{className:"flex justify-between items-center mb-4",children:s.jsx("div",{className:"h-6 bg-gray-200 rounded w-32 animate-pulse"})}),s.jsx("div",{className:"grid grid-cols-1 md:grid-cols-4 gap-4 mb-6",children:[void 0,void 0,void 0,void 0].map((e,t)=>(0,s.jsxs)("div",{className:"bg-gray-50 p-4 rounded-lg",children:[s.jsx("div",{className:"h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse"}),s.jsx("div",{className:"h-8 bg-gray-200 rounded w-32 mb-2 animate-pulse"}),s.jsx("div",{className:"h-3 bg-gray-200 rounded w-20 animate-pulse"})]},t))}),(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden mt-6",children:[s.jsx("div",{className:"px-6 py-4 border-b border-gray-200 bg-gray-50",children:s.jsx("div",{className:"h-6 bg-gray-200 rounded w-48 animate-pulse"})}),s.jsx("div",{children:(0,s.jsxs)("table",{className:"w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:s.jsx("tr",{children:[...Array(7)].map((e,t)=>s.jsx("th",{className:"px-6 py-3 text-left",children:s.jsx("div",{className:"h-4 bg-gray-200 rounded w-20 animate-pulse"})},t))})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:[void 0,void 0,void 0].map((e,t)=>s.jsx("tr",{children:[...Array(7)].map((e,t)=>s.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:s.jsx("div",{className:"h-4 bg-gray-200 rounded w-24 animate-pulse"})},t))},t))})]})})]})]}):(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:[s.jsx("div",{className:"flex justify-between items-center mb-4",children:s.jsx("h4",{className:"text-lg font-medium",children:"Summary"})}),e?.name?.toLowerCase().includes("mychoice")&&(0,s.jsxs)("div",{className:"mb-6",children:[s.jsx("div",{className:"mb-6",children:(0,s.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-4",children:[(0,s.jsxs)("div",{className:"bg-green-50 p-4 rounded-lg",children:[s.jsx("p",{className:"text-sm text-green-600 font-medium",children:"Total Company Owned Revenue"}),(0,s.jsxs)("p",{className:"text-2xl font-bold text-green-900",children:["₱",V.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,s.jsxs)("p",{className:"text-xs text-green-700 mt-1",children:[G.length," company orders"]})]}),(0,s.jsxs)("div",{className:"bg-blue-50 p-4 rounded-lg",children:[s.jsx("p",{className:"text-sm text-blue-600 font-medium",children:"Total Paid"}),(0,s.jsxs)("p",{className:"text-2xl font-bold text-blue-900",children:["₱",a.filter(e=>isMyChoiceCompanyOwned(e)).reduce((e,t)=>e+(t.total_amount||0),0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),s.jsx("p",{className:"text-xs text-blue-700 mt-1",children:"Ready for completion"})]}),(0,s.jsxs)("div",{className:"bg-orange-50 p-4 rounded-lg",children:[s.jsx("p",{className:"text-sm text-orange-600 font-medium",children:"Total Receivable"}),(0,s.jsxs)("p",{className:"text-2xl font-bold text-orange-900",children:["₱",o.filter(e=>isMyChoiceCompanyOwned(e)).reduce((e,t)=>e+(t.total_amount||0),0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,s.jsxs)("p",{className:"text-xs text-orange-700 mt-1",children:[o.filter(e=>isMyChoiceCompanyOwned(e)).length," unpaid orders"]})]})]})}),s.jsx("div",{children:(0,s.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-4",children:[(0,s.jsxs)("div",{className:"bg-green-50 p-4 rounded-lg",children:[s.jsx("p",{className:"text-sm text-green-600 font-medium",children:"Total Franchise Revenue"}),(0,s.jsxs)("p",{className:"text-2xl font-bold text-green-900",children:["₱",Y.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,s.jsxs)("p",{className:"text-xs text-green-700 mt-1",children:[Q.length," franchise orders"]})]}),(0,s.jsxs)("div",{className:"bg-blue-50 p-4 rounded-lg",children:[s.jsx("p",{className:"text-sm text-blue-600 font-medium",children:"Total Paid"}),(0,s.jsxs)("p",{className:"text-2xl font-bold text-blue-900",children:["₱",a.filter(e=>!isMyChoiceCompanyOwned(e)).reduce((e,t)=>e+(t.total_amount||0),0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),s.jsx("p",{className:"text-xs text-blue-700 mt-1",children:"Ready for completion"})]}),(0,s.jsxs)("div",{className:"bg-orange-50 p-4 rounded-lg",children:[s.jsx("p",{className:"text-sm text-orange-600 font-medium",children:"Total Receivable"}),(0,s.jsxs)("p",{className:"text-2xl font-bold text-orange-900",children:["₱",o.filter(e=>!isMyChoiceCompanyOwned(e)).reduce((e,t)=>e+(t.total_amount||0),0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,s.jsxs)("p",{className:"text-xs text-orange-700 mt-1",children:[o.filter(e=>!isMyChoiceCompanyOwned(e)).length," unpaid orders"]})]})]})})]}),!e?.name?.toLowerCase().includes("mychoice")&&(0,s.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-4 gap-4",children:[(0,s.jsxs)("div",{className:"bg-green-50 p-4 rounded-lg",children:[s.jsx("p",{className:"text-sm text-green-600 font-medium",children:"Total Revenue"}),(0,s.jsxs)("p",{className:"text-2xl font-bold text-green-900",children:["₱",W.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,s.jsxs)("p",{className:"text-xs text-green-700 mt-1",children:[a.length+l.length," total orders"]})]}),(0,s.jsxs)("div",{className:"bg-purple-50 p-4 rounded-lg",children:[s.jsx("p",{className:"text-sm text-purple-600 font-medium",children:"Paid Orders"}),(0,s.jsxs)("p",{className:"text-2xl font-bold text-purple-900",children:["₱",B.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,s.jsxs)("p",{className:"text-xs text-purple-700 mt-1",children:[a.length," paid orders"]})]}),(0,s.jsxs)("div",{className:"bg-indigo-50 p-4 rounded-lg",children:[s.jsx("p",{className:"text-sm text-indigo-600 font-medium",children:"Completed Orders"}),(0,s.jsxs)("p",{className:"text-2xl font-bold text-indigo-900",children:["₱",U.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,s.jsxs)("p",{className:"text-xs text-indigo-700 mt-1",children:[l.length," completed orders"]})]}),(0,s.jsxs)("div",{className:"bg-orange-50 p-4 rounded-lg",children:[s.jsx("p",{className:"text-sm text-orange-600 font-medium",children:"Total Receivable"}),(0,s.jsxs)("p",{className:"text-2xl font-bold text-orange-900",children:["₱",y.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,s.jsxs)("p",{className:"text-xs text-orange-700 mt-1",children:[o.length," unpaid orders"]})]})]})]}),o.length>0&&(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden",children:[s.jsx("div",{className:"px-6 py-4 border-b border-gray-200 bg-orange-50",children:s.jsx("h4",{className:"text-lg font-medium text-orange-900",children:"Unpaid Orders (Receivable)"})}),s.jsx("div",{className:"overflow-x-auto overflow-y-visible",children:(0,s.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:(0,s.jsxs)("tr",{children:[s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Order ID"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Date"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Location"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Amount"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Returnable Pans"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Status"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Actions"})]})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:o.map(e=>(0,s.jsxs)("tr",{className:"hover:bg-orange-100 hover:shadow-md transition-all duration-75",children:[(0,s.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-middle",children:[e.id.slice(0,8),"..."]}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:(0,h.iI)(e.created_at,{dateStyle:"short"})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:(0,s.jsxs)("div",{className:"flex items-center",children:[isCompanyOwned(e)?s.jsx(w.Z,{className:"h-4 w-4 mr-2 text-blue-600"}):s.jsx(N.Z,{className:`h-4 w-4 mr-2 ${getFranchiseIconColor()}`}),s.jsx("span",{children:e.location?.name||"N/A"})]})}),(0,s.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600 align-middle",children:["₱",e.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:(()=>{let t=getReturnablePans(e);return t.total>0&&t.hasImage?(0,s.jsxs)("button",{onClick:()=>{F(e.returnable_pans_image_url),q(e),O(!0)},className:"text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer",title:"Click to view returnable pans image",children:[t.total," pans"]}):t.total>0?(0,s.jsxs)("span",{className:"text-red-600 font-medium cursor-default",children:[t.total," pans"]}):s.jsx("span",{className:"text-gray-400",children:"-"})})()}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap align-middle",children:s.jsx("span",{className:"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800",children:"Awaiting Payment"})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle",children:s.jsx("div",{className:"flex space-x-2 items-center",children:s.jsx("button",{onClick:()=>handleViewDetails(e),className:"p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out",title:"View Details",children:s.jsx(_.Z,{className:"h-4 w-4"})})})})]},e.id))})]})})]}),(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden",children:[s.jsx("div",{className:"px-6 py-4 border-b border-gray-200 bg-purple-50",children:(0,s.jsxs)("h4",{className:"text-lg font-medium text-purple-900",children:["Paid Orders (",a.length,")"]})}),m?s.jsx("div",{className:"flex items-center justify-center py-12",children:s.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"})}):0===a.length?(0,s.jsxs)("div",{className:"p-12 text-center",children:[s.jsx(k.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),s.jsx("h3",{className:"text-lg font-medium text-gray-900 mb-2",children:"No Paid Orders"}),s.jsx("p",{className:"text-gray-600",children:"There are no paid orders in the selected time period."})]}):s.jsx("div",{className:"overflow-x-auto",children:(0,s.jsxs)("table",{className:"min-w-full divide-y divide-gray-200 table-fixed",children:[s.jsx("thead",{className:"bg-gray-50",children:(0,s.jsxs)("tr",{children:[s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Order ID"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Date"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32",children:"Location"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Status"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28",children:"Amount"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Returnable Pans"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Deposit Slip"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Actions"})]})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:a.map(e=>(0,s.jsxs)("tr",{className:"hover:bg-blue-100 hover:shadow-md transition-all duration-75",children:[(0,s.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-middle",children:[e.id.slice(0,8),"..."]}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:(0,h.iI)(e.created_at,{dateStyle:"short"})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:(0,s.jsxs)("div",{className:"flex items-center",children:[isCompanyOwned(e)?s.jsx(w.Z,{className:"h-4 w-4 mr-2 text-blue-600"}):s.jsx(N.Z,{className:`h-4 w-4 mr-2 ${getFranchiseIconColor()}`}),s.jsx("span",{children:e.location?.name||"N/A"})]})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap align-middle",children:s.jsx("span",{className:`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${"paid"===e.status?"bg-purple-100 text-purple-800":"complete"===e.status?"bg-indigo-100 text-indigo-800":"bg-gray-100 text-gray-800"}`,children:e.status.charAt(0).toUpperCase()+e.status.slice(1)})}),(0,s.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 align-middle",children:["₱",e.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:(()=>{let t=getReturnablePans(e);return t.total>0&&t.hasImage?(0,s.jsxs)("button",{onClick:()=>{F(e.returnable_pans_image_url),q(e),O(!0)},className:"text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer",title:"Click to view returnable pans image",children:[t.total," pans"]}):t.total>0?(0,s.jsxs)("span",{className:"text-red-600 font-medium cursor-default",children:[t.total," pans"]}):s.jsx("span",{className:"text-gray-400",children:"-"})})()}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle",children:e.deposit_slip_url?s.jsx("button",{onClick:()=>{T(e.deposit_slip_url),R(e),L(!0)},className:"text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer",children:"View"}):s.jsx("span",{className:"text-gray-400",children:"No slip"})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle",children:(0,s.jsxs)("div",{className:"flex space-x-2 items-center",children:[s.jsx("button",{onClick:()=>handleViewDetails(e),className:"p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out",title:"View Details",children:s.jsx(_.Z,{className:"h-4 w-4"})}),"paid"===e.status&&s.jsx("button",{onClick:()=>handleMarkComplete(e.id),className:`p-1 rounded transition-all duration-200 ease-in-out ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-50":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-50":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50":"text-blue-600 hover:text-blue-900 hover:bg-blue-50"}`,title:"Mark Complete",children:s.jsx(C.Z,{className:"h-4 w-4"})})]})})]},e.id))})]})})]}),(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden",children:[s.jsx("div",{className:"px-6 py-4 border-b border-gray-200 bg-indigo-50",children:(0,s.jsxs)("div",{className:"flex items-center justify-between",children:[(0,s.jsxs)("h4",{className:"text-lg font-medium text-indigo-900",children:["Completed Orders (",l.length,")"]}),l.length>10&&(0,s.jsxs)("div",{className:"text-sm text-indigo-700",children:["Page ",z," of ",getTotalCompletedPages()]})]})}),m?s.jsx("div",{className:"flex items-center justify-center py-12",children:s.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"})}):0===l.length?(0,s.jsxs)("div",{className:"p-12 text-center",children:[s.jsx(C.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),s.jsx("h3",{className:"text-lg font-medium text-gray-900 mb-2",children:"No Completed Orders"}),s.jsx("p",{className:"text-gray-600",children:"There are no completed orders in the selected time period."})]}):s.jsx("div",{className:"overflow-x-auto",children:(0,s.jsxs)("table",{className:"min-w-full divide-y divide-gray-200 table-fixed",children:[s.jsx("thead",{className:"bg-gray-50",children:(0,s.jsxs)("tr",{children:[s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Order ID"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Date"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32",children:"Location"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Status"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28",children:"Amount"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Returnable Pans"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Deposit Slip"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Actions"})]})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:(()=>{let e=(z-1)*10,t=e+10;return l.slice(e,t)})().map(e=>(0,s.jsxs)("tr",{className:"hover:bg-indigo-100 hover:shadow-md transition-all duration-75",children:[(0,s.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-middle",children:[e.id.slice(0,8),"..."]}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:(0,h.iI)(e.created_at,{dateStyle:"short"})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:(0,s.jsxs)("div",{className:"flex items-center",children:[isCompanyOwned(e)?s.jsx(w.Z,{className:"h-4 w-4 mr-2 text-blue-600"}):s.jsx(N.Z,{className:`h-4 w-4 mr-2 ${getFranchiseIconColor()}`}),s.jsx("span",{children:e.location?.name||"N/A"})]})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap align-middle",children:s.jsx("span",{className:"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800",children:"Complete"})}),(0,s.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 align-middle",children:["₱",e.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:(()=>{let t=getReturnablePans(e);return t.total>0&&t.hasImage?(0,s.jsxs)("button",{onClick:()=>{F(e.returnable_pans_image_url),q(e),O(!0)},className:"text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer",title:"Click to view returnable pans image",children:[t.total," pans"]}):t.total>0?(0,s.jsxs)("span",{className:"text-red-600 font-medium cursor-default",children:[t.total," pans"]}):s.jsx("span",{className:"text-gray-400",children:"-"})})()}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle",children:e.deposit_slip_url?s.jsx("button",{onClick:()=>{T(e.deposit_slip_url),R(e),L(!0)},className:"text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer",children:"View"}):s.jsx("span",{className:"text-gray-400",children:"N/A"})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle",children:s.jsx("div",{className:"flex space-x-2 items-center",children:s.jsx("button",{onClick:()=>handleViewDetails(e),className:"p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out",title:"View Details",children:s.jsx(_.Z,{className:"h-4 w-4"})})})})]},e.id))})]})}),l.length>10&&s.jsx("div",{className:"px-6 py-4 border-t border-gray-200 bg-gray-50",children:(0,s.jsxs)("div",{className:"flex items-center justify-between",children:[(0,s.jsxs)("div",{className:"text-sm text-gray-700",children:["Showing ",(z-1)*10+1," to ",Math.min(10*z,l.length)," of ",l.length," orders"]}),(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx("button",{onClick:()=>handleCompletedPageChange(z-1),disabled:1===z,className:"px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed",children:"Previous"}),s.jsx("div",{className:"flex items-center space-x-1",children:Array.from({length:getTotalCompletedPages()},(e,t)=>t+1).map(e=>s.jsx("button",{onClick:()=>handleCompletedPageChange(e),className:`px-3 py-1 text-sm border rounded-md ${e===z?"bg-indigo-600 text-white border-indigo-600":"bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`,children:e},e))}),s.jsx("button",{onClick:()=>handleCompletedPageChange(z+1),disabled:z===getTotalCompletedPages(),className:"px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed",children:"Next"})]})]})})]}),0===o.length&&0===a.length&&0===l.length&&!m&&(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-12 text-center",children:[s.jsx(k.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),s.jsx("h3",{className:"text-lg font-medium text-gray-900 mb-2",children:"No Billing Activity"}),s.jsx("p",{className:"text-gray-600",children:"There are no paid or unpaid orders to manage."})]}),b&&g&&s.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,s.jsxs)("div",{className:"relative top-4 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[(0,s.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Order Details #",g.id.slice(0,8)]}),s.jsx("div",{className:"flex space-x-2",children:s.jsx("button",{onClick:()=>{f(!1),p(null)},className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})})]}),(0,s.jsxs)("div",{className:"flex-1 overflow-y-auto space-y-6",children:[(0,s.jsxs)("div",{className:"bg-gray-50 rounded-lg p-4",children:[(0,s.jsxs)("div",{className:"grid grid-cols-2 md:grid-cols-5 gap-4 text-center",children:[(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Created Date"}),s.jsx("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:(0,h.iI)(g.created_at,{dateStyle:"short",timeStyle:"short"})})]}),(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Status"}),s.jsx("span",{className:`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${"paid"===g.status?"bg-purple-100 text-purple-800":"complete"===g.status?"bg-indigo-100 text-indigo-800":"bg-gray-100 text-gray-800"}`,children:g.status.charAt(0).toUpperCase()+g.status.slice(1)})]}),(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Logistics"}),s.jsx("span",{className:`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${"delivery"===g.delivery_type?"bg-blue-100 text-blue-800":"bg-green-100 text-green-800"}`,children:"delivery"===g.delivery_type?"Delivery":"Pickup"})]}),(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Location"}),(0,s.jsxs)("div",{className:"flex items-center mt-1",children:[isCompanyOwned(g)?s.jsx(w.Z,{className:"h-4 w-4 mr-2 text-blue-600"}):s.jsx(N.Z,{className:"h-4 w-4 mr-2 text-green-600"}),s.jsx("p",{className:"text-sm font-semibold text-gray-900",children:g.location?.name||"N/A"})]})]}),(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Total Amount"}),(0,s.jsxs)("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:["₱",g.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]}),(0,s.jsxs)("div",{className:"mt-4 pt-4 border-t border-gray-200",children:[(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide mb-2",children:"Category Totals"}),s.jsx("div",{className:"grid grid-cols-2 md:grid-cols-3 gap-2",children:H(g).map((e,t)=>(0,s.jsxs)("div",{className:"bg-white rounded p-2 border text-center",children:[s.jsx("p",{className:"text-xs font-medium text-gray-900",children:e.category}),(0,s.jsxs)("p",{className:"text-xs text-gray-600",children:[e.totalQuantity," items"]}),(0,s.jsxs)("p",{className:"text-xs font-semibold text-green-600",children:["₱",e.totalAmount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]},t))})]}),(0,s.jsxs)("div",{className:"mt-4 pt-4 border-t border-gray-200",children:[s.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide mb-2",children:"Pricing Breakdown"}),(0,s.jsxs)("div",{className:"bg-white rounded p-3 space-y-2",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-sm text-gray-600",children:"Subtotal:"}),(0,s.jsxs)("span",{className:"text-sm text-gray-900",children:["₱",getSubtotalAmount(g).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"delivery"===g.delivery_type&&(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-sm text-gray-600",children:"Delivery Fee:"}),getSubtotalAmount(g)>=1e4?s.jsx("span",{className:"text-sm text-green-600",children:"FREE (Order over ₱10k)"}):s.jsx("span",{className:"text-sm text-gray-900",children:"+₱500.00"})]}),"pickup"===g.delivery_type&&getSubtotalAmount(g)>=1e4&&(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-sm text-gray-600",children:"Pickup Discount (5%):"}),(0,s.jsxs)("span",{className:"text-sm text-green-600",children:["-₱",(.05*getSubtotalAmount(g)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"pickup"===g.delivery_type&&1e4>getSubtotalAmount(g)&&(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-sm text-gray-500",children:"Pickup Discount:"}),s.jsx("span",{className:"text-sm text-gray-500",children:"Not available (Order under ₱10k)"})]}),(0,s.jsxs)("div",{className:"flex justify-between items-center border-t pt-2",children:[s.jsx("span",{className:"text-sm font-semibold text-gray-900",children:"Total Amount:"}),(0,s.jsxs)("span",{className:"text-sm font-semibold text-green-600",children:["₱",g.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]})]})]})]}),g.deposit_slip_url&&(0,s.jsxs)("div",{className:"bg-white border rounded-lg p-4",children:[(0,s.jsxs)("h4",{className:"text-sm font-semibold text-gray-900 mb-3 flex items-center",children:[s.jsx(P.Z,{className:"h-4 w-4 mr-2"}),"Deposit Slip"]}),(0,s.jsxs)("div",{className:"flex items-center space-x-4",children:[s.jsx("img",{src:g.deposit_slip_url,alt:"Deposit Slip",className:"w-20 h-20 object-cover rounded border"}),(0,s.jsxs)("div",{children:[s.jsx("p",{className:"text-sm text-gray-600",children:"Deposit slip uploaded"}),(0,s.jsxs)("button",{onClick:()=>{T(g.deposit_slip_url),R(g),L(!0)},className:"inline-flex items-center text-blue-600 hover:text-blue-800 text-sm mt-1",children:[s.jsx(_.Z,{className:"h-3 w-3 mr-1"}),"View full size"]})]})]})]}),g.order_details&&g.order_details.length>0&&(0,s.jsxs)("div",{className:"bg-white border rounded-lg overflow-hidden",children:[s.jsx("div",{className:"px-4 py-3 bg-gray-50 border-b",children:(0,s.jsxs)("h4",{className:"text-sm font-semibold text-gray-900",children:["Order Items (",g.order_details.length,")"]})}),s.jsx("div",{className:"overflow-x-auto",children:(0,s.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:(0,s.jsxs)("tr",{children:[s.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Product"}),s.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Quantity"}),s.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Price"}),s.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Total"})]})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:g.order_details.sort((e,t)=>{let a=(e.products.category||"").localeCompare(t.products.category||"");return 0!==a?a:e.products.name.localeCompare(t.products.name)}).map(e=>(0,s.jsxs)("tr",{className:"hover:bg-gray-50",children:[s.jsx("td",{className:"px-4 py-3 whitespace-nowrap",children:(0,s.jsxs)("div",{children:[s.jsx("div",{className:"text-sm font-medium text-gray-900",children:e.products.name}),e.products.sku&&(0,s.jsxs)("div",{className:"text-xs text-gray-500",children:["SKU: ",e.products.sku]})]})}),(0,s.jsxs)("td",{className:"px-4 py-3 whitespace-nowrap text-sm text-gray-900",children:[e.quantity," ",e.products.unit]}),(0,s.jsxs)("td",{className:"px-4 py-3 whitespace-nowrap text-sm text-gray-900",children:["₱",e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,s.jsxs)("td",{className:"px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900",children:["₱",(e.unit_price*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]},e.id))})]})})]})]})]})}),D&&$&&s.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,s.jsxs)("div",{className:"relative top-4 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center mb-4 flex-shrink-0",children:[(0,s.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Returnable Pans Image",(()=>{let e=getReturnablePans(A);return e.total>0?` (${e.total} pans)`:""})()]}),s.jsx("button",{onClick:()=>{O(!1),F(null),q(null)},className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]}),s.jsx("div",{className:"text-center flex-1 flex items-center justify-center overflow-auto",children:s.jsx("img",{src:$,alt:"Returnable pans",className:"max-h-[70vh] w-auto rounded-lg border"})})]})}),E&&M&&s.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,s.jsxs)("div",{className:"relative top-4 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center mb-4 flex-shrink-0",children:[(0,s.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Deposit Slip",I&&` - ₱${I.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}`]}),s.jsx("button",{onClick:()=>{L(!1),T(null),R(null)},className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]}),s.jsx("div",{className:"text-center flex-1 flex items-center justify-center overflow-auto",children:s.jsx("img",{src:M,alt:"Deposit slip",className:"max-h-[70vh] w-auto rounded-lg border"})})]})})]})}var O=a(1910),$=a(1922),F=a(4904),A=a(279);function LogisticsManager({selectedBrand:e,theme:t="blue"}){let[a,r]=(0,i.useState)(new Date),[l,n]=(0,i.useState)([]),[o,c]=(0,i.useState)([]),[u,g]=(0,i.useState)(!1),[p,b]=(0,i.useState)({x:0,y:0}),[f,v]=(0,i.useState)(""),[j,w]=(0,i.useState)("morning"),[N,_]=(0,i.useState)(!1),[k,S]=(0,i.useState)("all"),[D,C]=(0,i.useState)("asc");(0,i.useEffect)(()=>{e&&(fetchAssignments(),fetchAvailableOrders())},[e,a]);let fetchAssignments=async()=>{if(e){_(!0);try{let e=new Date(a.getFullYear(),a.getMonth(),1),t=new Date(a.getFullYear(),a.getMonth()+1,0),{data:s,error:r}=await d.O.from("logistics_assignments").select(`
          *,
           order:customer_orders(
             id,
             customer_name,
             total_amount,
             delivery_type,
             created_at,
             brand_id,
             brand:brands(name),
             location:locations(name)
           )
        `).gte("date",(0,h.jA)(e)).lte("date",(0,h.jA)(t)).order("date",{ascending:!0});if(r){console.error("Error fetching assignments:",r);return}n(s||[])}catch(e){console.error("Error fetching assignments:",e)}finally{_(!1)}}},fetchAvailableOrders=async()=>{if(e)try{let{data:t,error:a}=await d.O.from("customer_orders").select(`
           id,
           customer_name,
           total_amount,
           delivery_type,
           status,
           created_at,
           brand_id,
           brand:brands(name),
           location:locations(name)
         `).eq("brand_id",e.id).eq("status","approved").order("created_at",{ascending:!1});if(a){console.error("Error fetching orders:",a);return}console.log("Fetched orders:",t),c(t||[])}catch(e){console.error("Error fetching orders:",e)}},handleCreateAssignment=async(e,t,a)=>{try{let{data:s,error:r}=await d.O.from("logistics_assignments").insert({order_id:e,date:t,time_slot:a,status:"scheduled",notes:null}).select();if(r){console.error("Error creating assignment:",r);return}await fetchAssignments()}catch(e){console.error("Error creating assignment:",e)}},handleDeleteAssignment=async e=>{if(confirm("Are you sure you want to delete this assignment?"))try{let{error:t}=await d.O.from("logistics_assignments").delete().eq("id",e);if(t){console.error("Error deleting assignment:",t);return}await fetchAssignments()}catch(e){console.error("Error deleting assignment:",e)}},P=(0,i.useCallback)((e,t)=>{let a=l.filter(a=>a.date===e&&a.time_slot===t);return"all"!==k&&(a=a.filter(e=>e.order?.delivery_type===k)),a.sort((e,t)=>{let a=e.order?.delivery_type||"delivery",s=t.order?.delivery_type||"delivery";return"asc"===D?a.localeCompare(s):s.localeCompare(a)}),a},[l,k,D]),q=(0,i.useCallback)((e,t)=>{let a={mychoice:{morning:"bg-green-100 border-green-400 border-l-4",afternoon:"bg-green-100 border-green-400 border-l-4"},"mang sorbetes":{morning:"bg-yellow-100 border-yellow-400 border-l-4",afternoon:"bg-yellow-100 border-yellow-400 border-l-4"},gelatofilipino:{morning:"bg-red-100 border-red-400 border-l-4",afternoon:"bg-red-100 border-red-400 border-l-4"}},s=t?.toLowerCase();if(s&&a[s])return console.log(`Brand: ${t} -> Custom color`),a[s];let r=t||e,l=0;for(let e=0;e<r.length;e++)l=(l<<5)-l+r.charCodeAt(e)&4294967295;let i=Math.abs(l)%3;switch(console.log(`Brand: ${t||e} -> Hash color (index: ${i})`),i){case 0:return{morning:"bg-blue-100 border-blue-400 border-l-4",afternoon:"bg-blue-100 border-blue-400 border-l-4"};case 1:return{morning:"bg-purple-100 border-purple-400 border-l-4",afternoon:"bg-purple-100 border-purple-400 border-l-4"};default:return{morning:"bg-gray-100 border-gray-400 border-l-4",afternoon:"bg-gray-100 border-gray-400 border-l-4"}}},[]);(0,i.useMemo)(()=>{let e=t||"";return"green"===e?{morning:"bg-green-100 border-green-400",afternoon:"bg-emerald-100 border-emerald-400"}:"red"===e?{morning:"bg-red-100 border-red-400",afternoon:"bg-pink-100 border-pink-400"}:"yellow"===e?{morning:"bg-yellow-100 border-yellow-400",afternoon:"bg-amber-100 border-amber-400"}:"blue"===e?{morning:"bg-blue-100 border-blue-400",afternoon:"bg-cyan-100 border-cyan-400"}:"purple"===e?{morning:"bg-purple-100 border-purple-400",afternoon:"bg-violet-100 border-violet-400"}:{morning:"bg-gray-100 border-gray-400",afternoon:"bg-slate-100 border-slate-400"}},[t]);let E=(0,i.useMemo)(()=>{let e=a.getFullYear(),t=a.getMonth(),s=new Date(e,t,1),r=new Date(e,t+1,0),l=r.getDate(),i=s.getDay(),n=[];for(let e=0;e<i;e++)n.push(null);for(let a=1;a<=l;a++)n.push(new Date(e,t,a));return n},[a]),navigateMonth=e=>{r(t=>{let a=new Date(t);return"prev"===e?a.setMonth(t.getMonth()-1):a.setMonth(t.getMonth()+1),a})},openOrderPopup=(e,t,a)=>{v(t),w(a),b({x:e.clientX,y:e.clientY}),g(!0),fetchAssignments()},formatDate=e=>(0,h.jA)(e),isToday=e=>{let t=new Date;return(0,h.jA)(e)===(0,h.jA)(t)},isPastDate=e=>{let t=new Date,a=(0,h.jA)(t),s=(0,h.jA)(e);return s<a},isUpcomingDate=e=>{let t=new Date,a=(0,h.jA)(t),s=(0,h.jA)(e);return s>a},isYesterday=e=>{let t=new Date,a=new Date(t);return a.setDate(t.getDate()-1),(0,h.jA)(e)===(0,h.jA)(a)};return(0,s.jsxs)("div",{className:"space-y-6",children:[(0,s.jsxs)("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0",children:[(0,s.jsxs)("div",{children:[s.jsx("h1",{className:"text-xl font-semibold text-gray-900",children:"Logistics"}),s.jsx("p",{className:"text-sm text-gray-600",children:"Schedule and manage order deliveries"})]}),s.jsx("div",{className:"flex items-center space-x-4",children:(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx("label",{className:"text-sm font-medium text-gray-700",children:"Filter:"}),(0,s.jsxs)("select",{value:k,onChange:e=>S(e.target.value),className:"px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500",children:[s.jsx("option",{value:"all",children:"All"}),s.jsx("option",{value:"delivery",children:"Delivery"}),s.jsx("option",{value:"pickup",children:"Pickup"})]})]})})]}),(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between mb-6",children:[s.jsx("button",{onClick:()=>navigateMonth("prev"),className:"p-2 rounded-lg hover:bg-gray-100 transition-colors",children:s.jsx(O.Z,{className:"h-5 w-5 text-gray-600"})}),s.jsx("h2",{className:"text-xl font-semibold text-gray-900",children:a.toLocaleDateString("en-US",{month:"long",year:"numeric"})}),s.jsx("button",{onClick:()=>navigateMonth("next"),className:"p-2 rounded-lg hover:bg-gray-100 transition-colors",children:s.jsx($.Z,{className:"h-5 w-5 text-gray-600"})})]}),N?(0,s.jsxs)("div",{className:"grid grid-cols-7 gap-1",children:[["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(e=>s.jsx("div",{className:"p-3 text-center text-sm font-medium text-gray-500 bg-gray-50 rounded-lg",children:e},e)),[...Array(35)].map((e,t)=>(0,s.jsxs)("div",{className:"p-2 border rounded-lg min-h-[120px] bg-white border-gray-200",children:[s.jsx("div",{className:"h-4 bg-gray-200 rounded w-6 mb-2 animate-pulse"}),(0,s.jsxs)("div",{className:"mb-2",children:[s.jsx("div",{className:"h-3 bg-gray-200 rounded w-16 mb-1 animate-pulse"}),s.jsx("div",{className:"h-8 bg-gray-200 rounded animate-pulse"})]}),(0,s.jsxs)("div",{children:[s.jsx("div",{className:"h-3 bg-gray-200 rounded w-16 mb-1 animate-pulse"}),s.jsx("div",{className:"h-8 bg-gray-200 rounded animate-pulse"})]})]},t))]}):(0,s.jsxs)("div",{className:"grid grid-cols-7 gap-1",children:[["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(e=>s.jsx("div",{className:"p-3 text-center text-sm font-medium text-gray-500 bg-gray-50 rounded-lg",children:e},e)),E.map((e,t)=>{if(!e)return s.jsx("div",{className:"p-3"},t);let a=formatDate(e),r=P(a,"morning"),l=P(a,"afternoon"),i=isToday(e),n=isPastDate(e),d=isYesterday(e),o=isUpcomingDate(e);return(0,s.jsxs)("div",{className:`p-2 border rounded-lg min-h-[120px] ${n&&!d?"bg-gray-100 border-gray-300 opacity-60":d?"bg-gray-100 border-gray-300 opacity-75":i?"bg-blue-50 border border-blue-500 ring-2 ring-blue-300 shadow-md":o?"bg-white border-gray-300":"bg-white border-gray-200"}`,children:[s.jsx("div",{className:"text-sm font-medium text-gray-900 mb-2",children:e.getDate()}),(0,s.jsxs)("div",{className:"mb-2",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between mb-1",children:[(0,s.jsxs)("div",{className:"flex items-center gap-1",children:[s.jsx(F.Z,{className:"h-3 w-3 text-yellow-500"}),s.jsx("span",{className:"text-xs text-gray-500",children:"Morning"})]}),s.jsx("button",{onClick:e=>(!n||d)&&openOrderPopup(e,a,"morning"),disabled:n&&!d,className:`text-xs ${n&&!d?"text-gray-400 cursor-not-allowed":"text-blue-600 hover:text-blue-800"}`,children:s.jsx(m.Z,{className:"h-3 w-3 text-gray-600"})})]}),s.jsx("div",{className:"space-y-1",children:r.map(e=>{let t=q(e.order?.brand_id||"",e.order?.brand?.name);return(0,s.jsxs)("div",{className:`text-xs p-1 ${t.morning} rounded border-l-2 flex flex-col group relative`,children:[s.jsx("div",{className:"font-medium text-gray-900 truncate",children:e.order?.location?.name}),(0,s.jsxs)("div",{className:"flex items-center justify-between mt-1",children:[s.jsx("div",{className:"text-gray-600 text-xs",children:e.order?.created_at?new Date(e.order.created_at).toLocaleDateString():"No Date"}),(0,s.jsxs)("div",{className:"flex items-center gap-0.5",children:[e.order?.delivery_type==="pickup"&&s.jsx(y.Z,{className:"h-3 w-3 text-orange-600"}),s.jsx("button",{onClick:()=>handleDeleteAssignment(e.id),className:"p-0.5 text-red-600 hover:text-red-800 hover:bg-red-200 rounded opacity-0 group-hover:opacity-100 transition-opacity",title:"Remove assignment",children:s.jsx(x.Z,{className:"h-3 w-3"})})]})]})]},e.id)})})]}),(0,s.jsxs)("div",{children:[(0,s.jsxs)("div",{className:"flex items-center justify-between mb-1",children:[(0,s.jsxs)("div",{className:"flex items-center gap-1",children:[s.jsx(A.Z,{className:"h-3 w-3 text-blue-500"}),s.jsx("span",{className:"text-xs text-gray-500",children:"Afternoon"})]}),s.jsx("button",{onClick:e=>(!n||d)&&openOrderPopup(e,a,"afternoon"),disabled:n&&!d,className:`text-xs ${n&&!d?"text-gray-400 cursor-not-allowed":"text-blue-600 hover:text-blue-800"}`,children:s.jsx(m.Z,{className:"h-3 w-3 text-gray-600"})})]}),s.jsx("div",{className:"space-y-1",children:l.map(e=>{let t=q(e.order?.brand_id||"",e.order?.brand?.name);return(0,s.jsxs)("div",{className:`text-xs p-1 ${t.afternoon} rounded border-l-2 flex flex-col group relative`,children:[s.jsx("div",{className:"font-medium text-gray-900 truncate",children:e.order?.location?.name}),(0,s.jsxs)("div",{className:"flex items-center justify-between mt-1",children:[s.jsx("div",{className:"text-gray-600 text-xs",children:e.order?.created_at?new Date(e.order.created_at).toLocaleDateString():"No Date"}),(0,s.jsxs)("div",{className:"flex items-center gap-0.5",children:[e.order?.delivery_type==="pickup"&&s.jsx(y.Z,{className:"h-3 w-3 text-orange-600"}),s.jsx("button",{onClick:()=>handleDeleteAssignment(e.id),className:"p-0.5 text-red-600 hover:text-red-800 hover:bg-red-200 rounded opacity-0 group-hover:opacity-100 transition-opacity",title:"Remove assignment",children:s.jsx(x.Z,{className:"h-3 w-3"})})]})]})]},e.id)})})]})]},t)})]})]}),u&&s.jsx("div",{className:"fixed inset-0 z-50",onClick:()=>g(!1),children:(0,s.jsxs)("div",{className:"absolute bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm max-h-80 overflow-y-auto",style:{left:Math.min(p.x,window.innerWidth-320),top:Math.min(p.y,window.innerHeight-200)},onClick:e=>e.stopPropagation(),children:[(0,s.jsxs)("div",{className:"flex justify-between items-center mb-3",children:[(0,s.jsxs)("h3",{className:"text-sm font-semibold text-gray-900",children:["Select Order - ","morning"===j?"Morning":"Afternoon"]}),s.jsx("button",{onClick:()=>g(!1),className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-4 w-4"})})]}),s.jsx("div",{className:"space-y-2",children:(()=>{let a=l.map(e=>e.order_id),r=o.filter(e=>!a.includes(e.id));return console.log("Available orders:",o),console.log("All assignments:",l),console.log("Assigned order IDs:",a),console.log("Unassigned orders:",r),console.log("Selected brand:",e),0===r.length?s.jsx("p",{className:"text-sm text-gray-500",children:"No available orders"}):r.map(e=>(0,s.jsxs)("button",{onClick:()=>{handleCreateAssignment(e.id,f,j),g(!1)},className:"w-full text-left p-2 hover:bg-gray-100 rounded border border-gray-200",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between mb-1",children:[(0,s.jsxs)("div",{className:"flex items-center gap-2",children:[s.jsx("span",{className:"text-sm font-medium text-gray-900",children:e.location?.name}),"pickup"===e.delivery_type&&s.jsx(y.Z,{className:"h-4 w-4 text-orange-600"})]}),s.jsx("span",{className:`px-2 py-1 text-xs rounded-full ${(()=>{let e=t||"";return"green"===e?"bg-green-100 text-green-800":"red"===e?"bg-red-100 text-red-800":"yellow"===e?"bg-yellow-100 text-yellow-800":"blue"===e?"bg-blue-100 text-blue-800":"purple"===e?"bg-purple-100 text-purple-800":"bg-gray-100 text-gray-800"})()}`,children:e.brand?.name||"Unknown"})]}),(0,s.jsxs)("div",{className:"text-xs text-gray-600",children:[e.created_at?new Date(e.created_at).toLocaleDateString():"No Date"," - #",e.id.slice(-8)]})]},e.id))})()})]})})]})}var q=a(3086),E=a(8917),L=a(7094),M=a(517),T=a(3680),I=a(3310),R=a(4571),z=a(5808),Z=a(8535),H=a(9490),B=a(644);function StaffManager({theme:e="blue"}){let[t,a]=(0,i.useState)(!0),[r,l]=(0,i.useState)(!1),[o,c]=(0,i.useState)(""),[u,g]=(0,i.useState)(""),[h,b]=(0,i.useState)([]),[f,y]=(0,i.useState)([]),[v,j]=(0,i.useState)([]),[N,_]=(0,i.useState)(null),[k,S]=(0,i.useState)(null),[D,C]=(0,i.useState)(""),[P,F]=(0,i.useState)(!1),[A,q]=(0,i.useState)(!1),[U,W]=(0,i.useState)(null),[V,Y]=(0,i.useState)([]),[G,Q]=(0,i.useState)(!1),[K,J]=(0,i.useState)(null),[X,ee]=(0,i.useState)(""),[et,ea]=(0,i.useState)(!1),[es,er]=(0,i.useState)(!1),[el,ei]=(0,i.useState)([]),[en,ed]=(0,i.useState)(null),[eo,ec]=(0,i.useState)(!1),[em,ex]=(0,i.useState)(!1),[eu,eg]=(0,i.useState)(null),[ep,eh]=(0,i.useState)({title:"",message:"",type:"general"}),[eb,ef]=(0,i.useState)({title:"",message:"",type:"notice"}),[ey,ev]=(0,i.useState)([]),[ej,ew]=(0,i.useState)([]),[eN,e_]=(0,i.useState)(!1),[ek,eS]=(0,i.useState)(!1),[eD,eC]=(0,i.useState)({title:!1,message:!1}),[eP,eO]=(0,i.useState)({title:!1,message:!1}),[e$,eF]=(0,i.useState)({full_name:"",mobile_number:"",staff_code:"",hourly_rate:0,employment_date:"",leave_balance:10,total_warnings:0}),[eA,eq]=(0,i.useState)(!1),[eE,eL]=(0,i.useState)({brand_id:"",location_id:""}),[eM,eT]=(0,i.useState)(!1),[eI,eR]=(0,i.useState)(new Date),[ez,eZ]=(0,i.useState)({}),[eH,eB]=(0,i.useState)({}),[eU,eW]=(0,i.useState)({}),[eV,eY]=(0,i.useState)({}),[eG,eQ]=(0,i.useState)([]),[eK,eJ]=(0,i.useState)([]),[eX,e0]=(0,i.useState)({}),[e1,e2]=(0,i.useState)(!1),[e6,e5]=(0,i.useState)({}),[e4,e3]=(0,i.useState)({}),[e9,e7]=(0,i.useState)({}),[e8,te]=(0,i.useState)(null),[tt,ta]=(0,i.useState)(!1),[ts,tr]=(0,i.useState)({full_name:"",mobile_number:"",staff_code:"",hourly_rate:0,employment_date:"",leave_balance:10}),tl=(0,i.useMemo)(()=>{switch(e){case"green":return{primary:"bg-green-600 hover:bg-green-700",secondary:"bg-green-100 text-green-800",border:"border-green-300",focus:"focus:ring-green-500 focus:border-green-500",danger:"bg-red-600 hover:bg-red-700"};case"red":return{primary:"bg-red-600 hover:bg-red-700",secondary:"bg-red-100 text-red-800",border:"border-red-300",focus:"focus:ring-red-500 focus:border-red-500",danger:"bg-red-600 hover:bg-red-700"};case"yellow":return{primary:"bg-yellow-600 hover:bg-yellow-700",secondary:"bg-yellow-100 text-yellow-800",border:"border-yellow-300",focus:"focus:ring-yellow-500 focus:border-yellow-500",danger:"bg-red-600 hover:bg-red-700"};default:return{primary:"bg-blue-600 hover:bg-blue-700",secondary:"bg-blue-100 text-blue-800",border:"border-blue-300",focus:"focus:ring-blue-500 focus:border-blue-500",danger:"bg-red-600 hover:bg-red-700"}}},[e]);(0,i.useEffect)(()=>{loadData(),loadTodaySchedules(),loadLeaveRequests()},[]),(0,i.useEffect)(()=>{eM&&loadExistingSchedule()},[eI,eM]),(0,i.useEffect)(()=>{tt&&hasScheduleChanges()&&ta(!1)},[ez,eU,e6,e9]);let loadData=async()=>{a(!0);try{let{data:e,error:t}=await d.O.from("staff_registrations").select(`
          *,
          staff_assignments (
            id,
            location_id,
            assigned_by_location_id,
            created_at,
            location:locations!staff_assignments_location_id_fkey (
              id,
              name,
              brand_id,
              brand:brands!locations_brand_id_fkey (
                id,
                name
              )
            ),
            assigned_by_location:locations!staff_assignments_assigned_by_location_id_fkey (
              id,
              name,
              brand_id,
              brand:brands!locations_brand_id_fkey (
                id,
                name
              )
            )
          )
        `).order("created_at",{ascending:!1});if(t)throw t;let{data:a,error:s}=await d.O.from("locations").select(`
          *,
          brand:brands!locations_brand_id_fkey (
            id,
            name
          )
        `).order("name");if(s)throw s;let{data:r,error:l}=await d.O.from("brands").select("*").order("name");if(l)throw l;let i=(e||[]).sort((e,t)=>{if(0===e.staff_assignments.length&&t.staff_assignments.length>0)return 1;if(e.staff_assignments.length>0&&0===t.staff_assignments.length)return -1;if(0===e.staff_assignments.length&&0===t.staff_assignments.length)return e.full_name.localeCompare(t.full_name);let a=e.staff_assignments[0]?.location?.name||"",s=t.staff_assignments[0]?.location?.name||"";return a.localeCompare(s)});b(i),y(a||[]),j(r||[])}catch(e){console.error("Error loading data:",e),c("Failed to load staff data")}finally{a(!1)}},generateStaffCode=()=>{let e="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",t="";for(let a=0;a<8;a++)t+=e.charAt(Math.floor(Math.random()*e.length));return t},loadLeaveRequests=async()=>{try{let{data:e,error:t}=await d.O.from("leave_requests").select(`
          *,
          staff_registrations!staff_registration_id(*),
          locations!location_id(*)
        `).eq("status","pending").order("created_at",{ascending:!1});if(t)throw t;Y(e||[])}catch(e){console.error("Error loading leave requests:",e)}},calculateDays=(e,t)=>{let a=new Date(e),s=new Date(t),r=Math.abs(s.getTime()-a.getTime());return Math.ceil(r/864e5)+1},openLeaveRequestModal=e=>{J(e),ee(e.admin_notes||""),Q(!0)},handleLeaveRequestDecision=async e=>{if(K){l(!0);try{let{error:t}=await d.O.from("leave_requests").update({status:e,admin_notes:X.trim()||null,approved_at:new Date().toISOString()}).eq("id",K.id);if(t)throw t;if("approved"===e&&"absence_authorized"!==K.request_type){let e=calculateDays(K.start_date,K.end_date),t=K.staff_registrations.leave_balance??10,a=Math.max(0,t-e),{error:s}=await d.O.from("staff_registrations").update({leave_balance:a}).eq("id",K.staff_registration_id);if(s){console.error("Error updating leave balance:",s),c("Leave request approved but failed to update balance");return}b(e=>e.map(e=>e.id===K.staff_registration_id?{...e,leave_balance:a}:e))}await loadLeaveRequests(),Q(!1),J(null),ee(""),g(`Leave request ${e} successfully!`),setTimeout(()=>g(""),3e3)}catch(e){console.error("Error updating leave request:",e),c("Failed to update leave request")}finally{l(!1)}}},openLeaveHistoryModal=async e=>{ed(e),er(!0);try{let{data:t,error:a}=await d.O.from("leave_requests").select(`
          *,
          locations!location_id(*)
        `).eq("staff_registration_id",e.id).order("created_at",{ascending:!1});if(a)throw a;ei(t||[])}catch(e){console.error("Error loading staff leave history:",e),c("Failed to load leave history")}},deleteLeaveRequest=async(e,t)=>{if(confirm("Are you sure you want to delete this leave request? This action cannot be undone.")){l(!0);try{let{error:t}=await d.O.from("leave_requests").delete().eq("id",e);if(t)throw t;ei(t=>t.filter(t=>t.id!==e)),g("Leave request deleted successfully!"),setTimeout(()=>g(""),3e3)}catch(e){console.error("Error deleting leave request:",e),c("Failed to delete leave request")}finally{l(!1)}}},loadAnnouncementHistory=async()=>{e_(!0);try{let{data:e,error:t}=await d.O.from("announcements").select("*").is("staff_registration_id",null).in("type",["general","reminder"]).order("created_at",{ascending:!1}).limit(10);if(t)throw t;ev(e||[])}catch(e){console.error("Error loading announcement history:",e)}finally{e_(!1)}},loadMessageHistory=async e=>{eS(!0);try{let{data:t,error:a}=await d.O.from("announcements").select("*").eq("staff_registration_id",e).order("created_at",{ascending:!1}).limit(10);if(a)throw a;ew(t||[])}catch(e){console.error("Error loading message history:",e)}finally{eS(!1)}},createAnnouncement=async()=>{let e=!ep.title.trim(),t=!ep.message.trim();if(e||t){eC({title:e,message:t}),setTimeout(()=>eC({title:!1,message:!1}),2e3);return}l(!0);try{let{error:e}=await d.O.from("announcements").insert({title:ep.title.trim(),message:ep.message.trim(),type:ep.type,staff_registration_id:null,created_by:"Admin",is_active:!0});if(e)throw e;eh({title:"",message:"",type:"general"}),await loadAnnouncementHistory(),g("General announcement created successfully!"),setTimeout(()=>g(""),3e3)}catch(e){console.error("Error creating announcement:",e),c("Failed to create announcement")}finally{l(!1)}},openAnnouncementModal=async()=>{eh({title:"",message:"",type:"general"}),ev([]),ec(!0),await loadAnnouncementHistory()},openMessageModal=async e=>{eg(e),ef({title:"",message:"",type:"notice"}),ew([]),ex(!0),await loadMessageHistory(e.id)},sendStaffMessage=async()=>{if(!eu)return;let e=!eb.title.trim(),t=!eb.message.trim();if(e||t){eO({title:e,message:t}),setTimeout(()=>eO({title:!1,message:!1}),2e3);return}l(!0);try{let{error:e}=await d.O.from("announcements").insert({title:eb.title.trim(),message:eb.message.trim(),type:eb.type,staff_registration_id:eu.id,created_by:"Admin",is_active:!0});if(e)throw e;ef({title:"",message:"",type:"notice"}),await loadMessageHistory(eu.id),g(`${"warning"===eb.type?"Warning":"Notice"} sent to ${eu.full_name}!`),setTimeout(()=>g(""),3e3)}catch(e){console.error("Error sending message:",e),c("Failed to send message")}finally{l(!1)}},deleteAnnouncement=async e=>{if(confirm("Are you sure you want to delete this announcement? This action cannot be undone.")){l(!0);try{let{error:t}=await d.O.from("announcements").delete().eq("id",e);if(t)throw t;await loadAnnouncementHistory(),g("Announcement deleted successfully!"),setTimeout(()=>g(""),3e3)}catch(e){console.error("Error deleting announcement:",e),c("Failed to delete announcement")}finally{l(!1)}}},deleteMessage=async(e,t)=>{if(confirm("Are you sure you want to delete this message? This action cannot be undone.")){l(!0);try{let{error:a}=await d.O.from("announcements").delete().eq("id",e);if(a)throw a;await loadMessageHistory(t),g("Message deleted successfully!"),setTimeout(()=>g(""),3e3)}catch(e){console.error("Error deleting message:",e),c("Failed to delete message")}finally{l(!1)}}},addStaff=async()=>{l(!0);try{let e=ts.staff_code.trim()||generateStaffCode(),{data:t,error:a}=await d.O.from("staff_registrations").insert({full_name:ts.full_name.trim(),mobile_number:ts.mobile_number.trim(),staff_code:e,hourly_rate:ts.hourly_rate,employment_date:ts.employment_date,leave_balance:ts.leave_balance,is_active:!0}).select().single();if(a)throw a;let s={...t,staff_assignments:[]};b(e=>[...e,s]),tr({full_name:"",mobile_number:"",staff_code:"",hourly_rate:0,employment_date:"",leave_balance:10}),F(!1),g("Staff member added successfully!"),setTimeout(()=>g(""),3e3)}catch(e){console.error("Error adding staff:",e),c("Failed to add staff member")}finally{l(!1)}},deleteStaff=async e=>{if(confirm("Are you sure you want to delete this staff member? This will also remove all their assignments.")){l(!0);try{let{error:t}=await d.O.from("staff_assignments").delete().eq("staff_registration_id",e);if(t)throw t;let{error:a}=await d.O.from("staff_registrations").delete().eq("id",e);if(a)throw a;b(t=>t.filter(t=>t.id!==e)),U&&U.id===e&&(q(!1),W(null)),g("Staff member deleted successfully!"),setTimeout(()=>g(""),3e3)}catch(e){console.error("Error deleting staff:",e),c("Failed to delete staff member")}finally{l(!1)}}},toggleStaffStatus=async(e,t)=>{l(!0);try{let{error:a}=await d.O.from("staff_registrations").update({is_active:!t}).eq("id",e);if(a)throw a;b(a=>a.map(a=>a.id===e?{...a,is_active:!t,updated_at:new Date().toISOString()}:a)),U&&U.id===e&&W(e=>({...e,is_active:!t,updated_at:new Date().toISOString()})),g(`Staff member ${t?"deactivated":"activated"} successfully!`),setTimeout(()=>g(""),3e3)}catch(e){console.error("Error updating staff status:",e),c("Failed to update staff status")}finally{l(!1)}},openEditModal=e=>{W(e),eF({full_name:e.full_name,mobile_number:e.mobile_number,staff_code:e.staff_code,hourly_rate:e.hourly_rate||0,employment_date:e.employment_date||"",leave_balance:e.leave_balance||10,total_warnings:e.total_warnings||0}),q(!0)},saveEditModal=async()=>{if(U){l(!0);try{let{error:e}=await d.O.from("staff_registrations").update({full_name:e$.full_name.trim(),mobile_number:e$.mobile_number.trim(),staff_code:e$.staff_code.trim(),hourly_rate:e$.hourly_rate,employment_date:e$.employment_date,leave_balance:e$.leave_balance,total_warnings:e$.total_warnings}).eq("id",U.id);if(e)throw e;b(e=>e.map(e=>e.id===U.id?{...e,...e$,updated_at:new Date().toISOString()}:e)),W(e=>({...e,...e$,updated_at:new Date().toISOString()})),q(!1),g("Staff member updated successfully!"),setTimeout(()=>g(""),3e3)}catch(e){console.error("Error updating staff:",e),c("Failed to update staff member")}finally{l(!1)}}},addAssignment=async()=>{if(!U||!eE.brand_id||!eE.location_id){c("Please select both brand and location");return}l(!0);try{let{error:e}=await d.O.from("staff_assignments").insert({staff_registration_id:U.id,location_id:eE.location_id,assigned_by_location_id:eE.location_id});if(e)throw e;let t=f.find(e=>e.id===eE.location_id),a=v.find(e=>e.id===eE.brand_id);if(t&&a){let e={id:Date.now().toString(),staff_registration_id:U.id,location_id:eE.location_id,assigned_by_location_id:eE.location_id,created_at:new Date().toISOString(),location:{id:t.id,name:t.name,brand_id:a.id,brand:{id:a.id,name:a.name}},assigned_by_location:{id:t.id,name:t.name,brand_id:a.id,brand:{id:a.id,name:a.name}}};U&&W(t=>({...t,staff_assignments:[...t.staff_assignments,e]})),b(t=>t.map(t=>t.id===U?.id?{...t,staff_assignments:[...t.staff_assignments,e]}:t)),loadTodaySchedules()}eL({brand_id:"",location_id:""}),eq(!1),g("Assignment added successfully!"),setTimeout(()=>g(""),3e3)}catch(e){console.error("Error adding assignment:",e),c("Failed to add assignment")}finally{l(!1)}},removeAssignment=async e=>{if(confirm("Are you sure you want to remove this assignment?")){l(!0);try{let{error:t}=await d.O.from("staff_assignments").delete().eq("id",e);if(t)throw t;U&&W(t=>({...t,staff_assignments:t.staff_assignments.filter(t=>t.id!==e)})),b(t=>t.map(t=>t.id===U?.id?{...t,staff_assignments:t.staff_assignments.filter(t=>t.id!==e)}:t)),loadTodaySchedules(),g("Assignment removed successfully!"),setTimeout(()=>g(""),3e3)}catch(e){console.error("Error removing assignment:",e),c("Failed to remove assignment")}finally{l(!1)}}},formatDate=e=>new Date(e).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}),getFilteredLocations=()=>{if(!eE.brand_id||!U)return[];let e=f.filter(e=>e.brand_id===eE.brand_id),t=U.staff_assignments.map(e=>e.location_id);return e.filter(e=>!t.includes(e.id))},handleBrandChange=e=>{eL({brand_id:e,location_id:""})},loadCompanyData=async()=>{try{let[e,t]=await Promise.all([d.O.from("locations").select("id, name, brand_id, company_owned, brand:brands!locations_brand_id_fkey(id, name)").eq("company_owned",!0).order("name"),d.O.from("staff_registrations").select(`
            id,
            full_name,
            staff_assignments (
              id,
              location_id,
              location:locations!staff_assignments_location_id_fkey (
                id,
                name,
                brand_id,
                company_owned,
                brand:brands!locations_brand_id_fkey (
                  id,
                  name
                )
              )
            )
          `).eq("is_active",!0).order("full_name")]);if(e.error)throw e.error;if(t.error)throw t.error;let a=e.data?.filter(e=>!e.name.toLowerCase().includes("factory"))||[],s=new Set(a.map(e=>e.id)),r=t.data?.filter(e=>e.staff_assignments.some(e=>e.location?.company_owned&&s.has(e.location_id)))||[];eQ(a),eJ(r)}catch(e){console.error("Error loading company data:",e),c("Failed to load company staff and locations")}},getWeekDates=e=>{let t=new Date(e);t.setDate(e.getDate()-e.getDay());let a=[];for(let e=0;e<7;e++){let s=new Date(t);s.setDate(t.getDate()+e),a.push(s)}return a},getDayName=e=>e.toLocaleDateString("en-US",{weekday:"short"}).toUpperCase(),getDateNumber=e=>e.getDate(),isToday=e=>{let t=new Date;return e.toDateString()===t.toDateString()},formatDateLocal=e=>{let t=e.getFullYear(),a=String(e.getMonth()+1).padStart(2,"0"),s=String(e.getDate()).padStart(2,"0");return`${t}-${a}-${s}`},loadTodaySchedules=async()=>{try{let e=formatDateLocal(new Date),{data:t,error:a}=await d.O.from("staff_schedules").select("staff_registration_id, location_id, location:locations!staff_schedules_location_id_fkey (id, name, brand:brands (id, name))").eq("schedule_date",e);if(a)throw a;let s={};t?.forEach(e=>{s[e.staff_registration_id]=e}),e0(s)}catch(e){console.error("Error loading today's schedules:",e)}},isStaffScheduledToday=e=>eX[e]||null,ti=(0,i.useMemo)(()=>e1?h.filter(e=>{let t=isStaffScheduledToday(e.id);return null!==t}):h,[h,e1,eX]),tn=(0,i.useMemo)(()=>ti.reduce((e,t)=>{let a=t.staff_assignments[0]?.location?.name||"Unassigned";return e[a]||(e[a]=[]),e[a].push(t),e},{}),[ti]),loadExistingSchedule=async()=>{try{let e=getWeekDates(eI),t=formatDateLocal(e[0]),a=formatDateLocal(e[6]),{data:s,error:r}=await d.O.from("staff_schedules").select("staff_registration_id, location_id, schedule_date, hours, is_absent, day_type").gte("schedule_date",t).lte("schedule_date",a).order("schedule_date");if(r)throw r;let l={},i={},n={},o={};s?.forEach(e=>{let t=getScheduleKey(new Date(e.schedule_date)),a=e.location_id,s=e.staff_registration_id;a&&(l[a]||(l[a]={},i[a]={},o[a]={}),l[a][t]||(l[a][t]=[],i[a][t]={},o[a][t]={}),l[a][t].includes(s)||l[a][t].push(s),i[a][t][s]=e.hours||11,o[a][t][s]=e.is_absent||!1,!n[t]&&e.day_type&&(n[t]=e.day_type))});let deepCopy=e=>"undefined"!=typeof structuredClone?structuredClone(e):JSON.parse(JSON.stringify(e));eZ(l),eB(deepCopy(l)),eW(i),eY(deepCopy(i)),e5(n),e3(deepCopy(n)),e7(o)}catch(e){console.error("Error loading existing schedule:",e),c("Failed to load existing schedule")}},openScheduleModal=async()=>{console.log("\uD83D\uDE80 Opening schedule modal..."),g(""),eR(new Date),eT(!0),console.log("\uD83D\uDCE5 Loading company data and existing schedule..."),await Promise.all([loadCompanyData(),loadExistingSchedule()]),console.log("✅ Schedule modal data loaded!")},hasScheduleChanges=()=>{let e=Object.keys(ez),t=Object.keys(eH);if(e.length!==t.length)return!0;for(let t of e){let e=ez[t]||{},a=eH[t]||{},s=Object.keys(e),r=Object.keys(a);if(s.length!==r.length)return!0;for(let r of s){let s=e[r]||[],l=a[r]||[],i=Array.isArray(s)?s:s?[s]:[],n=Array.isArray(l)?l:l?[l]:[];if(i.length!==n.length)return!0;let d=[...i].sort(),o=[...n].sort();for(let e=0;e<d.length;e++)if(d[e]!==o[e])return!0;let c=Array.from(new Set([...i,...n]));for(let e of c){let a=getStaffHours(t,r,e),s=eV[t]?.[r]?.[e]||8;if(a!==s)return!0}}}let a=Object.keys(e6),s=Object.keys(e4);if(a.length!==s.length)return!0;for(let e of a){let t=e6[e]||"default",a=e4[e]||"default";if(t!==a)return!0}let r=Object.keys(e9);if(r.length>0)for(let e of r){let t=e9[e]||{};for(let e of Object.keys(t)){let a=t[e]||{};if(Object.keys(a).length>0)return!0}}return!1},getScheduleKey=e=>`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`,getStoreColor=e=>{let t=e.brand?.name?.toLowerCase()||"";return t.includes("mychoice")?"bg-green-100":t.includes("gelatofilipino")?"bg-red-100":"bg-gray-100"},getStaffForLocation=e=>eK.filter(t=>t.staff_assignments.some(t=>t.location_id===e)),getScheduledStaffForBranchAndDate=(e,t)=>{let a=ez[e]?.[t]||[];if(Array.isArray(a))return a.map(e=>eK.find(t=>t.id===e)).filter(Boolean);if(a){let e=eK.find(e=>e.id===a);return e?[e]:[]}return[]},addStaffToSchedule=async(e,t,a)=>{let s=ez[a]?.[t]||[],r=Array.isArray(s)?s:s?[s]:[],l=Object.keys(ez).some(s=>s!==a&&ez[s]?.[t]?.includes(e));if(l){c("This staff member is already assigned to another branch on this day");return}r.includes(e)||(eZ(s=>({...s,[a]:{...s[a],[t]:[...r,e]}})),eW(s=>({...s,[a]:{...s[a],[t]:{...s[a]?.[t],[e]:11}}})))},removeStaffFromSchedule=async(e,t,a)=>{let s=ez[a]?.[t]||[],r=Array.isArray(s)?s:s?[s]:[];eZ(s=>({...s,[a]:{...s[a],[t]:r.filter(t=>t!==e)}})),eW(s=>({...s,[a]:{...s[a],[t]:{...s[a]?.[t],[e]:void 0}}}))},getStaffHours=(e,t,a)=>eU[e]?.[t]?.[a]||11,updateStaffHours=(e,t,a,s)=>{eW(r=>({...r,[e]:{...r[e],[t]:{...r[e]?.[t],[a]:s}}}))},isStaffAbsent=(e,t,a)=>e9[e]?.[t]?.[a]||!1,toggleStaffAbsence=async(e,t,a)=>{let s=isStaffAbsent(e,t,a),r=eK.find(e=>e.id===a);if(!r)return;let l=t.match(/(\d{4})-(\d{2})-(\d{2})/);if(!l)return;let i=new Date(t).toLocaleDateString();if(s){let e=r.total_warnings??0,t=r.leave_balance??10;if(!confirm(`Remove absence for ${r.full_name} on ${i}?

This will:
• Restore hours to 11
• Delete the warning
• Remove 1 warning (${e} → ${Math.max(0,e-1)})
• Refund 1 day to leave balance (${t} → ${Math.min(10,t+1)} days)`))return}else{let e=r.total_warnings??0,t=r.leave_balance??10;if(!confirm(`Mark ${r.full_name} as absent on ${i}?

This will:
• Set hours to 0
• Create a warning (absence_admin)
• Add 1 warning (${e} → ${e+1})
• Deduct 1 day from leave balance (${t} → ${t-1} days)`))return}if(e7(r=>({...r,[e]:{...r[e],[t]:{...r[e]?.[t],[a]:!s}}})),s){updateStaffHours(e,t,a,11);try{let{data:e,error:s}=await d.O.from("leave_requests").select("*").eq("staff_registration_id",a).eq("start_date",t).eq("end_date",t).eq("reason","Marked absent by admin in schedule").single();if(s&&"PGRST116"!==s.code){console.error("Error finding leave request:",s);return}if(e){let{error:s}=await d.O.from("leave_requests").delete().eq("id",e.id);if(s){console.error("Error deleting leave request:",s),c("Absence unmarked but failed to delete leave request");return}let l=r.total_warnings??0,i=Math.max(0,l-1),n=r.leave_balance??10,o=Math.min(10,n+1),{error:m}=await d.O.from("staff_registrations").update({total_warnings:i,leave_balance:o}).eq("id",a);if(m){console.error("Error updating warnings and balance:",m),c("Absence unmarked but failed to update warnings and leave balance");return}b(e=>e.map(e=>e.id===a?{...e,total_warnings:i,leave_balance:o}:e)),eJ(e=>e.map(e=>e.id===a?{...e,total_warnings:i,leave_balance:o}:e)),g(`Warning removed for ${r.full_name}. Warnings: ${l} → ${i} | Leave: ${n} → ${o} days`),setTimeout(()=>g(""),3e3),console.log("✅ Leave request deleted, warnings decremented, and balance refunded:",{staffId:a,date:t,newWarnings:i,newBalance:o})}}catch(e){console.error("Error handling absence removal:",e)}}else{updateStaffHours(e,t,a,0);try{let{data:s,error:l}=await d.O.from("leave_requests").insert({staff_registration_id:a,location_id:e,request_type:"absence_admin",start_date:t,end_date:t,reason:"Marked absent by admin in schedule",status:"approved"}).select().single();if(l){console.error("Error creating leave request:",l),c("Failed to create leave request for absence");return}let i=r.total_warnings??0,n=i+1,o=r.leave_balance??10,m=Math.max(0,o-1),{error:x}=await d.O.from("staff_registrations").update({total_warnings:n,leave_balance:m}).eq("id",a);if(x){console.error("Error updating warnings and balance:",x),c("Absence marked but failed to update warnings and leave balance");return}b(e=>e.map(e=>e.id===a?{...e,total_warnings:n,leave_balance:m}:e)),eJ(e=>e.map(e=>e.id===a?{...e,total_warnings:n,leave_balance:m}:e)),g(`Warning assigned to ${r.full_name}. Warnings: ${i} → ${n} | Leave: ${o} → ${m} days`),setTimeout(()=>g(""),3e3),console.log("✅ Leave request created, warnings incremented, and balance deducted:",{staffId:a,date:t,newWarnings:n,newBalance:m})}catch(e){console.error("Error handling absence:",e)}}},getDayStatus=e=>e6[e]||"default",toggleDayHolidayStatus=e=>{e5(t=>{let a;let s=t[e]||"default";switch(s){case"default":a="regular-holiday";break;case"regular-holiday":a="special-holiday";break;default:a="default"}return{...t,[e]:a}})},getStaffColorClasses=e=>{let t=getDayStatus(e);switch(t){case"regular-holiday":return{container:"bg-orange-200 hover:bg-orange-300 text-orange-900",button:"text-orange-700 hover:text-orange-900 hover:bg-orange-400",label:"text-orange-800 font-semibold",input:"focus:ring-orange-500"};case"special-holiday":return{container:"bg-violet-200 hover:bg-violet-300 text-violet-900",button:"text-violet-700 hover:text-violet-900 hover:bg-violet-400",label:"text-violet-800 font-semibold",input:"focus:ring-violet-500"};default:return{container:"bg-blue-200 hover:bg-blue-300 text-blue-900",button:"text-blue-700 hover:text-blue-900 hover:bg-blue-400",label:"text-blue-800 font-semibold",input:"focus:ring-blue-500"}}},saveSchedule=async()=>{l(!0);try{let e=getWeekDates(eI);console.log("\uD83D\uDCBE Preparing to save schedule...");let t=[];Object.entries(ez).forEach(([a,s])=>{"rest-day"!==a&&Object.entries(s).forEach(([s,r])=>{let l=Array.isArray(r)?r:r?[r]:[];l.forEach(r=>{if(r){let l=e.find(e=>getScheduleKey(e)===s);if(l){let e=getStaffHours(a,s,r),i=getDayStatus(s),n=isStaffAbsent(a,s,r),d={location_id:a,staff_registration_id:r,schedule_date:formatDateLocal(l),hours:n?0:e,day_type:i,is_absent:n};console.log("\uD83D\uDCDD Schedule record to save:",d),t.push(d)}}})})}),console.log("\uD83D\uDCE6 Total records to save:",t.length);let a=formatDateLocal(e[0]),s=formatDateLocal(e[6]);console.log("\uD83D\uDDD1️ Deleting existing schedules for week:",{startDate:a,endDate:s});let{error:r}=await d.O.from("staff_schedules").delete().gte("schedule_date",a).lte("schedule_date",s);if(r)throw console.error("❌ Delete error:",r),r;if(console.log("✅ Old schedules deleted"),t.length>0){console.log("\uD83D\uDCBE Inserting",t.length,"new schedule records...");let{data:e,error:a}=await d.O.from("staff_schedules").insert(t).select();if(a)throw console.error("❌ Insert error:",a),a;console.log("✅ Schedules saved successfully!"),console.log("\uD83D\uDCCA Saved records:",e)}else console.log("ℹ️ No schedule data to save");eB(JSON.parse(JSON.stringify(ez))),eY(JSON.parse(JSON.stringify(eU))),e3(JSON.parse(JSON.stringify(e6))),ta(!0),setTimeout(()=>ta(!1),3e3),console.log("\uD83D\uDD04 Refreshing today's schedules..."),loadTodaySchedules(),console.log("✨ Save schedule complete!")}catch(e){console.error("Error saving schedule:",e),c("Failed to save schedule"),ta(!1)}finally{l(!1)}};return t?(0,s.jsxs)("div",{className:"space-y-6",children:[(0,s.jsxs)("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0",children:[(0,s.jsxs)("div",{children:[s.jsx("div",{className:"h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse"}),s.jsx("div",{className:"h-4 bg-gray-200 rounded w-64 animate-pulse"})]}),(0,s.jsxs)("div",{className:"flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3",children:[s.jsx("div",{className:"h-10 bg-gray-200 rounded w-32 animate-pulse"}),s.jsx("div",{className:"h-10 bg-gray-200 rounded w-32 animate-pulse"}),s.jsx("div",{className:"h-10 bg-gray-200 rounded w-32 animate-pulse"})]})]}),s.jsx("div",{className:"bg-white rounded-lg shadow overflow-hidden",children:s.jsx("div",{children:(0,s.jsxs)("table",{className:"w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:s.jsx("tr",{children:["Staff Member","Contact","Assignments","Leave Balance / Warnings","Status","Actions"].map((e,t)=>s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:e},t))})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:[...Array(8)].map((e,t)=>s.jsx("tr",{children:[...Array(6)].map((e,t)=>s.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:s.jsx("div",{className:"h-8 bg-gray-200 rounded animate-pulse"})},t))},t))})]})})})]}):(0,s.jsxs)("div",{className:"space-y-6",children:[(0,s.jsxs)("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0",children:[(0,s.jsxs)("div",{children:[s.jsx("h1",{className:"text-xl font-semibold text-gray-900",children:"Staff Manager"}),s.jsx("p",{className:"text-sm text-gray-600",children:"Manage staff members and assignments"})]}),(0,s.jsxs)("div",{className:"flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4",children:[(0,s.jsxs)("div",{className:"flex items-center space-x-3",children:[s.jsx("span",{className:"text-sm font-medium text-gray-700",children:"Show today only"}),s.jsx("button",{onClick:()=>e2(!e1),className:`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${e1?"bg-blue-600":"bg-gray-200"}`,children:s.jsx("span",{className:`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${e1?"translate-x-6":"translate-x-1"}`})})]}),(0,s.jsxs)("div",{className:"flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3",children:[(0,s.jsxs)("button",{onClick:openAnnouncementModal,className:"flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700",children:[s.jsx(E.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Announcement"})]}),(0,s.jsxs)("button",{onClick:openScheduleModal,className:"flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700",children:[s.jsx(L.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Schedule"})]}),(0,s.jsxs)("button",{onClick:()=>F(!0),className:`flex items-center justify-center space-x-2 px-4 py-2 ${tl.primary} text-white rounded-md hover:opacity-90`,children:[s.jsx(m.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Add Staff"})]})]})]})]}),V.length>0&&(0,s.jsxs)("div",{className:"bg-yellow-50 border border-yellow-200 rounded-lg p-4",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between",children:[(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx(M.Z,{className:"h-5 w-5 text-yellow-600"}),(0,s.jsxs)("h3",{className:"text-sm font-medium text-yellow-800",children:[V.length," Pending Leave Request",V.length>1?"s":""]})]}),s.jsx("button",{onClick:()=>ea(!et),className:"text-sm text-yellow-700 hover:text-yellow-900",children:et?"Hide":"View"})]}),et&&s.jsx("div",{className:"mt-4 space-y-3",children:V.map(e=>s.jsx("div",{className:"bg-white rounded-lg border border-yellow-200 p-4",children:(0,s.jsxs)("div",{className:"flex items-center justify-between",children:[(0,s.jsxs)("div",{className:"flex-1",children:[(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx("span",{className:"text-sm font-medium text-gray-900",children:e.staff_registrations.full_name}),s.jsx("span",{className:"px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800",children:"absence_sickness"===e.request_type?"Sickness":"absence_family"===e.request_type?"Family Emergency":"absence_authorized"===e.request_type?"Authorized Absence":"absence_personal"===e.request_type?"Personal Leave":"absence_bereavement"===e.request_type?"Bereavement Leave":"absence_vacation"===e.request_type?"Vacation Leave":"absence_admin"===e.request_type?"Absent":"Absence"})]}),(0,s.jsxs)("div",{className:"text-sm text-gray-600 mt-1",children:[e.locations.name," • ",new Date(e.start_date).toLocaleDateString()," - ",new Date(e.end_date).toLocaleDateString()]}),s.jsx("div",{className:"text-sm text-gray-700 mt-1",children:e.reason})]}),s.jsx("button",{onClick:()=>openLeaveRequestModal(e),className:"ml-4 px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100",children:"Review"})]})},e.id))})]}),s.jsx("div",{className:"bg-white rounded-lg shadow overflow-hidden",children:s.jsx("div",{className:"overflow-x-auto",children:(0,s.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:(0,s.jsxs)("tr",{children:[s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Staff Member"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Contact"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Assignments"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Leave Balance / Warnings"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Status"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Actions"})]})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:e1&&0===ti.length?s.jsx("tr",{children:s.jsx("td",{colSpan:6,className:"px-6 py-8 text-center text-gray-500",children:(0,s.jsxs)("div",{className:"flex flex-col items-center space-y-2",children:[s.jsx(L.Z,{className:"h-8 w-8 text-gray-400"}),s.jsx("p",{className:"text-lg font-medium",children:"No staff scheduled for today"}),s.jsx("p",{className:"text-sm",children:"All staff members are off today or no schedule has been set."})]})})}):Object.entries(tn).sort(([e],[t])=>"Unassigned"===e?1:"Unassigned"===t?-1:e.localeCompare(t)).map(([e,t])=>(0,s.jsxs)(n().Fragment,{children:[s.jsx("tr",{className:"bg-gray-100",children:s.jsx("td",{colSpan:6,className:"px-6 py-3",children:(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx(L.Z,{className:"h-4 w-4 text-gray-600"}),s.jsx("span",{className:"font-semibold text-gray-900",children:e}),(0,s.jsxs)("span",{className:"text-sm text-gray-600",children:["(",t.length," staff member",1!==t.length?"s":"",")"]})]})})}),t.sort((e,t)=>e.full_name.localeCompare(t.full_name)).map(e=>(0,s.jsxs)("tr",{className:"hover:bg-gray-50",children:[s.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:(0,s.jsxs)("div",{className:"flex items-center",children:[s.jsx("div",{className:"flex-shrink-0 h-10 w-10",children:s.jsx("div",{className:"h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center",children:s.jsx(T.Z,{className:"h-5 w-5 text-gray-600"})})}),(0,s.jsxs)("div",{className:"ml-4",children:[s.jsx("div",{className:"text-sm font-medium text-gray-900",children:e.full_name}),(0,s.jsxs)("div",{className:"text-sm text-gray-500 flex items-center space-x-1",children:[s.jsx(I.Z,{className:"h-3 w-3"}),s.jsx("span",{children:e.staff_code})]})]})]})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:(0,s.jsxs)("div",{className:"text-sm text-gray-900 flex items-center space-x-2",children:[s.jsx(R.Z,{className:"h-3 w-3"}),s.jsx("span",{children:e.mobile_number})]})}),s.jsx("td",{className:"px-6 py-4",children:s.jsx("div",{className:"text-sm text-gray-900",children:0===e.staff_assignments.length?s.jsx("span",{className:"text-gray-500 italic",children:"No assignments"}):s.jsx("div",{className:"space-y-1",children:e.staff_assignments.map(t=>{let a=isStaffScheduledToday(e.id),r=a&&a.location_id===t.location_id;return(0,s.jsxs)("div",{className:`flex items-center space-x-2 p-1 rounded ${r?"bg-blue-100 border border-blue-300":""}`,children:[s.jsx(L.Z,{className:`h-3 w-3 ${r?"text-blue-600":"text-gray-400"}`}),(0,s.jsxs)("span",{className:`text-xs ${r?"text-blue-800 font-medium":""}`,children:[t.location.name," (",t.location.brand?.name,")",r&&s.jsx("span",{className:"ml-1 text-blue-600 font-semibold",children:"• Today"})]})]},t.id)})})})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:(0,s.jsxs)("div",{className:"flex flex-col space-y-1",children:[(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx("span",{className:"text-xs text-gray-500",children:"Leave:"}),(0,s.jsxs)("div",{className:`px-2 py-1 text-xs font-semibold rounded-full ${(e.leave_balance??10)>5?"bg-green-100 text-green-800":(e.leave_balance??10)>2?"bg-yellow-100 text-yellow-800":"bg-red-100 text-red-800"}`,children:[e.leave_balance??10," days"]})]}),(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx("span",{className:"text-xs text-gray-500",children:"Warnings:"}),s.jsx("div",{className:"px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800",children:e.total_warnings??0})]})]})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:s.jsx("button",{onClick:()=>toggleStaffStatus(e.id,e.is_active),className:`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${e.is_active?"bg-green-100 text-green-800 hover:bg-green-200":"bg-red-100 text-red-800 hover:bg-red-200"}`,children:e.is_active?"Active":"Inactive"})}),s.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium",children:(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx("button",{onClick:()=>openEditModal(e),className:"text-blue-600 hover:text-blue-900 flex items-center space-x-1",title:"Edit staff",children:s.jsx(z.Z,{className:"h-4 w-4"})}),s.jsx("button",{onClick:()=>openLeaveHistoryModal(e),className:"text-orange-600 hover:text-orange-900 flex items-center space-x-1",title:"View leave history",children:s.jsx(Z.Z,{className:"h-4 w-4"})}),s.jsx("button",{onClick:()=>openMessageModal(e),className:"text-purple-600 hover:text-purple-900 flex items-center space-x-1",title:"Send message",children:s.jsx(H.Z,{className:"h-4 w-4"})})]})})]},e.id))]},e))})]})})}),P&&s.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",children:(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-xl max-w-md w-full",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between p-6 border-b border-gray-200",children:[s.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"Add New Staff Member"}),s.jsx("button",{onClick:()=>F(!1),className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]}),(0,s.jsxs)("div",{className:"p-6 space-y-4",children:[(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Full Name *"}),s.jsx("input",{type:"text",value:ts.full_name,onChange:e=>tr({...ts,full_name:e.target.value}),className:"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",required:!0})]}),(0,s.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[(0,s.jsxs)("div",{className:"space-y-2",children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Mobile Number *"}),s.jsx("input",{type:"tel",value:ts.mobile_number,onChange:e=>tr({...ts,mobile_number:e.target.value.replace(/\D/g,"").slice(0,11)}),maxLength:11,className:"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",required:!0})]}),(0,s.jsxs)("div",{className:"space-y-2",children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Employment Date"}),s.jsx("input",{type:"date",value:ts.employment_date,onChange:e=>tr({...ts,employment_date:e.target.value}),className:"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",required:!0})]})]}),(0,s.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[(0,s.jsxs)("div",{className:"space-y-2",children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Staff Code"}),(0,s.jsxs)("div",{className:"flex space-x-2",children:[s.jsx("input",{type:"text",value:ts.staff_code,onChange:e=>tr({...ts,staff_code:e.target.value}),maxLength:8,className:"w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",required:!0}),s.jsx("button",{onClick:()=>tr({...ts,staff_code:generateStaffCode()}),className:"px-2 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50",title:"Generate staff code",children:s.jsx(B.Z,{className:"h-4 w-4"})})]})]}),(0,s.jsxs)("div",{className:"space-y-2",children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Hourly Rate (₱)"}),s.jsx("input",{type:"number",min:"0",step:"0.01",value:ts.hourly_rate||"",onChange:e=>tr({...ts,hourly_rate:parseFloat(e.target.value)||0}),className:"w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",required:!0})]})]})]}),(0,s.jsxs)("div",{className:"flex justify-end space-x-3 p-6 border-t border-gray-200",children:[s.jsx("button",{onClick:()=>F(!1),className:"px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300",children:"Cancel"}),s.jsx("button",{onClick:addStaff,disabled:r||!ts.full_name.trim()||!ts.mobile_number.trim()||!ts.employment_date||!ts.staff_code.trim()||!ts.hourly_rate,className:`px-4 py-2 ${tl.primary} text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed`,children:r?"Adding...":"Add Staff"})]})]})}),A&&U&&s.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",children:(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0",children:[s.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"Edit Staff Member"}),s.jsx("button",{onClick:()=>q(!1),className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]}),s.jsx("div",{className:"flex-1 overflow-y-auto p-6",children:(0,s.jsxs)("div",{className:"space-y-6",children:[(0,s.jsxs)("div",{className:"space-y-4",children:[(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Full Name *"}),s.jsx("input",{type:"text",value:e$.full_name,onChange:e=>eF({...e$,full_name:e.target.value}),className:"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"Enter full name"})]}),(0,s.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[(0,s.jsxs)("div",{className:"space-y-2",children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Mobile Number *"}),s.jsx("input",{type:"tel",value:e$.mobile_number,onChange:e=>eF({...e$,mobile_number:e.target.value.replace(/\D/g,"").slice(0,11)}),maxLength:11,className:"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"Enter 11-digit mobile number"})]}),(0,s.jsxs)("div",{className:"space-y-2",children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Employment Date"}),s.jsx("input",{type:"date",value:e$.employment_date,onChange:e=>eF({...e$,employment_date:e.target.value}),className:"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"})]})]}),(0,s.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-4 gap-4",children:[(0,s.jsxs)("div",{className:"space-y-2",children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Staff Code *"}),s.jsx("input",{type:"text",value:e$.staff_code,onChange:e=>eF({...e$,staff_code:e.target.value}),maxLength:8,className:"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"})]}),(0,s.jsxs)("div",{className:"space-y-2",children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Hourly Rate (₱)"}),s.jsx("input",{type:"number",min:"0",step:"0.01",value:e$.hourly_rate,onChange:e=>eF({...e$,hourly_rate:parseFloat(e.target.value)||0}),className:"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"0.00"})]}),(0,s.jsxs)("div",{className:"space-y-2",children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Leave Balance"}),s.jsx("input",{type:"number",min:"0",max:"10",value:e$.leave_balance,onChange:e=>eF({...e$,leave_balance:parseInt(e.target.value)||0}),className:"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"10"})]}),(0,s.jsxs)("div",{className:"space-y-2",children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Total Warnings"}),s.jsx("input",{type:"number",min:"0",value:e$.total_warnings,onChange:e=>eF({...e$,total_warnings:parseInt(e.target.value)||0}),className:"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"0"})]})]})]}),(0,s.jsxs)("div",{children:[(0,s.jsxs)("div",{className:"flex items-center justify-between mb-3",children:[s.jsx("h5",{className:"text-lg font-medium text-gray-900",children:"Current Assignments"}),(0,s.jsxs)("button",{onClick:()=>eq(!0),className:"flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700",children:[s.jsx(m.Z,{className:"h-3 w-3"}),s.jsx("span",{children:"Add Assignment"})]})]}),0===U.staff_assignments.length?s.jsx("p",{className:"text-gray-500 italic",children:"No assignments"}):s.jsx("div",{className:"space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3",children:U.staff_assignments.map(e=>s.jsx("div",{className:"bg-gray-50 border border-gray-200 rounded-lg p-4",children:(0,s.jsxs)("div",{className:"flex items-center justify-between",children:[(0,s.jsxs)("div",{className:"flex-1",children:[(0,s.jsxs)("div",{className:"flex items-center space-x-2 mb-2",children:[s.jsx(L.Z,{className:"h-4 w-4 text-gray-400"}),s.jsx("span",{className:"font-medium text-gray-900",children:e.location.name})]}),(0,s.jsxs)("div",{className:"flex items-center space-x-2 text-sm text-gray-600",children:[s.jsx(w.Z,{className:"h-3 w-3"}),s.jsx("span",{className:"text-gray-900",children:e.location.brand?.name})]}),(0,s.jsxs)("div",{className:"text-xs text-gray-500 mt-1",children:["Assigned on ",formatDate(e.created_at)]})]}),s.jsx("button",{onClick:()=>removeAssignment(e.id),className:"text-red-600 hover:text-red-800 p-1",title:"Remove assignment",children:s.jsx(p.Z,{className:"h-4 w-4"})})]})},e.id))})]})]})}),(0,s.jsxs)("div",{className:"flex justify-between p-6 border-t border-gray-200 flex-shrink-0",children:[(0,s.jsxs)("div",{className:"flex space-x-3",children:[s.jsx("button",{onClick:()=>toggleStaffStatus(U.id,U.is_active),className:`px-4 py-2 ${U.is_active?"bg-red-200 hover:bg-red-300 text-red-800":tl.primary} rounded-md`,children:U.is_active?"Deactivate":"Activate"}),s.jsx("button",{onClick:()=>deleteStaff(U.id),className:"px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700",children:"Delete Staff"})]}),(0,s.jsxs)("div",{className:"flex space-x-3",children:[s.jsx("button",{onClick:()=>q(!1),className:"px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300",children:"Cancel"}),s.jsx("button",{onClick:saveEditModal,disabled:r||!e$.full_name.trim()||!e$.mobile_number.trim()||!e$.staff_code.trim(),className:"px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed",children:r?"Saving...":"Save Changes"})]})]})]})}),eA&&U&&s.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",children:(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-xl max-w-md w-full",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between p-6 border-b border-gray-200",children:[s.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"Assign Staff to Location"}),s.jsx("button",{onClick:()=>eq(!1),className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]}),(0,s.jsxs)("div",{className:"p-6 space-y-4",children:[(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Select Brand *"}),(0,s.jsxs)("select",{value:eE.brand_id,onChange:e=>handleBrandChange(e.target.value),className:"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",children:[s.jsx("option",{value:"",children:"Select brand first"}),v.map(e=>s.jsx("option",{value:e.id,children:e.name},e.id))]})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Select Location *"}),(0,s.jsxs)("select",{value:eE.location_id,onChange:e=>eL({...eE,location_id:e.target.value}),disabled:!eE.brand_id,className:"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed",children:[s.jsx("option",{value:"",children:eE.brand_id?"Select location":"Select brand first"}),0===getFilteredLocations().length&&eE.brand_id?s.jsx("option",{value:"",disabled:!0,children:"All locations already assigned"}):getFilteredLocations().map(e=>s.jsx("option",{value:e.id,children:e.name},e.id))]})]}),(0,s.jsxs)("div",{className:"bg-blue-50 border border-blue-200 rounded-lg p-3",children:[(0,s.jsxs)("p",{className:"text-sm text-blue-800",children:[s.jsx("strong",{children:"Staff:"})," ",U.full_name," (",U.staff_code,")"]}),s.jsx("p",{className:"text-xs text-blue-600 mt-1",children:"Staff will be assigned to work at the selected location"})]})]}),(0,s.jsxs)("div",{className:"flex justify-end space-x-3 p-6 border-t border-gray-200",children:[s.jsx("button",{onClick:()=>eq(!1),className:"px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300",children:"Cancel"}),s.jsx("button",{onClick:addAssignment,disabled:r||!eE.brand_id||!eE.location_id||0===getFilteredLocations().length,className:`px-4 py-2 ${tl.primary} text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed`,children:r?"Adding...":0===getFilteredLocations().length?"No Available Locations":"Add Assignment"})]})]})}),eM&&s.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",children:(0,s.jsxs)("div",{className:"bg-white rounded-xl shadow-lg max-w-screen-2xl w-full h-[90vh] flex flex-col border border-gray-200 overflow-hidden",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0",children:[(0,s.jsxs)("div",{className:"flex items-center space-x-4",children:[s.jsx("div",{className:"w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center",children:s.jsx(M.Z,{className:"h-5 w-5 text-blue-600"})}),(0,s.jsxs)("div",{children:[s.jsx("h3",{className:"text-xl font-semibold text-gray-900",children:"Staff Schedule"}),s.jsx("p",{className:"text-sm text-gray-600",children:"Schedule company staff for the current week"})]})]}),(0,s.jsxs)("div",{className:"flex items-center space-x-4",children:[(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[(0,s.jsxs)("button",{onClick:()=>{let e=new Date(eI.getTime()-6048e5);eR(e)},className:"flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 font-medium",children:[s.jsx(O.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Previous"})]}),s.jsx("div",{className:"text-center",children:s.jsx("span",{className:"text-lg font-semibold text-gray-900",children:eI.toLocaleDateString("en-US",{month:"long",year:"numeric"})})}),(0,s.jsxs)("button",{onClick:()=>{let e=new Date(eI.getTime()+6048e5);eR(e)},className:"flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 font-medium",children:[s.jsx("span",{children:"Next"}),s.jsx($.Z,{className:"h-4 w-4"})]})]}),s.jsx("button",{onClick:()=>{eT(!1),te(null)},className:"p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200",children:s.jsx(x.Z,{className:"h-5 w-5"})})]})]}),s.jsx("div",{className:"flex-1 overflow-hidden bg-white",children:s.jsx("div",{className:"h-full overflow-y-auto overflow-x-hidden p-6",children:s.jsx("div",{className:"min-h-0",children:(0,s.jsxs)("table",{className:"w-full table-fixed",children:[s.jsx("thead",{children:(0,s.jsxs)("tr",{className:"bg-gray-50 border-b border-white",children:[s.jsx("th",{className:"px-6 py-4 text-left text-sm font-semibold text-gray-900 border-r border-white w-64 min-w-64",children:(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx(w.Z,{className:"h-4 w-4 text-gray-500"}),s.jsx("span",{children:"STORES"})]})}),getWeekDates(eI).map((e,t)=>{let a=isToday(e),r=getScheduleKey(e),l=getDayStatus(r),i=getStaffColorClasses(r),getTodayTextColor=()=>{switch(l){case"regular-holiday":return"text-orange-900";case"special-holiday":return"text-violet-900";default:return"text-blue-900"}};return(0,s.jsxs)("th",{className:`px-2 py-3 text-center border-r border-white last:border-r-0 cursor-pointer hover:opacity-80 transition-all duration-200 w-36 ${i.container} ${a?`ring-4 ring-inset ${(()=>{switch(l){case"regular-holiday":return"ring-orange-600";case"special-holiday":return"ring-violet-600";default:return"ring-blue-600"}})()}`:""}`,onClick:()=>toggleDayHolidayStatus(r),title:`Click to change day status: ${"default"===l?"Default":"regular-holiday"===l?"Regular Holiday":"Special Holiday"}`,children:[s.jsx("div",{className:`text-lg font-bold ${a?getTodayTextColor():i.label}`,children:getDateNumber(e)}),s.jsx("div",{className:`text-sm font-semibold ${a?getTodayTextColor():i.label}`,children:getDayName(e)})]},t)})]})}),s.jsx("tbody",{className:"divide-y divide-white",children:0===eG.length?s.jsx("tr",{children:(0,s.jsxs)("td",{colSpan:8,className:"px-6 py-12 text-center text-gray-500",children:[s.jsx(w.Z,{className:"h-12 w-12 mx-auto mb-4 text-gray-300"}),s.jsx("p",{className:"text-lg font-medium text-gray-900 mb-2",children:"No company-owned branches found"}),s.jsx("p",{className:"text-sm text-gray-500",children:"Please add company-owned locations or contact support"})]})}):eG.sort((e,t)=>{let a=e.brand?.name||"",s=t.brand?.name||"";return a!==s?a.localeCompare(s):e.name.localeCompare(t.name)}).map(e=>(0,s.jsxs)("tr",{className:`hover:bg-gray-50 transition-colors ${getStoreColor(e)}`,children:[s.jsx("td",{className:`px-6 py-4 text-sm font-medium text-gray-900 border-r border-white w-64 min-w-64 ${getStoreColor(e)}`,children:(0,s.jsxs)("div",{className:"flex items-center space-x-3",children:[s.jsx("div",{className:"w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center",children:s.jsx(w.Z,{className:"h-4 w-4 text-blue-600"})}),(0,s.jsxs)("div",{children:[s.jsx("div",{className:"font-semibold text-gray-900",children:e.name}),s.jsx("div",{className:"text-xs text-gray-500",children:e.brand?.name||"Company"})]})]})}),getWeekDates(eI).map((t,a)=>{let l=getScheduleKey(t);return ez[e.id]?.[l],isToday(t),getDayStatus(l),s.jsx("td",{className:`px-2 py-3 text-center align-top border-r border-white last:border-r-0 w-36 ${getStoreColor(e)}`,children:(0,s.jsxs)("div",{className:"flex flex-col gap-2",children:[(0,s.jsxs)("select",{className:"w-full text-xs border-0 bg-gray-100 hover:bg-gray-200 focus:bg-white focus:outline-none rounded px-2 py-1 transition-all duration-200 shadow-sm",value:"",onChange:async t=>{t.target.value&&(await addStaffToSchedule(t.target.value,l,e.id),t.target.value="")},disabled:r,children:[s.jsx("option",{value:"",children:"+"}),getStaffForLocation(e.id).map(e=>{let t=Object.entries(ez).some(([t,a])=>{let s=a[l];return Array.isArray(s)?s.includes(e.id):s===e.id});return t?null:s.jsx("option",{value:e.id,children:e.full_name},e.id)})]}),s.jsx("div",{className:"flex flex-col gap-2",children:getScheduledStaffForBranchAndDate(e.id,l).map(t=>{if(!t)return null;let a=getStaffHours(e.id,l,t.id),i=isStaffAbsent(e.id,l,t.id),n=getStaffColorClasses(l),d=e8===t.id;return(0,s.jsxs)("div",{onMouseEnter:()=>te(t.id),onMouseLeave:()=>te(null),className:`group relative text-xs px-2 py-1 rounded-lg transition-all duration-200 max-w-full overflow-hidden ${d?`${(()=>{if(i)return"bg-red-500";let e=getDayStatus(l);switch(e){case"regular-holiday":return"bg-orange-500";case"special-holiday":return"bg-violet-500";default:return"bg-blue-500"}})()} text-white`:i?"bg-red-200 hover:bg-red-300 text-red-900":n.container}`,children:[(0,s.jsxs)("div",{className:"flex items-center justify-between mb-1",children:[s.jsx("span",{className:"truncate font-medium text-xs max-w-[100px]",children:t.full_name}),s.jsx("button",{onClick:()=>removeStaffFromSchedule(t.id,l,e.id),disabled:r,className:`opacity-0 group-hover:opacity-100 ${d?"text-white hover:bg-white/20":i?"text-red-700 hover:text-red-900 hover:bg-red-400":n.button} rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-110`,title:"Remove from schedule",children:"\xd7"})]}),(0,s.jsxs)("div",{className:"flex items-center space-x-1",children:[s.jsx("label",{className:`text-xs font-medium ${d?"text-white":i?"text-red-800":n.label}`,children:"Hours:"}),s.jsx("input",{type:"number",min:"0",max:"24",step:"0.5",value:i?0:a,onChange:a=>updateStaffHours(e.id,l,t.id,parseFloat(a.target.value)||0),className:`w-12 text-xs border-0 bg-white hover:bg-gray-50 focus:bg-white focus:outline-none ${i?"border-red-300 focus:ring-red-500":""} rounded px-1 py-0.5 text-center font-medium`,placeholder:"11",disabled:r||i}),s.jsx("button",{onClick:()=>toggleStaffAbsence(e.id,l,t.id),disabled:r,className:`${i?"opacity-100":"opacity-0 group-hover:opacity-100"} ${d?"text-white hover:bg-white/20":i?"text-red-600 hover:text-red-900 hover:bg-red-400":n.button} rounded-full w-4 h-4 flex items-center justify-center transition-all duration-200 hover:scale-110`,title:i?"Unmark absence (click to restore)":"Mark as absent (sets hours to 0)",children:s.jsx(Z.Z,{className:"h-3 w-3"})})]})]},t.id)})})]})},a)})]},e.id))})]})})})}),(0,s.jsxs)("div",{className:"flex items-center justify-between p-6 border-t border-gray-200 bg-white flex-shrink-0",children:[(0,s.jsxs)("div",{className:"flex items-center space-x-6",children:[(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx("div",{className:"w-4 h-4 bg-blue-200 border border-blue-300 rounded"}),s.jsx("span",{className:"text-sm text-gray-600",children:"Regular"})]}),(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx("div",{className:"w-4 h-4 bg-orange-200 border border-orange-300 rounded"}),s.jsx("span",{className:"text-sm text-gray-600",children:"Double Pay"})]}),(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx("div",{className:"w-4 h-4 bg-violet-200 border border-violet-300 rounded"}),s.jsx("span",{className:"text-sm text-gray-600",children:"Special Holiday"})]})]}),(0,s.jsxs)("div",{className:"flex space-x-3",children:[s.jsx("button",{onClick:()=>{eT(!1),te(null)},className:"px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 font-medium",children:"Cancel"}),s.jsx("button",{onClick:saveSchedule,disabled:r||!hasScheduleChanges(),className:`px-4 py-2 text-white rounded-lg transition-all duration-200 font-medium ${!r&&(hasScheduleChanges()||tt)?tt?"bg-gray-400 cursor-not-allowed opacity-60":"bg-green-600 hover:bg-green-700 cursor-pointer":"bg-gray-400 cursor-not-allowed opacity-60"}`,children:r?"Saving...":tt?"Saved Changes":"Save Schedule"})]})]})]})}),o&&s.jsx("div",{className:"bg-red-50 border border-red-200 rounded-lg p-4",children:s.jsx("p",{className:"text-red-800",children:o})}),u&&s.jsx("div",{className:"bg-green-50 border border-green-200 rounded-lg p-4",children:s.jsx("p",{className:"text-green-800",children:u})}),G&&K&&s.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",children:(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between p-6 border-b border-gray-200",children:[s.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"Review Leave Request"}),s.jsx("button",{onClick:()=>Q(!1),className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]}),(0,s.jsxs)("div",{className:"p-6 space-y-6",children:[(0,s.jsxs)("div",{className:"bg-gray-50 rounded-lg p-4",children:[s.jsx("h4",{className:"text-sm font-medium text-gray-900 mb-3",children:"Request Details"}),(0,s.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4 text-sm",children:[(0,s.jsxs)("div",{children:[s.jsx("span",{className:"font-medium text-gray-700",children:"Staff Member:"}),s.jsx("p",{className:"text-gray-900",children:K.staff_registrations.full_name})]}),(0,s.jsxs)("div",{children:[s.jsx("span",{className:"font-medium text-gray-700",children:"Staff Code:"}),s.jsx("p",{className:"text-gray-900",children:K.staff_registrations.staff_code})]}),(0,s.jsxs)("div",{children:[s.jsx("span",{className:"font-medium text-gray-700",children:"Branch:"}),s.jsx("p",{className:"text-gray-900",children:K.locations.name})]}),(0,s.jsxs)("div",{children:[s.jsx("span",{className:"font-medium text-gray-700",children:"Request Type:"}),s.jsx("span",{className:"ml-2 px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800",children:"absence_sickness"===K.request_type?"Sickness":"absence_family"===K.request_type?"Family Emergency":"absence_authorized"===K.request_type?"Authorized Absence":"absence_personal"===K.request_type?"Personal Leave":"absence_bereavement"===K.request_type?"Bereavement Leave":"absence_vacation"===K.request_type?"Vacation Leave":"absence_admin"===K.request_type?"Absent":"Absence"})]}),(0,s.jsxs)("div",{children:[s.jsx("span",{className:"font-medium text-gray-700",children:"Start Date:"}),s.jsx("p",{className:"text-gray-900",children:new Date(K.start_date).toLocaleDateString()})]}),(0,s.jsxs)("div",{children:[s.jsx("span",{className:"font-medium text-gray-700",children:"End Date:"}),s.jsx("p",{className:"text-gray-900",children:new Date(K.end_date).toLocaleDateString()})]}),(0,s.jsxs)("div",{children:[s.jsx("span",{className:"font-medium text-gray-700",children:"Days Requested:"}),(0,s.jsxs)("p",{className:"text-gray-900 font-semibold",children:[calculateDays(K.start_date,K.end_date)," day(s)"]})]}),(0,s.jsxs)("div",{children:[s.jsx("span",{className:"font-medium text-gray-700",children:"Current Balance:"}),(0,s.jsxs)("div",{className:`inline-block px-2 py-1 rounded-lg font-semibold ${(K.staff_registrations.leave_balance??10)>5?"bg-green-100 text-green-800":(K.staff_registrations.leave_balance??10)>2?"bg-yellow-100 text-yellow-800":"bg-red-100 text-red-800"}`,children:[K.staff_registrations.leave_balance??10," day(s)"]})]})]}),(0,s.jsxs)("div",{className:"mt-4",children:[s.jsx("span",{className:"font-medium text-gray-700",children:"Reason:"}),s.jsx("p",{className:"text-gray-900 mt-1",children:K.reason})]}),"pending"===K.status&&s.jsx("div",{className:"mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg",children:"absence_authorized"===K.request_type?(0,s.jsxs)("div",{className:"flex items-center justify-between",children:[s.jsx("span",{className:"text-sm font-medium text-gray-700",children:"Balance After Approval:"}),(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[(0,s.jsxs)("span",{className:"px-3 py-1 rounded-lg font-semibold bg-blue-100 text-blue-800",children:[K.staff_registrations.leave_balance??10," day(s)"]}),s.jsx("span",{className:"text-xs text-blue-600",children:"(No deduction)"})]})]}):(0,s.jsxs)(s.Fragment,{children:[(0,s.jsxs)("div",{className:"flex items-center justify-between",children:[s.jsx("span",{className:"text-sm font-medium text-gray-700",children:"Balance After Approval:"}),(0,s.jsxs)("span",{className:`px-3 py-1 rounded-lg font-semibold ${(K.staff_registrations.leave_balance??10)-calculateDays(K.start_date,K.end_date)>5?"bg-green-100 text-green-800":(K.staff_registrations.leave_balance??10)-calculateDays(K.start_date,K.end_date)>=0?"bg-yellow-100 text-yellow-800":"bg-red-100 text-red-800"}`,children:[(K.staff_registrations.leave_balance??10)-calculateDays(K.start_date,K.end_date)," day(s)"]})]}),(K.staff_registrations.leave_balance??10)-calculateDays(K.start_date,K.end_date)<0&&s.jsx("p",{className:"text-xs text-red-600 mt-2",children:"⚠️ Warning: Request exceeds available balance"})]})})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Admin Notes (Optional)"}),s.jsx("textarea",{value:X,onChange:e=>ee(e.target.value),rows:3,className:"w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"Add any notes about this decision..."})]}),(0,s.jsxs)("div",{className:"flex space-x-3 pt-4",children:[s.jsx("button",{onClick:()=>Q(!1),className:"flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300",children:"Cancel"}),s.jsx("button",{onClick:()=>handleLeaveRequestDecision("rejected"),disabled:r,className:"flex-1 px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50",children:r?"Processing...":"Reject"}),s.jsx("button",{onClick:()=>handleLeaveRequestDecision("approved"),disabled:r,className:"flex-1 px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50",children:r?"Processing...":"Approve"})]})]})]})}),es&&en&&s.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",children:(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10",children:[(0,s.jsxs)("div",{children:[s.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"Leave Request History"}),(0,s.jsxs)("p",{className:"text-sm text-gray-600 mt-1",children:[en.full_name," • ",en.staff_code]})]}),s.jsx("button",{onClick:()=>{er(!1),ed(null),ei([])},className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]}),s.jsx("div",{className:"p-6",children:0===el.length?(0,s.jsxs)("div",{className:"text-center py-12",children:[s.jsx(M.Z,{className:"h-16 w-16 text-gray-300 mx-auto mb-4"}),s.jsx("p",{className:"text-gray-600",children:"No leave requests found for this staff member."})]}):s.jsx("div",{className:"space-y-4",children:el.map(e=>(0,s.jsxs)("div",{className:`border rounded-lg p-4 hover:shadow-md transition-shadow ${"approved"===e.status&&"absence_admin"===e.request_type?"border-orange-300":"border-gray-200"}`,children:[(0,s.jsxs)("div",{className:"flex items-start justify-between mb-3",children:[s.jsx("div",{className:"flex-1",children:(0,s.jsxs)("div",{className:"flex items-center space-x-2 mb-2",children:[s.jsx("h4",{className:"text-md font-semibold text-gray-900",children:"absence_sickness"===e.request_type?"Sickness":"absence_family"===e.request_type?"Family Emergency":"absence_authorized"===e.request_type?"Authorized Absence":"absence_personal"===e.request_type?"Personal Leave":"absence_bereavement"===e.request_type?"Bereavement Leave":"absence_vacation"===e.request_type?"Vacation Leave":"absence_admin"===e.request_type?"Absent":"Absence Report"}),s.jsx("span",{className:`px-3 py-1 text-xs font-medium rounded-full ${"pending"===e.status?"bg-yellow-100 text-yellow-800 border border-yellow-300":"approved"===e.status&&"absence_admin"===e.request_type?"bg-orange-100 text-orange-800 border border-orange-300":"approved"===e.status?"bg-green-100 text-green-800 border border-green-300":"bg-red-100 text-red-800 border border-red-300"}`,children:"approved"===e.status&&"absence_admin"===e.request_type?"Warning":e.status.charAt(0).toUpperCase()+e.status.slice(1)})]})}),s.jsx("button",{onClick:()=>deleteLeaveRequest(e.id,e.staff_registration_id),disabled:r,className:"ml-4 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50",title:"Delete leave request",children:s.jsx(p.Z,{className:"h-4 w-4"})})]}),(0,s.jsxs)("div",{className:"grid grid-cols-2 gap-3 text-sm text-gray-600",children:[(0,s.jsxs)("div",{children:[s.jsx("span",{className:"font-medium",children:"Branch:"})," ",e.locations.name]}),(0,s.jsxs)("div",{children:[s.jsx("span",{className:"font-medium",children:"Submitted:"})," ",new Date(e.created_at).toLocaleDateString()]}),(0,s.jsxs)("div",{children:[s.jsx("span",{className:"font-medium",children:"Start Date:"})," ",new Date(e.start_date).toLocaleDateString()]}),(0,s.jsxs)("div",{children:[s.jsx("span",{className:"font-medium",children:"End Date:"})," ",new Date(e.end_date).toLocaleDateString()]}),(0,s.jsxs)("div",{children:[s.jsx("span",{className:"font-medium",children:"Days Requested:"}),(0,s.jsxs)("span",{className:"ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold",children:[calculateDays(e.start_date,e.end_date)," day(s)"]})]})]}),(0,s.jsxs)("div",{className:"border-t border-gray-100 pt-3 mt-3",children:[(0,s.jsxs)("div",{className:"mb-3",children:[s.jsx("p",{className:"text-sm font-medium text-gray-700 mb-1",children:"Reason:"}),s.jsx("p",{className:"text-sm text-gray-600 bg-gray-50 p-2 rounded",children:e.reason})]}),e.admin_notes&&(0,s.jsxs)("div",{className:`p-3 rounded text-sm ${"approved"===e.status?"bg-green-50 border border-green-200":"rejected"===e.status?"bg-red-50 border border-red-200":"bg-gray-50 border border-gray-200"}`,children:[s.jsx("p",{className:"font-medium text-gray-700 mb-1",children:"Admin Notes:"}),s.jsx("p",{className:"text-gray-600",children:e.admin_notes})]})]})]},e.id))})}),s.jsx("div",{className:"border-t border-gray-200 p-6 bg-gray-50 sticky bottom-0",children:s.jsx("button",{onClick:()=>{er(!1),ed(null),ei([])},className:"w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50",children:"Close"})})]})}),eo&&s.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",children:(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-xl w-[1000px] h-[700px] flex flex-col",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between p-6 border-b border-gray-200",children:[s.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"General Announcements"}),s.jsx("button",{onClick:()=>{ec(!1),eh({title:"",message:"",type:"general"})},className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]}),s.jsx("div",{className:"flex-1 overflow-hidden",children:(0,s.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6 p-6 h-full",children:[(0,s.jsxs)("div",{className:"space-y-4 flex flex-col",children:[s.jsx("h4",{className:"font-semibold text-gray-900",children:"Create New Announcement"}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Type"}),(0,s.jsxs)("div",{className:"flex items-center space-x-4",children:[(0,s.jsxs)("label",{className:"flex items-center space-x-2 cursor-pointer",children:[s.jsx("input",{type:"radio",name:"announcementType",value:"general",checked:"general"===ep.type,onChange:e=>eh({...ep,type:e.target.value}),className:"w-4 h-4 text-purple-600 focus:ring-purple-500"}),s.jsx("span",{className:"text-sm text-gray-700",children:"General"})]}),(0,s.jsxs)("label",{className:"flex items-center space-x-2 cursor-pointer",children:[s.jsx("input",{type:"radio",name:"announcementType",value:"reminder",checked:"reminder"===ep.type,onChange:e=>eh({...ep,type:e.target.value}),className:"w-4 h-4 text-purple-600 focus:ring-purple-500"}),s.jsx("span",{className:"text-sm text-gray-700",children:"Reminder"})]})]})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Title"}),s.jsx("input",{type:"text",value:ep.title,onChange:e=>eh({...ep,title:e.target.value}),className:`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${eD.title?"border-red-500":"border-gray-300"}`,placeholder:"Enter announcement title"})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Message"}),s.jsx("textarea",{value:ep.message,onChange:e=>eh({...ep,message:e.target.value}),rows:6,className:`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${eD.message?"border-red-500":"border-gray-300"}`,placeholder:"Enter announcement message"})]}),s.jsx("button",{onClick:createAnnouncement,disabled:r,className:`w-full px-4 py-2 text-white rounded-md disabled:opacity-50 ${"reminder"===ep.type?"bg-orange-600 hover:bg-orange-700":"bg-purple-600 hover:bg-purple-700"}`,children:r?"Creating...":"Create Announcement"}),o&&s.jsx("div",{className:"text-red-600 text-sm",children:o}),u&&s.jsx("div",{className:"text-green-600 text-sm",children:u})]}),(0,s.jsxs)("div",{className:"space-y-4 flex flex-col overflow-hidden",children:[s.jsx("h4",{className:"font-semibold text-gray-900",children:"Recent Announcements"}),s.jsx("div",{className:"space-y-3 flex-1 overflow-y-auto",children:eN?(0,s.jsxs)("div",{className:"text-center py-8 text-gray-500",children:[s.jsx("div",{className:"animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-2"}),s.jsx("p",{className:"text-sm",children:"Loading announcements..."})]}):0===ey.length?(0,s.jsxs)("div",{className:"text-center py-8 text-gray-500",children:[s.jsx(E.Z,{className:"h-12 w-12 text-gray-300 mx-auto mb-2"}),s.jsx("p",{className:"text-sm",children:"No announcements yet"})]}):ey.map(e=>(0,s.jsxs)("div",{className:`${"reminder"===e.type?"bg-orange-50 border border-orange-200":"bg-purple-50 border border-purple-200"} rounded-lg p-3`,children:[(0,s.jsxs)("div",{className:"flex items-start justify-between mb-2",children:[s.jsx("h5",{className:`font-semibold text-sm ${"reminder"===e.type?"text-orange-900":"text-purple-900"}`,children:e.title}),(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx("span",{className:`text-xs ${"reminder"===e.type?"text-orange-600":"text-purple-600"}`,children:new Date(e.created_at).toLocaleDateString()}),s.jsx("button",{onClick:()=>deleteAnnouncement(e.id),disabled:r,className:"text-red-600 hover:text-red-900 disabled:opacity-50",title:"Delete announcement",children:s.jsx(p.Z,{className:"h-4 w-4"})})]})]}),s.jsx("p",{className:`text-sm whitespace-pre-line ${"reminder"===e.type?"text-orange-800":"text-purple-800"}`,children:e.message})]},e.id))})]})]})}),s.jsx("div",{className:"flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50",children:s.jsx("button",{onClick:()=>{ec(!1),eh({title:"",message:"",type:"general"})},className:"px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50",children:"Close"})})]})}),em&&eu&&s.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",children:(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-xl w-[1000px] h-[700px] flex flex-col",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between p-6 border-b border-gray-200",children:[(0,s.jsxs)("div",{children:[(0,s.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Messages for ",eu.full_name]}),(0,s.jsxs)("p",{className:"text-sm text-gray-600 mt-1",children:["Staff Code: ",eu.staff_code]})]}),s.jsx("button",{onClick:()=>{ex(!1),eg(null),ef({title:"",message:"",type:"notice"})},className:"text-gray-400 hover:text-gray-600",children:s.jsx(x.Z,{className:"h-6 w-6"})})]}),s.jsx("div",{className:"flex-1 overflow-hidden",children:(0,s.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6 p-6 h-full",children:[(0,s.jsxs)("div",{className:"space-y-4 flex flex-col",children:[s.jsx("h4",{className:"font-semibold text-gray-900",children:"Send New Message"}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Message Type"}),(0,s.jsxs)("div",{className:"flex space-x-4",children:[(0,s.jsxs)("label",{className:"flex items-center",children:[s.jsx("input",{type:"radio",value:"notice",checked:"notice"===eb.type,onChange:e=>ef({...eb,type:e.target.value}),className:"h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"}),s.jsx("span",{className:"ml-2 text-sm text-gray-700",children:"Notice"})]}),(0,s.jsxs)("label",{className:"flex items-center",children:[s.jsx("input",{type:"radio",value:"warning",checked:"warning"===eb.type,onChange:e=>ef({...eb,type:e.target.value}),className:"h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"}),s.jsx("span",{className:"ml-2 text-sm text-gray-700",children:"Warning"})]})]})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Title"}),s.jsx("input",{type:"text",value:eb.title,onChange:e=>ef({...eb,title:e.target.value}),className:`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${eP.title?"border-red-500":"border-gray-300"}`,placeholder:"Enter message title"})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Message"}),s.jsx("textarea",{value:eb.message,onChange:e=>ef({...eb,message:e.target.value}),rows:6,className:`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${eP.message?"border-red-500":"border-gray-300"}`,placeholder:"Enter your message"})]}),s.jsx("button",{onClick:sendStaffMessage,disabled:r,className:`w-full px-4 py-2 text-white rounded-md disabled:opacity-50 ${"warning"===eb.type?"bg-red-600 hover:bg-red-700":"bg-blue-600 hover:bg-blue-700"}`,children:r?"Sending...":`Send ${"warning"===eb.type?"Warning":"Notice"}`}),o&&s.jsx("div",{className:"text-red-600 text-sm",children:o}),u&&s.jsx("div",{className:"text-green-600 text-sm",children:u})]}),(0,s.jsxs)("div",{className:"space-y-4 flex flex-col overflow-hidden",children:[s.jsx("h4",{className:"font-semibold text-gray-900",children:"Message History"}),s.jsx("div",{className:"space-y-3 flex-1 overflow-y-auto",children:ek?(0,s.jsxs)("div",{className:"text-center py-8 text-gray-500",children:[s.jsx("div",{className:"animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-2"}),s.jsx("p",{className:"text-sm",children:"Loading messages..."})]}):0===ej.length?(0,s.jsxs)("div",{className:"text-center py-8 text-gray-500",children:[s.jsx(H.Z,{className:"h-12 w-12 text-gray-300 mx-auto mb-2"}),s.jsx("p",{className:"text-sm",children:"No messages sent yet"})]}):ej.map(e=>(0,s.jsxs)("div",{className:`border rounded-lg p-3 ${"warning"===e.type?"bg-red-50 border-red-200":"bg-blue-50 border-blue-200"}`,children:[(0,s.jsxs)("div",{className:"flex items-start justify-between mb-2",children:[(0,s.jsxs)("div",{className:"flex items-center space-x-2 flex-1",children:[s.jsx("h5",{className:`font-semibold text-sm ${"warning"===e.type?"text-red-900":"text-blue-900"}`,children:e.title}),(0,s.jsxs)("span",{className:`px-2 py-0.5 text-xs font-medium rounded-full ${"warning"===e.type?"bg-red-100 text-red-800":"bg-blue-100 text-blue-800"}`,children:["warning"===e.type?"Warning":"Notice"," - ",eu.full_name]})]}),(0,s.jsxs)("div",{className:"flex items-center space-x-2",children:[s.jsx("span",{className:`text-xs ${"warning"===e.type?"text-red-600":"text-blue-600"}`,children:new Date(e.created_at).toLocaleDateString()}),s.jsx("button",{onClick:()=>deleteMessage(e.id,eu.id),disabled:r,className:"text-red-600 hover:text-red-900 disabled:opacity-50",title:"Delete message",children:s.jsx(p.Z,{className:"h-4 w-4"})})]})]}),s.jsx("p",{className:`text-sm whitespace-pre-line ${"warning"===e.type?"text-red-800":"text-blue-800"}`,children:e.message})]},e.id))})]})]})}),s.jsx("div",{className:"flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50",children:s.jsx("button",{onClick:()=>{ex(!1),eg(null),ef({title:"",message:"",type:"notice"})},className:"px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50",children:"Close"})})]})})]})}var U=a(7974);function PayrollManager(){let[e,t]=(0,i.useState)([]),[a,r]=(0,i.useState)({weekly:{},custom:[],totals:{weekly:0,custom:0}}),[l,n]=(0,i.useState)(!0),[o,c]=(0,i.useState)("weekly"),[m,x]=(0,i.useState)(new Date),[g,p]=(0,i.useState)(null),[h,f]=(0,i.useState)(null),[y,v]=(0,i.useState)(new Date),[j,w]=(0,i.useState)(!1),[N,_]=(0,i.useState)(!0),[k,D]=(0,i.useState)(!0),[C,P]=(0,i.useState)("all"),[F,A]=(0,i.useState)(""),[q,E]=(0,i.useState)(""),[L,T]=(0,i.useState)({}),[I,R]=(0,i.useState)({}),[z,Z]=(0,i.useState)({}),[H,B]=(0,i.useState)({}),[W,V]=(0,i.useState)(!1),[Y,G]=(0,i.useState)([]);(0,i.useEffect)(()=>{(k||"custom"!==o)&&loadStaffAndPayrollData()},[m.toISOString(),o,g?.toISOString(),h?.toISOString(),k]),(0,i.useEffect)(()=>{e.length>0&&loadPayrollData(e)},[e]),(0,i.useEffect)(()=>{v(new Date(m))},[m]),(0,i.useEffect)(()=>{let e=new Date;if("custom"===o){let t=e.getDay(),a=new Date(e.getFullYear(),e.getMonth(),e.getDate()+-t),s=new Date(a);s.setDate(a.getDate()+6),p(a),f(s)}else x(new Date)},[o]),(0,i.useEffect)(()=>{g&&h&&g>h&&(p(h),f(g))},[g,h]);let loadStaffAndPayrollData=async()=>{n(!0);try{let{data:e,error:a}=await d.O.from("locations").select("id").eq("company_owned",!0);if(a)throw a;let s=e?.map(e=>e.id)||[];G(s);let{data:r,error:l}=await d.O.from("staff_registrations").select("*").eq("is_active",!0);if(l)throw l;let{data:i,error:n}=await d.O.from("staff_assignments").select("id, staff_registration_id, location_id").in("location_id",s);if(n)throw n;let{data:o,error:c}=await d.O.from("locations").select(`
          id,
          name,
          brand:brands(name)
        `).eq("company_owned",!0);if(c)throw c;let m=r?.map(e=>({...e,staff_assignments:i?.filter(t=>t.staff_registration_id===e.id).map(e=>({...e,locations:o?.find(t=>t.id===e.location_id)||{id:e.location_id,name:"Unknown Location"}}))||[]})).filter(e=>e.staff_assignments.length>0)||[];t(m)}catch(e){console.error("Error loading staff and payroll data:",e),A("Failed to load payroll data")}finally{n(!1)}},loadPayrollData=async e=>{try{let t=getStartDate(),a=getEndDate(),s=new Date().toISOString().split("T")[0],l=Y.length>0?Y:[],{data:i,error:n}=await d.O.from("staff_schedules").select(`
          *,
          staff:staff_registrations(id, full_name, hourly_rate),
          location:locations(id, name, brand:brands(id, name))
        `).gte("schedule_date",t).lte("schedule_date",a).in("location_id",l).order("schedule_date",{ascending:!0});if(n)throw console.error("Error fetching schedule data:",n),n;let c=(i||[]).filter(e=>e.schedule_date<=s),m={};c.forEach(e=>{e.day_type&&(m[e.schedule_date]=e.day_type)}),T(m);let x=await calculatePayroll(e,c,m,t,a);r(x),A(""),"weekly"===o&&await loadDeductionsAndRefunds(t,a,e,c,m)}catch(e){console.error("Error loading payroll data:",e),A("Failed to load payroll data"),r({weekly:{},custom:[],totals:{weekly:0,custom:0}})}},fetchStaffAverageWeeklySales=async(e,t,a)=>{try{let s=new Date;s.setDate(s.getDate()-28);let r=s.toISOString().split("T")[0],l=new Date;l.setDate(l.getDate()-30);let i=l.toISOString().split("T")[0],{data:n,error:o}=await d.O.from("dsir_reports").select("staff_registration_id, gross_sales, report_date").in("staff_registration_id",e).gte("report_date",r).eq("status","submitted");o&&console.error("Error fetching DSIR reports for 4-week average:",o);let{data:c,error:m}=await d.O.from("dsir_reports").select("staff_registration_id, gross_sales, report_date").in("staff_registration_id",e).gte("report_date",i).eq("status","submitted");m&&console.error("Error fetching DSIR reports for monthly average:",m);let{data:x,error:u}=await d.O.from("dsir_reports").select("staff_registration_id, gross_sales, report_date").in("staff_registration_id",e).gte("report_date",t).lte("report_date",a).eq("status","submitted").order("report_date",{ascending:!1});u&&console.error("Error fetching DSIR reports for week:",u);let g={};x?.forEach(e=>{g[e.staff_registration_id]||(g[e.staff_registration_id]=[]),g[e.staff_registration_id].push({date:e.report_date,sales:e.gross_sales||0})});let p={};n?.forEach(e=>{p[e.staff_registration_id]||(p[e.staff_registration_id]=[]),p[e.staff_registration_id].push(e.gross_sales||0)});let h={};c?.forEach(e=>{h[e.staff_registration_id]||(h[e.staff_registration_id]=[]),h[e.staff_registration_id].push({date:e.report_date,sales:e.gross_sales||0})});let b={},f={};return Object.entries(g).forEach(([e,t])=>{if(t.length>0){let a=t.reduce((e,t)=>e+t.sales,0);b[e]=a/t.length}}),Object.entries(h).forEach(([e,t])=>{if(t.length>0){let a=t.reduce((e,t)=>e+t.sales,0),s=t.length;f[e]=a/s}}),{weeklyAverages:b,monthlyAverages:f,breakdowns:g}}catch(e){return console.error("Error calculating staff average sales:",e),{weeklyAverages:{},monthlyAverages:{},breakdowns:{}}}},getScheduleDataForWeek=async(e,t)=>{let a=new Date().toISOString().split("T")[0],s=Y.length>0?Y:[],{data:r,error:l}=await d.O.from("staff_schedules").select(`
        *,
        staff:staff_registrations(id, full_name, hourly_rate),
        location:locations(id, name, brand:brands(id, name))
      `).gte("schedule_date",e).lte("schedule_date",t).in("location_id",s).order("schedule_date",{ascending:!0});if(l)throw l;let i=(r||[]).filter(e=>e.schedule_date<=a);return i},loadDeductionsAndRefunds=async(e,t,a,s,l)=>{try{let{data:i,error:n}=await d.O.from("payroll_deductions_refunds").select("*").eq("week_start_date",e).eq("week_end_date",t);if(n)throw n;if(i&&i.length>0){let n={},d={};i.forEach(e=>{n[e.staff_id]={utilities:e.utilities||0,shortages:e.shortages||0,cashAdvances:e.cash_advances||0,penalties:e.penalties||0,others:e.others||0},d[e.staff_id]=e.refunds||0}),R(n),Z(d),a&&s&&l&&setTimeout(async()=>{Object.assign(I,n),Object.assign(z,d);let i=await calculatePayroll(a,s,l,e,t);r(i)},100)}else R({}),Z({}),a&&s&&l&&setTimeout(async()=>{let i=await calculatePayroll(a,s,l,e,t);r(i)},100)}catch(e){console.error("Error loading deductions and refunds:",e)}},getStartDate=()=>{if("custom"===o){if(g){let e=g.getFullYear(),t=g.getMonth(),a=g.getDate();return`${e}-${String(t+1).padStart(2,"0")}-${String(a).padStart(2,"0")}`}return new Date().toISOString().split("T")[0]}let e=new Date(m),t=e.getDay(),a=new Date(e.getFullYear(),e.getMonth(),e.getDate()+-t),s=a.getFullYear(),r=a.getMonth(),l=a.getDate();return`${s}-${String(r+1).padStart(2,"0")}-${String(l).padStart(2,"0")}`},getEndDate=()=>{if("custom"===o){if(h){let e=h.getFullYear(),t=h.getMonth(),a=h.getDate();return`${e}-${String(t+1).padStart(2,"0")}-${String(a).padStart(2,"0")}`}return new Date().toISOString().split("T")[0]}let e=new Date(m),t=e.getDay(),a=new Date(e.getFullYear(),e.getMonth(),e.getDate()+(6-t)),s=a.getFullYear(),r=a.getMonth(),l=a.getDate();return`${s}-${String(r+1).padStart(2,"0")}-${String(l).padStart(2,"0")}`},calculateStaffPayroll=(e,t,a)=>{let s=e.hourly_rate||0,r=8*s,l=0,i=0,n=0,d=0,o={};t.forEach(e=>{let t=e.is_absent?0:e.hours||11,s=a[e.schedule_date]||"default";o[e.schedule_date]=t,l+=t;let r=Math.min(8,t);switch(s){case"regular-holiday":n+=r;break;case"special-holiday":d+=r;break;default:i+=r}});let c=Math.max(0,l-48);l<48&&t.forEach(e=>{let t=e.is_absent?0:e.hours||11;a[e.schedule_date],i+=Math.max(0,t-8)});let m=i*s,x=c*(1.25*(r/8)),u=n*s*2,g=d*s*1.3,p=m+x+u+g,h=Array.from(new Set(t.map(e=>e.location?.name||"Unknown"))).join(", "),b={};t.forEach(e=>{let t=e.location?.name||"Unknown",a=e.location?.brand?.name||"Unknown Brand",s=e.schedule_date,r=new Date(s),l=r.toLocaleDateString("en-US",{weekday:"short"}),i=r.toLocaleDateString("en-US",{month:"short",day:"numeric"});b[t]||(b[t]=[]),b[t].push({date:i,dayName:l,hours:o[s]||0,scheduleDate:s,brandName:a,isAbsent:e.is_absent||!1})}),Object.keys(b).forEach(e=>{b[e].sort((e,t)=>new Date(e.scheduleDate).getTime()-new Date(t.scheduleDate).getTime())});let f=Array.from(new Set(t.map(e=>e.schedule_date))).sort(),y=f.map(e=>{let t=new Date(e),a=t.toLocaleDateString("en-US",{weekday:"short"}),s=t.toLocaleDateString("en-US",{month:"short",day:"numeric"});return{date:s,dayName:a,hours:o[e]||0}}),v=getDeductionsForStaff(e.id),j=z[e.id]||0,w=Object.values(v).reduce((e,t)=>e+t,0);return{staffId:e.id,staffName:e.full_name,locationName:h,date:t[0].schedule_date,hours:l,hourlyRate:s,totalPay:p,daysWorked:y,daysWorkedDates:f,locationGroups:b,regularHours:i,doublePayHours:n,specialPayHours:d,overtimeHours:c,regularPay:m,doublePay:u,specialPay:g,overtimePay:x,minimumDailyRate:r,deductions:v,refunds:j,netPay:p-w+j}},calculatePayroll=async(e,t,a,s,r)=>{let l={},i=[],n=await fetchStaffAverageWeeklySales(e.map(e=>e.id),s,r),d={};t.forEach(e=>{let t=e.staff_registration_id;d[t]||(d[t]=[]),d[t].push(e)}),Object.entries(d).forEach(([t,s])=>{let r=e.find(e=>e.id===t);if(!r)return;let d=calculateStaffPayroll(r,s,a);d.averageWeeklySales=n.weeklyAverages[t]||0,d.averageMonthlySales=n.monthlyAverages[t]||0,d.dailySalesBreakdown=n.breakdowns[t]||[],i.push(d);let o=getWeekKey(new Date(s[0].schedule_date));l[o]||(l[o]=[]),l[o].push(d)});let o={weekly:Object.values(l).flat().reduce((e,t)=>e+t.totalPay,0),custom:i.reduce((e,t)=>e+t.totalPay,0)};return{weekly:l,custom:i,totals:o}},getWeekKey=e=>{if("custom"===o)return"custom";let t=new Date(e),a=e.getDay();return t.setDate(e.getDate()+-a),t.toISOString().split("T")[0]},formatCurrency=e=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(e);(0,i.useMemo)(()=>{switch(o){case"weekly":return Object.values(a.weekly).flat().reduce((e,t)=>e+t.overtimeHours,0);case"custom":return a.custom.reduce((e,t)=>e+t.overtimeHours,0);default:return 0}},[o,a]);let Q=(0,i.useMemo)(()=>{switch(o){case"weekly":return Object.values(a.weekly).flat().reduce((e,t)=>e+t.doublePayHours,0);case"custom":return a.custom.reduce((e,t)=>e+t.doublePayHours,0);default:return 0}},[o,a]),K=(0,i.useMemo)(()=>{switch(o){case"weekly":return Object.values(a.weekly).flat().reduce((e,t)=>e+t.specialPayHours,0);case"custom":return a.custom.reduce((e,t)=>e+t.specialPayHours,0);default:return 0}},[o,a]),J=(0,i.useMemo)(()=>{switch(o){case"weekly":return Object.values(a.weekly).flat().reduce((e,t)=>e+t.regularHours,0);case"custom":return a.custom.reduce((e,t)=>e+t.regularHours,0);default:return 0}},[o,a]),X=(0,i.useMemo)(()=>{let e=[];switch(o){case"weekly":e=Object.values(a.weekly).flat();break;case"custom":e=a.custom;break;default:e=[]}return"all"!==C&&(e=e.filter(e=>e.staffId===C)),e.sort((e,t)=>t.netPay-e.netPay),e},[o,a,C]),ee=(0,i.useMemo)(()=>X.length>0,[X]);(0,i.useMemo)(()=>{switch(o){case"weekly":return Object.values(a.weekly).flat().reduce((e,t)=>e+Object.values(t.deductions).reduce((e,t)=>e+t,0),0);case"custom":return Object.values(a.weekly).flat().reduce((e,t)=>e+Object.values(t.deductions).reduce((e,t)=>e+t,0),0);default:return 0}},[o,a]);let et=(0,i.useMemo)(()=>{switch(o){case"weekly":return Object.values(a.weekly).flat().reduce((e,t)=>e+t.netPay,0);case"custom":return Object.values(a.weekly).flat().reduce((e,t)=>e+t.netPay,0);default:return 0}},[o,a]),updateDeduction=(e,t,a)=>{R(s=>({...s,[e]:{...s[e],[t]:a}}))},updateInputValue=(e,t,a)=>{if(B(s=>({...s,[e]:{...s[e],[t]:a}})),"refunds"!==t){let s=parseFloat(a)||0;updateDeduction(e,t,s)}},getInputValue=(e,t,a)=>{let s=H[e]?.[t];return void 0!==s?s:0===a||void 0===a?"":a.toString()},getDeductionsForStaff=e=>{let t=I[e]||{utilities:0,shortages:0,cashAdvances:0,penalties:0,others:0};return{utilities:t.utilities||0,shortages:t.shortages||0,cashAdvances:t.cashAdvances||0,penalties:t.penalties||0,others:t.others||0}},saveDeductionsAndRefunds=async()=>{if("weekly"===o){V(!0),A(""),E("");try{let t=getStartDate(),s=getEndDate(),r=getWeekKey(new Date(m)),l=a.weekly[r]||[];if(0===l.length){A("No payroll data found for this week");return}for(let e of l){let a=I[e.staffId],r=z[e.staffId],l=(!a?.utilities||0===a.utilities)&&(!a?.shortages||0===a.shortages)&&(!a?.cashAdvances||0===a.cashAdvances)&&(!a?.penalties||0===a.penalties)&&(!a?.others||0===a.others)&&(!r||0===r),{data:i}=await d.O.from("payroll_deductions_refunds").select("id").eq("staff_id",e.staffId).eq("week_start_date",t).eq("week_end_date",s),n=i&&i.length>0?i[0]:null;if(l){if(n){let{error:e}=await d.O.from("payroll_deductions_refunds").delete().eq("id",n.id);if(e)throw e}}else if(a||r){let l={staff_id:e.staffId,week_start_date:t,week_end_date:s,utilities:a?.utilities||0,shortages:a?.shortages||0,cash_advances:a?.cashAdvances||0,penalties:a?.penalties||0,others:a?.others||0,refunds:r||0,updated_at:new Date().toISOString()};if(n){let{error:e}=await d.O.from("payroll_deductions_refunds").update(l).eq("id",n.id);if(e)throw e}else{let{error:e}=await d.O.from("payroll_deductions_refunds").insert(l);if(e)throw e}}}let i=a.weekly[r]||[];if(i.length>0&&e.length>0){let a=await getScheduleDataForWeek(t,s);await loadDeductionsAndRefunds(t,s,e,a,L)}}catch(e){console.error("Error saving deductions and refunds:",e),A("Failed to save deductions and refunds")}finally{V(!1)}}},getDayColorClasses=e=>{switch(e){case"regular-holiday":return"bg-orange-200 text-orange-900 border border-orange-300";case"special-holiday":return"bg-violet-200 text-violet-900 border border-violet-300";default:return"bg-blue-200 text-blue-900 border border-blue-300"}},getDayStatusForDate=e=>L[e]||"default",getDateRangeText=()=>{let e=getStartDate(),t=getEndDate(),formatDate=e=>new Date(e).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});return"weekly"===o?`${formatDate(e)} - ${formatDate(t)}`:"custom"===o?g&&h?`${formatDate(g.toISOString())} - ${formatDate(h.toISOString())}`:g?`From ${formatDate(g.toISOString())} - Select end date`:"Select date range":""},isInSelectedWeek=e=>{if("custom"===o){if(g&&h){let t=new Date(e.getFullYear(),e.getMonth(),e.getDate()),a=new Date(g.getFullYear(),g.getMonth(),g.getDate()),s=new Date(h.getFullYear(),h.getMonth(),h.getDate());return t>=a&&t<=s}return!1}let t=new Date(e.getFullYear(),e.getMonth(),e.getDate()),a=new Date(m),s=m.getDay();a.setDate(m.getDate()+-s),a.setHours(0,0,0,0);let r=new Date(a);return r.setDate(a.getDate()+6),t>=a&&t<=r},isSelectedDate=e=>e.toDateString()===m.toDateString(),handleDayClick=e=>{if("custom"===o)D(!1),N?(p(e),_(!1)):(g?e>=g?f(e):(f(g),p(e)):f(e),_(!0));else if("weekly"===o){let t=new Date(e),a=e.getDay();t.setDate(e.getDate()+-a),x(t),w(!1),D(!0)}},generatePayslip=e=>{let t=new Date,a=t.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}),s=getDateRangeText(),r=`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${e.staffName}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
          }
          
          .payslip {
            width: 7.5in;
            margin: 0 auto;
            background: white;
            padding: 0.15in;
            font-size: 12px;
            line-height: 1.3;
          }
          
          .header {
            text-align: center;
            margin-bottom: 10px;
          }
          
          .company-name {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 3px;
            color: #000;
          }
          
          .payslip-title {
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 3px;
            color: #000;
          }
          
          .generated-date {
            font-size: 11px;
            color: #000;
          }
          
          .employee-info {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 30px;
            margin-bottom: 12px;
          }
          
          .info-item {
            text-align: center;
          }
          
          .info-label {
            font-size: 10px;
            font-weight: 600;
            color: #000;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          
          .info-value {
            font-size: 14px;
            font-weight: 600;
            color: #000;
          }
          
          .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #000;
            margin: 10px 0 6px 0;
          }
          
          .days-worked {
            margin-bottom: 12px;
          }
          
          .location-group {
            margin-bottom: 8px;
            display: inline-block;
            margin-right: 20px;
            vertical-align: top;
          }
          
          .location-header {
            font-size: 13px;
            font-weight: 600;
            color: #000;
            margin-bottom: 6px;
            padding: 4px 0;
            background: #f0f0f0;
            text-align: center;
          }
          
          .days-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(55px, 1fr));
            gap: 5px;
            max-width: 200px;
            justify-content: center;
          }
          
          .day-item {
            padding: 5px;
            text-align: center;
            font-size: 12px;
            background: white;
            color: #000;
            border: 1px solid #ddd;
          }
          
          .day-item.regular {
            background: white;
            color: #000;
          }
          
          .day-item.holiday {
            background: #f0f0f0;
            color: #000;
          }
          
          .day-item.special {
            background: #e0e0e0;
            color: #000;
          }
          
          .day-date {
            font-weight: 600;
            font-size: 11px;
            margin-bottom: 3px;
          }
          
          .day-name {
            font-size: 10px;
            opacity: 0.8;
            margin-bottom: 3px;
          }
          
          .day-hours {
            font-weight: 600;
            font-size: 11px;
          }
          
          .no-days {
            text-align: center;
            color: #000;
            font-style: italic;
            padding: 10px;
            font-size: 11px;
          }
          
          .earnings-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
            font-size: 15px;
          }
          
          .earnings-table th {
            background: #f0f0f0;
            padding: 10px 14px;
            text-align: left;
            font-size: 14px;
            font-weight: 600;
            color: #000;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
          }
          
          .earnings-table th:last-child {
            text-align: right;
          }
          
          .earnings-table td {
            padding: 10px 14px;
            font-size: 15px;
            color: #000;
            border-bottom: 1px solid #eee;
          }
          
          .earnings-table .amount {
            text-align: right;
            font-weight: 600;
            color: #000;
          }
          
          
          .deductions {
            margin-bottom: 10px;
          }
          
          .deduction-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            font-size: 13px;
            color: #000;
          }
          
          .total-deductions {
            font-weight: 700;
            color: #000;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #000;
          }
          
          .net-pay {
            padding: 10px;
            text-align: center;
            background: #f0f0f0;
            border: 1px solid #000;
          }
          
          .net-pay-label {
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 4px;
            color: #000;
          }
          
          .net-pay-amount {
            font-size: 18px;
            font-weight: 700;
            color: #000;
          }
          
          .footer {
            text-align: center;
            font-size: 10px;
            color: #000;
            margin-top: 10px;
            padding-top: 6px;
            border-top: 1px solid #000;
          }
          
          .footer p {
            margin-bottom: 3px;
          }
          
          @media print {
            body {
              background: white;
              margin: 0;
              padding: 0;
            }
            .payslip {
              box-shadow: none;
              margin: 0;
              border: none;
              padding: 0.15in;
              width: 7.5in;
            }
            @page {
              margin: 0.5in;
              size: letter;
            }
          }
        </style>
      </head>
      <body>
        <div class="payslip">
          <div class="header">
            <div class="company-name">Gilnaks Food Corporation</div>
            <div class="payslip-title">PAYSLIP</div>
            <div class="generated-date">Generated on: ${a}</div>
          </div>
          
          <div class="employee-info">
            <div class="info-item">
              <div class="info-label">Employee</div>
              <div class="info-value">${e.staffName}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Period</div>
              <div class="info-value">${s}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Rate</div>
              <div class="info-value">₱${e.hourlyRate.toFixed(2)}/hr</div>
            </div>
          </div>
          
          <div class="days-worked">
            <div class="section-title">Days Worked</div>
            ${(()=>{if(!e.locationGroups||0===Object.keys(e.locationGroups).length)return'<div class="no-days">No days worked recorded</div>';let t="";return Object.entries(e.locationGroups).forEach(([e,a])=>{t+=`
                <div class="location-group">
                  <div class="location-header">${e}</div>
                  <div class="days-grid">
                    ${a.map(e=>{let t=getDayStatusForDate(e.scheduleDate);return`
                        <div class="day-item ${"regular-holiday"===t?"holiday":"special-holiday"===t?"special":"regular"}">
                          <div class="day-date">${e.date}</div>
                          <div class="day-name">${e.dayName}</div>
                          <div class="day-hours">${e.hours}h</div>
                        </div>
                      `}).join("")}
                  </div>
                </div>
              `}),t})()}
          </div>
          
          <div class="section-title">Earnings Breakdown</div>
          <table class="earnings-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Hours</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Regular Hours</td>
                <td>${e.regularHours.toFixed(1)}</td>
                <td>₱${e.hourlyRate.toFixed(2)}</td>
                <td class="amount">₱${e.regularPay.toFixed(2)}</td>
              </tr>
              ${e.doublePay>0?`
              <tr>
                <td>Regular Holiday (x2)</td>
                <td>${e.doublePayHours.toFixed(1)}</td>
                <td>₱${(2*e.hourlyRate).toFixed(2)}</td>
                <td class="amount">₱${e.doublePay.toFixed(2)}</td>
              </tr>
              `:""}
              ${e.specialPay>0?`
              <tr>
                <td>Special Holiday (1.3x)</td>
                <td>${e.specialPayHours.toFixed(1)}</td>
                <td>₱${(1.3*e.hourlyRate).toFixed(2)}</td>
                <td class="amount">₱${e.specialPay.toFixed(2)}</td>
              </tr>
              `:""}
                    ${e.overtimePay>0?`
                    <tr>
                      <td>Overtime (after 48 hrs)</td>
                      <td>${e.overtimeHours.toFixed(1)}</td>
                      <td>₱${(1.25*e.hourlyRate).toFixed(2)}</td>
                      <td class="amount">₱${e.overtimePay.toFixed(2)}</td>
                    </tr>
                    `:""}
                    <tr style="border-top: 2px solid #000; font-weight: 700;">
                      <td>TOTAL PAY</td>
                      <td></td>
                      <td></td>
                      <td class="amount">₱${e.totalPay.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
          
          <div class="deductions">
            <div class="section-title">Deductions & Refunds</div>
            <div class="deduction-row">
              <span>Utilities</span>
              <span>₱${e.deductions.utilities.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Shortages</span>
              <span>₱${e.deductions.shortages.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Cash Advances</span>
              <span>₱${e.deductions.cashAdvances.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Penalties</span>
              <span>₱${e.deductions.penalties.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Others</span>
              <span>₱${e.deductions.others.toFixed(2)}</span>
            </div>
            <div class="deduction-row total-deductions">
              <span>DEDUCTIONS</span>
              <span>₱${Object.values(e.deductions).reduce((e,t)=>e+t,0).toFixed(2)}</span>
            </div>
            ${e.refunds>0?`
            <div class="deduction-row" style="color: #000; font-weight: 600; margin-top: 8px;">
              <span>Refunds</span>
              <span>+₱${e.refunds.toFixed(2)}</span>
            </div>
            `:""}
          </div>
          
          <div class="net-pay">
            <div class="net-pay-label">NET PAY</div>
            <div class="net-pay-amount">₱${e.netPay.toFixed(2)}</div>
          </div>
          
          <div class="footer">
            <p>This payslip is computer generated and does not require a signature.</p>
            <p>For inquiries, please contact the HR department.</p>
          </div>
        </div>
      </body>
      </html>
    `,l=document.createElement("iframe");l.style.position="absolute",l.style.left="-9999px",l.style.top="-9999px",l.style.width="0",l.style.height="0",l.style.border="none",document.body.appendChild(l);let i=l.contentDocument||l.contentWindow?.document;i&&(i.open(),i.write(r),i.close(),l.onload=()=>{l.contentWindow?.focus(),l.contentWindow?.print(),setTimeout(()=>{document.body.removeChild(l)},1e3)})};return l?(0,s.jsxs)("div",{className:"space-y-6",children:[s.jsx("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0",children:(0,s.jsxs)("div",{children:[s.jsx("div",{className:"h-8 bg-gray-200 rounded w-32 mb-2 animate-pulse"}),s.jsx("div",{className:"h-4 bg-gray-200 rounded w-64 animate-pulse"})]})}),s.jsx("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:(0,s.jsxs)("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0",children:[(0,s.jsxs)("div",{className:"flex space-x-6",children:[s.jsx("div",{className:"h-10 bg-gray-200 rounded w-32 animate-pulse"}),s.jsx("div",{className:"h-10 bg-gray-200 rounded w-48 animate-pulse"})]}),s.jsx("div",{className:"h-10 bg-gray-200 rounded w-32 animate-pulse"})]})}),s.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6",children:[void 0,void 0,void 0,void 0].map((e,t)=>s.jsx("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:(0,s.jsxs)("div",{className:"flex items-center",children:[s.jsx("div",{className:"p-2 bg-gray-200 rounded-lg animate-pulse",children:s.jsx("div",{className:"h-6 w-6"})}),(0,s.jsxs)("div",{className:"ml-4 flex-1",children:[s.jsx("div",{className:"h-4 bg-gray-200 rounded w-20 mb-2 animate-pulse"}),s.jsx("div",{className:"h-8 bg-gray-200 rounded w-16 animate-pulse"})]})]})},t))}),(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden",children:[s.jsx("div",{className:"px-6 py-4 border-b border-gray-200",children:s.jsx("div",{className:"h-6 bg-gray-200 rounded w-48 animate-pulse"})}),s.jsx("div",{children:(0,s.jsxs)("table",{className:"w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:s.jsx("tr",{children:[...Array(8)].map((e,t)=>s.jsx("th",{className:"px-6 py-3 text-left",children:s.jsx("div",{className:"h-4 bg-gray-200 rounded w-20 animate-pulse"})},t))})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:[void 0,void 0,void 0,void 0,void 0].map((e,t)=>s.jsx("tr",{children:[...Array(8)].map((e,t)=>s.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:s.jsx("div",{className:"h-6 bg-gray-200 rounded w-24 animate-pulse"})},t))},t))})]})})]})]}):(0,s.jsxs)("div",{className:"space-y-6",children:[s.jsx("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0",children:(0,s.jsxs)("div",{children:[s.jsx("h1",{className:"text-xl font-semibold text-gray-900",children:"Payroll"}),s.jsx("p",{className:"text-sm text-gray-600",children:"Track staff hours and calculate payroll"})]})}),s.jsx("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:(0,s.jsxs)("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0",children:[(0,s.jsxs)("div",{className:"flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-6",children:[(0,s.jsxs)("div",{className:"flex items-center space-x-4",children:[s.jsx("label",{className:"text-sm font-medium text-gray-700",children:"Period:"}),(0,s.jsxs)("select",{value:o,onChange:e=>c(e.target.value),className:"border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",children:[s.jsx("option",{value:"weekly",className:"text-gray-900",children:"Weekly"}),s.jsx("option",{value:"custom",className:"text-gray-900",children:"Custom"})]})]}),(0,s.jsxs)("div",{className:"flex items-center space-x-4",children:[s.jsx("label",{className:"text-sm font-medium text-gray-700",children:"weekly"===o?"Week:":"Date Range:"}),(0,s.jsxs)("div",{className:"relative",children:[(0,s.jsxs)("button",{onClick:()=>{w(!j),D(!j)},className:"flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors min-w-[200px]",children:[s.jsx(M.Z,{className:"h-4 w-4 text-gray-500"}),s.jsx("span",{className:"text-sm text-gray-900",children:"weekly"===o?`Week of ${m.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`:"custom"===o?g&&h?`${g.toLocaleDateString("en-US",{month:"short",day:"numeric"})} - ${h.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`:g?`From ${g.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} - Select end date`:"Select date range":m.toLocaleDateString()})]}),j&&(0,s.jsxs)(s.Fragment,{children:[s.jsx("div",{className:"fixed inset-0 z-10",onClick:()=>{w(!1),D(!0)}}),(0,s.jsxs)("div",{className:"absolute top-full mt-2 left-0 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-20 w-80",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between mb-4",children:[s.jsx("h3",{className:"text-sm font-semibold text-gray-900",children:"Select Date"}),s.jsx("button",{onClick:()=>{w(!1),D(!0)},className:"text-gray-400 hover:text-gray-600 transition-colors",children:s.jsx("svg",{className:"w-4 h-4",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M6 18L18 6M6 6l12 12"})})})]}),(0,s.jsxs)("div",{className:"flex items-center justify-between mb-4",children:[s.jsx("button",{onClick:()=>{let e=new Date(y);e.setMonth(y.getMonth()-1),v(e),"weekly"===o&&x(e)},className:"p-2 hover:bg-gray-100 rounded-md transition-colors",title:"Previous Month",children:s.jsx(O.Z,{className:"h-4 w-4 text-gray-600"})}),s.jsx("span",{className:"text-sm font-semibold text-gray-900",children:y.toLocaleDateString("en-US",{month:"long",year:"numeric"})}),s.jsx("button",{onClick:()=>{let e=new Date(y);e.setMonth(y.getMonth()+1),v(e),"weekly"===o&&x(e)},className:"p-2 hover:bg-gray-100 rounded-md transition-colors",title:"Next Month",children:s.jsx($.Z,{className:"h-4 w-4 text-gray-600"})})]}),(0,s.jsxs)("div",{className:"grid grid-cols-7 gap-1",children:[["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(e=>s.jsx("div",{className:"text-center text-xs font-semibold text-gray-600 py-2",children:e},e)),(()=>{let e=y.getFullYear(),t=y.getMonth(),a=new Date(e,t,1),s=new Date(e,t+1,0),r=a.getDay(),l=[];for(let e=0;e<r;e++)l.push(null);for(let a=1;a<=s.getDate();a++)l.push(new Date(e,t,a));return l})().map((e,t)=>{if(!e)return s.jsx("div",{className:"aspect-square"},`empty-${t}`);let a=isSelectedDate(e),r="weekly"===o&&isInSelectedWeek(e),l="custom"===o&&isInSelectedWeek(e),i="custom"===o&&g&&e.getFullYear()===g.getFullYear()&&e.getMonth()===g.getMonth()&&e.getDate()===g.getDate(),n="custom"===o&&h&&e.getFullYear()===h.getFullYear()&&e.getMonth()===h.getMonth()&&e.getDate()===h.getDate(),d=e.toDateString()===new Date().toDateString(),c="aspect-square p-2 text-sm rounded-lg transition-all duration-150 font-medium";return"custom"===o?i||n?c+=" bg-green-600 text-white font-bold ring-2 ring-green-400":l?c+=" bg-green-100 text-green-900 font-semibold":d?c+=" ring-2 ring-blue-500 text-blue-600 hover:bg-gray-100":c+=" hover:bg-gray-100 text-gray-700 hover:ring-1 hover:ring-green-300":"weekly"===o&&(a?c+=" bg-blue-600 text-white font-bold ring-2 ring-blue-400":r?c+=" bg-blue-100 text-blue-900 font-semibold":d?c+=" ring-2 ring-blue-500 text-blue-600 hover:bg-gray-100":c+=" hover:bg-gray-100 text-gray-700"),s.jsx("button",{onClick:()=>handleDayClick(e),className:c,title:r&&"weekly"===o?"In selected week":i?"Start date":n?"End date":l?"In selected range":"",children:e.getDate()},t)})]}),"weekly"===o&&s.jsx("p",{className:"text-xs text-gray-500 mt-3 text-center",children:"Click any day to select its week (Sunday-Saturday)"}),"custom"===o&&s.jsx("div",{className:"mt-3 text-center",children:(0,s.jsxs)("div",{className:"flex justify-center space-x-3",children:[(g||h)&&s.jsx("button",{onClick:()=>{p(null),f(null),_(!0)},className:"text-xs text-red-600 hover:text-red-800 underline",children:"Reset"}),g&&h&&s.jsx("button",{onClick:()=>{w(!1),D(!0)},className:"text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700",children:"Done"})]})})]})]})]}),(0,s.jsxs)("div",{className:"text-sm text-gray-600",children:[s.jsx("span",{className:"font-medium",children:"Range:"})," ",getDateRangeText()]})]})]}),(0,s.jsxs)("div",{className:"flex items-center space-x-4",children:[s.jsx("label",{className:"text-sm font-medium text-gray-700",children:"Staff:"}),(0,s.jsxs)("select",{value:C,onChange:e=>P(e.target.value),className:"border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[150px]",children:[s.jsx("option",{value:"all",className:"text-gray-900",children:"All Staff"}),e.map(e=>s.jsx("option",{value:e.id,className:"text-gray-900",children:e.full_name},e.id))]})]})]})}),(0,s.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6",children:[s.jsx("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:(0,s.jsxs)("div",{className:"flex items-center",children:[s.jsx("div",{className:"p-2 bg-blue-100 rounded-lg",children:s.jsx(b.Z,{className:"h-6 w-6 text-blue-600"})}),(0,s.jsxs)("div",{className:"ml-4",children:[s.jsx("p",{className:"text-sm font-medium text-gray-600",children:"Regular Hours"}),s.jsx("p",{className:"text-2xl font-semibold text-gray-900",children:J.toFixed(1)})]})]})}),s.jsx("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:(0,s.jsxs)("div",{className:"flex items-center",children:[s.jsx("div",{className:"p-2 bg-orange-100 rounded-lg",children:s.jsx(b.Z,{className:"h-6 w-6 text-orange-600"})}),(0,s.jsxs)("div",{className:"ml-4",children:[s.jsx("p",{className:"text-sm font-medium text-gray-600",children:"Double Pay (x2)"}),(0,s.jsxs)("p",{className:"text-2xl font-semibold text-gray-900",children:[Q.toFixed(1)," hrs"]})]})]})}),s.jsx("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:(0,s.jsxs)("div",{className:"flex items-center",children:[s.jsx("div",{className:"p-2 bg-violet-100 rounded-lg",children:s.jsx(b.Z,{className:"h-6 w-6 text-violet-600"})}),(0,s.jsxs)("div",{className:"ml-4",children:[s.jsx("p",{className:"text-sm font-medium text-gray-600",children:"Special Pay (1.3x)"}),(0,s.jsxs)("p",{className:"text-2xl font-semibold text-gray-900",children:[K.toFixed(1)," hrs"]})]})]})}),s.jsx("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:(0,s.jsxs)("div",{className:"flex items-center",children:[s.jsx("div",{className:"p-2 bg-blue-100 rounded-lg",children:s.jsx(U.Z,{className:"h-6 w-6 text-blue-600"})}),(0,s.jsxs)("div",{className:"ml-4",children:[s.jsx("p",{className:"text-sm font-medium text-gray-600",children:"Net Pay"}),s.jsx("p",{className:"text-2xl font-semibold text-gray-900",children:formatCurrency(et)})]})]})})]}),(0,s.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden",children:[s.jsx("div",{className:"px-6 py-4 border-b border-gray-200",children:(0,s.jsxs)("div",{className:"flex items-center justify-between",children:[(0,s.jsxs)("h3",{className:"text-lg font-medium text-gray-900",children:[o.charAt(0).toUpperCase()+o.slice(1)," Payroll Details"]}),(0,s.jsxs)("div",{className:"flex items-center space-x-4",children:["weekly"===o&&s.jsx("button",{onClick:saveDeductionsAndRefunds,disabled:W,className:"flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed",children:W?(0,s.jsxs)(s.Fragment,{children:[s.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-white"}),s.jsx("span",{children:"Saving..."})]}):(0,s.jsxs)(s.Fragment,{children:[s.jsx(u.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Save Deductions & Refunds"})]})}),(0,s.jsxs)("button",{onClick:()=>{if(0===X.length)return;let e=new Date,t=e.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}),a=getDateRangeText(),s=X.map((e,s)=>`
        ${s>0?'<div style="page-break-before: always;"></div>':""}
        <div class="payslip">
          <div class="header">
            <div class="company-name">Gilnaks Food Corporation</div>
            <div class="payslip-title">PAYSLIP</div>
            <div class="generated-date">Generated on: ${t}</div>
          </div>
          
          <div class="employee-info">
            <div class="info-item">
              <div class="info-label">Employee</div>
              <div class="info-value">${e.staffName}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Period</div>
              <div class="info-value">${a}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Rate</div>
              <div class="info-value">₱${e.hourlyRate.toFixed(2)}/hr</div>
            </div>
          </div>
          
          <div class="days-worked">
            <div class="section-title">Days Worked</div>
            ${(()=>{if(!e.locationGroups||0===Object.keys(e.locationGroups).length)return'<div class="no-days">No days worked recorded</div>';let t="";return Object.entries(e.locationGroups).forEach(([e,a])=>{t+=`
            <div class="location-group">
              <div class="location-header">${e}</div>
              <div class="days-grid">
                ${a.map(e=>{let t=getDayStatusForDate(e.scheduleDate);return`
                    <div class="day-item ${"regular-holiday"===t?"holiday":"special-holiday"===t?"special":"regular"}">
                      <div class="day-date">${e.date}</div>
                      <div class="day-name">${e.dayName}</div>
                      <div class="day-hours">${e.hours}h</div>
                    </div>
                  `}).join("")}
              </div>
            </div>
          `}),t})()}
          </div>
          
          <div class="section-title">Earnings Breakdown</div>
          <table class="earnings-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Hours</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Regular Hours</td>
                <td>${e.regularHours.toFixed(1)}</td>
                <td>₱${e.hourlyRate.toFixed(2)}</td>
                <td class="amount">₱${e.regularPay.toFixed(2)}</td>
              </tr>
              ${e.doublePay>0?`
              <tr>
                <td>Regular Holiday (x2)</td>
                <td>${e.doublePayHours.toFixed(1)}</td>
                <td>₱${(2*e.hourlyRate).toFixed(2)}</td>
                <td class="amount">₱${e.doublePay.toFixed(2)}</td>
              </tr>
              `:""}
              ${e.specialPay>0?`
              <tr>
                <td>Special Holiday (1.3x)</td>
                <td>${e.specialPayHours.toFixed(1)}</td>
                <td>₱${(1.3*e.hourlyRate).toFixed(2)}</td>
                <td class="amount">₱${e.specialPay.toFixed(2)}</td>
              </tr>
              `:""}
              ${e.overtimePay>0?`
              <tr>
                <td>Overtime (after 48 hrs)</td>
                <td>${e.overtimeHours.toFixed(1)}</td>
                <td>₱${(1.25*e.hourlyRate).toFixed(2)}</td>
                <td class="amount">₱${e.overtimePay.toFixed(2)}</td>
              </tr>
              `:""}
              <tr style="border-top: 2px solid #000; font-weight: 700;">
                <td>TOTAL PAY</td>
                <td></td>
                <td></td>
                <td class="amount">₱${e.totalPay.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="deductions">
            <div class="section-title">Deductions & Refunds</div>
            <div class="deduction-row">
              <span>Utilities</span>
              <span>₱${e.deductions.utilities.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Shortages</span>
              <span>₱${e.deductions.shortages.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Cash Advances</span>
              <span>₱${e.deductions.cashAdvances.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Penalties</span>
              <span>₱${e.deductions.penalties.toFixed(2)}</span>
            </div>
            <div class="deduction-row">
              <span>Others</span>
              <span>₱${e.deductions.others.toFixed(2)}</span>
            </div>
            <div class="deduction-row total-deductions">
              <span>DEDUCTIONS</span>
              <span>₱${Object.values(e.deductions).reduce((e,t)=>e+(t||0),0).toFixed(2)}</span>
            </div>
            ${e.refunds>0?`
            <div class="deduction-row" style="color: #000; font-weight: 600; margin-top: 8px;">
              <span>Refunds</span>
              <span>+₱${e.refunds.toFixed(2)}</span>
            </div>
            `:""}
          </div>
          
          <div class="net-pay">
            <div class="net-pay-label">NET PAY</div>
            <div class="net-pay-amount">₱${e.netPay.toFixed(2)}</div>
          </div>
          
          <div class="footer">
            <p>This payslip is computer generated and does not require a signature.</p>
            <p>For inquiries, please contact the HR department.</p>
          </div>
        </div>
      `).join(""),r=`
      <!DOCTYPE html>
      <html>
      <head>
        <title>All Payslips</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
          }
          
          .payslip {
            width: 7.5in;
            margin: 0 auto;
            background: white;
            padding: 0.15in;
            font-size: 12px;
            line-height: 1.3;
          }
          
          .header {
            text-align: center;
            margin-bottom: 10px;
          }
          
          .company-name {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 3px;
            color: #000;
          }
          
          .payslip-title {
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 3px;
            color: #000;
          }
          
          .generated-date {
            font-size: 11px;
            color: #000;
          }
          
          .employee-info {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 30px;
            margin-bottom: 12px;
          }
          
          .info-item {
            text-align: center;
          }
          
          .info-label {
            font-size: 10px;
            font-weight: 600;
            color: #000;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          
          .info-value {
            font-size: 14px;
            font-weight: 600;
            color: #000;
          }
          
          .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #000;
            margin: 10px 0 6px 0;
          }
          
          .days-worked {
            margin-bottom: 12px;
          }
          
          .location-group {
            margin-bottom: 8px;
            display: inline-block;
            margin-right: 20px;
            vertical-align: top;
          }
          
          .location-header {
            font-size: 13px;
            font-weight: 600;
            color: #000;
            margin-bottom: 6px;
            padding: 4px 0;
            background: #f0f0f0;
            text-align: center;
          }
          
          .days-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(55px, 1fr));
            gap: 5px;
            max-width: 200px;
            justify-content: center;
          }
          
          .day-item {
            padding: 5px;
            text-align: center;
            font-size: 12px;
            background: white;
            color: #000;
            border: 1px solid #ddd;
          }
          
          .day-item.regular {
            background: white;
            color: #000;
          }
          
          .day-item.holiday {
            background: #f0f0f0;
            color: #000;
          }
          
          .day-item.special {
            background: #e0e0e0;
            color: #000;
          }
          
          .day-date {
            font-weight: 600;
            font-size: 11px;
            margin-bottom: 3px;
          }
          
          .day-name {
            font-size: 10px;
            opacity: 0.8;
            margin-bottom: 3px;
          }
          
          .day-hours {
            font-weight: 600;
            font-size: 11px;
          }
          
          .no-days {
            text-align: center;
            color: #000;
            font-style: italic;
            padding: 10px;
            font-size: 11px;
          }
          
          .earnings-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
            font-size: 15px;
          }
          
          .earnings-table th {
            background: #f0f0f0;
            padding: 10px 14px;
            text-align: left;
            font-size: 14px;
            font-weight: 600;
            color: #000;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
          }
          
          .earnings-table th:last-child {
            text-align: right;
          }
          
          .earnings-table td {
            padding: 10px 14px;
            font-size: 15px;
            color: #000;
            border-bottom: 1px solid #eee;
          }
          
          .earnings-table .amount {
            text-align: right;
            font-weight: 600;
            color: #000;
          }
          
          .deductions {
            margin-bottom: 10px;
          }
          
          .deduction-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            font-size: 13px;
            color: #000;
          }
          
          .total-deductions {
            font-weight: 700;
            color: #000;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #000;
          }
          
          .net-pay {
            padding: 10px;
            text-align: center;
            background: #f0f0f0;
            border: 1px solid #000;
          }
          
          .net-pay-label {
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 4px;
            color: #000;
          }
          
          .net-pay-amount {
            font-size: 18px;
            font-weight: 700;
            color: #000;
          }
          
          .footer {
            text-align: center;
            font-size: 10px;
            color: #000;
            margin-top: 10px;
            padding-top: 6px;
            border-top: 1px solid #000;
          }
          
          .footer p {
            margin-bottom: 3px;
          }
          
          @media print {
            body {
              background: white;
              margin: 0;
              padding: 0;
            }
            .payslip {
              box-shadow: none;
              margin: 0;
              border: none;
              padding: 0.15in;
              width: 7.5in;
            }
            @page {
              margin: 0.5in;
              size: letter;
            }
          }
        </style>
      </head>
      <body>
        ${s}
      </body>
      </html>
    `,l=document.createElement("iframe");l.style.position="absolute",l.style.left="-9999px",l.style.top="-9999px",l.style.width="0",l.style.height="0",l.style.border="none",document.body.appendChild(l);let i=l.contentDocument||l.contentWindow?.document;i&&(i.open(),i.write(r),i.close(),l.onload=()=>{l.contentWindow?.focus(),l.contentWindow?.print(),setTimeout(()=>{document.body.removeChild(l)},1e3)})},className:"flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700",children:[s.jsx(S.Z,{className:"h-4 w-4"}),s.jsx("span",{children:"Print All"})]})]})]})}),l||ee?l?(0,s.jsxs)("div",{className:"p-12 text-center",children:[s.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"}),s.jsx("p",{className:"text-gray-600",children:"Calculating payroll..."})]}):s.jsx("div",{className:"overflow-x-auto",children:(0,s.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[s.jsx("thead",{className:"bg-gray-50",children:(0,s.jsxs)("tr",{children:[s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Staff Member"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Days Worked"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Hours Breakdown"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Pay Breakdown"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Deductions & Refunds"}),s.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Net Pay"})]})}),s.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:X.map((e,t)=>(0,s.jsxs)("tr",{className:"hover:bg-gray-50 cursor-pointer transition-colors duration-200 hover:shadow-md",onClick:()=>generatePayslip(e),title:"Click to print payslip",children:[(0,s.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900",children:[s.jsx("div",{className:"font-medium text-gray-900",children:e.staffName}),(0,s.jsxs)("div",{className:"text-xs text-gray-600 font-medium",children:["₱",e.hourlyRate.toFixed(2),"/hr"]}),e.dailySalesBreakdown&&e.dailySalesBreakdown.length>0&&(0,s.jsxs)("div",{className:"mt-1 text-xs",children:[s.jsx("div",{className:"text-gray-500 font-semibold mb-0.5",children:"Daily Sales (This Week):"}),s.jsx("div",{className:"space-y-0.5 max-h-20 overflow-y-auto",children:e.dailySalesBreakdown.sort((e,t)=>new Date(e.date).getTime()-new Date(t.date).getTime()).map((e,t)=>(0,s.jsxs)("div",{className:"flex justify-between text-gray-600",children:[(0,s.jsxs)("span",{children:[new Date(e.date).toLocaleDateString("en-US",{month:"short",day:"numeric"}),":"]}),(0,s.jsxs)("span",{className:"font-medium",children:["₱",e.sales.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})]})]},t))})]}),void 0!==e.averageWeeklySales&&e.averageWeeklySales>0&&(0,s.jsxs)("div",{className:"text-xs text-blue-600 font-medium mt-1 pt-1 border-t border-gray-200",children:["Avg Sales This Week: ₱",e.averageWeeklySales.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})]}),void 0!==e.averageMonthlySales&&e.averageMonthlySales>0&&(0,s.jsxs)("div",{className:"text-xs text-green-600 font-medium mt-0.5",children:["Avg Sales This Month: ₱",e.averageMonthlySales.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})]})]}),s.jsx("td",{className:"px-6 py-4 text-sm text-gray-900",children:s.jsx("div",{className:"space-y-3",children:Object.entries(e.locationGroups).map(([e,t])=>(0,s.jsxs)("div",{className:"space-y-2",children:[(0,s.jsxs)("div",{className:"text-xs font-semibold text-gray-600 uppercase tracking-wide",children:[e," - ",t[0]?.brandName||"Unknown Brand"]}),s.jsx("div",{className:"grid grid-cols-3 gap-2 max-w-md",children:t.map((e,t)=>{let a=getDayStatusForDate(e.scheduleDate),r=e.isAbsent?"bg-red-200 text-red-900 border border-red-300":getDayColorClasses(a);return(0,s.jsxs)("div",{className:`inline-flex flex-col items-center justify-center px-2 py-1 rounded-lg text-xs font-medium ${r}`,children:[s.jsx("span",{className:"font-semibold",children:e.date}),(0,s.jsxs)("span",{className:"text-xs opacity-75",children:[e.dayName," ",e.hours,"h"]}),e.isAbsent&&s.jsx("span",{className:"text-[9px] font-semibold",children:"ABSENT"})]},t)})})]},e))})}),s.jsx("td",{className:"px-6 py-4 text-sm text-gray-900",children:(0,s.jsxs)("div",{className:"space-y-1",children:[(0,s.jsxs)("div",{className:"flex justify-between",children:[s.jsx("span",{className:"text-gray-600",children:"Regular:"}),(0,s.jsxs)("span",{className:"font-medium",children:[e.regularHours.toFixed(1)," hrs"]})]}),e.doublePayHours>0&&(0,s.jsxs)("div",{className:"flex justify-between",children:[s.jsx("span",{className:"text-gray-600",children:"Double (x2):"}),(0,s.jsxs)("span",{className:"font-medium text-orange-600",children:[e.doublePayHours.toFixed(1)," hrs"]})]}),e.specialPayHours>0&&(0,s.jsxs)("div",{className:"flex justify-between",children:[s.jsx("span",{className:"text-gray-600",children:"Special (1.3x):"}),(0,s.jsxs)("span",{className:"font-medium text-violet-600",children:[e.specialPayHours.toFixed(1)," hrs"]})]}),e.overtimeHours>0&&(0,s.jsxs)("div",{className:"flex justify-between",children:[s.jsx("span",{className:"text-gray-600",children:"Overtime:"}),(0,s.jsxs)("span",{className:"font-medium text-red-600",children:[e.overtimeHours.toFixed(1)," hrs"]})]}),(0,s.jsxs)("div",{className:"flex justify-between border-t pt-1",children:[s.jsx("span",{className:"text-gray-600 font-medium",children:"Total:"}),(0,s.jsxs)("span",{className:"font-bold",children:[e.hours.toFixed(1)," hrs"]})]})]})}),s.jsx("td",{className:"px-6 py-4 text-sm text-gray-900",children:(0,s.jsxs)("div",{className:"space-y-1",children:[s.jsx("div",{className:"flex justify-end",children:s.jsx("span",{className:"font-medium",children:formatCurrency(e.regularPay)})}),e.doublePay>0&&s.jsx("div",{className:"flex justify-end",children:s.jsx("span",{className:"font-medium text-orange-600",children:formatCurrency(e.doublePay)})}),e.specialPay>0&&s.jsx("div",{className:"flex justify-end",children:s.jsx("span",{className:"font-medium text-violet-600",children:formatCurrency(e.specialPay)})}),e.overtimePay>0&&s.jsx("div",{className:"flex justify-end",children:s.jsx("span",{className:"font-medium text-red-600",children:formatCurrency(e.overtimePay)})}),s.jsx("div",{className:"flex justify-end border-t pt-1",children:s.jsx("span",{className:"font-bold text-green-600",children:formatCurrency(e.totalPay)})})]})}),s.jsx("td",{className:"px-6 py-4 text-sm text-gray-900",children:(0,s.jsxs)("div",{className:"space-y-2",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-gray-600 text-xs",children:"Utilities:"}),s.jsx("input",{type:"number",min:"0",step:"0.01",value:getInputValue(e.staffId,"utilities",e.deductions.utilities),onChange:t=>updateInputValue(e.staffId,"utilities",t.target.value),className:"w-12 text-xs border border-gray-300 rounded px-1 py-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",onClick:e=>e.stopPropagation(),onFocus:e=>e.stopPropagation(),onBlur:e=>e.stopPropagation()})]}),(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-gray-600 text-xs",children:"Shortages:"}),s.jsx("input",{type:"number",min:"0",step:"0.01",value:getInputValue(e.staffId,"shortages",e.deductions.shortages),onChange:t=>updateInputValue(e.staffId,"shortages",t.target.value),className:"w-12 text-xs border border-gray-300 rounded px-1 py-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",onClick:e=>e.stopPropagation(),onFocus:e=>e.stopPropagation(),onBlur:e=>e.stopPropagation()})]}),(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-gray-600 text-xs",children:"Cash Advances:"}),s.jsx("input",{type:"number",min:"0",step:"0.01",value:getInputValue(e.staffId,"cashAdvances",e.deductions.cashAdvances),onChange:t=>updateInputValue(e.staffId,"cashAdvances",t.target.value),className:"w-12 text-xs border border-gray-300 rounded px-1 py-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",onClick:e=>e.stopPropagation(),onFocus:e=>e.stopPropagation(),onBlur:e=>e.stopPropagation()})]}),(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-gray-600 text-xs",children:"Penalties:"}),s.jsx("input",{type:"number",min:"0",step:"0.01",value:getInputValue(e.staffId,"penalties",e.deductions.penalties),onChange:t=>updateInputValue(e.staffId,"penalties",t.target.value),className:"w-12 text-xs border border-gray-300 rounded px-1 py-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",onClick:e=>e.stopPropagation(),onFocus:e=>e.stopPropagation(),onBlur:e=>e.stopPropagation()})]}),(0,s.jsxs)("div",{className:"flex justify-between items-center",children:[s.jsx("span",{className:"text-gray-600 text-xs",children:"Others:"}),s.jsx("input",{type:"number",min:"0",step:"0.01",value:getInputValue(e.staffId,"others",e.deductions.others),onChange:t=>updateInputValue(e.staffId,"others",t.target.value),className:"w-12 text-xs border border-gray-300 rounded px-1 py-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",onClick:e=>e.stopPropagation(),onFocus:e=>e.stopPropagation(),onBlur:e=>e.stopPropagation()})]}),(0,s.jsxs)("div",{className:"flex justify-between border-t pt-1",children:[s.jsx("span",{className:"text-gray-600 font-medium text-xs",children:"Deductions:"}),s.jsx("span",{className:"font-bold text-red-600 text-xs",children:formatCurrency(Number(Object.values(e.deductions).reduce((e,t)=>e+(t||0),0)))})]}),(0,s.jsxs)("div",{className:"flex justify-between items-center mt-2",children:[s.jsx("span",{className:"text-gray-600 text-xs",children:"Refunds:"}),s.jsx("input",{type:"number",min:"0",step:"0.01",value:getInputValue(e.staffId,"refunds",e.refunds),onChange:t=>{let a=parseFloat(t.target.value)||0;Z(t=>({...t,[e.staffId]:a})),updateInputValue(e.staffId,"refunds",t.target.value)},className:"w-12 text-xs border border-gray-300 rounded px-1 py-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",onClick:e=>e.stopPropagation(),onFocus:e=>e.stopPropagation(),onBlur:e=>e.stopPropagation()})]})]})}),s.jsx("td",{className:"px-6 py-4 text-sm text-gray-900",children:s.jsx("div",{className:"text-right",children:s.jsx("span",{className:"text-lg font-bold text-blue-600",children:formatCurrency(e.netPay)})})})]},t))})]})}):(0,s.jsxs)("div",{className:"p-12 text-center",children:[s.jsx(U.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),s.jsx("h3",{className:"text-lg font-medium text-gray-900 mb-2",children:"No payroll data"}),s.jsx("p",{className:"text-gray-600",children:"No staff scheduled for the selected period."})]})]}),F&&s.jsx("div",{className:"bg-red-50 border border-red-200 rounded-md p-4",children:s.jsx("p",{className:"text-red-800",children:F})}),q&&s.jsx("div",{className:"bg-green-50 border border-green-200 rounded-md p-4",children:s.jsx("p",{className:"text-green-800",children:q})})]})}var W=a(3294),V=a(5642),Y=a(9546),G=a(1672);function DashboardPage(){let[e,t]=(0,i.useState)(!1),[a,r]=(0,i.useState)(""),[n,o]=(0,i.useState)(null),[c,m]=(0,i.useState)("products"),[x,u]=(0,i.useState)(""),[g,p]=(0,i.useState)(0),[h,b]=(0,i.useState)(!0);(0,i.useEffect)(()=>{let initializeDashboard=async()=>{b(!0);let e=localStorage.getItem("dashboard_authenticated"),a=localStorage.getItem("dashboard_selected_brand"),s=localStorage.getItem("dashboard_active_tab");if("true"===e&&t(!0),a)try{o(JSON.parse(a))}catch(e){console.error("Error parsing saved brand:",e)}s&&["products","orders","branches","billing","logistics","dsir","staff","payroll"].includes(s)&&m(s),setTimeout(()=>{b(!1)},800)};initializeDashboard()},[]);let handleLogin=async e=>{e.preventDefault(),u("");try{let{data:e,error:s}=await d.O.rpc("validate_admin_credentials",{input_passcode:a});if(s){console.error("Error validating credentials:",s),u("Authentication error. Please try again.");return}e?(t(!0),localStorage.setItem("dashboard_authenticated","true"),u("")):(u("Invalid passcode. Please try again."),r(""))}catch(e){console.error("Login error:",e),u("Authentication error. Please try again.")}},handleLogout=()=>{t(!1),r(""),o(null),m("products"),b(!1),localStorage.removeItem("dashboard_authenticated"),localStorage.removeItem("dashboard_selected_brand"),localStorage.removeItem("dashboard_active_tab")};(0,i.useEffect)(()=>{n?localStorage.setItem("dashboard_selected_brand",JSON.stringify(n)):localStorage.removeItem("dashboard_selected_brand")},[n]),(0,i.useEffect)(()=>{localStorage.setItem("dashboard_active_tab",c)},[c]);let v=(e=>{if(!e)return"blue";switch(e.slug){case"mychoice":return"green";case"gelatofilipino":return"red";case"mang-sorbetes":return"yellow";default:return"blue"}})(n);return h?s.jsx("div",{className:"min-h-screen bg-gray-50 flex items-center justify-center",children:(0,s.jsxs)("div",{className:"text-center",children:[s.jsx("div",{className:`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 ${"green"===v?"bg-green-100":"red"===v?"bg-red-100":"yellow"===v?"bg-yellow-100":"bg-blue-100"}`,children:s.jsx("div",{className:`animate-spin rounded-full h-8 w-8 border-b-2 ${"green"===v?"border-green-600":"red"===v?"border-red-600":"yellow"===v?"border-yellow-600":"border-blue-600"}`})}),s.jsx("h2",{className:"text-xl font-semibold text-gray-900 mb-2",children:"Loading Dashboard"}),s.jsx("p",{className:"text-gray-600",children:"Please wait while we check your session..."})]})}):e?s.jsx(BrandsProvider,{children:(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 min-h-screen bg-gray-50",children:[s.jsx(l(),{id:"a2b699b57cdcad50",children:"nav.jsx-a2b699b57cdcad50::-webkit-scrollbar{display:none}"}),s.jsx("div",{className:"jsx-a2b699b57cdcad50 bg-white shadow-sm border-b",children:(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 max-w-7xl mx-auto px-4 py-3",children:[(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex sm:hidden flex-col gap-3",children:[(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center justify-between",children:[(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center space-x-2",children:[s.jsx(y.Z,{className:`h-6 w-6 ${"green"===v?"text-green-600":"red"===v?"text-red-600":"yellow"===v?"text-yellow-600":"text-blue-600"}`}),s.jsx("h1",{className:"jsx-a2b699b57cdcad50 text-lg font-bold text-gray-900",children:"GFC Portal"})]}),(0,s.jsxs)("button",{onClick:handleLogout,className:"jsx-a2b699b57cdcad50 flex items-center space-x-1 px-2 py-1 text-gray-600 hover:text-gray-900 transition-colors",children:[s.jsx(W.Z,{className:"h-4 w-4"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50 text-sm",children:"Logout"})]})]}),(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center justify-between",children:[s.jsx("div",{className:"jsx-a2b699b57cdcad50 flex-1 mr-3",children:s.jsx(BrandSelector,{onBrandChange:o})}),(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center space-x-1 text-xs text-gray-500",children:[s.jsx("div",{className:"jsx-a2b699b57cdcad50 w-1.5 h-1.5 bg-green-500 rounded-full"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50",children:"Admin"})]})]})]}),(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 hidden sm:flex sm:justify-between sm:items-center",children:[(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center space-x-4",children:[(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center space-x-2",children:[s.jsx(y.Z,{className:`h-8 w-8 ${"green"===v?"text-green-600":"red"===v?"text-red-600":"yellow"===v?"text-yellow-600":"text-blue-600"}`}),s.jsx("h1",{className:"jsx-a2b699b57cdcad50 text-2xl font-bold text-gray-900",children:"GFC Portal"}),n&&s.jsx("span",{className:`jsx-a2b699b57cdcad50 px-3 py-1 rounded-full text-sm font-medium ${"green"===v?"bg-green-100 text-green-800":"red"===v?"bg-red-100 text-red-800":"yellow"===v?"bg-yellow-100 text-yellow-800":"bg-blue-100 text-blue-800"}`,children:n.name})]}),(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center space-x-1 text-sm text-gray-500",children:[s.jsx("div",{className:"jsx-a2b699b57cdcad50 w-2 h-2 bg-green-500 rounded-full"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50",children:"Admin Access"})]})]}),(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center space-x-4",children:[s.jsx(BrandSelector,{onBrandChange:o}),(0,s.jsxs)("button",{onClick:handleLogout,className:"jsx-a2b699b57cdcad50 flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors",children:[s.jsx(W.Z,{className:"h-4 w-4"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50",children:"Logout"})]})]})]})]})}),(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 max-w-7xl mx-auto px-4 py-4 sm:py-8",children:[s.jsx("div",{className:"jsx-a2b699b57cdcad50 mb-6",children:s.jsx("div",{className:"jsx-a2b699b57cdcad50 bg-white rounded-lg shadow-sm border p-4",children:s.jsx("div",{className:"jsx-a2b699b57cdcad50 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4",children:s.jsx("div",{className:"jsx-a2b699b57cdcad50 flex-1",children:s.jsx("div",{className:"jsx-a2b699b57cdcad50 border-b border-gray-200",children:(0,s.jsxs)("nav",{style:{scrollbarWidth:"none",msOverflowStyle:"none"},className:"jsx-a2b699b57cdcad50 -mb-px flex space-x-4 sm:space-x-8 overflow-x-auto",children:[s.jsx("button",{onClick:()=>m("products"),className:`jsx-a2b699b57cdcad50 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${"products"===c?"green"===v?"border-green-500 text-green-600":"red"===v?"border-red-500 text-red-600":"yellow"===v?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center space-x-1 sm:space-x-2",children:[s.jsx(y.Z,{className:"h-4 w-4"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50 hidden sm:inline",children:"Products & Inventory"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50 sm:hidden",children:"Products"})]})}),s.jsx("button",{onClick:()=>m("orders"),className:`jsx-a2b699b57cdcad50 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${"orders"===c?"green"===v?"border-green-500 text-green-600":"red"===v?"border-red-500 text-red-600":"yellow"===v?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center space-x-1 sm:space-x-2",children:[s.jsx(j.Z,{className:"h-4 w-4"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50 hidden sm:inline",children:"Customer Orders"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50 sm:hidden",children:"Orders"})]})}),s.jsx("button",{onClick:()=>m("billing"),className:`jsx-a2b699b57cdcad50 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${"billing"===c?"green"===v?"border-green-500 text-green-600":"red"===v?"border-red-500 text-red-600":"yellow"===v?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center space-x-1 sm:space-x-2",children:[s.jsx(k.Z,{className:"h-4 w-4"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50",children:"Billing"})]})}),s.jsx("button",{onClick:()=>m("logistics"),className:`jsx-a2b699b57cdcad50 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${"logistics"===c?"green"===v?"border-green-500 text-green-600":"red"===v?"border-red-500 text-red-600":"yellow"===v?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center space-x-1 sm:space-x-2",children:[s.jsx(f.Z,{className:"h-4 w-4"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50",children:"Logistics"})]})}),s.jsx("button",{onClick:()=>m("dsir"),className:`jsx-a2b699b57cdcad50 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${"dsir"===c?"green"===v?"border-green-500 text-green-600":"red"===v?"border-red-500 text-red-600":"yellow"===v?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center space-x-1 sm:space-x-2",children:[s.jsx(Y.Z,{className:"h-4 w-4"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50 hidden sm:inline",children:"DSIR Reports"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50 sm:hidden",children:"DSIR"})]})}),s.jsx("button",{onClick:()=>m("staff"),className:`jsx-a2b699b57cdcad50 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${"staff"===c?"green"===v?"border-green-500 text-green-600":"red"===v?"border-red-500 text-red-600":"yellow"===v?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center space-x-1 sm:space-x-2",children:[s.jsx(G.Z,{className:"h-4 w-4"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50",children:"Staff Manager"})]})}),s.jsx("button",{onClick:()=>m("payroll"),className:`jsx-a2b699b57cdcad50 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${"payroll"===c?"green"===v?"border-green-500 text-green-600":"red"===v?"border-red-500 text-red-600":"yellow"===v?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center space-x-1 sm:space-x-2",children:[s.jsx(U.Z,{className:"h-4 w-4"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50",children:"Payroll"})]})}),s.jsx("button",{onClick:()=>m("branches"),className:`jsx-a2b699b57cdcad50 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${"branches"===c?"green"===v?"border-green-500 text-green-600":"red"===v?"border-red-500 text-red-600":"yellow"===v?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 flex items-center space-x-1 sm:space-x-2",children:[s.jsx(L.Z,{className:"h-4 w-4"}),s.jsx("span",{className:"jsx-a2b699b57cdcad50",children:"Branches"})]})})]})})})})})}),(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 bg-white rounded-lg shadow-sm border",children:["products"===c&&n&&s.jsx("div",{className:"jsx-a2b699b57cdcad50 p-4 sm:p-6",children:s.jsx(ProductManager,{selectedBrand:n,theme:v},g)}),"orders"===c&&s.jsx("div",{className:"jsx-a2b699b57cdcad50 p-4 sm:p-6",children:s.jsx(OrderManager,{selectedBrand:n,onOrderUpdate:()=>{p(e=>e+1)},theme:v},g)}),"branches"===c&&n&&s.jsx("div",{className:"jsx-a2b699b57cdcad50 p-4 sm:p-6",children:s.jsx(BranchManager,{selectedBrand:n,theme:v},g)}),!n&&"branches"===c&&(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 p-4 sm:p-6 text-center py-12",children:[s.jsx(L.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),s.jsx("p",{className:"jsx-a2b699b57cdcad50 text-gray-600",children:"Please select a brand to manage branches"})]}),"billing"===c&&n&&s.jsx("div",{className:"jsx-a2b699b57cdcad50 p-4 sm:p-6",children:s.jsx(BillingManager,{selectedBrand:n,theme:v},g)}),!n&&"billing"===c&&(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 p-4 sm:p-6 text-center py-12",children:[s.jsx(k.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),s.jsx("p",{className:"jsx-a2b699b57cdcad50 text-gray-600",children:"Please select a brand to manage billing"})]}),"logistics"===c&&n&&s.jsx("div",{className:"jsx-a2b699b57cdcad50 p-4 sm:p-6",children:s.jsx(LogisticsManager,{selectedBrand:n,theme:v},g)}),!n&&"logistics"===c&&(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 p-4 sm:p-6 text-center py-12",children:[s.jsx(f.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),s.jsx("p",{className:"jsx-a2b699b57cdcad50 text-gray-600",children:"Please select a brand to manage logistics"})]}),"dsir"===c&&n&&s.jsx("div",{className:"jsx-a2b699b57cdcad50 p-4 sm:p-6",children:s.jsx(q.N,{selectedBrand:n,theme:v})}),!n&&"dsir"===c&&(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 p-4 sm:p-6 text-center py-12",children:[s.jsx(Y.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),s.jsx("p",{className:"jsx-a2b699b57cdcad50 text-gray-600",children:"Please select a brand to view DSIR reports"})]}),"staff"===c&&s.jsx("div",{className:"jsx-a2b699b57cdcad50 p-4 sm:p-6",children:s.jsx(StaffManager,{theme:v})}),"payroll"===c&&s.jsx("div",{className:"jsx-a2b699b57cdcad50 p-4 sm:p-6",children:s.jsx(PayrollManager,{})}),!n&&"products"===c&&(0,s.jsxs)("div",{className:"jsx-a2b699b57cdcad50 p-4 sm:p-6 text-center py-12",children:[s.jsx(y.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),s.jsx("p",{className:"jsx-a2b699b57cdcad50 text-gray-600",children:"Please select a brand to manage products"})]})]})]})]})}):(0,s.jsxs)("div",{className:"min-h-screen bg-gray-50 flex flex-col items-center justify-center",children:[(0,s.jsxs)("div",{className:"max-w-md w-full bg-white rounded-lg shadow-md p-8",children:[(0,s.jsxs)("div",{className:"text-center mb-8",children:[s.jsx("div",{className:"mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4",children:s.jsx(W.Z,{className:"h-6 w-6 text-blue-600"})}),s.jsx("h2",{className:"text-2xl font-bold text-gray-900",children:"Admin Dashboard"}),s.jsx("p",{className:"text-gray-600 mt-2",children:"Enter passcode to access inventory management"})]}),(0,s.jsxs)("form",{onSubmit:handleLogin,className:"space-y-6",children:[(0,s.jsxs)("div",{children:[s.jsx("label",{htmlFor:"passcode",className:"block text-sm font-medium text-gray-700 mb-2",children:"Admin Passcode"}),s.jsx("input",{type:"password",id:"passcode",value:a,onChange:e=>r(e.target.value),className:"w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg tracking-wider",placeholder:"Enter 6-digit passcode",maxLength:10,required:!0})]}),x&&s.jsx("div",{className:"bg-red-50 border border-red-200 rounded-lg p-3",children:s.jsx("p",{className:"text-red-800 text-sm",children:x})}),(0,s.jsxs)("button",{type:"submit",className:"w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors",children:[s.jsx(V.Z,{className:"h-5 w-5"}),s.jsx("span",{children:"Access Dashboard"})]})]})]}),s.jsx("div",{className:"mt-8",children:s.jsx("p",{className:"text-center text-xs text-gray-500",children:"\xa9 Gilnaks Food Corporation"})})]})}},1618:(e,t,a)=>{"use strict";a.r(t),a.d(t,{$$typeof:()=>i,__esModule:()=>l,default:()=>d});var s=a(5153);let r=(0,s.createProxy)(String.raw`C:\Users\John\Desktop\gfc\inventory-system\app\dashboard\page.tsx`),{__esModule:l,$$typeof:i}=r,n=r.default,d=n}};var t=require("../../webpack-runtime.js");t.C(e);var __webpack_exec__=e=>t(t.s=e),a=t.X(0,[862,780,458,641,930,956,911,867],()=>__webpack_exec__(9854));module.exports=a})();