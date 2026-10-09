/* A deliberately small, host-authoritative heads-up Hold'em game. The relay
   forwards live messages only; no game data is persisted outside the host tab. */
(() => {
  const $ = (id) => document.getElementById(id);
  const suits = ["♠", "♥", "♦", "♣"], ranks = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
  const params = new URLSearchParams(location.search);
  const table = params.get("table");
  const relayOrigin = "wss://headsup-relay.lukas-koebis.workers.dev";
  let relay, seat = table ? 1 : 0, hostState, viewState, tableCode;

  const card = (c, hidden = false) => {
    if (!c) return '<div class="card empty"></div>';
    if (hidden) return '<div class="card back"></div>';
    const red = c.s === "♥" || c.s === "♦";
    return `<div class="card ${red ? "red" : ""}"><span>${c.r}</span><span class="suit">${c.s}</span></div>`;
  };
  const money = (n) => n.toLocaleString("en-GB");
  const status = (text) => { $("connection-status").textContent = text; };
  const randomCode = () => crypto.randomUUID().replaceAll("-", "");

  function makeDeck() { return ranks.flatMap(r => suits.map(s => ({r,s}))).sort(() => crypto.getRandomValues(new Uint32Array(1))[0] / 2**32 - .5); }
  function blankGame() { return { hand: 0, dealer: 0, stacks:[1000,1000], board:[], hole:[[],[]], street:"waiting", pot:0, contrib:[0,0], currentBet:0, turn:null, actions:0, lastAction:"Waiting for opponent…", result:null }; }
  function publicState(forSeat) {
    const s = structuredClone(hostState);
    delete s.deck;
    s.hole = [forSeat === 0 || s.result ? s.hole[0] : null, forSeat === 1 || s.result ? s.hole[1] : null];
    s.forSeat = forSeat;
    return s;
  }
  function send(message) { if (relay?.readyState === WebSocket.OPEN) relay.send(JSON.stringify(message)); }
  function sendState() { viewState = publicState(0); render(); send({type:"state", state:publicState(1)}); }
  function setConnected(text) { $("connection-pill").textContent = text; }

  function startHand() {
    const s = hostState;
    if (s.stacks.some(n => n <= 0)) { s.lastAction = "Game over — refresh to start again."; sendState(); return; }
    const deck = makeDeck(); s.hand++; s.dealer = (s.hand - 1) % 2; s.board=[]; s.hole=[[deck.pop(),deck.pop()],[deck.pop(),deck.pop()]]; s.deck=deck; s.street="pre-flop"; s.pot=0; s.contrib=[0,0]; s.currentBet=0; s.actions=0; s.result=null;
    postBlind(s.dealer, 5); postBlind(1-s.dealer, 10); s.currentBet=10; s.turn=s.dealer; s.lastAction = `${s.dealer === 0 ? "You" : "Opponent"} to act.`; sendState();
  }
  function postBlind(player, amount) { const paid = Math.min(hostState.stacks[player], amount); hostState.stacks[player]-=paid; hostState.contrib[player]+=paid; hostState.pot+=paid; }
  function take(player, amount) { const paid = Math.min(hostState.stacks[player], amount); hostState.stacks[player]-=paid; hostState.contrib[player]+=paid; hostState.pot+=paid; return paid; }
  function advanceStreet() {
    const s=hostState, order=["flop","turn","river"], i=order.indexOf(s.street);
    if (s.street === "river") return showdown();
    s.street=order[i+1]; const count=s.street === "flop" ? 3 : 1; while (s.board.length < (s.street === "flop" ? 3 : s.street === "turn" ? 4 : 5)) s.board.push(s.deck.pop());
    s.contrib=[0,0]; s.currentBet=0; s.actions=0; s.turn=1-s.dealer; s.lastAction=`${title(s.street)} — ${s.turn===0 ? "your" : "opponent’s"} turn.`; sendState();
  }
  const title = (v) => v[0].toUpperCase()+v.slice(1);
  function act(player, type, total) {
    const s=hostState; if (s.turn !== player || s.result) return;
    const call = Math.max(0, s.currentBet - s.contrib[player]);
    if (type === "fold") { const winner=1-player; s.stacks[winner]+=s.pot; s.result={winner, text:`${winner===0 ? "You win" : "Opponent wins"} — fold.`}; s.turn=null; s.lastAction=s.result.text; return sendState(); }
    if (type === "call") { take(player, call); s.actions++; s.lastAction = call ? `${player===0 ? "You call" : "Opponent calls"} ${money(call)}.` : `${player===0 ? "You check" : "Opponent checks"}.`; if (s.actions >= 2) return advanceStreet(); s.turn=1-player; sendState(); return; }
    if (type === "raise") { const min = s.currentBet ? s.currentBet + 10 : 10; const max = s.contrib[player] + s.stacks[player]; total = Math.max(min, Math.min(max, Math.floor(total))); if (total <= s.currentBet) return; take(player, total-s.contrib[player]); s.currentBet=s.contrib[player]; s.actions=1; s.turn=1-player; s.lastAction=`${player===0 ? "You" : "Opponent"} ${call ? "raise" : "bet"} to ${money(total)}.`; sendState(); }
  }
  function aiTurn() { /* Remote player controls their own browser; no bot. */ }

  function showdown() {
    const s=hostState, a=score(s.hole[0].concat(s.board)), b=score(s.hole[1].concat(s.board)), cmp=compare(a,b);
    if (cmp===0) { s.stacks[0]+=Math.floor(s.pot/2); s.stacks[1]+=Math.ceil(s.pot/2); s.result={winner:null,text:`Split pot — ${a.name}.`}; }
    else { const winner=cmp>0?0:1; s.stacks[winner]+=s.pot; s.result={winner,text:`${winner===0 ? "You win" : "Opponent wins"} with ${winner===0 ? a.name : b.name}.`}; }
    s.turn=null; s.lastAction=s.result.text; sendState();
  }
  function score(cards) { let best=null; combinations(cards,5).forEach(hand => { const x=scoreFive(hand); if (!best || compare(x,best)>0) best=x; }); return best; }
  function combinations(a,n,start=0,p=[],out=[]) { if(p.length===n){out.push(p);return out;} for(let i=start;i<=a.length-(n-p.length);i++) combinations(a,n,i+1,p.concat(a[i]),out); return out; }
  function scoreFive(hand) {
    const vals=hand.map(c=>ranks.indexOf(c.r)+2).sort((a,b)=>b-a), counts={}; vals.forEach(v=>counts[v]=(counts[v]||0)+1);
    const groups=Object.entries(counts).map(([v,n])=>({v:+v,n})).sort((a,b)=>b.n-a.n||b.v-a.v);
    const flush=new Set(hand.map(c=>c.s)).size===1; const uniq=[...new Set(vals)].sort((a,b)=>b-a); let high=uniq[0]; const straight=uniq.length===5 && (uniq[0]-uniq[4]===4 || (uniq.join(",")==="14,5,4,3,2" && (high=5)));
    if(flush&&straight)return {v:[8,high],name:"straight flush"}; if(groups[0].n===4)return {v:[7,groups[0].v,groups[1].v],name:"four of a kind"}; if(groups[0].n===3&&groups[1].n===2)return {v:[6,groups[0].v,groups[1].v],name:"full house"}; if(flush)return {v:[5,...vals],name:"flush"}; if(straight)return {v:[4,high],name:"straight"}; if(groups[0].n===3)return {v:[3,groups[0].v,...groups.slice(1).map(g=>g.v)],name:"three of a kind"}; if(groups[0].n===2&&groups[1].n===2)return {v:[2,groups[0].v,groups[1].v,groups[2].v],name:"two pair"}; if(groups[0].n===2)return {v:[1,groups[0].v,...groups.slice(1).map(g=>g.v)],name:"a pair"}; return {v:[0,...vals],name:"high card"};
  }
  function compare(a,b) { for(let i=0;i<Math.max(a.v.length,b.v.length);i++){const d=(a.v[i]||0)-(b.v[i]||0);if(d)return Math.sign(d);}return 0; }

  function render() {
    const s=viewState; if (!s) return; $("lobby").hidden=true; $("game").hidden=false; $("hand-label").textContent=s.hand ? `Hand ${s.hand} · ${title(s.street)}` : "Waiting";
    const mine=s.forSeat, opp=1-mine; $("your-stack").textContent=`${money(s.stacks[mine])} chips`; $("opponent-stack").textContent=`${money(s.stacks[opp])} chips`; $("your-role").textContent=s.dealer===mine?"D · SB":"BB"; $("opponent-role").textContent=s.dealer===opp?"D · SB":"BB";
    $("your-cards").innerHTML=(s.hole[mine]||[]).map(c=>card(c)).join("") || card(null)+card(null); $("opponent-cards").innerHTML=(s.hole[opp]||[]).map(c=>card(c, !s.result)).join("") || card(null)+card(null);
    $("board").innerHTML=[...s.board,...Array(5-s.board.length).fill(null)].map(c=>card(c)).join(""); $("pot").textContent=money(s.pot); $("you-bet").textContent=s.contrib[mine]?`Bet ${money(s.contrib[mine])}`:""; $("opponent-bet").textContent=s.contrib[opp]?`Bet ${money(s.contrib[opp])}`:"";
    $("game-status").textContent=statusForViewer(s,mine); $("game-status").className="game-status"+(s.result?" winner":""); const mineTurn=s.turn===mine&&!s.result; $("actions").hidden=!mineTurn; $("new-hand").hidden=!(s.result && seat===0);
    if(mineTurn) { const call=Math.max(0,s.currentBet-s.contrib[mine]); $("check-call").textContent=call?`Call ${money(call)}`:"Check"; const min=s.currentBet?s.currentBet+10:10, max=s.contrib[mine]+s.stacks[mine]; $("raise").min=Math.min(min,max); $("raise").max=max; $("raise").value=Math.min(Math.max(min, $("raise").value||min),max); $("raise").disabled=max<min; $("raise-toggle").disabled=max<min; updateRaise(); }
  }
  function updateRaise(){ $("raise-value").textContent=money(+( $("raise").value||0)); }

  function statusForViewer(s, mine) {
    if (s.result) {
      if (s.result.winner === null) return "Split pot.";
      return s.result.winner === mine ? "You win this hand." : "Opponent wins this hand.";
    }
    if (s.turn === null) return s.lastAction;
    return s.turn === mine ? "Your turn." : "Opponent’s turn.";
  }

  function setupHost() {
    tableCode=randomCode(); const url=new URL(location); url.searchParams.set("table",tableCode); $("share-link").value=url.href; $("share-box").hidden=false; hostState=blankGame(); status("Creating your table…"); connectRelay(tableCode, true);
  }
  function setupGuest() {
    $("host-options").hidden=true; $("join-options").hidden=false; $("table-code").textContent=table; status("Connecting to table…"); connectRelay(table, false);
  }
  function connectRelay(code, isHost) {
    relay = new WebSocket(`${relayOrigin}/table/${encodeURIComponent(code)}`);
    relay.addEventListener("open", () => { setConnected(isHost ? "Waiting for player" : "Connected"); status(isHost ? "Table ready — waiting for your opponent." : "Connected — waiting for the host to deal."); });
    relay.addEventListener("message", (event) => {
      let data; try { data=JSON.parse(event.data); } catch { return; }
      if (data.type === "presence") { if (isHost && data.count === 2 && !hostState.hand) startHand(); return; }
      if(data.type==="state"&&!isHost){viewState=data.state; render();} else if(data.type==="action"&&isHost) act(1,data.action,data.total); else if(data.type==="new"&&isHost) startHand();
    });
    relay.addEventListener("close", () => { setConnected("Opponent left"); $("actions").hidden=true; if ($("game-status")) $("game-status").textContent="Connection closed — this table is over."; });
    relay.addEventListener("error", () => status("Couldn’t reach the relay. Reload and try again."));
  }
  function localAction(action,total){ if(seat===0) act(0,action,total); else send({type:"action",action,total}); }
  $("create-table").addEventListener("click",setupHost); $("copy-link").addEventListener("click",async()=>{await navigator.clipboard.writeText($("share-link").value); $("copy-link").textContent="Copied"; setTimeout(()=>$("copy-link").textContent="Copy",1500);}); $("fold").onclick=()=>localAction("fold"); $("check-call").onclick=()=>localAction("call"); $("raise-toggle").onclick=()=>$("raise-box").hidden=!$("raise-box").hidden; $("raise").oninput=updateRaise; $("raise-submit").onclick=()=>{localAction("raise",+$("raise").value); $("raise-box").hidden=true;}; $("new-hand").onclick=()=>startHand();
  if(table) setupGuest();
})();
