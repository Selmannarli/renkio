from sdf import *
WHITE='#fffaf3'; BLUSH='#ff9db0'
def biped(body_r=(.27,.25,.22),torso_y=.36,leg_x=.12,shoe=None,arm_len=.2,arm_r=.075,shoulder=(.235,.5),hand=None,tint=True,colour='#ffffff'):
    """Shared stubby chibi body: torso, two arms (separate parts), two legs (separate parts)."""
    torso=ellipsoid((0,torso_y,0),body_r)
    torso=union(torso,ellipsoid((0,torso_y-.07,0.0),(body_r[0]*1.04,body_r[1]*.8,body_r[2]*1.02)),k=.08)
    parts=[]
    tp=Part('torso',torso,colour,tint=tint,step=.018);parts.append({'part':tp,'group':'torso'})
    for side,name in ((-1,'armL'),(1,'armR')):
        sx,sy=shoulder
        a=capsule((0,0,0),(side*.07,-arm_len,.02),arm_r)
        a=union(a,sphere((side*.075,-arm_len-.01,.025),arm_r*1.12),k=.05)
        ap=Part(name,a,colour,tint=tint,step=.014)
        if hand: ap.paint(sphere((side*.075,-arm_len-.02,.025),arm_r*1.25),hand,soft=.012)
        parts.append({'part':ap,'group':name,'pivot':(side*sx,sy,0)})
    for side,name in ((-1,'legL'),(1,'legR')):
        l=capsule((0,0,0),(0,-.11,0),.085)
        l=union(l,ellipsoid((0,-.165,.035),(.1,.065,.13)),k=.06)
        lp=Part(name,l,colour,tint=tint,step=.014)
        if shoe: lp.paint(S(lambda P:P[:,1]+.115),shoe,soft=.012)
        parts.append({'part':lp,'group':name,'pivot':(side*leg_x,.23,0)})
    return parts,tp
