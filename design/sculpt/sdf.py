"""Tiny SDF sculpting kit: primitives, smooth booleans, soft colour painting, marching cubes export."""
import numpy as np
from skimage.measure import marching_cubes

def _v(p): return np.asarray(p,dtype=np.float64)
def rot(axis,a):
    c,s=np.cos(a),np.sin(a)
    if axis=='x': return np.array([[1,0,0],[0,c,-s],[0,s,c]])
    if axis=='y': return np.array([[c,0,s],[0,1,0],[-s,0,c]])
    return np.array([[c,-s,0],[s,c,0],[0,0,1]])

class S:
    """A shape: f(P)->distance (P is Nx3)."""
    def __init__(s,f): s.f=f
    def __call__(s,P): return s.f(P)
    def move(s,t): t=_v(t); return S(lambda P:s.f(P-t))
    def rotate(s,axis,a): R=rot(axis,a); return S(lambda P:s.f(P@R))   # P@R == R^T p
    def mirror_x(s): return S(lambda P:s.f(np.abs(P)*[1,1,1]*np.where(True,1,1) if False else np.column_stack([np.abs(P[:,0]),P[:,1],P[:,2]])))

def sphere(c,r): c=_v(c); return S(lambda P:np.linalg.norm(P-c,axis=1)-r)
def ellipsoid(c,r):
    c=_v(c);r=_v(r)
    def f(P):
        q=(P-c)/r;k0=np.linalg.norm(q,axis=1);k1=np.linalg.norm(q/r,axis=1)
        return k0*(k0-1)/np.maximum(k1,1e-9)
    return S(f)
def capsule(a,b,r):
    a=_v(a);b=_v(b);ba=b-a;dd=ba@ba
    def f(P):
        pa=P-a;h=np.clip(pa@ba/dd,0,1);return np.linalg.norm(pa-np.outer(h,ba),axis=1)-r
    return S(f)
def roundcone(a,b,r1,r2):
    a=_v(a);b=_v(b)
    def f(P):
        ba=b-a;l2=ba@ba;rr=r1-r2;a2=l2-rr*rr;il2=1/l2
        pa=P-a;y=pa@ba;z=y-l2;x2v=pa*l2-np.outer(y,ba);x2=np.sum(x2v*x2v,axis=1);y2=y*y*l2;z2=z*z*l2
        k=np.sign(rr)*rr*rr*x2
        d=np.where(np.sign(z)*a2*z2>k,np.sqrt(x2+z2)*il2-r2,np.where(np.sign(y)*a2*y2<k,np.sqrt(x2+y2)*il2-r1,(np.sqrt(x2*a2*il2)+y*rr)*il2-r1))
        return d
    return S(f)
def rbox(c,h,r):
    c=_v(c);h=_v(h)
    def f(P):
        q=np.abs(P-c)-h+r;return np.linalg.norm(np.maximum(q,0),axis=1)+np.minimum(np.max(q,axis=1),0)-r
    return S(f)
def torus(c,R,r,axis='y'):
    c=_v(c)
    def f(P):
        q=P-c
        if axis=='y': a,b,h=q[:,0],q[:,2],q[:,1]
        elif axis=='z': a,b,h=q[:,0],q[:,1],q[:,2]
        else: a,b,h=q[:,1],q[:,2],q[:,0]
        return np.sqrt((np.sqrt(a*a+b*b)-R)**2+h*h)-r
    return S(f)
def tube(points,radii):
    """Chain of round cones (tapered tube) through points."""
    parts=[roundcone(points[i],points[i+1],radii[i],radii[i+1]) for i in range(len(points)-1)]
    return union(*parts)

def smin(a,b,k):
    if k<=0: return np.minimum(a,b)
    h=np.clip(.5+.5*(b-a)/k,0,1);return b*(1-h)+a*h-k*h*(1-h)
def smax(a,b,k): return -smin(-a,-b,k)
def union(*shapes,k=0.0):
    def f(P):
        d=shapes[0](P)
        for s in shapes[1:]: d=smin(d,s(P),k)
        return d
    return S(f)
def subtract(a,b,k=0.0): return S(lambda P:smax(a(P),-b(P),k))
def intersect(a,b,k=0.0): return S(lambda P:smax(a(P),b(P),k))
def mirror(s):
    return S(lambda P:s(np.column_stack([np.abs(P[:,0]),P[:,1],P[:,2]])))

def hexrgb(h): h=h.lstrip('#');return np.array([int(h[i:i+2],16)/255 for i in (0,2,4)])

class Part:
    """A rigid part: shape + base colour + paint layers. tint=True marks recolourable body surface."""
    def __init__(s,name,shape,colour='#ffffff',tint=True,step=.02,pad=.06):
        s.name=name;s.shape=shape;s.base=hexrgb(colour) if isinstance(colour,str) else None;s.tint=tint;s.paints=[];s.step=step;s.pad=pad
    def paint(s,region,colour,soft=.02,tint=None,shade=None):
        """region: S whose negative inside gets colour. tint: override tint flag; shade multiplies body colour (keeps tint)."""
        s.paints.append((region,None if colour is None else hexrgb(colour),soft,tint,shade));return s

def bounds(shape,lo=(-1,-0.2,-1),hi=(1,1.8,1),step=.04):
    xs=[np.arange(lo[i],hi[i]+step,step) for i in range(3)]
    G=np.stack(np.meshgrid(*xs,indexing='ij'),-1).reshape(-1,3)
    d=shape(G);inside=G[d<step]
    return inside.min(0),inside.max(0)

def polygonize(part,lo=(-1,-0.6,-1),hi=(1,1.8,1)):
    mn,mx=bounds(part.shape,lo,hi)
    mn-=part.pad;mx+=part.pad;st=part.step
    xs=[np.arange(mn[i],mx[i]+st,st) for i in range(3)]
    G=np.stack(np.meshgrid(*xs,indexing='ij'),-1)
    vol=part.shape(G.reshape(-1,3)).reshape(G.shape[:3])
    verts,faces,_,_=marching_cubes(vol,0,spacing=(st,st,st))
    verts+=mn
    # snap to the true surface and take analytic normals
    for _ in range(2):
        d=part.shape(verts);g=grad(part.shape,verts);verts=verts-g*d[:,None]
    n=grad(part.shape,verts)
    pass
    return verts,n,faces

def grad(f,P,e=1e-3):
    g=np.zeros_like(P)
    for i in range(3):
        d=np.zeros(3);d[i]=e;g[:,i]=f(P+d)-f(P-d)
    l=np.linalg.norm(g,axis=1,keepdims=True);return g/np.maximum(l,1e-12)

def colours(part,verts):
    """Per-vertex fixed colour (rgb) and tint weight [0..1] plus shade multiplier for tint."""
    n=len(verts);rgb=np.tile(part.base if part.base is not None else np.ones(3),(n,1));tint=np.full(n,1.0 if part.tint else 0.0);shade=np.ones(n)
    for region,col,soft,tflag,sh in part.paints:
        d=region(verts);w=np.clip(.5-d/(2*soft),0,1);w=w*w*(3-2*w)
        if col is not None:
            rgb=rgb*(1-w[:,None])+col*w[:,None]
        if tflag is not None: tint=tint*(1-w)+(1.0 if tflag else 0.0)*w
        elif col is not None: tint=tint*(1-w)
        if sh is not None: shade=shade*(1-w)+sh*w
    return rgb,tint,shade
