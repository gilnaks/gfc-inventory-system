(()=>{var e={};e.id=702,e.ids=[702],e.modules={5403:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external")},4749:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external")},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},5528:e=>{"use strict";e.exports=require("next/dist\\client\\components\\action-async-storage.external.js")},1877:e=>{"use strict";e.exports=require("next/dist\\client\\components\\request-async-storage.external.js")},5319:e=>{"use strict";e.exports=require("next/dist\\client\\components\\static-generation-async-storage.external.js")},4300:e=>{"use strict";e.exports=require("buffer")},6113:e=>{"use strict";e.exports=require("crypto")},2361:e=>{"use strict";e.exports=require("events")},3685:e=>{"use strict";e.exports=require("http")},5687:e=>{"use strict";e.exports=require("https")},5477:e=>{"use strict";e.exports=require("punycode")},2781:e=>{"use strict";e.exports=require("stream")},7310:e=>{"use strict";e.exports=require("url")},3837:e=>{"use strict";e.exports=require("util")},9796:e=>{"use strict";e.exports=require("zlib")},9854:(e,t,r)=>{"use strict";r.r(t),r.d(t,{GlobalError:()=>l.a,__next_app__:()=>m,originalPathname:()=>x,pages:()=>c,routeModule:()=>u,tree:()=>o});var a=r(7096),s=r(6132),i=r(7284),l=r.n(i),n=r(2564),d={};for(let e in n)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(d[e]=()=>n[e]);r.d(t,d);let o=["",{children:["dashboard",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(r.bind(r,1618)),"C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\dashboard\\page.tsx"]}]},{}]},{layout:[()=>Promise.resolve().then(r.bind(r,5345)),"C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\layout.tsx"],"not-found":[()=>Promise.resolve().then(r.t.bind(r,9291,23)),"next/dist/client/components/not-found-error"]}],c=["C:\\Users\\John\\Desktop\\gfc\\inventory-system\\app\\dashboard\\page.tsx"],x="/dashboard/page",m={require:r,loadChunk:()=>Promise.resolve()},u=new a.AppPageRouteModule({definition:{kind:s.x.APP_PAGE,page:"/dashboard/page",pathname:"/dashboard",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:o}})},5537:(e,t,r)=>{Promise.resolve().then(r.bind(r,2359))},2359:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>DashboardPage});var a=r(784),s=r(9885),i=r(9708);function BrandSelector({onBrandChange:e}){let[t,r]=(0,s.useState)([]),[l,n]=(0,s.useState)(null),[d,o]=(0,s.useState)(!0);(0,s.useEffect)(()=>{fetchBrands()},[]);let fetchBrands=async()=>{try{console.log("Fetching brands from Supabase...");let{data:t,error:a}=await i.O.from("brands").select("*").order("name");if(console.log("Supabase response:",{data:t,error:a}),a){console.error("Error fetching brands:",a);return}t&&(console.log("Brands loaded:",t),r(t),t.length>0&&(n(t[0]),e(t[0])))}catch(e){console.error("Error fetching brands:",e)}finally{o(!1)}},handleBrandChange=r=>{let a=t.find(e=>e.id===r);a&&(n(a),e(a))};return d?(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"}),a.jsx("span",{className:"text-gray-600",children:"Loading brands..."})]}):(0,a.jsxs)("div",{className:"flex items-center space-x-3",children:[a.jsx("label",{htmlFor:"brand-select",className:"text-sm font-medium text-gray-700 whitespace-nowrap",children:"Brand:"}),a.jsx("select",{id:"brand-select",value:l?.id||"",onChange:e=>handleBrandChange(e.target.value),className:"px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm min-w-[140px]",children:t.map(e=>a.jsx("option",{value:e.id,children:e.name},e.id))})]})}var l=r(2032),n=r(2385),d=r(6206),o=r(2995),c=r(9494),x=r(6303),m=r(7820);function ProductManager({selectedBrand:e,theme:t="blue"}){let[r,u]=(0,s.useState)([]),[p,g]=(0,s.useState)(!1),[h,b]=(0,s.useState)(!1),[y,f]=(0,s.useState)(null),[v,j]=(0,s.useState)({name:"",sku:"",category:"",unit:"pcs",price:0,initial_stock:0,production:0,released:0,reserved:0}),[w,N]=(0,s.useState)([]),[k,_]=(0,s.useState)(!1);(0,s.useEffect)(()=>{e&&fetchProducts()},[e]),(0,s.useEffect)(()=>{if(!e)return;let t=i.O.channel("products-changes").on("postgres_changes",{event:"*",schema:"public",table:"products",filter:`brand_id=eq.${e.id}`},e=>{console.log("Products realtime update:",e),y?console.log("Skipping realtime refetch - currently editing product"):fetchProducts()}).subscribe();return()=>{i.O.removeChannel(t)}},[e,y]),(0,s.useEffect)(()=>{let e=Array.from(new Set(r.map(e=>e.category).filter(e=>e&&""!==e.trim()))).sort();N(e)},[r]),(0,s.useEffect)(()=>{let handleClickOutside=e=>{let t=e.target;k&&!t.closest(".category-dropdown")&&_(!1)};if(k)return document.addEventListener("mousedown",handleClickOutside),()=>document.removeEventListener("mousedown",handleClickOutside)},[k]);let getBrandPrefix=e=>{switch(e){case"gelatofilipino":return"GF-";case"mychoice":return"MC-";case"mang-sorbetes":return"MS-";default:return"PR-"}},generateNextSKU=async t=>{if(!e)return"";try{let{data:r,error:a}=await i.O.from("products").select("sku").eq("brand_id",t).not("sku","is",null);if(a)return console.error("Error fetching products for SKU generation:",a),getBrandPrefix(e.slug)+"001";let s=getBrandPrefix(e.slug),l=0;r&&r.length>0&&r.forEach(e=>{if(e.sku&&e.sku.startsWith(s)){let t=e.sku.substring(s.length),r=parseInt(t);!isNaN(r)&&r>l&&(l=r)}});let n=l+1;return s+n.toString().padStart(3,"0")}catch(t){return console.error("Error generating SKU:",t),getBrandPrefix(e.slug)+"001"}},fetchProducts=async()=>{if(e){g(!0);try{let{data:t,error:r}=await i.O.from("inventory_summary").select("*").eq("brand_id",e.id).order("product_name");if(r){console.error("Error fetching products:",r);return}t&&u(t)}catch(e){console.error("Error fetching products:",e)}finally{g(!1)}}},handleAddProduct=async t=>{if(t.preventDefault(),e)try{let{data:t,error:r}=await i.O.from("products").insert([{brand_id:e.id,name:v.name,sku:v.sku||null,category:v.category||null,unit:v.unit,price:v.price,initial_stock:v.initial_stock,production:v.production,released:v.released,reserved:v.reserved}]).select();if(r){console.error("Error adding product:",r),alert("Error adding product: "+r.message);return}t&&(await fetchProducts(),j({name:"",sku:"",category:"",unit:"pcs",price:0,initial_stock:0,production:0,released:0,reserved:0}),b(!1))}catch(e){console.error("Error adding product:",e),alert("Error adding product")}},handleUpdateProduct=async e=>{try{let{data:t,error:r}=await i.O.from("products").update({name:e.name,sku:e.sku,category:e.category,unit:e.unit,price:e.price,initial_stock:e.initial_stock,production:e.production,released:e.released,reserved:e.reserved}).eq("id",e.id).select();if(r){console.error("Error updating product:",r),alert("Error updating product: "+r.message);return}t&&(await fetchProducts(),f(null))}catch(e){console.error("Error updating product:",e),alert("Error updating product")}},handleDeleteProduct=async e=>{if(confirm("Are you sure you want to delete this product?"))try{let{error:t}=await i.O.from("products").delete().eq("id",e);if(t){console.error("Error deleting product:",t),alert("Error deleting product: "+t.message);return}console.log("Product deleted successfully"),u(r.filter(t=>(t.product_id||t.id)!==e)),setTimeout(async()=>{console.log("Refetching products to ensure consistency"),await fetchProducts()},500)}catch(e){console.error("Error deleting product:",e),alert("Error deleting product")}},handleFinalizeStock=async()=>{if(!e)return;let t=prompt("Please enter Wendy's birthdate to finalize stock:");if("030199"!==t){alert("Invalid birthdate. Stock finalization cancelled.");return}if(confirm("Are you sure you want to finalize the stock? This will move final stock to initial stock and clear production/released quantities for all products."))try{let{data:t,error:r}=await i.O.from("products").select("*").eq("brand_id",e.id);if(r){console.error("Error fetching products:",r),alert("Error fetching products for finalization");return}if(!t||0===t.length){alert("No products found to finalize");return}let{data:a,error:s}=await i.O.from("daily_stock_summaries").insert({brand_id:e.id,date:(0,m.sn)(),total_production:t.reduce((e,t)=>e+(t.production||0),0),total_released:t.reduce((e,t)=>e+(t.released||0),0),total_final_stock:t.reduce((e,t)=>e+(t.initial_stock||0)+(t.production||0)-(t.released||0),0)}).select().single();if(s){console.error("Error creating daily summary:",s),alert("Error creating daily summary");return}for(let e of t){let t=(e.initial_stock||0)+(e.production||0)-(e.released||0),{error:r}=await i.O.from("products").update({initial_stock:t,production:0,released:0,updated_at:new Date().toISOString()}).eq("id",e.id);if(r){console.error(`Error updating product ${e.name}:`,r),alert(`Error updating product ${e.name}`);return}}alert("Stock finalized successfully! All products have been updated for the next day."),await fetchProducts()}catch(e){console.error("Error finalizing stock:",e),alert("Error finalizing stock")}};return e?(0,a.jsxs)("div",{className:"space-y-6",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[(0,a.jsxs)("h3",{className:"text-xl font-semibold text-gray-900",children:["Products for ",e.name]}),(0,a.jsxs)("div",{className:"flex space-x-3",children:[(0,a.jsxs)("button",{onClick:handleFinalizeStock,className:"flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors bg-orange-600 hover:bg-orange-700",children:[a.jsx(l.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Finalize Stock"})]}),(0,a.jsxs)("button",{onClick:async()=>{let t=await generateNextSKU(e.id);j({...v,sku:t}),b(!0)},className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${"green"===t?"bg-green-600 hover:bg-green-700":"red"===t?"bg-red-600 hover:bg-red-700":"yellow"===t?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[a.jsx(n.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Add Product"})]})]})]}),h&&a.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,a.jsxs)("div",{className:"relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[a.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"Add New Product"}),a.jsx("button",{onClick:()=>{b(!1),j({name:"",sku:"",category:"",unit:"pcs",price:0,initial_stock:0,production:0,released:0,reserved:0})},className:"text-gray-400 hover:text-gray-600",children:a.jsx(d.Z,{className:"h-6 w-6"})})]}),(0,a.jsxs)("form",{onSubmit:handleAddProduct,className:"space-y-4",children:[(0,a.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Product Name *"}),a.jsx("input",{type:"text",required:!0,value:v.name,onChange:e=>j({...v,name:e.target.value}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"Enter product name"})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"SKU (Auto-generated)"}),a.jsx("input",{type:"text",value:v.sku,onChange:e=>j({...v,sku:e.target.value}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50",placeholder:"Auto-generated SKU"}),(0,a.jsxs)("p",{className:"text-xs text-gray-500 mt-1",children:["SKU format: ",getBrandPrefix(e.slug),"XXX (e.g., ",getBrandPrefix(e.slug),"001)"]})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Category"}),(0,a.jsxs)("div",{className:"relative category-dropdown",children:[a.jsx("input",{type:"text",value:v.category,onChange:e=>{j({...v,category:e.target.value}),_(!0)},onFocus:()=>_(!0),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"Enter or select category"}),k&&w.length>0&&a.jsx("div",{className:"absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto",children:w.map(e=>a.jsx("button",{type:"button",onClick:t=>{t.preventDefault(),t.stopPropagation(),j({...v,category:e}),_(!1)},onMouseDown:e=>{e.preventDefault(),e.stopPropagation()},className:"w-full text-left px-3 py-2 hover:bg-gray-100 text-sm",children:e},e))})]})]}),(0,a.jsxs)("div",{className:"grid grid-cols-3 gap-4",children:[(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Initial Stock"}),a.jsx("input",{type:"number",min:"0",value:v.initial_stock,onChange:e=>j({...v,initial_stock:parseInt(e.target.value)||0}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"0"})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Unit"}),(0,a.jsxs)("select",{value:v.unit,onChange:e=>j({...v,unit:e.target.value}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",children:[a.jsx("option",{value:"pans",children:"Pans"}),a.jsx("option",{value:"pcs",children:"Pieces"}),a.jsx("option",{value:"gallons",children:"Gallons"}),a.jsx("option",{value:"liters",children:"Liters"}),a.jsx("option",{value:"kg",children:"Kilograms"}),a.jsx("option",{value:"boxes",children:"Boxes"}),a.jsx("option",{value:"bags",children:"Bags"}),a.jsx("option",{value:"g",children:"Grams"}),a.jsx("option",{value:"bottles",children:"Bottles"}),a.jsx("option",{value:"packs",children:"Packs"})]})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Price (₱)"}),a.jsx("input",{type:"number",min:"0",step:"0.01",value:v.price,onChange:e=>j({...v,price:parseFloat(e.target.value)||0}),className:"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",placeholder:"0.00"})]})]})]}),(0,a.jsxs)("div",{className:"flex justify-end space-x-3 pt-4",children:[a.jsx("button",{type:"button",onClick:()=>{b(!1),j({name:"",sku:"",category:"",unit:"pcs",price:0,initial_stock:0,production:0,released:0,reserved:0})},className:"px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors",children:"Cancel"}),(0,a.jsxs)("button",{type:"submit",className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${"green"===t?"bg-green-600 hover:bg-green-700":"red"===t?"bg-red-600 hover:bg-red-700":"yellow"===t?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[a.jsx(o.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Save Product"})]})]})]})]})}),p?(0,a.jsxs)("div",{className:"flex items-center justify-center py-8",children:[a.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"}),a.jsx("span",{className:"ml-3 text-gray-600",children:"Loading products..."})]}):0===r.length?(0,a.jsxs)("div",{className:"text-center py-8 text-gray-500",children:[(0,a.jsxs)("p",{children:["No products found for ",e.name]}),a.jsx("p",{className:"text-sm",children:'Click "Add Product" to create your first product'})]}):a.jsx("div",{className:"space-y-6",children:(e=>{let t=e.reduce((e,t)=>{let r=t.category||"Uncategorized";return e[r]||(e[r]=[]),e[r].push(t),e},{}),r=Object.keys(t).sort((e,t)=>"Uncategorized"===e?1:"Uncategorized"===t?-1:e.localeCompare(t));return r.map(e=>({category:e,products:t[e]}))})(r).map(({category:e,products:r})=>(0,a.jsxs)("div",{className:"bg-white rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 ease-in-out",children:[a.jsx("div",{className:"bg-gray-50 px-6 py-3 border-b hover:bg-gray-100 transition-colors duration-200 ease-in-out",children:(0,a.jsxs)("h3",{className:"text-lg font-medium text-gray-900",children:[e," (",r.length," ",1===r.length?"product":"products",")"]})}),a.jsx("div",{className:"overflow-x-auto",children:(0,a.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[a.jsx("thead",{className:"bg-gray-50",children:(0,a.jsxs)("tr",{children:[a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48",children:"Product Name"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32",children:"SKU"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Unit"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Price"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Initial Stock"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Prod"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Rel"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Final Stock"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Res"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Available"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Actions"})]})}),a.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:r.map(e=>(0,a.jsxs)("tr",{className:"hover:bg-blue-100",children:[a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm font-medium text-gray-900",children:y?.id===(e.product_id||e.id)?a.jsx("input",{type:"text",value:y.name,onChange:e=>f({...y,name:e.target.value}),className:"w-full max-w-44 px-2 py-1 border border-gray-300 rounded text-sm"}):e.product_name||e.name}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-500",children:y?.id===(e.product_id||e.id)?a.jsx("input",{type:"text",value:y.sku||"",onChange:e=>f({...y,sku:e.target.value}),className:"w-full max-w-28 px-2 py-1 border border-gray-300 rounded text-sm"}):e.sku||"-"}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-500",children:y?.id===(e.product_id||e.id)?(0,a.jsxs)("select",{value:y.unit,onChange:e=>f({...y,unit:e.target.value}),className:"w-full max-w-20 px-2 py-1 border border-gray-300 rounded text-sm",children:[a.jsx("option",{value:"pans",children:"Pans"}),a.jsx("option",{value:"pcs",children:"Pieces"}),a.jsx("option",{value:"gallons",children:"Gallons"}),a.jsx("option",{value:"liters",children:"Liters"}),a.jsx("option",{value:"kg",children:"Kilograms"}),a.jsx("option",{value:"boxes",children:"Boxes"}),a.jsx("option",{value:"bags",children:"Bags"}),a.jsx("option",{value:"g",children:"Grams"}),a.jsx("option",{value:"bottles",children:"Bottles"}),a.jsx("option",{value:"packs",children:"Packs"})]}):e.unit}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm font-medium text-green-600",children:y?.id===(e.product_id||e.id)?a.jsx("input",{type:"number",min:"0",step:"0.01",value:y.price||0,onChange:e=>f({...y,price:parseFloat(e.target.value)||0}),className:"w-full max-w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):`₱${(e.price||0).toFixed(2)}`}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-900",children:y?.id===(e.product_id||e.id)?a.jsx("input",{type:"number",min:"0",value:y.initial_stock||0,onChange:e=>f({...y,initial_stock:parseInt(e.target.value)||0}),className:"w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):e.initial_stock||0}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-900",children:y?.id===(e.product_id||e.id)?a.jsx("input",{type:"number",min:"0",value:y.production||0,onChange:e=>f({...y,production:parseInt(e.target.value)||0}),className:"w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):e.production||0}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-900",children:y?.id===(e.product_id||e.id)?a.jsx("input",{type:"number",min:"0",value:y.released||0,onChange:e=>f({...y,released:parseInt(e.target.value)||0}),className:"w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):e.released||0}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm font-semibold text-purple-600",children:y?.id===(e.product_id||e.id)?(y.initial_stock||0)+(y.production||0)-(y.released||0):e.final_stock||0}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-900",children:y?.id===(e.product_id||e.id)?a.jsx("input",{type:"number",min:"0",value:y.reserved||0,onChange:e=>f({...y,reserved:parseInt(e.target.value)||0}),className:"w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"}):e.reserved||0}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm font-semibold text-emerald-600",children:y?.id===(e.product_id||e.id)?(y.initial_stock||0)+(y.production||0)-(y.released||0)-(y.reserved||0):e.available_stock||0}),a.jsx("td",{className:"px-6 py-2 whitespace-nowrap text-sm text-gray-500",children:a.jsx("div",{className:"flex space-x-2",children:y?.id===(e.product_id||e.id)?(0,a.jsxs)(a.Fragment,{children:[a.jsx("button",{onClick:()=>handleUpdateProduct(y),className:`p-1 rounded ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-100":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-100":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100":"text-blue-600 hover:text-blue-900 hover:bg-blue-100"}`,title:"Save",children:a.jsx(o.Z,{className:"h-4 w-4"})}),a.jsx("button",{onClick:()=>f(null),className:"p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200",title:"Cancel",children:a.jsx(d.Z,{className:"h-4 w-4"})})]}):(0,a.jsxs)(a.Fragment,{children:[a.jsx("button",{onClick:()=>f({...e,id:e.product_id||e.id,name:e.product_name||e.name}),className:`p-1 rounded ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-100":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-100":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100":"text-blue-600 hover:text-blue-900 hover:bg-blue-100"}`,title:"Edit",children:a.jsx(c.Z,{className:"h-4 w-4"})}),a.jsx("button",{onClick:()=>handleDeleteProduct(e.product_id||e.id),className:"p-1 rounded text-red-600 hover:text-red-900 hover:bg-red-100",title:"Delete",children:a.jsx(x.Z,{className:"h-4 w-4"})})]})})})]},e.product_id||e.id))})]})})]},e))})]}):a.jsx("div",{className:"text-center py-8 text-gray-500",children:a.jsx("p",{children:"Please select a brand to manage products"})})}var u=r(5441),p=r(3303),g=r(1057),h=r(5894),b=r(8626),y=r(4155);function OrderManager({selectedBrand:e,onOrderUpdate:t,theme:r="blue"}){let[n,d]=(0,s.useState)([]),[o,f]=(0,s.useState)(!1),[v,j]=(0,s.useState)(null),[w,N]=(0,s.useState)(null),[k,_]=(0,s.useState)("all"),[S,D]=(0,s.useState)(!1),[P,C]=(0,s.useState)(null),[O,F]=(0,s.useState)(null),[A,E]=(0,s.useState)([]),[$,q]=(0,s.useState)(!1);(0,s.useEffect)(()=>{fetchOrders()},[k,e]),(0,s.useEffect)(()=>{if(!e)return;let t=i.O.channel("customer-orders-changes").on("postgres_changes",{event:"*",schema:"public",table:"customer_orders",filter:`brand_id=eq.${e.id}`},e=>{console.log("Customer orders realtime update:",e),v?console.log("Skipping realtime refetch - currently updating order"):fetchOrders()}).subscribe();return()=>{i.O.removeChannel(t)}},[e,v]);let fetchOrders=async()=>{f(!0);try{let t=i.O.from("customer_orders").select(`
          *,
          location:locations(*),
          brand:brands(*),
          order_details(
            *,
            product:products(id, name, sku, unit, category)
          ),
          logistics_assignments(
            id,
            date,
            time_slot,
            status
          )
        `).order("created_at",{ascending:!1});"all"!==k&&(t=t.eq("status",k)),e&&(t=t.eq("brand_id",e.id));let{data:r,error:a}=await t;if(a){console.error("Error fetching orders:",a);return}r&&d(r)}catch(e){console.error("Error fetching orders:",e)}finally{f(!1)}},updateOrderStatus=async(e,r)=>{if(v===e){console.log("Order update already in progress for:",e);return}j(e);try{if("released"===r){let{data:t,error:r}=await i.O.from("order_details").select("product_id, quantity").eq("order_id",e);if(r){console.error("Error fetching order details:",r),alert("Failed to fetch order details");return}for(let e of t||[]){let{data:t,error:r}=await i.O.from("products").select("reserved, released").eq("id",e.product_id).single();if(r){console.error("Error fetching product data:",r),alert("Failed to fetch product data");return}let a=Math.max(0,(t?.reserved||0)-e.quantity),s=(t?.released||0)+e.quantity,{error:l}=await i.O.from("products").update({reserved:a,released:s,updated_at:new Date().toISOString()}).eq("id",e.product_id);if(l){console.error("Error updating product quantities:",l),alert("Failed to update product quantities");return}}}if("cancelled"===r){let{data:t,error:r}=await i.O.from("order_details").select("product_id, quantity").eq("order_id",e);if(r){console.error("Error fetching order details:",r),alert("Failed to fetch order details");return}for(let e of t||[]){let{data:t,error:r}=await i.O.from("products").select("reserved").eq("id",e.product_id).single();if(r){console.error("Error fetching product data:",r),alert("Failed to fetch product data");return}let a=Math.max(0,(t?.reserved||0)-e.quantity),{error:s}=await i.O.from("products").update({reserved:a,updated_at:new Date().toISOString()}).eq("id",e.product_id);if(s){console.error("Error updating product quantities:",s),alert("Failed to update product quantities");return}}}let{error:a}=await i.O.from("customer_orders").update({status:r,updated_at:new Date().toISOString()}).eq("id",e);if(a){console.error("Error updating order status:",a),alert("Failed to update order status");return}fetchOrders(),t&&t()}catch(e){console.error("Error updating order status:",e),alert("Failed to update order status")}finally{j(null)}},handleDeleteOrder=async e=>{if(confirm("Are you sure you want to delete this order? This action cannot be undone."))try{j(e);let{error:r}=await i.O.from("order_details").delete().eq("order_id",e);if(r){console.error("Error deleting order details:",r),alert("Failed to delete order details");return}let{error:a}=await i.O.from("customer_orders").delete().eq("id",e);if(a){console.error("Error deleting order:",a),alert("Failed to delete order");return}fetchOrders(),t&&t()}catch(e){console.error("Error deleting order:",e),alert("Failed to delete order")}finally{j(null)}},getStatusIcon=e=>{switch(e){case"pending":return a.jsx(u.Z,{className:"h-4 w-4 text-yellow-500"});case"approved":return a.jsx(l.Z,{className:"h-4 w-4 text-blue-500"});case"released":return a.jsx(p.Z,{className:"h-4 w-4 text-green-500"});case"cancelled":return a.jsx(g.Z,{className:"h-4 w-4 text-red-500"});default:return a.jsx(u.Z,{className:"h-4 w-4 text-gray-500"})}},getStatusColor=e=>{switch(e){case"pending":return"bg-yellow-100 text-yellow-800";case"approved":return"bg-blue-100 text-blue-800";case"released":return"bg-green-100 text-green-800";case"paid":return"bg-purple-100 text-purple-800";case"complete":return"bg-indigo-100 text-indigo-800";case"cancelled":return"bg-red-100 text-red-800";default:return"bg-gray-100 text-gray-800"}},getCategoryTotals=e=>{if(!e.order_details)return[];let t=new Map;return e.order_details.forEach(e=>{let r=e.product?.category&&""!==e.product.category.trim()?e.product.category:"Uncategorized";t.has(r)||t.set(r,{category:r,totalQuantity:0,totalAmount:0});let a=t.get(r);a.totalQuantity+=e.quantity,a.totalAmount+=e.unit_price*e.quantity}),Array.from(t.values())},getTotalAmount=e=>{let t=e.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0),r=t;return"delivery"===e.delivery_type?r+=t>=1e4?0:500:"pickup"===e.delivery_type&&t>=1e4&&(r-=.05*t),r},getSubtotalAmount=e=>e.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0),fetchAvailableProducts=async()=>{if(e)try{let{data:t,error:r}=await i.O.from("inventory_summary").select("*").eq("brand_id",e.id).order("category, product_name");if(r)throw r;E(t||[])}catch(e){console.error("Error fetching products:",e),alert("Failed to fetch products")}},handleSaveOverride=async()=>{if(P&&O&&e){q(!0);try{let e=new Map,r=new Set([...O.order_details.map(e=>e.product_id),...P.order_details.map(e=>e.product_id)]);for(let[t,a]of(r.forEach(t=>{let r=O.order_details.find(e=>e.product_id===t)?.quantity||0,a=P.order_details.find(e=>e.product_id===t)?.quantity||0;e.set(t,a-r)}),Array.from(e.entries())))if(a>0){let e=A.find(e=>e.id===t);if(!e&&!(e=A.find(e=>e.product_id===t))){alert(`Product not found: ${t}`);return}let r=O.order_details.find(e=>e.product_id===t)?.quantity||0,s=(e.available_stock||0)+r;if(a>s){alert(`Insufficient stock for ${e.name}. Available: ${s}, Requested: ${a}`);return}}for(let[t,r]of Array.from(e.entries()))if(0!==r){let{data:e,error:a}=await i.O.from("products").select("reserved").eq("id",t).single();if(a){console.error("Error fetching current product:",a),alert("Failed to fetch current product data");return}let s=(e.reserved||0)+r,{error:l}=await i.O.from("products").update({reserved:s}).eq("id",t);if(l){console.error("Error updating inventory:",l),alert("Failed to update inventory");return}}let{error:a}=await i.O.from("order_details").delete().eq("order_id",P.id);if(a)throw a;if(P.order_details.length>0){let{error:e}=await i.O.from("order_details").insert(P.order_details.map(e=>({order_id:P.id,product_id:e.product_id,quantity:e.quantity,unit_price:e.unit_price})));if(e)throw e}let s=calculateOverrideTotal(),{error:l}=await i.O.from("customer_orders").update({total_amount:s,delivery_type:P.delivery_type,updated_at:new Date().toISOString()}).eq("id",P.id);if(l)throw l;await fetchOrders(),t&&t(),console.log("Override - New total calculated:",s),console.log("Override - Editing order details:",P.order_details),console.log("Override - Delivery type:",P.delivery_type),N({...w,total_amount:s,delivery_type:P.delivery_type,order_details:P.order_details}),D(!1),C(null),F(null),alert("Order updated successfully!")}catch(e){console.error("Error updating order:",e),alert("Failed to update order")}finally{q(!1)}}},addProductToOrder=e=>{if(!P)return;let t=e.product_id||e.id,r=P.order_details.find(e=>e.product_id===t),a=r?r.quantity+1:1,s=O.order_details.find(e=>e.product_id===t)?.quantity||0,i=(e.available_stock||0)+s;if(a>i){alert(`Insufficient stock for ${e.product_name||e.name}. Available: ${i}, Requested: ${a}`);return}r?C({...P,order_details:P.order_details.map(e=>e.product_id===t?{...e,quantity:a}:e)}):C({...P,order_details:[...P.order_details,{id:`temp-${Date.now()}`,order_id:P.id,product_id:t,quantity:1,unit_price:e.price||0,product:e}]})},removeProductFromOrder=e=>{P&&C({...P,order_details:P.order_details.filter(t=>t.product_id!==e)})},updateProductQuantity=(e,t)=>{if(!P||t<0)return;if(0===t){removeProductFromOrder(e);return}let r=A.find(t=>(t.product_id||t.id)===e);if(r){let a=O.order_details.find(t=>t.product_id===e)?.quantity||0,s=(r.available_stock||0)+a;if(t>s){alert(`Insufficient stock for ${r.product_name||r.name}. Available: ${s}, Requested: ${t}`);return}}C({...P,order_details:P.order_details.map(r=>r.product_id===e?{...r,quantity:t}:r)})},calculateOverrideTotal=()=>{if(!P)return 0;let e=P.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0),t=e;return"delivery"===P.delivery_type?t+=e>=1e4?0:500:"pickup"===P.delivery_type&&e>=1e4&&(t-=.05*e),t},canIncreaseQuantity=e=>{if(!P||!O)return!1;let t=A.find(t=>(t.product_id||t.id)===e);if(!t)return!1;let r=O.order_details.find(t=>t.product_id===e)?.quantity||0,a=P.order_details.find(t=>t.product_id===e)?.quantity||0,s=(t.available_stock||0)+r;return a<s},canAddProduct=e=>{if(!P||!O)return!1;let t=e.product_id||e.id,r=O.order_details.find(e=>e.product_id===t)?.quantity||0,a=P.order_details.find(e=>e.product_id===t)?.quantity||0,s=(e.available_stock||0)+r;return a<s};return(0,a.jsxs)("div",{className:"space-y-6",children:[a.jsx("div",{className:"flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0",children:a.jsx("div",{children:a.jsx("h3",{className:"text-xl font-semibold text-gray-900",children:"Customer Orders"})})}),a.jsx("div",{className:"flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4",children:(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Status Filter"}),(0,a.jsxs)("select",{value:k,onChange:e=>_(e.target.value),className:"px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",children:[a.jsx("option",{value:"all",children:"All Statuses"}),a.jsx("option",{value:"pending",children:"Pending"}),a.jsx("option",{value:"approved",children:"Approved"}),a.jsx("option",{value:"released",children:"Released"}),a.jsx("option",{value:"cancelled",children:"Cancelled"})]})]})}),o?(0,a.jsxs)("div",{className:"flex items-center justify-center py-12",children:[a.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"}),a.jsx("span",{className:"ml-3 text-gray-600",children:"Loading orders..."})]}):0===n.length?(0,a.jsxs)("div",{className:"text-center py-12",children:[a.jsx(h.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),a.jsx("p",{className:"text-gray-600",children:"No orders found"})]}):a.jsx("div",{className:"bg-white rounded-lg border shadow-sm overflow-hidden",children:a.jsx("div",{className:"overflow-x-auto",children:(0,a.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[a.jsx("thead",{className:"bg-gray-50",children:(0,a.jsxs)("tr",{children:[a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Order Details"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Location"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Status"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Date"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Logistics"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Total Amount"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Actions"})]})}),a.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:n.map(e=>(0,a.jsxs)("tr",{className:"hover:bg-blue-100",children:[a.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:(0,a.jsxs)("div",{children:[(0,a.jsxs)("div",{className:"text-sm font-medium text-gray-900",children:["#",e.id.slice(-8)]}),a.jsx("div",{className:"text-sm text-gray-500",children:e.brand?.name})]})}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:e.location?.name}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:(0,a.jsxs)("span",{className:`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(e.status)}`,children:[getStatusIcon(e.status),a.jsx("span",{className:"ml-1 capitalize",children:e.status})]})}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:(0,m.iI)(e.created_at,{dateStyle:"short"})}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:(0,a.jsxs)("div",{className:"space-y-1",children:[a.jsx("span",{className:`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${"delivery"===e.delivery_type?"bg-blue-100 text-blue-800":"bg-green-100 text-green-800"}`,children:"delivery"===e.delivery_type?"Delivery":"Pickup"}),e.logistics_assignments&&e.logistics_assignments.length>0&&a.jsx("div",{className:"text-xs text-gray-500",children:e.logistics_assignments.map((e,t)=>(0,a.jsxs)("div",{className:"flex items-center space-x-1",children:[a.jsx("span",{className:"text-gray-400",children:"•"}),a.jsx("span",{children:new Date(e.date).toLocaleDateString()}),(0,a.jsxs)("span",{className:"capitalize",children:["(",e.time_slot,")"]})]},e.id))})]})}),(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600",children:["₱",getTotalAmount(e).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:(0,a.jsxs)("div",{className:"flex space-x-2",children:[a.jsx("button",{onClick:()=>N(e),className:"p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-100",title:"View Details",children:a.jsx(b.Z,{className:"h-4 w-4"})}),"pending"===e.status&&a.jsx("button",{onClick:()=>updateOrderStatus(e.id,"approved"),disabled:v===e.id,className:`p-1 rounded ${v===e.id?"text-gray-400 cursor-not-allowed":"text-green-600 hover:text-green-900 hover:bg-green-100"}`,title:"Approve Order",children:v===e.id?a.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):a.jsx(l.Z,{className:"h-4 w-4"})}),"approved"===e.status&&a.jsx("button",{onClick:()=>updateOrderStatus(e.id,"released"),disabled:v===e.id,className:`p-1 rounded ${v===e.id?"text-gray-400 cursor-not-allowed":"green"===r?"text-green-600 hover:text-green-900 hover:bg-green-100":"red"===r?"text-red-600 hover:text-red-900 hover:bg-red-100":"yellow"===r?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100":"text-blue-600 hover:text-blue-900 hover:bg-blue-100"}`,title:"Release Order",children:v===e.id?a.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):a.jsx(p.Z,{className:"h-4 w-4"})}),("pending"===e.status||"approved"===e.status)&&a.jsx("button",{onClick:()=>{confirm("Are you sure you want to cancel this order? This action will return reserved stock to available inventory and cannot be undone.")&&updateOrderStatus(e.id,"cancelled")},disabled:v===e.id,className:`${v===e.id?"text-gray-400 cursor-not-allowed":"text-red-600 hover:text-red-900"}`,title:"Cancel Order",children:v===e.id?a.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):a.jsx(g.Z,{className:"h-4 w-4"})}),("cancelled"===e.status||"released"===e.status)&&a.jsx("button",{onClick:()=>handleDeleteOrder(e.id),disabled:v===e.id,className:`${v===e.id?"text-gray-400 cursor-not-allowed":"text-red-600 hover:text-red-900"}`,title:"Delete Order",children:v===e.id?a.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"}):a.jsx(x.Z,{className:"h-4 w-4"})})]})})]},e.id))})]})})}),w&&a.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,a.jsxs)("div",{className:"relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[(0,a.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Order Details #",w.id.slice(0,8)]}),(0,a.jsxs)("div",{className:"flex space-x-2",children:["approved"===w.status&&(0,a.jsxs)("button",{onClick:()=>{w&&(F({...w}),C({...w}),D(!0),fetchAvailableProducts())},className:"flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium bg-orange-100 text-orange-700 hover:bg-orange-200",children:[a.jsx(c.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Override"})]}),(0,a.jsxs)("button",{onClick:()=>{if(!w)return;let e=window.open("","_blank");e&&(e.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - Order ${w.id.slice(0,8)}</title>
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
              <div class="company-name">${w.brand?.name||"Company"}</div>
              <div class="receipt-title">Stock Transfer Sheet</div>
            </div>
            
            <div class="order-info">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Order ID</span>
                  <span class="info-value">${w.id.slice(0,8)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Date (PST)</span>
                  <span class="info-value">${(0,m.iI)(w.created_at,{dateStyle:"short"})}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Location</span>
                  <span class="info-value">${w.location?.name||"N/A"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Status</span>
                  <span class="info-value">${w.status}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Logistics</span>
                  <span class="info-value">${"delivery"===w.delivery_type?"Delivery":"Pickup"}</span>
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
              ${w.order_details.map(e=>`
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
            
            ${w.notes?`
              <div class="notes">
                <div class="notes-title">Notes</div>
                <div class="notes-text">${w.notes}</div>
              </div>
            `:""}
            
            <div class="total-section">
              ${getCategoryTotals(w).map(e=>`
                <div class="total-row">
                  <span class="total-label">${e.category}: ${e.totalQuantity} items</span>
                  <span class="total-value">₱${e.totalAmount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
              `).join("")}
              <div class="total-row">
                <span class="total-label">Subtotal</span>
                <span class="total-value">₱${getSubtotalAmount(w).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
              </div>
              ${"delivery"===w.delivery_type?`
                <div class="total-row">
                  <span class="total-label">Delivery Fee</span>
                  <span class="total-value">${getSubtotalAmount(w)>=1e4?"FREE (Order over ₱10k)":"+₱500.00"}</span>
                </div>
              `:""}
              ${"pickup"===w.delivery_type&&getSubtotalAmount(w)>=1e4?`
                <div class="total-row">
                  <span class="total-label">Pickup Discount (5%)</span>
                  <span class="total-value">-₱${(.05*getSubtotalAmount(w)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
              `:""}
              ${"pickup"===w.delivery_type&&1e4>getSubtotalAmount(w)?`
                <div class="total-row">
                  <span class="total-label">Pickup Discount</span>
                  <span class="total-value">Not available (Order under ₱10k)</span>
                </div>
              `:""}
              <div class="total-row grand-total">
                <span class="total-label">Total Amount</span>
                <span class="total-value">₱${getTotalAmount(w).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
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
            
            <div class="footer">
              <div class="footer-text">Thank you for your order!</div>
              <div class="footer-date">Generated on ${new Date().toLocaleString()}</div>
            </div>
          </div>
        </body>
        </html>
      `),e.document.close(),e.focus(),e.print(),e.close())},className:`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${"green"===r?"bg-green-100 text-green-700 hover:bg-green-200":"red"===r?"bg-red-100 text-red-700 hover:bg-red-200":"yellow"===r?"bg-yellow-100 text-yellow-700 hover:bg-yellow-200":"bg-blue-100 text-blue-700 hover:bg-blue-200"}`,children:[a.jsx(y.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Print Transfer Sheet"})]}),a.jsx("button",{onClick:()=>N(null),className:"text-gray-400 hover:text-gray-600",children:a.jsx(g.Z,{className:"h-6 w-6"})})]})]}),(0,a.jsxs)("div",{className:"space-y-6",children:[(0,a.jsxs)("div",{className:"bg-gray-50 rounded-lg p-4",children:[(0,a.jsxs)("div",{className:"grid grid-cols-2 md:grid-cols-5 gap-4 text-center",children:[(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Created Date"}),a.jsx("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:(0,m.iI)(w.created_at,{dateStyle:"short",timeStyle:"short"})})]}),(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Status"}),a.jsx("span",{className:`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${"pending"===w.status?"bg-yellow-100 text-yellow-800":"approved"===w.status?"bg-blue-100 text-blue-800":"released"===w.status?"bg-orange-100 text-orange-800":"paid"===w.status?"bg-purple-100 text-purple-800":"complete"===w.status?"bg-indigo-100 text-indigo-800":"cancelled"===w.status?"bg-red-100 text-red-800":"bg-gray-100 text-gray-800"}`,children:w.status.charAt(0).toUpperCase()+w.status.slice(1)})]}),(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Logistics"}),a.jsx("span",{className:`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${"delivery"===w.delivery_type?"bg-blue-100 text-blue-800":"bg-green-100 text-green-800"}`,children:"delivery"===w.delivery_type?"Delivery":"Pickup"})]}),(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Location"}),a.jsx("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:w.location?.name||"N/A"})]}),(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Total Amount"}),(0,a.jsxs)("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:["₱",getTotalAmount(w).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]}),(0,a.jsxs)("div",{className:"mt-4 pt-4 border-t border-gray-200",children:[(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide mb-2",children:"Category Totals"}),a.jsx("div",{className:"grid grid-cols-2 md:grid-cols-3 gap-2",children:getCategoryTotals(w).map((e,t)=>(0,a.jsxs)("div",{className:"bg-white rounded p-2 border text-center",children:[a.jsx("p",{className:"text-xs font-medium text-gray-900",children:e.category}),(0,a.jsxs)("p",{className:"text-xs text-gray-600",children:[e.totalQuantity," items"]}),(0,a.jsxs)("p",{className:"text-xs font-semibold text-green-600",children:["₱",e.totalAmount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]},t))})]}),(0,a.jsxs)("div",{className:"mt-4 pt-4 border-t border-gray-200",children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide mb-2",children:"Pricing Breakdown"}),(0,a.jsxs)("div",{className:"bg-white rounded p-3 space-y-2",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("span",{className:"text-sm text-gray-600",children:"Subtotal:"}),(0,a.jsxs)("span",{className:"text-sm text-gray-900",children:["₱",getSubtotalAmount(w).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"delivery"===w.delivery_type&&(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("span",{className:"text-sm text-gray-600",children:"Delivery Fee:"}),getSubtotalAmount(w)>=1e4?a.jsx("span",{className:"text-sm text-green-600",children:"FREE (Order over ₱10k)"}):a.jsx("span",{className:"text-sm text-gray-900",children:"+₱500.00"})]}),"pickup"===w.delivery_type&&getSubtotalAmount(w)>=1e4&&(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("span",{className:"text-sm text-gray-600",children:"Pickup Discount (5%):"}),(0,a.jsxs)("span",{className:"text-sm text-green-600",children:["-₱",(.05*getSubtotalAmount(w)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"pickup"===w.delivery_type&&1e4>getSubtotalAmount(w)&&(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("span",{className:"text-sm text-gray-500",children:"Pickup Discount:"}),a.jsx("span",{className:"text-sm text-gray-500",children:"Not available (Order under ₱10k)"})]}),(0,a.jsxs)("div",{className:"flex justify-between items-center pt-2 border-t border-gray-200",children:[a.jsx("span",{className:"text-sm font-semibold text-gray-900",children:"Total Amount:"}),(0,a.jsxs)("span",{className:"text-sm font-semibold text-green-600",children:["₱",getTotalAmount(w).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]})]})]})]}),w.notes&&(0,a.jsxs)("div",{className:"bg-white border rounded-lg p-4",children:[a.jsx("h4",{className:"text-sm font-semibold text-gray-900 mb-2",children:"Notes"}),a.jsx("p",{className:"text-sm text-gray-700",children:w.notes})]}),w.order_details&&w.order_details.length>0&&(0,a.jsxs)("div",{className:"bg-white border rounded-lg overflow-hidden",children:[a.jsx("div",{className:"px-4 py-3 bg-gray-50 border-b",children:(0,a.jsxs)("h4",{className:"text-sm font-semibold text-gray-900",children:["Order Items (",w.order_details.length,")"]})}),a.jsx("div",{className:"overflow-x-auto",children:(0,a.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[a.jsx("thead",{className:"bg-gray-50",children:(0,a.jsxs)("tr",{children:[a.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Product"}),a.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Quantity"}),a.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Unit Price"}),a.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Total"})]})}),a.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:w.order_details.map(e=>(0,a.jsxs)("tr",{className:"hover:bg-gray-50",children:[a.jsx("td",{className:"px-4 py-3 whitespace-nowrap",children:(0,a.jsxs)("div",{children:[a.jsx("div",{className:"text-sm font-medium text-gray-900",children:e.product.name}),e.product.sku&&(0,a.jsxs)("div",{className:"text-xs text-gray-500",children:["SKU: ",e.product.sku]})]})}),(0,a.jsxs)("td",{className:"px-4 py-3 whitespace-nowrap text-sm text-gray-900",children:[e.quantity," ",e.product.unit]}),(0,a.jsxs)("td",{className:"px-4 py-3 whitespace-nowrap text-sm text-gray-900",children:["₱",e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,a.jsxs)("td",{className:"px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900",children:["₱",(e.unit_price*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]},e.id))})]})})]})]})]})}),S&&P&&a.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,a.jsxs)("div",{className:"relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 xl:w-2/3 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[(0,a.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Override Order #",P.id.slice(0,8)]}),a.jsx("button",{onClick:()=>{D(!1),C(null),F(null)},className:"text-gray-400 hover:text-gray-600",children:a.jsx(g.Z,{className:"h-6 w-6"})})]}),(0,a.jsxs)("div",{className:"space-y-6",children:[(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Logistics Method"}),(0,a.jsxs)("div",{className:"flex space-x-4",children:[(0,a.jsxs)("label",{className:"flex items-center",children:[a.jsx("input",{type:"radio",name:"delivery_type",value:"delivery",checked:"delivery"===P.delivery_type,onChange:e=>C({...P,delivery_type:e.target.value}),className:"mr-2"}),a.jsx("span",{className:"text-sm",children:"Delivery"})]}),(0,a.jsxs)("label",{className:"flex items-center",children:[a.jsx("input",{type:"radio",name:"delivery_type",value:"pickup",checked:"pickup"===P.delivery_type,onChange:e=>C({...P,delivery_type:e.target.value}),className:"mr-2"}),a.jsx("span",{className:"text-sm",children:"Pickup"})]})]})]}),(0,a.jsxs)("div",{children:[a.jsx("h4",{className:"text-md font-medium text-gray-900 mb-3",children:"Current Order Items"}),a.jsx("div",{className:"space-y-2",children:P.order_details.map(e=>(0,a.jsxs)("div",{className:"flex items-center justify-between p-3 bg-gray-50 rounded-lg",children:[(0,a.jsxs)("div",{className:"flex-1",children:[a.jsx("div",{className:"font-medium text-gray-900",children:e.product?.product_name||e.product?.name||"Unknown Product"}),(0,a.jsxs)("div",{className:"text-sm text-gray-500",children:["₱",e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})," each"]})]}),(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx("button",{onClick:()=>updateProductQuantity(e.product_id,e.quantity-1),className:"px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200",children:"-"}),a.jsx("span",{className:"w-12 text-center",children:e.quantity}),a.jsx("button",{onClick:()=>updateProductQuantity(e.product_id,e.quantity+1),disabled:!canIncreaseQuantity(e.product_id),className:`px-2 py-1 text-sm rounded ${canIncreaseQuantity(e.product_id)?"bg-green-100 text-green-700 hover:bg-green-200":"bg-gray-100 text-gray-400 cursor-not-allowed"}`,children:"+"}),a.jsx("button",{onClick:()=>removeProductFromOrder(e.product_id),className:"px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 ml-2",children:"Remove"})]})]},e.id))})]}),(0,a.jsxs)("div",{children:[a.jsx("h4",{className:"text-md font-medium text-gray-900 mb-3",children:"Add Products"}),a.jsx("div",{className:"max-h-60 overflow-y-auto space-y-4",children:(()=>{let e=A.reduce((e,t)=>{let r=t.category||"Uncategorized";return e[r]||(e[r]=[]),e[r].push(t),e},{});return Object.entries(e).map(([e,t])=>(0,a.jsxs)("div",{className:"space-y-2",children:[a.jsx("h5",{className:"text-sm font-semibold text-gray-700 border-b border-gray-200 pb-1",children:e}),a.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2",children:t.map(e=>{let t=canAddProduct(e),r=O?.order_details.find(t=>t.product_id===e.id)?.quantity||0,s=(e.available_stock||0)+r;return(0,a.jsxs)("button",{onClick:()=>t&&addProductToOrder(e),disabled:!t,className:`p-2 text-left border rounded text-sm ${t?"border-gray-200 hover:bg-gray-50":"border-gray-100 bg-gray-50 cursor-not-allowed"}`,children:[a.jsx("div",{className:`font-medium ${t?"text-gray-900":"text-gray-400"}`,children:e.product_name||e.name}),(0,a.jsxs)("div",{className:`${t?"text-gray-500":"text-gray-400"}`,children:["₱",(e.price||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,a.jsxs)("div",{className:`text-xs ${t?"text-gray-400":"text-gray-300"}`,children:["Available: ",s," / ",e.initial_stock]})]},e.id)})})]},e))})()})]}),(0,a.jsxs)("div",{className:"bg-gray-50 p-4 rounded-lg",children:[a.jsx("h4",{className:"text-md font-medium text-gray-900 mb-3",children:"Order Summary"}),(0,a.jsxs)("div",{className:"flex justify-between items-center mb-2",children:[a.jsx("span",{className:"text-sm text-gray-600",children:"Subtotal:"}),(0,a.jsxs)("span",{className:"text-sm font-medium text-gray-900",children:["₱",P.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"delivery"===P.delivery_type&&(0,a.jsxs)("div",{className:"flex justify-between items-center mb-2",children:[a.jsx("span",{className:"text-sm text-gray-600",children:"Delivery Fee:"}),a.jsx("span",{className:"text-sm font-medium text-gray-900",children:P.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0)>=1e4?"FREE (Order over ₱10k)":"+₱500.00"})]}),"pickup"===P.delivery_type&&P.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0)>=1e4&&(0,a.jsxs)("div",{className:"flex justify-between items-center mb-2",children:[a.jsx("span",{className:"text-sm text-gray-600",children:"Pickup Discount (5%):"}),(0,a.jsxs)("span",{className:"text-sm font-medium text-green-600",children:["-₱",(.05*P.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"pickup"===P.delivery_type&&1e4>P.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0)&&(0,a.jsxs)("div",{className:"flex justify-between items-center mb-2",children:[a.jsx("span",{className:"text-sm text-gray-600",children:"Pickup Discount:"}),a.jsx("span",{className:"text-sm font-medium text-gray-500",children:"Not available (Order under ₱10k)"})]}),(0,a.jsxs)("div",{className:"flex justify-between items-center pt-2 border-t border-gray-300",children:[a.jsx("span",{className:"text-lg font-medium text-gray-900",children:"Total Amount:"}),(0,a.jsxs)("span",{className:"text-lg font-bold text-green-600",children:["₱",calculateOverrideTotal().toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]}),(0,a.jsxs)("div",{className:"flex justify-end space-x-3",children:[a.jsx("button",{onClick:()=>{D(!1),C(null),F(null)},className:"px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200",children:"Cancel"}),a.jsx("button",{onClick:()=>{C({...P,total_amount:calculateOverrideTotal()}),handleSaveOverride()},disabled:$,className:"px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50",children:$?"Saving...":"Save Changes"})]})]})]})})]})}var f=r(6388);function BranchManager({selectedBrand:e,theme:t="blue"}){let[r,l]=(0,s.useState)([]),[u,p]=(0,s.useState)([]),[g,h]=(0,s.useState)(!1),[v,j]=(0,s.useState)(!1),[w,N]=(0,s.useState)(null),[k,_]=(0,s.useState)(null),[S,D]=(0,s.useState)([]),[P,C]=(0,s.useState)(!1),[O,F]=(0,s.useState)(!1),[A,E]=(0,s.useState)(null),[$,q]=(0,s.useState)({name:"",passkey:"",franchisee:"",contact_number:"",company_owned:!1,brand_id:e?.id||""});(0,s.useEffect)(()=>{e&&(fetchLocations(),fetchBrands(),q(t=>({...t,brand_id:e.id})),C(!1),_(null),D([]),F(!1),E(null))},[e]),(0,s.useEffect)(()=>{if(!e)return;let t=i.O.channel("branch-orders-changes").on("postgres_changes",{event:"*",schema:"public",table:"customer_orders",filter:`brand_id=eq.${e.id}`},e=>{console.log("Branch orders realtime update:",e),P&&k&&fetchLocationOrders(k.id)}).subscribe();return()=>{i.O.removeChannel(t)}},[e,P,k]);let fetchLocations=async()=>{if(e){h(!0);try{let{data:t,error:r}=await i.O.from("locations").select(`
          *,
          brand:brands(*)
        `).eq("brand_id",e.id).order("name");if(r){console.error("Error fetching locations:",r);return}t&&l(t)}catch(e){console.error("Error fetching locations:",e)}finally{h(!1)}}},fetchBrands=async()=>{try{let{data:e,error:t}=await i.O.from("brands").select("*").order("name");if(t){console.error("Error fetching brands:",t);return}e&&p(e)}catch(e){console.error("Error fetching brands:",e)}},handleAddLocation=async t=>{if(t.preventDefault(),!$.name||!$.passkey||!$.franchisee||!$.contact_number){alert("Please fill in all required fields");return}try{let{data:t,error:a}=await i.O.from("locations").insert([$]).select();if(a){console.error("Error adding location:",a),alert("Error adding location");return}t&&(l([...r,t[0]]),q({name:"",passkey:"",franchisee:"",contact_number:"",company_owned:!1,brand_id:e?.id||""}),j(!1))}catch(e){console.error("Error adding location:",e),alert("Error adding location")}},handleUpdateLocation=async e=>{try{let{data:t,error:a}=await i.O.from("locations").update({name:e.name,passkey:e.passkey,franchisee:e.franchisee,contact_number:e.contact_number,company_owned:e.company_owned,brand_id:e.brand_id,updated_at:new Date().toISOString()}).eq("id",e.id).select();if(a){console.error("Error updating location:",a),alert("Error updating location");return}t&&(l(r.map(r=>r.id===e.id?{...t[0],brand:e.brand}:r)),N(null))}catch(e){console.error("Error updating location:",e),alert("Error updating location")}},handleDeleteLocation=async e=>{if(confirm("Are you sure you want to delete this location?"))try{let{error:t}=await i.O.from("locations").delete().eq("id",e);if(t){console.error("Error deleting location:",t),alert("Error deleting location");return}l(r.filter(t=>t.id!==e))}catch(e){console.error("Error deleting location:",e),alert("Error deleting location")}},fetchLocationOrders=async e=>{h(!0);try{let{data:t,error:r}=await i.O.from("customer_orders").select(`
          *,
          location:locations(*),
          brand:brands(*),
          order_details(
            *,
            product:products(id, name, sku, unit, category)
          )
        `).eq("location_id",e).order("created_at",{ascending:!1});if(r){console.error("Error fetching orders:",r);return}t&&D(t)}catch(e){console.error("Error fetching orders:",e)}finally{h(!1)}},handleViewOrderHistory=async e=>{_(e),C(!0),await fetchLocationOrders(e.id)},copyToClipboard=async e=>{try{await navigator.clipboard.writeText(e),console.log("Passkey copied to clipboard:",e)}catch(r){console.error("Failed to copy passkey:",r);let t=document.createElement("textarea");t.value=e,document.body.appendChild(t),t.select(),document.execCommand("copy"),document.body.removeChild(t)}},getStatusBadge=e=>a.jsx("span",{className:`px-2 py-1 rounded-full text-xs font-medium ${{pending:"bg-yellow-100 text-yellow-800",approved:"bg-blue-100 text-blue-800",released:"bg-green-100 text-green-800",cancelled:"bg-red-100 text-red-800"}[e]||"bg-gray-100 text-gray-800"}`,children:e.charAt(0).toUpperCase()+e.slice(1)}),getSubtotalAmount=e=>e.order_details.reduce((e,t)=>e+t.unit_price*t.quantity,0),getCategoryTotals=e=>{let t=new Map;return e.order_details.forEach(e=>{let r=e.product?.category||"Uncategorized",a=t.get(r)||{category:r,totalQuantity:0,totalAmount:0};a.totalQuantity+=e.quantity,a.totalAmount+=e.unit_price*e.quantity,t.set(r,a)}),Array.from(t.values())},handleViewDetails=e=>{E(e),F(!0)},handlePrintReceipt=e=>{let t=window.open("","_blank");t&&(t.document.write(`
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
                  <span class="info-value">${(0,m.iI)(e.created_at,{dateStyle:"short"})}</span>
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
            
            <div class="total-section">
              ${getCategoryTotals(e).map(e=>`
                <div class="total-row">
                  <span class="total-label">${e.category}: ${e.totalQuantity} items</span>
                  <span class="total-value">₱${e.totalAmount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
              `).join("")}
              <div class="total-row">
                <span class="total-label">Subtotal</span>
                <span class="total-value">₱${getSubtotalAmount(e).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
              </div>
              ${"delivery"===e.delivery_type?`
                <div class="total-row">
                  <span class="total-label">Delivery Fee</span>
                  <span class="total-value">${getSubtotalAmount(e)>=1e4?"FREE (Order over ₱10k)":"+₱500.00"}</span>
                </div>
              `:""}
              ${"pickup"===e.delivery_type&&getSubtotalAmount(e)>=1e4?`
                <div class="total-row">
                  <span class="total-label">Pickup Discount (5%)</span>
                  <span class="total-value">-₱${(.05*getSubtotalAmount(e)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
              `:""}
              ${"pickup"===e.delivery_type&&1e4>getSubtotalAmount(e)?`
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
          
          <div class="footer">
              <div class="footer-text">Thank you for your order!</div>
              <div class="footer-date">Generated on ${new Date().toLocaleString()}</div>
            </div>
          </div>
        </body>
        </html>
      `),t.document.close(),t.focus(),t.print(),t.close())};return P&&k?(0,a.jsxs)("div",{className:"space-y-6",children:[(0,a.jsxs)("div",{className:"flex items-center justify-between",children:[(0,a.jsxs)("div",{children:[a.jsx("h3",{className:"text-xl font-semibold text-gray-900",children:"Order History"}),a.jsx("p",{className:"text-gray-600",children:k.name})]}),(0,a.jsxs)("button",{onClick:()=>{C(!1),_(null)},className:"flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors",children:[a.jsx(d.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Back to Branches"})]})]}),(0,a.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:[a.jsx("h4",{className:"text-lg font-medium mb-4",children:"Branch Summary"}),(0,a.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-4 gap-4",children:[(0,a.jsxs)("div",{className:"bg-blue-50 p-4 rounded-lg",children:[a.jsx("p",{className:"text-sm text-blue-600 font-medium",children:"Total Orders"}),a.jsx("p",{className:"text-2xl font-bold text-blue-900",children:S.length})]}),(0,a.jsxs)("div",{className:"bg-green-50 p-4 rounded-lg",children:[a.jsx("p",{className:"text-sm text-green-600 font-medium",children:"Total Revenue"}),(0,a.jsxs)("p",{className:"text-2xl font-bold text-green-900",children:["₱",S.reduce((e,t)=>e+(t.total_amount||0),0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),(0,a.jsxs)("div",{className:"bg-purple-50 p-4 rounded-lg",children:[a.jsx("p",{className:"text-sm text-purple-600 font-medium",children:"Total Paid"}),(0,a.jsxs)("p",{className:"text-2xl font-bold text-purple-900",children:["₱",S.filter(e=>"paid"===e.status||"complete"===e.status).reduce((e,t)=>e+(t.total_amount||0),0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),(0,a.jsxs)("div",{className:"bg-orange-50 p-4 rounded-lg",children:[a.jsx("p",{className:"text-sm text-orange-600 font-medium",children:"Total Receivable"}),(0,a.jsxs)("p",{className:"text-2xl font-bold text-orange-900",children:["₱",S.filter(e=>"released"===e.status).reduce((e,t)=>e+(t.total_amount||0),0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]})]}),g?a.jsx("div",{className:"flex items-center justify-center py-12",children:a.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"})}):a.jsx("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden",children:a.jsx("div",{className:"overflow-x-auto",children:(0,a.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[a.jsx("thead",{className:"bg-gray-50",children:(0,a.jsxs)("tr",{children:[a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Order ID"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Date"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Customer"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Status"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Amount"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Items"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Actions"})]})}),a.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:S.map(e=>(0,a.jsxs)("tr",{className:"hover:bg-blue-100",children:[(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900",children:[e.id.slice(0,8),"..."]}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:new Date(e.created_at).toLocaleDateString()}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:k.name}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:getStatusBadge(e.status)}),(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600",children:["₱",e.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:[e.order_details?.length||0," items"]}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:(0,a.jsxs)("div",{className:"flex space-x-2",children:[a.jsx("button",{onClick:()=>handleViewDetails(e),className:"p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out",title:"View Details",children:a.jsx(b.Z,{className:"h-4 w-4"})}),a.jsx("button",{onClick:()=>handlePrintReceipt(e),className:"p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out",title:"Print Receipt",children:a.jsx(y.Z,{className:"h-4 w-4"})})]})})]},e.id))})]})})})]}):(0,a.jsxs)("div",{className:"space-y-6",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[(0,a.jsxs)("div",{children:[a.jsx("h3",{className:"text-xl font-semibold text-gray-900",children:"Branch Manager"}),a.jsx("p",{className:"text-gray-600",children:"Manage branch locations and view order history"})]}),(0,a.jsxs)("button",{onClick:()=>j(!0),className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${"green"===t?"bg-green-600 hover:bg-green-700":"red"===t?"bg-red-600 hover:bg-red-700":"yellow"===t?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[a.jsx(n.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Add Branch"})]})]}),v&&a.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,a.jsxs)("div",{className:"relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[a.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"Add New Branch"}),a.jsx("button",{onClick:()=>j(!1),className:"text-gray-400 hover:text-gray-600",children:a.jsx(d.Z,{className:"h-6 w-6"})})]}),(0,a.jsxs)("form",{onSubmit:handleAddLocation,className:"space-y-4",children:[(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Branch Name *"}),(0,a.jsxs)("div",{className:"flex items-center space-x-3",children:[a.jsx("input",{type:"text",required:!0,value:$.name,onChange:e=>q({...$,name:e.target.value}),className:`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${"green"===t?"focus:ring-green-500":"red"===t?"focus:ring-red-500":"yellow"===t?"focus:ring-yellow-500":"focus:ring-blue-500"}`,placeholder:"Enter branch name"}),(0,a.jsxs)("label",{className:"flex items-center space-x-2 text-sm text-gray-700",children:[a.jsx("input",{type:"checkbox",checked:$.company_owned,onChange:e=>q({...$,company_owned:e.target.checked}),className:"h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"}),a.jsx("span",{children:"Company Owned"})]})]})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Passkey *"}),a.jsx("input",{type:"text",required:!0,value:$.passkey,onChange:e=>q({...$,passkey:e.target.value.replace(/\D/g,"").slice(0,6)}),className:`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${"green"===t?"focus:ring-green-500":"red"===t?"focus:ring-red-500":"yellow"===t?"focus:ring-yellow-500":"focus:ring-blue-500"}`,placeholder:"Enter 6-digit passkey",maxLength:6})]}),(0,a.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Franchisee Name *"}),a.jsx("input",{type:"text",required:!0,value:$.franchisee,onChange:e=>q({...$,franchisee:e.target.value}),className:`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${"green"===t?"focus:ring-green-500":"red"===t?"focus:ring-red-500":"yellow"===t?"focus:ring-yellow-500":"focus:ring-blue-500"}`,placeholder:"Enter franchisee name"})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-1",children:"Contact Number *"}),a.jsx("input",{type:"tel",required:!0,value:$.contact_number,onChange:e=>q({...$,contact_number:e.target.value}),className:`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${"green"===t?"focus:ring-green-500":"red"===t?"focus:ring-red-500":"yellow"===t?"focus:ring-yellow-500":"focus:ring-blue-500"}`,placeholder:"Enter contact number"})]})]}),(0,a.jsxs)("div",{className:"flex justify-end space-x-3 pt-4",children:[a.jsx("button",{type:"button",onClick:()=>j(!1),className:"px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors",children:"Cancel"}),(0,a.jsxs)("button",{type:"submit",className:`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${"green"===t?"bg-green-600 hover:bg-green-700":"red"===t?"bg-red-600 hover:bg-red-700":"yellow"===t?"bg-yellow-600 hover:bg-yellow-700":"bg-blue-600 hover:bg-blue-700"}`,children:[a.jsx(o.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Add Branch"})]})]})]})]})}),g?a.jsx("div",{className:"flex items-center justify-center py-12",children:a.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"})}):a.jsx("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden",children:a.jsx("div",{className:"overflow-x-auto",children:(0,a.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[a.jsx("thead",{className:"bg-gray-50",children:(0,a.jsxs)("tr",{children:[a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Branch Name"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Passkey"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Franchisee"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Contact"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Type"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Actions"})]})}),a.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:r.map(e=>(0,a.jsxs)("tr",{className:"hover:bg-blue-100",children:[a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900",children:w?.id===e.id?a.jsx("input",{type:"text",value:w.name,onChange:e=>N({...w,name:e.target.value}),className:"w-full px-2 py-1 border border-gray-300 rounded"}):e.name}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:w?.id===e.id?a.jsx("input",{type:"text",value:w.passkey,onChange:e=>N({...w,passkey:e.target.value.replace(/\D/g,"").slice(0,6)}),className:"w-full px-2 py-1 border border-gray-300 rounded",maxLength:6}):(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx("span",{className:"font-mono",children:e.passkey}),a.jsx("button",{onClick:()=>copyToClipboard(e.passkey),className:`p-1 rounded hover:bg-gray-100 transition-colors ${"green"===t?"text-green-600 hover:text-green-700":"red"===t?"text-red-600 hover:text-red-700":"yellow"===t?"text-yellow-600 hover:text-yellow-700":"text-blue-600 hover:text-blue-700"}`,title:"Copy passkey",children:a.jsx(f.Z,{className:"h-4 w-4"})})]})}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:w?.id===e.id?a.jsx("input",{type:"text",value:w.franchisee||"",onChange:e=>N({...w,franchisee:e.target.value}),className:"w-full px-2 py-1 border border-gray-300 rounded"}):e.franchisee||"N/A"}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:w?.id===e.id?a.jsx("input",{type:"tel",value:w.contact_number||"",onChange:e=>N({...w,contact_number:e.target.value}),className:"w-full px-2 py-1 border border-gray-300 rounded"}):e.contact_number||"N/A"}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900",children:w?.id===e.id?(0,a.jsxs)("label",{className:"flex items-center space-x-2",children:[a.jsx("input",{type:"checkbox",checked:w.company_owned||!1,onChange:e=>N({...w,company_owned:e.target.checked}),className:"h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"}),a.jsx("span",{className:"text-xs text-gray-600",children:"Company Owned"})]}):a.jsx("span",{className:`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${e.company_owned?"bg-blue-100 text-blue-800":"bg-gray-100 text-gray-800"}`,children:e.company_owned?"Company Owned":"Franchise"})}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:a.jsx("div",{className:"flex space-x-2",children:w?.id===e.id?(0,a.jsxs)(a.Fragment,{children:[a.jsx("button",{onClick:()=>handleUpdateLocation(w),className:`p-1 rounded transition-all duration-200 ease-in-out ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-50":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-50":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50":"text-blue-600 hover:text-blue-900 hover:bg-blue-50"}`,title:"Save",children:a.jsx(o.Z,{className:"h-4 w-4"})}),a.jsx("button",{onClick:()=>N(null),className:"p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 ease-in-out",title:"Cancel",children:a.jsx(d.Z,{className:"h-4 w-4"})})]}):(0,a.jsxs)(a.Fragment,{children:[a.jsx("button",{onClick:()=>N(e),className:`p-1 rounded transition-all duration-200 ease-in-out ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-50":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-50":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50":"text-blue-600 hover:text-blue-900 hover:bg-blue-50"}`,title:"Edit",children:a.jsx(c.Z,{className:"h-4 w-4"})}),a.jsx("button",{onClick:()=>handleViewOrderHistory(e),className:"p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out",title:"View Order History",children:a.jsx(b.Z,{className:"h-4 w-4"})}),a.jsx("button",{onClick:()=>handleDeleteLocation(e.id),className:"p-1 rounded text-red-600 hover:text-red-900 hover:bg-red-50 transition-all duration-200 ease-in-out",title:"Delete",children:a.jsx(x.Z,{className:"h-4 w-4"})})]})})})]},e.id))})]})})}),O&&A&&a.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,a.jsxs)("div",{className:"relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[(0,a.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Order Details #",A.id.slice(0,8)]}),(0,a.jsxs)("div",{className:"flex space-x-2",children:[(0,a.jsxs)("button",{onClick:()=>handlePrintReceipt(A),className:`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${"green"===t?"bg-green-100 text-green-700 hover:bg-green-200":"red"===t?"bg-red-100 text-red-700 hover:bg-red-200":"yellow"===t?"bg-yellow-100 text-yellow-700 hover:bg-yellow-200":"bg-blue-100 text-blue-700 hover:bg-blue-200"}`,children:[a.jsx(y.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Print Transfer Sheet"})]}),a.jsx("button",{onClick:()=>{F(!1),E(null)},className:"text-gray-400 hover:text-gray-600",children:a.jsx(d.Z,{className:"h-6 w-6"})})]})]}),(0,a.jsxs)("div",{className:"space-y-6",children:[(0,a.jsxs)("div",{className:"bg-gray-50 rounded-lg p-4",children:[(0,a.jsxs)("div",{className:"grid grid-cols-2 md:grid-cols-5 gap-4 text-center",children:[(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Created Date"}),a.jsx("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:(0,m.iI)(A.created_at,{dateStyle:"short",timeStyle:"short"})})]}),(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Status"}),a.jsx("span",{className:`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${"pending"===A.status?"bg-yellow-100 text-yellow-800":"approved"===A.status?"bg-blue-100 text-blue-800":"released"===A.status?"bg-orange-100 text-orange-800":"paid"===A.status?"bg-purple-100 text-purple-800":"complete"===A.status?"bg-indigo-100 text-indigo-800":"bg-gray-100 text-gray-800"}`,children:A.status.charAt(0).toUpperCase()+A.status.slice(1)})]}),(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Logistics"}),a.jsx("span",{className:`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${"delivery"===A.delivery_type?"bg-blue-100 text-blue-800":"bg-green-100 text-green-800"}`,children:"delivery"===A.delivery_type?"Delivery":"Pickup"})]}),(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Location"}),a.jsx("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:A.location?.name||"N/A"})]}),(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Total Amount"}),(0,a.jsxs)("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:["₱",A.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]}),(0,a.jsxs)("div",{className:"mt-4 pt-4 border-t border-gray-200",children:[(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide mb-2",children:"Category Totals"}),a.jsx("div",{className:"grid grid-cols-2 md:grid-cols-3 gap-2",children:getCategoryTotals(A).map((e,t)=>(0,a.jsxs)("div",{className:"bg-white rounded p-2 border text-center",children:[a.jsx("p",{className:"text-xs font-medium text-gray-900",children:e.category}),(0,a.jsxs)("p",{className:"text-xs text-gray-600",children:[e.totalQuantity," items"]}),(0,a.jsxs)("p",{className:"text-xs font-semibold text-green-600",children:["₱",e.totalAmount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]},t))})]}),(0,a.jsxs)("div",{className:"mt-4 pt-4 border-t border-gray-200",children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide mb-2",children:"Pricing Breakdown"}),(0,a.jsxs)("div",{className:"bg-white rounded p-3 space-y-2",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("span",{className:"text-sm text-gray-600",children:"Subtotal:"}),(0,a.jsxs)("span",{className:"text-sm text-gray-900",children:["₱",getSubtotalAmount(A).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"delivery"===A.delivery_type&&(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("span",{className:"text-sm text-gray-600",children:"Delivery Fee:"}),getSubtotalAmount(A)>=1e4?a.jsx("span",{className:"text-sm text-green-600",children:"FREE (Order over ₱10k)"}):a.jsx("span",{className:"text-sm text-gray-900",children:"+₱500.00"})]}),"pickup"===A.delivery_type&&getSubtotalAmount(A)>=1e4&&(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("span",{className:"text-sm text-gray-600",children:"Pickup Discount (5%):"}),(0,a.jsxs)("span",{className:"text-sm text-green-600",children:["-₱",(.05*getSubtotalAmount(A)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"pickup"===A.delivery_type&&1e4>getSubtotalAmount(A)&&(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("span",{className:"text-sm text-gray-500",children:"Pickup Discount:"}),a.jsx("span",{className:"text-sm text-gray-500",children:"Not available (Order under ₱10k)"})]}),(0,a.jsxs)("div",{className:"flex justify-between items-center border-t pt-2",children:[a.jsx("span",{className:"text-sm font-semibold text-gray-900",children:"Total Amount:"}),(0,a.jsxs)("span",{className:"text-sm font-semibold text-green-600",children:["₱",A.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]})]})]})]}),A.notes&&(0,a.jsxs)("div",{className:"bg-white border rounded-lg p-4",children:[a.jsx("h4",{className:"text-sm font-semibold text-gray-900 mb-2",children:"Notes"}),a.jsx("p",{className:"text-sm text-gray-600",children:A.notes})]}),(0,a.jsxs)("div",{className:"bg-white border rounded-lg overflow-hidden",children:[a.jsx("div",{className:"px-4 py-3 bg-gray-50 border-b",children:a.jsx("h4",{className:"text-sm font-semibold text-gray-900",children:"Order Items"})}),a.jsx("div",{className:"overflow-x-auto",children:(0,a.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[a.jsx("thead",{className:"bg-gray-50",children:(0,a.jsxs)("tr",{children:[a.jsx("th",{className:"px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Product"}),a.jsx("th",{className:"px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"SKU"}),a.jsx("th",{className:"px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Unit"}),a.jsx("th",{className:"px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Qty"}),a.jsx("th",{className:"px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Unit Price"}),a.jsx("th",{className:"px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Total"})]})}),a.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:A.order_details?.map((e,t)=>a.jsxs("tr",{children:[a.jsx("td",{className:"px-4 py-2 text-sm text-gray-900",children:e.product?.name||"N/A"}),a.jsx("td",{className:"px-4 py-2 text-sm text-gray-500",children:e.product?.sku||"N/A"}),a.jsx("td",{className:"px-4 py-2 text-sm text-gray-500",children:e.product?.unit||"N/A"}),a.jsx("td",{className:"px-4 py-2 text-sm text-gray-900",children:e.quantity}),a.jsxs("td",{className:"px-4 py-2 text-sm text-gray-900",children:["₱",e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),a.jsxs("td",{className:"px-4 py-2 text-sm font-medium text-gray-900",children:["₱",(e.unit_price*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]},t))})]})})]})]})]})})]})}var v=r(8260),j=r(1264),w=r(5574);function BillingManager({selectedBrand:e,theme:t="blue"}){let[r,l]=(0,s.useState)([]),[n,o]=(0,s.useState)([]),[c,x]=(0,s.useState)(!1),[u,p]=(0,s.useState)(null),[g,h]=(0,s.useState)(!1),[y,f]=(0,s.useState)(0),[N,k]=(0,s.useState)("month");(0,s.useEffect)(()=>{e&&(fetchPaidOrders(),fetchReleasedOrders(),fetchTotalReceivable())},[e,N]),(0,s.useEffect)(()=>{if(!e)return;let t=i.O.channel("billing-orders-changes").on("postgres_changes",{event:"*",schema:"public",table:"customer_orders",filter:`brand_id=eq.${e.id}`},e=>{console.log("Billing orders realtime update:",e),("UPDATE"===e.eventType||"INSERT"===e.eventType||"DELETE"===e.eventType)&&(fetchPaidOrders(),fetchReleasedOrders(),fetchTotalReceivable())}).subscribe();return()=>{i.O.removeChannel(t)}},[e]);let getDateRange=()=>{let e,t;let r=new Date,a=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}),s=a.formatToParts(r),i=parseInt(s.find(e=>"year"===e.type).value),l=parseInt(s.find(e=>"month"===e.type).value)-1,n=parseInt(s.find(e=>"day"===e.type).value);switch(N){case"day":default:e=new Date(i,l,n,0,0,0),t=new Date(i,l,n,23,59,59,999);break;case"week":let d=new Date(i,l,n-6);e=new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0),t=new Date(i,l,n,23,59,59,999);break;case"month":e=new Date(i,l,1,0,0,0);let o=new Date(i,l+1,0).getDate();t=new Date(i,l,o,23,59,59,999);break;case"year":e=new Date(i,0,1,0,0,0),t=new Date(i,11,31,23,59,59,999)}return{start:e.toISOString(),end:t.toISOString()}},fetchPaidOrders=async()=>{if(e){x(!0);try{let{start:t,end:r}=getDateRange(),{data:a,error:s}=await i.O.from("customer_orders").select(`
          *,
          location:locations(*),
          brand:brands(*),
          order_details(
            *,
            product:products(id, name, sku, unit, category)
          )
        `).eq("brand_id",e.id).in("status",["paid","complete"]).gte("created_at",t).lte("created_at",r).order("created_at",{ascending:!1});if(s){console.error("Error fetching paid orders:",s);return}a&&l(a)}catch(e){console.error("Error fetching paid orders:",e)}finally{x(!1)}}},fetchReleasedOrders=async()=>{if(e)try{let{data:t,error:r}=await i.O.from("customer_orders").select(`
          *,
          location:locations(*),
          brand:brands(*),
          order_details(
            *,
            product:products(id, name, sku, unit, category)
          )
        `).eq("brand_id",e.id).eq("status","released").order("created_at",{ascending:!1});if(r)throw r;t&&o(t)}catch(e){console.error("Error fetching released orders:",e)}},fetchTotalReceivable=async()=>{if(e)try{let{data:t,error:r}=await i.O.from("customer_orders").select("total_amount").eq("brand_id",e.id).eq("status","released");if(r)throw r;let a=t?.reduce((e,t)=>e+(t.total_amount||0),0)||0;f(a)}catch(e){console.error("Error fetching receivables:",e)}},handleMarkComplete=async e=>{if(confirm("Are you sure you want to mark this order as complete?"))try{let{error:t}=await i.O.from("customer_orders").update({status:"complete",updated_at:new Date().toISOString()}).eq("id",e);if(t){console.error("Error updating order:",t),alert("Error updating order");return}l(t=>t.filter(t=>t.id!==e)),u?.id===e&&(h(!1),p(null))}catch(e){console.error("Error updating order:",e),alert("Error updating order")}},handleViewDetails=e=>{p(e),h(!0)},getTotalItems=e=>e.order_details?.reduce((e,t)=>e+t.quantity,0)||0,getSubtotalAmount=e=>e.order_details?.reduce((e,t)=>e+t.unit_price*t.quantity,0)||0;return(0,a.jsxs)("div",{className:"space-y-6",children:[a.jsx("div",{className:"flex justify-between items-center",children:(0,a.jsxs)("div",{children:[a.jsx("h3",{className:"text-xl font-semibold text-gray-900",children:"Billing Manager"}),a.jsx("p",{className:"text-gray-600",children:"Track unpaid orders and manage paid orders by status"})]})}),a.jsx("div",{className:"bg-white rounded-lg shadow-sm border p-4",children:(0,a.jsxs)("div",{className:"flex items-center space-x-4",children:[a.jsx("label",{className:"text-sm font-medium text-gray-700",children:"Time Period:"}),a.jsx("div",{className:"flex space-x-2",children:["day","week","month","year"].map(e=>a.jsx("button",{onClick:()=>k(e),className:`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${N===e?"green"===t?"bg-green-100 text-green-700 border border-green-300":"red"===t?"bg-red-100 text-red-700 border border-red-300":"yellow"===t?"bg-yellow-100 text-yellow-700 border border-yellow-300":"bg-blue-100 text-blue-700 border border-blue-300":"bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"}`,children:e.charAt(0).toUpperCase()+e.slice(1)},e))})]})}),(0,a.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:[a.jsx("h4",{className:"text-lg font-medium mb-4",children:"Summary"}),(0,a.jsxs)("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-4",children:[(0,a.jsxs)("div",{className:"bg-green-50 p-4 rounded-lg",children:[a.jsx("p",{className:"text-sm text-green-600 font-medium",children:"Total Revenue"}),(0,a.jsxs)("p",{className:"text-2xl font-bold text-green-900",children:["₱",r.reduce((e,t)=>e+(t.total_amount||0),0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,a.jsxs)("p",{className:"text-xs text-green-700 mt-1",children:[r.length," paid orders"]})]}),(0,a.jsxs)("div",{className:"bg-blue-50 p-4 rounded-lg",children:[a.jsx("p",{className:"text-sm text-blue-600 font-medium",children:"Total Paid"}),(0,a.jsxs)("p",{className:"text-2xl font-bold text-blue-900",children:["₱",r.reduce((e,t)=>e+(t.total_amount||0),0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),a.jsx("p",{className:"text-xs text-blue-700 mt-1",children:"Ready for completion"})]}),(0,a.jsxs)("div",{className:"bg-orange-50 p-4 rounded-lg",children:[a.jsx("p",{className:"text-sm text-orange-600 font-medium",children:"Total Receivable"}),(0,a.jsxs)("p",{className:"text-2xl font-bold text-orange-900",children:["₱",y.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,a.jsxs)("p",{className:"text-xs text-orange-700 mt-1",children:[n.length," unpaid orders"]})]})]})]}),n.length>0&&(0,a.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden",children:[a.jsx("div",{className:"px-6 py-4 border-b border-gray-200 bg-orange-50",children:a.jsx("h4",{className:"text-lg font-medium text-orange-900",children:"Unpaid Orders (Receivable)"})}),a.jsx("div",{className:"overflow-x-auto overflow-y-visible",children:(0,a.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[a.jsx("thead",{className:"bg-gray-50",children:(0,a.jsxs)("tr",{children:[a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Order ID"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Date"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Location"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Amount"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Items"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Status"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Actions"})]})}),a.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:n.map(e=>(0,a.jsxs)("tr",{className:"hover:bg-orange-50",children:[(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-middle",children:[e.id.slice(0,8),"..."]}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:(0,m.iI)(e.created_at,{dateStyle:"short"})}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:e.location?.name||"N/A"}),(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600 align-middle",children:["₱",e.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:[getTotalItems(e)," items"]}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap align-middle",children:a.jsx("span",{className:"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800",children:"Awaiting Payment"})}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle",children:a.jsx("div",{className:"flex space-x-2 items-center",children:a.jsx("button",{onClick:()=>handleViewDetails(e),className:"p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out",title:"View Details",children:a.jsx(b.Z,{className:"h-4 w-4"})})})})]},e.id))})]})})]}),(0,a.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border overflow-hidden",children:[a.jsx("div",{className:"px-6 py-4 border-b border-gray-200 bg-blue-50",children:a.jsx("h4",{className:"text-lg font-medium text-blue-900",children:"Paid & Completed Orders"})}),c?a.jsx("div",{className:"flex items-center justify-center py-12",children:a.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"})}):0===r.length?(0,a.jsxs)("div",{className:"p-12 text-center",children:[a.jsx(v.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),a.jsx("h3",{className:"text-lg font-medium text-gray-900 mb-2",children:"No Paid Orders"}),a.jsx("p",{className:"text-gray-600",children:"There are no paid or completed orders in the selected time period."})]}):a.jsx("div",{className:"overflow-x-auto",children:(0,a.jsxs)("table",{className:"min-w-full divide-y divide-gray-200 table-fixed",children:[a.jsx("thead",{className:"bg-gray-50",children:(0,a.jsxs)("tr",{children:[a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Order ID"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Date"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32",children:"Location"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Status"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28",children:"Amount"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Items"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24",children:"Deposit Slip"}),a.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20",children:"Actions"})]})}),a.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:r.map(e=>(0,a.jsxs)("tr",{className:"hover:bg-blue-50",children:[(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-middle",children:[e.id.slice(0,8),"..."]}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:(0,m.iI)(e.created_at,{dateStyle:"short"})}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:e.location?.name||"N/A"}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap align-middle",children:a.jsx("span",{className:`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${"paid"===e.status?"bg-purple-100 text-purple-800":"complete"===e.status?"bg-indigo-100 text-indigo-800":"bg-gray-100 text-gray-800"}`,children:e.status.charAt(0).toUpperCase()+e.status.slice(1)})}),(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 align-middle",children:["₱",e.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,a.jsxs)("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle",children:[getTotalItems(e)," items"]}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle",children:e.deposit_slip_url?a.jsx("a",{href:e.deposit_slip_url,target:"_blank",rel:"noopener noreferrer",className:"text-blue-600 hover:text-blue-800",children:"View"}):a.jsx("span",{className:"text-gray-400",children:"No slip"})}),a.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle",children:(0,a.jsxs)("div",{className:"flex space-x-2 items-center",children:[a.jsx("button",{onClick:()=>handleViewDetails(e),className:"p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200 ease-in-out",title:"View Details",children:a.jsx(b.Z,{className:"h-4 w-4"})}),"paid"===e.status&&a.jsx("button",{onClick:()=>handleMarkComplete(e.id),className:`p-1 rounded transition-all duration-200 ease-in-out ${"green"===t?"text-green-600 hover:text-green-900 hover:bg-green-50":"red"===t?"text-red-600 hover:text-red-900 hover:bg-red-50":"yellow"===t?"text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50":"text-blue-600 hover:text-blue-900 hover:bg-blue-50"}`,title:"Mark Complete",children:a.jsx(j.Z,{className:"h-4 w-4"})})]})})]},e.id))})]})})]}),0===n.length&&0===r.length&&!c&&(0,a.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-12 text-center",children:[a.jsx(v.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),a.jsx("h3",{className:"text-lg font-medium text-gray-900 mb-2",children:"No Billing Activity"}),a.jsx("p",{className:"text-gray-600",children:"There are no paid or unpaid orders to manage."})]}),g&&u&&a.jsx("div",{className:"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50",children:(0,a.jsxs)("div",{className:"relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center mb-4",children:[(0,a.jsxs)("h3",{className:"text-lg font-semibold text-gray-900",children:["Order Details #",u.id.slice(0,8)]}),a.jsx("div",{className:"flex space-x-2",children:a.jsx("button",{onClick:()=>{h(!1),p(null)},className:"text-gray-400 hover:text-gray-600",children:a.jsx(d.Z,{className:"h-6 w-6"})})})]}),(0,a.jsxs)("div",{className:"space-y-6",children:[(0,a.jsxs)("div",{className:"bg-gray-50 rounded-lg p-4",children:[(0,a.jsxs)("div",{className:"grid grid-cols-2 md:grid-cols-5 gap-4 text-center",children:[(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Created Date"}),a.jsx("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:(0,m.iI)(u.created_at,{dateStyle:"short",timeStyle:"short"})})]}),(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Status"}),a.jsx("span",{className:`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${"paid"===u.status?"bg-purple-100 text-purple-800":"complete"===u.status?"bg-indigo-100 text-indigo-800":"bg-gray-100 text-gray-800"}`,children:u.status.charAt(0).toUpperCase()+u.status.slice(1)})]}),(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Logistics"}),a.jsx("span",{className:`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${"delivery"===u.delivery_type?"bg-blue-100 text-blue-800":"bg-green-100 text-green-800"}`,children:"delivery"===u.delivery_type?"Delivery":"Pickup"})]}),(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Location"}),a.jsx("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:u.location?.name||"N/A"})]}),(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide",children:"Total Amount"}),(0,a.jsxs)("p",{className:"text-sm font-semibold text-gray-900 mt-1",children:["₱",u.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]}),(0,a.jsxs)("div",{className:"mt-4 pt-4 border-t border-gray-200",children:[(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide mb-2",children:"Category Totals"}),a.jsx("div",{className:"grid grid-cols-2 md:grid-cols-3 gap-2",children:(e=>{if(!e.order_details)return[];let t=new Map;return e.order_details.forEach(e=>{console.log("Product data:",e.product);let r=e.product?.category&&""!==e.product.category.trim()?e.product.category:"Uncategorized";t.has(r)||t.set(r,{category:r,totalQuantity:0,totalAmount:0});let a=t.get(r);a.totalQuantity+=e.quantity,a.totalAmount+=e.unit_price*e.quantity}),Array.from(t.values())})(u).map((e,t)=>(0,a.jsxs)("div",{className:"bg-white rounded p-2 border text-center",children:[a.jsx("p",{className:"text-xs font-medium text-gray-900",children:e.category}),(0,a.jsxs)("p",{className:"text-xs text-gray-600",children:[e.totalQuantity," items"]}),(0,a.jsxs)("p",{className:"text-xs font-semibold text-green-600",children:["₱",e.totalAmount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]},t))})]}),(0,a.jsxs)("div",{className:"mt-4 pt-4 border-t border-gray-200",children:[a.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide mb-2",children:"Pricing Breakdown"}),(0,a.jsxs)("div",{className:"bg-white rounded p-3 space-y-2",children:[(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("span",{className:"text-sm text-gray-600",children:"Subtotal:"}),(0,a.jsxs)("span",{className:"text-sm text-gray-900",children:["₱",getSubtotalAmount(u).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"delivery"===u.delivery_type&&(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("span",{className:"text-sm text-gray-600",children:"Delivery Fee:"}),getSubtotalAmount(u)>=1e4?a.jsx("span",{className:"text-sm text-green-600",children:"FREE (Order over ₱10k)"}):a.jsx("span",{className:"text-sm text-gray-900",children:"+₱500.00"})]}),"pickup"===u.delivery_type&&getSubtotalAmount(u)>=1e4&&(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("span",{className:"text-sm text-gray-600",children:"Pickup Discount (5%):"}),(0,a.jsxs)("span",{className:"text-sm text-green-600",children:["-₱",(.05*getSubtotalAmount(u)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]}),"pickup"===u.delivery_type&&1e4>getSubtotalAmount(u)&&(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[a.jsx("span",{className:"text-sm text-gray-500",children:"Pickup Discount:"}),a.jsx("span",{className:"text-sm text-gray-500",children:"Not available (Order under ₱10k)"})]}),(0,a.jsxs)("div",{className:"flex justify-between items-center border-t pt-2",children:[a.jsx("span",{className:"text-sm font-semibold text-gray-900",children:"Total Amount:"}),(0,a.jsxs)("span",{className:"text-sm font-semibold text-green-600",children:["₱",u.total_amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]})]})]})]})]}),u.deposit_slip_url&&(0,a.jsxs)("div",{className:"bg-white border rounded-lg p-4",children:[(0,a.jsxs)("h4",{className:"text-sm font-semibold text-gray-900 mb-3 flex items-center",children:[a.jsx(w.Z,{className:"h-4 w-4 mr-2"}),"Deposit Slip"]}),(0,a.jsxs)("div",{className:"flex items-center space-x-4",children:[a.jsx("img",{src:u.deposit_slip_url,alt:"Deposit Slip",className:"w-20 h-20 object-cover rounded border"}),(0,a.jsxs)("div",{children:[a.jsx("p",{className:"text-sm text-gray-600",children:"Deposit slip uploaded"}),(0,a.jsxs)("a",{href:u.deposit_slip_url,target:"_blank",rel:"noopener noreferrer",className:"inline-flex items-center text-blue-600 hover:text-blue-800 text-sm mt-1",children:[a.jsx(b.Z,{className:"h-3 w-3 mr-1"}),"View full size"]})]})]})]}),u.order_details&&u.order_details.length>0&&(0,a.jsxs)("div",{className:"bg-white border rounded-lg overflow-hidden",children:[a.jsx("div",{className:"px-4 py-3 bg-gray-50 border-b",children:(0,a.jsxs)("h4",{className:"text-sm font-semibold text-gray-900",children:["Order Items (",u.order_details.length,")"]})}),a.jsx("div",{className:"overflow-x-auto",children:(0,a.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[a.jsx("thead",{className:"bg-gray-50",children:(0,a.jsxs)("tr",{children:[a.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Product"}),a.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Quantity"}),a.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Unit Price"}),a.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",children:"Total"})]})}),a.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:u.order_details.map(e=>(0,a.jsxs)("tr",{className:"hover:bg-gray-50",children:[a.jsx("td",{className:"px-4 py-3 whitespace-nowrap",children:(0,a.jsxs)("div",{children:[a.jsx("div",{className:"text-sm font-medium text-gray-900",children:e.product.name}),e.product.sku&&(0,a.jsxs)("div",{className:"text-xs text-gray-500",children:["SKU: ",e.product.sku]})]})}),(0,a.jsxs)("td",{className:"px-4 py-3 whitespace-nowrap text-sm text-gray-900",children:[e.quantity," ",e.product.unit]}),(0,a.jsxs)("td",{className:"px-4 py-3 whitespace-nowrap text-sm text-gray-900",children:["₱",e.unit_price.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]}),(0,a.jsxs)("td",{className:"px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900",children:["₱",(e.unit_price*e.quantity).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})]})]},e.id))})]})})]})]})]})})]})}var N=r(1910),k=r(1922),_=r(4904),S=r(279);function LogisticsManager({selectedBrand:e,theme:t="blue"}){let[r,l]=(0,s.useState)(new Date),[o,c]=(0,s.useState)([]),[x,m]=(0,s.useState)([]),[u,p]=(0,s.useState)(!1),[g,h]=(0,s.useState)({x:0,y:0}),[b,y]=(0,s.useState)(""),[f,v]=(0,s.useState)("morning"),[j,w]=(0,s.useState)(!1);(0,s.useEffect)(()=>{e&&(fetchAssignments(),fetchAvailableOrders())},[e,r]);let fetchAssignments=async()=>{if(e){w(!0);try{let e=new Date(r.getFullYear(),r.getMonth(),1),t=new Date(r.getFullYear(),r.getMonth()+1,0),{data:a,error:s}=await i.O.from("logistics_assignments").select(`
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
        `).gte("date",e.toISOString().split("T")[0]).lte("date",t.toISOString().split("T")[0]).order("date",{ascending:!0});if(s){console.error("Error fetching assignments:",s);return}c(a||[])}catch(e){console.error("Error fetching assignments:",e)}finally{w(!1)}}},fetchAvailableOrders=async()=>{if(e)try{let{data:t,error:r}=await i.O.from("customer_orders").select(`
           id,
           customer_name,
           total_amount,
           delivery_type,
           status,
           created_at,
           brand_id,
           brand:brands(name),
           location:locations(name)
         `).eq("brand_id",e.id).in("status",["pending","approved","released","paid"]).order("created_at",{ascending:!1});if(r){console.error("Error fetching orders:",r);return}console.log("Fetched orders:",t),m(t||[])}catch(e){console.error("Error fetching orders:",e)}},handleCreateAssignment=async(e,t,r)=>{try{let{data:a,error:s}=await i.O.from("logistics_assignments").insert({order_id:e,date:t,time_slot:r,status:"scheduled",notes:null}).select();if(s){console.error("Error creating assignment:",s);return}await fetchAssignments()}catch(e){console.error("Error creating assignment:",e)}},handleDeleteAssignment=async e=>{if(confirm("Are you sure you want to delete this assignment?"))try{let{error:t}=await i.O.from("logistics_assignments").delete().eq("id",e);if(t){console.error("Error deleting assignment:",t);return}await fetchAssignments()}catch(e){console.error("Error deleting assignment:",e)}},getAssignmentsForDate=(e,t)=>o.filter(r=>r.date===e&&r.time_slot===t),getCalendarBrandColor=(e,t)=>{let r={mychoice:{morning:"bg-green-100 border-green-400",afternoon:"bg-green-100 border-green-400 border-l-4"},"mang sorbetes":{morning:"bg-yellow-100 border-yellow-400",afternoon:"bg-yellow-100 border-yellow-400 border-l-4"},gelatofilipino:{morning:"bg-red-100 border-red-400",afternoon:"bg-red-100 border-red-400 border-l-4"}},a=t?.toLowerCase();if(a&&r[a])return console.log(`Brand: ${t} -> Custom color`),r[a];let s=t||e,i=0;for(let e=0;e<s.length;e++)i=(i<<5)-i+s.charCodeAt(e)&4294967295;let l=Math.abs(i)%3;switch(console.log(`Brand: ${t||e} -> Hash color (index: ${l})`),l){case 0:return{morning:"bg-blue-100 border-blue-400",afternoon:"bg-blue-100 border-blue-400 border-l-4"};case 1:return{morning:"bg-purple-100 border-purple-400",afternoon:"bg-purple-100 border-purple-400 border-l-4"};default:return{morning:"bg-gray-100 border-gray-400",afternoon:"bg-gray-100 border-gray-400 border-l-4"}}},navigateMonth=e=>{l(t=>{let r=new Date(t);return"prev"===e?r.setMonth(t.getMonth()-1):r.setMonth(t.getMonth()+1),r})},openOrderPopup=async(e,t,r)=>{y(t),v(r),h({x:e.clientX,y:e.clientY}),await fetchAssignments(),p(!0)},formatDate=e=>e.toISOString().split("T")[0],isToday=e=>{let t=new Date;return e.toDateString()===t.toDateString()},isPastDate=e=>{let t=new Date;t.setHours(0,0,0,0);let r=new Date(e);return r.setHours(0,0,0,0),r<t};return(0,a.jsxs)("div",{className:"space-y-6",children:[a.jsx("div",{className:"flex justify-between items-center",children:(0,a.jsxs)("div",{children:[a.jsx("h3",{className:"text-xl font-semibold text-gray-900",children:"Logistics Manager"}),a.jsx("p",{className:"text-gray-600",children:"Schedule and manage order deliveries"})]})}),(0,a.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border p-6",children:[(0,a.jsxs)("div",{className:"flex items-center justify-between mb-6",children:[a.jsx("button",{onClick:()=>navigateMonth("prev"),className:"p-2 rounded-lg hover:bg-gray-100 transition-colors",children:a.jsx(N.Z,{className:"h-5 w-5 text-gray-600"})}),a.jsx("h2",{className:"text-xl font-semibold text-gray-900",children:r.toLocaleDateString("en-US",{month:"long",year:"numeric"})}),a.jsx("button",{onClick:()=>navigateMonth("next"),className:"p-2 rounded-lg hover:bg-gray-100 transition-colors",children:a.jsx(k.Z,{className:"h-5 w-5 text-gray-600"})})]}),(0,a.jsxs)("div",{className:"grid grid-cols-7 gap-1",children:[["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(e=>a.jsx("div",{className:"p-3 text-center text-sm font-medium text-gray-500 bg-gray-50 rounded-lg",children:e},e)),(()=>{let e=r.getFullYear(),t=r.getMonth(),a=new Date(e,t,1),s=new Date(e,t+1,0),i=s.getDate(),l=a.getDay(),n=[];for(let e=0;e<l;e++)n.push(null);for(let r=1;r<=i;r++)n.push(new Date(e,t,r));return n})().map((e,t)=>{if(!e)return a.jsx("div",{className:"p-3"},t);let r=formatDate(e),s=getAssignmentsForDate(r,"morning"),i=getAssignmentsForDate(r,"afternoon"),l=isToday(e),o=isPastDate(e);return(0,a.jsxs)("div",{className:`p-2 border rounded-lg min-h-[120px] ${o?"bg-gray-100 border-gray-300 opacity-60":l?"bg-blue-50 border-blue-200":"bg-white border-gray-200"}`,children:[a.jsx("div",{className:"text-sm font-medium text-gray-900 mb-2",children:e.getDate()}),(0,a.jsxs)("div",{className:"mb-2",children:[(0,a.jsxs)("div",{className:"flex items-center justify-between mb-1",children:[(0,a.jsxs)("div",{className:"flex items-center gap-1",children:[a.jsx(_.Z,{className:"h-3 w-3 text-yellow-500"}),a.jsx("span",{className:"text-xs text-gray-500",children:"Morning"})]}),a.jsx("button",{onClick:e=>!o&&openOrderPopup(e,r,"morning"),disabled:o,className:`text-xs ${o?"text-gray-400 cursor-not-allowed":"text-blue-600 hover:text-blue-800"}`,children:a.jsx(n.Z,{className:"h-3 w-3 text-gray-600"})})]}),a.jsx("div",{className:"space-y-1",children:s.map(e=>{let t=getCalendarBrandColor(e.order?.brand_id||"",e.order?.brand?.name);return(0,a.jsxs)("div",{className:`text-xs p-1 ${t.morning} rounded border-l-2 flex items-center justify-between group`,children:[(0,a.jsxs)("div",{className:"flex-1 min-w-0",children:[a.jsx("div",{className:"font-medium truncate",children:e.order?.location?.name}),a.jsx("div",{className:"text-gray-600",children:e.order?.created_at?new Date(e.order.created_at).toLocaleDateString():"No Date"})]}),a.jsx("button",{onClick:()=>handleDeleteAssignment(e.id),className:"ml-1 p-0.5 text-red-600 hover:text-red-800 hover:bg-red-200 rounded opacity-0 group-hover:opacity-100 transition-opacity",title:"Remove assignment",children:a.jsx(d.Z,{className:"h-3 w-3"})})]},e.id)})})]}),(0,a.jsxs)("div",{children:[(0,a.jsxs)("div",{className:"flex items-center justify-between mb-1",children:[(0,a.jsxs)("div",{className:"flex items-center gap-1",children:[a.jsx(S.Z,{className:"h-3 w-3 text-blue-500"}),a.jsx("span",{className:"text-xs text-gray-500",children:"Afternoon"})]}),a.jsx("button",{onClick:e=>!o&&openOrderPopup(e,r,"afternoon"),disabled:o,className:`text-xs ${o?"text-gray-400 cursor-not-allowed":"text-blue-600 hover:text-blue-800"}`,children:a.jsx(n.Z,{className:"h-3 w-3 text-gray-600"})})]}),a.jsx("div",{className:"space-y-1",children:i.map(e=>{let t=getCalendarBrandColor(e.order?.brand_id||"",e.order?.brand?.name);return(0,a.jsxs)("div",{className:`text-xs p-1 ${t.afternoon} rounded border-l-2 flex items-center justify-between group`,children:[(0,a.jsxs)("div",{className:"flex-1 min-w-0",children:[a.jsx("div",{className:"font-medium truncate",children:e.order?.location?.name}),a.jsx("div",{className:"text-gray-600",children:e.order?.created_at?new Date(e.order.created_at).toLocaleDateString():"No Date"})]}),a.jsx("button",{onClick:()=>handleDeleteAssignment(e.id),className:"ml-1 p-0.5 text-red-600 hover:text-red-800 hover:bg-red-200 rounded opacity-0 group-hover:opacity-100 transition-opacity",title:"Remove assignment",children:a.jsx(d.Z,{className:"h-3 w-3"})})]},e.id)})})]})]},t)})]})]}),u&&a.jsx("div",{className:"fixed inset-0 z-50",onClick:()=>p(!1),children:(0,a.jsxs)("div",{className:"absolute bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm max-h-80 overflow-y-auto",style:{left:Math.min(g.x,window.innerWidth-320),top:Math.min(g.y,window.innerHeight-200)},onClick:e=>e.stopPropagation(),children:[(0,a.jsxs)("div",{className:"flex justify-between items-center mb-3",children:[(0,a.jsxs)("h3",{className:"text-sm font-semibold text-gray-900",children:["Select Order - ","morning"===f?"Morning":"Afternoon"]}),a.jsx("button",{onClick:()=>p(!1),className:"text-gray-400 hover:text-gray-600",children:a.jsx(d.Z,{className:"h-4 w-4"})})]}),a.jsx("div",{className:"space-y-2",children:(()=>{let r=o.map(e=>e.order_id),s=x.filter(e=>!r.includes(e.id));return console.log("Available orders:",x),console.log("All assignments:",o),console.log("Assigned order IDs:",r),console.log("Unassigned orders:",s),console.log("Selected brand:",e),0===s.length?a.jsx("p",{className:"text-sm text-gray-500",children:"No available orders"}):s.map(e=>(0,a.jsxs)("button",{onClick:()=>{handleCreateAssignment(e.id,b,f),p(!1)},className:"w-full text-left p-2 hover:bg-gray-100 rounded border border-gray-200",children:[(0,a.jsxs)("div",{className:"flex items-center justify-between mb-1",children:[a.jsx("div",{className:"text-sm font-medium text-gray-900",children:e.location?.name}),a.jsx("span",{className:`px-2 py-1 text-xs rounded-full ${(()=>{let e=t||"";return"green"===e?"bg-green-100 text-green-800":"red"===e?"bg-red-100 text-red-800":"yellow"===e?"bg-yellow-100 text-yellow-800":"blue"===e?"bg-blue-100 text-blue-800":"purple"===e?"bg-purple-100 text-purple-800":"bg-gray-100 text-gray-800"})()}`,children:e.brand?.name||"Unknown"})]}),(0,a.jsxs)("div",{className:"text-xs text-gray-600",children:[e.created_at?new Date(e.created_at).toLocaleDateString():"No Date"," - #",e.id.slice(-8)]})]},e.id))})()})]})})]})}var D=r(3294),P=r(5642),C=r(7004),O=r(7094);function DashboardPage(){let[e,t]=(0,s.useState)(!1),[r,i]=(0,s.useState)(""),[l,n]=(0,s.useState)(null),[d,o]=(0,s.useState)("products"),[c,x]=(0,s.useState)(""),[m,u]=(0,s.useState)(0),[g,b]=(0,s.useState)(!0);(0,s.useEffect)(()=>{let initializeDashboard=async()=>{b(!0);let e=localStorage.getItem("dashboard_authenticated"),r=localStorage.getItem("dashboard_selected_brand"),a=localStorage.getItem("dashboard_active_tab");if("true"===e&&t(!0),r)try{n(JSON.parse(r))}catch(e){console.error("Error parsing saved brand:",e)}a&&["products","orders","branches","billing","logistics"].includes(a)&&o(a),setTimeout(()=>{b(!1)},800)};initializeDashboard()},[]),(0,s.useEffect)(()=>{l?localStorage.setItem("dashboard_selected_brand",JSON.stringify(l)):localStorage.removeItem("dashboard_selected_brand")},[l]),(0,s.useEffect)(()=>{localStorage.setItem("dashboard_active_tab",d)},[d]);let y=(e=>{if(!e)return"blue";switch(e.slug){case"mychoice":return"green";case"gelatofilipino":return"red";case"mang-sorbetes":return"yellow";default:return"blue"}})(l);return g?a.jsx("div",{className:"min-h-screen bg-gray-50 flex items-center justify-center",children:(0,a.jsxs)("div",{className:"text-center",children:[a.jsx("div",{className:`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 ${"green"===y?"bg-green-100":"red"===y?"bg-red-100":"yellow"===y?"bg-yellow-100":"bg-blue-100"}`,children:a.jsx("div",{className:`animate-spin rounded-full h-8 w-8 border-b-2 ${"green"===y?"border-green-600":"red"===y?"border-red-600":"yellow"===y?"border-yellow-600":"border-blue-600"}`})}),a.jsx("h2",{className:"text-xl font-semibold text-gray-900 mb-2",children:"Loading Dashboard"}),a.jsx("p",{className:"text-gray-600",children:"Please wait while we check your session..."})]})}):e?(0,a.jsxs)("div",{className:"min-h-screen bg-gray-50",children:[a.jsx("div",{className:"bg-white shadow-sm border-b",children:a.jsx("div",{className:"max-w-7xl mx-auto px-4 py-4",children:(0,a.jsxs)("div",{className:"flex justify-between items-center",children:[(0,a.jsxs)("div",{className:"flex items-center space-x-4",children:[(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx(C.Z,{className:`h-8 w-8 ${"green"===y?"text-green-600":"red"===y?"text-red-600":"yellow"===y?"text-yellow-600":"text-blue-600"}`}),a.jsx("h1",{className:"text-2xl font-bold text-gray-900",children:"GFC Portal"}),l&&a.jsx("span",{className:`px-3 py-1 rounded-full text-sm font-medium ${"green"===y?"bg-green-100 text-green-800":"red"===y?"bg-red-100 text-red-800":"yellow"===y?"bg-yellow-100 text-yellow-800":"bg-blue-100 text-blue-800"}`,children:l.name})]}),(0,a.jsxs)("div",{className:"flex items-center space-x-1 text-sm text-gray-500",children:[a.jsx("div",{className:"w-2 h-2 bg-green-500 rounded-full"}),a.jsx("span",{children:"Admin Access"})]})]}),a.jsx("div",{className:"flex items-center space-x-4",children:(0,a.jsxs)("button",{onClick:()=>{t(!1),i(""),n(null),o("products"),b(!1),localStorage.removeItem("dashboard_authenticated"),localStorage.removeItem("dashboard_selected_brand"),localStorage.removeItem("dashboard_active_tab")},className:"flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors",children:[a.jsx(D.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Logout"})]})})]})})}),(0,a.jsxs)("div",{className:"max-w-7xl mx-auto px-4 py-8",children:[a.jsx("div",{className:"mb-6",children:a.jsx("div",{className:"bg-white rounded-lg shadow-sm border p-4",children:(0,a.jsxs)("div",{className:"flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4",children:[a.jsx("div",{className:"flex-1 max-w-xs",children:a.jsx(BrandSelector,{onBrandChange:n})}),a.jsx("div",{className:"flex-1",children:a.jsx("div",{className:"border-b border-gray-200",children:(0,a.jsxs)("nav",{className:"-mb-px flex space-x-8",children:[a.jsx("button",{onClick:()=>o("products"),className:`py-2 px-1 border-b-2 font-medium text-sm ${"products"===d?"green"===y?"border-green-500 text-green-600":"red"===y?"border-red-500 text-red-600":"yellow"===y?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx(C.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Products & Inventory"})]})}),a.jsx("button",{onClick:()=>o("orders"),className:`py-2 px-1 border-b-2 font-medium text-sm ${"orders"===d?"green"===y?"border-green-500 text-green-600":"red"===y?"border-red-500 text-red-600":"yellow"===y?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx(h.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Customer Orders"})]})}),a.jsx("button",{onClick:()=>o("branches"),className:`py-2 px-1 border-b-2 font-medium text-sm ${"branches"===d?"green"===y?"border-green-500 text-green-600":"red"===y?"border-red-500 text-red-600":"yellow"===y?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx(O.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Branches"})]})}),a.jsx("button",{onClick:()=>o("billing"),className:`py-2 px-1 border-b-2 font-medium text-sm ${"billing"===d?"green"===y?"border-green-500 text-green-600":"red"===y?"border-red-500 text-red-600":"yellow"===y?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx(v.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Billing"})]})}),a.jsx("button",{onClick:()=>o("logistics"),className:`py-2 px-1 border-b-2 font-medium text-sm ${"logistics"===d?"green"===y?"border-green-500 text-green-600":"red"===y?"border-red-500 text-red-600":"yellow"===y?"border-yellow-500 text-yellow-600":"border-blue-500 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,children:(0,a.jsxs)("div",{className:"flex items-center space-x-2",children:[a.jsx(p.Z,{className:"h-4 w-4"}),a.jsx("span",{children:"Logistics"})]})})]})})})]})})}),(0,a.jsxs)("div",{className:"bg-white rounded-lg shadow-sm border",children:["products"===d&&l&&a.jsx("div",{className:"p-6",children:a.jsx(ProductManager,{selectedBrand:l,theme:y},m)}),"orders"===d&&a.jsx("div",{className:"p-6",children:a.jsx(OrderManager,{selectedBrand:l,onOrderUpdate:()=>{u(e=>e+1)},theme:y},m)}),"branches"===d&&l&&a.jsx("div",{className:"p-6",children:a.jsx(BranchManager,{selectedBrand:l,theme:y},m)}),!l&&"branches"===d&&(0,a.jsxs)("div",{className:"p-6 text-center py-12",children:[a.jsx(O.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),a.jsx("p",{className:"text-gray-600",children:"Please select a brand to manage branches"})]}),"billing"===d&&l&&a.jsx("div",{className:"p-6",children:a.jsx(BillingManager,{selectedBrand:l,theme:y},m)}),!l&&"billing"===d&&(0,a.jsxs)("div",{className:"p-6 text-center py-12",children:[a.jsx(v.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),a.jsx("p",{className:"text-gray-600",children:"Please select a brand to manage billing"})]}),"logistics"===d&&l&&a.jsx("div",{className:"p-6",children:a.jsx(LogisticsManager,{selectedBrand:l,theme:y},m)}),!l&&"logistics"===d&&(0,a.jsxs)("div",{className:"p-6 text-center py-12",children:[a.jsx(p.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),a.jsx("p",{className:"text-gray-600",children:"Please select a brand to manage logistics"})]}),!l&&"products"===d&&(0,a.jsxs)("div",{className:"p-6 text-center py-12",children:[a.jsx(C.Z,{className:"h-12 w-12 text-gray-400 mx-auto mb-4"}),a.jsx("p",{className:"text-gray-600",children:"Please select a brand to manage products"})]})]})]})]}):(0,a.jsxs)("div",{className:"min-h-screen bg-gray-50 flex flex-col items-center justify-center",children:[(0,a.jsxs)("div",{className:"max-w-md w-full bg-white rounded-lg shadow-md p-8",children:[(0,a.jsxs)("div",{className:"text-center mb-8",children:[a.jsx("div",{className:"mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4",children:a.jsx(D.Z,{className:"h-6 w-6 text-blue-600"})}),a.jsx("h2",{className:"text-2xl font-bold text-gray-900",children:"Admin Dashboard"}),a.jsx("p",{className:"text-gray-600 mt-2",children:"Enter passcode to access inventory management"})]}),(0,a.jsxs)("form",{onSubmit:e=>{e.preventDefault(),"john101797"===r?(t(!0),localStorage.setItem("dashboard_authenticated","true"),x("")):(x("Invalid passcode. Please try again."),i(""))},className:"space-y-6",children:[(0,a.jsxs)("div",{children:[a.jsx("label",{htmlFor:"passcode",className:"block text-sm font-medium text-gray-700 mb-2",children:"Admin Passcode"}),a.jsx("input",{type:"password",id:"passcode",value:r,onChange:e=>i(e.target.value),className:"w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg tracking-wider",placeholder:"Enter 6-digit passcode",maxLength:10,required:!0})]}),c&&a.jsx("div",{className:"bg-red-50 border border-red-200 rounded-lg p-3",children:a.jsx("p",{className:"text-red-800 text-sm",children:c})}),(0,a.jsxs)("button",{type:"submit",className:"w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors",children:[a.jsx(P.Z,{className:"h-5 w-5"}),a.jsx("span",{children:"Access Dashboard"})]})]})]}),a.jsx("div",{className:"mt-8",children:a.jsx("p",{className:"text-center text-xs text-gray-500",children:"\xa9 Gilnaks Food Corporation"})})]})}},1618:(e,t,r)=>{"use strict";r.r(t),r.d(t,{$$typeof:()=>l,__esModule:()=>i,default:()=>d});var a=r(5153);let s=(0,a.createProxy)(String.raw`C:\Users\John\Desktop\gfc\inventory-system\app\dashboard\page.tsx`),{__esModule:i,$$typeof:l}=s,n=s.default,d=n}};var t=require("../../webpack-runtime.js");t.C(e);var __webpack_exec__=e=>t(t.s=e),r=t.X(0,[862,866,637,370,956,982],()=>__webpack_exec__(9854));module.exports=r})();