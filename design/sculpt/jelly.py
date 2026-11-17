from common import *
def build():
    dome=ellipsoid((0,.86,0),(.43,.42,.38))
    cut=S(lambda P:.6-P[:,1])
    bell=intersect(dome,cut,k=.08)
    rim=union(*[sphere((np.cos(a)*.385,.625,np.sin(a)*.335),.075) for a in np.linspace(0,2*np.pi,14,endpoint=False)],k=.07)
    bell=union(bell,rim,k=.06)
    hp=Part('head',bell,'#ffffff',step=.016)
    for x,y,z,r in ((-.25,1.08,.25,.03),(-.1,1.2,.22,.022),(.12,1.18,.25,.026),(.28,1.02,.28,.02),(.02,1.24,.12,.018),(-.33,.92,.26,.016)):
        hp.paint(sphere((x,y,z+.08),r+.02),'#ffffff',soft=.01,tint=False)
    for s in (-1,1): hp.paint(ellipsoid((s*.25,.74,.33),(.07,.042,.08)),BLUSH,soft=.03,tint=False)
    hp.paint(S(lambda P:P[:,1]-.66),None,soft=.06,tint=True,shade=.82)
    parts=[{'part':hp,'group':'head','material':'jelly'}]
    for side,name in ((-1,'armL'),(1,'armR')):
        t=tube([(0,0,0),(side*.03,-.1,.03),(side*.09,-.17,.05),(side*.15,-.16,.07),(side*.16,-.11,.07)],[.065,.06,.05,.042,.035])
        parts.append({'part':Part(name,t,'#ffffff',step=.012),'group':name,'pivot':(side*.26,.58,.06),'material':'jelly'})
    deco=union(*[tube([(x,.6,z),(x*1.1,.42,z+.02),(x*.8,.3,z+.05),(x*1.05,.2,z)],[.05,.045,.04,.03]) for x,z in ((-.12,.05),(.12,.05),(-.04,-.1),(.06,-.12))],k=.02)
    parts.append({'part':Part('torso',deco,'#ffffff',step=.012),'group':'torso','material':'jelly'})
    return {'name':'Jelly','parts':parts,'face_shape':bell,
      'anchors':{'eyeL':(-.15,.86),'eyeR':(.15,.86),'mouth':(0,.75)},
      'eyes':{'size':[.06,.076,.034],'iris':'#5a49d8'},'base':'#5ec4f5','pivots':{'head':.6},
      'materials':{'jelly':{'roughness':.12,'clearcoat':1,'clearcoatRoughness':.08,'sheen':.6,'transparent':True,'opacity':.94,'iridescence':.4}}}
