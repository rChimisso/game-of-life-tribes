import{f as T}from"./chunk-E6BNUF5P.js";import{p as y,s as $}from"./chunk-RNDXNJQS.js";import{$b as l,Hb as d,Ib as p,Jb as M,Lb as u,Mb as g,Nb as _,Ob as s,Pb as c,Qb as f,Vb as b,Zb as w,eb as a,kc as O,lc as v,nc as t,oc as x,pc as S,ra as C,sa as h,vb as P}from"./chunk-DLPEVFH2.js";var F=(n,i)=>i.id;function E(n,i){n&1&&(t(0,`
      `),f(1,"br"),t(2,`
    `))}function I(n,i){if(n&1&&(t(0),d(1,E,3,0)),n&2){let e=i.$implicit,o=i.$index,m=i.$count;S(`
    `,e,`
    `),a(),p(o!==m-1?1:-1)}}function z(n,i){if(n&1&&(t(0,`
      `),f(1,"gol-button",4),t(2,`
    `)),n&2){let e=l().$implicit;a(),_("icon",e.icon)("label",e.label)("routerLink",e.route)}}function j(n,i){if(n&1){let e=b();t(0,`
      `),s(1,"gol-button",5),w("click",function(){C(e);let m=l().$implicit;return h(m.execute())}),c(),t(2,`
    `)}if(n&2){let e=l().$implicit;a(),_("icon",e.icon)("label",e.label)}}function q(n,i){if(n&1&&(t(0,`
    `),d(1,z,3,3)(2,j,3,2)),n&2){let e=i.$implicit;a(),p("route"in e?1:2)}}var r=class r{constructor(){this.details=[];this.actions=[]}};r.\u0275fac=function(e){return new(e||r)},r.\u0275cmp=P({type:r,selectors:[["gol-status-page"]],inputs:{code:"code",description:"description",details:"details",actions:"actions"},decls:19,vars:8,consts:[[1,"status-code"],[1,"status-desc"],[1,"status-details"],[1,"status-actions"],[3,"icon","label","routerLink"],[3,"click","icon","label"]],template:function(e,o){e&1&&(s(0,"span",0),t(1),c(),t(2,`
`),s(3,"span",1),t(4,`
  `),s(5,"em"),t(6),c(),t(7,`
`),c(),t(8,`
`),s(9,"span",2),t(10,`
  `),u(11,I,2,2,null,null,M),c(),t(13,`
`),s(14,"section",3),t(15,`
  `),u(16,q,3,1,null,null,F),c(),t(18,`
`)),e&2&&(O("--text-divisor",o.code.length*.6),a(),x(o.code),a(5),x(o.description),a(5),g(o.details),a(3),v("status-actions-between",o.actions.length>1)("status-actions-center",o.actions.length===1),a(2),g(o.actions))},dependencies:[$,y,T],styles:["[_nghost-%COMP%]{display:flex;flex-direction:column;align-items:center;container-type:inline-size;gap:2rem;flex:1;height:100%;padding:3rem}@media(max-width:31.25rem){[_nghost-%COMP%]{justify-content:center}}[_nghost-%COMP%] > span[_ngcontent-%COMP%]{max-width:46.25rem;text-align:center;line-height:1.5rem;font-size:1.25rem;color:#d0d0d0}[_nghost-%COMP%] > span.status-code[_ngcontent-%COMP%]{width:min(100%,46.25rem);padding:0;margin-bottom:2rem;color:#d0d0d0;white-space:nowrap;line-height:1;font-size:clamp(1rem,min(100cqw,46.25rem) / var(--text-divisor),14rem);transition:margin-bottom .2s ease}@media(max-width:40rem){[_nghost-%COMP%] > span.status-code[_ngcontent-%COMP%]{margin-bottom:1rem}}[_nghost-%COMP%] > span.status-desc[_ngcontent-%COMP%]{font-weight:200;font-size:clamp(.75rem,min(100cqw,46.25rem) / 35,1.5rem)}[_nghost-%COMP%] > span.status-details[_ngcontent-%COMP%]{font-weight:500;font-size:clamp(.75rem,min(100cqw,46.25rem) / 35,1.5rem)}[_nghost-%COMP%] > .status-actions[_ngcontent-%COMP%]{display:flex;width:100%;max-width:32rem;margin-top:1rem}[_nghost-%COMP%] > .status-actions.status-actions-between[_ngcontent-%COMP%]{justify-content:space-between}[_nghost-%COMP%] > .status-actions.status-actions-center[_ngcontent-%COMP%]{justify-content:center}@media(max-width:31.25rem){[_nghost-%COMP%] > .status-actions[_ngcontent-%COMP%]{flex-direction:column;align-items:center;gap:1.25rem;margin-top:0}}"]});var k=r;export{k as a};
