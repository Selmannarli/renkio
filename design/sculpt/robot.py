from common import *
def build():
    head=rbox((0,.9,0),(.37,.3,.28),.2)
    for s in (-1,1): head=union(head,S(lambda P,s=s:torus((s*.37,.88,0),.0,.0)(P)) if False else capsule((s*.36,.88,0),(s*.42,.88,0),.1),k=.03)
    hp=Part('head',head,'#f6f3fb',tint=False,step=.016)
    hp.paint(S(lambda P:.385-np.abs(P[:,0])),None,soft=.01,tint=True)
    screen=rbox((0,.88,.235),(.27,.19,.06),.06)
    sp=Part('screen',screen,'#17142a',tint=False,step=.012)
    ant=union(capsule((0,0,0),(0,.13,0),.018),sphere((0,.17,0),.05),k=.02)
    ap=Part('antenna',ant,'#c9c2d8',tint=False,step=.01);ap.paint(sphere((0,.17,0),.06),None,soft=.01,tint=True)
    parts,torso=biped(body_r=(.25,.23,.2),colour='#f6f3fb',tint=False,hand=None)
    torso.shape=union(rbox((0,.36,0),(.21,.19,.16),.14),k=0)
    torso.paint(rbox((0,.38,.17),(.11,.08,.05),.05),None,soft=.01,tint=True)
    torso.paint(sphere((0,.39,.22),.035),'#ffffff',soft=.01,tint=False)
    for spec in parts[1:]:
        p=spec['part']
        if p.name.startswith('arm'):p.paint(S(lambda Q:Q[:,1]+.17),None,soft=.012,tint=True)
        if p.name.startswith('leg'):p.paint(S(lambda Q:Q[:,1]+.12),None,soft=.012,tint=True)
    parts.insert(0,{'part':hp,'group':'head'});parts.insert(1,{'part':sp,'group':'head','material':'screen'})
    parts.append({'part':ap,'group':'antenna','pivot':(0,1.18,0)})
    return {'name':'Robot','parts':parts,'face_shape':union(head,screen),
      'anchors':{'eyeL':(-.11,.9),'eyeR':(.11,.9),'mouth':(0,.8)},
      'eyes':{'style':'led','size':[.05,.07,.02]},'base':'#8f6af0','pivots':{'head':.62},
      'materials':{'screen':{'roughness':.08,'clearcoat':1,'clearcoatRoughness':.04,'sheen':0}}}
