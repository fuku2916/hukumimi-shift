/* =====================================================================
   福耳会 業務ナビ（navi.js）
   シフト予定アプリ（hukumimi-shift）とタイムカード（fukumimi-timecard）の
   管理者用「最初の画面」。毎月の作業の順番どおりに、1行のボタンを並べる。
   ボタンを押すと、どちらのアプリのどの画面かを知らなくても、その作業の画面が開く。

   ・このファイルは hukumimi-shift リポジトリに置き、両アプリから読み込む
     （タイムカードは ../hukumimi-shift/navi.js を読む。同じサイト内なので住所が変わっても動く）
   ・データには一切触らない。画面を開く・ボタンを押すだけ
   ・別アプリの作業は、もう片方のタブで開く（開いていればそのタブを使い回す）

   使い方（各アプリ側）:
     FukuNavi.init({
       app:'shift'|'timecard', clinic, unit, y, m, role:'full'|'coord',
       urls:{shift:'…/hukumimi-shift/', timecard:'…/fukumimi-timecard/'},
       accept(target) → true なら今すぐ run できる（false ならURLを開き直す）
       run(go) → その画面を開く
       setYM(y,m) → 表示月を変える（シフト予定アプリのみ）
       badge(go) → 件数（未対応の申請など）
       prepOther(win,target) → 別タブを開く直前の準備（任意）
       backToNavi() → 「業務ナビに戻る」を押したとき（任意。無ければオーバーレイを開く）
       floating:true → 右下に「業務ナビ」ボタンを常時表示
     });
     FukuNavi.open() / FukuNavi.close() / FukuNavi.mount(要素) / FukuNavi.go(target)
   ===================================================================== */
(function(){
  'use strict';
  var NAVI_VERSION = 'N5';

  var CLINICS = [
    {id:'ekimae',   label:'駅前'},
    {id:'iguchi',   label:'いぐち'},
    {id:'karasuma', label:'みずたに'}
  ];
  var UNITS = [
    {id:'doctor', label:'ドクター'},
    {id:'nurse',  label:'ナース'},
    {id:'clerk',  label:'クラーク'}
  ];

  /* ── 作業の一覧（ここを書き換えるとナビのボタンが変わる）──
     app   : どちらのアプリで開くか（shift=シフト予定アプリ / timecard=タイムカード）
     unit  : 職種を固定する場合（例：休診関係は必ずドクター画面）
     go    : 各アプリの中で開く画面の合言葉
     hint  : 画面を開いたあと、右下に出す「この画面でやること」
     confirm: 押したときに確認を出す
     coordHide: 担当者モードでは出さない */
  var SECTIONS = [
    {id:'make', title:'来月のシフトをつくる', when:'毎月10〜20日ごろ', ordered:true, steps:[
      {go:'closed', app:'shift', unit:'doctor', label:'院の休診日を決める',
        sub:'お盆・年末年始・院の都合など',
        hint:'シフト表の各日付の右上にある「開院／休診」を押すと切り替わります。ドクター・ナース・クラーク全員の表に反映されます。'},
      {go:'drclosure', app:'shift', unit:'doctor', label:'ドクターの休診予定を入力する',
        sub:'学会・休暇などで外来を閉じる枠',
        hint:'下のシフト表で、その日のドクターの名前を外す（または入れる）だけで、診察室の「○／ー」が自動で切り替わります。この表で直接「○」「ー」を切り替えることもできます。最後に緑の「医師休診・外来枠設定をクラウド保存」を押すと、ナース・クラークの表にも反映されます。'},
      {go:'anesbulk', app:'shift', unit:'doctor', label:'麻酔科の先生を入れる（LINEの文を貼る）', sub:'木曜・土曜の全麻の担当', coordHide:true,
        hint:'LINEで決めた「11月7日吉井、14日村上…」の文をそのまま貼り付けて「読み取る」→「この内容で入れる」。木曜と土曜を入れ終わったら「公開する」を押すと、タイムカードと麻酔科の給与計算に反映されます。'},
      {go:'requests', app:'shift', label:'スタッフの有給・休み希望・出勤希望（挙手）を確認する',
        hint:'届いている申請を見て、シフト表に反映します。'},
      {go:'base', app:'shift', label:'ベースシフト（いつもの形）を見直す',
        hint:'曜日ごとの「いつもの担当者」を確認・修正します。'},
      {go:'applybase', app:'shift', label:'ベースシフトをシフト表に流し込む',
        hint:'光っているボタンを押します。「空きだけ」は今の配置を残して空いている枠だけ埋めます。「作り直す」は月ぜんぶをベースシフトどおりにします。'},
      {go:'adjust', app:'shift', label:'シフト表を見る・微調整する',
        hint:'見るだけのときは、そのまま表を確認してください。変えたいときは日付を押すと、その日の担当を変えられます。'},
      {go:'check', app:'shift', label:'人数の過不足・勤務時間をチェックする',
        hint:'足りない枠や、働きすぎの人がいないかを確認します。'},
      {go:'draft', app:'shift', label:'下書き保存する', sub:'スタッフにはまだ見えません',
        hint:'下書きを保存しました。ほかのパソコンでも続きができます。'},
      {go:'publish', app:'shift', label:'スタッフに公開する', sub:'スタッフのスマホに表示されます',
        confirm:'いま画面に出ているシフトを、スタッフに公開します。\nスタッフのスマホに表示されるようになります。\nよろしいですか？',
        hint:'公開しました。スタッフのスマホで見られます。'},
      {go:'lock', app:'shift', label:'シフトを確定する', sub:'このあとの変更が赤線で残ります', coordHide:true,
        hint:'確定後に変えたところは、外れた人が赤い二重線、追加した人が別の色で表示されます。'},
      {go:'print', app:'shift', label:'シフト表をPDFで印刷する',
        hint:'印刷の画面が開きます。「PDFに保存」も選べます。'}
    ]},
    {id:'daily', title:'毎日・随時やること', steps:[
      {go:'board', app:'timecard', label:'今日だれが来ているか見る',
        hint:'今日の出勤・退勤の状況です。日付の ◀ ▶ でほかの日も見られます。'},
      {go:'requests', app:'shift', label:'スタッフからの申請・メッセージに返事する',
        hint:'有給・休み希望・出勤希望・メッセージがここに届きます。'},
      {go:'punchreq', app:'shift', label:'打刻修正の依頼に返事する',
        hint:'スタッフから届いた打刻の修正依頼です。内容を見て承認・却下します。'},
      {go:'drclosure', app:'shift', unit:'doctor', label:'ドクターが急に休むことになった',
        hint:'下のシフト表で、その日のドクターの名前を外すだけで、診察室が「ー」に切り替わります（この表で直接切り替えることもできます）。緑の「医師休診・外来枠設定をクラウド保存」を押したあと、ナース・クラークのシフトも必要なら調整してください。'},
      {go:'notice', app:'shift', label:'スタッフ全員にお知らせを出す（連絡板）',
        hint:'ここに書いたお知らせは、スタッフのスマホに表示されます。'}
    ]},
    {id:'close', title:'月末の締め', when:'締め日のあと', ordered:true, coordHide:true, steps:[
      {go:'work', app:'timecard', label:'打刻もれ・打刻まちがいを直す',
        hint:'上の「スタッフ」で名前を選ぶと、その人の毎日の打刻が出ます。直したい日の ✏ を押すか、「日付を指定して…この日を開く」から修正します。'},
      {go:'diff', app:'timecard', label:'シフト予定と実際の出退勤を見くらべる',
        hint:'予定と実際がずれている日や、法律上の注意が必要な日が出ます。'},
      {go:'anes', app:'timecard', label:'麻酔科Drの給与を確認する', sub:'電子カルテのPCが締め日の翌朝に自動で計算',
        hint:'締め期間の麻酔科の先生ごとの支払予定額です。赤い枠が出ていたら、書いてあることを直してください（翌朝に自動で計算し直します）。確定済みなら、税理士用のExcelに「麻酔科医 支払予定」シートが自動で入ります。'},
      {go:'csv', app:'timecard', label:'税理士に送るデータを作る',
        hint:'締め期間を確認して「税理士提出CSV」を押します。Excelの一覧・個人別明細も作れます。'}
    ]},
    {id:'settings', title:'ときどきやること（設定）', compact:true, steps:[
      {go:'staff', app:'shift', label:'スタッフを追加する・退職にする', coordHide:true,
        hint:'名前・勤務条件・在籍ステータス（退職・休職など）を設定します。'},
      {go:'slots', app:'shift', unit:'doctor', label:'外来の時間割（診療枠）を変える', coordHide:true,
        hint:'曜日ごとの外来・手術の時間割です。上でどの職種の枠を変えるか選べます。'},
      {go:'needs', app:'shift', label:'必要な人数を変える', coordHide:true,
        hint:'各コマに何人必要かを設定します。'},
      {go:'punchlist', app:'timecard', label:'打刻記録の一覧を見る',
        hint:'全員の打刻記録の一覧です。Excel・PDFにもできます。'},
      {go:'cal', app:'timecard', label:'診療カレンダーを見る（タイムカード側）',
        hint:'タイムカードが読み込んでいる診療日・診療枠です。変えるときはシフト予定アプリで変えます。'},
      {go:'hours', app:'timecard', label:'診察時間を設定する',
        hint:'遅刻・早退の判定に使う診察時間です。'},
      {go:'staffset', app:'timecard', label:'タイムカードに出すスタッフ・管理スタッフを選ぶ',
        hint:'iPadの打刻画面に出す人と、管理画面に入れる人を設定します。'},
      {go:'import', app:'timecard', label:'シフト予定をタイムカードに今すぐ取り込む', sub:'ふだんは毎朝5時に自動',
        hint:'「シフトを取り込む」を押すと、最新のシフト予定がタイムカードに入ります。'},
      {go:'surgcal', app:'shift', label:'手術カレンダーとの連携', coordHide:true,
        hint:'手術予定のGoogleカレンダーの読み込み先を設定します。'},
      {go:'pin', app:'shift', label:'管理者PINを変える', coordHide:true,
        hint:'4桁の数字を入れて保存します。'},
      {go:'all', app:'shift', label:'シフト予定アプリの、すべてのメニュー',
        hint:'上のメニュー（ファイル・申請・設定・シフト設計・出力）から、すべての機能が使えます。'},
      {go:'all', app:'timecard', label:'タイムカードの、すべてのタブ',
        hint:'すべての機能のタブが並んでいます。'}
    ]}
  ];

  var ctx = null;          // アプリから渡された情報
  var sel = null;          // ナビで選んでいる 院・職種・月
  var overlayEl = null, inlineEl = null, hintEl = null, fabEl = null;

  /* ── 小道具 ── */
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function pad2(n){ return (n<10?'0':'')+n; }
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function clinicLabel(id){ for(var i=0;i<CLINICS.length;i++) if(CLINICS[i].id===id) return CLINICS[i].label; return id||''; }
  function unitLabel(id){ for(var i=0;i<UNITS.length;i++) if(UNITS[i].id===id) return UNITS[i].label; return id||''; }
  function isCoord(){ return ctx && ctx.role==='coord'; }
  function visibleSections(){
    var out=[];
    SECTIONS.forEach(function(s){
      if(s.coordHide && isCoord()) return;
      var steps=s.steps.filter(function(st){ return !(st.coordHide && isCoord()); });
      if(steps.length) out.push({sec:s, steps:steps});
    });
    return out;
  }
  function findStep(app,go){
    for(var i=0;i<SECTIONS.length;i++) for(var j=0;j<SECTIONS[i].steps.length;j++){
      var st=SECTIONS[i].steps[j]; if(st.app===app && st.go===go) return st;
    }
    return null;
  }
  function nextStepOf(step){
    var vs=visibleSections();
    for(var i=0;i<vs.length;i++){
      if(!vs[i].sec.ordered) continue;
      var idx=vs[i].steps.indexOf(step);
      if(idx>=0 && idx<vs[i].steps.length-1) return vs[i].steps[idx+1];
    }
    return null;
  }

  /* ── 行き先のURLを組み立てる ── */
  function buildUrl(t){
    var base = (ctx && ctx.urls && ctx.urls[t.app]) || '';
    if(t.app==='shift'){
      return base+'?clinic='+encodeURIComponent(t.clinic)+'&unit='+encodeURIComponent(t.unit)
        +'&ym='+t.y+'-'+pad2(t.m)+'&go='+encodeURIComponent(t.go);
    }
    return base+'?admin=1&go='+encodeURIComponent(t.go);
  }
  function targetOf(step){
    return {
      app: step.app, go: step.go,
      clinic: sel.clinic,
      unit: step.app==='shift' ? (step.unit || sel.unit) : '',
      y: sel.y, m: sel.m
    };
  }

  /* ── 実行：同じアプリならその場で、別アプリならもう片方のタブで ── */
  function go(t){
    if(!ctx) return;
    var step=findStep(t.app,t.go);
    if(t.app!==ctx.app){ openOther(t); return; }
    if(t.app==='shift'){
      var y=+t.y||ctx.y, m=+t.m||ctx.m;
      // 院・職種が今の画面と違う → その画面を開き直す（PINの確認済みはタブを閉じるまで残る）
      if((t.clinic && t.clinic!==ctx.clinic) || (t.unit && t.unit!==ctx.unit)){
        var msg='「'+clinicLabel(t.clinic)+'・'+unitLabel(t.unit)+'」の画面に切り替えます。';
        if(ctx.unit && ctx.clinic) msg+='\n保存していない編集があれば失われます（下書き保存・公開を済ませておくと安心です）。';
        msg+='\nよろしいですか？';
        if(ctx.ready && ctx.ready() && !window.confirm(msg)) return;
        location.replace(buildUrl({app:'shift',go:t.go,clinic:t.clinic||ctx.clinic,unit:t.unit||ctx.unit,y:y,m:m}));
        return;
      }
      if(ctx.accept && !ctx.accept(t)){ location.replace(buildUrl({app:'shift',go:t.go,clinic:ctx.clinic,unit:ctx.unit,y:y,m:m})); return; }
      if(ctx.setYM && (y!==ctx.y || m!==ctx.m)){ ctx.setYM(y,m); ctx.y=y; ctx.m=m; }
    }else{
      if(ctx.accept && !ctx.accept(t)){ location.replace(buildUrl(t)); return; }
    }
    close();
    setTimeout(function(){
      var done=true;
      try{ done = ctx.run(t.go, t) !== false; }catch(e){ console.warn('navi run',e); }
      if(done && step) showHint(step);
      try{ window.focus(); }catch(e){}
    }, 60);
  }

  function openOther(t){
    var name = t.app==='shift' ? 'fukumimi_shift' : 'fukumimi_timecard';
    var url = buildUrl(t);
    var w=null;
    try{ w=window.open('', name); }catch(e){ w=null; }
    if(!w){ location.href=url; return; } // ポップアップが止められた → このタブで開く
    var reused=false;
    try{
      var norm=function(x){ return String(x||'').replace(/index\.html$/,''); };
      var path = norm(new URL(url, location.href).pathname);
      if(w.FukuNavi && w.FukuNavi.ready && norm(w.location.pathname)===path){
        w.FukuNavi.go(t); reused=true;
      }
    }catch(e){ reused=false; }
    if(!reused){
      try{ if(ctx.prepOther) ctx.prepOther(w,t); }catch(e){}
      try{ w.location.href=url; }catch(e){ location.href=url; return; }
    }
    try{ w.focus(); }catch(e){}
  }

  function click(step){
    if(step.confirm && !window.confirm(step.confirm)) return;
    go(targetOf(step));
  }

  /* ── 見た目 ── */
  var CSS = ''
  + '.fnv{font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Helvetica Neue",sans-serif;color:#1E293B;line-height:1.5;text-align:left}'
  + '.fnv *{box-sizing:border-box}'
  + '.fnv-ov{position:fixed;inset:0;z-index:20000;background:#F1F5F9;overflow-y:auto;-webkit-overflow-scrolling:touch}'
  + '.fnv-wrap{max-width:760px;margin:0 auto;padding:18px 16px 60px}'
  + '.fnv-top{display:flex;align-items:flex-start;gap:12px;margin:0 0 14px}'
  + '.fnv-ttl{font-size:22px;font-weight:700;margin:0}'
  + '.fnv-lead{font-size:13px;color:#64748B;margin:2px 0 0}'
  + '.fnv-x{margin-left:auto;flex-shrink:0;border:1px solid #CBD5E1;background:#fff;border-radius:999px;padding:8px 14px;font-size:13px;cursor:pointer;color:#334155}'
  + '.fnv-sel{background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:12px 14px;margin:0 0 16px;display:flex;flex-direction:column;gap:9px}'
  + '.fnv-selrow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}'
  + '.fnv-sk{font-size:12px;color:#64748B;width:44px;flex-shrink:0}'
  + '.fnv-pill{border:1px solid #CBD5E1;background:#fff;border-radius:999px;padding:6px 14px;font-size:14px;cursor:pointer;color:#334155}'
  + '.fnv-pill.on{background:#1E293B;border-color:#1E293B;color:#fff;font-weight:700}'
  + '.fnv-fixed{font-size:14px;font-weight:700}'
  + '.fnv-mon{display:inline-flex;align-items:center;gap:6px}'
  + '.fnv-mon button{border:1px solid #CBD5E1;background:#fff;border-radius:8px;width:34px;height:32px;font-size:14px;cursor:pointer;color:#334155}'
  + '.fnv-mon b{font-size:15px;min-width:96px;text-align:center}'
  + '.fnv-note{font-size:11.5px;color:#94A3B8}'
  + '.fnv-sec{margin:0 0 18px}'
  + '.fnv-sh{display:flex;align-items:baseline;gap:8px;margin:0 0 7px;padding:0 2px}'
  + '.fnv-sh h3{font-size:16px;font-weight:700;margin:0}'
  + '.fnv-when{font-size:12px;color:#64748B}'
  + '.fnv-step{display:flex;align-items:center;gap:11px;width:100%;text-align:left;background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:11px 13px;margin:0 0 6px;cursor:pointer;font-size:15px;color:#1E293B;font-family:inherit}'
  + '.fnv-step:hover{border-color:#185FA5;background:#F8FBFF}'
  + '.fnv-step:active{transform:scale(.995)}'
  + '.fnv-n{width:26px;height:26px;border-radius:50%;background:#E6F1FB;color:#0C447C;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}'
  + '.fnv-dot{width:26px;height:26px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#94A3B8;font-size:18px}'
  + '.fnv-lb{flex:1;min-width:0}'
  + '.fnv-sub{display:block;font-size:12px;color:#64748B;margin-top:1px}'
  + '.fnv-tag{font-size:11px;border-radius:6px;padding:2px 8px;white-space:nowrap;flex-shrink:0}'
  + '.fnv-tag.s{background:#EEEDFE;color:#3C3489}'
  + '.fnv-tag.t{background:#E1F5EE;color:#085041}'
  + '.fnv-bd{background:#DC2626;color:#fff;border-radius:999px;font-size:11px;font-weight:700;padding:1px 7px;flex-shrink:0}'
  + '.fnv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px}'
  + '.fnv-grid .fnv-step{margin:0;font-size:14px;padding:9px 12px}'
  + '.fnv-ver{font-size:11px;color:#94A3B8;text-align:right;margin-top:10px}'
  + '.fnv-fab{position:fixed;right:14px;bottom:14px;z-index:19990;background:#1E293B;color:#fff;border:0;border-radius:999px;padding:11px 18px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);font-family:inherit}'
  + '.fnv-hint{position:fixed;right:14px;bottom:66px;z-index:19995;width:min(380px,calc(100vw - 28px));background:#fff;border:2px solid #185FA5;border-radius:14px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.18)}'
  + '.fnv-hint.nofab{bottom:14px}'
  + '.fnv-hk{font-size:11px;color:#185FA5;font-weight:700;margin:0 0 2px}'
  + '.fnv-ht{font-size:15px;font-weight:700;margin:0 0 4px}'
  + '.fnv-hb{font-size:13px;color:#334155;margin:0 0 10px}'
  + '.fnv-hbtns{display:flex;gap:6px;flex-wrap:wrap}'
  + '.fnv-hbtns button{border:1px solid #CBD5E1;background:#fff;border-radius:8px;padding:6px 10px;font-size:12.5px;cursor:pointer;color:#334155;font-family:inherit}'
  + '.fnv-hbtns .nx{background:#185FA5;border-color:#185FA5;color:#fff;font-weight:700}'
  + '.fnv-hclose{position:absolute;top:6px;right:8px;border:0;background:none;font-size:18px;color:#94A3B8;cursor:pointer}'
  + '@keyframes fnvGlow{0%,100%{box-shadow:0 0 0 0 rgba(24,95,165,0)}50%{box-shadow:0 0 0 6px rgba(24,95,165,.45)}}'
  + '.fnv-glow{animation:fnvGlow 1.1s ease-in-out 5;border-radius:8px}'
  + '@media (max-width:560px){.fnv-ttl{font-size:19px}.fnv-step{font-size:14px}.fnv-tag{display:none}}';

  function injectCss(){
    if(document.getElementById('fnv-css')) return;
    var st=document.createElement('style'); st.id='fnv-css'; st.textContent=CSS;
    (document.head||document.documentElement).appendChild(st);
  }

  function html(withClose){
    var coord=isCoord();
    var h='<div class="fnv-wrap">';
    h+='<div class="fnv-top"><div><p class="fnv-ttl">業務ナビ</p>'
      +'<p class="fnv-lead">やりたいことを押すと、その画面が開きます。上から順に進めれば、毎月の作業が終わります。</p></div>';
    if(withClose) h+='<button class="fnv-x" data-fnv="close">× いまの画面を見る</button>';
    h+='</div>';

    // 院・職種・月
    h+='<div class="fnv-sel">';
    h+='<div class="fnv-selrow"><span class="fnv-sk">どこの</span>';
    if(coord){ h+='<span class="fnv-fixed">'+esc(clinicLabel(sel.clinic))+'</span>'; }
    else CLINICS.forEach(function(c){ h+='<button class="fnv-pill'+(c.id===sel.clinic?' on':'')+'" data-fnv="clinic" data-v="'+c.id+'">'+esc(c.label)+'</button>'; });
    h+='</div>';
    h+='<div class="fnv-selrow"><span class="fnv-sk">だれの</span>';
    if(coord){ h+='<span class="fnv-fixed">'+esc(unitLabel(sel.unit))+'</span>'; }
    else UNITS.forEach(function(u){ h+='<button class="fnv-pill'+(u.id===sel.unit?' on':'')+'" data-fnv="unit" data-v="'+u.id+'">'+esc(u.label)+'</button>'; });
    h+='<span class="fnv-note">のシフト</span></div>';
    h+='<div class="fnv-selrow"><span class="fnv-sk">何月の</span><span class="fnv-mon">'
      +'<button data-fnv="mon" data-v="-1" aria-label="前の月">◀</button><b>'+sel.y+'年'+sel.m+'月</b>'
      +'<button data-fnv="mon" data-v="1" aria-label="次の月">▶</button></span></div>';
    h+='</div>';

    visibleSections().forEach(function(v){
      var s=v.sec;
      h+='<div class="fnv-sec"><div class="fnv-sh"><h3>'+esc(s.title)+'</h3>'+(s.when?'<span class="fnv-when">'+esc(s.when)+'</span>':'')+'</div>';
      if(s.compact) h+='<div class="fnv-grid">';
      v.steps.forEach(function(st,i){
        var bd=0; try{ bd = ctx.badge ? (+ctx.badge(st.app,st.go)||0) : 0; }catch(e){}
        var tag = st.app==='shift'
          ? '<span class="fnv-tag s">シフト'+(st.unit?'（'+unitLabel(st.unit)+'）':'')+'</span>'
          : '<span class="fnv-tag t">タイムカード</span>';
        h+='<button class="fnv-step" data-fnv="step" data-sec="'+s.id+'" data-i="'+i+'">'
          +(s.ordered?'<span class="fnv-n">'+(i+1)+'</span>':(s.compact?'':'<span class="fnv-dot">・</span>'))
          +'<span class="fnv-lb">'+esc(st.label)+(st.sub?'<span class="fnv-sub">'+esc(st.sub)+'</span>':'')+'</span>'
          +(bd>0?'<span class="fnv-bd">'+bd+'</span>':'')
          +(s.compact?'':tag)
          +'</button>';
      });
      if(s.compact) h+='</div>';
      h+='</div>';
    });
    h+='<div class="fnv-ver">業務ナビ '+NAVI_VERSION+'</div>';
    h+='</div>';
    return h;
  }

  function bind(root){
    root.onclick=function(e){
      var b=e.target.closest ? e.target.closest('[data-fnv]') : null;
      if(!b || !root.contains(b)) return;
      var k=b.getAttribute('data-fnv');
      if(k==='close'){ close(); return; }
      if(k==='clinic'){ sel.clinic=b.getAttribute('data-v'); saveSel(); render(); return; }
      if(k==='unit'){ sel.unit=b.getAttribute('data-v'); saveSel(); render(); return; }
      if(k==='mon'){
        var d=+b.getAttribute('data-v'); var mm=sel.m+d, yy=sel.y;
        if(mm<1){mm=12;yy--;} if(mm>12){mm=1;yy++;}
        sel.y=yy; sel.m=mm; render(); return;
      }
      if(k==='step'){
        var secId=b.getAttribute('data-sec'), i=+b.getAttribute('data-i');
        var vs=visibleSections();
        for(var x=0;x<vs.length;x++) if(vs[x].sec.id===secId){ var st=vs[x].steps[i]; if(st) click(st); return; }
      }
    };
  }

  function saveSel(){
    if(!isCoord()){ lsSet('fukumimi_navi_clinic', sel.clinic); lsSet('fukumimi_navi_unit', sel.unit); }
  }

  function render(){
    if(overlayEl){ overlayEl.innerHTML='<div class="fnv">'+html(!!ctx.canClose)+'</div>'; }
    if(inlineEl){ inlineEl.innerHTML='<div class="fnv">'+html(false)+'</div>'; }
  }

  function open(){
    if(!ctx) return;
    injectCss();
    hideHint();
    syncSelFromCtx(false);
    if(!overlayEl){
      overlayEl=document.createElement('div');
      overlayEl.className='fnv-ov';
      overlayEl.setAttribute('role','dialog');
      overlayEl.setAttribute('aria-label','業務ナビ');
      bind(overlayEl);
      document.body.appendChild(overlayEl);
    }
    overlayEl.style.display='';
    render();
    overlayEl.scrollTop=0;
    if(fabEl) fabEl.style.display='none';
  }
  function close(){
    if(overlayEl) overlayEl.style.display='none';
    if(fabEl) fabEl.style.display='';
  }
  function isOpen(){ return !!(overlayEl && overlayEl.style.display!=='none'); }

  function mount(el){
    if(!ctx || !el) return;
    injectCss();
    inlineEl=el;
    bind(inlineEl);
    syncSelFromCtx(false);
    render();
  }

  function backToNavi(){
    hideHint();
    if(ctx && ctx.backToNavi) ctx.backToNavi(); else open();
  }

  /* ── 画面を開いたあとの「この画面でやること」カード ── */
  function hideHint(){ if(hintEl){ hintEl.remove(); hintEl=null; } }
  function showHint(step){
    hideHint();
    if(!step || !step.hint) return;
    injectCss();
    var nx=nextStepOf(step);
    hintEl=document.createElement('div');
    hintEl.className='fnv fnv-hint'+(fabEl?'':' nofab');
    hintEl.innerHTML='<button class="fnv-hclose" aria-label="閉じる">×</button>'
      +'<p class="fnv-hk">いまの作業</p><p class="fnv-ht">'+esc(step.label)+'</p>'
      +'<p class="fnv-hb">'+esc(step.hint)+'</p>'
      +'<div class="fnv-hbtns"><button class="bk">◀ 業務ナビに戻る</button>'
      +(nx?'<button class="nx">次へ：'+esc(nx.label)+' ▶</button>':'')+'</div>';
    hintEl.querySelector('.fnv-hclose').onclick=hideHint;
    hintEl.querySelector('.bk').onclick=backToNavi;
    if(nx) hintEl.querySelector('.nx').onclick=function(){ hideHint(); click(nx); };
    document.body.appendChild(hintEl);
  }

  /* 画面の中の特定の部分を光らせて、そこまでスクロールする（現れるまで少し待つ） */
  function glow(id, tries){
    tries = tries==null ? 25 : tries;
    var el=document.getElementById(id);
    if(!el){ if(tries>0) setTimeout(function(){ glow(id,tries-1); },120); return; }
    try{ el.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){}
    el.classList.remove('fnv-glow'); void el.offsetWidth; el.classList.add('fnv-glow');
    setTimeout(function(){ el.classList.remove('fnv-glow'); }, 6000);
  }

  function syncSelFromCtx(force){
    if(!ctx) return;
    if(sel && !force){ // 院・職種はナビでの選択を保つ。月はアプリの表示に合わせる
      if(ctx.app==='shift' && ctx.y && ctx.m){ sel.y=ctx.y; sel.m=ctx.m; }
      if(isCoord()){ sel.clinic=ctx.clinic; sel.unit=ctx.unit; }
      return;
    }
    var now=new Date();
    var ny=now.getFullYear(), nm=now.getMonth()+2; if(nm>12){nm=1;ny++;} // 既定は「来月」
    var c = ctx.clinic || lsGet('fukumimi_navi_clinic') || CLINICS[0].id;
    var u = ctx.unit || lsGet('fukumimi_navi_unit') || 'nurse';
    if(!CLINICS.some(function(x){return x.id===c;})) c=CLINICS[0].id;
    if(!UNITS.some(function(x){return x.id===u;})) u='nurse';
    sel = { clinic:c, unit:u, y: ctx.y||ny, m: ctx.m||nm };
  }

  function init(c){
    ctx = c || {};
    injectCss();
    syncSelFromCtx(true);
    if(ctx.floating && !fabEl){
      fabEl=document.createElement('button');
      fabEl.className='fnv fnv-fab';
      fabEl.textContent='☰ 業務ナビ';
      fabEl.onclick=function(){ backToNavi(); };
      document.body.appendChild(fabEl);
    }
    api.ready=true;
  }
  /* アプリ側の状態（表示月など）が変わったときに呼ぶ */
  function update(part){
    if(!ctx) return;
    for(var k in part) if(Object.prototype.hasOwnProperty.call(part,k)) ctx[k]=part[k];
    if(isOpen() || inlineEl) { syncSelFromCtx(false); render(); }
  }
  function setFabVisible(on){ if(fabEl) fabEl.style.display = (on && !isOpen()) ? '' : 'none'; }

  var api = {
    version: NAVI_VERSION, ready:false,
    init:init, update:update, open:open, close:close, isOpen:isOpen, mount:mount, go:go,
    showHint:function(app,go){ showHint(findStep(app,go)); }, hideHint:hideHint,
    glow:glow, setFabVisible:setFabVisible, buildUrl:buildUrl,
    sections:SECTIONS
  };
  window.FukuNavi = api;
})();
