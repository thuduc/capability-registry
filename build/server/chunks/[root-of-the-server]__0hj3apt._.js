module.exports=[93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},14747,(e,t,r)=>{t.exports=e.x("path",()=>require("path"))},22734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},98496,e=>{"use strict";var t=e.i(47909),r=e.i(74017),a=e.i(96250),n=e.i(59756),i=e.i(61916),o=e.i(74677),s=e.i(69741),l=e.i(16795),d=e.i(87718),u=e.i(95169),p=e.i(47587),c=e.i(66012),h=e.i(70101),R=e.i(26937),x=e.i(10372),E=e.i(93695);e.i(52474);var f=e.i(220),m=e.i(89171),v=e.i(43793),y=e.i(22734),C=e.i(14747);async function g(e,{params:t}){try{let{name:r,version:a}=await t,{searchParams:n}=new URL(e.url),i="true"===n.get("file"),o=await v.prisma.capabilityVersion.findFirst({where:{version:a,capability:{name:r}},include:{capability:!0}});if(!o)return m.NextResponse.json({error:`Capability version ${r} v${a} not found.`},{status:404});let s=C.default.resolve(process.cwd(),o.zipPath);if(!y.default.existsSync(s))return m.NextResponse.json({error:"ZIP bundle file not found on disk."},{status:404});if(i){let e=y.default.readFileSync(s);return new m.NextResponse(e,{status:200,headers:{"Content-Type":"application/zip","Content-Disposition":`attachment; filename="${r}-${a}.zip"`,"Content-Length":e.length.toString()}})}let l=e.nextUrl.origin||"http://localhost:3000",d=`#!/bin/bash
# ==============================================================================
# EMA GenAI Capability Registry - Automated Bootstrap Installer
# Capability: ${r} v${a}
# Generated: ${new Date().toISOString()}
# ==============================================================================
set -e

CAP_NAME="${r}"
CAP_VER="${a}"
REGISTRY_URL="${l}"

# Formatting tokens
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

echo -e "\${BLUE}====================================================\${NC}"
echo -e "\${BLUE}   EMA GenAI Capability Automated Installer         \${NC}"
echo -e "\${BLUE}====================================================\${NC}"
echo -e "📦 Target: \${GREEN}\${CAP_NAME} (v\${CAP_VER})\${NC}"
echo -e "🌐 Source: \${BLUE}\${REGISTRY_URL}\${NC}"
echo ""

# 1. Sanity checks: Verify unzip utility exists
if ! command -v unzip &> /dev/null; then
    echo -e "\${RED}Error: 'unzip' utility is not found on your system.\${NC}"
    echo "Please install 'unzip' using your system package manager (e.g. apt, brew, yum) and try again."
    exit 1
fi

# 2. Provision secure temp folder for download
TEMP_ZIP=$(mktemp /tmp/ema-install-XXXXXX.zip)

# Cleanup trap to ensure temporary zip is deleted even on failure
trap 'rm -f "$TEMP_ZIP"' EXIT

echo -e "📥 Downloading binary ZIP bundle..."
DOWNLOAD_URL="\${REGISTRY_URL}/api/install/\${CAP_NAME}/\${CAP_VER}?file=true"

# 3. Pull package binary from webapp
if ! curl -fsSL "$DOWNLOAD_URL" -o "$TEMP_ZIP"; then
    echo -e "\${RED}Error: Failed to download ZIP bundle from the registry.\${NC}"
    exit 1
fi

echo -e "⚙️  Extracting capability bundle directly into current directory..."

# 4. Extract cleanly in place
if ! unzip -oq "$TEMP_ZIP" -d .; then
    echo -e "\${RED}Error: Failed to decompress capability ZIP bundle.\${NC}"
    exit 1
fi

echo ""
echo -e "\${GREEN}✨ SUCCESS: \${CAP_NAME} v\${CAP_VER} has been installed! \${NC}"
echo -e "📁 Directory: $(pwd)"
echo -e "\${BLUE}====================================================\${NC}"
`;return new m.NextResponse(d,{status:200,headers:{"Content-Type":"text/x-shellscript","Content-Disposition":'inline; filename="install.sh"'}})}catch(e){return console.error("GET /api/install/[name]/[version] error:",e),m.NextResponse.json({error:e.message||"Installer bootstrap failed"},{status:500})}}e.s(["GET",0,g],60640);var w=e.i(60640);let $=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/install/[name]/[version]/route",pathname:"/api/install/[name]/[version]",filename:"route",bundlePath:""},distDir:"build",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/install/[name]/[version]/route.ts",nextConfigOutput:"",userland:w,...{}}),{workAsyncStorage:b,workUnitAsyncStorage:A,serverHooks:N}=$;async function P(e,t,a){a.requestMeta&&(0,n.setRequestMeta)(e,a.requestMeta),$.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let m="/api/install/[name]/[version]/route";m=m.replace(/\/index$/,"")||"/";let v=await $.prepare(e,t,{srcPage:m,multiZoneDraftMode:!1});if(!v)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:y,deploymentId:C,params:g,nextConfig:w,parsedUrl:b,isDraftMode:A,prerenderManifest:N,routerServerContext:P,isOnDemandRevalidate:_,revalidateOnlyGenerated:T,resolvedPathname:S,clientReferenceManifest:I,serverActionsManifest:U}=v,k=(0,s.normalizeAppPath)(m),q=!!(N.dynamicRoutes[k]||N.routes[S]),D=async()=>((null==P?void 0:P.render404)?await P.render404(e,t,b,!1):t.end("This page could not be found"),null);if(q&&!A){let e=!!N.routes[S],t=N.dynamicRoutes[k];if(t&&!1===t.fallback&&!e){if(w.adapterPath)return await D();throw new E.NoFallbackError}}let O=null;!q||$.isDev||A||(O="/index"===(O=S)?"/":O);let M=!0===$.isDev||!q,L=q&&!M;U&&I&&(0,o.setManifestsSingleton)({page:m,clientReferenceManifest:I,serverActionsManifest:U});let j=e.method||"GET",H=(0,i.getTracer)(),G=H.getActiveScopeSpan(),B=!!(null==P?void 0:P.isWrappedByNextServer),F=!!(0,n.getRequestMeta)(e,"minimalMode"),z=(0,n.getRequestMeta)(e,"incrementalCache")||await $.getIncrementalCache(e,w,N,F);null==z||z.resetRequestCache(),globalThis.__incrementalCache=z;let X={params:g,previewProps:N.preview,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:M,incrementalCache:z,cacheLifeProfiles:w.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,n)=>$.onRequestError(e,t,a,n,P)},sharedContext:{buildId:y,deploymentId:C}},V=new l.NodeNextRequest(e),Z=new l.NodeNextResponse(t),K=d.NextRequestAdapter.fromNodeNextRequest(V,(0,d.signalFromNodeResponse)(t));try{let n,o=async e=>$.handle(K,X).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=H.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${j} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),n&&n!==e&&(n.setAttribute("http.route",a),n.updateName(t))}else e.updateName(`${j} ${m}`)}),s=async n=>{var i,s;let l=async({previousCacheEntry:r})=>{try{if(!F&&_&&T&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let i=await o(n);e.fetchMetrics=X.renderOpts.fetchMetrics;let s=X.renderOpts.pendingWaitUntil;s&&a.waitUntil&&(a.waitUntil(s),s=void 0);let l=X.renderOpts.collectedTags;if(!q)return await (0,c.sendResponse)(V,Z,i,X.renderOpts.pendingWaitUntil),null;{let e=await i.blob(),t=(0,h.toNodeOutgoingHttpHeaders)(i.headers);l&&(t[x.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==X.renderOpts.collectedRevalidate&&!(X.renderOpts.collectedRevalidate>=x.INFINITE_CACHE)&&X.renderOpts.collectedRevalidate,a=void 0===X.renderOpts.collectedExpire||X.renderOpts.collectedExpire>=x.INFINITE_CACHE?void 0:X.renderOpts.collectedExpire;return{value:{kind:f.CachedRouteKind.APP_ROUTE,status:i.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await $.onRequestError(e,t,{routerKind:"App Router",routePath:m,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:L,isOnDemandRevalidate:_})},!1,P),t}},d=await $.handleResponse({req:e,nextConfig:w,cacheKey:O,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:N,isRoutePPREnabled:!1,isOnDemandRevalidate:_,revalidateOnlyGenerated:T,responseGenerator:l,waitUntil:a.waitUntil,isMinimalMode:F});if(!q)return null;if((null==d||null==(i=d.value)?void 0:i.kind)!==f.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(s=d.value)?void 0:s.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});F||t.setHeader("x-nextjs-cache",_?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),A&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let u=(0,h.fromNodeOutgoingHttpHeaders)(d.value.headers);return F&&q||u.delete(x.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||u.get("Cache-Control")||u.set("Cache-Control",(0,R.getCacheControlHeader)(d.cacheControl)),await (0,c.sendResponse)(V,Z,new Response(d.value.body,{headers:u,status:d.value.status||200})),null};B&&G?await s(G):(n=H.getActiveScopeSpan(),await H.withPropagatedContext(e.headers,()=>H.trace(u.BaseServerSpan.handleRequest,{spanName:`${j} ${m}`,kind:i.SpanKind.SERVER,attributes:{"http.method":j,"http.target":e.url}},s),void 0,!B))}catch(t){if(t instanceof E.NoFallbackError||await $.onRequestError(e,t,{routerKind:"App Router",routePath:k,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:L,isOnDemandRevalidate:_})},!1,P),q)throw t;return await (0,c.sendResponse)(V,Z,new Response(null,{status:500})),null}}e.s(["handler",0,P,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:b,workUnitAsyncStorage:A})},"routeModule",0,$,"serverHooks",0,N,"workAsyncStorage",0,b,"workUnitAsyncStorage",0,A],98496)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0hj3apt._.js.map