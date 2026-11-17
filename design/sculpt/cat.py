from common import *
def build():
    head=ellipsoid((0,.86,0),(.43,.36,.34))
    cheeks=union(ellipsoid((-.2,.76,.12),(.2,.16,.2)),ellipsoid((.2,.76,.12),(.2,.16,.2)),k=.05)
    head=union(head,cheeks,k=.08)
    ears=[]
    for s in (-1,1):
        ear=roundcone((s*.26,1.08,-.02),(s*.36,1.33,-.04),.12,.035)
        ears.append(ear)
    head=union(head,*ears,k=.06)
    hp=Part('head',head,'#ffffff',step=.016)
    for s in (-1,1):
        hp.paint(roundcone((s*.27,1.12,.07),(s*.35,1.3,.04),.07,.02),'#ffb3c0',soft=.02)
        hp.paint(ellipsoid((s*.235,.73,.3),(.07,.042,.08)),BLUSH,soft=.03,tint=False)
    # muzzle and tabby forehead stripes
    hp.paint(union(ellipsoid((-.055,.725,.3),(.07,.05,.1)),ellipsoid((.055,.725,.3),(.07,.05,.1)),k=.02),WHITE,soft=.012)
    hp.paint(ellipsoid((0,.775,.33),(.03,.02,.05)),'#ff8fa3',soft=.008,tint=False)
    for x,h in ((-.09,.1),(0,.13),(.09,.1)):
        hp.paint(capsule((x,1.13,.2),(x*.8,1.13-h,.3),.022),None,soft=.012,tint=True,shade=.72)
    parts,torso=biped(colour='#ffffff',shoe=WHITE,hand=WHITE)
    torso.paint(ellipsoid((0,.32,.2),(.15,.17,.1)),WHITE,soft=.012)
    tail=tube([(0,0,0),(.12,.05,-.08),(.22,.2,-.1),(.2,.36,-.06)],[.055,.055,.05,.045])
    tp=Part('tail',tail,'#ffffff',step=.014);tp.paint(sphere((.2,.36,-.06),.08),WHITE,soft=.02)
    parts.insert(0,{'part':hp,'group':'head'});parts.append({'part':tp,'group':'tail','pivot':(.12,.22,-.2)})
    return {'name':'Cat','parts':parts,'face_shape':head,
      'anchors':{'eyeL':(-.15,.87),'eyeR':(.15,.87),'mouth':(0,.73),'nose':(0,.77)},
      'eyes':{'size':[.058,.074,.032],'iris':'#3d7a52'},'base':'#f59a52','pivots':{'head':.6}}
