exports.id=872,exports.ids=[872],exports.modules={10618:(e,t,l)=>{"use strict";l.d(t,{Z:()=>n});var a=l(3528);/**
 * @license lucide-react v0.294.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let n=(0,a.Z)("Factory",[["path",{d:"M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z",key:"159hny"}],["path",{d:"M17 18h1",key:"uldtlt"}],["path",{d:"M12 18h1",key:"s9uhes"}],["path",{d:"M7 18h1",key:"1neino"}]])},32568:(e,t,l)=>{"use strict";l.d(t,{Z:()=>n});var a=l(3528);/**
 * @license lucide-react v0.294.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let n=(0,a.Z)("FlaskConical",[["path",{d:"M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2",key:"pzvekw"}],["path",{d:"M8.5 2h7",key:"csnxdl"}],["path",{d:"M7 16h10",key:"wp8him"}]])},87230:(e,t,l)=>{"use strict";l.d(t,{Z:()=>n});var a=l(3528);/**
 * @license lucide-react v0.294.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let n=(0,a.Z)("Scan",[["path",{d:"M3 7V5a2 2 0 0 1 2-2h2",key:"aa7l1z"}],["path",{d:"M17 3h2a2 2 0 0 1 2 2v2",key:"4qcy5o"}],["path",{d:"M21 17v2a2 2 0 0 1-2 2h-2",key:"6vwrx8"}],["path",{d:"M7 21H5a2 2 0 0 1-2-2v-2",key:"ioqczr"}]])},28089:(e,t,l)=>{"use strict";l.d(t,{Z:()=>n});var a=l(3528);/**
 * @license lucide-react v0.294.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let n=(0,a.Z)("Send",[["path",{d:"m22 2-7 20-4-9-9-4Z",key:"1q3vgg"}],["path",{d:"M22 2 11 13",key:"nzbqef"}]])},97018:(e,t,l)=>{"use strict";l.d(t,{Z:()=>n});var a=l(3528);/**
 * @license lucide-react v0.294.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let n=(0,a.Z)("UserPlus",[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"19",x2:"19",y1:"8",y2:"14",key:"1bvyxn"}],["line",{x1:"22",x2:"16",y1:"11",y2:"11",key:"1shjgl"}]])},83642:(e,t,l)=>{"use strict";Object.defineProperty(t,"__esModule",{value:!0}),Object.defineProperty(t,"default",{enumerable:!0,get:function(){return dynamic}});let a=l(80085);l(9885);let n=a._(l(60112));function convertModule(e){return{default:(null==e?void 0:e.default)||e}}function dynamic(e,t){let l=n.default,a={loading:e=>{let{error:t,isLoading:l,pastDelay:a}=e;return null}};"function"==typeof e&&(a.loader=e),Object.assign(a,t);let r=a.loader;return l({...a,loader:()=>null!=r?r().then(convertModule):Promise.resolve(convertModule(()=>null))})}("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)},6800:(e,t,l)=>{"use strict";Object.defineProperty(t,"__esModule",{value:!0}),Object.defineProperty(t,"NoSSR",{enumerable:!0,get:function(){return NoSSR}});let a=l(61118);function NoSSR(e){let{children:t}=e;return(0,a.throwWithNoSSR)(),t}},60112:(e,t,l)=>{"use strict";Object.defineProperty(t,"__esModule",{value:!0}),Object.defineProperty(t,"default",{enumerable:!0,get:function(){return d}});let a=l(80085),n=a._(l(9885)),r=l(6800);function Loadable(e){let t=Object.assign({loader:null,loading:null,ssr:!0},e);function LoadableComponent(e){let l=t.loading,a=n.default.createElement(l,{isLoading:!0,pastDelay:!0,error:null}),d=t.ssr?n.default.Fragment:r.NoSSR,o=t.lazy;return n.default.createElement(n.default.Suspense,{fallback:a},n.default.createElement(d,null,n.default.createElement(o,e)))}return t.lazy=n.default.lazy(t.loader),LoadableComponent.displayName="LoadableComponent",LoadableComponent}let d=Loadable},57114:(e,t,l)=>{e.exports=l(4979)}};