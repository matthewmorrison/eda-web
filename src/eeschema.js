function EeSchema(container) {
    this.container = $(container);
    this.canvas = $('<canvas />');	
	this.canvasScale = 1;
	this.SCALE_FACTOR = 1.2;
	this.PAN_STEP = 1.1;
	this.canvasPan = [0, 0];
	this.hScroller = $('<div class="eeschema-canvas-scroller" />');
	this.zoomer = $('<div class="eeschema-canvas-zoomer"><canvas /></div>');
	this.coords = $('<div class="eeschema-coords" >Coords</div>');
	this.hScroller.append(this.coords);
	this.localMode = false;
	this.libraries = {};
	this.components = [];
	this.wires = []; // and busses
	this.junctions = [];
	this.rightPanel = $('<div class="eeschema-right-panel" />');
	
	var ees = this;
	container = this.container;
	
	this.container.append(this.zoomer);
    this.zoomer.append(this.canvas);
	
	this.fcanvas = new fabric.Canvas(this.canvas.get(0));

	$(document.body).append(this.hScroller);
	this.hScroller.css({ left: this.canvas.css('left'), 'top': this.zoomer.position().top + this.zoomer.height(), 'width': this.zoomer.width() });

	this.fcanvas.setWidth(this.zoomer.width() - 100);
	this.fcanvas.setHeight(this.zoomer.height());
	
	this.zoomer.on('scroll', function(e) {
		e.preventDefault();
	    zoomer = $(this);
		var scroll = zoomer.scrollTop();
		
		if(e.ctrlKey) {
			ees.panHorizontal(1 - scroll);
		}
		else if(e.altKey) {
			ees.panVertical(1 - scroll);
		}
		else if(scroll < 1) {	
			ees.zoomIn();
		}
		else if(scroll > 1) {
			ees.zoomOut();
		}
		
		zoomer.scrollTop(1);
	});

	this.zoomer.scrollTop(1);

			//resetView();
	this.fcanvas.on('mouse:move', function(obj) {
		var e = obj.e;	
		ees.canvas.data('mouseX', e.clientX);
		ees.canvas.data('mouseY', e.clientY);
	});
	
	this.container.append(this.rightPanel);
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
	$.ajax(location)
	.done(function(response) {
		console.log(response);
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
				console.log('Load-', props[0].substring(5));
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

				var l = new fabric.Line([ wire.x0, wire.y0, wire.x1, wire.y1 ], {
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
				comp.x = props[1];
				comp.y = props[2];
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
		//canvas.setZoom(canvas.getZoom()+SCALE_FACTOR);

		var objects = this.fcanvas.getObjects();		
        this.canvasScale = this.canvasScale * this.SCALE_FACTOR;
		var center = this.fcanvas.getCenter();
		var x = this.canvas.data('mouseX');
		var y = this.canvas.data('mouseY');console.log(x, ', ', y);
		//this.resetView();

		for (var i in objects) {
			var scaleX = objects[i].scaleX;
			var scaleY = objects[i].scaleY;
			var left = objects[i].left;
			var top = objects[i].top;

			var tempScaleX = scaleX * this.SCALE_FACTOR;
			var tempScaleY = scaleY * this.SCALE_FACTOR;
			var tempLeft = left * this.SCALE_FACTOR - x * .2;
			var tempTop = top * this.SCALE_FACTOR - y * .2;
			
			objects[i].scaleX = tempScaleX;
			objects[i].scaleY = tempScaleY;
			objects[i].left = tempLeft;
			objects[i].top = tempTop;
			
			objects[i].setCoords();
		}
			
		this.fcanvas.renderAll();
	}

	// Zoom Out
EeSchema.prototype.zoomOut = function() {
		// TODO limit max cavas zoom out
		
		/*console.log(this.fcanvas.getZoom());
		this.fcanvas.setZoom(this.fcanvas.getZoom() - .01);
		this.resetView();
		this.fcanvas.renderAll();
		return*/
		
		var objects = this.fcanvas.getObjects();		
		this.canvasScale = this.canvasScale / this.SCALE_FACTOR;
		var center = this.fcanvas.getCenter();

		for (var i in objects) {
			var scaleX = objects[i].scaleX;
			var scaleY = objects[i].scaleY;
			var left = objects[i].left;
			var top = objects[i].top;
		
			var tempScaleX = scaleX * (1 / this.SCALE_FACTOR);
			var tempScaleY = scaleY * (1 / this.SCALE_FACTOR);
			var tempLeft = left * (1 / this.SCALE_FACTOR) + center.left * (.2 / this.SCALE_FACTOR);
			var tempTop = top * (1 / this.SCALE_FACTOR) + center.top * (.2 / this.SCALE_FACTOR);
			
			objects[i].scaleX = tempScaleX;
			objects[i].scaleY = tempScaleY;
			objects[i].left = tempLeft;
			objects[i].top = tempTop;

			objects[i].setCoords();
		}
		
		this.fcanvas.renderAll();
	}
	
EeSchema.prototype.panHorizontal = function(steps) {
		/*var objects = this.fcanvas.getObjects();
		var step = this.PAN_STEP * steps;
	
		for (var i in objects) {
			objects[i].left += step;
			objects[i].setCoords();
		}
		
		this.fcanvas.renderAll();*/
		
	this.fcanvas.relativePan(new fabric.Point(steps, 0));
}
	
EeSchema.prototype.panVertical = function(steps) {
		var objects = this.fcanvas.getObjects();
		var step = this.PAN_STEP * steps;
	
		for (var i in objects) {
			objects[i].top += step;
			objects[i].setCoords();
		}
		
        this.fcanvas.renderAll();
	}
	
EeSchema.prototype.resetView = function() {
	var objects = this.fcanvas.getObjects();
		
	var left = 100000;
	var top = 100000;
	var right = -100000;
	var bottom = -100000;

	for(var i in objects) {
		if(typeof objects[i].lineType != 'undefined')
			continue;

		var rect = objects[i].getBoundingRect();
		
		var oleft = parseInt(objects[i].left);
		var otop = parseInt(objects[i].top);
		var owidth = parseInt(rect.width);
		var oheight = parseInt(rect.height);
	
		if(oleft < left)
			left = oleft;
		
		if(owidth + oleft > right)
			right = owidth + oleft;
		
		if(otop < top)
			top = otop;
		
		if(otop + oheight > bottom)
			bottom = otop + oheight;
	}
	
	var cwidth = this.canvas.width();
	var cheight = this.canvas.height();
	
	var x = left + (right - left)/2;
	var y = top + (bottom - top)/2;
	console.log(x, ', ', y);
	this.fcanvas.absolutePan(new fabric.Point(x - cwidth/2, y - cheight/2));
	//this.fcanvas.zoomToPoint(.8, new fabric.Point(x, y));
	
	this.fcanvas.renderAll();
	
	return;
}
