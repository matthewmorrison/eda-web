function EeSchema(container) {
    this.container = $(container);
	this.canvasScale = 1;
	this.SCALE_FACTOR = 1.2;
	this.PAN_STEP = 1.1;
	this.canvasPan = [0, 0];
	this.localMode = false;
	this.libraries = {};
	this.components = [];
	this.wires = []; // and buses
	this.junctions = [];
    this.dragStatus = 'none'
    this.canvas = $('<canvas />');
	this.rightPanel = $('<div class="eeschema-panel-right" />');
	this.testButton = $('<input type="button" value="Test" />');
	this.bottomPanel = $('<div class="eeschema-panel-bottom" />');
	this.sizer = $('<div class="eeschema-canvas-sizer" />');
	this.canvasContainer = $('<div class="eeschema-canvas-container" />');
	this.coords = $('<div class="eeschema-coords" >Coords</div>');
	this.canvasTouch = $('<div class="eeschema-canvas-touch" >');
	this.target = $('<div class="debug" >3</div>');
	this.scale = $('<div class="scale" >1</div>');
	this.deltas = $('<div class="coords" >0, 0</div>');

	this.container.append(this.canvasContainer);
	//this.panner.append(this.sizer);
	this.canvasContainer.append(this.canvas);
	
	var ees = this;
	container = this.container;

	this.container.append(this.rightPanel);
	this.rightPanel.append(this.testButton);
	this.testButton.on('click', function() {
		ees.resetView();
	});
	
	this.rightPanel.append(this.target);
	this.rightPanel.append(this.scale);
	this.rightPanel.append(this.deltas);
	
	this.container.append(this.bottomPanel);
	this.bottomPanel.append(this.coords);
	this.fcanvas = new fabric.Canvas(this.canvas.get(0));
	this.canvasContainer.append(this.canvasTouch);

	this._init();

	this.fcanvas.selection = false;
	this.fcanvas.allowTouchScrolling = false;

    var sbWidth = getScrollbarWidth();

	this.fcanvas.setWidth(this.canvasContainer.width());
	this.fcanvas.setHeight(this.canvasContainer.height());
}

EeSchema.prototype._init = function() {
	var ees = this;
	
	var START_X = 0;
	var START_Y = 0;
	var ticking = false;
	var isPinching = false;
	var isPanning = false;
	var transform = {
				translate: { x: START_X, y: START_Y },
				scale: 1,
				angle: 0,
				rx: 0,
				ry: 0,
				rz: 0
	};
	
	var timer;	
	var el = document.querySelector(".canvas-container");
	
	mc = new Hammer.Manager(document.querySelector(".eeschema-canvas-touch"));
	mc.add(new Hammer.Pan({ threshold: 0, pointers: 0 }));
	//mc.add(new Hammer.Pinch({ threshold: 0 }))
	mc.add(new Hammer.Pinch({ threshold: 0 })).recognizeWith([mc.get('pan')]);
	
	mc
	    .on("pinchstart pinchmove pinchend panstart panmove panend", onGesture);

	var reqAnimationFrame = (function () {
		return window[Hammer.prefixed(window, 'requestAnimationFrame')] || function (callback) {
			window.setTimeout(callbkack, 1000 / 60);
		};
	})();
	
	var initScale = 1;
	   
	function onGesture(ev) {
	    try {
			ees.scale = ev.scale;
			ees.deltas.html(ev.deltaX + ', ' + ev.deltaY);
	        if(ev.type == 'pinchstart'
	        || ev.type == 'pinchend'
	        || ev.type == 'panstart'
	        || ev.type == 'panend') {
	            var l = '';
	            if(ev.isFirst)
	            	l += '[isFirst]';
	            
	            if(ev.isFinal)
	            	l += '[isFinal]';
	            
	            ees.target.html(ev.target.className);
	            
	            ees.coords.html(ees.coords.html() + '->' + ev.type + l);
	        }
	        
            if(ev.type == 'panmove') {
			    transform.translate = {
				    x: START_X + ev.deltaX,
				    y: START_Y + ev.deltaY
			    };
			
			    requestElementUpdate();
            }
            else if(ev.type == 'pinchmove') {
	            transform.scale = initScale * ev.scale;
			    requestElementUpdate();
	        }
            else if(ev.type == 'panstart') {
                isPanning = true;
            }
	        else if(ev.type == 'pinchstart') {
       		    isPinching = true;
	            //initScale = 1; //ees.fcanvas.getZoom();
	        }
            else if(ev.isFinal || (ev.type == 'pinchend' && !isPanning)) { // hammerjs has a bug that prevents isFinal from getting set when pinchend
		        //ees.coords.html('isFinal');
                var center = ees.fcanvas.getCenter();
			    ees.fcanvas.zoomToPoint(new fabric.Point(center.left, center.top), transform.scale * ees.fcanvas.getZoom());
			
			    onPanEnd(ev);
			
			    resetElement();
			    requestElementUpdate();
            } 
		    else if(ev.type == 'pinchend') {
		        //ees.coords.html('pinchend');
		        isPinching = false;
		        transform.scale = initScale * ev.scale;
		        requestElementUpdate();
		        
		        if(!ev.isFinal || isPanning) {
		            initScale = transform.scale;
		        }
	        }   
	        else if(ev.type == 'panend') {
		        //ees.coords.html('panend');
		        isPanning = false;
	        }
        }
        catch(e) {
            ees.coords.html('Error: ' + e);
        }   
	}
	
	function onPanEnd(ev) {			
			var x = ev.deltaX;
			var y = ev.deltaY;   

			ees.fcanvas.relativePan(new fabric.Point(x, y));
		    //resetElement();
	}
	
	function updateElementTransform() {
		var value = [
			'translate3d(' + transform.translate.x + 'px, ' + transform.translate.y + 'px, 0)',
			'scale(' + transform.scale + ', ' + transform.scale + ')',
			'rotate3d('+ transform.rx +','+ transform.ry +','+ transform.rz +','+  transform.angle + 'deg)'
		];

		value = value.join(" ");
		el.style.webkitTransform = value;
		el.style.mozTransform = value;
		el.style.transform = value;
		ticking = false;
	}

	function requestElementUpdate() {
		if(!ticking) {
			reqAnimationFrame(updateElementTransform);
			ticking = true;
		}
	}

	function resetElement() {
			$(el).addClass('animate');
			transform.translate = { x: START_X, y: START_Y };
			transform.scale = 1;
			transform.angle = 0;
			transform.rx = 0;
			transform.ry = 0;
			transform.rz = 0;
			initScale = 1;

			requestElementUpdate();
	}
	
	resetElement();
	
    this.canvasTouch.on('mousewheel', function(e) {
        if(e.deltaY > 0)
            ees.zoomIn();
        else if(e.deltaY < 0)
            ees.zoomOut();
        
        
		/*e.preventDefault();
	    zoomer = $(this);
		var scroll = zoomer.scrollTop();
		
		if(scroll < 1000) {	
			ees.zoomIn();
		}
		else if(scroll > 1000) {
			ees.zoomOut();
		}
		
		zoomer.scrollTop(1000);*/
	});
	
/*	this.panner.on('scroll', function(e) {	
		var panner = $(this);
		
		var left = panner.scrollLeft();
		var top = panner.scrollTop();
		
		ees.zoomer.css('left', left);
			
		ees.zoomer.css('top', top);
		
		if(ees.fcanvas.viewportTransform[4] > 0)
		    left -= ees.fcanvas.viewportTransform[4];
		    
		if(ees.fcanvas.viewportTransform[5] > 0)
		    top -= ees.fcanvas.viewportTransform[5];
		
	    ees.fcanvas.absolutePan(new fabric.Point(left, top));
	    
	    ees.updatePan();
	});*/

	//this.zoomer.scrollTop(1000);
	
	/*this.fcanvas.on('mouse:down', function(obj) {
		var dragHandle = function(obj) {
			ees.canvasDrag(obj.e);
		}
	
	    $(window).on('mousemove', '', dragHandle);
		
		ees.dragStatus = 'start';
		ees.dragStart = [obj.e.clientX, obj.e.clientY];
		ees.dragPanStart = [ees.fcanvas.viewportTransform[4], ees.fcanvas.viewportTransform[5]];
		
		var upEv = $(window).one({
			mouseup: function() {
				ees.dragStatus = 'none';
				$(window).off('mousemove', '', dragHandle);
				ees.updatePan();
			}
		});
	});*/
	
	this.fcanvas.on('mouse:move', function(obj) {
		var e = obj.e;	

		ees.fcanvas.mouseX = e.clientX;
		ees.fcanvas.mouseY = e.clientY;
		var zoom = ees.fcanvas.getZoom();
		
		//ees.coords.html((e.clientX/zoom - ees.fcanvas.viewportTransform[4]/zoom) + ', ' + (e.clientY/zoom - ees.fcanvas.viewportTransform[5]/zoom));
	});
	
	
    /*var canvasHammer = new Hammer(this.canvasContainer.get(0));
    
    canvasHammer.on('panstart', function(e) {
        ees.coords.html('pan');
    	ees.dragPanStart = [ees.fcanvas.viewportTransform[4], ees.fcanvas.viewportTransform[5]];
        ees.dragStatus = 'start';
        
        
        ees.container.addClass('panning');
        ees.panPreview.css('top', 0);
        ees.panPreview.css('left', 0);
        ees.panPreview.css('opacity', .5);
    })
    .on('panmove', function(e) {
        ees.panPreview.css('top', e.deltaY);
        ees.panPreview.css('left', e.deltaX);
    
       // var x = -ees.dragPanStart[0] - e.deltaX;
        //var y = -ees.dragPanStart[1] - e.deltaY;   
        //ees.fcanvas.absolutePan(new fabric.Point(x, y));
    })
    .on('panend', function(e) {
        ees.dragStatus = 'none';
        
        ees.panPreview.css('top', 0);
        ees.panPreview.css('left', 0);
        ees.container.removeClass('panning');
        var x = -ees.dragPanStart[0] - e.deltaX;
        var y = -ees.dragPanStart[1] - e.deltaY;   
        ees.fcanvas.absolutePan(new fabric.Point(x, y));
    })
    .on('pinchstart', function() {
        this.coords.html('zoom');
        ees.zoomOut();
    });*/
}

//var screen = document.querySelector(".device-screen");




EeSchema.prototype._initMobile = function() {

}

EeSchema.prototype.canvasDrag = function(e) {
	if(this.dragStatus != 'dragging')
		this.dragStatus = 'dragging';
	
	var x = this.dragStart[0] - this.fcanvas.mouseX  - this.dragPanStart[0];
	var y = this.dragStart[1] - this.fcanvas.mouseY - this.dragPanStart[1];
		
	absolutePan(new fabric.Point(x, y));
}

function getScrollbarWidth() {
  var div, body, W = window.browserScrollbarWidth;
  if (W === undefined) {
    body = document.body, div = document.createElement('div');
    div.innerHTML = '<div style="width: 50px; height: 50px; position: absolute; left: -100px; top: -100px; overflow: auto;"><div style="width: 1px; height: 100px;"></div></div>';
    div = div.firstChild;
    body.appendChild(div);
    W = window.browserScrollbarWidth = div.offsetWidth - div.clientWidth;
    body.removeChild(div);
  }
  return W;
};

/*$(function() {
    $('.eeschema').each(function(index, item) {
        var ees = new EeSchema(item);
        
        $(item).data('eeschema', ees);
    });
});*/

EeSchema.prototype.open = function(location) {
    this.url = location;

	$.ajax({
	    dataType: 'jsonp',
	    url: location,
	    contentType: 'text/plain',
	    jsonpCallback: 'jsonpTest',
	    success: function() { console.log('success'); }
	})
	.done(function(response) {
		console.log('Response: ', response);
		this.parseSchematic(response);
	});
}

EeSchema.prototype.parseSchematic = function(txt) {
	var lines = txt.split('\n');
	var section = '';

	for(var l_index = 0; l_index < lines.length; l_index++) {
		var line = lines[l_index];
		
		if(line[0] != '#') { //Skip comments
			var props = line.match(/(?:[^\s"]+|"[^"]*")+/g);
			
			if(props[0].indexOf('LIBS:') == 0 && !this.localMode) {
			    var file = props[0].substring(5);
				console.log('Load-', file);
				
				var path = this.location.substring(0, this.location.lastIndexOf('/')) + '/' + file;
				
				console.log('fetch: ' + path);
				
				$.ajax(path)
				.done(function(response) {
				    this.parseLibrary(response);
				});
			}
			else if(props[0] == '$Descr') {
				this.sheetSize = props[1];
				this.sheetWidth = props[2];
				this.sheetHeight = props[3];
			}
			else if(props[0] == '$Comp') {
				l_index += this.parseComponent(lines.slice(l_index));
			}
			else if(props[0] == 'Wire' || props[0] == 'Entry') {
                continue
                    
				var wire = {
					type: props[0],
					purpose: props[1],
					characteristic: props[2],
				}
				
				l_index++;
				line = lines[l_index];
				
				props = line.match(/(?:[^\s"]+|"[^"]*")+/g);
				
				wire.x0 = props[0];
				wire.y0 = props[1];
				wire.x1 = props[2];
				wire.y1 = props[3];

				var l = new fabric.Line([ /*wire.x0, wire.y0,*/ 0, 0, wire.x1, wire.y1 ], {
					stroke: 'black',
					strokeWidth: 1,
					left: wire.x0,
					top: wire.y0
				});
				
				l.lineType = wire.type;
				l.linePurpose = wire.purpose;
				l.lineCharacteristic = wire.characteristic;
				
				this.fcanvas.add(l);
				this.wires.push(l);
			}
		}
	}
	
	console.log('Done parsing schematic: ', new Date());

	
	this.resetView();
}

EeSchema.prototype.parseComponent = function(lines) {
	var l_index = 0;
	var center = this.fcanvas.getCenter();
	var comp = {
		fabric: null,
		definition: null,
		x: center.left,
		y: center.top
	};
	
	for(; l_index < lines.length; l_index++) {
		var line = lines[l_index];
		
		if(line[0] != '#') { //Skip comments
			var props = line.match(/(?:[^\s"]+|"[^"]*")+/g);
			
			if(props[0] == '$Comp') {
				
			}
			else if(props[0] == 'L') {
				if(typeof this.libraries[props[1]] != 'undefined') {
					comp.definition = this.libraries[props[1]];
				}
				else {
					console.log('Unable to find definition for component: ', props[1]);
				}
			}
			else if(props[0] == 'P') {
				comp.x = props[1]/1;
				comp.y = props[2]/1;
			}
			else if(props[0] == '$EndComp') {
				break;
			}
		}
	}
	
	if(comp.definition != null) {
		comp.fabric = comp.definition.Create(center);
		comp.fabric.selectable = false;
		this.fcanvas.add(comp.fabric);
		comp.fabric.setLeft(comp.x);
		comp.fabric.setTop(comp.y);
	}

	this.components.push(comp);
	
	return l_index;
}

EeSchema.prototype.parseLibrary = function(txt) {
	var lines = txt.split('\n');
	var block = '';
	var section = '';

	for(var l_index = 0; l_index < lines.length; l_index++) {
		var line = lines[l_index];

		if(line[0] != '#') { //Skip comments
			var props = line.match(/(?:[^\s"]+|"[^"]*")+/g);
			
			if(props[0] == 'DEF') {
				var def = new ComponentDefinition();
				l_index += def.parse(lines.slice(l_index));
				
				this.libraries[def.name] = def;
			}
			else if(block != '') {
				block += line;
				
				if(props[0] == 'ENDDEF') {
					
				}
			}
		}
	}
}

EeSchema.prototype.zoomIn = function() {
		// TODO limit the max canvas zoom in
		var x = this.fcanvas.mouseX;
		var y = this.fcanvas.mouseY;
		
		this.fcanvas.zoomToPoint(new fabric.Point(x, y), this.fcanvas.getZoom() * this.SCALE_FACTOR);
		
		this.updatePan(true);
}

	// Zoom Out
EeSchema.prototype.zoomOut = function() {
		// TODO limit max cavas zoom out
		var center = this.fcanvas.getCenter();
		this.fcanvas.zoomToPoint(new fabric.Point(center.left, center.top), this.fcanvas.getZoom() * (1 / this.SCALE_FACTOR));
		
		this.updatePan(true);
}

EeSchema.prototype.updatePan = function(allowOverPan) {
return;
	var zoom = this.fcanvas.getZoom();
	var zoomW = zoom * this.sheetWidth;
    var zoomH = zoom * this.sheetHeight;
    
    if(allowOverPan) {
	    if(this.fcanvas.viewportTransform[4] < 0)
	        zoomW -= this.fcanvas.viewportTransform[4];

        if(this.fcanvas.viewportTransform[5] < 0)
            zoomH -= this.fcanvas.viewportTransform[5];
    }

	this.sizer.width(zoomW);
	this.sizer.height(zoomH);
	
	this.panner.scrollLeft(-1 * this.fcanvas.viewportTransform[4]);
	this.panner.scrollTop(-1 * this.fcanvas.viewportTransform[5]);
	
	//this.zoomer.css('left', this.panner.scrollLeft());
	//this.zoomer.css('top', this.panner.scrollTop());
}

EeSchema.prototype.recalcScroll = function() {
	var dwidth = this.fcanvas.getWidth()/this.sheetWidth;
	var dheight = this.fcanvas.getHeight()/this.sheetHeight;
}
	
EeSchema.prototype.resetView = function() {
	var width = this.fcanvas.getWidth();
	var height = this.fcanvas.getHeight()
	var fit = 1;
	var hRatio = width / this.sheetWidth;
	var vRatio = height / this.sheetHeight;
	var left = 0;
	var top = 0;
	
	if(vRatio < hRatio) {
		left = (width/hRatio - width/vRatio) * vRatio/2;
		fit = vRatio;
	}
	else {
		top = (height/vRatio - height/hRatio) * hRatio/2;
		fit = hRatio;
	}
	
	this.fcanvas.setZoom(fit);
	this.fcanvas.absolutePan(new fabric.Point(left, top));
	
	this.updatePan(true);
}
