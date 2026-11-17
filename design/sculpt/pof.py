from common import *
def build():
    # Cloud head: a big soft core plus overlapping puffs; reads as one plush cloud.
    puffs=[sphere((0,.88,0),.36),sphere((-.24,.80,.02),.25),sphere((.24,.80,.02),.25),sphere((-.13,1.10,-.02),.21),
           sphere((.13,1.12,-.03),.22),sphere((0,1.17,-.06),.17),sphere((-.33,.95,-.04),.17),sphere((.33,.95,-.04),.17)]
    head=union(*puffs,k=.045)
    head=intersect(head,S(lambda P:P[:,2]-.33),k=.1)  # soften/flatten the face plane slightly
    hp=Part('head',head,'#ffffff',step=.016)
    hp.paint(ellipsoid((-.235,.74,.3),(.075,.045,.08)),BLUSH,soft=.03,tint=False)
    hp.paint(ellipsoid((.235,.74,.3),(.075,.045,.08)),BLUSH,soft=.03,tint=False)
    parts,torso=biped(colour='#ffffff',shoe=WHITE,hand=None)
    torso.paint(ellipsoid((0,.33,.2),(.17,.16,.1)),WHITE,soft=.012)
    parts.insert(0,{'part':hp,'group':'head'})
    return {'name':'Pof','parts':parts,'face_shape':head,
      'anchors':{'eyeL':(-.14,.86),'eyeR':(.14,.86),'mouth':(0,.75)},
      'eyes':{'size':[.062,.078,.034],'iris':'#6b3fb3'},'base':'#b49bf2','pivots':{'head':.6}}
