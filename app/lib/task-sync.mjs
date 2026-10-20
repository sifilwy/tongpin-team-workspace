export const TEAM_TASKS = 'tongpin-tasks-v8';
export const PERSONAL_TASKS = 'tongpin-personal-tasks-v3';
const people = ['xzx','吃吃','czl','子涵','悦悦','全员'];
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const validPersonal = p => p && people.includes(p.owner) && typeof p.title === 'string' && typeof p.category === 'string';
const validTeam = t => t && (people.includes(t.owner) || t.owner === '待分配') && typeof t.title === 'string' && typeof t.category === 'string' && ['待完成','进行中','已完成'].includes(t.status);
const scheduleKeys = ['startTime','endTime','seriesId','repeatRule','repeatUntil','repeatDate','repeatDays'];
const schedule = p => Object.fromEntries(scheduleKeys.filter(key => p[key] !== undefined).map(key => [key,p[key]]));
const allocator = rows => { let next = Math.max(Date.now(), ...rows.map(t=>t.id+1)); return () => next++; };

// Both documents are updated in the same file transaction. Their revisions change
// together so stale clients must rebase before they can overwrite a linked task.
export function syncFromPersonal(before, personal, team, member, now = new Date().toISOString()) {
  let nextTeam = structuredClone(team);
  const allocate = allocator(nextTeam);
  const retained = new Set(personal.map(p=>p.id));
  for (const p of before) if (!retained.has(p.id) && Number.isFinite(p.teamTaskId)) nextTeam = nextTeam.filter(t=>t.id!==p.teamTaskId);
  const nextPersonal = personal.map(input => {
    const p = {...input};
    if (!validPersonal(p)) return p;
    const old = before.find(item=>item.id===p.id);
    const link = old?.teamTaskId ?? p.teamTaskId;
    const existing = nextTeam.find(t=>t.id===link);
    if (p.category === '独立') {
      if (existing) {
        p.collaborationDetails = existing;
        nextTeam = nextTeam.filter(t=>t.id!==existing.id);
      }
      delete p.teamTaskId;
      return p;
    }
    const archived = p.collaborationDetails;
    const id = existing?.id ?? (archived && !nextTeam.some(t=>t.id===archived.id) ? archived.id : allocate());
    const source = existing || archived || {reviews:[]};
    const status = p.done ? '已完成' : p.due ? '进行中' : '待完成';
    const t = {...source, id, title:p.title, owner:p.owner, category:p.category,
      description:p.note || '', due:p.due || '', status, personalSchedule:schedule(p)};
    // A change to time/notes must not discard a collaboration task's pending date.
    if (existing && old && same(old.due,p.due) && same(old.done,p.done)) {
      t.due=existing.due; t.status=existing.status;
    }
    if (status==='已完成' && source.status!=='已完成') { t.completedAt=now; t.completedBy=member; }
    if (status!=='已完成') { delete t.completedAt; delete t.completedBy; }
    if (existing) nextTeam=nextTeam.map(item=>item.id===id?t:item); else nextTeam.push(t);
    p.teamTaskId=id;
    p.collaborationDetails=structuredClone(t);
    return p;
  });
  return {team:nextTeam, personal:nextPersonal};
}

export function syncFromTeam(before, team, personal) {
  team=structuredClone(team);
  for (const changed of team) {
    const old=before.find(t=>t.id===changed.id);
    const series=changed.personalSchedule?.seriesId;
    if(old && series && old.description!==changed.description) {
      team=team.map(t=>t.personalSchedule?.seriesId===series?{...t,description:changed.description}:t);
    }
  }
  const ids = new Set(team.filter(t=>validTeam(t) && people.includes(t.owner)).map(t=>t.id));
  let nextPersonal = structuredClone(personal).filter(p=>!Number.isFinite(p.teamTaskId) || ids.has(p.teamTaskId));
  const allocate=allocator(nextPersonal);
  for(const t of team) {
    if(!validTeam(t) || !people.includes(t.owner)) continue;
    const p=nextPersonal.find(p=>p.teamTaskId===t.id);
    const projected={...(p||{}), ...(t.personalSchedule||{}), id:p?.id??allocate(), teamTaskId:t.id,
      collaborationDetails:structuredClone(t),title:t.title,owner:t.owner,category:t.category==='独立'?'生活':t.category,
      due:t.status==='待完成'?null:t.due||null,done:t.status==='已完成',note:t.description||'',
      startTime:t.personalSchedule?.startTime||p?.startTime||'09:00',endTime:t.personalSchedule?.endTime||p?.endTime||'10:00'};
    if(p) nextPersonal=nextPersonal.map(item=>item.id===p.id?projected:item); else nextPersonal.push(projected);
  }
  return {team,personal:nextPersonal};
}

export function initializeTaskSync(state) {
  if(state.taskSyncVersion===1) return false;
  const team=state.documents[TEAM_TASKS]?.value||[];
  const personal=state.documents[PERSONAL_TASKS]?.value||[];
  // Link an exact existing counterpart only. Similar titles are never merged.
  const used=new Set(personal.map(p=>p.teamTaskId).filter(Number.isFinite));
  const linked=personal.map(p=>{
    if(!validPersonal(p)||p.category==='独立'||p.teamTaskId) return p;
    const matches=team.filter(t=>validTeam(t)&&!used.has(t.id)&&t.title===p.title&&t.owner===p.owner&&t.category===p.category&&(t.description||'')===(p.note||'')&&(t.status==='已完成')===Boolean(p.done)&&(t.status==='待完成'?null:t.due||null)===(p.due||null));
    if(matches.length!==1) return p;
    used.add(matches[0].id);return {...p,teamTaskId:matches[0].id};
  });
  const merged=syncFromPersonal(linked,linked,team,'同步');
  const result=syncFromTeam(merged.team,merged.team,merged.personal);
  writeSyncedDocuments(state,result);
  state.taskSyncVersion=1;
  return true;
}

export function writeSyncedDocuments(state,{team,personal}) {
  for(const [key,value] of [[TEAM_TASKS,team],[PERSONAL_TASKS,personal]]) {
    const old=state.documents[key];
    if(!same(old?.value,value) && (old || value.length)) state.documents[key]={revision:(old?.revision||0)+1,value};
  }
}
