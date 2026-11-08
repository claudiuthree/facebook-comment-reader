(()=>{
  const root=document.getElementById('comment-reader');
  const q=selector=>root.querySelector(selector);
  const synth=window.speechSynthesis;
  const comments=[];
  const seen=new Set();
  const list=q('#cr-list');
  const knownPost='https://facebook.com/61591138393698/posts/122127670083371279';
  const savedPosts=__SAVED_POSTS__;
  let activeUrl=knownPost,version=0,savedLoaded=0,importProgress=null;
  const storageKey=()=>`facebook-comment-reader-imports-v2:${activeUrl}`;
  let index=0,playing=false,waiting=false,token=0,pendingLoads=__PENDING_LOADS__;
  const initial=__INITIAL_COMMENTS__;
  let collectorReady=false,collectorActive=false,collectorTimer=null;

  const clean=text=>String(text||'').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}]/gu,'').replace(/[\uFE0F\u200D]/g,'').trim();
  const identity=text=>Array.from(text.normalize('NFKC').toLowerCase()).filter(char=>/[\p{L}\p{N}]/u.test(char)).join('');
  function log(level,message){
    const entry=document.createElement('li');
    const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    entry.textContent=`${time} · ${level.toUpperCase()} · ${message}`;
    entry.dataset.level=level;
    const logList=q('#cr-log');logList.prepend(entry);
    while(logList.children.length>50)logList.lastElementChild.remove();
  }
  function collectorState(message){const field=q('#cr-collector-state');if(field)field.textContent=message;}
  function startCollector(){
    if(!collectorReady){collectorState('Chrome collector is not connected. Install it on the PC to collect a new post automatically.');log('warning','Chrome collector is not connected; no Facebook tab was opened.');return}
    collectorActive=true;pendingLoads++;render();collectorState('Opening the post in Chrome and collecting comments. You can listen as they arrive.');
    log('info',`Chrome collector requested for ${activeUrl}`);
    window.postMessage({source:'fbcr-page',type:'start',url:activeUrl},location.origin);
    clearTimeout(collectorTimer);
    const requestVersion=version;
    collectorTimer=setTimeout(()=>{if(collectorActive&&requestVersion===version){collectorActive=false;finishLoad();collectorState('Collector timed out. See the activity log.');log('error','Chrome collector did not finish within 90 seconds.')}},90000);
  }
  window.addEventListener('message',event=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.source!=='fbcr-extension')return;
    const message=event.data;
    if(message.type==='ready'){collectorReady=true;collectorState('Chrome collector connected. Paste a post link and tap Use this post.');return}
    if(message.url!==activeUrl)return;
    if(message.type==='batch'){
      const added=add(Array.isArray(message.items)?message.items:[]);
      if(added){saveImport(message.items);collectorState(`${comments.length} comments ready. Collecting more in the Facebook tab.`);status(`${comments.length} comments ready. Tap Read continuously.`);log('success',`Collected ${added} new comments from Facebook.`)}
    }else if(message.type==='done'){
      clearTimeout(collectorTimer);collectorActive=false;finishLoad();
      collectorState(`Collection finished. ${comments.length} unique comments ready.`);
      log('success',`Facebook tab closed. ${comments.length} unique comments ready.`);
    }else if(message.type==='error'){
      clearTimeout(collectorTimer);collectorActive=false;finishLoad();
      collectorState('Collector stopped. See the activity log.');
      log('error',String(message.error||'Collector failed.'));
    }
  });
  window.postMessage({source:'fbcr-page',type:'ping'},location.origin);
  setTimeout(()=>{if(!collectorReady)collectorState('Chrome collector is not connected on this device. Saved comments still work.')},1200);
  q('#cr-copy-report').addEventListener('click',async()=>{
    const report=[
      'Facebook Comment Reader diagnostic',
      `Post: ${activeUrl}`,
      `Comments ready: ${comments.length}`,
      `Progress: ${q('#cr-progress-text').textContent}`,
      'Recent activity:',
      ...Array.from(q('#cr-log').children).slice(0,15).map(entry=>entry.textContent)
    ].join('\n');
    const field=q('#cr-report');field.hidden=false;field.value=report;field.focus();field.select();
    try{
      await navigator.clipboard.writeText(report);
      status('Diagnostic report is shown below. Copy it into the chat for help.');
      log('info','Diagnostic report prepared and clipboard copy attempted.');
    }catch{
      status('Select and copy the diagnostic report shown below the activity log.');
      log('warning','Clipboard permission was unavailable; report shown for manual copying.');
    }
  });
  function status(message){q('#cr-status').textContent=message;}
  function countLabel(){q('.listhead .sub').textContent=`${comments.length} unique comments ready${pendingLoads?' · buffering more':''}`;}
  function progress(){
    let done,total,message;
    if(importProgress){done=importProgress.done;total=importProgress.total;message=`Processing copied comments: ${done} of ${total}`}
    else if(savedPosts[activeUrl]&&pendingLoads&&savedLoaded<savedPosts[activeUrl].total){done=savedLoaded;total=savedPosts[activeUrl].total;message=`${done} of ${total} saved comments loaded. You can start listening now.`}
    else if(comments.length){done=comments.length;total=comments.length;message=`${done} comments ready for this post.`}
    else{done=0;total=1;message='No comments loaded from this link. Copy and paste them below.'}
    const bar=q('#cr-progress');bar.max=total;bar.value=done;
    bar.setAttribute('aria-valuetext',message);q('#cr-progress-text').textContent=message;
  }
  function render(){
    if(!comments.length){
      q('#cr-count').textContent='No comments loaded';q('#cr-body').textContent='';
      q('#cr-prev').disabled=true;q('#cr-next').disabled=true;q('#cr-play').disabled=true;
      countLabel();progress();return;
    }
    const current=comments[index];
    q('#cr-count').textContent=`Comment ${index+1} of ${comments.length}${pendingLoads?' · buffering':''}`;
    q('#cr-body').textContent=current[1];
    q('#cr-prev').disabled=index===0;
    q('#cr-next').disabled=index===comments.length-1;
    q('#cr-play').disabled=false;
    q('#cr-play').textContent=playing?'Pause':synth&&synth.paused?'Resume':'Read continuously';
    list.querySelectorAll('button').forEach((button,i)=>button.setAttribute('aria-current',String(i===index)));
    countLabel();progress();
  }
  function add(items){
    let added=0;
    for(const item of items){
      if(!item)continue;
      const name=clean(Array.isArray(item)?item[0]:item.name||'Copied comment')||'Copied comment';
      const body=clean(Array.isArray(item)?item[1]:item.text||item.message||'');
      const key=identity(body);
      if(!key||seen.has(key))continue;
      seen.add(key);
      comments.push([name,body]);
      const i=comments.length-1;
      const button=document.createElement('button');button.type='button';button.className='item';
      const label=document.createElement('b'),text=document.createElement('span');
      label.textContent=`Comment ${i+1}`;text.textContent=body;
      button.append(label,text);
      button.addEventListener('click',()=>{stop();index=i;render();status('Comment selected. Tap Read continuously.')});
      list.append(button);added++;
    }
    render();
    if(waiting&&playing&&index<comments.length-1){waiting=false;index++;speak(false)}
    return added;
  }
  function finishLoad(){
    pendingLoads=Math.max(0,pendingLoads-1);render();
    if(waiting&&!pendingLoads){waiting=false;playing=false;render();status('Finished all loaded comments.')}
  }
  function stop(){token++;if(synth)synth.cancel();playing=false;waiting=false;render();status('Stopped.')}
  function speak(replace=true){
    if(!comments.length)return;
    if(!synth||!window.SpeechSynthesisUtterance){status('Speech playback is unavailable in this browser.');return}
    if(replace)synth.cancel();
    const current=++token;
    const utterance=new SpeechSynthesisUtterance(comments[index][1]);
    utterance.rate=Number(q('#cr-rate').value);utterance.lang='en-GB';
    utterance.onend=()=>{
      if(current!==token)return;
      if(index<comments.length-1){index++;speak(false)}
      else if(pendingLoads){waiting=true;status('Waiting for more comments to buffer.');render()}
      else{playing=false;render();status('Finished all loaded comments.')}
    };
    utterance.onerror=()=>{if(current!==token)return;playing=false;waiting=false;render();status('Audio could not play in this browser.')};
    playing=true;render();status(`Reading continuously · ${index+1} of ${comments.length}`);synth.speak(utterance);
  }
  q('#cr-play').addEventListener('click',()=>{
    if(playing){if(!waiting)synth.pause();playing=false;render();status('Paused.')}
    else if(synth&&synth.paused){synth.resume();playing=true;render();status(`Reading continuously · ${index+1} of ${comments.length}`)}
    else if(waiting){playing=true;if(index<comments.length-1){waiting=false;index++;speak(false)}else if(pendingLoads)status('Waiting for more comments to buffer.');else{waiting=false;render();status('Finished all loaded comments.')}}
    else speak();
  });
  q('#cr-stop').addEventListener('click',stop);
  q('#cr-prev').addEventListener('click',()=>{if(index>0){stop();index--;render();status('Previous comment selected.')}});
  q('#cr-next').addEventListener('click',()=>{if(index<comments.length-1){stop();index++;render();status('Next comment selected.')}});

  function parse(raw){
    const trimmed=raw.trim();
    if(!trimmed)return [];
    if(trimmed.startsWith('[')){
      try {const value=JSON.parse(trimmed);if(Array.isArray(value))return value.map(item=>typeof item==='string'?{text:item}:item)}catch{}
    }
    return trimmed.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
      const match=line.match(/^([^:]{2,60}):\s+(.+)$/);
      return match?{name:match[1],text:match[2]}:{name:'Copied comment',text:line};
    });
  }
  function saveImport(items){
    try{
      const saved=JSON.parse(localStorage.getItem(storageKey())||'[]');
      const keys=new Set(saved.map(item=>identity(clean(Array.isArray(item)?item[1]:item.text||item.message||''))));
      for(const item of items){
        if(!item)continue;
        const key=identity(clean(Array.isArray(item)?item[1]:item.text||item.message||''));
        if(key&&!keys.has(key)){saved.push(item);keys.add(key)}
      }
      localStorage.setItem(storageKey(),JSON.stringify(saved));
    }catch(error){log('warning',`Could not save imported comments on this device: ${error.message}`)}
  }
  q('#cr-share').addEventListener('click',async()=>{
    if(!comments.length){status('Collect or paste comments before sending the queue to your phone.');return}
    const button=q('#cr-share');button.disabled=true;
    status(`Preparing ${comments.length} comments for your phone.`);
    try{
      const response=await fetch('/api/share',{method:'POST',headers:{'content-type':'application/json','x-reader-share':'1'},body:JSON.stringify({post:activeUrl,comments:comments.map(item=>item[1])})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||`Upload failed: ${response.status}`);
      const link=new URL(location.origin+'/');link.searchParams.set('share',result.code);
      const field=q('#cr-phone-link');field.hidden=false;field.href=link.href;field.textContent=link.href;
      status('Phone link ready. Open it on your phone to listen to this queue. It expires in 24 hours.');
      log('success',`Created phone link for ${comments.length} comments.`);
    }catch(error){status('Could not prepare the phone link. See the activity log.');log('error',`Phone link failed: ${error.message}`)}
    finally{button.disabled=false}
  });
  async function loadShared(code){
    if(!/^[a-f0-9]{32}$/.test(code)){log('error','Invalid phone link.');return}
    try{
      const response=await fetch(`/api/share/${code}`,{cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||`Request failed: ${response.status}`);
      usePost(data.post,false);
      const items=data.comments.map(text=>({text}));
      const added=add(items);saveImport(items);
      status(`${comments.length} comments ready from the phone link. Tap Read continuously.`);
      log('success',`Phone link loaded ${added} new comments; repeated text skipped.`);
    }catch(error){status('Phone link could not be loaded. See the activity log.');log('error',`Phone link failed: ${error.message}`)}
  }
  q('#cr-add').addEventListener('click',()=>{
    const raw=q('#cr-paste').value;const items=parse(raw);
    if(!items.length){status('Paste comments first, one per line or as a JSON array.');log('warning','No copied comments were entered.');return}
    log('info',`Processing ${items.length} pasted lines for this post.`);
    const importVersion=version;
    importProgress={done:0,total:items.length};pendingLoads++;render();status('Adding copied comments while playback remains available.');
    let offset=0,added=0;
    function batch(){
      if(importVersion!==version)return;
      added+=add(items.slice(offset,offset+100));offset+=100;importProgress.done=offset;render();
      if(offset<items.length)setTimeout(batch,0);
      else{saveImport(items);q('#cr-paste').value='';importProgress=null;finishLoad();status(`Added ${added} new ${added===1?'comment':'comments'}; repeated text skipped.`);log('success',`Added ${added} unique comments. Skipped ${items.length-added} empty or repeated lines.`)}
    }
    batch();
  });

  function canonical(raw){
    try{
      const url=new URL(raw.trim());
      const host=url.hostname.toLowerCase().replace(/^(www|m|web)\./,'');
      if(url.protocol!=='https:'||url.username||url.password||!(host==='facebook.com'||host==='fb.watch')||url.pathname==='/')return null;
      url.hostname=host;url.hash='';url.pathname=url.pathname.replace(/\/+$/,'');
      if(url.pathname!=='/permalink.php')url.search='';
      return url.toString().replace(/\/$/,'');
    }catch{return null}
  }
  function restore(){try{add(JSON.parse(localStorage.getItem(storageKey())||'[]'))}catch{}}
  function loadSaved(){__REMOTE_LOAD__}
  function usePost(raw,collect=false){
    const next=canonical(raw);
    if(!next){status('Enter a Facebook post link.');log('error','The link was rejected. Enter an HTTPS Facebook post URL.');return}
    if(next===activeUrl){status(`${comments.length} comments ready for this post.`);log('info',`This post is already selected. ${comments.length} comments are ready.`);if(collect)startCollector();return}
    stop();version++;clearTimeout(collectorTimer);collectorActive=false;activeUrl=next;comments.length=0;seen.clear();list.replaceChildren();index=0;pendingLoads=0;savedLoaded=0;importProgress=null;
    try{localStorage.setItem('facebook-comment-reader-active-post',next)}catch{}
    q('#cr-openpost').href=next;q('#cr-post-url').value=next;
    q('#cr-sub').textContent=savedPosts[next]?.title||'Selected Facebook post';
    log('info',`Selected post: ${next}`);
    if(savedPosts[next]){const saved=savedPosts[next];pendingLoads=saved.path?1:0;savedLoaded=saved.initial.length;add(saved.initial);restore();if(saved.path)loadSaved();status(`${comments.length} comments ready.${pendingLoads?' Buffering the saved set.':''}`);log('success',`${comments.length} saved comments ready for this post.`)}
    else{restore();render();status(comments.length?`${comments.length} saved comments ready for this post.`:collect&&collectorReady?'Opening Facebook to collect comments.':'Post selected. Use the Windows Chrome collector or paste comments below.');log(collect&&collectorReady?'info':'warning',collect&&collectorReady?`Starting live collection with ${comments.length} saved comments.`:comments.length?`Loaded ${comments.length} comments previously saved for this post.`:'This post has no saved comments in the reader.')}
    if(collect){if(collectorReady)startCollector();else{collectorState('Chrome collector is not connected. Existing saved comments can still play.');log('warning','Install the Chrome collector on this PC to read new Facebook links automatically.')}}
  }
  q('#cr-form').addEventListener('submit',event=>{event.preventDefault();usePost(q('#cr-post-url').value,true)});
  root.addEventListener('dragover',event=>{if(!event.target.closest('textarea'))event.preventDefault()});
  root.addEventListener('drop',event=>{if(event.target.closest('textarea'))return;const raw=event.dataTransfer.getData('text/uri-list')||event.dataTransfer.getData('text/plain');if(canonical(raw)){event.preventDefault();usePost(raw,true)}});

  savedLoaded=initial.length;add(initial);
  log('info',`${comments.length} bundled comments ready for the example post.`);
  restore();
  status(`${comments.length} comments ready. Tap Read continuously to start.`);
  loadSaved();
  try{const params=new URLSearchParams(location.search);const saved=params.get('post')||localStorage.getItem('facebook-comment-reader-active-post');if(saved)usePost(saved);if(params.get('share'))loadShared(params.get('share'))}catch{}
})();
