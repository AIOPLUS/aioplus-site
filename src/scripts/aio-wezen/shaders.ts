/**
 * Shaders van AIO als ster (ontwerp: hub docs/agent/MASCOTTE.md, ronde 3).
 * - lijf: korrelig steroppervlak met randverduistering, een gloeiend hart in de labelkleur en een gezicht als SDF.
 *   Met de define KLEIN (menuknop, chatkop) vallen de korrels weg: goedkoper en rustiger op 34–40 px.
 * - corona: stralenkrans om de ster (alleen groot).
 * - vonken: kleine lichtjes in de labelkleur rond de ster (alleen groot).
 */

const RUIS = /* glsl */ `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
    return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  float fbm(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<3;i++){ s+=a*snoise(p); p*=2.03; a*=0.5; } return s; }
  vec3 hash3(vec3 p){ p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453123); }
  float korrel(vec3 p, float t){
    vec3 i=floor(p), f=fract(p); float d=8.0;
    for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){
      vec3 g=vec3(float(x),float(y),float(z)); vec3 o=hash3(i+g); o=0.5+0.45*sin(t+6.2831*o);
      vec3 r=g+o-f; d=min(d,dot(r,r));
    }
    return sqrt(d);
  }`;

const GEZICHT = /* glsl */ `
  float sdRondBox(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
  float sdBoog(vec2 p, vec2 c, float R, float dik, float boven){ vec2 q=p-c; float d=abs(length(q)-R)-dik; return boven>0.5?max(d,-q.y):max(d,q.y); }
  // x: vorm van ogen en mond; y: lichtjes in de ogen; z: iris; w: pupil. De iris en pupil kijken mee (blik, -1..1).
  vec4 gezicht(vec3 p, vec3 f, float ogen, float blij, float lach, float mond, float klein, vec2 blik){
    if (dot(p,f) < 0.25) return vec4(1.0);
    vec3 rechts=normalize(cross(vec3(0.0,1.0,0.0),f)); vec3 op=cross(f,rechts);
    vec2 q=vec2(dot(p,rechts),dot(p,op)) / mix(1.0,1.3,klein);
    float d=1.0, glim=1.0, iris=1.0, pupil=1.0, open=max(ogen,0.06);
    // klein (menuknop): rondere, iets grotere ogen, zodat de blik op 40 px leesbaar blijft
    vec2 maat=mix(vec2(0.07,0.105),vec2(0.078,0.1),klein);
    for (int i=0;i<2;i++){
      vec2 c=vec2(i==0?-0.21:0.21,0.08);
      float oog=sdRondBox(q-c,vec2(maat.x,maat.y*open),maat.x*0.96*min(1.0,open+0.2));
      float boog=sdBoog(q,c-vec2(0.0,0.045),0.072,0.022,1.0);
      d=min(d,mix(oog,boog,blij));
      vec2 ic=c+blik*vec2(maat.x*0.42,maat.y*0.45*min(open,1.0));
      float li=length(q-ic);
      iris=min(iris,max(li-maat.x*0.9,oog)+blij+step(open,0.3));
      pupil=min(pupil,max(li-maat.x*0.4,oog)+blij+step(open,0.3));
      float g=length(q-ic-vec2(-0.3,0.42)*maat.x)-maat.x*0.27;
      glim=min(glim,max(g,oog)+step(open,0.55)+blij);
    }
    float l=abs(lach)*(1.0-klein*(1.0-blij));
    if (l>0.05){
      vec2 c=lach>0.0?vec2(0.0,-0.045):vec2(0.0,-0.26);
      float boog=lach>0.0?sdBoog(q,c,0.14,0.017,0.0):sdBoog(q,c,0.1,0.016,1.0);
      boog=max(boog,abs(q.x-c.x)-(lach>0.0?0.05+0.08*l:0.075));
      d=min(d,boog+(1.0-min(l,1.0))*0.02);
    }
    float m=mond*(1.0-klein);
    if (m>0.03) d=min(d,sdRondBox(q-vec2(0.0,-0.16),vec2(0.04+0.018*m,0.01+0.042*m),0.028+0.01*m));
    return vec4(d,glim,iris,pupil);
  }`;

export const lijfVertex = /* glsl */ `
  varying vec3 vP; varying vec3 vN; varying vec3 vV;
  void main(){ vP=position; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`;

export const lijfFragment = /* glsl */ `
  uniform float uTijd, uOgen, uBlij, uLach, uMond, uGloed, uWervel, uDim, uAccent, uVeel, uLicht;
  uniform vec3 uFace, uKleur, uC1, uC2, uC3, uC4, uCamObj;
  uniform vec2 uBlik;
  varying vec3 vP; varying vec3 vN; varying vec3 vV;
  ${RUIS}
  ${GEZICHT}
  vec3 temperatuur(float x){
    // van diep amber aan de rand naar witheet in het midden, met het crème en perzik van AIO ertussen
    vec3 a=vec3(0.62,0.27,0.09), b=vec3(0.85,0.52,0.26), c=vec3(0.941,0.769,0.576), d=vec3(1.0,0.902,0.784), e=vec3(1.0,0.984,0.957);
    x=clamp(x,0.0,1.0);
    if (x<0.25) return mix(a,b,x/0.25);
    if (x<0.5) return mix(b,c,(x-0.25)/0.25);
    if (x<0.75) return mix(c,d,(x-0.5)/0.25);
    return mix(d,e,(x-0.75)/0.25);
  }
  void main(){
    vec3 N=normalize(vN), V=normalize(vV);
    float mu=clamp(dot(N,V),0.0,1.0);
    vec3 p=normalize(vP);
    float t=uTijd;
    float rand=1.0-mu;
    float limb=1.0-0.42*rand-0.38*rand*rand;
  #ifdef KLEIN
    float klein=1.0, gran=0.5;
    float x=0.66*limb+0.12*mu;
  #else
    float klein=0.0;
    // het oppervlak draait langzaam om de as en kookt: korrels (granulatie) en grotere stromen
    float rh=t*0.04; vec3 ps=vec3(p.x*cos(rh)-p.z*sin(rh),p.y,p.x*sin(rh)+p.z*cos(rh));
    float k1=korrel(ps*16.0,t*0.5);
    float k2=korrel(ps*5.0+3.1,t*0.18);
    float gran=(1.0-smoothstep(0.08,0.75,k1))*0.65+(1.0-smoothstep(0.1,0.9,k2))*0.35;
    float stroom=snoise(ps*2.4+vec3(0.0,t*0.02,0.0));
    float x=(0.66+0.2*(gran-0.5)+0.1*stroom)*limb+0.12*mu;
  #endif
    x=mix(x,x*0.6+0.12,uLicht*rand);
    vec3 kleur=temperatuur(x);
    // hart: een gloeiende kern in de kleur van het label, met een zachte draaiende stroming
    vec3 dir=normalize(p-uCamObj);
    vec3 m=p-dir*dot(p,dir);
    float r=length(m);
    // het hart vult het grootste deel van de ster (op 40 px bijna de hele bol), zodat de labelkleur overheerst
    float kern=exp(-r*r*mix(1.9,1.15,klein));
    float draai=t*(0.3+uWervel*1.2);
    float hk=draai+r*(2.5+uWervel*4.0);
    vec2 mr=mat2(cos(hk),-sin(hk),sin(hk),cos(hk))*m.xy;
    float w=fbm(vec3(mr*2.2,t*0.12));
    float sliert=smoothstep(-0.05,0.55,fbm(vec3(mr*2.2+w*1.4,t*0.1+4.0)));
    float hoek=atan(m.y,m.x);
    float a4=hoek+r*3.0-draai*0.6+w*0.8;
    float w1=pow(max(cos(a4),0.0),3.0), w2=pow(max(cos(a4-1.5708),0.0),3.0), w3=pow(max(cos(a4-3.1416),0.0),3.0), w4=pow(max(cos(a4-4.7124),0.0),3.0);
    vec3 vier=(uC1*w1+uC2*w2+uC3*w3+uC4*w4)/(w1+w2+w3+w4+1e-4);
    vec3 tint=mix(uKleur,vier,uVeel);
    float plasma=pow(kern,1.1)*(0.74+0.26*sliert)*max(uAccent,uVeel*0.9);
    // diep in het hart de volle labelkleur, naar het midden heter en lichter; een donkerdere zoom geeft diepte
    vec3 diepte=mix(tint*0.75,tint*1.1+0.06,smoothstep(0.2,0.9,kern));
    vec3 heet=mix(diepte,vec3(1.0,0.97,0.93),mix(0.3,0.16,klein)*pow(kern,4.0));
    kleur=mix(kleur,heet,clamp(plasma*1.3,0.0,1.0)*mix(0.95,0.98,klein)*smoothstep(0.0,0.3,mu));
    kleur*=mix(1.0,0.86+0.28*gran,(1.0-klein)*clamp(plasma,0.0,1.0)*0.8);
    // scherpe chromosfeerrand en een dunne rand in de labelkleur
    kleur+=vec3(1.0,0.86,0.66)*pow(rand,9.0)*1.1*(1.0-uLicht*0.7);
    kleur+=mix(vec3(1.0,0.7,0.4),tint,max(uAccent,uVeel)*0.75)*pow(rand,4.0)*mix(0.22,0.45,klein)*(1.0-uLicht*0.6);
    kleur*=(0.97+0.06*uGloed)*mix(1.0,0.55,uDim);
    // gezicht: ogen als zonnevlekken met een lichte zoom
    vec4 g=gezicht(p,uFace,uOgen,uBlij,uLach,uMond,klein,uBlik);
    float aa=max(fwidth(g.x),1e-4);
    float binnen=1.0-smoothstep(-aa,aa,g.x);
    float diep=smoothstep(0.0,0.035,-g.x);
    vec3 vlek=mix(vec3(0.45,0.2,0.08),vec3(0.07,0.035,0.02),diep);
    vlek=mix(vlek,tint*0.25,0.15*max(uAccent,uVeel));
    kleur=mix(kleur,vlek,binnen);
    kleur+=vec3(1.0,0.85,0.6)*exp(-abs(g.x)/0.012)*(1.0-binnen)*0.35*(1.0-klein);
    // iris: warm amber met een glans van de labelkleur, lichter naar de pupil en een donkere rand (limbus)
    float ai=max(fwidth(g.z),1e-4);
    float irisIn=1.0-smoothstep(-ai,ai,g.z);
    float irisR=smoothstep(-0.014,0.0,g.z);
    // fijne ringen in de iris, zodat hij niet vlak oogt
    float vezel=0.86+0.14*sin(g.z*700.0);
    vec3 irisKleur=mix(vec3(1.0,0.7,0.36),tint*1.2+0.12,0.6*max(uAccent,uVeel))*vezel;
    irisKleur=mix(irisKleur*1.2,irisKleur*0.3,irisR);
    kleur=mix(kleur,irisKleur,irisIn);
    float ap=max(fwidth(g.w),1e-4);
    kleur=mix(kleur,vec3(0.025,0.012,0.008),1.0-smoothstep(-ap,ap,g.w));
    float ag=max(fwidth(g.y),1e-4);
    kleur=mix(kleur,vec3(1.0,0.98,0.95)*1.3,(1.0-smoothstep(-ag,ag,g.y))*0.9);
    gl_FragColor=vec4(kleur,1.0);
  }`;

export const vlakVertex = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

export const coronaFragment = /* glsl */ `
  uniform float uTijd, uSterkte, uMaat, uRand; uniform vec3 uKleur, uTint;
  varying vec2 vUv;
  ${RUIS}
  void main(){
    vec2 c=(vUv-0.5)*uMaat;
    float rr=length(c);
    if (rr<0.98) discard;
    float h=atan(c.y,c.x);
    float uit=rr-1.0;
    float n=snoise(vec3(cos(h)*2.2,sin(h)*2.2,uTijd*0.08))*0.5+0.5;
    float n2=snoise(vec3(cos(h)*6.0,sin(h)*6.0,uTijd*0.15+3.0))*0.5+0.5;
    float stralen=pow(n,2.5)*0.8+pow(n2,4.0)*0.5;
    float a=(exp(-uit*2.6)*0.55+exp(-uit*16.0)*1.1+stralen*exp(-uit*1.6)*0.55)*smoothstep(0.98,1.01,rr)*uSterkte;
    // uitdoven vóór de rand van het canvas (uRand = halve canvasmaat in stralen van de ster)
    a*=1.0-smoothstep(uRand*0.55,uRand*0.97,rr);
    vec3 kleur=mix(uKleur,uTint,0.35*smoothstep(0.0,0.6,uit));
    gl_FragColor=vec4(kleur*a,min(a,1.0));
  }`;

export const vonkVertex = /* glsl */ `
  attribute float aFase; attribute vec3 aKleur; uniform float uTijd, uGrootte; varying float vA; varying vec3 vK;
  void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv;
    vA=0.35+0.65*pow(0.5+0.5*sin(uTijd*2.2+aFase*6.2831),3.0); vK=aKleur; gl_PointSize=uGrootte*(0.6+aFase)/-mv.z; }`;

export const vonkFragment = /* glsl */ `
  uniform float uSterkte; varying float vA; varying vec3 vK;
  void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); float a=(exp(-r*r*40.0)+exp(-r*r*400.0))*vA*uSterkte; gl_FragColor=vec4(vK*a,min(a,1.0)); }`;
