// Fixed canonical identity verified against Selman / Player 33475. Nicknames confer no privilege.
export const ADMIN_PLAYER_ID='775891289432';
export function ensureAdminFriends(state,now=Date.now()){
 if(!state.profiles[ADMIN_PLAYER_ID])return false;state.friends??=[];let changed=false;
 for(const [id,p]of Object.entries(state.profiles)){if(id===ADMIN_PLAYER_ID||!/^\d{12}$/.test(id)||p.bot||!p.name||p.adminWelcomeLinked)continue;p.adminWelcomeLinked=true;changed=true;const edge=state.friends.find(e=>e.from===id&&e.to===ADMIN_PLAYER_ID||e.to===id&&e.from===ADMIN_PLAYER_ID);if(edge){if(edge.status!=='accepted'){edge.status='accepted';changed=true}}else{state.friends.push({from:ADMIN_PLAYER_ID,to:id,status:'accepted',at:now,source:'admin-welcome'});changed=true}}
 return changed;
}
