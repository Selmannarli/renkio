from common import *
def star2d(x,y,r,rf):
    # iq sdStar5 (rf = inner ratio)
    k1=np.array([0.809016994375,-0.587785252292]);k2=np.array([-k1[0],k1[1]])
    x=np.abs(x);P=np.stack([x,y],-1)
    d1=np.maximum(P@k1,0)*2;P=P-np.outer(d1,k1)
    d2=np.maximum(P@k2,0)*2;P=P-np.outer(d2,k2)
    P[:,0]=np.abs(P[:,0]);P[:,1]-=r
    ba=rf*np.array([-k1[1],k1[0]])-np.array([0,1])
    h=np.clip((P@ba)/(ba@ba),0,r)
    return np.linalg.norm(P-np.outer(h,ba),axis=1)*np.sign(P[:,1]*ba[0]-P[:,0]*ba[1])
def build():
    C=.7
    def f(P):
        x=P[:,0];y=P[:,1]-C;z=P[:,2]
        d2=star2d(x,y,.5,.55)
        rr=np.sqrt(x*x+y*y);t=np.maximum(.2-.17*np.clip(rr/.62,0,1),0.03)
        q=np.stack([d2,np.abs(z)-t],-1)
        return np.linalg.norm(np.maximum(q,0),axis=1)+np.minimum(np.max(q,axis=1),0)-.12
    star=S(f)
    hp=Part('head',star,'#ffffff',step=.016)
    for s in (-1,1): hp.paint(ellipsoid((s*.2,C-.08,.3),(.065,.04,.1)),BLUSH,soft=.03,tint=False)
    hp.paint(S(lambda P:np.sqrt(P[:,0]**2+(P[:,1]-C)**2)-.5),None,soft=.15,tint=True,shade=1.0)
    curl=union(tube([(0,-.02,0),(.02,.07,0),(.0,.13,0),(-.06,.15,0),(-.09,.11,0),(-.06,.08,0)],[.055,.045,.035,.028,.022,.018]),k=0)
    cp=Part('curl',curl,'#9c5cf0',tint=False,step=.01)
    parts=[{'part':hp,'group':'head'},{'part':cp,'group':'accent','pivot':(0,C+.56,0)}]
    for side,name in ((-1,'armL'),(1,'armR')):
        a=union(capsule((0,0,0),(side*.1,-.12,.02),.06),sphere((side*.105,-.13,.025),.068),k=.03)
        parts.append({'part':Part(name,a,'#ffffff',step=.012),'group':name,'pivot':(side*.34,C-.12,.04)})
    for side,name in ((-1,'legL'),(1,'legR')):
        l=union(capsule((0,0,0),(0,-.06,0),.065),ellipsoid((0,-.09,.03),(.085,.055,.11)),k=.04)
        lp=Part(name,l,'#ffffff',step=.012);lp.paint(S(lambda Q:Q[:,1]+.05),'#9c5cf0',soft=.01)
        parts.append({'part':lp,'group':name,'pivot':(side*.2,.2,.0)})
    return {'name':'Star','parts':parts,'face_shape':star,
      'anchors':{'eyeL':(-.13,C+.04),'eyeR':(.13,C+.04),'mouth':(0,C-.1)},
      'eyes':{'size':[.055,.07,.03],'iris':'#8a4fd6'},'base':'#ffc93c','pivots':{'head':C}}
