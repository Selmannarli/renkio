// Every catalogue item has a separate anatomical fit; world-space anchors are
// converted to the head/torso joint only after the character is assembled.
const fit=(parent,at,size,rotation=[0,0,0])=>({parent,at,size,rotation});
const bases=[
 {glasses:{side:.61,back:-.035,depth:.175,bridge:.028},bow:fit('body',[0,.40,0],[.80,.82,1]),cap:fit('head',[0,1.32,-.035],[.30,.17,.245]),crown:fit('head',[0,1.33,-.025],[.24,.23,.205])},
 {glasses:{side:.615,back:-.045,depth:.135,bridge:.018},bow:fit('body',[0,.53,0],[.75,.72,1]),cap:fit('head',[0,1.50,-.04],[.40,.17,.275]),crown:fit('head',[0,1.50,-.025],[.32,.23,.225])},
 {glasses:{side:.55,back:-.005,depth:.150,bridge:.022},bow:fit('body',[0,.575,0],[.76,.76,1]),cap:fit('head',[0,1.43,.015],[.185,.16,.205]),crown:fit('head',[0,1.43,.005],[.155,.23,.165])},
 {glasses:{side:.505,back:-.02,depth:.140,bridge:.022},bow:fit('body',[0,.45,0],[.92,.88,1]),cap:fit('head',[0,1.44,-.035],[.27,.17,.225]),crown:fit('head',[0,1.44,-.025],[.225,.23,.185])},
 {glasses:{side:.47,back:-.005,depth:.145,bridge:.014},bow:fit('body',[0,.43,0],[.78,.76,1]),cap:fit('head',[0,1.35,-.04],[.205,.17,.185]),crown:fit('head',[0,1.35,-.03],[.165,.23,.155])},
 {glasses:{side:.545,back:-.04,depth:.145,bridge:.025},bow:fit('head',[0,.56,0],[.70,.70,1]),cap:fit('head',[0,1.45,-.035],[.285,.19,.235]),crown:fit('head',[0,1.45,-.025],[.24,.24,.195])},
 {glasses:{side:.44,back:-.02,depth:.13,bridge:.02},bow:fit('head',[0,.43,0],[.62,.62,1]),cap:fit('head',[0,1.20,0],[.125,.13,.105]),crown:fit('head',[0,1.20,0],[.115,.19,.10])}
];
export const CHARACTER_ACCESSORY_FITS=bases.map(b=>{
 const p=structuredClone(b);
 p.shades={...b.glasses,depth:b.glasses.depth+.012};
 p.stargaze={...b.glasses,depth:b.glasses.depth+.020,side:b.glasses.side+.01};
 p.silkBow=fit(b.bow.parent,[b.bow.at[0],b.bow.at[1]-.012,b.bow.at[2]],[b.bow.size[0]*1.03,b.bow.size[1],1]);
 p.royalBow=fit(b.bow.parent,[b.bow.at[0],b.bow.at[1]-.025,b.bow.at[2]],[b.bow.size[0]*.94,b.bow.size[1]*.93,1]);
 p.beanie=fit('head',[b.cap.at[0],b.cap.at[1],b.cap.at[2]],[b.cap.size[0]*.98,b.cap.size[1]*1.42,b.cap.size[2]*.99]);
 p.astralCrown=fit('head',[b.crown.at[0],b.crown.at[1],b.crown.at[2]],[b.crown.size[0]*1.06,b.crown.size[1]*1.28,b.crown.size[2]*1.04]);
 return p;
});
export function accessoryFit(face,id,slot){const p=CHARACTER_ACCESSORY_FITS[face]||CHARACTER_ACCESSORY_FITS[0];return structuredClone(p[id]||p[slot==='neck'?'bow':slot==='face'?'glasses':'cap'])}
export const REAR_PROFILES=[
 {name:'cloud-cushion',parent:'body',at:[0,.24,-.20],size:[.24,.17,.12],softness:.025},
 {name:'robot-chassis',parent:'body',at:[0,.25,-.235],size:[.42,.29,.12],softness:0},
 {name:'cat-haunch',parent:'body',at:[0,.18,-.17],size:[.26,.22,.16],softness:.035},
 {name:'cyclops-rump',parent:'body',at:[0,.20,-.20],size:[.34,.28,.16],softness:.035},
 {name:'dragon-rump',parent:'body',at:[0,.22,-.20],size:[.23,.17,.12],softness:.025},
 {name:'jelly-bell-folds',parent:'head',at:[0,.76,0],size:[.24,.095,.025],softness:.018,surface:true},
 {name:'star-back',parent:'head',at:[0,.56,-.16],size:[.2,.14,.08],softness:.02}
];
