
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{},n=(new Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="6e26de7b-d761-5c31-80c5-e1e6bcfcb0e2")}catch(e){}}();
import{B as r,D as n,H as o,J as a}from"/chunks/chunk-FGTEOZRD.js";var L=(e,t,i,l)=>({id:s(),runtime:i,message:e,timestamp:l,fileName:t.fileName,lineNumber:t.lineNumber,srcLineNumber:t.srcLineNumber,severity:t.severity,prefix:t.prefix,highlight:t.highlight??!1,rawParams:t.rawParams});var s=()=>crypto.getRandomValues(new Uint32Array(1))[0].toString(36),d=()=>!0;var g=e=>o(e)?r`${e.loggableName}: ${e.loggableMessage}`:n.is(e)?e:"<redacted>",f=e=>e instanceof ErrorEvent?g(e.error):e instanceof PromiseRejectionEvent?g(e.reason):(a(e,r`event`),"<redacted>");export{L as a,s as b,d as c,f as d};

//# debugId=6e26de7b-d761-5c31-80c5-e1e6bcfcb0e2
