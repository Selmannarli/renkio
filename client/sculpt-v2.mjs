import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {SCULPT_V2,WARDROBE_V2} from './sculpt-v2-data.mjs';
// Decodes the baked vinyl-toy sculpts. Geometry is cached per face/part; colour per face/part/body colour.
const raw=new Map(),coloured=new Map();
function bytes(b64){if(typeof atob==='function'){const s=atob(b64),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a}return new Uint8Array(Buffer.from(b64,'base64'))}
function decode(part){
 // Planar, delta-coded layout (see design/sculpt/pack.py): positions, normals, colours, indices.
 const b=bytes(part.data),n=part.count,t=part.tris,view=new DataView(b.buffer);let o=0;
 const pos=new Float32Array(n*3),nor=new Float32Array(n*3),col=new Uint8Array(n*5),idx=new Uint16Array(t*3);
 for(let k=0;k<3;k++){let v=0;const lo=part.min[k],span=(part.max[k]-part.min[k])/65535;for(let i=0;i<n;i++){v=(v+view.getUint16(o,true))&65535;o+=2;pos[i*3+k]=lo+v*span}}
 for(let k=0;k<3;k++)for(let i=0;i<n;i++){nor[i*3+k]=view.getInt8(o)/127;o++}
 for(let k=0;k<5;k++)for(let i=0;i<n;i++){col[i*5+k]=b[o];o++}
 let v=0;for(let i=0;i<t*3;i++){v=(v+view.getUint16(o,true))&65535;o+=2;idx[i]=v}
 return {pos,nor,col,idx,n};
}
export const SCULPT_FACES=SCULPT_V2.length;
export function sculptSpec(face){return SCULPT_V2[face]}
export function wardrobeSpec(id){return WARDROBE_V2[id]}
export function wardrobeGeometry(id,tintHex){return paint('w:'+id,WARDROBE_V2[id],tintHex)}
export function sculptGeometry(face,index,bodyHex){return paint(face+':'+index,SCULPT_V2[face].parts[index],bodyHex)}
function paint(rk,part,bodyHex){
 const key=rk+':'+bodyHex;if(coloured.has(key))return coloured.get(key);
 if(!raw.has(rk))raw.set(rk,decode(part));
 const d=raw.get(rk),base=new T.Color(bodyHex),c=new Float32Array(d.n*3),tmp=new T.Color();
 for(let i=0;i<d.n;i++){const r=d.col[i*5]/255,g=d.col[i*5+1]/255,bl=d.col[i*5+2]/255,t=d.col[i*5+3]/255,s=d.col[i*5+4]/255*1.25;tmp.setRGB(r,g,bl,T.SRGBColorSpace);
  c[i*3]=base.r*s*t+tmp.r*(1-t);c[i*3+1]=base.g*s*t+tmp.g*(1-t);c[i*3+2]=base.b*s*t+tmp.b*(1-t)}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(d.pos,3));g.setAttribute('normal',new T.BufferAttribute(d.nor,3));g.setAttribute('color',new T.BufferAttribute(c,3));g.setIndex(new T.BufferAttribute(d.idx,1));g.computeBoundingSphere();g.computeBoundingBox();
 g.boundsTree=new MeshBVH(g);g.userData.sculpt=true;coloured.set(key,g);return g;
}
