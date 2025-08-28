(function(){
  window.showToast = function(message){
    if(!message) return;
    let container = document.getElementById('toast-container');
    if(!container){
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.position = 'fixed';
      container.style.bottom = '1rem';
      container.style.left = '50%';
      container.style.transform = 'translateX(-50%)';
      container.style.zIndex = '9999';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      container.style.gap = '0.5rem';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.background = 'rgba(0,0,0,0.8)';
    toast.style.color = '#fff';
    toast.style.padding = '0.5rem 1rem';
    toast.style.borderRadius = '4px';
    toast.style.fontSize = '0.75rem';
    toast.style.boxShadow = '0 0 4px #000';
    container.appendChild(toast);
    setTimeout(()=>{
      toast.style.transition = 'opacity 0.5s';
      toast.style.opacity = '0';
      setTimeout(()=>toast.remove(),500);
    },3000);
  };
})();
