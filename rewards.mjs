import {accessoryById,ACCESSORIES} from './public/character-style.mjs';
const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
export const rewardDay=(now=Date.now())=>dayFormat.format(new Date(now));
export const SUPPORT_PRICE=5;
export const dailyRewardAmount=claimedDays=>(Math.max(0,Number(claimedDays)||0)%5+1)*10;
function economy(profile){
 if(!profile.economy){const old=profile.reward||{};profile.economy={version:2,diamonds:0,inventory:{joker:Math.max(0,old.balance||0),hint:0},lastClaim:old.lastClaim,claimedDays:old.claimedDays||0,receipts:[]}}
 return profile.economy;
}
export const REFERRAL_REWARD=50;
export function registerReferral(state,invitee,inviter,now=Date.now()){
 const profile=state.profiles[invitee],host=state.profiles[inviter];
 if(!profile||!host||invitee===inviter)return false;
 if(profile.referral)return profile.referral.inviter===inviter;
 if(!Number.isFinite(profile.createdAt)||now-profile.createdAt>2*86400000||host.createdAt>=profile.createdAt||
    state.matches.some(match=>match.players.some(player=>player.id===invitee)))return false;
 profile.referral={inviter,at:now};
 return true;
}
export function rewardReferralMatch(state,room,record){
 if(record.players.length!==2||record.players.some(player=>player.bot))return;
 const actors=new Set(record.moves.filter(move=>move.tiles?.length).map(move=>move.actor));
 if(!actors.has(0)||!actors.has(1))return;
 for(let i=0;i<2;i++){
  const id=room.seats[i]?.playerId,other=room.seats[1-i]?.playerId;
  const profile=state.profiles[id],inviter=state.profiles[other];
  if(!profile||!inviter||id===other||profile.referral?.inviter!==other||profile.referral.paidAt)continue;
  profile.referral.paidAt=record.at||Date.now();
  economy(profile).diamonds+=REFERRAL_REWARD;
  economy(inviter).diamonds+=REFERRAL_REWARD;
 }
}
export const OCTOBER_GIFT_CUTOFF=Date.parse('2026-11-01T00:00:00+01:00');
export function grantOctoberGift(profile,now=Date.now()){
 if(!Number.isFinite(profile.createdAt)||profile.createdAt>=OCTOBER_GIFT_CUTOFF||profile.createdAt>now||profile.octoberGift2026)return false;
 const e=economy(profile);e.diamonds+=500;profile.octoberGift2026={amount:500,at:now};return true;
}
export function rewardView(profile,now=Date.now()){const e=economy(profile);return {octoberGift:profile.octoberGift2026||null,diamonds:e.diamonds,admin:!!e.unlimited,inventory:{...e.inventory},balance:e.inventory.joker,available:e.lastClaim!==rewardDay(now),claimedDays:e.claimedDays,nextAmount:dailyRewardAmount(e.claimedDays),day:rewardDay(now),accessories:[...new Set([...ACCESSORIES.filter(a=>!a.price).map(a=>a.id),...(e.accessories||[])])]}}
export function claimReward(profile,now=Date.now()){
 if(!rewardView(profile,now).available)throw Error('Bugünün ödülünü zaten topladın.');
 const e=economy(profile);e.diamonds+=dailyRewardAmount(e.claimedDays);e.lastClaim=rewardDay(now);e.claimedDays++;return rewardView(profile,now);
}
function itemCheck(item){if(!['joker','hint'].includes(item))throw Error('Bu destek bulunamadı.')}
function receiptCheck(e,id,item,kind){
 if(typeof id!=='string'||!/^[-\w]{16,80}$/.test(id))throw Error('İşlem kimliği geçersiz.');
 const previous=e.receipts.find(r=>r.id===id);if(previous&&(previous.item!==item||previous.kind!==kind))throw Error('İşlem kimliği daha önce kullanıldı.');return !!previous;
}
function remember(e,id,item,kind){e.receipts.push({id,item,kind});e.receipts=e.receipts.slice(-200)}
export function buySupport(profile,item,receipt){
 itemCheck(item);const e=economy(profile);if(receiptCheck(e,receipt,item,'buy'))return rewardView(profile);
 if(!e.unlimited&&e.diamonds<SUPPORT_PRICE)throw Error('Yeterli elmasın yok.');
 if(!e.unlimited)e.diamonds-=SUPPORT_PRICE;e.inventory[item]++;remember(e,receipt,item,'buy');return rewardView(profile);
}
export function consumeSupport(profile,item,receipt){
 itemCheck(item);const e=economy(profile);if(receipt&&receiptCheck(e,receipt,item,'use'))return rewardView(profile);
 if(!e.inventory[item])throw Error('Bu desteğin kalmamış. Mağazadan alabilirsin.');
 if(!e.unlimited)e.inventory[item]--;if(receipt)remember(e,receipt,item,'use');return rewardView(profile);
}
export function prepareJoker(game,actor,id){
 if(!game.experimental||game.over||game.players[actor]?.eliminated)throw Error('Bu maçta joker kullanılamıyor.');
 const p=game.players[actor];if(p.jokerUsed)throw Error('Bu maçtaki jokerini kullandın.');
 if(!p.hand.some(t=>t.joker))p.hand.push({id,c:0,s:0,joker:true});
 return p.hand.find(t=>t.joker);
}

export function buyAccessory(profile,id,receipt){const item=accessoryById(id);if(!item)throw Error('Aksesuar bulunamadı.');const e=economy(profile);e.accessories??=[];if(!item.price||e.accessories.includes(id))return rewardView(profile);if(receiptCheck(e,receipt,id,'cosmetic'))return rewardView(profile);if(!e.unlimited&&e.diamonds<item.price)throw Error('Yeterli elmasın yok.');if(!e.unlimited)e.diamonds-=item.price;e.accessories.push(id);remember(e,receipt,id,'cosmetic');return rewardView(profile)}
export function ownsAccessory(profile,id){const item=accessoryById(id||'none');return !!(item&&(!item.price||economy(profile).accessories?.includes(id)))}
