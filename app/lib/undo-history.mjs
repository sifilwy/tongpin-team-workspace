const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const rows=value=>Array.isArray(value) && value.every(item=>object(item) && Number.isFinite(item.id));
const conflict=()=>{throw new Error('这部分内容已有后续修改，暂时无法撤销');};
// Reverse changed fields only; preserve unrelated edits from other members.
export function reverseChange(before,after,current) {
 if(same(before,after))return current;
 if(same(current,after))return structuredClone(before);
 if(rows(before) && rows(after) && rows(current)) {
  let result=structuredClone(current);
  for(const item of after){
   const old=before.find(row=>row.id===item.id);const index=result.findIndex(row=>row.id===item.id);
   if(!old){if(index<0)continue;if(!same(result[index],item))conflict();result.splice(index,1);}
   else if(!same(old,item)){if(index<0)conflict();result[index]=reverseChange(old,item,result[index]);}
  }
  for(let index=0;index<before.length;index++){
   const item=before[index];if(after.some(row=>row.id===item.id))continue;
   if(result.some(row=>row.id===item.id))conflict();
   const next=before.slice(index+1).find(row=>result.some(candidate=>candidate.id===row.id));
   result.splice(next?result.findIndex(row=>row.id===next.id):result.length,0,structuredClone(item));
  }
  const ids=before.filter(item=>after.some(row=>row.id===item.id)).map(item=>item.id);
  const orderAfter=after.filter(item=>ids.includes(item.id)).map(item=>item.id);
  if(!same(ids,orderAfter)){
   if(!same(result.filter(item=>ids.includes(item.id)).map(item=>item.id),orderAfter))conflict();
   const ordered=ids.map(id=>result.find(item=>item.id===id));let index=0;
   result=result.map(item=>ids.includes(item.id)?ordered[index++]:item);
  }
  return result;
 }
 if(object(before) && object(after) && object(current)){
  const result={...current};
  for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
   if(same(before[key],after[key]))continue;
   const value=reverseChange(before[key],after[key],current[key]);
   if(value===undefined)delete result[key];else result[key]=value;
  }
  return result;
 }
 conflict();
}
let history=[];let version=0;let busy=false;
const listeners=new Set();
const changed=()=>{version++;for(const listener of listeners)listener();};
export const subscribeUndo=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
export const undoVersion=()=>version;
export const canUndo=()=>history.length>0;
export const undoBusy=()=>busy;
export function rememberUndo(scope,undo){history.push({scope,undo});history=history.slice(-30);changed();}
export function forgetUndo(scope){history=history.filter(entry=>entry.scope!==scope);changed();}
export async function undoLast(){
 if(busy)return false;const entry=history.at(-1);if(!entry)return false;
 busy=true;changed();
 try{await entry.undo();history=history.filter(item=>item!==entry);return true;}
 finally{busy=false;changed();}
}
export function rememberDocumentUndo(key,before,after){
 if(same(before,after))return;
 const old=structuredClone(before);const changedValue=structuredClone(after);
 rememberUndo(key,async()=>{
  let response=await fetch(`/api/team?key=${encodeURIComponent(key)}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  let data=await response.json();if(!response.ok)throw Error(data.error || '暂时无法撤销');
  let document=data.document;
  for(let attempt=0;attempt<4;attempt++){
   const value=reverseChange(old,changedValue,document?.value);
   response=await fetch('/api/team',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({key,revision:document?.revision || 0,value})});
   data=await response.json();document=data.document;
   if(response.status===409)continue;
   if(!response.ok)throw Error(data.error || '暂时无法撤销');
   window.dispatchEvent(new CustomEvent('tongpin-document-undone',{detail:{key,document}}));return;
  }
  throw Error('其他页面正在更新，请再次撤销');
 });
}
