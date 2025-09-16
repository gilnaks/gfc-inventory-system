(()=>{var e={};e.id=702,e.ids=[702],e.modules={5403:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external")},4749:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external")},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},5528:e=>{"use strict";e.exports=require("next/dist\\client\\components\\action-async-storage.external.js")},1877:e=>{"use strict";e.exports=require("next/dist\\client\\components\\request-async-storage.external.js")},5319:e=>{"use strict";e.exports=require("next/dist\\client\\components\\static-generation-async-storage.external.js")},4300:e=>{"use strict";e.exports=require("buffer")},6113:e=>{"use strict";e.exports=require("crypto")},2361:e=>{"use strict";e.exports=require("events")},3685:e=>{"use strict";e.exports=require("http")},5687:e=>{"use strict";e.exports=require("https")},5477:e=>{"use strict";e.exports=require("punycode")},2781:e=>{"use strict";e.exports=require("stream")},7310:e=>{"use strict";e.exports=require("url")},3837:e=>{"use strict";e.exports=require("util")},9796:e=>{"use strict";e.exports=require("zlib")},9854:(e,t,r)=>{"use strict";r.r(t),r.d(t,{GlobalError:()=>o.a,__next_app__:()=>m,originalPathname:()=>x,pages:()=>c,routeModule:()=>u,tree:()=>d});var a=r(7096),s=r(6132),l=r(7284),o=r.n(l),i=r(2564),n={};for(let e in i)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(n[e]=()=>i[e]);r.d(t,n);let d=["",{children:["dashboard",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(r.bind(r,1618)),"C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\dashboard\\page.tsx"]}]},{}]},{layout:[()=>Promise.resolve().then(r.bind(r,5345)),"C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\layout.tsx"],"not-found":[()=>Promise.resolve().then(r.t.bind(r,9291,23)),"next/dist/client/components/not-found-error"]}],c=["C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\dashboard\\page.tsx"],x="/dashboard/page",m={require:r,loadChunk:()=>Promise.resolve()},u=new a.AppPageRouteModule({definition:{kind:s.x.APP_PAGE,page:"/dashboard/page",pathname:"/dashboard",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:d}})},5537:(e,t,r)=>{Promise.resolve().then(r.bind(r,6259))},6259:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>DashboardPage});var a=r(784),s=r(9885),l=r.n(s),o=r(9708);function BrandSelector({onBrandChange:e}){let[t,r]=(0,s.useState)([]),[l,i]=(0,s.useState)(null),[n,d]=(0,s.useState)(!0);(0,s.useEffect)(()=>{fetchBrands()},[]);let fetchBrands=async()=>{try{console.log("Fetching brands from Supabase...");let{data:t,error:a}=await o.O.from("brands").select("*").order("name");if(console.log("Supabase response:",{data:t,error:a}),a){console.error("Error fetching brands:",a);return}t&&(console.log("Brands loaded:",t),r(t),t.length>0&&(i(t[0]),e(t[0])))}catch(e){console.error("Error fetching brands:",e)}finally{d(!1)}},handleBrandChange=r=>{let a=t.find(e=>e.id===r);a&&(i(a),e(a))};return n?(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"}),a.jsx("span",{className:"text-gray-600",children:"Loading brands..."})]}):(0,a.jsxs)("div",{className:"flex items-center space-x-3",children:[a.jsx("label",{htmlFor:"brand-select",className:"text-sm font-medium text-gray-700 whitespace-nowrap",children:"Brand:"}),a.jsx("select",{id:"brand-select",value:l?.id||"",onChange:e=>handleBrandChange(e.target.value),className:"px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm min-w-[140px]",children:t.map(e=>a.jsx("option",{value:e.id,children:e.name},e.id))})]})}var i=r(2032),n=r(2385),d=r(6206),c=r(2995),x=r(9494),m=r(6303),u=r(7820);function ProductManager({selectedBrand:e,theme:t="blue"}){let[r,l]=(0,s.useState)([]),[p,h]=(0,s.useState)(!1),[g,b]=(0,s.useState)(!1),[f,y]=(0,s.useState)(null),[v,j]=(0,s.useState)({name:"",sku:"",category:"",unit:"pcs",price:0,initial_stock:0,production:0,released:0,reserved:0}),[w,N]=(0,s.useState)([]),[k,_]=(0,s.useState)(!1);(0,s.useEffect)(()=>{e&&fetchProducts()},[e]),(0,s.useEffect)(()=>{if(!e)return;let t=o.O.channel("products-changes").on("postgres_changes",{event:"*",schema:"public",table:"products",filter:`brand_id=eq.${e.id}`},e=>{console.log("Products realtime update:",e),f?console.log("Skipping realtime refetch - currently editing product"):fetchProducts()}).subscribe();return()=>{o.O.removeChannel(t)}},[e,f]),(0,s.useEffect)(()=>{let e=Array.from(new Set(r.map(e=>e.category).filter(e=>e&&""!==e.trim()))).sort();N(e)},[r]),(0,s.useEffect)(()=>{let handleClickOutside=e=>{let t=e.target;k&&!t.closest(".category-dropdown")&&_(!1)};if(k)return document.addEventListener("mousedown",handleClickOutside),()=>document.removeEventListener("mousedown",handleClickOutside)},[k]);let getBrandPrefix=e=>{switch(e){case"gelatofilipino":return"GF-";case"mychoice":return"MC-";case"mang-sorbetes":return"MS-";default:return"PR-"}},generateNextSKU=async t=>{if(!e)return"";try{let{data:r,error:a}=await o.O.from("products").select("sku").eq("brand_id",t).not("sku","is",null);if(a)return console.error("Error fetching products for SKU generation:",a),getBrandPrefix(e.slug)+"001";let s=getBrandPrefix(e.slug),l=0;r&&r.length>0&&r.forEach(e=>{if(e.sku&&e.sku.startsWith(s)){let t=e.sku.substring(s.length),r=parseInt(t);!isNaN(r)&&r>l&&(l=r)}});let i=l+1;return s+i.toString().padStart(3,"0")}catch(t){return console.error("Error generating SKU:",t),getBrandPrefix(e.slug)+"001"}},fetchProducts=async()=>{if(e){h(!0);try{let{data:t,error:r}=await o.O.from("inventory_summary").select("*").eq("brand_id",e.id).order("product_name");if(r){console.error("Error fetching products:",r);return}t&&l(t)}catch(e){console.error("Error fetching products:",e)}finally{h(!1)}}},handleAddProduct=async t=>{if(t.preventDefault(),e)try{let{data:t,error:r}=await o.O.from("products").insert([{brand_id:e.id,name:v.name,sku:v.sku||null,category:v.category||null,unit:v.unit,price:v.price,initial_stock:v.initial_stock,production:v.production,released:v.released,reserved:v.reserved}]).select();if(r){console.error("Error adding product:",r),alert("Error adding product: "+r.message);return}t&&(await fetchProducts(),j({name:"",sku:"",category:"",unit:"pcs",price:0,initial_stock:0,production:0,released:0,reserved:0}),b(!1))}catch(e){console.error("Error adding product:",e),alert("Error adding product")}},handleUpdateProduct=async e=>{try{let{data:t,error:r}=await o.O.from("products").update({name:e.name,sku:e.sku,category:e.category,unit:e.unit,price:e.price,initial_stock:e.initial_stock,production:e.production,released:e.released,reserved:e.reserved}).eq("id",e.id).select();if(r){console.error("Error updating product:",r),alert("Error updating product: "+r.message);return}t&&(await fetchProducts(),y(null))}catch(e){console.error("Error updating product:",e),alert("Error updating product")}},handleDeleteProduct=async e=>{if(confirm("Are you sure you want to delete this product?"))try{let{error:t}=await o.O.from("products").delete().eq("id",e);if(t){console.error("Error deleting product:",t),alert("Error deleting product: "+t.message);return}console.log("Product deleted successfully"),l(r.filter(t=>(t.product_id||t.id)!==e)),setTimeout(async()=>{console.log("Refetching products to ensure consistency"),await fetchProducts()},500)}catch(e){console.error("Error deleting product:",e),alert("Error deleting product")}},handleFinalizeStock=async()=>{if(e&&confirm("Are you sure you want to finalize the stock? This will move final stock to initial stock and clear production/released quantities for all products."))try{let{data:t,error:r}=await o.O.from("products").select("*").eq("brand_id",e.id);if(r){console.error("Error fetching products:",r),alert("Error fetching products for finalization");return}if(!t||0===t.length){alert("No products found to finalize");return}let{data:a,error:s}=await o.O.from("daily_stock_summaries").insert({brand_id:e.id,date:(0,u.sn)(),total_production:t.reduce((e,t)=>e+(t.production||0),0),total_released:t.reduce((e,t)=>e+(t.released||0),0),total_final_stock:t.reduce((e,t)=>e+(t.initial_stock||0)+(t.production||0)-(t.released||0),0)}).select().single();if(s){console.error("Error creating daily summary:",s),alert("Error creating daily summary");return}for(let e of t){let t=(e.initial_stock||0)+(e.production||0)-(e.released||0),{error:r}=await o.O.from("products").update({initial_stock:t,production:0,released:0,updated_at:new Date().toISOString()}).eq("id",e.id);if(r){console.error(`Error updating product ${e.name}:`,r),alert(`Error updating product ${e.name}`);return}}alert("Stock finalized successfully! All products have been updated for the next day."),await fetchProducts()}catch(e){console.error("Error finalizing stock:",e),alert("Error finalizing stock")}};return e?(0,a.jsxs)("div",{className:"space-y-6",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[(0,a.jsxs)("h3",{className:"text-xl font-semibold text-gray-900",children:["Products for ",e.name]}),(0,a.jsxs)("div",{className:"flex space-x-3",children:[(0,a.jsxs)("button",{onClick:handleFinalizeStock,className:"flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors bg-orange-600 hover:bg-orange-700",children:[a.jsx(i.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Finalize Stock"})]}),(0,a.jsxs)("button",{onClick:async()=>{let t=await generateNextSKU(e.id);j({...v,sku:t}),b(!0)},className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${"green"===t?"bg-green-600 hover:bg-green-700":"red"===t?"bg-red-600 hover:bg-red-700":"yellow"===t?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[a.jsx(n.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Add Product"})]})]})]}),g&&a.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,a.jsxs)("div",{className:"relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[a.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"Add New Product"}),a.jsx("button",{onClick:()=>{b(!1),j({name:"",sku:"",category:"",unit:"pcs",price:0,initial_stock:0,production:0,released:0,reserved:0})},className:"text-gray-400 hover:text-gray-600",children:a.jsx(d.Z,{className:"h-6 w-6"})})]}),(0,a.jsxs)("form",{onSubmit:handleAddProduct,className:"space-y-4",children:[(0,a.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Product Name *"}),a.jsx("input",{type:"text",required:!0,value:v.name,onChange:e=>j({...v,name:e.target.value}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"Enter product name"})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"SKU (Auto-generated)"}),a.jsx("input",{type:"text",value:v.sku,onChange:e=>j({...v,sku:e.target.value}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50",placeholder:"Auto-generated SKU"}),(0,a.jsxs)("p",{className:"text-xs text-gray-500 mt-1",children:["SKU format: ",getBrandPrefix(e.slug),"XXX (e.g., ",getBrandPrefix(e.slug),"001)"]})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Category"}),(0,a.jsxs)("div",{className:"relative category-dropdown",children:[a.jsx("input",{type:"text",value:v.category,onChange:e=>{j({...v,category:e.target.value}),_(!0)},onFocus:()=>_(!0),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"Enter or select category"}),k&&w.length>0&&a.jsx("div",{className:"absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto",children:w.map(e=>a.jsx("button",{type:"button",onClick:t=>{t.preventDefault(),t.stopPropagation(),j({...v,category:e}),_(!1)},onMouseDown:e=>{e.preventDefault(),e.stopPropagation()},className:"w-full text-left px-3 py-2 hover:bg-gray-100 text-sm",children:e},e))})]})]}),(0,a.jsxs)("div",{className:"grid grid-cols-3 gap-4",children:[(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Initial Stock"}),a.jsx("input",{type:"number",min:"0",value:v.initial_stock,onChange:e=>j({...v,initial_stock:parseInt(e.target.value)||0}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"0"})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Unit"}),(0,a.jsxs)("select",{value:v.unit,onChange:e=>j({...v,unit:e.target.value}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",children:[a.jsx("option",{value:"pans",children:"Pans"}),a.jsx("option",{value:"pcs",children:"Pieces"}),a.jsx("option",{value:"gallons",children:"Gallons"}),a.jsx("option",{value:"liters",children:"Liters"}),a.jsx("option",{value:"kg",children:"Kilograms"}),a.jsx("option",{value:"boxes",children:"Boxes"}),a.jsx("option",{value:"bags",children:"Bags"}),a.jsx("option",{value:"g",children:"Grams"}),a.jsx("option",{value:"bottles",children:"Bottles"}),a.jsx("option",{value:"packs",children:"Packs"})]})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Price (₱)"}),a.jsx("input",{type:"number",min:"0",step:"0.01",value:v.price,onChange:e=>j({...v,price:parseFloat(e.target.value)||0}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"0.00"})]})]})]}),(0,a.jsxs)("div",{className:"flex justify-end space-x-3 pt-4",children:[a.jsx("button",{type:"button",onClick:()=>{b(!1),j({name:"",sku:"",category:"",unit:"pcs",price:0,initial_stock:0,production:0,released:0,reserved:0})},className:"px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors",children:"Cancel"}),(0,a.jsxs)("button",{type:"submit",className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${"green"===t?"bg-green-600 hover:bg-green-700":"red"===t?"bg-red-600 hover:bg-red-700":"yellow"===t?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[a.jsx(c.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Save Product"})]})]})]})]})}),p?(0,a.jsxs)("div",{className:"flex items-center justify-center py-8",children:[a.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"}),a.jsx("span",{className:"ml-3 text-gray-600",children:"Loading products..."})]}):0===r.length?(0,a.jsxs)("div",{className:"text-center py-8 text-gray-500",children:[(0,a.jsxs)("p",{children:["No products found for ",e.name]}),a.jsx("p",{className:"text-sm",children:'Click "Add Product" to create your first product'})]}):a.jsx("div",{className:"space-y-6",children:(e=>{let t=e.reduce((e,t)=>{let r=t.category||"Uncategorized";return e[r]||(e[r]=[]),e[r].push(t),e},{}),r=Object.keys(t).sort((e,t)=>"Uncategorized"===e?1:"Uncategorized"===t?-1:e.localeCompare(t));return r.map(e=>({category:e,products:t[e]}))})(r).map(({category:e,products:r})=>(0,a.jsxs)("div",{className:"bg-white rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 ease-in-out",children:[a.jsx("div",{className:"bg-gray-50 px-6 py-3 border-b hover:bg-gray-100 transition-colors duration-200 ease-in-out",children:(0,a.jsxs)("h3",{className:"text-lg font-medium text-gray-900",children:[e," (",r.length," ",1===r.length?"product":"products",")"]})}),a.jsx("div",{className:"overflow-x-auto",children:(0,a.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[a.jsx("thead",{className:"bg-gray-50",children:(0,a.jsxs)("tr",{children:[a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48",children:"Product Name"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32",children:"SKU"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Unit"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Price"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Initial Stock"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Prod"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Rel"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Final Stock"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Res"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Available"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Actions"})]})}),a.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:r.map(e=>(0,a.jsxs)("tr",{className:"hover:bg-blue-100",children:[a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm font-medium text-gray-900",children:f?.id===(e.product_id||e.id)?a.jsx("input",{type:"text",value:f.name,onChange:e=>y({...f,name:e.target.value}),className:"w-full max-w-44 px-2 py-1 border border-gray-300 rounded text-sm"}):e.product_name||e.name}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-500",children:f?.id===(e.product_id||e.id)?a.jsx("input",{type:"text",value:f.sku||"",onChange:e=>y({...f,sku:e.target.value}),className:"w-full max-w-28 px-2 py-1 border border-gray-300 rounded text-sm"}):e.sku||"-"}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-500",children:f?.id===(e.product_id||e.id)?(0,a.jsxs)("select",{value:f.unit,onChange:e=>y({...f,unit:e.target.value}),className:"w-full max-w-20 px-2 py-1 border border-gray-300 rounded text-sm",children:[a.jsx("option",{value:"pans",children:"Pans"}),a.jsx("option",{value:"pcs",children:"Pieces"}),a.jsx("option",{value:"gallons",children:"Gallons"}),a.jsx("option",{value:"liters",children:"Liters"}),a.jsx("option",{value:"kg",children:"Kilograms"}),a.jsx("option",{value:"boxes",children:"Boxes"}),a.jsx("option",{value:"bags",children:"Bags"}),a.jsx("option",{value:"g",children:"Grams"}),a.jsx("option",{value:"bottles",children:"Bottles"}),a.jsx("option",{value:"packs",children:"Packs"})]}):e.unit}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm font-medium text-green-600",children:f?.id===(e.product_id||e.id)?a.jsx("input",{type:"number",min:"0",step:"0.01",value:f.price||0,onChange:e=>y({...f,price:parseFloat(e.target.value)||0}),className:"w-full max-w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):`₱${(e.price||0).toFixed(2)}`}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-900",children:f?.id===(e.product_id||e.id)?a.jsx("input",{type:"number",min:"0",value:f.initial_stock||0,onChange:e=>y({...f,initial_stock:parseInt(e.target.value)||0}),className:"w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):e.initial_stock||0}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-900",children:f?.id===(e.product_id||e.id)?a.jsx("input",{type:"number",min:"0",value:f.production||0,onChange:e=>y({...f,production:parseInt(e.target.value)||0}),className:"w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):e.production||0}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-900",children:f?.id===(e.product_id||e.id)?a.jsx("input",{type:"number",min:"0",value:f.released||0,onChange:e=>y({...f,released:parseInt(e.target.value)||0}),className:"w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):e.released||0}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm font-semibold text-purple-600",children:f?.id===(e.product_id||e.id)?(f.initial_stock||0)+(f.production||0)-(f.released||0):e.final_stock||0}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-900",children:f?.id===(e.product_id||e.id)?a.jsx("input",{type:"number",min:"0",value:f.reserved||0,onChange:e=>y({...f,reserved:parseInt(e.target.value)||0}),className:"w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):e.reserved||0}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm font-semibold text-emerald-600",children:f?.id===(e.product_id||e.id)?(f.initial_stock||0)+(f.production||0)-(f.released||0)-(f.reserved||0):e.available_stock||0}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-500",children:a.jsx("div",{className:"flex space-x-2",children:f?.id===(e.product_id||e.id)?(0,a.jsxs)(a.Fragment,{children:[a.jsx("button",{onClick:()=>handleUpdateProduct(f),className:`p-1 rounded ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-100":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-100":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100":"text-blue-600 hover:text-blue-900 hover:bg-blue-100"}`,title:"Save",children:a.jsx(c.Z,{className:"h-4 w-4"})}),a.jsx("button",{onClick:()=>y(null),className:"p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200",title:"Cancel",children:a.jsx(d.Z,{className:"h-4 w-4"})})]}):(0,a.jsxs)(a.Fragment,{children:[a.jsx("button",{onClick:()=>y({...e,id:e.product_id||e.id,name:e.product_name||e.name}),className:`p-1 rounded ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-100":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-100":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100":"text-blue-600 hover:text-blue-900 hover:bg-blue-100"}`,title:"Edit",children:a.jsx(x.Z,{className:"h-4 w-4"})}),a.jsx("button",{onClick:()=>handleDeleteProduct(e.product_id||e.id),className:"p-1 rounded text-red-600 hover:text-red-900 hover:bg-red-100",title:"Delete",children:a.jsx(m.Z,{className:"h-4 w-4"})})]})})})]},e.product_id||e.id))})]})})]},e))})]}):a.jsx("div",{className:"text-center py-8 text-gray-500",children:a.jsx("p",{children:"Please select a brand to manage products"})})}var p=r(5441),h=r(3303),g=r(1057),b=r(5894),f=r(8626),y=r(4155);function OrderManager({selectedBrand:e,onOrderUpdate:t,theme:r="blue"}){let[l,n]=(0,s.useState)([]),[d,c]=(0,s.useState)(!1),[x,v]=(0,s.useState)(null),[j,w]=(0,s.useState)(null),[N,k]=(0,s.useState)("all");(0,s.useEffect)(()=>{fetchOrders()},[N,e]),(0,s.useEffect)(()=>{if(!e)return;let t=o.O.channel("customer-orders-changes").on("postgres_changes",{event:"*",schema:"public",table:"customer_orders",filter:`brand_id=eq.${e.id}`},e=>{console.log("Customer orders realtime update:",e),x?console.log("Skipping realtime refetch - currently updating order"):fetchOrders()}).subscribe();return()=>{o.O.removeChannel(t)}},[e,x]);let fetchOrders=async()=>{c(!0);try{let t=o.O.from("customer_orders").select(`
          *,
          location:locations(*),
          brand:brands(*),
          order_details(
            *,
            product:products(id, name, sku, unit)
          )
        `).order("created_at",{ascending:!1});"all"!==N&&(t=t.eq("status",N)),e&&(t=t.eq("brand_id",e.id));let{data:r,error:a}=await t;if(a){console.error("Error fetching orders:",a);return}r&&n(r)}catch(e){console.error("Error fetching orders:",e)}finally{c(!1)}},updateOrderStatus=async(e,r)=>{if(x===e){console.log("Order update already in progress for:",e);return}v(e);try{if("released"===r){let{data:t,error:r}=await o.O.from("order_details").select("product_id, quantity").eq("order_id",e);if(r){console.error("Error fetching order details:",r),alert("Failed to fetch order details");return}for(let e of t||[]){let{data:t,error:r}=await o.O.from("products").select("reserved, released").eq("id",e.product_id).single();if(r){console.error("Error fetching product data:",r),alert("Failed to fetch product data");return}let a=Math.max(0,(t?.reserved||0)-e.quantity),s=(t?.released||0)+e.quantity,{error:l}=await o.O.from("products").update({reserved:a,released:s,updated_at:new Date().toISOString()}).eq("id",e.product_id);if(l){console.error("Error updating product quantities:",l),alert("Failed to update product quantities");return}}}if("cancelled"===r){let{data:t,error:r}=await o.O.from("order_details").select("product_id, quantity").eq("order_id",e);if(r){console.error("Error fetching order details:",r),alert("Failed to fetch order details");return}for(let e of t||[]){let{data:t,error:r}=await o.O.from("products").select("reserved").eq("id",e.product_id).single();if(r){console.error("Error fetching product data:",r),alert("Failed to fetch product data");return}let a=Math.max(0,(t?.reserved||0)-e.quantity),{error:s}=await o.O.from("products").update({reserved:a,updated_at:new Date().toISOString()}).eq("id",e.product_id);if(s){console.error("Error updating product quantities:",s),alert("Failed to update product quantities");return}}}let{error:a}=await o.O.from("customer_orders").update({status:r,updated_at:new Date().toISOString()}).eq("id",e);if(a){console.error("Error updating order status:",a),alert("Failed to update order status");return}fetchOrders(),t&&t()}catch(e){console.error("Error updating order status:",e),alert("Failed to update order status")}finally{v(null)}},handleDeleteOrder=async e=>{if(confirm("Are you sure you want to delete this order? This action cannot be undone."))try{v(e);let{error:r}=await o.O.from("order_details").delete().eq("order_id",e);if(r){console.error("Error deleting order details:",r),alert("Failed to delete order details");return}let{error:a}=await o.O.from("customer_orders").delete().eq("id",e);if(a){console.error("Error deleting order:",a),alert("Failed to delete order");return}fetchOrders(),t&&t()}catch(e){console.error("Error deleting order:",e),alert("Failed to delete order")}finally{v(null)}},getStatusIcon=e=>{switch(e){case"pending":return a.jsx(p.Z,{className:"h-4 w-4 text-yellow-500"});case"approved":return a.jsx(i.Z,{className:"h-4 w-4 text-blue-500"});case"released":return a.jsx(h.Z,{className:"h-4 w-4 text-green-500"});case"cancelled":return a.jsx(g.Z,{className:"h-4 w-4 text-red-500"});default:return a.jsx(p.Z,{className:"h-4 w-4 text-gray-500"})}},getStatusColor=e=>{switch(e){case"pending":return"bg-yellow-100 text-yellow-800";case"approved":return"bg-blue-100 text-blue-800";case"released":return"bg-green-100 text-green-800";case"cancelled":return"bg-red-100 text-red-800";default:return"bg-gray-100 text-gray-800"}},getTotalItems=e=>e.order_details.reduce((e,t)=>e+t.quantity,0),getTotalAmount=e=>e.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0);return(0,a.jsxs)("div",{className:"space-y-6",children:[a.jsx("div",{className:"flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0",children:a.jsx("div",{children:a.jsx("h3",{className:"text-xl font-semibold text-gray-900",children:"Customer Orders"})})}),a.jsx("div",{className:"flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4",children:(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Status Filter"}),(0,a.jsxs)("select",{value:N,onChange:e=>k(e.target.value),className:"px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",children:[a.jsx("option",{value:"all",children:"All Statuses"}),a.jsx("option",{value:"pending",children:"Pending"}),a.jsx("option",{value:"approved",children:"Approved"}),a.jsx("option",{value:"released",children:"Released"}),a.jsx("option",{value:"cancelled",children:"Cancelled"})]})]})}),d?(0,a.jsxs)("div",{className:"flex items-center justify-center py-12",children:[a.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"}),a.jsx("span",{className:"ml-3 text-gray-600",children:"Loading orders..."})]}):0===l.length?(0,a.jsxs)("div",{className:"text-center py-12",children:[a.jsx(b.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),a.jsx("p",{className:"text-gray-600",children:"No orders found"})]}):a.jsx("div",{className:"bg-white rounded-lg border shadow-sm overflow-hidden",children:a.jsx("div",{className:"overflow-x-auto",children:(0,a.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[a.jsx("thead",{className:"bg-gray-50",children:(0,a.jsxs)("tr",{children:[a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Order Details"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Location"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Status"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Date"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Items"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Total Amount"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Actions"})]})}),a.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:l.map(e=>(0,a.jsxs)("tr",{className:"hover:bg-blue-100",children:[a.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:(0,a.jsxs)("div",{children:[(0,a.jsxs)("div",{className:"text-sm font-medium text-gray-900",children:["#",e.id.slice(-8)]}),a.jsx("div",{className:"text-sm text-gray-500",children:e.brand?.name})]})}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:e.location?.name}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:(0,a.jsxs)("span",{className:`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(e.status)}`,children:[getStatusIcon(e.status),a.jsx("span",{className:"ml-1 capitalize",children:e.status})]})}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:(0,u.iI)(e.created_at,{dateStyle:"short"})}),(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:[getTotalItems(e)," items"]}),(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600",children:["₱",getTotalAmount(e).toFixed(2)]}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:(0,a.jsxs)("div",{className:"flex space-x-2",children:[a.jsx("button",{onClick:()=>w(e),className:`p-1 rounded ${"green"===r?"text-green-600 hover:text-green-900 hover:bg-green-100":"red"===r?"text-red-600 hover:text-red-900 hover:bg-red-100":"yellow"===r?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100":"text-blue-600 hover:text-blue-900 hover:bg-blue-100"}`,title:"View Details",children:a.jsx(f.Z,{className:"h-4 w-4"})}),"pending"===e.status&&a.jsx("button",{onClick:()=>updateOrderStatus(e.id,"approved"),disabled:x===e.id,className:`p-1 rounded ${x===e.id?"text-gray-400 cursor-not-allowed":"text-green-600 hover:text-green-900 hover:bg-green-100"}`,title:"Approve Order",children:x===e.id?a.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):a.jsx(i.Z,{className:"h-4 w-4"})}),"approved"===e.status&&a.jsx("button",{onClick:()=>updateOrderStatus(e.id,"released"),disabled:x===e.id,className:`p-1 rounded ${x===e.id?"text-gray-400 cursor-not-allowed":"green"===r?"text-green-600 hover:text-green-900 hover:bg-green-100":"red"===r?"text-red-600 hover:text-red-900 hover:bg-red-100":"yellow"===r?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100":"text-blue-600 hover:text-blue-900 hover:bg-blue-100"}`,title:"Release Order",children:x===e.id?a.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):a.jsx(h.Z,{className:"h-4 w-4"})}),("pending"===e.status||"approved"===e.status)&&a.jsx("button",{onClick:()=>updateOrderStatus(e.id,"cancelled"),disabled:x===e.id,className:`${x===e.id?"text-gray-400 cursor-not-allowed":"text-red-600 hover:text-red-900"}`,title:"Cancel Order",children:x===e.id?a.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):a.jsx(g.Z,{className:"h-4 w-4"})}),("cancelled"===e.status||"released"===e.status)&&a.jsx("button",{onClick:()=>handleDeleteOrder(e.id),disabled:x===e.id,className:`${x===e.id?"text-gray-400 cursor-not-allowed":"text-red-600 hover:text-red-900"}`,title:"Delete Order",children:x===e.id?a.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):a.jsx(m.Z,{className:"h-4 w-4"})})]})})]},e.id))})]})})}),j&&a.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,a.jsxs)("div",{className:"relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[(0,a.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Franchisee Details #",j.id.slice(-8)]}),(0,a.jsxs)("div",{className:"flex space-x-2",children:[(0,a.jsxs)("button",{onClick:()=>{if(!j)return;let e=window.open("","_blank");e&&(e.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - Order ${j.id.slice(0,8)}</title>
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
              <div class="company-name">${j.brand?.name||"Company"}</div>
              <div class="receipt-title">Order Receipt</div>
            </div>
            
            <div class="order-info">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Order ID</span>
                  <span class="info-value">${j.id.slice(0,8)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Date (PST)</span>
                  <span class="info-value">${(0,u.iI)(j.created_at,{dateStyle:"short"})}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Location</span>
                  <span class="info-value">${j.location?.name||"N/A"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Franchisee</span>
                  <span class="info-value">${j.location?.franchisee||"N/A"}</span>
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
              ${j.order_details.map(e=>`
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
                  <div class="item-unit-price">₱${e.unit_price.toFixed(2)}</div>
                  <div class="item-price">₱${(e.unit_price*e.quantity).toFixed(2)}</div>
                </div>
              `).join("")}
            </div>
            
            ${j.notes?`
              <div class="notes">
                <div class="notes-title">Notes</div>
                <div class="notes-text">${j.notes}</div>
              </div>
            `:""}
            
            <div class="total-section">
              <div class="total-row">
                <span class="total-label">Total Items</span>
                <span class="total-value">${getTotalItems(j)}</span>
              </div>
              <div class="total-row grand-total">
                <span class="total-label">Total Amount</span>
                <span class="total-value">₱${getTotalAmount(j).toFixed(2)}</span>
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-text">Thank you for your order!</div>
              <div class="footer-date">Generated on ${new Date().toLocaleString()}</div>
            </div>
          </div>
        </body>
        </html>
      `),e.document.close(),e.focus(),e.print(),e.close())},className:`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${"green"===r?"bg-green-100 text-green-700 hover:bg-green-200":"red"===r?"bg-red-100 text-red-700 hover:bg-red-200":"yellow"===r?"bg-yellow-100 text-yellow-700 hover:bg-yellow-200":"bg-blue-100 text-blue-700 hover:bg-blue-200"}`,children:[a.jsx(y.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Print Receipt"})]}),a.jsx("button",{onClick:()=>w(null),className:"text-gray-400 hover:text-gray-600",children:a.jsx(g.Z,{className:"h-6 w-6"})})]})]}),(0,a.jsxs)("div",{className:"space-y-4",children:[(0,a.jsxs)("div",{className:"grid grid-cols-2 gap-4",children:[(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Location"}),a.jsx("p",{className:"text-sm text-gray-900",children:j.location?.name})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Franchisee"}),a.jsx("p",{className:"text-sm text-gray-900",children:j.location?.franchisee||"N/A"})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Date & Time (PST)"}),a.jsx("p",{className:"text-sm text-gray-900",children:(0,u.iI)(j.created_at)})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Brand"}),a.jsx("p",{className:"text-sm text-gray-900",children:j.brand?.name})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Status"}),(0,a.jsxs)("span",{className:`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(j.status)}`,children:[getStatusIcon(j.status),a.jsx("span",{className:"ml-1 capitalize",children:j.status})]})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Total Amount"}),(0,a.jsxs)("p",{className:"text-lg font-semibold text-gray-900",children:["₱",getTotalAmount(j).toFixed(2)]})]})]}),j.notes&&(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Notes"}),a.jsx("p",{className:"text-sm text-gray-900 bg-gray-50 p-3 rounded-lg",children:j.notes})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Order Items"}),a.jsx("div",{className:"space-y-2",children:j.order_details.map(e=>(0,a.jsxs)("div",{className:"p-3 bg-gray-50 rounded-lg hover:bg-blue-200",children:[(0,a.jsxs)("div",{className:"flex justify-between items-start mb-2",children:[(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-sm font-medium text-gray-900",children:e.product.name}),e.product.sku&&(0,a.jsxs)("p",{className:"text-xs text-gray-500",children:["SKU: ",e.product.sku]})]}),a.jsx("div",{className:"text-right",children:(0,a.jsxs)("p",{className:"text-sm font-semibold text-gray-900",children:["₱",(e.unit_price*e.quantity).toFixed(2)]})})]}),(0,a.jsxs)("div",{className:"flex justify-between items-center text-sm text-gray-600",children:[(0,a.jsxs)("span",{children:[e.quantity," ",e.product.unit]}),(0,a.jsxs)("span",{children:["₱",e.unit_price.toFixed(2)," per ",e.product.unit]})]})]},e.id))}),(0,a.jsxs)("div",{className:"mt-3 pt-3 border-t space-y-2",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("span",{className:"font-medium",children:"Total Items:"}),a.jsx("span",{className:"font-semibold",children:getTotalItems(j)})]}),(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("span",{className:"font-medium",children:"Total Amount:"}),(0,a.jsxs)("span",{className:"text-lg font-bold text-gray-900",children:["₱",getTotalAmount(j).toFixed(2)]})]})]})]})]})]})})]})}var v=r(6388);function BranchManager({selectedBrand:e,theme:t="blue"}){let[r,l]=(0,s.useState)([]),[i,p]=(0,s.useState)([]),[h,g]=(0,s.useState)(!1),[b,j]=(0,s.useState)(!1),[w,N]=(0,s.useState)(null),[k,_]=(0,s.useState)(null),[S,C]=(0,s.useState)([]),[E,O]=(0,s.useState)(!1),[q,P]=(0,s.useState)({name:"",passkey:"",franchisee:"",contact_number:"",brand_id:e?.id||""});(0,s.useEffect)(()=>{e&&(fetchLocations(),fetchBrands(),P(t=>({...t,brand_id:e.id})))},[e]);let fetchLocations=async()=>{if(e){g(!0);try{let{data:t,error:r}=await o.O.from("locations").select(`
          *,
          brand:brands(*)
        `).eq("brand_id",e.id).order("name");if(r){console.error("Error fetching locations:",r);return}t&&l(t)}catch(e){console.error("Error fetching locations:",e)}finally{g(!1)}}},fetchBrands=async()=>{try{let{data:e,error:t}=await o.O.from("brands").select("*").order("name");if(t){console.error("Error fetching brands:",t);return}e&&p(e)}catch(e){console.error("Error fetching brands:",e)}},handleAddLocation=async t=>{if(t.preventDefault(),!q.name||!q.passkey||!q.franchisee||!q.contact_number){alert("Please fill in all required fields");return}try{let{data:t,error:a}=await o.O.from("locations").insert([q]).select();if(a){console.error("Error adding location:",a),alert("Error adding location");return}t&&(l([...r,t[0]]),P({name:"",passkey:"",franchisee:"",contact_number:"",brand_id:e?.id||""}),j(!1))}catch(e){console.error("Error adding location:",e),alert("Error adding location")}},handleUpdateLocation=async e=>{try{let{data:t,error:a}=await o.O.from("locations").update({name:e.name,passkey:e.passkey,franchisee:e.franchisee,contact_number:e.contact_number,brand_id:e.brand_id,updated_at:new Date().toISOString()}).eq("id",e.id).select();if(a){console.error("Error updating location:",a),alert("Error updating location");return}t&&(l(r.map(r=>r.id===e.id?{...t[0],brand:e.brand}:r)),N(null))}catch(e){console.error("Error updating location:",e),alert("Error updating location")}},handleDeleteLocation=async e=>{if(confirm("Are you sure you want to delete this location?"))try{let{error:t}=await o.O.from("locations").delete().eq("id",e);if(t){console.error("Error deleting location:",t),alert("Error deleting location");return}l(r.filter(t=>t.id!==e))}catch(e){console.error("Error deleting location:",e),alert("Error deleting location")}},fetchLocationOrders=async e=>{g(!0);try{let{data:t,error:r}=await o.O.from("customer_orders").select(`
          *,
          location:locations(*),
          brand:brands(*),
          order_details(
            *,
            product:products(id, name, sku, unit)
          )
        `).eq("location_id",e).order("created_at",{ascending:!1});if(r){console.error("Error fetching orders:",r);return}t&&C(t)}catch(e){console.error("Error fetching orders:",e)}finally{g(!1)}},handleViewOrderHistory=async e=>{_(e),O(!0),await fetchLocationOrders(e.id)},copyToClipboard=async e=>{try{await navigator.clipboard.writeText(e),console.log("Passkey copied to clipboard:",e)}catch(r){console.error("Failed to copy passkey:",r);let t=document.createElement("textarea");t.value=e,document.body.appendChild(t),t.select(),document.execCommand("copy"),document.body.removeChild(t)}},getStatusBadge=e=>a.jsx("span",{className:`px-2 py-1 rounded-full text-xs font-medium ${{pending:"bg-yellow-100 text-yellow-800",approved:"bg-blue-100 text-blue-800",released:"bg-green-100 text-green-800",cancelled:"bg-red-100 text-red-800"}[e]||"bg-gray-100 text-gray-800"}`,children:e.charAt(0).toUpperCase()+e.slice(1)}),getTotalItems=e=>e.order_details.reduce((e,t)=>e+t.quantity,0),getTotalAmount=e=>e.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0),handlePrintReceipt=e=>{let t=window.open("","_blank");t&&(t.document.write(`
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
              <div class="company-name">${e.brand?.name||"Company"}</div>
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
                  <span class="info-value">${(0,u.iI)(e.created_at,{dateStyle:"short"})}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Location</span>
                  <span class="info-value">${e.location?.name||"N/A"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Franchisee</span>
                  <span class="info-value">${e.location?.franchisee||"N/A"}</span>
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
                    <div class="item-name">${e.product.name}</div>
                    <div class="item-details">
                      ${e.product.sku?`SKU: ${e.product.sku}`:""}
                    </div>
                  </div>
                  <div class="item-quantity">${e.quantity} ${e.product.unit}</div>
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
      `),t.document.close(),t.focus(),t.print(),t.close())};return E&&k?(0,a.jsxs)("div",{className:"space-y-6",children:[(0,a.jsxs)("div",{className:"flex items-center justify-between",children:[(0,a.jsxs)("div",{children:[a.jsx("h3",{className:"text-xl font-semibold text-gray-900",children:"Order History"}),a.jsx("p",{className:"text-gray-600",children:k.name})]}),(0,a.jsxs)("button",{onClick:()=>{O(!1),_(null)},className:"flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors",children:[a.jsx(d.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Back to Branches"})]})]}),(0,a.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:[a.jsx("h4",{className:"text-lg font-medium mb-4",children:"Branch Summary"}),(0,a.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-4 gap-4",children:[(0,a.jsxs)("div",{className:"bg-blue-50 p-4 rounded-lg",children:[a.jsx("p",{className:"text-sm text-blue-600 font-medium",children:"Total Orders"}),a.jsx("p",{className:"text-2xl font-bold text-blue-900",children:S.length})]}),(0,a.jsxs)("div",{className:"bg-green-50 p-4 rounded-lg",children:[a.jsx("p",{className:"text-sm text-green-600 font-medium",children:"Total Revenue"}),(0,a.jsxs)("p",{className:"text-2xl font-bold text-green-900",children:["₱",S.reduce((e,t)=>e+(t.total_amount||0),0).toFixed(2)]})]}),(0,a.jsxs)("div",{className:"bg-purple-50 p-4 rounded-lg",children:[a.jsx("p",{className:"text-sm text-purple-600 font-medium",children:"Franchisee"}),a.jsx("p",{className:"text-lg font-semibold text-purple-900",children:k.franchisee||"N/A"})]}),(0,a.jsxs)("div",{className:"bg-orange-50 p-4 rounded-lg",children:[a.jsx("p",{className:"text-sm text-orange-600 font-medium",children:"Contact"}),a.jsx("p",{className:"text-lg font-semibold text-orange-900",children:k.contact_number||"N/A"})]})]})]}),h?a.jsx("div",{className:"flex items-center justify-center py-12",children:a.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"})}):a.jsx("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden",children:a.jsx("div",{className:"overflow-x-auto",children:(0,a.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[a.jsx("thead",{className:"bg-gray-50",children:(0,a.jsxs)("tr",{children:[a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Order ID"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Date"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Customer"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Status"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Amount"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Items"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Actions"})]})}),a.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:S.map(e=>(0,a.jsxs)("tr",{className:"hover:bg-blue-100",children:[(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900",children:[e.id.slice(0,8),"..."]}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:new Date(e.created_at).toLocaleDateString()}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:e.customer_name}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:getStatusBadge(e.status)}),(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600",children:["₱",e.total_amount.toFixed(2)]}),(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:[e.order_details?.length||0," items"]}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:a.jsx("div",{className:"flex space-x-2",children:a.jsx("button",{onClick:()=>handlePrintReceipt(e),className:"p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out",title:"Print Receipt",children:a.jsx(y.Z,{className:"h-4 w-4"})})})})]},e.id))})]})})})]}):(0,a.jsxs)("div",{className:"space-y-6",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("div",{children:a.jsx("h3",{className:"text-xl font-semibold text-gray-900",children:"Branch Manager"})}),(0,a.jsxs)("button",{onClick:()=>j(!0),className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${"green"===t?"bg-green-600 hover:bg-green-700":"red"===t?"bg-red-600 hover:bg-red-700":"yellow"===t?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[a.jsx(n.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Add Branch"})]})]}),b&&a.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,a.jsxs)("div",{className:"relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[a.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"Add New Branch"}),a.jsx("button",{onClick:()=>j(!1),className:"text-gray-400 hover:text-gray-600",children:a.jsx(d.Z,{className:"h-6 w-6"})})]}),(0,a.jsxs)("form",{onSubmit:handleAddLocation,className:"space-y-4",children:[(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Branch Name *"}),a.jsx("input",{type:"text",required:!0,value:q.name,onChange:e=>P({...q,name:e.target.value}),className:`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${"green"===t?"focus:ring-green-500":"red"===t?"focus:ring-red-500":"yellow"===t?"focus:ring-yellow-500":"focus:ring-blue-500"}`,placeholder:"Enter branch name"})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Passkey *"}),a.jsx("input",{type:"text",required:!0,value:q.passkey,onChange:e=>P({...q,passkey:e.target.value.replace(/\D/g,"").slice(0,6)}),className:`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${"green"===t?"focus:ring-green-500":"red"===t?"focus:ring-red-500":"yellow"===t?"focus:ring-yellow-500":"focus:ring-blue-500"}`,placeholder:"Enter 6-digit passkey",maxLength:6})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Franchisee Name *"}),a.jsx("input",{type:"text",required:!0,value:q.franchisee,onChange:e=>P({...q,franchisee:e.target.value}),className:`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${"green"===t?"focus:ring-green-500":"red"===t?"focus:ring-red-500":"yellow"===t?"focus:ring-yellow-500":"focus:ring-blue-500"}`,placeholder:"Enter franchisee name"})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Contact Number *"}),a.jsx("input",{type:"tel",required:!0,value:q.contact_number,onChange:e=>P({...q,contact_number:e.target.value}),className:`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${"green"===t?"focus:ring-green-500":"red"===t?"focus:ring-red-500":"yellow"===t?"focus:ring-yellow-500":"focus:ring-blue-500"}`,placeholder:"Enter contact number"})]}),(0,a.jsxs)("div",{className:"flex justify-end space-x-3 pt-4",children:[a.jsx("button",{type:"button",onClick:()=>j(!1),className:"px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors",children:"Cancel"}),(0,a.jsxs)("button",{type:"submit",className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${"green"===t?"bg-green-600 hover:bg-green-700":"red"===t?"bg-red-600 hover:bg-red-700":"yellow"===t?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[a.jsx(c.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Add Branch"})]})]})]})]})}),h?a.jsx("div",{className:"flex items-center justify-center py-12",children:a.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"})}):a.jsx("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden",children:a.jsx("div",{className:"overflow-x-auto",children:(0,a.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[a.jsx("thead",{className:"bg-gray-50",children:(0,a.jsxs)("tr",{children:[a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Branch Name"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Passkey"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Franchisee"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Contact"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Actions"})]})}),a.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:r.map(e=>(0,a.jsxs)("tr",{className:"hover:bg-blue-100",children:[a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900",children:w?.id===e.id?a.jsx("input",{type:"text",value:w.name,onChange:e=>N({...w,name:e.target.value}),className:"w-full px-2 py-1 border border-gray-300 rounded"}):e.name}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:w?.id===e.id?a.jsx("input",{type:"text",value:w.passkey,onChange:e=>N({...w,passkey:e.target.value.replace(/\D/g,"").slice(0,6)}),className:"w-full px-2 py-1 border border-gray-300 rounded",maxLength:6}):(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx("span",{className:"font-mono",children:e.passkey}),a.jsx("button",{onClick:()=>copyToClipboard(e.passkey),className:`p-1 rounded hover:bg-gray-100 transition-colors ${"green"===t?"text-green-600 hover:text-green-700":"red"===t?"text-red-600 hover:text-red-700":"yellow"===t?"text-yellow-600 hover:text-yellow-700":"text-blue-600 hover:text-blue-700"}`,title:"Copy passkey",children:a.jsx(v.Z,{className:"h-4 w-4"})})]})}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:w?.id===e.id?a.jsx("input",{type:"text",value:w.franchisee||"",onChange:e=>N({...w,franchisee:e.target.value}),className:"w-full px-2 py-1 border border-gray-300 rounded"}):e.franchisee||"N/A"}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:w?.id===e.id?a.jsx("input",{type:"tel",value:w.contact_number||"",onChange:e=>N({...w,contact_number:e.target.value}),className:"w-full px-2 py-1 border border-gray-300 rounded"}):e.contact_number||"N/A"}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:a.jsx("div",{className:"flex space-x-2",children:w?.id===e.id?(0,a.jsxs)(a.Fragment,{children:[a.jsx("button",{onClick:()=>handleUpdateLocation(w),className:`p-1 rounded transition-all duration-200 ease-in-out ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-50":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-50":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50":"text-blue-600 hover:text-blue-900 hover:bg-blue-50"}`,title:"Save",children:a.jsx(c.Z,{className:"h-4 w-4"})}),a.jsx("button",{onClick:()=>N(null),className:"p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 ease-in-out",title:"Cancel",children:a.jsx(d.Z,{className:"h-4 w-4"})})]}):(0,a.jsxs)(a.Fragment,{children:[a.jsx("button",{onClick:()=>N(e),className:`p-1 rounded transition-all duration-200 ease-in-out ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-50":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-50":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50":"text-blue-600 hover:text-blue-900 hover:bg-blue-50"}`,title:"Edit",children:a.jsx(x.Z,{className:"h-4 w-4"})}),a.jsx("button",{onClick:()=>handleViewOrderHistory(e),className:"p-1 rounded text-green-600 hover:text-green-900 hover:bg-green-50 transition-all duration-200 ease-in-out",title:"View Order History",children:a.jsx(f.Z,{className:"h-4 w-4"})}),a.jsx("button",{onClick:()=>handleDeleteLocation(e.id),className:"p-1 rounded text-red-600 hover:text-red-900 hover:bg-red-50 transition-all duration-200 ease-in-out",title:"Delete",children:a.jsx(m.Z,{className:"h-4 w-4"})})]})})})]},e.id))})]})})})]})}var j=r(7),w=r(7004),N=r(517),k=r(9458),_=r(1922);function StockReport({selectedBrand:e,theme:t}){let[r,n]=(0,s.useState)([]),[c,x]=(0,s.useState)(!1),[m,p]=(0,s.useState)(new Set),[g,b]=(0,s.useState)({}),[y,v]=(0,s.useState)([]),[S,C]=(0,s.useState)(null),[E,O]=(0,s.useState)(!1),fetchSummaries=async()=>{if(e){x(!0);try{let{data:t,error:r}=await o.O.from("daily_stock_summaries").select(`
          *,
          brand:brands(*)
        `).eq("brand_id",e.id).order("date",{ascending:!1});if(r){console.error("Error fetching summaries:",r),alert("Error fetching stock summaries");return}n(t||[])}catch(e){console.error("Error fetching summaries:",e),alert("Error fetching stock summaries")}finally{x(!1)}}},fetchAllReleasedOrders=async()=>{if(e)try{let{data:t,error:r}=await o.O.from("customer_orders").select(`
          *,
          location:locations(*),
          order_details(
            *,
            product:products(*)
          )
        `).eq("brand_id",e.id).eq("status","released").order("updated_at",{ascending:!1});if(r){console.error("Error fetching all released orders:",r);return}v(t||[])}catch(e){console.error("Error fetching all released orders:",e)}},fetchOrdersForDate=async t=>{if(e){O(!0);try{console.log("Fetching orders for date:",t,"brand:",e.id);let{data:r,error:a}=await o.O.from("customer_orders").select(`
          *,
          location:locations(*),
          order_details(
            *,
            product:products(*)
          )
        `).eq("brand_id",e.id).eq("status","released").order("updated_at",{ascending:!1});if(a){console.error("Error fetching orders for date:",a);return}let s=(r||[]).filter(e=>{try{let r=e.updated_at?(0,u.jA)(e.updated_at):"",a=e.created_at?(0,u.jA)(e.created_at):"";console.log(`Order ${e.id.slice(-8)}: created=${a}, updated=${r}, target=${t}`);let s=r===t||a===t;return console.log(`  → Match: ${s}`),s}catch(t){return console.error(`Error parsing dates for order ${e.id}:`,t),console.error("Order data:",e),!1}});console.log("All released orders:",r?.length||0),console.log("Raw orders data:",r),console.log("Filtered orders for date:",s.length),console.log("Filtered orders:",s),b(e=>({...e,[t]:s}))}catch(e){console.error("Error fetching orders for date:",e)}finally{O(!1)}}},toggleSummaryExpansion=async(e,t)=>{let r=new Set(m);r.has(e)?r.delete(e):(r.add(e),await fetchOrdersForDate(t)),p(r)};(0,s.useEffect)(()=>{e&&(fetchSummaries(),fetchAllReleasedOrders())},[e]);let formatDate=e=>{let t=new Date(e);return t.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})},getStatusIcon=e=>e.total_production>0&&e.total_released>0?a.jsx(j.Z,{className:"h-4 w-4 text-blue-500"}):e.total_production>0?a.jsx(w.Z,{className:"h-4 w-4 text-green-500"}):e.total_released>0?a.jsx(h.Z,{className:"h-4 w-4 text-orange-500"}):a.jsx(i.Z,{className:"h-4 w-4 text-gray-500"}),getStatusColor=e=>e.total_production>0&&e.total_released>0?"bg-blue-100 text-blue-800":e.total_production>0?"bg-green-100 text-green-800":e.total_released>0?"bg-orange-100 text-orange-800":"bg-gray-100 text-gray-800",getStatusText=e=>e.total_production>0&&e.total_released>0?"Active Day":e.total_production>0?"Production Only":e.total_released>0?"Release Only":"No Activity",getTotalItems=e=>e.order_details?.reduce((e,t)=>e+t.quantity,0)||0,getTotalAmount=e=>e.order_details?.reduce((e,t)=>e+t.unit_price*t.quantity,0)||0;return e?(0,a.jsxs)("div",{className:"space-y-6",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[(0,a.jsxs)("div",{children:[(0,a.jsxs)("h3",{className:"text-xl font-semibold text-gray-900",children:["Stock Reports for ",e.name]}),a.jsx("p",{className:"text-sm text-gray-600 mt-1",children:"Daily summaries of finalized stock operations"})]}),(0,a.jsxs)("button",{onClick:()=>{fetchSummaries(),fetchAllReleasedOrders()},className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${"green"===t?"bg-green-600 hover:bg-green-700":"red"===t?"bg-red-600 hover:bg-red-700":"yellow"===t?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[a.jsx(N.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Refresh"})]})]}),(0,a.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-6",children:[a.jsx("div",{className:"bg-white rounded-lg border shadow-sm p-6",children:(0,a.jsxs)("div",{className:"flex items-center",children:[a.jsx("div",{className:"p-2 bg-blue-100 rounded-lg",children:a.jsx(w.Z,{className:"h-6 w-6 text-blue-600"})}),(0,a.jsxs)("div",{className:"ml-4",children:[a.jsx("p",{className:"text-sm font-medium text-gray-600",children:"Total Production"}),a.jsx("p",{className:"text-2xl font-semibold text-gray-900",children:r.reduce((e,t)=>e+t.total_production,0)})]})]})}),a.jsx("div",{className:"bg-white rounded-lg border shadow-sm p-6",children:(0,a.jsxs)("div",{className:"flex items-center",children:[a.jsx("div",{className:"p-2 bg-orange-100 rounded-lg",children:a.jsx(h.Z,{className:"h-6 w-6 text-orange-600"})}),(0,a.jsxs)("div",{className:"ml-4",children:[a.jsx("p",{className:"text-sm font-medium text-gray-600",children:"Orders Released"}),a.jsx("p",{className:"text-2xl font-semibold text-gray-900",children:y.length})]})]})}),a.jsx("div",{className:"bg-white rounded-lg border shadow-sm p-6",children:(0,a.jsxs)("div",{className:"flex items-center",children:[a.jsx("div",{className:"p-2 bg-green-100 rounded-lg",children:a.jsx(i.Z,{className:"h-6 w-6 text-green-600"})}),(0,a.jsxs)("div",{className:"ml-4",children:[a.jsx("p",{className:"text-sm font-medium text-gray-600",children:"Total Amount Released"}),(0,a.jsxs)("p",{className:"text-2xl font-semibold text-gray-900",children:["₱",y.reduce((e,t)=>e+getTotalAmount(t),0).toFixed(2)]})]})]})})]}),c?(0,a.jsxs)("div",{className:"flex items-center justify-center py-12",children:[a.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"}),a.jsx("span",{className:"ml-3 text-gray-600",children:"Loading reports..."})]}):0===r.length?(0,a.jsxs)("div",{className:"text-center py-12",children:[a.jsx(N.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),a.jsx("p",{className:"text-gray-600",children:"No stock reports found"}),a.jsx("p",{className:"text-sm text-gray-500 mt-2",children:'Stock reports will appear here after using the "Finalize Stock" button'})]}):a.jsx("div",{className:"bg-white rounded-lg border shadow-sm overflow-hidden",children:a.jsx("div",{className:"overflow-x-auto",children:(0,a.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[a.jsx("thead",{className:"bg-gray-50",children:(0,a.jsxs)("tr",{children:[a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Date"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Status"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Production"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Released"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Final Stock"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Finalized At"})]})}),a.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:r.map(e=>{let r=m.has(e.id),s=g[e.date]||[];return(0,a.jsxs)(l().Fragment,{children:[(0,a.jsxs)("tr",{className:"hover:bg-blue-100",children:[a.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:a.jsx("button",{onClick:()=>toggleSummaryExpansion(e.id,e.date),className:"text-gray-400 hover:text-gray-600",children:r?a.jsx(k.Z,{className:"h-4 w-4"}):a.jsx(_.Z,{className:"h-4 w-4"})})}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900",children:formatDate(e.date)}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:(0,a.jsxs)("span",{className:`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(e)}`,children:[getStatusIcon(e),a.jsx("span",{className:"ml-1",children:getStatusText(e)})]})}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:e.total_production}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:e.total_released}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600",children:e.total_final_stock}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:new Date(e.created_at).toLocaleString()})]}),r&&a.jsx(a.Fragment,{children:a.jsx("tr",{className:"bg-gray-50",children:(0,a.jsxs)("td",{colSpan:7,className:"px-6 py-3",children:[(0,a.jsxs)("div",{className:"text-sm font-medium text-gray-700 mb-2",children:["Released Orders (",s.length,")"]}),E?(0,a.jsxs)("div",{className:"flex items-center justify-center py-4",children:[a.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}),a.jsx("span",{className:"ml-2 text-sm text-gray-600",children:"Loading orders..."})]}):0===s.length?a.jsx("div",{className:"text-sm text-gray-500 py-4",children:"No orders were released on this date"}):a.jsx("div",{className:"space-y-2",children:s.map(e=>(0,a.jsxs)("div",{className:"flex items-center justify-between bg-white rounded border p-3 hover:bg-blue-100",children:[a.jsx("div",{className:"flex-1",children:(0,a.jsxs)("div",{className:"flex items-center space-x-4",children:[(0,a.jsxs)("div",{children:[(0,a.jsxs)("div",{className:"text-sm font-medium text-gray-900",children:["#",e.id.slice(-8)]}),a.jsx("div",{className:"text-xs text-gray-500",children:e.location?.name})]}),a.jsx("div",{className:"text-sm text-gray-600",children:e.customer_name}),(0,a.jsxs)("div",{className:"text-sm text-gray-600",children:[getTotalItems(e)," items"]}),(0,a.jsxs)("div",{className:"text-sm font-medium text-green-600",children:["₱",getTotalAmount(e).toFixed(2)]}),a.jsx("div",{className:"text-xs text-gray-500",children:(0,u.iI)(e.updated_at)})]})}),a.jsx("button",{onClick:()=>C(e),className:`ml-4 px-3 py-1 text-xs rounded transition-all duration-200 ease-in-out ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-50":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-50":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50":"text-blue-600 hover:text-blue-900 hover:bg-blue-50"}`,children:a.jsx(f.Z,{className:"h-5 w-5"})})]},e.id))})]})})})]},e.id)})})]})})}),S&&a.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,a.jsxs)("div",{className:"relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[(0,a.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Order Details - #",S.id.slice(-8)]}),a.jsx("button",{onClick:()=>C(null),className:"text-gray-400 hover:text-gray-600",children:a.jsx(d.Z,{className:"h-6 w-6"})})]}),(0,a.jsxs)("div",{className:"grid grid-cols-2 gap-4 mb-6",children:[(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Customer"}),a.jsx("p",{className:"text-sm text-gray-900",children:S.customer_name})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Location"}),a.jsx("p",{className:"text-sm text-gray-900",children:S.location?.name})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Date & Time (PST)"}),a.jsx("p",{className:"text-sm text-gray-900",children:(0,u.iI)(S.updated_at)})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700",children:"Total Amount"}),(0,a.jsxs)("p",{className:"text-sm font-medium text-green-600",children:["₱",getTotalAmount(S).toFixed(2)]})]})]}),(0,a.jsxs)("div",{className:"border-t pt-4",children:[a.jsx("h4",{className:"text-md font-medium text-gray-900 mb-3",children:"Order Items"}),a.jsx("div",{className:"space-y-2",children:S.order_details?.map(e=>a.jsxs("div",{className:"flex items-center justify-between bg-gray-50 rounded p-3",children:[a.jsxs("div",{className:"flex-1",children:[a.jsx("div",{className:"text-sm font-medium text-gray-900",children:e.product?.name}),a.jsxs("div",{className:"text-xs text-gray-500",children:["SKU: ",e.product?.sku]})]}),a.jsxs("div",{className:"flex items-center space-x-4",children:[a.jsxs("div",{className:"text-sm text-gray-600",children:[e.quantity," \xd7 ₱",e.unit_price.toFixed(2)]}),a.jsxs("div",{className:"text-sm font-medium text-green-600",children:["₱",(e.quantity*e.unit_price).toFixed(2)]})]})]},e.id))})]})]})})]}):(0,a.jsxs)("div",{className:"text-center py-8 text-gray-500",children:[a.jsx(N.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),a.jsx("p",{children:"Please select a brand to view stock reports"})]})}var S=r(3294),C=r(5642),E=r(7094);function DashboardPage(){let[e,t]=(0,s.useState)(!1),[r,l]=(0,s.useState)(""),[o,i]=(0,s.useState)(null),[n,d]=(0,s.useState)("products"),[c,x]=(0,s.useState)(""),[m,u]=(0,s.useState)(0),[p,h]=(0,s.useState)(!0);(0,s.useEffect)(()=>{let initializeDashboard=async()=>{h(!0);let e=localStorage.getItem("dashboard_authenticated"),r=localStorage.getItem("dashboard_selected_brand"),a=localStorage.getItem("dashboard_active_tab");if("true"===e&&t(!0),r)try{i(JSON.parse(r))}catch(e){console.error("Error parsing saved brand:",e)}a&&["products","orders","branches","reports"].includes(a)&&d(a),setTimeout(()=>{h(!1)},800)};initializeDashboard()},[]),(0,s.useEffect)(()=>{o?localStorage.setItem("dashboard_selected_brand",JSON.stringify(o)):localStorage.removeItem("dashboard_selected_brand")},[o]),(0,s.useEffect)(()=>{localStorage.setItem("dashboard_active_tab",n)},[n]);let g=(e=>{if(!e)return"blue";switch(e.slug){case"mychoice":return"green";case"gelatofilipino":return"red";case"mang-sorbetes":return"yellow";default:return"blue"}})(o);return p?a.jsx("div",{className:"min-h-screen bg-gray-50 flex items-center justify-center",children:(0,a.jsxs)("div",{className:"text-center",children:[a.jsx("div",{className:`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 ${"green"===g?"bg-green-100":"red"===g?"bg-red-100":"yellow"===g?"bg-yellow-100":"bg-blue-100"}`,children:a.jsx("div",{className:`animate-spin rounded-full h-8 w-8 border-b-2 ${"green"===g?"border-green-600":"red"===g?"border-red-600":"yellow"===g?"border-yellow-600":"border-blue-600"}`})}),a.jsx("h2",{className:"text-xl font-semibold text-gray-900 mb-2",children:"Loading Dashboard"}),a.jsx("p",{className:"text-gray-600",children:"Please wait while we check your session..."})]})}):e?(0,a.jsxs)("div",{className:"min-h-screen bg-gray-50",children:[a.jsx("div",{className:"bg-white shadow-sm border-b",children:a.jsx("div",{className:"max-w-7xl mx-auto px-4 py-4",children:(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[(0,a.jsxs)("div",{className:"flex items-center space-x-4",children:[(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx(w.Z,{className:`h-8 w-8 ${"green"===g?"text-green-600":"red"===g?"text-red-600":"yellow"===g?"text-yellow-600":"text-blue-600"}`}),a.jsx("h1",{className:"text-2xl font-bold text-gray-900",children:"Inventory Dashboard"}),o&&a.jsx("span",{className:`px-3 py-1 rounded-full text-sm font-medium ${"green"===g?"bg-green-100 text-green-800":"red"===g?"bg-red-100 text-red-800":"yellow"===g?"bg-yellow-100 text-yellow-800":"bg-blue-100 text-blue-800"}`,children:o.name})]}),(0,a.jsxs)("div",{className:"flex items-center space-x-1 text-sm text-gray-500",children:[a.jsx("div",{className:"w-2 h-2 bg-green-500 rounded-full"}),a.jsx("span",{children:"Admin Access"})]})]}),a.jsx("div",{className:"flex items-center space-x-4",children:(0,a.jsxs)("button",{onClick:()=>{t(!1),l(""),i(null),d("products"),h(!1),localStorage.removeItem("dashboard_authenticated"),localStorage.removeItem("dashboard_selected_brand"),localStorage.removeItem("dashboard_active_tab")},className:"flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors",children:[a.jsx(S.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Logout"})]})})]})})}),(0,a.jsxs)("div",{className:"max-w-7xl mx-auto px-4 py-8",children:[a.jsx("div",{className:"mb-6",children:a.jsx("div",{className:"bg-white rounded-lg shadow-sm border p-4",children:(0,a.jsxs)("div",{className:"flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4",children:[a.jsx("div",{className:"flex-1 max-w-xs",children:a.jsx(BrandSelector,{onBrandChange:i})}),a.jsx("div",{className:"flex-1",children:a.jsx("div",{className:"border-b border-gray-200",children:(0,a.jsxs)("nav",{className:"-mb-px flex space-x-8",children:[a.jsx("button",{onClick:()=>d("products"),className:`py-2 px-1 border-b-2 font-medium text-sm ${"products"===n?"green"===g?"border-green-500 text-green-600":"red"===g?"border-red-500 text-red-600":"yellow"===g?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx(w.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Products & Inventory"})]})}),a.jsx("button",{onClick:()=>d("orders"),className:`py-2 px-1 border-b-2 font-medium text-sm ${"orders"===n?"green"===g?"border-green-500 text-green-600":"red"===g?"border-red-500 text-red-600":"yellow"===g?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx(b.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Customer Orders"})]})}),a.jsx("button",{onClick:()=>d("branches"),className:`py-2 px-1 border-b-2 font-medium text-sm ${"branches"===n?"green"===g?"border-green-500 text-green-600":"red"===g?"border-red-500 text-red-600":"yellow"===g?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx(E.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Branch Manager"})]})}),a.jsx("button",{onClick:()=>d("reports"),className:`py-2 px-1 border-b-2 font-medium text-sm ${"reports"===n?"green"===g?"border-green-500 text-green-600":"red"===g?"border-red-500 text-red-600":"yellow"===g?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx(N.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Stock Reports"})]})})]})})})]})})}),(0,a.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border",children:["products"===n&&o&&a.jsx("div",{className:"p-6",children:a.jsx(ProductManager,{selectedBrand:o,theme:g},m)}),"orders"===n&&a.jsx("div",{className:"p-6",children:a.jsx(OrderManager,{selectedBrand:o,onOrderUpdate:()=>{u(e=>e+1)},theme:g},m)}),"branches"===n&&o&&a.jsx("div",{className:"p-6",children:a.jsx(BranchManager,{selectedBrand:o,theme:g})}),!o&&"branches"===n&&(0,a.jsxs)("div",{className:"p-6 text-center py-12",children:[a.jsx(E.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),a.jsx("p",{className:"text-gray-600",children:"Please select a brand to manage branches"})]}),"reports"===n&&a.jsx("div",{className:"p-6",children:a.jsx(StockReport,{selectedBrand:o,theme:g})}),!o&&"products"===n&&(0,a.jsxs)("div",{className:"p-6 text-center py-12",children:[a.jsx(w.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),a.jsx("p",{className:"text-gray-600",children:"Please select a brand to manage products"})]})]})]})]}):(0,a.jsxs)("div",{className:"min-h-screen bg-gray-50 flex flex-col items-center justify-center",children:[(0,a.jsxs)("div",{className:"max-w-md w-full bg-white rounded-lg shadow-md p-8",children:[(0,a.jsxs)("div",{className:"text-center mb-8",children:[a.jsx("div",{className:"mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4",children:a.jsx(S.Z,{className:"h-6 w-6 text-blue-600"})}),a.jsx("h2",{className:"text-2xl font-bold text-gray-900",children:"Admin Dashboard"}),a.jsx("p",{className:"text-gray-600 mt-2",children:"Enter passcode to access inventory management"})]}),(0,a.jsxs)("form",{onSubmit:e=>{e.preventDefault(),"john101797"===r?(t(!0),localStorage.setItem("dashboard_authenticated","true"),x("")):(x("Invalid passcode. Please try again."),l(""))},className:"space-y-6",children:[(0,a.jsxs)("div",{children:[a.jsx("label",{htmlFor:"passcode",className:"block text-sm font-medium text-gray-700 mb-2",children:"Admin Passcode"}),a.jsx("input",{type:"password",id:"passcode",value:r,onChange:e=>l(e.target.value),className:"w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg tracking-wider",placeholder:"Enter 6-digit passcode",maxLength:10,required:!0})]}),c&&a.jsx("div",{className:"bg-red-50 border border-red-200 rounded-lg p-3",children:a.jsx("p",{className:"text-red-800 text-sm",children:c})}),(0,a.jsxs)("button",{type:"submit",className:"w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors",children:[a.jsx(C.Z,{className:"h-5 w-5"}),a.jsx("span",{children:"Access Dashboard"})]})]})]}),a.jsx("div",{className:"mt-8",children:a.jsx("p",{className:"text-center text-xs text-gray-500",children:"\xa9 Gilnaks Food Corporation"})})]})}},1618:(e,t,r)=>{"use strict";r.r(t),r.d(t,{$$typeof:()=>o,__esModule:()=>l,default:()=>n});var a=r(5153);let s=(0,a.createProxy)(String.raw`C:\Users\John\Desktop\gfc\inventory-system\app\dashboard\page.tsx`),{__esModule:l,$$typeof:o}=s,i=s.default,n=i}};var t=require("../../webpack-runtime.js");t.C(e);var __webpack_exec__=e=>t(t.s=e),r=t.X(0,[862,866,997,459,956,982],()=>__webpack_exec__(9854));module.exports=r})();