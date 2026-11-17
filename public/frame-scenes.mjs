// Authored seconds, not random offsets. Camera and DOM share this physical sill.
export const FRAME_SIZE=112,FRAME_SILL=.65;
export const FRAME_SCENES=Object.freeze({frameHighFive:8,frameLean:7.5,frameSit:9,frameVault:10,framePeek:7.2,frameSleep:9,frameClean:8,frameFix:8,frameReact:7.2,frameYawn:9,frameCopy:9});
export const frameLedge=face=>[.145,.15,.145,.205,.305,.07,.12][face]??.15;
export const framePalmX=face=>[[-.525,.525],[-.435,.435],[-.345,.345],[-.475,.475],[-.365,.365],[-.70,.71],[-.46,.46]][face]||[-.4,.4];
export const frameMask=pose=>Math.max(0,pose.clip/FRAME_SILL*(1-FRAME_SILL)*100-3.5);
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(x*(x*6-15)+10)};
const rise=(t,a,b)=>smooth((t-a)/(b-a));
const e=(t,a,b,c,d)=>rise(t,a,b)*(1-rise(t,c,d));
export function frameKey(t,points){if(t<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++){const [b,y]=points[i],[a,x]=points[i-1];if(t<=b)return x+(y-x)*smooth((t-a)/(b-a))}return points.at(-1)[1]}
export const frameReveal=(name,t)=>e(t,0,.72,(FRAME_SCENES[name]||1)-.75,FRAME_SCENES[name]||1);
export function sampleFrameScene(name,t){
 const duration=FRAME_SCENES[name]||0;t=Math.max(0,Math.min(duration,t));const a=e(t,.15,.9,duration-1.1,duration-.05);
 const s={duration,grip:0,lift:0,sit:0,step:0,lean:0,peek:0,wipe:0,sleep:0,wake:0,fix:0,react:0,yawn:0,out:0,slide:0,five:0,clip:FRAME_SILL,breath:0};
 if(name==='frameHighFive'){s.sit=e(t,.6,1.5,5.8,7.7);s.slide=e(t,1,2,5,6.6)*.58;s.five=e(t,1.8,2.7,4.2,5.5);s.grip=a;s.clip=FRAME_SILL*(1-s.sit)}
 if(name==='frameSit'){s.grip=e(t,.15,.85,7.8,8.8);s.sit=e(t,1.2,2.3,6.5,8.5);s.lift=frameKey(t,[[0,0],[.9,0],[1.5,.11],[2.4,.025],[6.3,.025],[7.1,.11],[8.8,0],[9,0]]);s.step=Math.sin((t-2.3)*2.2)*e(t,2.4,3,5.8,6.4)*.10;s.grip*=1-e(t,2.3,3,5.8,6.5);s.clip=FRAME_SILL*(1-s.sit)}
 if(name==='frameVault'){s.grip=Math.max(e(t,.2,.85,1.9,2.5),e(t,6.5,7,8.6,9.8));s.lift=frameKey(t,[[0,0],[.8,0],[1.6,.12],[2.1,.12],[2.8,-.30],[3,-.34],[3.3,-.30],[6,-.30],[6.6,-.18],[7.2,.12],[8.2,.06],[9.8,0],[10,0]]);s.sit=Math.max(e(t,1,1.7,2.1,2.6),e(t,6.5,7.2,8.2,9.5));s.out=e(t,1.4,2.6,6.5,8.3);s.clip=FRAME_SILL*(1-e(t,1,2.2,8.8,9.9));s.peek=e(t,3.5,4.2,5.1,5.8)*.6}
 if(name==='frameLean'){s.lean=a;s.grip=a;s.react=e(t,4.4,4.7,4.85,5.3);}
 if(name==='framePeek'){s.grip=a;s.peek=e(t,.8,1.8,4.4,6.5)}
 if(name==='frameSleep'){s.sleep=e(t,1,2.8,6.4,7);s.wake=e(t,6.5,6.9,7.2,8.2);s.grip=a*.3}
 if(name==='frameClean'){s.wipe=Math.max(e(t,.7,1.3,3.1,3.6),e(t,4.8,5.3,6.5,7.4));s.breath=e(t,3.65,3.95,4.4,4.8);s.grip=a*.7}
 if(name==='frameFix'){s.grip=a;s.fix=e(t,1,1.6,5.9,7.1)}
 if(name==='frameReact'){s.react=e(t,2.6,3.2,4.8,6.6);s.peek=e(t,3,3.8,4.8,6.4)*-.75;s.grip=a*.5}
 if(name==='frameYawn'||name==='frameCopy'){const offset=name==='frameCopy'?1.25:0;s.yawn=e(t,.9+offset,1.6+offset,3.6+offset,4.6+offset);s.peek=e(t,5.8,6.3,7.1,8.5)*.45;s.grip=a*.5}
 return s;
}
