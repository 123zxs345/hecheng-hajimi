(function(){
  'use strict';
  // Crop the unused title/settings area; physics and sprite proportions stay unchanged.
  const Original=window.GoofyRenderer;
  window.GoofyRenderer=class BoardRenderer extends Original {
    resize(width,height,dpr){
      const scale=Math.min(width/400,height/448);
      this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);
      this.viewport={scale,x:(width-400*scale)/2,y:(height-448*scale)/2-218*scale,dpr};
    }
    overlay(){}
  };
})();
