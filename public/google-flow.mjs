// A backgrounded Android WebView may lose a request, not the sign-in itself.
export class GoogleFlow {
 constructor({poll,signIn,status,finish,now=Date.now,schedule=setTimeout,cancel=clearTimeout}){Object.assign(this,{poll,signIn,status,finish,now,schedule,cancel});this.generation=0}
 start(flow){this.stop();this.flow=flow;this.generation++;this.wake()}
 stop(){this.generation++;this.cancel(this.timer);this.flow=null}
 async wake(){if(!this.flow||this.busy)return;this.cancel(this.timer);const flow=this.flow,g=this.generation;if(this.now()-flow.started>180000){this.stop();this.finish('expired');return}this.busy=true;
  try{const result=await this.poll(flow);if(g!==this.generation)return;if(result.ready){await this.signIn(result.credential);if(g!==this.generation)return;this.stop();this.finish('success');return}}
  catch(e){if(g!==this.generation)return;if(e.status===400||e.code&&e.code.startsWith('auth/')&&e.code!=='auth/network-request-failed'){this.stop();this.finish('error',e);return}this.status('retry',e)}
  finally{this.busy=false;if(this.flow)this.timer=this.schedule(()=>this.wake(),2000)}
 }
}
