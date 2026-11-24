const items=[...document.querySelectorAll('.item')];
const channels=[...document.querySelectorAll('.channel')];
let menuIndex=0,channelIndex=0,area='menu';

function select(list,index){
  list.forEach((el,i)=>el.classList.toggle('selected',i===index));
}
function clock(){
  document.getElementById('clock').textContent=
    new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
}
clock();
setInterval(clock,10000);

document.addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(e.key))e.preventDefault();
  if(e.key==='ArrowUp'||e.key==='ArrowDown'){
    if(area==='menu'){
      menuIndex=(menuIndex+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;
      select(items,menuIndex);
    }else{
      channelIndex=(channelIndex+(e.key==='ArrowDown'?1:-1)+channels.length)%channels.length;
      select(channels,channelIndex);
    }
  }
  if(e.key==='ArrowRight')area='channels';
  if(e.key==='ArrowLeft')area='menu';
  if(e.key==='Enter'){
    if(area==='menu')select(items,menuIndex);
    else select(channels,channelIndex);
  }
});
