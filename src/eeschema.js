function loadjscssfile(filename, filetype, onload){
	 if (filetype=="js"){ //if filename is a external JavaScript file
	  var fileref=document.createElement('script')
	  fileref.setAttribute("type","text/javascript")
	  fileref.setAttribute("src", filename)
	 }
	 else if (filetype=="css"){ //if filename is an external CSS file
	  var fileref=document.createElement("link")
	  fileref.setAttribute("rel", "stylesheet")
	  fileref.setAttribute("type", "text/css")
	  fileref.setAttribute("href", filename)
	 }
	 if (typeof fileref!="undefined") {
	  if(typeof onload == 'function') {
		fileref.onload = onload;
	  }
	  document.getElementsByTagName("head")[0].appendChild(fileref)
	 }
}

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
    this.dragStatus = 'none'
    this.canvas = $('<canvas />');
	this.rightPanel = $('<div class="eeschema-panel-right" />');
	this.testButton = $('<input type="button" value="Test" />');
	this.bottomPanel = $('<div class="eeschema-panel-bottom" />');
	this.sizer = $('<div class="eeschema-canvas-sizer" />');
	this.canvasContainer = $('<div class="eeschema-canvas-container" />');
	this.coords = $('<div class="eeschema-coords" >Coords</div>');
	this.canvasTouch = $('<div class="eeschema-canvas-touch" >');
	this.target = $('<div class="debug" >27</div>');
	this.scale = $('<div class="scale" >1</div>');
	this.deltas = $('<div class="coords" >0, 0</div>');
	this.redrawTime = $('<div class="redraw-time" >redraw</div>');
	this.workerStatus =  (typeof(Worker) === 'undefined') ? 'unsupported' : 'supported';
	this.disableWorkers = true; //!(window.location.href.indexOf('disableWorkers=T') == -1 && this.workerStatus == 'supported');
	this.motionContainer = $('<div class="eeschema-motion-container" />');
	
	this.schematic = {};

	this.container.append(this.canvasContainer);
	this.canvasContainer.append(this.canvas);
	
	var ees = this;
	container = this.container;

	this.container.append(this.rightPanel);
	this.rightPanel.append(this.testButton);
	this.testButton.on('click', function() {		
		var objects = ees.fcanvas.getObjects();
		var remaining = objects.length;
		var start = new Date().getTime();
		for(var i = 0; i < objects.length; i++) {	
			var obj = objects[i];
			obj.setCoords();
			ees.fcanvas.renderAll();
			continue;
			//obj.setCoords();
			//continue;
			
			var canvas = obj.canvas;
			var worker = new Worker('worker.js');
			
			obj.canvas = null;
			worker.postMessage({ action: 'set-coords', fabric: obj, viewportTransform: obj.getViewportTransform() });
			worker.addEventListener('message', function(e) {
				if(e.data.action == 'coords-set') {
					obj.currentWidth = e.data.fabric.currentWidth;
					obj.currentHeight = e.data.fabric.currentHeight;
					obj.oCoords = e.data.fabric.oCoords;
					obj.coords = e.data.fabric.coords;
					remaining--;
					
					if(remaining < 1) {
						//obj.render();
						//ees.fcanvas.renderAll();
						console.log('done: ', new Date().getTime() - start);
					}
				}
			});
			
			obj.canvas = canvas;
		}
		console.log('loop: ', new Date().getTime() - start);
	
	
		/*var start = new Date().getTime();
		var svg = 'data:image/svg+xml;base64,' + btoa(ees.fcanvas.toSVG());
		console.log(svg);
		var img = $('<img />');
		
		ees.canvasTouch.css('background-image', 'url(' + svg + ')');
		
		//img.attr('src', svg);
		//ees.canvasTouch.append(img);
		var rt = new Date().getTime() - start;
		ees.redrawTime.html('<span>' + rt + '</span>');*/
	});
	
	this.rightPanel.append(this.target);
	this.rightPanel.append(this.scale);
	this.rightPanel.append(this.deltas);
	this.rightPanel.append(this.redrawTime);
	
	this.container.append(this.bottomPanel);
	this.bottomPanel.append(this.coords);
	this.fcanvas = new fabric.Canvas(this.canvas.get(0));
	this.canvasContainer.append(this.motionContainer);
	this.canvasContainer.append(this.canvasTouch);

	this._init();

	this.fcanvas.selection = false;
	this.fcanvas.allowTouchScrolling = false;

    var sbWidth = getScrollbarWidth();

	this.fcanvas.setWidth(this.canvasContainer.width());
	this.fcanvas.setHeight(this.canvasContainer.height());
	
	/*if(this.disableWorkers) {
		this.workerStatus = 'loading';
		this.deferredJobs = [];
		console.log('Not using workers. Loading ', edaRoot, 'worker.js');
		loadjscssfile(edaRoot + 'worker.js', 'js', function() {
			ees.workerStatus = 'unsupported';
			
			for(var i in ees.deferredJobs) {
				var job = ees.deferredJobs[i];
				console.log('running job: ', job);
				var func = new Function(job.func);
				console.log(func);
				
				func.apply(ees, job.params);
			}
		});
	}*/
}

EeSchema.prototype._init = function() {
	var ees = this;
	
	var START_X = 0;
	var START_Y = 0;
	var ticking = false;
	var isPinching = false;
	var isPanning = false;
	var containerWidth = 0;
	var containerHeight = 0;
	
	ees.transform = {
		translate: { x: START_X, y: START_Y },
		scale: 1,
		angle: 0,
		rx: 0,
		ry: 0,
		rz: 0
	};
	
	var timer;	
	//var el = document.querySelector(".canvas-container");
	var el = document.querySelector(".eeschema-motion-container");
	
	mc = new Hammer.Manager(document.querySelector(".eeschema-canvas-touch"));
	mc.add(new Hammer.Pan({ threshold: 0, pointers: 0 }));
	mc.add(new Hammer.Pinch({ threshold: 0 })).recognizeWith([mc.get('pan')]);
	
	mc.on("pinchstart pinchmove pinchend panstart panmove panend", onGesture);

	var reqAnimationFrame = (function () {
		return window[Hammer.prefixed(window, 'requestAnimationFrame')] || function (callback) {
			window.setTimeout(callback, 1000 / 60);
		};
	})();
	
	mc.on("hammer.input", function(ev) {
		if(ev.isFirst) {
			initScale = 1;
			START_X = 0;
			START_Y = 0;
			containerWidth = ees.canvasTouch.width();
			containerHeight = ees.canvasTouch.height();
			
			var start = new Date().getTime();
			
			var zoom = ees.fcanvas.getZoom();
			var svg = ees.fcanvas.toSVG();
			
			ees.fcanvas.setZoom(zoom);
			
			//ees.motionContainer.html(svg);
			
			svg = 'data:image/svg+xml;base64,' + btoa(svg);
			//console.log(svg);
			ees.motionContainer.css('background-image', 'url(' + svg + ')');
			
			/*var img = $('<img />');
			
			img.attr('src', svg);
			
			var z = ees.motionContainer.width()/zoom;
			console.log(z);
			
			ees.motionContainer.append(img);*/
			var rt = new Date().getTime() - start;
			ees.redrawTime.html('<span>' + rt + '</span>');
		}
		else if(ev.isFinal) {
			redraw();
			requestElementUpdate();
		}
	});
	
	var initScale = 1;
	var startDraw = new Date().getTime();
	var doRedraw = false;
	   
	function onGesture(ev) {
	    try {
			doRedraw = new Date().getTime() - startDraw > 2000;
	        
			ees.transform.translate = {
				    x: START_X + ev.deltaX,
				    y: START_Y + ev.deltaY
			};
			
			if(isPinching) {
			    ees.transform.scale = initScale * ev.scale;
			}
            
            if(ev.type == 'panstart') {		
				startDraw = new Date().getTime();
                isPanning = true;
            }
	        else if(ev.type == 'pinchstart') {
       		    isPinching = true;
				startDraw = new Date().getTime();
	        }
		    else if(ev.type == 'pinchend') {
				isPinching = false;
				doRedraw = true;				
	        }   
	        else if(ev.type == 'panend') {
				if(!isPinching)
    				isPanning = false;

                isPinching = false;
					
				doRedraw = true;
	        }
			
			if(doRedraw) {
//			    redraw();	
				updateElement = true;
			}
			doRedraw = false;
			requestElementUpdate();
			
        }
        catch(e) {
            ees.coords.html('Error: ' + e);
        }   
	}
	
	function redraw() {
		var center = ees.fcanvas.getCenter();
		startDraw = new Date().getTime();
		
		if(ees.transform.scale != 1) {
			ees.fcanvas.zoomToPoint(new fabric.Point(center.left, center.top), ees.transform.scale * ees.fcanvas.getZoom());
			
			if(isPinching) {
				initScale = initScale/ees.transform.scale;
			}
			else {
				initScale = 1;
			}
		}
		
		if(ees.transform.translate.x != 0 || ees.transform.translate.y != 0) {
			ees.fcanvas.relativePan(new fabric.Point(ees.transform.translate.x, ees.transform.translate.y));
			
			if(isPanning) {
				START_X -= ees.transform.translate.x;
				START_Y -= ees.transform.translate.y;
			}
			else {
				START_X = 0;
				START_Y = 0;
				initScale = 1;
			}
		}
		
		var rt = new Date().getTime() - startDraw;
		ees.redrawTime.html('<span>' + rt + '</span>');
		
		resetElement();
	}
	
	function updateElementTransform() {
		if(doRedraw) {
			redraw();
		}
	
		var value = [
			'translate3d(' + ees.transform.translate.x + 'px, ' + ees.transform.translate.y + 'px, 0)',
			//'scale(' + ees.transform.scale + ', ' + ees.transform.scale + ')',
			'rotate3d('+ ees.transform.rx +','+ ees.transform.ry +','+ ees.transform.rz +','+  ees.transform.angle + 'deg)'
		];

		value = value.join(" ");
		el.style.webkitTransform = value;
		el.style.mozTransform = value;
		el.style.transform = value;
		el.style.width = parseInt(ees.transform.scale * containerWidth) + 'px';
		el.style.height = parseInt(ees.transform.scale * containerHeight) + 'px';
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
			ees.transform.translate = { x: 0, y: 0 };
			ees.transform.scale = 1;
			ees.transform.angle = 0;
			ees.transform.rx = 0;
			ees.transform.ry = 0;
			ees.transform.rz = 0;

			requestElementUpdate();
	}
	
	resetElement();
	
    this.canvasTouch.on('mousewheel', function(e) {
        if(e.deltaY > 0)
            ees.zoomIn();
        else if(e.deltaY < 0)
            ees.zoomOut();
	});
	
	this.canvasTouch.on('mousemove', function(e) {
		ees.fcanvas.mouseX = e.clientX;
		ees.fcanvas.mouseY = e.clientY;
		var zoom = ees.fcanvas.getZoom();
		ees.coords.html((e.clientX/zoom - ees.fcanvas.viewportTransform[4]/zoom) + ', ' + (e.clientY/zoom - ees.fcanvas.viewportTransform[5]/zoom));
	});
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
	/*var ees = this;
	if(this.workerStatus == 'loading') {
		console.log('worker loading');
		this.deferredJobs.push({ func: 'this.parseSchematic(arguments[0])', params: [txt] });
	}
	else {
		var worker = new Worker(edaRoot + 'worker.js');
		
		worker.postMessage({ action: 'parse-schematic', text: txt });
		worker.addEventListener('message', function(e) {
			ees.handleMessage(e.data);
		});
	}

	return;*/
	
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
				this.schematic.description = {};
				this.schematic.description.sheetSize = props[1];
				this.schematic.description.sheetWidth = props[2];
				this.schematic.description.sheetHeight = props[3];
			}
			else if(props[0] == '$Comp') {
				l_index += this.parseComponent(lines.slice(l_index));
			}
			else if(props[0] == 'Wire' || props[0] == 'Entry') {
                //continue
                    
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

				var l = new fabric.Line([ wire.x0, wire.y0, wire.x1, wire.y1 ], {
					stroke: 'black',
					strokeWidth: 1,
					left: wire.x0,
					top: wire.y0,
					originX: wire.x0,
					originY: wire.y0
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

EeSchema.prototype.handleMessage = function(data) {
	switch(data.action) {
		case 'schematic-description':
			this.schematic.description = data.description;
			this.resetView();
			break;
		case 'schematic-component':
			if(typeof this.libraries[data.component.library] != 'undefined') {
				data.component.definition = this.libraries[data.component.library];
				this.drawComponent(data.component);
			}
			else {
				console.log('Unable to find definition for component: ', data.component.library);
			}
			
			this.components.push(data.component);
			break;
		case 'schematic-wire':
			break;
			var wire = data.wire;
			var l = new fabric.Line([ wire.x0, wire.y0, wire.x1, wire.y1 ], {
				stroke: 'black',
				strokeWidth: 1,
				left: wire.x0,
				top: wire.y0,
				originX: wire.x0,
				originY: wire.y0
			});
				
			l.lineType = wire.type;
			l.linePurpose = wire.purpose;
			l.lineCharacteristic = wire.characteristic;
			
			this.fcanvas.add(l);
			this.wires.push(l);
			break;
		case 'schematic-complete':
			//this.resetView();
			break;
	}
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
			else if(props[0] == 'F') {
				// TODO: fields
			}
			else if(props[0] == '\t') {
				l_index++; // Skip first placement properties as they are redundant x,y
				// TODO: rotation matrix
			}
			else if(props[0] == '$EndComp') {
				break;
			}
		}
	}
	
	if(comp.definition != null) {	
		comp.fabric = comp.definition.Create();
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

EeSchema.prototype.drawComponent = function(comp) {
	comp.fabric = comp.definition.Create(comp.x, comp.y);
	comp.fabric.selectable = false;
	this.fcanvas.add(comp.fabric);
	//comp.fabric.setLeft(comp.x);
	//comp.fabric.setTop(comp.y);
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
	var zoomW = zoom * this.schematic.description.sheetWidth;
    var zoomH = zoom * this.schematic.description.sheetHeight;
    
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
}

EeSchema.prototype.recalcScroll = function() {
	var dwidth = this.fcanvas.getWidth()/this.schematic.description.sheetWidth;
	var dheight = this.fcanvas.getHeight()/this.schematic.description.sheetHeight;
}
	
EeSchema.prototype.resetView = function() {
	var width = this.fcanvas.getWidth();
	var height = this.fcanvas.getHeight()
	var fit = 1;
	var hRatio = width / this.schematic.description.sheetWidth;
	var vRatio = height / this.schematic.description.sheetHeight;
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
