import json,numpy as np,sys,importlib
from sdf import polygonize,colours,grad
def surface_point(shape,x,y,z0=1.2,steps=200):
    """March from the front (+z) toward -z to find the surface at (x,y)."""
    z=z0
    for _ in range(steps):
        d=shape(np.array([[x,y,z]]))[0]
        if d<1e-4: break
        z-=max(d,1e-3)
    p=np.array([[x,y,z]]);n=grad(shape,p)[0];return p[0].tolist(),n.tolist()
def export(ch,out):
    data={'name':ch['name'],'parts':[],'anchors':{}}
    for spec in ch['parts']:
        part=spec['part'];v,n,f=polygonize(part);rgb,tint,shade=colours(part,v)
        data['parts'].append({'name':part.name,'group':spec.get('group','head'),'material':spec.get('material','skin'),
          'pos':np.round(v,4).ravel().tolist(),'nor':np.round(n,3).ravel().tolist(),'idx':f.ravel().astype(int).tolist(),
          'pivot':spec.get('pivot'),'rgb':np.round(rgb,3).ravel().tolist(),'tint':np.round(tint,3).tolist(),'shade':np.round(shade,3).tolist()})
        print(part.name,len(v),'verts',len(f),'tris',file=sys.stderr)
    head=ch['face_shape']
    for k,(x,y) in ch.get('anchors',{}).items():
        data['anchors'][k]=surface_point(head,x,y)
    data.update({k:ch[k] for k in ch if k in ('eyes','base','pivots','extras','materials')})
    json.dump(data,open(out,'w'))
if __name__=='__main__':
    mod=importlib.import_module(sys.argv[1]);ch=mod.build();export(ch,sys.argv[2])
