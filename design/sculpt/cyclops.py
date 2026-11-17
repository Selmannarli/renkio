from common import *
def build():
    head=ellipsoid((0,.88,0),(.42,.39,.35))
    horns=[tube([(s*.2,1.16,-.02),(s*.27,1.29,-.03),(s*.22,1.38,-.02)],[.07,.05,.022]) for s in (-1,1)]
    tuft=union(*[roundcone((x,1.2,-.05),(x*1.4,1.33,-.06),.05,.015) for x in (-.06,.06)],k=.02)
    head=union(head,tuft,k=.05)
    hp=Part('head',head,'#ffffff',step=.016)
    for x,y,r in ((-.28,1.04,.035),(.3,1.0,.03),(-.33,.86,.025),(.18,1.15,.025),(.36,.84,.02)):
        hp.paint(sphere((x,y,.5),r*1.0).move((0,0,0)) if False else capsule((x,y,-1),(x,y,1),r),None,soft=.008,tint=True,shade=.8)
    for s in (-1,1): hp.paint(ellipsoid((s*.25,.74,.3),(.075,.045,.08)),BLUSH,soft=.03,tint=False)
    hn=union(*horns);hrp=Part('horns',hn,'#fff1d6',tint=False,step=.012)
    parts,torso=biped(colour='#ffffff',shoe=None,hand=None)
    torso.paint(ellipsoid((0,.32,.2),(.16,.17,.1)),'#ffe3ef',soft=.012)
    parts.insert(0,{'part':hp,'group':'head'});parts.insert(1,{'part':hrp,'group':'head'})
    return {'name':'Cyclops','parts':parts,'face_shape':head,
      'anchors':{'eye':(0,.9),'mouth':(0,.73)},
      'eyes':{'size':[.095,.112,.045],'iris':'#e0902a'},'base':'#ff86b8','pivots':{'head':.6}}
