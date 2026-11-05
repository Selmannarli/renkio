import test from 'node:test';
import assert from 'node:assert/strict';
import {registerReferral,rewardReferralMatch,rewardView} from '../rewards.mjs';

test('a new player and their inviter earn the reward once after both play a real match',()=>{
 const state={profiles:{new:{createdAt:1000},host:{createdAt:100},other:{createdAt:100}},matches:[]};
 const room={seats:[{playerId:'new'},{playerId:'host'}]};
 const record={at:3000,players:[{id:'new'},{id:'host'}],moves:[{actor:0,tiles:[{}]}]};
 assert.equal(registerReferral(state,'new','new',2000),false);
 assert.equal(registerReferral(state,'new','host',2000),true);
 assert.equal(registerReferral(state,'new','other',2000),false);
 rewardReferralMatch(state,room,record);
 assert.equal(rewardView(state.profiles.new).diamonds,0);
 record.moves.push({actor:1,tiles:[{}]});
 rewardReferralMatch(state,room,{...record,players:[record.players[0],{...record.players[1],bot:true}]});
 assert.equal(rewardView(state.profiles.new).diamonds,0);
 rewardReferralMatch(state,room,record);
 rewardReferralMatch(state,room,record);
 assert.equal(rewardView(state.profiles.new).diamonds,50);
 assert.equal(rewardView(state.profiles.host).diamonds,50);
});

test('existing players cannot attribute an invitation retroactively',()=>{
 const state={profiles:{old:{createdAt:100},host:{createdAt:100}},matches:[]};
 assert.equal(registerReferral(state,'old','host',3*86400000),false);
 state.matches.push({players:[{id:'old'}]});
 assert.equal(registerReferral(state,'old','host',200),false);
});
