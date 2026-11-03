export function compactViewport(width){const available=Math.max(240,Math.round(width));return {width:Math.max(390,available),scale:Math.min(1,available/390)}}
if(typeof window!=='undefined'){
 const meta=document.querySelector('meta[name=viewport]');let last='';
 const update=()=>{const vv=window.visualViewport,width=vv?vv.width*vv.scale:Math.min(screen.width,innerWidth),plan=compactViewport(width),value=plan.scale<1?'width='+plan.width+', initial-scale='+plan.scale.toFixed(5)+', viewport-fit=cover':'width=device-width, initial-scale=1, viewport-fit=cover';if(value!==last){last=value;meta?.setAttribute('content',value)}};
 update();window.addEventListener('resize',update,{passive:true});window.addEventListener('orientationchange',update,{passive:true});
}
