import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from 'three';
const source=fs.readFileSync('client/arena-3d.js','utf8');
const helpers=['box','sphere','barrel'].map(name=>source.match(new RegExp('function '+name+'[^\\n]+'))[0]).join('\n');
const modelCode=source.slice(source.indexOf('function makeUnit('),source.indexOf(' const fx='));
const material=color=>new T.MeshStandardMaterial({color}),mats=Object.fromEntries(['track','steel','glass','health','ammo'].map(key=>[key,material('#707070')]));
function model(type){return vm.runInNewContext(helpers+'\n'+modelCode+'\nmakeUnit(unit)',{T,scene:new T.Scene(),world:()=>({skin:'olive'}),material,mats,paintFor:material,unit:{id:type,type,team:'player',tier:1,r:14}})}
const infantry=model('infantry'),soldiers=infantry.g.userData.soldiers;
assert.equal(soldiers.length,4);assert.equal(new Set(soldiers.map(s=>s.soldier.position.x+','+s.soldier.position.z)).size,4);
for(const soldier of soldiers){assert.ok(soldier.soldier.scale.x<1);assert.ok(soldier.hull.children.some(mesh=>mesh.geometry.type==='SphereGeometry'));assert.ok(soldier.gun.children.some(mesh=>mesh.geometry.type==='CylinderGeometry'))}
const artillery=model('artillery'),gun=artillery.turret.children.find(mesh=>mesh.geometry.type==='CylinderGeometry'),axis=new T.Vector3(0,1,0).applyEuler(gun.rotation);
assert.ok(Math.abs(Math.atan2(axis.y,axis.x)*180/Math.PI-72)<.001);assert.ok(new T.Box3().setFromObject(artillery.turret).max.y>70);
const tank=model('tank'),tankGun=tank.turret.children.find(mesh=>mesh.geometry.type==='CylinderGeometry');assert.ok(Math.abs(new T.Vector3(0,1,0).applyEuler(tankGun.rotation).y)<.001);
console.log('Four separate smaller armed infantry models, elevated artillery barrel and unchanged tank gun passed.');
