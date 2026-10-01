/* Rawaq — cinematic construction hero */
import * as T from './three.module.min.js';

const PI=Math.PI, clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)), smooth=v=>{v=clamp(v);return v*v*(3-2*v)}, lerp=(a,b,t)=>a+(b-a)*t;
const M=(color,rough=.7,metal=0,emissive=0)=>new T.MeshStandardMaterial({color,roughness:rough,metalness:metal,emissive:emissive?color:0,emissiveIntensity:emissive});
const box=(g,w,h,d,m,x=0,y=0,z=0)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y+h/2,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
const cyl=(g,r,h,m,x,y,z,seg=20)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,h,seg),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
function labelTexture(title,sub){const c=document.createElement('canvas');c.width=1024;c.height=420;const x=c.getContext('2d');x.fillStyle='#101214';x.fillRect(0,0,c.width,c.height);const gr=x.createLinearGradient(0,0,c.width,c.height);gr.addColorStop(0,'#d6a15c');gr.addColorStop(1,'#f1dfbd');x.strokeStyle=gr;x.lineWidth=12;x.strokeRect(26,26,c.width-52,c.height-52);x.fillStyle='#f5f2eb';x.textAlign='center';x.font='800 94px Arial';x.fillText(title,c.width/2,190);x.fillStyle='#b9b2a6';x.font='500 34px Arial';x.fillText(sub,c.width/2,260);x.fillStyle='#d6a15c';x.font='700 25px Arial';x.fillText('RAWAQ MATERIALS WORLD',c.width/2,320);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
function sign(g,title,sub,x,y,z,rot=0){const mat=new T.MeshStandardMaterial({map:labelTexture(title,sub),roughness:.35,metalness:.35,emissive:'#17120d',emissiveIntensity:.12});const o=box(g,4.4,2.0,.16,mat,x,y,z);o.rotation.y=rot;return o;}
function worker(g,x,z,scale=1){const p=new T.Group();p.position.set(x,.12,z);p.scale.setScalar(scale);g.add(p);const body=M('#30363b',.7), helmet=M('#e8b24d',.45,.1), skin=M('#b87a55',.8);box(p,.48,.95,.28,body,0,0,0);cyl(p,.17,.32,skin,0,.95,0,16);cyl(p,.23,.12,helmet,0,1.16,0,16);box(p,.14,.65, .14,body,-.18,-.02,0);box(p,.14,.65,.14,body,.18,-.02,0);return p;}
export function createHero(canvas,host){
 const scene=new T.Scene(); scene.fog=new T.Fog('#111418',38,125);
 const cam=new T.PerspectiveCamera(42,1,.1,250); const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const hemi=new T.HemisphereLight('#d9e4ef','#262018',1.25);scene.add(hemi);const sun=new T.DirectionalLight('#ffe0ad',3.8);sun.position.set(-22,34,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;scene.add(sun);
 const fill=new T.PointLight('#d6a15c',70,45,2);fill.position.set(4,8,5);scene.add(fill);
 const world=new T.Group();scene.add(world);const ground=M('#2a2c2d',1);box(world,90,.3,62,ground,0,-.05,0);
 // road and site markings
 box(world,90,.03,9,M('#17191b',1),0,.3,20);for(let i=-40;i<45;i+=6)box(world,3,.035,.18,M('#d8c9a7',.8),i,.33,20);
 // unfinished building
 const b=new T.Group();world.add(b);const concrete=M('#8d9297',.95), steel=M('#596067',.55,.7), brick=M('#b66f4b',.96), glass=new T.MeshStandardMaterial({color:'#6d9eae',roughness:.12,metalness:.45,transparent:true,opacity:.58});
 [0,1,2].forEach(f=>{const y=f*3.5;box(b,18,.32,11,concrete,0,y+.55,0);for(let x=-8;x<=8;x+=2.8){box(b,.22,3.2,.22,steel,x,y+.88,-5.35,false);box(b,.22,3.2,.22,steel,x,y+.88,5.35,false);}for(let z=-4;z<=4;z+=2.7){box(b,.22,3.2,.22,steel,-8.8,y+.88,z,false);box(b,.22,3.2,.22,steel,8.8,y+.88,z,false);}});
 for(let r=0;r<8;r++)for(let c=0;c<6;c++)box(b,2.45,.42,.5,brick,-7.4+c*2.5,.9+r*.43,-5.05+(r%2)*.08);
 // central brand portal under construction
 const portal=new T.Group();world.add(portal);box(portal,11,.4,1.0,steel,0,10.8,-4.2);box(portal,.45,6,.45,steel,-5.2,5.1,-4.2);box(portal,.45,6,.45,steel,5.2,5.1,-4.2);
 const logoMat=new T.MeshStandardMaterial({map:labelTexture('RAWAQ','رواق · مصالح و تجهیزات'),roughness:.3,metalness:.45,emissive:'#6b4926',emissiveIntensity:.18});const logo=box(portal,8.7,2.8,.18,logoMat,0,5.5,-4.7);
 // cranes
 const crane=new T.Group();world.add(crane);crane.position.set(14,0,1);box(crane,.5,17,.5,steel,0,.3,0);box(crane,18,.3,.35,steel,-4,17.1,0);box(crane,10,.18,.18,steel,-12,17.0,0);const trolley=new T.Group();crane.add(trolley);box(trolley,1,.18,.25,steel,-5,16.9,0);const cable=box(trolley,.035,5,.035,M('#bfc4c8',.6,.4),-5,11.8,0,false);const hook=cyl(trolley,.12,.35,steel,-5,9.3,0,12); 
 // scaffolding + lights
 for(let x=-14;x<=14;x+=3.5){box(world,.1,10,.1,steel,x,.4,-7,false);box(world,3.2,.1,.1,steel,x,.4,-7,false);for(let y=2;y<=9;y+=2.2)box(world,3.2,.08,.08,steel,x,y,-7,false)}
 for(let x=-28;x<=28;x+=7){const l=new T.PointLight('#ffd79c',20,16,2);l.position.set(x,7,9);world.add(l);}
 // pallets and vehicles
 for(let i=0;i<7;i++){const p=new T.Group();p.position.set(-20+i*3.2,.32,10+(i%2)*2);world.add(p);box(p,2.5,.18,1.5,M('#8c6847',.95),0,0,0);for(let a=0;a<2;a++)for(let c=0;c<3;c++)box(p,.72,.48,.62,brick,-.75+c*.75,.18,-.3+a*.62);}
 const truck=new T.Group();world.add(truck);truck.position.set(23,.35,16);box(truck,7,1.3,2.5,M('#d7d9d8',.6,.35),0,0,0);box(truck,2.3,1.7,2.4,M('#3b5870',.35,.55),2.3,1.2,0);for(const x of [-2.2,2.2])for(const z of [-1.25,1.25])cyl(truck,.52,.28,M('#151719',.8,.1),x,.45,z,18).rotation.x=PI/2;
 const people=[worker(world,-2,10,1),worker(world,5,8,.9),worker(world,18,10,.95)];
 const signs=[sign(world,'LECA','بلوک و فرآورده‌های سبک',-21,2.2,-8,.1),sign(world,'GACH','گچ ماشینی شرق',-14,2.2,-8,.1),sign(world,'MARKIZ','Markiz',-7,2.2,-8,.1)];
 // dust particles
 const count=450,pos=new Float32Array(count*3);for(let i=0;i<count;i++){pos[i*3]=(Math.random()-.5)*70;pos[i*3+1]=Math.random()*10+.3;pos[i*3+2]=(Math.random()-.5)*35;}const pm=new T.PointsMaterial({color:'#d6c4a8',size:.045,transparent:true,opacity:.32,depthWrite:false});const dust=new T.Points(new T.BufferGeometry(),pm);dust.geometry.setAttribute('position',new T.BufferAttribute(pos,3));world.add(dust);
 let w=1,h=1,t=0,last=0,raf=0,running=true;function resize(){const r=host.getBoundingClientRect();w=Math.max(2,r.width|0);h=Math.max(2,r.height|0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(w,h,false);cam.aspect=w/h;cam.fov=w/h<.8?52:40;cam.updateProjectionMatrix();}
 function frame(now){if(!running)return;raf=requestAnimationFrame(frame);const dt=Math.min(.05,last?(now-last)/1000:.016);last=now;t+=dt*.72;const u=(t%18)/18;const c=smooth((Math.sin(u*Math.PI*2)+1)/2);cam.position.set(31-62*c,10.5+3*Math.sin(t*.35),28-22*c);cam.lookAt(0,5.2,-1.2);crane.rotation.y=Math.sin(t*.5)*.25;trolley.position.x=-5+8*(.5+.5*Math.sin(t*.7));cable.scale.y=.65+.35*(.5+.5*Math.sin(t*.7+1));hook.position.y=9.2-2.0*(.5+.5*Math.sin(t*.7+1));logo.position.y=5.2+.65*(.5+.5*Math.sin(t*.42));logo.material.emissiveIntensity=.12+.16*(.5+.5*Math.sin(t*1.3));people.forEach((p,i)=>{p.position.x+=Math.sin(t*.5+i)*dt*.35;p.position.z+=Math.cos(t*.4+i)*dt*.22;p.position.x=clamp(p.position.x,-20,20);});dust.rotation.y=t*.02;renderer.render(scene,cam);}
 resize();addEventListener('resize',resize,{passive:true});raf=requestAnimationFrame(frame);return{resize,dispose(){running=false;cancelAnimationFrame(raf);renderer.dispose();}};
}
