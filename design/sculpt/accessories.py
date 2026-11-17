"""Wardrobe sculpts. Head pieces: base plane y=0, unit radius in x/z (scaled per character).
Neck pieces: front pieces centred at origin facing +z in world units; wraps: unit ring around the neck axis."""
from sdf import *
GOLD='#f2c35b';WHITE='#fffaf3';PINK='#ff9fb8';LEAF='#6cc46a'
def T(part,tint=True):return part
def star2d(x,y,r,rf):
    k1=np.array([0.809016994375,-0.587785252292]);k2=np.array([-k1[0],k1[1]])
    x=np.abs(x);P=np.stack([x,y],-1)
    d1=np.maximum(P@k1,0)*2;P=P-np.outer(d1,k1);d2=np.maximum(P@k2,0)*2;P=P-np.outer(d2,k2)
    P[:,0]=np.abs(P[:,0]);P[:,1]-=r;ba=rf*np.array([-k1[1],k1[0]])-np.array([0,1]);h=np.clip((P@ba)/(ba@ba),0,r)
    return np.linalg.norm(P-np.outer(h,ba),axis=1)*np.sign(P[:,1]*ba[0]-P[:,0]*ba[1])
def star3d(c,r,thick,round_,axis='z'):
    c=np.asarray(c,float)
    def f(P):
        q=P-c;d2=star2d(q[:,0],q[:,1],r,.5);z=np.abs(q[:,2])-thick
        w=np.stack([d2,z],-1);return np.linalg.norm(np.maximum(w,0),axis=1)+np.minimum(np.max(w,axis=1),0)-round_
    return S(f)
def flower(c,r,n=5,yaw=0.0,tilt=1.1):
    """Five-petal flower facing outward from the ring (yaw) and tipped up (tilt)."""
    petals=[ellipsoid((np.cos(a)*r*.6,np.sin(a)*r*.6,0),(r*.48,r*.48,r*.2)) for a in np.linspace(0,2*np.pi,n,endpoint=False)]
    f=union(*petals,k=r*.2).rotate('x',-tilt*.0).rotate('x',-(np.pi/2-tilt)).rotate('y',yaw).move(c)
    ctr=sphere((0,0,r*.16),r*.3).rotate('x',-(np.pi/2-tilt)).rotate('y',yaw).move(c)
    return f,ctr
ITEMS={}
def item(fn):ITEMS[fn.__name__]=fn;return fn
# ---------------- head (unit radius) ----------------
@item
def cap():
    dome=intersect(ellipsoid((0,0,0),(1.02,.78,1.02)),S(lambda P:-P[:,1]),k=.04)
    brim=intersect(ellipsoid((0,.03,.95),(.82,.07,.62)),S(lambda P:.25-P[:,2]),k=.02)
    btn=sphere((0,.78,0),.08)
    s=union(dome,brim,btn,k=.06)
    p=Part('cap',s,'#ffffff',tint=True,step=.03)
    p.paint(S(lambda P:np.abs(P[:,0])-.035+0*P[:,1]),WHITE,soft=.012,tint=False)  # piping seam
    p.paint(S(lambda P:np.maximum(P[:,1]-.12,-P[:,2]+.55)),None,soft=.02,tint=True,shade=.85)
    return p
@item
def beanie():
    dome=intersect(ellipsoid((0,0,0),(1.03,1.02,1.03)),S(lambda P:-P[:,1]+.0),k=.05)
    cuff=S(lambda P:np.maximum(np.abs(P[:,1]-.12)-.13,np.sqrt(P[:,0]**2+P[:,2]**2)-1.08-.03*np.cos(np.arctan2(P[:,2],P[:,0])*28)))
    pom=sphere((0,1.12,0),.24)
    s=union(dome,cuff,k=.04);s=union(s,pom,k=.05)
    p=Part('beanie',s,'#ffffff',step=.03)
    p.paint(S(lambda P:np.abs(P[:,1]-.12)-.14),None,soft=.02,tint=True,shade=.82)
    p.paint(sphere((0,1.12,0),.27),WHITE,soft=.03)
    return p
@item
def crown():
    band=S(lambda P:np.maximum(np.abs(np.sqrt(P[:,0]**2+P[:,2]**2)-1.0)-.06,np.abs(P[:,1]-.18)-.18))
    band=S(lambda P,b=band:b(P)-.03)
    pts=[]
    for a in np.linspace(0,2*np.pi,5,endpoint=False):
        x,z=np.sin(a),np.cos(a)
        pts.append(roundcone((x,.3,z),(x*.97,.62,z*.97),.17,.05));pts.append(sphere((x*.97,.68,z*.97),.085))
    s=union(band,*pts,k=.05)
    p=Part('crown',s,GOLD,tint=False,step=.026)
    for a in np.linspace(0,2*np.pi,5,endpoint=False):
        x,z=np.sin(a),np.cos(a);p.paint(sphere((x*1.07,.18,z*1.07),.1),None,soft=.02,tint=True)
        p.paint(sphere((x*.97,.68,z*.97),.1),'#fff6dc',soft=.02)
    return p
@item
def astralCrown():
    band=S(lambda P:np.maximum(np.abs(np.sqrt(P[:,0]**2+P[:,2]**2)-1.0)-.05,np.abs(P[:,1]-.12)-.12)-.03)
    big=star3d((0,.62,1.0),.42,.06,.06)
    small=[star3d((s*.62,.42,.8),.22,.04,.04) for s in (-1,1)]
    arch=tube([(-.8,.2,.62),(-.45,.5,.95),(0,.55,1.02),(.45,.5,.95),(.8,.2,.62)],[.05,.05,.05,.05,.05])
    s=union(band,big,*small,arch,k=.05)
    p=Part('astralCrown',s,GOLD,tint=False,step=.026)
    p.paint(S(lambda P:np.abs(P[:,1]-.12)-.1),None,soft=.02,tint=True)
    p.paint(star3d((0,.62,1.05),.25,.08,.02),'#fff1c2',soft=.03)
    return p
@item
def partyHat():
    cone=roundcone((0,0,0),(0,1.12,0),.98,.08)
    cone=intersect(cone,S(lambda P:-P[:,1]+.0),k=.03)
    pom=union(*[sphere((np.cos(a)*.1,1.22+np.sin(a)*.06,np.sin(a)*.1),.13) for a in np.linspace(0,2*np.pi,6,endpoint=False)],k=.05)
    s=union(cone,pom,k=.04)
    p=Part('partyHat',s,WHITE,tint=False,step=.026)
    p.paint(S(lambda P:np.sin((P[:,1]*6.5+np.arctan2(P[:,2],P[:,0])*1.0)*np.pi)*.12),None,soft=.03,tint=True)
    p.paint(S(lambda P:P[:,1]-1.45-0*P[:,0]).move((0,0,0)) if False else sphere((0,1.22,0),.25),'#ffd34d',soft=.03,tint=False)
    return p
@item
def flowerCrown():
    ring=torus((0,.1,0),1.0,.11)
    leaves=[ellipsoid((np.sin(a)*1.02,.14,np.cos(a)*1.02),(.16,.07,.16)) for a in np.linspace(0,2*np.pi,14,endpoint=False)]
    s=union(ring,*leaves,k=.05)
    flowers=[];centres=[]
    for a in np.linspace(-1.2,1.2,5):
        c=(np.sin(a)*1.08,.28,np.cos(a)*1.08);f,ctr=flower(c,.3,yaw=a);flowers.append(f);centres.append(ctr)
    for a in (np.pi-.5,np.pi+.5):
        c=(np.sin(a)*1.08,.24,np.cos(a)*1.08);f,ctr=flower(c,.22,yaw=a);flowers.append(f);centres.append(ctr)
    s=union(s,*flowers,*centres,k=.03)
    p=Part('flowerCrown',s,LEAF,tint=False,step=.024)
    for f in flowers:p.paint(f,None,soft=.015,tint=True)
    for ctr in centres:p.paint(S(lambda P,ctr=ctr:ctr(P)-.03),'#ffd34d',soft=.015,tint=False)
    return p
@item
def bunnyEars():
    band=S(lambda P:np.maximum(np.abs(np.sqrt(P[:,0]**2+(P[:,1]+.75)**2)-1.12)-.05,np.abs(P[:,2])-.08)-.03)
    band=intersect(band,S(lambda P:-P[:,1]-.62))
    ears=[ellipsoid((0,0,0),(.2,.62,.1)).rotate('z',s*.18).move((s*.38,.95,0)) for s in (-1,1)]
    s=union(band,*ears,k=.07)
    p=Part('bunnyEars',s,'#ffffff',tint=True,step=.024)
    for sd in (-1,1):p.paint(ellipsoid((0,0,0),(.11,.48,.2)).rotate('z',sd*.18).move((sd*.38,.92,.08)),PINK,soft=.02,tint=False)
    p.paint(S(lambda P:P[:,1]-.42),None,soft=.02,tint=True,shade=.8)
    return p
@item
def halo():
    s=torus((0,1.15,0),.78,.075)
    return Part('halo',s,'#ffe58a',tint=False,step=.02)
# ---------------- neck ----------------
@item
def bow():
    slab=S(lambda P:np.abs(P[:,2])-.018)
    wings=[intersect(roundcone((s*.02,0,0),(s*.12,0,0),.03,.075),slab,k=.012) for s in (-1,1)]
    knot=ellipsoid((0,0,.012),(.035,.045,.04))
    s=union(*wings,k=.01);s=union(s,knot,k=.012)
    p=Part('bow',s,'#ffffff',step=.007)
    p.paint(knot,None,soft=.008,tint=True,shade=.8)
    for sd in (-1,1):
        for y in (-.03,.03):p.paint(capsule((sd*.045,y*.4,.03),(sd*.11,y,.03),.006),None,soft=.006,tint=True,shade=.82)
    return p
@item
def silkBow():
    loops=[torus((0,0,0),.065,.026,axis='z').move((s*.085,.012,0)) for s in (-1,1)]
    tails=[tube([(s*.015,-.01,.01),(s*.05,-.08,.02),(s*.07,-.15,.0)],[.025,.022,.018]) for s in (-1,1)]
    knot=sphere((0,0,.02),.04)
    s=union(*loops,*tails,knot,k=.025)
    p=Part('silkBow',s,'#ffffff',step=.008);p.paint(knot,None,soft=.01,tint=True,shade=.85)
    return p
@item
def royalBow():
    petals=union(*[ellipsoid((np.cos(a)*.06,np.sin(a)*.06,0),(.055,.03,.025)).move((0,0,0)) for a in np.linspace(0,2*np.pi,10,endpoint=False)],k=.01)
    ribbons=[roundcone((s*.02,-.04,-.01),(s*.07,-.2,-.01),.03,.022) for s in (-1,1)]
    core=sphere((0,0,.03),.04)
    s=union(petals,*ribbons,k=.02);s=union(s,core,k=.015)
    p=Part('royalBow',s,'#ffffff',step=.008);p.paint(core,GOLD,soft=.01,tint=False)
    p.paint(sphere((0,0,.04),.02),'#ff5c8a',soft=.006,tint=False)
    return p
@item
def medal():
    v=union(capsule((-.07,.08,-.02),(0,-.07,0),.022),capsule((.07,.08,-.02),(0,-.07,0),.022),k=.01)
    coin=S(lambda P:np.maximum(np.sqrt(P[:,0]**2+(P[:,1]+.14)**2)-.075,np.abs(P[:,2]-.01)-.012)-.01)
    st=star3d((0,-.14,.025),.045,.006,.004)
    s=union(v,coin,k=.012);s=union(s,st,k=.004)
    p=Part('medal',s,'#ffffff',step=.007)
    p.paint(S(lambda P:P[:,1]+.075),GOLD,soft=.01,tint=False)
    return p
@item
def scarf():
    ring=S(lambda P:np.sqrt((np.sqrt(P[:,0]**2+P[:,2]**2)-1.0)**2*1.0+((P[:,1])/1.6)**2)-.16)
    tail=union(rbox((.38,-.42,.95),(.16,.36,.05),.06).rotate('z',0),rbox((.62,-.3,.86),(.14,.3,.05),.06),k=.05)
    s=union(ring,tail,k=.08)
    p=Part('scarf',s,'#ffffff',step=.03)
    p.paint(S(lambda P:np.sin(P[:,1]*14)*.5+0*P[:,0]),WHITE,soft=.05,tint=False)
    return p
@item
def bellCollar():
    ring=torus((0,0,0),1.0,.075)
    bell=union(sphere((0,-.26,1.08),.2),torus((0,-.12,1.08),.12,.035,axis='y'),k=.04)
    slit=capsule((-.11,-.33,1.24),(.11,-.33,1.24),.025)
    bell=subtract(bell,slit,k=.01)
    s=union(ring,bell,k=.03)
    p=Part('bellCollar',s,'#ffffff',step=.022)
    p.paint(S(lambda P:bell(P)-.01),GOLD,soft=.015,tint=False)
    return p
HEAD=['cap','beanie','crown','astralCrown','partyHat','flowerCrown','bunnyEars','halo']
NECK=['bow','silkBow','royalBow','medal','scarf','bellCollar']
