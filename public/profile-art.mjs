import {ANIMATION_OPTIONS,normalizeAnimationPreferences} from './animation-style.mjs';
import {CHARACTER_TINTS,MIKO_AVATAR,ACCESSORIES,accessoryById,accessoryList,toggleAccessory,ACCESSORY_PATHS,ACCESSORY_COLOURS,normalizeAccessoryColours,accessoryColourKey} from './character-style.mjs';
import {t,locale} from './i18n.mjs';
import {playCharacter,previewCelebration} from './motion.mjs';
export function defaultAvatar(seed=''){if(seed==='miko')return {...MIKO_AVATAR};let n=2166136261;for(const ch of String(seed))n=Math.imul(n^ch.charCodeAt(0),16777619)>>>0;return {face:n%6,color:(n>>>4)%7}}
export function normalizeAvatar(v,seed=''){if(seed==='miko')return {...MIKO_AVATAR};const d=defaultAvatar(seed);const result={face:Number.isInteger(v?.face)&&v.face>=0&&v.face<7?v.face:d.face,color:Number.isInteger(v?.color)&&v.color>=0&&v.color<8?v.color:d.color};const items=accessoryList(v?.accessories??v?.accessory);if(items.length)result.accessories=items;const colours=normalizeAccessoryColours(v?.accessoryColors);if(Object.keys(colours).length)result.accessoryColors=colours;if(v?.animations)result.animations=normalizeAnimationPreferences(v.animations);return result}
export const AVATAR_NAMES=['Pof','Robot','Kedi','Tepegöz','Ejder','Denizanası','Yıldız'];
export function avatarArt(v,seed=''){
 const {face,color,accessories=[],accessoryColors={},animations}=normalizeAvatar(v,seed),motion=normalizeAnimationPreferences(animations);
 return `<span class="character-art character-${face}" data-character="${face}" data-colour="${color}" data-accessory="${accessories.join(',')||'none'}" data-animation-greeting="${motion.greeting}" data-animation-win="${motion.win}" data-animation-loss="${motion.loss}" data-accessory-colours="${accessoryColourKey(accessoryColors)}" aria-hidden="true"></span>`;
}

export const hasPendingAvatar=()=>!!localStorage.getItem('renkio-avatar-pending:'+owner);export const clearPendingAvatar=()=>localStorage.removeItem('renkio-avatar-pending:'+owner);
const avatarWrites=new Map();
export function persistAvatar(value,write,id){const previous=avatarWrites.get(id)||Promise.resolve();const task=previous.catch(()=>{}).then(()=>{if(owner===id&&JSON.stringify(readAvatar())===JSON.stringify(value))return write(value)});avatarWrites.set(id,task);return task.finally(()=>{if(avatarWrites.get(id)===task)avatarWrites.delete(id)})}
let owner='';export function setAvatarOwner(id){owner=id||''}
const storageKey=()=> 'renkio-avatar:'+owner;
export function readAvatar(seed=owner){try{return normalizeAvatar(JSON.parse(localStorage.getItem(storageKey())),seed)}catch{return defaultAvatar(seed)}}
export function hasAvatar(){return !!localStorage.getItem(storageKey())}
export function saveAvatar(v){localStorage.setItem(storageKey(),JSON.stringify(normalizeAvatar(v,owner)))}
export function playerAvatar(name,index,google='',own=false,v=null,seed=name){const n=document.createElement('div');n.className='avatar illustrated-avatar';n.dataset.avatarName=name;n.innerHTML=avatarArt(own?readAvatar():v,seed);return n}
export function openAvatarPicker(save,{wallet={},loadWallet=null,buy=null,openShop=null}={}){
 const d=document.createElement('dialog');d.className='avatar-dialog';
 const draft=readAvatar(),editingOwner=owner,receipts=new Map();
 let owned=new Set(['glasses','bow',...(wallet.accessories||[])]),diamonds=wallet.diamonds||0,admin=!!wallet.admin;
 let category='face',editorTab='look',animationGroup='greeting',shelfCategory=null,shownAnimationGroup=null;
 let pending=null,busy=false,toastTimer=null,fadeTimer=null;
 draft.animations=normalizeAnimationPreferences(draft.animations);
 const artIcon=id=>'<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ACCESSORY_PATHS[id]+'</svg>';
 d.innerHTML='<div class="drawer-heading"><h2>'+t('Karakter')+'</h2><button class="icon-button" aria-label="'+t('Kapat')+'">×</button></div><div class="avatar-editor-body"><div class="character-stage"><button type="button" class="avatar-preview" aria-label="'+t('Karakteri canlandır')+'"></button><small class="character-rotate-hint">↔ '+t('Döndür')+'</small></div><strong class="avatar-character-name"></strong><div class="avatar-editor-tabs" role="tablist"></div><div class="avatar-look-panel" id="avatar-look-panel"><div class="avatar-choices" aria-label="'+t('Karakter')+'"></div><div class="avatar-colors" aria-label="'+t('Renk')+'"></div><div class="accessory-heading"><b>'+t('Aksesuarlar')+'</b><span class="avatar-wallet"></span></div><div class="accessory-categories" role="tablist"></div><div class="accessory-shelf"></div><div class="accessory-colours" role="group"></div><div class="equipped-accessories"></div></div><section class="avatar-animation-settings" id="avatar-animation-panel" hidden><div class="animation-category-tabs" role="tablist"></div><div class="animation-choice-grid"></div><button type="button" class="animation-preview button">'+t('Hareketi izle')+'</button><div class="expression-preview"></div><p class="animation-help">'+t('Seçimin diğer oyunculara da görünür.')+'</p></section></div><div class="avatar-toast" hidden><span class="avatar-toast-message" role="status" aria-live="polite"></span><button type="button" class="avatar-toast-action" hidden>'+t('Mağazaya Git')+'</button></div><footer class="avatar-footer"><button type="button" class="button button-purple full avatar-save"></button></footer>';
 const editorBody=d.querySelector('.avatar-editor-body'),fixed=document.createElement('div');fixed.className='avatar-fixed-preview';fixed.append(d.querySelector('.character-stage'),d.querySelector('.avatar-character-name'));editorBody.before(fixed);
 const footer=d.querySelector('.avatar-footer'),cta=footer.querySelector('.avatar-save');
 const toast=d.querySelector('.avatar-toast'),toastMessage=toast.querySelector('.avatar-toast-message'),toastAction=toast.querySelector('.avatar-toast-action');
 const hideToast=()=>{
  clearTimeout(toastTimer);clearTimeout(fadeTimer);
  toast.hidden=true;delete toast.dataset.state;
 };
 function showToast(message,more=false){
  hideToast();
  toastAction.hidden=!more||!openShop;
  toast.hidden=false;
  toastMessage.textContent=t(message);
  toastTimer=setTimeout(()=>{
   toast.dataset.state='leaving';
   fadeTimer=setTimeout(hideToast,240);
  },3000);
 }
 const insufficient=item=>!admin&&diamonds<item.price;
 const insufficientMessage='Yeterli elmasın yok.';
 const roundPrice=price=>new Intl.NumberFormat(locale()).format(price)+' ♦';
 const close=()=>{if(!busy)d.close()};
 d.querySelector('.drawer-heading button').onclick=close;
 d.addEventListener('close',()=>{hideToast();d.remove()},{once:true});
 toastAction.onclick=async()=>{
  hideToast();
  try{await openShop?.();await refreshWallet()}catch(error){if(d.open)showToast(error.message)}
 };
 function applyWallet(result){
  if(!result||!d.open||owner!==editingOwner)return;
  owned=new Set(['glasses','bow',...(result.accessories||[])]);
  diamonds=result.diamonds||0;
  admin=!!result.admin;
  if(pending&&owned.has(pending.id)){
   draft.accessories=toggleAccessory(draft.accessories,pending.id);
   pending=null;
  }
  draw();
 }
 async function refreshWallet(){
  if(loadWallet)applyWallet(await loadWallet());
 }
 function selectAccessory(item){
  if(busy)return;
  hideToast();
  if(pending?.id===item.id){pending=null;draw();return}
  if(owned.has(item.id)){
   if(pending?.slot===item.slot)pending=null;
   draft.accessories=toggleAccessory(draft.accessories,item.id);
  }else pending=item;
  draw();
  if(pending?.id===item.id&&insufficient(item))showToast(insufficientMessage,true);
 }
 cta.onclick=async()=>{
  if(busy||owner!==editingOwner)return;
  hideToast();
  const item=pending;
  if(item&&insufficient(item)){showToast(insufficientMessage,true);return}
  busy=true;draw();
  try{
   if(item){
    if(!buy)throw Error('İşlem tamamlanamadı.');
    const receipt=receipts.get(item.id)||crypto.randomUUID();
    receipts.set(item.id,receipt);
    const result=await buy(item.id,receipt);
    if(owner!==editingOwner||!d.open)return;
    applyWallet(result);
    if(!owned.has(item.id))throw Error('İşlem tamamlanamadı.');
    receipts.delete(item.id);
   }else{
    const value=normalizeAvatar(draft,editingOwner);
    if(JSON.stringify(readAvatar())!==JSON.stringify(value)||hasPendingAvatar()){
     saveAvatar(value);
     localStorage.setItem('renkio-avatar-pending:'+editingOwner,'1');
     await persistAvatar(value,save,editingOwner);
     if(owner!==editingOwner||JSON.stringify(readAvatar())!==JSON.stringify(value))return;
     clearPendingAvatar();
    }
    if(d.open){busy=false;close()}
   }
  }catch(error){
   if(!d.open)return;
   const poor=error.message===insufficientMessage||error.message===t(insufficientMessage);
   showToast(error.message,poor);
   if(item)refreshWallet().catch(()=>{});
  }finally{
   busy=false;
   if(d.open)draw();
  }
 };
 const previewIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m9 5 11 7-11 7Z"/></svg>';
 const updateArt=(art,attributes)=>{
  for(const [key,value]of Object.entries(attributes)){
   const text=String(value);
   if(art.dataset[key]!==text)art.dataset[key]=text;
  }
 };
 const revealPreview=callback=>{requestAnimationFrame(()=>{if(d.isConnected)callback()})};
 const previewMotion=mood=>revealPreview(()=>playCharacter(d.querySelector('.avatar-preview'),mood,null,{force:true}));
 const heroButton=document.createElement('button');heroButton.type='button';heroButton.textContent=t('Renkio!');heroButton.onclick=()=>revealPreview(()=>previewCelebration(d.querySelector('.avatar-preview')));d.querySelector('.expression-preview').append(heroButton);
 const drawAnimations=()=>{
  for(const tab of d.querySelectorAll('[data-editor-tab]'))tab.setAttribute('aria-selected',String(tab.dataset.editorTab===editorTab));
  d.querySelector('.avatar-look-panel').hidden=editorTab!=='look';d.querySelector('.avatar-animation-settings').hidden=editorTab!=='motion';
  for(const tab of d.querySelectorAll('[data-animation-group]'))tab.setAttribute('aria-selected',String(tab.dataset.animationGroup===animationGroup));
  const host=d.querySelector('.animation-choice-grid');
  if(shownAnimationGroup!==animationGroup){
   shownAnimationGroup=animationGroup;
   host.replaceChildren(...ANIMATION_OPTIONS[animationGroup].map(option=>{
    const b=document.createElement('button');b.type='button';b.className='animation-choice';b.dataset.animationChoice=option.id;
    b.innerHTML=previewIcon;
    const label=document.createElement('span');label.textContent=t(option.name);b.append(label);
    b.onclick=()=>{if(busy)return;draft.animations={...draft.animations,[animationGroup]:option.id};draw();previewMotion(option.clip)};
    return b;
   }));
  }
  for(const b of host.children)b.setAttribute('aria-pressed',String(draft.animations[animationGroup]===b.dataset.animationChoice));
 };
 for(const [tab,label]of [['look','Görünüm'],['motion','Hareketler']]){const b=document.createElement('button');b.type='button';b.dataset.editorTab=tab;b.setAttribute('role','tab');b.setAttribute('aria-controls',tab==='look'?'avatar-look-panel':'avatar-animation-panel');b.textContent=t(label);b.onclick=()=>{editorTab=tab;drawAnimations()};d.querySelector('.avatar-editor-tabs').append(b)}
 for(const [key,label]of [['greeting','Selamlama'],['win','Kazanma'],['loss','Kaybetme']]){const b=document.createElement('button');b.type='button';b.dataset.animationGroup=key;b.setAttribute('role','tab');b.textContent=t(label);b.onclick=()=>{animationGroup=key;drawAnimations()};d.querySelector('.animation-category-tabs').append(b)}
 d.querySelector('.animation-preview').onclick=()=>previewMotion(ANIMATION_OPTIONS[animationGroup].find(o=>o.id===draft.animations[animationGroup]).clip);
 const draw=()=>{
  const items=accessoryList(draft.accessories??draft.accessory);
  const displayed=pending?toggleAccessory(items,pending.id):items;
  const preview=d.querySelector('.avatar-preview');draft.accessories=items;delete draft.accessory;
  if(!preview.querySelector('.character-art'))preview.innerHTML=avatarArt(draft);
  const shown=preview.querySelector('.character-art');
  updateArt(shown,{character:draft.face,colour:draft.color,accessory:displayed.join(',')||'none',accessoryColours:accessoryColourKey(draft.accessoryColors),animationGreeting:draft.animations.greeting,animationWin:draft.animations.win,animationLoss:draft.animations.loss});
  if(!shown.classList.contains('character-'+draft.face))shown.className='character-art character-'+draft.face;
  preview.disabled=busy;
  d.querySelector('.avatar-character-name').textContent=t(AVATAR_NAMES[draft.face]);drawAnimations();
  [...d.querySelector('.avatar-choices').children].forEach((b,i)=>{if(!b.querySelector('.character-art'))b.innerHTML='<span class="avatar-choice-art">'+avatarArt({face:i,color:draft.color})+'</span><span class="avatar-choice-name">'+t(AVATAR_NAMES[i])+'</span>';else updateArt(b.querySelector('.character-art'),{colour:draft.color});b.setAttribute('aria-pressed',String(i===draft.face))});
  [...d.querySelector('.avatar-colors').children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===draft.color)));
  d.querySelector('.avatar-wallet').textContent=diamonds+' ♦';d.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.category===category)));
  const shelf=d.querySelector('.accessory-shelf');
  if(shelfCategory!==category){
   shelfCategory=category;
   shelf.replaceChildren(...ACCESSORIES.filter(item=>item.slot===category).map(item=>{
    const b=document.createElement('button');
    b.type='button';b.className='accessory-item';b.dataset.accessoryChoice=item.id;
    b.innerHTML='<span class="accessory-model">'+avatarArt({face:draft.face,color:draft.color,accessories:[item.id],accessoryColors:draft.accessoryColors})+'</span><span></span><small></small>';
    b.children[1].textContent=t(item.name);
    b.querySelector('.character-art').dataset.accessoryPreview=item.id;
    b.onclick=()=>selectAccessory(item);
    return b;
   }));
  }
  for(const b of shelf.children){
   const item=accessoryById(b.dataset.accessoryChoice);
   const hasItem=owned.has(item.id),art=b.querySelector('.character-art');
   updateArt(art,{character:draft.face,colour:draft.color,accessoryColours:accessoryColourKey(draft.accessoryColors)});
   if(!art.classList.contains('character-'+draft.face))art.className='character-art character-'+draft.face;
   b.setAttribute('aria-label',hasItem?t(item.name):t(item.name)+' · '+roundPrice(item.price)+(insufficient(item)?' · '+t(insufficientMessage):''));
   b.setAttribute('aria-pressed',String(displayed.includes(item.id)));
   b.dataset.pendingPurchase=String(pending?.id===item.id);
   b.dataset.unaffordable=String(!hasItem&&insufficient(item));
   b.lastElementChild.hidden=hasItem;
   b.lastElementChild.textContent=hasItem?'':roundPrice(item.price);
   b.disabled=busy;
  }
  const colours=d.querySelector('.accessory-colours');
  colours.hidden=!displayed.some(id=>accessoryById(id)?.slot===category);
  const label={face:'Gözlük',neck:'Papyon',head:'Başlık'}[category];
  colours.setAttribute('aria-label',t(label)+' · '+t('Renk'));
  for(const [i,b]of [...colours.children].entries()){
   b.setAttribute('aria-label',t(label)+' · '+t(ACCESSORY_COLOURS[i].name));
   b.setAttribute('aria-pressed',String((draft.accessoryColors?.[category]||0)===i));
  }
  const equipped=d.querySelector('.equipped-accessories');
  if(equipped.dataset.items!==displayed.join(',')){
   equipped.dataset.items=displayed.join(',');
   equipped.replaceChildren(...displayed.map(id=>{
    const b=document.createElement('button');b.type='button';
    b.innerHTML=artIcon(id)+'<span>×</span>';
    b.setAttribute('aria-label',t(accessoryById(id).name)+' · '+t('Çıkar'));
    b.onclick=()=>{if(busy)return;if(pending?.id===id)pending=null;else draft.accessories=toggleAccessory(draft.accessories,id);draw()};
    return b;
   }));
  }
  cta.disabled=busy;
  cta.dataset.action=pending?'buy':'save';
  cta.textContent=busy?t(pending?'Satın alınıyor…':'Kaydediliyor…'):pending?t('Satın Al')+' ('+roundPrice(pending.price)+')':t('Kaydet ve Çık');
  d.querySelector('.drawer-heading button').disabled=busy;
 };
 for(let i=0;i<AVATAR_NAMES.length;i++){const b=document.createElement('button');b.type='button';b.className='avatar-option';b.setAttribute('aria-label',t(AVATAR_NAMES[i]));b.onclick=()=>{if(busy)return;draft.face=i;draw()};d.querySelector('.avatar-choices').append(b)}
 for(let i=0;i<8;i++){const b=document.createElement('button');b.type='button';b.className='avatar-color';b.style.background=CHARACTER_TINTS[i].hex||'conic-gradient(#ad86df,#edb32a,#55c7e8,#eb8b53,#ad86df)';b.dataset.original=String(i===0);b.setAttribute('aria-label',t(CHARACTER_TINTS[i].name));b.onclick=()=>{if(busy)return;draft.color=i;draw()};d.querySelector('.avatar-colors').append(b)}
 for(const [i,c]of ACCESSORY_COLOURS.entries()){
  const b=document.createElement('button');b.type='button';
  b.style.background=c.hex||'conic-gradient(#9868dc,#e6b65f,#302c43,#9868dc)';
  b.onclick=()=>{if(busy)return;draft.accessoryColors=normalizeAccessoryColours({...draft.accessoryColors,[category]:i});draw()};
  d.querySelector('.accessory-colours').append(b);
 }
 for(const [slot,id,label]of [['face','glasses','Gözlük'],['neck','bow','Papyon'],['head','cap','Başlık']]){const b=document.createElement('button');b.type='button';b.dataset.category=slot;b.setAttribute('role','tab');b.innerHTML=artIcon(id)+'<span>'+t(label)+'</span>';b.onclick=()=>{category=slot;draw()};d.querySelector('.accessory-categories').append(b)}
 d.addEventListener('cancel',event=>{event.preventDefault();close()});
 document.body.append(d);draw();d.showModal();
 refreshWallet().catch(()=>{});
}

