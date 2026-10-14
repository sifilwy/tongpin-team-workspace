import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveTaskDone } from '../app/desktop/task-sync.mjs';

test('desktop can complete the shared task without copying it or changing individual tasks', async () => {
  const original=globalThis.fetch;
  let document={revision:1,value:[{id:1,owner:'全员',done:false},{id:2,owner:'czl',done:false}]};
  try {
    globalThis.fetch=async(_url,options)=>{
      if(options.method==='POST') {
        const body=JSON.parse(options.body);
        assert.equal(body.revision,1);
        document={revision:2,value:body.value};
      }
      return Response.json({document});
    };
    const result=await saveTaskDone(1,true,new AbortController().signal);
    assert.deepEqual(result.value,[{id:1,owner:'全员',done:true},{id:2,owner:'czl',done:false}]);
  } finally {globalThis.fetch=original;}
});

test('desktop completion never recreates a deleted or reassigned task, or writes malformed data', async () => {
  const original=globalThis.fetch;
  try {
    for(const document of [null,{revision:1,value:[]},{revision:1,value:[{id:1,owner:'czl'}]},{revision:1,value:[{id:1,owner:'xzx'},{id:1,owner:'xzx'}]},{value:[]}]) {
      let writes=0;
      globalThis.fetch=async(_url,options)=>{if(options.method==='POST')writes++;return Response.json({document});};
      await assert.rejects(saveTaskDone(1,true,new AbortController().signal));
      assert.equal(writes,0);
    }
  } finally {globalThis.fetch=original;}
});

test('desktop completion bounds conflict retries and handles deletion during conflict', async () => {
  const original=globalThis.fetch;
  try {
    let writes=0;
    globalThis.fetch=async(_url,options)=>{
      const post=options.method==='POST';if(post)writes++;
      return Response.json({document:{revision:writes+1,value:[{id:1,owner:'xzx',done:false}]}},{status:post?409:200});
    };
    await assert.rejects(saveTaskDone(1,true,new AbortController().signal),/再点一次/);
    assert.equal(writes,4);
    writes=0;
    globalThis.fetch=async(_url,options)=>{
      const post=options.method==='POST';if(post)writes++;
      return Response.json({document:{revision:post?2:1,value:post?[]:[{id:1,owner:'xzx',done:false}]}},{status:post?409:200});
    };
    await assert.rejects(saveTaskDone(1,true,new AbortController().signal),/删除/);
    assert.equal(writes,1);
  } finally {globalThis.fetch=original;}
});
