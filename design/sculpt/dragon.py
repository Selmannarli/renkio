from common import *
def build():
    head=union(ellipsoid((0,.88,0),(.4,.36,.33)),ellipsoid((0,.77,.2),(.22,.15,.17)),k=.1)
    horns=[roundcone((s*.16,1.14,-.06),(s*.22,1.3,-.12),.06,.025) for s in (-1,1)]
    fins=[ellipsoid((0,0,0),(.13,.055,.09)).rotate('z',s*.55).move((s*.37,1.02,-.06)) for s in (-1,1)]
    head=union(head,*fins,k=.05)
    spikes=union(*[roundcone((0,1.18-i*.12,-.22-i*.05),(0,1.24-i*.12,-.3-i*.06),.04,.012) for i in range(3)],k=.01)
    head=union(head,spikes,k=.04)
    hp=Part('head',head,'#ffffff',step=.016)
    hp.paint(ellipsoid((0,.735,.3),(.12,.055,.1)),'#fff2cf',soft=.02)
    for s in (-1,1):
        hp.paint(ellipsoid((s*.05,.8,.37),(.016,.012,.03)),'#3d6b34',soft=.006,tint=False)
        hp.paint(ellipsoid((s*.27,.78,.27),(.065,.04,.08)),BLUSH,soft=.03,tint=False)
    hrp=Part('horns',union(*horns),'#fff1d6',tint=False,step=.012)
    parts,torso=biped(colour='#ffffff',shoe=None,hand=None)
    belly=ellipsoid((0,.32,.2),(.15,.18,.1))
    torso.paint(belly,'#fff2cf',soft=.012)
    for y in (.24,.32,.40): torso.paint(intersect(S(lambda P,y=y:np.abs(P[:,1]-y)-.008),belly),'#f1dca8',soft=.006)
    wing=union(*[union(ellipsoid((0,0,0),(.13,.08,.025)),ellipsoid((s*.07,.05,0),(.08,.06,.022)),k=.03).rotate('z',s*.35).rotate('y',s*.5).move((s*.17,.47,-.18)) for s in (-1,1)],k=0)
    wp=Part('wings',wing,'#ffffff',step=.012);wp.paint(S(lambda P:P[:,1]-.42),None,soft=.02,tint=True,shade=.85)
    tail=tube([(0,0,0),(0,-.02,-.12),(.08,.0,-.24),(.16,.06,-.3)],[.07,.06,.045,.03])
    tail=union(tail,ellipsoid((.18,.08,-.32),(.06,.06,.025)).rotate('y',0),k=.02)
    tp=Part('tail',tail,'#ffffff',step=.012)
    parts.insert(0,{'part':hp,'group':'head'});parts.insert(1,{'part':hrp,'group':'head'})
    parts.append({'part':wp,'group':'torso'});parts.append({'part':tp,'group':'tail','pivot':(0,.22,-.15)})
    return {'name':'Dragon','parts':parts,'face_shape':head,
      'anchors':{'eyeL':(-.15,.9),'eyeR':(.15,.9),'mouth':(0,.7)},
      'eyes':{'size':[.058,.072,.032],'iris':'#c46a1f'},'base':'#7ccf63','pivots':{'head':.6}}
