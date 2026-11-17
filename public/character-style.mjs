import {ANIMATION_PRIORITIES} from './animation-style.mjs';
// The picker and both 3D views share absolute body colours, never hue offsets.
export const CHARACTER_TINTS=Object.freeze([
 {name:'Özgün renkler',hex:null},
 {name:'Turkuaz',hex:'#48bcb8'},
 {name:'Mercan',hex:'#ed8396'},
 {name:'Altın',hex:'#eebc47'},
 {name:'Mavi',hex:'#7d9fe7'},
 {name:'Pembe',hex:'#cd86cb'},
 {name:'Yeşil',hex:'#7fc496'},
 {name:'Gri',hex:'#a5aabc'}
]);
export const CHARACTER_BASES=Object.freeze(['#b49bf2','#8f6af0','#f59a52','#ff86b8','#7ccf63','#5ec4f5','#ffc93c']);
export const MIKO_AVATAR=Object.freeze({face:1,color:0});
export function characterBodyColour(face,colour){return CHARACTER_TINTS[colour]?.hex||CHARACTER_BASES[face]||CHARACTER_BASES[0]}

export const ACCESSORIES=Object.freeze([{id:'none',name:'Aksesuarsız',price:0},{id:'glasses',name:'Gözlük',price:0,slot:'face'},{id:'bow',name:'Papyon',price:0,slot:'neck'},{id:'cap',name:'Şapka',price:20,slot:'head'},{id:'crown',name:'Taç',price:30,slot:'head'},{id:'shades',name:'Güneş gözlüğü',price:120,slot:'face'},{id:'stargaze',name:'Yıldız gözlük',price:50000,slot:'face'},{id:'silkBow',name:'İpek papyon',price:120,slot:'neck'},{id:'royalBow',name:'Kraliyet papyonu',price:50000,slot:'neck'},{id:'beanie',name:'Ponponlu şapka',price:150,slot:'head'},{id:'astralCrown',name:'Yıldız tacı',price:50000,slot:'head'},{id:'partyHat',name:'Parti şapkası',price:80,slot:'head'},{id:'flowerCrown',name:'Çiçek tacı',price:200,slot:'head'},{id:'bunnyEars',name:'Tavşan kulakları',price:250,slot:'head'},{id:'halo',name:'Hale',price:400,slot:'head'},{id:'heartShades',name:'Kalp gözlük',price:180,slot:'face'},{id:'monocle',name:'Monokl',price:300,slot:'face'},{id:'scarf',name:'Atkı',price:160,slot:'neck'},{id:'bellCollar',name:'Çıngıraklı tasma',price:120,slot:'neck'},{id:'medal',name:'Madalya',price:350,slot:'neck'}]);
export const accessoryById=id=>ACCESSORIES.find(a=>a.id===id);
export const ACCESSORY_COLOURS=Object.freeze([{name:'Özgün renkler',hex:null},{name:'Mor',hex:'#9868dc'},{name:'Mavi',hex:'#459fdb'},{name:'Mercan',hex:'#ef7786'},{name:'Yeşil',hex:'#53b998'},{name:'Altın',hex:'#e6b65f'},{name:'Siyah',hex:'#302c43'},{name:'Beyaz',hex:'#eee5db'}]);
export function normalizeAccessoryColours(value){
 const input=typeof value==='string'?Object.fromEntries(value.split(',').filter(Boolean).map(p=>p.split(':').map((v,i)=>i?Number(v):v))):value;
 const result={};for(const slot of ['face','neck','head']){const n=input?.[slot];if(Number.isInteger(n)&&n>0&&n<ACCESSORY_COLOURS.length)result[slot]=n}return result;
}
export const accessoryColourKey=value=>Object.entries(normalizeAccessoryColours(value)).map(([slot,n])=>slot+':'+n).join(',');
export const accessoryColour=(value,slot,fallback)=>ACCESSORY_COLOURS[normalizeAccessoryColours(value)[slot]||0].hex||fallback;

export function accessoryList(value){const source=Array.isArray(value)?value:typeof value==='string'?value.split(','):[];const slots=new Map();for(const id of source){const item=accessoryById(id);if(item?.slot)slots.set(item.slot,id)}return [...slots.values()].sort()}
export function toggleAccessory(current,id){const items=accessoryList(current),item=accessoryById(id);if(!item?.slot)return [];return items.includes(id)?items.filter(n=>n!==id):accessoryList([...items.filter(n=>accessoryById(n).slot!==item.slot),id])}
export const ACCESSORY_PATHS={glasses:'<circle cx="10" cy="18" r="7"/><circle cx="30" cy="18" r="7"/><path d="M17 17q3-3 6 0M3 16 1 11m36 5 2-5"/>',bow:'<path d="M17 17 4 11v18l13-6m6-6 13-6v18l-13-6Z"/><rect x="17" y="16" width="6" height="8" rx="2"/>',cap:'<path d="M7 23v-7a13 13 0 0 1 26 0v7Z"/><path d="M7 23h26l5 4H4l3-4ZM20 4v17"/>',crown:'<path d="m5 12 8 7 7-13 7 13 8-7-4 20H9L5 12Z"/><path d="M10 27h20"/>'};

Object.assign(ACCESSORY_PATHS,{shades:ACCESSORY_PATHS.glasses,stargaze:ACCESSORY_PATHS.glasses+'<path d="m20 3 2 4 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1Z"/>',silkBow:ACCESSORY_PATHS.bow,royalBow:ACCESSORY_PATHS.bow+'<path d="m20 15 4 5-4 5-4-5Z"/>',beanie:ACCESSORY_PATHS.cap+'<circle cx="20" cy="3" r="3"/>',astralCrown:ACCESSORY_PATHS.crown+'<path d="m20 14 3 5-3 5-3-5Z"/>',partyHat:'<path d="M20 4 8 32h24Z"/><circle cx="20" cy="4" r="3"/><path d="m12 22 14-6m-12 12 16-7"/>',flowerCrown:'<ellipse cx="20" cy="24" rx="16" ry="5"/><circle cx="12" cy="20" r="4"/><circle cx="20" cy="18" r="4"/><circle cx="28" cy="20" r="4"/>',bunnyEars:'<path d="M6 30a14 14 0 0 1 28 0"/><ellipse cx="14" cy="10" rx="4" ry="9"/><ellipse cx="26" cy="10" rx="4" ry="9"/>',halo:'<ellipse cx="20" cy="14" rx="14" ry="5"/>',heartShades:'<path d="M10 25 4 18a4 4 0 0 1 6-5 4 4 0 0 1 6 5Zm20 0-6-7a4 4 0 0 1 6-5 4 4 0 0 1 6 5Z"/><path d="M16 17h8"/>',monocle:'<circle cx="22" cy="17" r="8"/><path d="m28 23 3 12"/>',scarf:'<path d="M6 14q14 8 28 0v6q-14 8-28 0Z"/><path d="M24 20v14h6V18"/>',bellCollar:'<ellipse cx="20" cy="14" rx="15" ry="5"/><circle cx="20" cy="25" r="5"/>',medal:'<path d="m12 4 8 14 8-14"/><circle cx="20" cy="26" r="8"/>'});
export const HERO_TIMING=Object.freeze({duration:4800,impact:1780});

// A tap cannot interrupt an outcome or the last-ten-seconds warning.
export const CHARACTER_PRIORITY=Object.freeze({...ANIMATION_PRIORITIES,appleAim:20,appleThrow:25,appleHit:65,idle:0,walkLeft:15,walkRight:15,climbDown:15,climbUp:15,ledge:15,punch:15,kick:15,waveLeft:5,waveRight:5,bored:5,buttonPunch:15,hello:10,draw:30,celebrate:40,sad:40,angry:40,surprise:40,knock:60,win:80,lose:80,impact:100});
export function acceptsCharacterGesture(current,next,remaining=0){
 if(next==='idle')return true;
 if(current==='appleHit'&&next==='appleHit')return true;
 if(remaining<=0||!current||current==='idle')return true;
 return current!==next&&(CHARACTER_PRIORITY[next]||0)>=(CHARACTER_PRIORITY[current]||0);
}
