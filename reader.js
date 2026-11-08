(()=>{
  const root=document.getElementById('comment-reader');
  const q=selector=>root.querySelector(selector);
  const synth=window.speechSynthesis;
  const comments=[];
  const seen=new Set();
  const list=q('#cr-list');
  const knownPost='https://facebook.com/61591138393698/posts/122127670083371279';
  const knownTotal=__KNOWN_TOTAL__;
  let activeUrl=knownPost,version=0,savedLoaded=0,importProgress=null;
  const storageKey=()=>`facebook-comment-reader-imports-v2:${activeUrl}`;
  let index=0,playing=false,waiting=false,token=0,pendingLoads=__PENDING_LOADS__;
  const initial=__INITIAL_COMMENTS__;

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
  q('#cr-copy-report').addEventListener('click',async()=>{
    const report=[
      'Facebook Comment Reader diagnostic',
      `Post: ${activeUrl}`,
      `Comments ready: ${comments.length}`,
      `Progress: ${q('#cr-progress-text').textContent}`,
      'Recent activity:',
      ...Array.from(q('#cr-log').children).slice(0,15).map(entry=>entry.textContent)
    ].join('\n');
    try{
      await navigator.clipboard.writeText(report);
      status('Diagnostic report copied. Paste it into the chat for help.');
      log('info','Diagnostic report copied to clipboard.');
    }catch{
      const field=q('#cr-report');field.hidden=false;field.value=report;field.focus();field.select();
      status('Select and copy the diagnostic report shown below the activity log.');
      log('warning','Clipboard permission was unavailable; report shown for manual copying.');
    }
  });
  function status(message){q('#cr-status').textContent=message;}
  function countLabel(){q('.listhead .sub').textContent=`${comments.length} unique comments ready${pendingLoads?' · buffering more':''}`;}
  function progress(){
    let done,total,message;
    if(importProgress){done=importProgress.done;total=importProgress.total;message=`Processing copied comments: ${done} of ${total}`}
    else if(activeUrl===knownPost&&pendingLoads&&savedLoaded<knownTotal){done=savedLoaded;total=knownTotal;message=`${done} of ${total} saved comments loaded. You can start listening now.`}
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
  function usePost(raw){
    const next=canonical(raw);
    if(!next){status('Enter a Facebook post link.');log('error','The link was rejected. Enter an HTTPS Facebook post URL.');return}
    if(next===activeUrl){status(`${comments.length} comments ready for this post.`);log('info',`This post is already selected. ${comments.length} comments are ready.`);return}
    stop();version++;activeUrl=next;comments.length=0;seen.clear();list.replaceChildren();index=0;pendingLoads=0;savedLoaded=0;importProgress=null;
    try{localStorage.setItem('facebook-comment-reader-active-post',next)}catch{}
    q('#cr-openpost').href=next;q('#cr-post-url').value=next;
    q('#cr-sub').textContent=next===knownPost?'Paintwitheroy · “What’s one thing that drives you crazy as a painter?”':'Selected Facebook post';
    log('info',`Selected post: ${next}`);
    if(next===knownPost){pendingLoads=__PENDING_LOADS__;savedLoaded=initial.length;add(initial);restore();loadSaved();status(`${comments.length} comments ready. Buffering the saved set.`)}
    else{restore();render();status(comments.length?`${comments.length} saved comments ready for this post.`:'Post selected. Open it, copy its comments, then paste them below. Facebook does not provide these comments to the reader from the link alone.');log('warning',comments.length?`Loaded ${comments.length} comments previously pasted for this post. No live Facebook fetch was attempted.`:'No live Facebook fetch was attempted. This post has no saved comments in the reader; paste its comments to add them.')}
  }
  q('#cr-form').addEventListener('submit',event=>{event.preventDefault();usePost(q('#cr-post-url').value)});
  root.addEventListener('dragover',event=>{if(!event.target.closest('textarea'))event.preventDefault()});
  root.addEventListener('drop',event=>{if(event.target.closest('textarea'))return;const raw=event.dataTransfer.getData('text/uri-list')||event.dataTransfer.getData('text/plain');if(canonical(raw)){event.preventDefault();usePost(raw)}});

  savedLoaded=initial.length;add(initial);
  log('info',`${comments.length} bundled comments ready for the example post.`);
  restore();
  status(`${comments.length} comments ready. Tap Read continuously to start.`);
  loadSaved();
  try{const saved=new URLSearchParams(location.search).get('post')||localStorage.getItem('facebook-comment-reader-active-post');if(saved)usePost(saved)}catch{}
})();
