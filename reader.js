(()=>{
  const root=document.getElementById('comment-reader');
  const q=selector=>root.querySelector(selector);
  const synth=window.speechSynthesis;
  const comments=[];
  const seen=new Set();
  const list=q('#cr-list');
  let index=0,playing=false,waiting=false,token=0,pendingLoads=__PENDING_LOADS__;
  const initial=__INITIAL_COMMENTS__;

  const clean=text=>String(text||'').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}]/gu,'').replace(/[\uFE0F\u200D]/g,'').trim();
  const identity=text=>Array.from(text.normalize('NFKC').toLowerCase()).filter(char=>/[\p{L}\p{N}]/u.test(char)).join('');
  function status(message){q('#cr-status').textContent=message;}
  function countLabel(){q('.listhead .sub').textContent=`${comments.length} unique comments ready${pendingLoads?' · buffering more':''}`;}
  function render(){
    if(!comments.length)return;
    const current=comments[index];
    q('#cr-count').textContent=`Comment ${index+1} of ${comments.length}${pendingLoads?' · buffering':''}`;
    q('#cr-author').textContent=current[0];
    q('#cr-body').textContent=current[1];
    q('#cr-prev').disabled=index===0;
    q('#cr-next').disabled=index===comments.length-1;
    q('#cr-play').disabled=false;
    q('#cr-play').textContent=playing?'Pause':synth&&synth.paused?'Resume':'Read continuously';
    list.querySelectorAll('button').forEach((button,i)=>button.setAttribute('aria-current',String(i===index)));
    countLabel();
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
      label.textContent=`${i+1}. ${name}`;text.textContent=body;
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
    const utterance=new SpeechSynthesisUtterance(`${comments[index][0]} says: ${comments[index][1]}`);
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
  q('#cr-add').addEventListener('click',()=>{
    const raw=q('#cr-paste').value;const items=parse(raw);
    if(!items.length){status('Paste comments first, one per line or as a JSON array.');return}
    pendingLoads++;render();status('Adding copied comments while playback remains available.');
    let offset=0,added=0;
    function batch(){
      added+=add(items.slice(offset,offset+100));offset+=100;
      if(offset<items.length)setTimeout(batch,0);
      else{q('#cr-paste').value='';finishLoad();status(`Added ${added} new comments; repeated text skipped.`)}
    }
    batch();
  });

  add(initial);
  status(`${comments.length} comments ready. Tap Read continuously to start.`);
  __REMOTE_LOAD__
})();
