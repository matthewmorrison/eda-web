function EeSchema(container) {
    this.container = $(container);
    this.canvas = $('<canvas />');	
	this.canvasScale = 1;
	this.SCALE_FACTOR = 1.2;
	this.PAN_STEP = 1.1;
	this.canvasPan = [0, 0];
	this.panner = $('<div class="eeschema-canvas-panner" />');
	this.zoomer = $('<div class="eeschema-canvas-zoomer"><canvas /></div>');
	this.sizer = $('<div class="eeschema-canvas-sizer" />');
	this.localMode = false;
	this.libraries = {};
	this.components = [];
	this.wires = []; // and buses
	this.junctions = [];
	this.rightPanel = $('<div class="eeschema-panel-right" />');
	this.testButton = $('<input type="button" value="Test" />');
	this.bottomPanel = $('<div class="eeschema-panel-bottom" />');
	this.coords = $('<div class="eeschema-coords" >Coords</div>');
	
	var ees = this;
	container = this.container;
	
	this.container.append(this.panner);
	this.panner.append(this.sizer);
	this.panner.append(this.zoomer);
    this.zoomer.append(this.canvas);
	
	this.container.append(this.rightPanel);
	this.rightPanel.append(this.testButton);
	this.testButton.on('click', function() {
	    var t = ees.libraries['MPU-9250'].Create(ees.fcanvas.getCenter());
		ees.fcanvas.add(t);
//		t.setLeft(this.fab);
//		t.setTop(comp.y);    
	});
	
	this.container.append(this.bottomPanel);
	this.bottomPanel.append(this.coords);
	
	this.fcanvas = new fabric.Canvas(this.canvas.get(0));

	this.fcanvas.setWidth(this.zoomer.width() - 10);
	this.fcanvas.setHeight(this.zoomer.height());
	
	this.zoomer.on('scroll', function(e) {
		e.preventDefault();
	    zoomer = $(this);
		var scroll = zoomer.scrollTop();
		
		if(scroll < 1000) {	
			ees.zoomIn();
		}
		else if(scroll > 1000) {
			ees.zoomOut();
		}
		
		zoomer.scrollTop(1000);
	});
	
	this.panner.on('scroll', function(e) {
	    console.log(e);
		var panner = $(this);
		
		var left = panner.scrollLeft();
		var top = panner.scrollTop();
		
		//if(left < ees.canvasScale * ees.sheetWidth - ees.fcanvas.getWidth())
			ees.zoomer.css('left', left);
			
		//if(top < ees.canvasScale * ees.sheetHeight - ees.fcanvas.getHeight())
			ees.zoomer.css('top', top);
		
		if(ees.fcanvas.viewportTransform[4] > 0)
		    left -= ees.fcanvas.viewportTransform[4];
		    
		if(ees.fcanvas.viewportTransform[5] > 0)
		    top -= ees.fcanvas.viewportTransform[5];
		
	    ees.fcanvas.absolutePan(new fabric.Point(left, top));
	    
	    ees.updatePan();
	});

	this.zoomer.scrollTop(1000);
	
	this.fcanvas.on('mouse:drag', function(obj) {
	    console.log('drag');
	});
	
	this.fcanvas.on('mouse:move', function(obj) {
		var e = obj.e;	
		ees.canvas.data('mouseX', e.clientX);
		ees.canvas.data('mouseY', e.clientY);
		var zoom = ees.fcanvas.getZoom();
		//ees.coords.html(((e.clientX + ees.fcanvas.viewportTransform[5]) * 1/zoom) + ', ' + ((e.clientY + ees.panner.scrollTop()) * 1/zoom));
		ees.coords.html(e.clientX + ', ' + e.clientY);
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
	
	//this.zoomOut();
	//this.zoomOut();
	//this.zoomOut();
	//this.zoomOut();
	
	this.sizer.width(this.canvasScale * this.sheetWidth);
	this.sizer.height(this.canvasScale * this.sheetHeight);
	console.log('done parsing schematic');
	//this.resetView();
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
		//console.log(canvas.getZoom());

		var x = this.canvas.data('mouseX');
		var y = this.canvas.data('mouseY');
		
		this.fcanvas.zoomToPoint(new fabric.Point(x, y), this.fcanvas.getZoom() * this.SCALE_FACTOR);
        console.log(this.fcanvas.getZoom(), this.fcanvas.viewportTransform);
		
		/*var objects = this.fcanvas.getObjects();		
        this.canvasScale = this.canvasScale * this.SCALE_FACTOR;
		var center = this.fcanvas.getCenter();
		var x = this.canvas.data('mouseX');
		var y = this.canvas.data('mouseY');
		//this.resetView();
		
		panX = x * .2;
		panY = y * .2;

		for (var i in objects) {
			var scaleX = objects[i].scaleX;
			var scaleY = objects[i].scaleY;
			var left = objects[i].left;
			var top = objects[i].top;

			var tempScaleX = scaleX * this.SCALE_FACTOR;
			var tempScaleY = scaleY * this.SCALE_FACTOR;
			//var tempLeft = left * this.SCALE_FACTOR - panX;
			//var tempTop = top * this.SCALE_FACTOR - panY;
			var tempLeft = left * this.SCALE_FACTOR;
			var tempTop = top * this.SCALE_FACTOR;
			//var tempLeft = left * this.SCALE_FACTOR - this.panner.scrollLeft() * (.2 / this.SCALE_FACTOR);
			//var tempTop = top * this.SCALE_FACTOR;
			
			objects[i].scaleX = tempScaleX;
			objects[i].scaleY = tempScaleY;
			objects[i].left = tempLeft;
			objects[i].top = tempTop;
			
			objects[i].setCoords();
		}
			
		this.fcanvas.renderAll();*/
		
		//this.panner.scrollLeft(this.panner.scrollLeft() * this.SCALE_FACTOR - panX);
		
		this.updatePan(true);
}

	// Zoom Out
EeSchema.prototype.zoomOut = function() {
		// TODO limit max cavas zoom out
		
		//this.fcanvas.zoomToPoint(new fabric.Point(4650, 3750), this.fcanvas.getZoom() * (1 / this.SCALE_FACTOR));
		
		var center = this.fcanvas.getCenter();
		this.fcanvas.zoomToPoint(new fabric.Point(center.left, center.top), this.fcanvas.getZoom() * (1 / this.SCALE_FACTOR));
        console.log(this.fcanvas.getZoom(), this.fcanvas.getPointer(), this.fcanvas.viewportTransform);
		console.log(this.fcanvas);
		//this.resetView();
		
		/*var objects = this.fcanvas.getObjects();		
		this.canvasScale = this.canvasScale / this.SCALE_FACTOR;
		var center = this.fcanvas.getCenter();
		
		var scrollX = this.panner.scrollLeft();
		var scrollY = this.panner.scrollTop();

		for (var i in objects) {
			var scaleX = objects[i].scaleX;
			var scaleY = objects[i].scaleY;
			var left = objects[i].left;
			var top = objects[i].top;
		
			var tempScaleX = scaleX * (1 / this.SCALE_FACTOR);
			var tempScaleY = scaleY * (1 / this.SCALE_FACTOR);
			var tempLeft = left * (1 / this.SCALE_FACTOR);
			var tempTop = top * (1 / this.SCALE_FACTOR);
			//var tempLeft = left * (1 / this.SCALE_FACTOR) + center.left* (.2 / this.SCALE_FACTOR);
			//var tempTop = top * (1 / this.SCALE_FACTOR) + center.top * (.2 / this.SCALE_FACTOR);
			//var tempLeft = left * (1 / this.SCALE_FACTOR) + this.panner.scrollLeft() * (.2 / this.SCALE_FACTOR);
			//var tempTop = top * (1 / this.SCALE_FACTOR);
			
			objects[i].scaleX = tempScaleX;
			objects[i].scaleY = tempScaleY;
			objects[i].left = tempLeft;
			objects[i].top = tempTop;

			objects[i].setCoords();
		}
		
		this.fcanvas.renderAll();*/
		
		this.updatePan(true);
}

EeSchema.prototype.updatePan = function(allowOverPan) {
	var zoom = this.fcanvas.getZoom();
	var zoomW = zoom * this.sheetWidth;
    var zoomH = zoom * this.sheetHeight;
    console.log('update pan ', this.fcanvas.viewportTransform);
    
//    zoomW += Math.abs(this.fcanvas.viewportTransform[4]);
//    zoomH += Math.abs(this.fcanvas.viewportTransform[5]);
    
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
	
	this.zoomer.css('left', this.panner.scrollLeft());
	this.zoomer.css('top', this.panner.scrollTop());
	
	/*this.sizer.width(this.canvasScale * this.sheetWidth);
	this.sizer.height(this.canvasScale * this.sheetWidth);
	
	var sTop = this.panner.scrollTop();
	var sLeft = this.panner.scrollLeft();
	var objects = this.fcanvas.getObjects();
	
	for (var i in objects) {
		var scaleX = objects[i].scaleX;
		var scaleY = objects[i].scaleY;
		var left = objects[i].left;
		var top = objects[i].top;

		var tempLeft = left + this.canvasPan[0] - sLeft;
		var tempTop = top + this.canvasPan[1] - sTop;
		
		objects[i].left = tempLeft;
		objects[i].top = tempTop;
		
		objects[i].setCoords();
	}
	
	this.canvasPan[0] = sLeft;
	this.canvasPan[1] = sTop;
			
	this.fcanvas.renderAll();*/
}

EeSchema.prototype.recalcScroll = function() {
	var dwidth = this.fcanvas.getWidth()/this.sheetWidth;
	var dheight = this.fcanvas.getHeight()/this.sheetHeight;
}
	
EeSchema.prototype.resetView = function() {
	var objects = this.fcanvas.getObjects();
    for (var i in objects) {
        var scaleX = objects[i].scaleX;
        var scaleY = objects[i].scaleY;
        var left = objects[i].left;
        var top = objects[i].top;
    
        var tempScaleX = (scaleX - this.canvasPan[0]) * (1 / this.canvasScale);
        var tempScaleY = (scaleY - this.canvasPan[1]) * (1 / this.canvasScale);
        var tempLeft = left * (1 / this.canvasScale);
        var tempTop = top * (1 / this.canvasScale);

        objects[i].scaleX = tempScaleX;
        objects[i].scaleY = tempScaleY;
        objects[i].left = tempLeft;
        objects[i].top = tempTop;

        objects[i].setCoords();
    }
    
	this.panner.scrollLeft(0);
	this.panner.scrollTop(0);
	
    this.fcanvas.renderAll();
    
    this.canvasScale = 1;
}
