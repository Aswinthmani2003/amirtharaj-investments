// ════════════════════════════════════════════════════════════════════════
// THEME TOGGLE
// ════════════════════════════════════════════════════════════════════════

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  updateThemeUI(newTheme);
}

function updateThemeUI(theme) {
  const icon = document.getElementById('themeIcon');
  const text = document.getElementById('themeText');
  
  if (theme === 'light') {
    icon.textContent = '☀️';
    text.textContent = 'Light';
  } else {
    icon.textContent = '🌙';
    text.textContent = 'Dark';
  }
}

// Load saved theme on page load
document.addEventListener('DOMContentLoaded', function() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeUI(savedTheme);
});

// ════════════════════════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════════════════════════

async function logout() {
  try {
    const response = await fetch('/logout', {method: 'POST'});
    if (response.ok) {
      window.location.href = '/login';
    }
  } catch(error) {
    console.error('Logout error:', error);
    window.location.href = '/login';
  }
}

// ════════════════════════════════════════════════════════════════════════
// TAB SWITCHER
// ════════════════════════════════════════════════════════════════════════

function switchTab(tab) {
  const isCams = tab === 'cams';
  document.getElementById('panel-cams').classList.toggle('show', isCams);
  document.getElementById('panel-karvy').classList.toggle('show', !isCams);
  const tc = document.getElementById('tab-cams');
  const tk = document.getElementById('tab-karvy');
  tc.className = 'tab-btn' + (isCams  ? ' active-cams'  : '');
  tk.className = 'tab-btn' + (!isCams ? ' active-karvy' : '');
}

// ════════════════════════════════════════════════════════════════════════
// CAMS FUNCTIONS
// ════════════════════════════════════════════════════════════════════════

function cPipe(n) {
  [1,2,3,4,5].forEach(i => {
    const el = document.getElementById('cps'+i);
    el.classList.remove('active','done');
    if (i < n) el.classList.add('done');
    if (i === n) el.classList.add('active');
  });
}

const cz1 = document.getElementById('cz1');
cz1.addEventListener('dragover', e=>{e.preventDefault();cz1.classList.add('over')});
cz1.addEventListener('dragleave', ()=>cz1.classList.remove('over'));
cz1.addEventListener('drop', e=>{e.preventDefault();cz1.classList.remove('over');cSetF(e.dataTransfer.files[0])});
document.getElementById('cfc').addEventListener('change', e=>{if(e.target.files[0])cSetF(e.target.files[0])});

function cSetF(f) {
  if(!f.name.endsWith('.csv')){toast('Please upload a .csv file','error');return}
  document.getElementById('cpill1-name').textContent=f.name;
  document.getElementById('cpill1').classList.add('show');
  document.getElementById('cbtn-clean').disabled=false;
  document.getElementById('cclean-result').style.display='none';
  cPipe(1);
}

function cClearCsv() {
  document.getElementById('cfc').value='';
  document.getElementById('cpill1').classList.remove('show');
  document.getElementById('cbtn-clean').disabled=true;
  document.getElementById('cclean-result').style.display='none';
  cPipe(1);
}

async function cDoClean() {
  const fi=document.getElementById('cfc'); 
  if(!fi.files[0])return;
  const btn=document.getElementById('cbtn-clean');
  btn.disabled=true;
  btn.classList.add('loading');
  btn.querySelector('.t').textContent='Cleaning…';
  cPipe(2);
  const fd=new FormData();
  fd.append('file',fi.files[0]);
  // NAV is auto-fetched from Supabase - no manual upload needed
  
  try {
    const res=await fetch('/process',{method:'POST',body:fd});
    const data=await res.json();
    if(data.error){
      toast('❌ '+data.error,'error');
      cPipe(1);
      return;
    }
    
    document.getElementById('cclean-stats').innerHTML=[
      {l:'Total Rows',   v:data.total_rows,       s:'after dedup',          c:''},
      {l:'Existing',     v:data.existing_clients, s:'PAN matched Supabase', c:'ok'},
      {l:'New Clients',  v:data.new_clients,      s:'new AI code',          c:'info'},
      {l:'With PAN',     v:data.with_pan,         s:'valid PAN',            c:''},
      {l:'NAV Matched',  v:data.nav_matched||0,   s:'from Supabase',        c:'ok'},
      {l:'⚠ AC Flagged', v:data.flagged_ac,       s:'check in Excel',       c:'warn'},
    ].map(x=>`<div class="s-card ${x.c}"><div class="s-lbl">${x.l}</div><div class="s-val">${x.v.toLocaleString()}</div><div class="s-sub">${x.s}</div></div>`).join('');
    
    const eb=document.getElementById('cclean-errs');
    eb.innerHTML=data.errors&&data.errors.length?`<div class="err-box"><ul>${data.errors.map(e=>`<li>${e}</li>`).join('')}</ul></div>`:'';
    document.getElementById('cclean-result').style.display='block';
    cPipe(3);
    const navMsg = (data.nav_from_supabase||0)>0 ? ` · ${data.nav_from_supabase} NAV from Supabase` : ' · ⚠ No NAV data';
    toast('✅ '+data.total_rows+' rows cleaned'+navMsg,'success');
  } catch(e){
    toast('❌ '+e.message,'error');
    cPipe(1);
  } finally{
    btn.disabled=false;
    btn.classList.remove('loading');
    btn.querySelector('.t').textContent='⚡ Clean & Prepare Excel';
  }
}

const cz2=document.getElementById('cz2');
cz2.addEventListener('dragover', e=>{e.preventDefault();cz2.classList.add('over')});
cz2.addEventListener('dragleave', ()=>cz2.classList.remove('over'));
cz2.addEventListener('drop', e=>{e.preventDefault();cz2.classList.remove('over');cSetX(e.dataTransfer.files[0])});
document.getElementById('cfx').addEventListener('change', e=>{if(e.target.files[0])cSetX(e.target.files[0])});

function cSetX(f) {
  if(!f.name.endsWith('.xlsx')){toast('Please upload a .xlsx file','error');return}
  document.getElementById('cpill2-name').textContent=f.name;
  document.getElementById('cpill2').classList.add('show');
  document.getElementById('cbtn-prev').disabled=false;
  document.getElementById('cpush-result').style.display='none';
  cPipe(4);
}

function cClearXlsx() {
  document.getElementById('cfx').value='';
  document.getElementById('cpill2').classList.remove('show');
  document.getElementById('cbtn-prev').disabled=true;
  document.getElementById('cpush-result').style.display='none';
}

async function cDoPreview() {
  const fi=document.getElementById('cfx'); 
  if(!fi.files[0])return;
  const btn=document.getElementById('cbtn-prev');
  btn.disabled=true;
  btn.classList.add('loading');
  btn.querySelector('.t').textContent='Reading…';
  const fd=new FormData(); 
  fd.append('file',fi.files[0]);
  
  try {
    const res=await fetch('/preview-excel',{method:'POST',body:fd});
    const data=await res.json();
    if(data.error){
      toast('❌ '+data.error,'error');
      return;
    }
    
    document.getElementById('cpush-stats').innerHTML=[
      {l:'Total Rows',  v:data.total_rows,s:'ready to push',c:'ok'},
      {l:'⚠ AC Flagged',v:data.flagged_ac,s:'still flagged', c:data.flagged_ac>0?'warn':''},
    ].map(x=>`<div class="s-card ${x.c}"><div class="s-lbl">${x.l}</div><div class="s-val">${x.v.toLocaleString()}</div><div class="s-sub">${x.s}</div></div>`).join('');
    
    buildTable('cprev-tbl',data,'coral');
    document.getElementById('ctbl-count').textContent=data.total_rows.toLocaleString()+' rows total';
    document.getElementById('cpush-result').style.display='block';
    cPipe(4);
    toast('✅ '+data.total_rows+' rows loaded','info');
  } catch(e){
    toast('❌ '+e.message,'error');
  } finally{
    btn.disabled=false;
    btn.classList.remove('loading');
    btn.querySelector('.t').textContent='🔍 Preview Data';
  }
}

async function cDoPush() {
  const btn=document.getElementById('cbtn-push');
  btn.disabled=true;
  btn.classList.add('loading');
  btn.querySelector('.t').textContent='Pushing…';
  cPipe(5);
  
  try {
    const res=await fetch('/push',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const data=await res.json();
    if(data.error){
      toast('❌ '+data.error,'error');
      cPipe(4);
    } else{
      toast(data.message||'🚀 Done!','success');
      markDone('cps5');
    }
  } catch(e){
    toast('❌ '+e.message,'error');
    cPipe(4);
  } finally{
    btn.disabled=false;
    btn.classList.remove('loading');
    btn.querySelector('.t').textContent='🚀 Push to Supabase';
  }
}

// ════════════════════════════════════════════════════════════════════════
// KARVY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════

function kPipe(n) {
  [1,2,3,4,5].forEach(i => {
    const el=document.getElementById('kps'+i);
    el.classList.remove('active','done');
    if(i<n) el.classList.add('done');
    if(i===n) el.classList.add('active');
  });
}

const kz1=document.getElementById('kz1');
kz1.addEventListener('dragover', e=>{e.preventDefault();kz1.classList.add('over')});
kz1.addEventListener('dragleave', ()=>kz1.classList.remove('over'));
kz1.addEventListener('drop', e=>{e.preventDefault();kz1.classList.remove('over');kSetF1(e.dataTransfer.files[0])});
document.getElementById('kf1').addEventListener('change', e=>{if(e.target.files[0])kSetF1(e.target.files[0])});

const kz2=document.getElementById('kz2');
kz2.addEventListener('dragover', e=>{e.preventDefault();kz2.classList.add('over')});
kz2.addEventListener('dragleave', ()=>kz2.classList.remove('over'));
kz2.addEventListener('drop', e=>{e.preventDefault();kz2.classList.remove('over');kSetF2(e.dataTransfer.files[0])});
document.getElementById('kf2').addEventListener('change', e=>{if(e.target.files[0])kSetF2(e.target.files[0])});

function kSetF1(f){
  if(!f.name.endsWith('.csv')){toast('Please upload a .csv file','error');return}
  document.getElementById('kpill1-name').textContent=f.name;
  document.getElementById('kpill1').classList.add('show');
  kCheckReady();
}

function kClearF1(){
  document.getElementById('kf1').value='';
  document.getElementById('kpill1').classList.remove('show');
  kCheckReady();
}

function kSetF2(f){
  if(!f.name.endsWith('.csv')){toast('Please upload a .csv file','error');return}
  document.getElementById('kpill2-name').textContent=f.name;
  document.getElementById('kpill2').classList.add('show');
  kCheckReady();
}

function kClearF2(){
  document.getElementById('kf2').value='';
  document.getElementById('kpill2').classList.remove('show');
  kCheckReady();
}

function kCheckReady(){
  const ok=document.getElementById('kf1').files[0]&&document.getElementById('kf2').files[0];
  document.getElementById('kbtn-clean').disabled=!ok;
}

async function kDoClean() {
  const f1=document.getElementById('kf1').files[0];
  const f2=document.getElementById('kf2').files[0];
  if(!f1||!f2)return;
  
  const btn=document.getElementById('kbtn-clean');
  btn.disabled=true;
  btn.classList.add('loading');
  btn.querySelector('.t').textContent='Merging & Cleaning…';
  kPipe(2);
  
  const fd=new FormData();
  fd.append('file_new',f1); 
  fd.append('file_master',f2);
  // NAV is auto-fetched from Supabase - no manual upload needed
  
  try {
    const res=await fetch('/karvy/process',{method:'POST',body:fd});
    const data=await res.json();
    if(data.error){
      toast('❌ '+data.error,'error');
      kPipe(1);
      return;
    }
    
    document.getElementById('kclean-stats').innerHTML=[
      {l:'Total Rows',   v:data.total_rows,       s:'after merge+dedup',   c:''},
      {l:'Existing',     v:data.existing_clients, s:'matched Supabase',    c:'ok'},
      {l:'New Clients',  v:data.new_clients,      s:'new AI code',         c:'info'},
      {l:'With PAN',     v:data.with_pan,         s:'valid PAN',           c:''},
      {l:'NAV Matched',  v:data.nav_matched||0,   s:'from Supabase',       c:'ok'},
      {l:'⚠ AC Flagged', v:data.flagged_ac,       s:'check in Excel',      c:'warn'},
    ].map(x=>`<div class="s-card ${x.c}"><div class="s-lbl">${x.l}</div><div class="s-val">${x.v.toLocaleString()}</div><div class="s-sub">${x.s}</div></div>`).join('');
    
    const eb=document.getElementById('kclean-errs');
    eb.innerHTML=data.errors&&data.errors.length?`<div class="err-box"><ul>${data.errors.map(e=>`<li>${e}</li>`).join('')}</ul></div>`:'';
    document.getElementById('kclean-result').style.display='block';
    kPipe(3);
    const navMsg = (data.nav_from_supabase||0)>0 ? ` · ${data.nav_from_supabase} NAV from Supabase` : ' · ⚠ No NAV data';
    toast('✅ '+data.total_rows+' rows merged & cleaned'+navMsg,'success');
  } catch(e){
    toast('❌ '+e.message,'error');
    kPipe(1);
  } finally{
    btn.disabled=false;
    btn.classList.remove('loading');
    btn.querySelector('.t').textContent='⚡ Merge, Clean & Prepare Excel';
  }
}

const kz3=document.getElementById('kz3');
kz3.addEventListener('dragover', e=>{e.preventDefault();kz3.classList.add('over')});
kz3.addEventListener('dragleave', ()=>kz3.classList.remove('over'));
kz3.addEventListener('drop', e=>{e.preventDefault();kz3.classList.remove('over');kSetFX(e.dataTransfer.files[0])});
document.getElementById('kfx').addEventListener('change', e=>{if(e.target.files[0])kSetFX(e.target.files[0])});

function kSetFX(f){
  if(!f.name.endsWith('.xlsx')){toast('Please upload a .xlsx file','error');return}
  document.getElementById('kpill3-name').textContent=f.name;
  document.getElementById('kpill3').classList.add('show');
  document.getElementById('kbtn-prev').disabled=false;
  document.getElementById('kpush-result').style.display='none';
  kPipe(4);
}

function kClearFX(){
  document.getElementById('kfx').value='';
  document.getElementById('kpill3').classList.remove('show');
  document.getElementById('kbtn-prev').disabled=true;
  document.getElementById('kpush-result').style.display='none';
}

async function kDoPreview() {
  const fi=document.getElementById('kfx'); 
  if(!fi.files[0])return;
  const btn=document.getElementById('kbtn-prev');
  btn.disabled=true;
  btn.classList.add('loading');
  btn.querySelector('.t').textContent='Reading…';
  const fd=new FormData(); 
  fd.append('file',fi.files[0]);
  
  try {
    const res=await fetch('/karvy/preview-excel',{method:'POST',body:fd});
    const data=await res.json();
    if(data.error){
      toast('❌ '+data.error,'error');
      return;
    }
    
    document.getElementById('kpush-stats').innerHTML=[
      {l:'Total Rows',  v:data.total_rows,s:'ready to push',c:'ok'},
      {l:'⚠ AC Flagged',v:data.flagged_ac,s:'still flagged', c:data.flagged_ac>0?'warn':''},
    ].map(x=>`<div class="s-card ${x.c}"><div class="s-lbl">${x.l}</div><div class="s-val">${x.v.toLocaleString()}</div><div class="s-sub">${x.s}</div></div>`).join('');
    
    buildTable('kprev-tbl',data,'blue');
    document.getElementById('ktbl-count').textContent=data.total_rows.toLocaleString()+' rows total';
    document.getElementById('kpush-result').style.display='block';
    kPipe(4);
    toast('✅ '+data.total_rows+' rows loaded','info');
  } catch(e){
    toast('❌ '+e.message,'error');
  } finally{
    btn.disabled=false;
    btn.classList.remove('loading');
    btn.querySelector('.t').textContent='🔍 Preview Data';
  }
}

async function kDoPush() {
  const btn=document.getElementById('kbtn-push');
  btn.disabled=true;
  btn.classList.add('loading');
  btn.querySelector('.t').textContent='Pushing…';
  kPipe(5);
  
  try {
    const res=await fetch('/karvy/push',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const data=await res.json();
    if(data.error){
      toast('❌ '+data.error,'error');
      kPipe(4);
    } else{
      toast(data.message||'🚀 Done!','success');
      markDone('kps5');
    }
  } catch(e){
    toast('❌ '+e.message,'error');
    kPipe(4);
  } finally{
    btn.disabled=false;
    btn.classList.remove('loading');
    btn.querySelector('.t').textContent='🚀 Push KARVY to Supabase';
  }
}

// ════════════════════════════════════════════════════════════════════════
// SHARED HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════

function buildTable(tblId, data, color) {
  const cols=data.preview_cols;
  const labels={
    ai_code:'AI Code',
    'Folio No':'Folio',
    inv_name:'Investor',
    pan_no:'PAN',
    product:'Product',
    sch_name:'Scheme',
    rep_date:'Date',
    unit_balance:'Unit Balance',
    total_amount_value:'Total Amt Value',
    nav_value:'NAV',
    nav_date:'NAV Date',
    bank_name:'Bank',
    ac_no:'AC No',
    ac_no_flag:'⚠ Flag',
    city:'City'
  };
  
  const tagCls = color==='coral' ? 'ai-coral' : 'ai-blue';
  const aumColor = color==='coral' ? 'var(--coral)' : 'var(--blue)';
  
  let h='<thead><tr>'+cols.map(c=>`<th>${labels[c]||c}</th>`).join('')+'</tr></thead><tbody>';
  
  data.preview.forEach(r=>{
    h+='<tr>'+cols.map(c=>{
      const v=r[c]||'';
      if(c==='ai_code') return `<td><span class="${tagCls}">${v}</span></td>`;
      if(c==='ac_no_flag'&&v) return `<td><span class="flag-tag">${v}</span></td>`;
      if(c==='total_amount_value'){
        const n=parseFloat(v);
        return `<td style="color:${n>0?aumColor:'var(--muted)'}">${n>0?'₹'+n.toLocaleString('en-IN'):'—'}</td>`;
      }
      if(c==='nav_value'){
        const n=parseFloat(v);
        return `<td style="color:${n>0?'var(--muted2)':'var(--muted)'}">${n>0?n.toFixed(4):'—'}</td>`;
      }
      if(c==='sch_name') return `<td title="${v}">${v.substring(0,26)}${v.length>26?'…':''}</td>`;
      return `<td>${v||'—'}</td>`;
    }).join('')+'</tr>';
  });
  
  h+='</tbody>';
  document.getElementById(tblId).innerHTML=h;
}

function markDone(psId) {
  const el=document.getElementById(psId);
  el.classList.remove('active'); 
  el.classList.add('done');
  el.querySelector('.pipe-desc').textContent='✅ Complete!';
}

function toast(msg,type='info'){
  const el=document.getElementById('toast');
  el.textContent=msg; 
  el.className=`show ${type}`;
  setTimeout(()=>el.className='',4200);
}
