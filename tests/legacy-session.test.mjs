import test from 'node:test';
import assert from 'node:assert/strict';
import {storedSession} from '../public/legacy-session.mjs';
import {firebaseConfig} from '../public/firebase-config.mjs';
const row=(uid,apiKey,refreshToken,lastLoginAt=0)=>({uid,apiKey,lastLoginAt,stsTokenManager:{refreshToken}});
test('migration selects current project session before obsolete pending credentials',()=>{
 assert.deepEqual(storedSession([row('a',firebaseConfig.apiKey,'current')],{refreshToken:'old'}),{refreshToken:'current'});
});
test('migration refuses ambiguous legacy identities and never invents an account',()=>{
 assert.equal(storedSession([]),null);
 assert.equal(storedSession([row('a','old-a','a'),row('b','old-b','b')]),null);
 assert.deepEqual(storedSession([row('a','old-a','a')]),{legacyRefreshToken:'a'});
});
test('migration ignores malformed persistence and chooses newest current session',()=>{
 assert.deepEqual(storedSession([null,{},row('a',firebaseConfig.apiKey,'first',1),row('b',firebaseConfig.apiKey,'last',2)]),{refreshToken:'last'});
});
