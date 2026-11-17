import * as T from 'three';
import {acceleratedRaycast,computeBoundsTree} from 'three-mesh-bvh';
import {writeFile} from 'node:fs/promises';
// Indirect BVH preserves source vertex/index ordering and exported seams.
T.Mesh.prototype.raycast=function(raycaster,hits){if(!this.geometry.boundsTree)computeBoundsTree.call(this.geometry,{indirect:true});return acceleratedRaycast.call(this,raycaster,hits)};
const output=new URL('../client/accessory-surfaces.mjs',import.meta.url);
await writeFile(output,'export const BAKED_ACCESSORY_FITS={};\n');
const {createCharacter,disposePerson}=await import('../client/characters.mjs');
const ids=['bow','silkBow','royalBow','glasses','shades','stargaze','cap','beanie','crown','astralCrown'],data={};
for(let face=0;face<7;face++)for(const id of ids){const root=createCharacter(face,0,'standing',[id]),mount=root.getObjectByName('Accessory-'+id);data[face+':'+id]={at:mount.position.toArray(),patch:[],...(mount.userData.contact?{contact:mount.userData.contact}:{})};console.log(face,id,'clearance shift',mount.userData.clearanceShift?.toFixed(4));disposePerson(root)}
await writeFile(output,'// Offline rigid-item fits and anatomical contact cuffs. No runtime collision work.\nexport const BAKED_ACCESSORY_FITS='+JSON.stringify(data)+';\n');
console.log('Baked',Object.keys(data).length,'independent anatomical wardrobe fits');
