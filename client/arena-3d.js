import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// All geometry and materials ship in the APK. No external assets are fetched.
const world=window.arenaWorld;
const old=document.getElementById('arena'),host=document.createElement('div');
host.style.cssText='position:relative;width:100%;aspect-ratio:920/560;background:#111b22;overflow:hidden';old.before(host);
try {
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
 host.append(renderer.domElement);renderer.domElement.style.cssText='width:100%;height:100%;display:block;touch-action:none';
 old.style.display='none';window.webglArenaActive=true;
 const scene=new T.Scene();scene.background=new T.Color('#91a6b5');scene.fog=new T.Fog('#91a6b5',1800,5500);
 const camera=new T.PerspectiveCamera(48,1,2,7000);
 scene.add(new T.HemisphereLight(0xd9f0ff,0x424332,2.5));
 const sun=new T.DirectionalLight(0xffe4b3,3.1);sun.position.set(600,1500,500);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-1800;sun.shadow.camera.right=1800;sun.shadow.camera.top=1800;sun.shadow.camera.bottom=-1800;sun.shadow.camera.far=4000;sun.shadow.bias=-.0005;scene.add(sun);
 const material=(color,metalness=.1)=>new T.MeshStandardMaterial({color,roughness:.72,metalness});
 const mats={track:material('#20282b'),steel:material('#708387',.6),glass:material('#51c8e7',.4),road:material('#303b3c'),roof:material('#45555a'),rubble:material('#737976'),health:material('#44ee99'),ammo:material('#ffaa45'),overdrive:material('#ac74ff'),shield:material('#47caff')};
 function box(group,x,y,z,w,h,d,mat){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh}
 function sphere(group,x,y,z,r,mat){const mesh=new T.Mesh(new T.SphereGeometry(r,10,8),mat);mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);return mesh}
 function barrel(group,x,y,z,len,r,mat){const mesh=new T.Mesh(new T.CylinderGeometry(r,r,len,10),mat);mesh.rotation.z=Math.PI/2;mesh.position.set(x+len/2,y,z);mesh.castShadow=true;group.add(mesh)}
 const groundGroup=new T.Group();scene.add(groundGroup);
 let map=null,rev=-1;const structures=new Map(),units=new Map(),drops=new Map();
 const clear=g=>{while(g.children.length){const child=g.children[0];g.remove(child);child.traverse(o=>o.geometry?.dispose());}};
 function landscape(w){clear(groundGroup);const turf=material(w.map==='volcanic'?'#4a403a':w.map==='canyon'?'#81705b':'#65705a');box(groundGroup,w.W/2,-8,w.H/2,w.W+150,12,w.H+150,turf);box(groundGroup,w.W/2,0,w.H*.45,w.W,2,160,mats.road);
  for(let i=0;i<12;i++)box(groundGroup,210+i*205,1,w.H/2,45,2,w.H,mats.road);
  for(let i=0;i<7;i++)box(groundGroup,w.W/2,1,45+i*235,w.W,2,35,mats.road);
  for(let i=0;i<40;i++)box(groundGroup,30+i*75,3,w.H*.45,28,1,3,material('#a5a88c'));
  if(w.map==='coast')box(groundGroup,w.W/2,2,w.H*.8,w.W,4,w.H*.4,material('#276c8a',.4));
  if(w.map==='volcanic'){const crater=new T.Mesh(new T.CylinderGeometry(95,110,8,24),material('#ed6836'));crater.position.set(w.W*.5,5,w.H*.22);groundGroup.add(crater)}
 }
 const walls=['#b09c85','#819393','#b0aaa0'].map(c=>material(c));
 function building(b){const g=new T.Group();g.position.set(b.x,0,b.y);const style=b.style??structures.size%4,wall=walls[style%3];box(g,b.w/2,b.height/2,b.h/2,b.w,b.height,b.h,wall);box(g,b.w/2,b.height+3,b.h/2,b.w+5,6,b.h+5,mats.roof);if(style===1){const roof=box(g,b.w/2,b.height+12,b.h/2,b.w+5,14,b.h+5,mats.roof);roof.rotation.z=.08}else if(style===2){box(g,b.w*.3,b.height+18,b.h*.4,b.w*.4,30,b.h*.5,wall);box(g,b.w*.3,b.height+35,b.h*.4,b.w*.45,5,b.h*.55,mats.roof)}else if(style===3){for(const x of [b.w*.25,b.w*.75]){const tank=new T.Mesh(new T.CylinderGeometry(12,12,28,10),mats.steel);tank.position.set(x,b.height+14,b.h*.6);g.add(tank)}box(g,b.w*.8,b.height+35,b.h*.25,8,70,8,mats.steel)}
  for(let y=14;y<b.height-12;y+=24)for(let x=12;x<b.w-9;x+=20){box(g,x,y,-1,9,12,2,mats.glass);box(g,x,y,b.h+1,9,12,2,mats.glass)}
  box(g,b.w*.7,b.height+10,b.h*.6,20,14,22,mats.steel);
  const batches=new Map();for(const mesh of g.children){mesh.updateMatrix();if(!batches.has(mesh.material))batches.set(mesh.material,[]);batches.get(mesh.material).push(mesh.geometry.clone().applyMatrix4(mesh.matrix))}clear(g);for(const [mat,geometries] of batches){const mesh=new T.Mesh(mergeGeometries(geometries),mat);mesh.castShadow=mat!==mats.glass;mesh.receiveShadow=true;g.add(mesh);for(const geometry of geometries)geometry.dispose()}
  scene.add(g);return {g,destroyed:false,b};
 }
 const paints=new Map();function paintFor(color){if(!paints.has(color))paints.set(color,material(color,.3));return paints.get(color)}
 function makeUnit(t){const g=new T.Group(),body=new T.Group(),turret=new T.Group();g.add(body,turret);const friendly=t.team==='player',skin=t.skin||world().skin,paint=paintFor(friendly?({olive:'#a5c461',arctic:'#cee2ed',sunset:'#eab067',neon:'#88f0cc'}[skin]||'#a5c461'):'#d98058'),uniform=paintFor(friendly?({olive:'#607b4b',arctic:'#a5bbc6',sunset:'#bc8045',neon:'#497c71'}[skin]||'#607b4b'):'#985846');g.userData.skin=skin;
  if(['infantry','rocket','sniper','medic','engineer'].includes(t.type)){
   box(body,0,10,0,8,19,11,uniform);box(body,1,27,0,12,16,15,uniform);sphere(body,1,39,0,7,paint);box(body,7,28,-10,5,13,4,uniform);box(body,7,28,10,5,13,4,uniform);
   turret.position.y=29;barrel(turret,3,0,4,t.type==='sniper'?29:19,t.type==='rocket'?4:1.8,mats.steel);if(t.type==='rocket')box(turret,0,2,5,18,8,8,mats.track);if(t.type==='medic'){box(body,-8,28,0,7,14,17,mats.health);box(body,-12,29,0,2,10,3,mats.steel)}if(t.type==='engineer')box(body,-8,28,0,8,14,16,mats.ammo);
  }else if(t.type==='helicopter'){
   box(body,0,14,0,36,20,22,paint);sphere(body,17,15,0,11,mats.glass);box(body,-30,14,0,38,6,6,paint);box(body,-48,20,0,5,18,12,paint);box(body,0,-2,-14,38,3,3,mats.steel);box(body,0,-2,14,38,3,3,mats.steel);
   const rotor=new T.Group();rotor.position.y=30;box(rotor,0,0,0,110,2,4,mats.track);box(rotor,0,0,0,4,2,110,mats.track);body.add(rotor);g.userData.rotor=rotor;barrel(turret,15,3,0,18,3,mats.steel);
  }else if(t.type==='scout'){
   box(body,0,16,0,44,13,25,paint);box(body,-5,29,0,24,16,23,paint);box(body,9,31,0,2,10,21,mats.glass);for(const x of [-15,15])for(const z of [-16,16])sphere(body,x,9,z,8,mats.track);turret.position.y=40;box(turret,0,0,0,12,8,12,paint);barrel(turret,4,1,0,22,2,mats.steel);box(body,-15,46,8,2,22,2,mats.steel);
  }else if(t.type==='boat'){
   box(body,0,9,0,70,16,30,paint);box(body,-8,23,0,25,20,20,paint);box(body,-8,37,0,3,15,3,mats.steel);turret.position.set(16,20,0);box(turret,0,0,0,18,10,18,paint);barrel(turret,4,5,0,26,3,mats.steel);
  }else{
   box(body,0,10,-19,53,19,13,mats.track);box(body,0,10,19,53,19,13,mats.track);
   for(let x=-20;x<25;x+=10)for(const z of [-26,26])sphere(body,x,10,z,5,mats.steel);
   box(body,0,21,0,50,15,32,paint);box(body,-14,31,0,14,5,18,mats.steel);turret.position.y=31;box(turret,0,4,0,26,14,26,paint);barrel(turret,8,5,0,t.type==='artillery'?55:37,t.type==='artillery'?4.5:3,mats.steel);box(turret,-6,15,0,10,4,12,mats.steel);
  }
  const hp=new T.Group();const back=box(hp,0,0,0,46,4,2,mats.track),fill=box(hp,0,0,1.2,44,3,1,material(friendly?'#b9f66b':'#ff8c6b'));hp.position.y=t.type==='helicopter'?55:55;g.add(hp);
  const ring=new T.Mesh(new T.RingGeometry(t.r+7,t.r+10,28),new T.MeshBasicMaterial({color:friendly?0xc7ff76:0xff9477,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=2;g.add(ring);scene.add(g);return {g,body,turret,hp,fill,ring,type:t.type,team:t.team};
 }
 const fx=new T.Group();scene.add(fx);const shotGeometry=new T.SphereGeometry(3,6,4);const shotMats=[new T.MeshBasicMaterial({color:0xfff0a0}),new T.MeshBasicMaterial({color:0xff9057})];
 const ui=document.createElement('div');ui.style.cssText='position:absolute;top:8px;left:8px;right:8px;display:flex;gap:5px;align-items:center;pointer-events:none';host.append(ui);
 function button(label,fn){const b=document.createElement('button');b.className='tiny';b.textContent=label;b.style.pointerEvents='auto';b.onclick=fn;ui.append(b);return b}
 let overview=false,yaw=.7,zoom=680,drag=null,pan={x:0,z:0};button('Follow squad',()=>{overview=false;pan={x:0,z:0}});button('Whole map',()=>overview=true);button('−',()=>zoom=Math.min(1800,zoom*1.25));button('+',()=>zoom=Math.max(220,zoom/1.25));const label=document.createElement('span');label.style.cssText='font:10px system-ui;color:white;background:#17251bcc;padding:5px;border-radius:6px';ui.append(label);
 const mini=document.createElement('canvas');mini.width=180;mini.height=110;mini.style.cssText='position:absolute;right:8px;bottom:8px;width:120px;height:74px;border:1px solid #9ba982;border-radius:5px;background:#192722;cursor:pointer';mini.setAttribute('aria-label','Battlefield minimap; tap to move camera');host.append(mini);const mc=mini.getContext('2d');
 mini.onclick=e=>{const w=world(),r=mini.getBoundingClientRect();pan={x:(e.clientX-r.left)/r.width*w.W,z:(e.clientY-r.top)/r.height*w.H};overview=false;manual=true};let manual=false;
 ui.children[0].addEventListener('click',()=>manual=false);
 renderer.domElement.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId)};renderer.domElement.onpointerup=()=>drag=null;renderer.domElement.onpointermove=e=>{if(drag){yaw+=(e.clientX-drag.x)*.008;zoom=Math.max(220,Math.min(1800,zoom+(e.clientY-drag.y)*2));drag={x:e.clientX,y:e.clientY}}};renderer.domElement.onwheel=e=>{e.preventDefault();zoom=Math.max(220,Math.min(1800,zoom+e.deltaY))};
 let last=0;function render(now){requestAnimationFrame(render);if(now-last<30)return;last=now;const w=world();if(!w)return;const width=host.clientWidth,height=host.clientHeight;if(renderer.domElement.width!==Math.floor(width*renderer.getPixelRatio())||renderer.domElement.height!==Math.floor(height*renderer.getPixelRatio())){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix()}
  if(map!==w.map){map=w.map;landscape(w);rev=-1}if(rev!==w.worldRevision){for(const o of structures.values()){scene.remove(o.g);clear(o.g)}structures.clear();for(const b of w.buildings)structures.set(b.id,building(b));rev=w.worldRevision}
  for(const b of w.buildings){const o=structures.get(b.id);if(!o)continue;if(b.destroyed&&!o.destroyed){clear(o.g);o.chunks=[];const count=4+(b.style%2||0);for(let i=0;i<count;i++){const angle=i/count*Math.PI*2,chunk=box(o.g,b.w/2,b.height/2,b.h/2,b.w*.38,Math.max(12,b.height*.35),b.h*.38,mats.rubble);o.chunks.push({chunk,angle})}o.destroyed=true}if(b.destroyed){const age=Math.max(0,w.elapsed-(b.destroyedAt||0)),flight=Math.min(1,age/1.1);for(const {chunk,angle}of o.chunks||[]){chunk.position.set(b.w/2+Math.cos(angle)*flight*b.w*.65,Math.max(7,b.height*.5*(1-flight)+Math.sin(flight*Math.PI)*70),b.h/2+Math.sin(angle)*flight*b.h*.65);chunk.rotation.set(flight*1.1,angle,flight*.8);chunk.scale.y=1-flight*.65}}else o.g.scale.y=.94+.06*b.hp/b.maxHp}
  const ids=new Set(w.battleUnits.filter(t=>t.hp>0).map(t=>t.id));for(const [id,o]of units)if(!ids.has(id)){scene.remove(o.g);clear(o.g);units.delete(id)}
  for(const t of w.battleUnits.filter(t=>t.hp>0)){let o=units.get(t.id);if(o&&(o.type!==t.type||o.team!==t.team||o.g.userData.skin!==(t.skin||w.skin))){scene.remove(o.g);clear(o.g);units.delete(t.id);o=null}if(!o){o=makeUnit(t);units.set(t.id,o)}o.g.position.set(t.x,t.stats.flying?85+Math.sin(now*.003+t.phase)*5:0,t.y);o.body.rotation.y=-t.heading;o.turret.rotation.y=-t.angle;o.g.visible=true;o.body.rotation.z=t.hp<=0?.12:0;o.fill.scale.x=Math.max(.001,t.hp/t.maxHp);o.hp.visible=t.hp>0;o.hp.quaternion.copy(camera.quaternion);o.ring.visible=t.hp>0;o.ring.material.opacity=t.id===w.selectedId?1:.55;if(o.g.userData.rotor)o.g.userData.rotor.rotation.y=now*.035}
  for(const [id,o]of drops)if(!w.pickups[id]||w.pickups[id].used){scene.remove(o);clear(o);drops.delete(id)}for(let i=0;i<w.pickups.length;i++){const p=w.pickups[i];if(p.used)continue;let g=drops.get(i);if(!g){g=new T.Group();const mat=mats[p.kind]||mats.ammo;box(g,0,12,0,19,18,19,mat);if(p.kind==='health'){box(g,0,22,0,15,2,5,material('#ffffff'));box(g,0,23,0,5,2,15,material('#ffffff'))}const ring=new T.Mesh(new T.RingGeometry(22,24,20),new T.MeshBasicMaterial({color:mat.color,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;g.add(ring);scene.add(g);drops.set(i,g)}g.position.set(p.x,4+Math.sin(now*.002+i)*3,p.y);g.rotation.y=now*.0007}
  while(fx.children.length)fx.remove(fx.children[0]);for(const s of w.shots){const m=new T.Mesh(shotGeometry,shotMats[s.team==='player'?0:1]);m.position.set(s.x,s.indirect?70:27,s.y);m.scale.set(s.radius?2:1,1,1);fx.add(m)}
  for(const s of w.sparks){const m=new T.Mesh(shotGeometry,shotMats[0]);m.position.set(s.x,24,s.y);m.scale.setScalar(3+s.life*10);fx.add(m)}
  const allies=w.battleUnits.filter(t=>t.team==='player'&&t.hp>0),selected=allies.find(t=>t.id===w.selectedId)||allies[0];let target=new T.Vector3(overview?w.W/2:manual?pan.x:selected?.x||w.W/2,0,overview?w.H/2:manual?pan.z:selected?.y||w.H/2),dist=overview?Math.max(w.W*1.1,w.H*1.8/camera.aspect):zoom;
  const desired=new T.Vector3(target.x+Math.sin(yaw)*dist*.7,dist*.86,target.z+Math.cos(yaw)*dist*.7);camera.position.lerp(desired,.13);camera.lookAt(target);sun.target.position.copy(target);sun.target.updateMatrixWorld();renderer.render(scene,camera);
  mc.fillStyle='#17221b';mc.fillRect(0,0,180,110);mc.fillStyle='#73827b';for(const b of w.buildings)if(!b.destroyed)mc.fillRect(b.x/w.W*180,b.y/w.H*110,b.w/w.W*180,b.h/w.H*110);for(const p of w.pickups)if(!p.used){mc.fillStyle=p.kind==='health'?'#65e6a3':'#b28bff';mc.fillRect(p.x/w.W*180,p.y/w.H*110,2,2)}for(const t of w.battleUnits)if(t.hp>0){mc.fillStyle=t.team==='player'?'#c9ff7c':'#ff8867';mc.beginPath();mc.arc(t.x/w.W*180,t.y/w.H*110,3,0,7);mc.fill()}
  mc.strokeStyle='#ffffff';mc.strokeRect(target.x/w.W*180-12,target.z/w.H*110-8,24,16);label.textContent=(selected?.pickupEffectUntil>w.elapsed?selected.pickupEffect+' · ':'')+'3D · '+Math.ceil(w.elapsed)+' / 180s · '+w.buildings.filter(b=>!b.destroyed).length+' buildings';
 }
 requestAnimationFrame(render);
}catch(error){host.textContent='Compatibility graphics active. Battles and pasted scripts still work.';host.style.cssText='padding:10px;color:#d7fb75;font:13px system-ui';old.style.display='block';window.webglArenaActive=false;console.warn('Using compatibility renderer:',error.message)}

