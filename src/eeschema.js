function EeSchema(container) {
    this.container = $(container);
    this.canvas = this.container.find('canvas');
	this.fcanvas = new fabric.Canvas(this.canvas.get(0));
	this.canvasScale = 1;
	this.SCALE_FACTOR = 1.2;
	this.PAN_STEP = 1.1;
	this.hScroller = $('<div style="overflow-x: scroll; position: absolute" />');
			
	container.css({ 'height': cvs.css('height') - 2, 'overflow-y': 'scroll' });
	container.on('scroll', function(e) {
		e.preventDefault();
		
		var scroll = container.scrollTop();
		
		if(e.ctrlKey) {
			this.panHorizontal(1 - scroll);
		}
		else if(e.altKey) {
			this.panVertical(1 - scroll);
		}
		else if(scroll < 1) {	
			this.zoomIn();
		}
		else if(scroll > 1) {
			this.zoomOut();
		}
		
		container.scrollTop(1);
	});

	container.scrollTop(1);
	
	
	$(document.body).append(this.hScroller);
	this.hScroller.css({ left: container.css('left'), 'height': '20px', 'top': container.position().top + container.height(), 'width': this.canvas.width() });
			
			//resetView();
			
	this.canvas.on('mousemove', function(e) {
		this.canvas.data('mouseX', e.clientX);
		this.canvas.data('mouseY', e.clientY);
	});
}

/*$(function() {
    $('.eeschema').each(function(index, item) {
        var ees = new EeSchema(item);
        
        $(item).data('eeschema', ees);
    });
});*/

EeSchema.prototype.loadSchematic = function(file) {
	
}

EeSchema.prototype.zoomIn = function() {
		// TODO limit the max canvas zoom in
		//console.log(canvas.getZoom());
		//canvas.setZoom(canvas.getZoom()+SCALE_FACTOR);

		var objects = canvas.getObjects();		
		canvasScale = canvasScale * SCALE_FACTOR;
		var center = canvas.getCenter();
		var x = $('#canvas').data('mouseX');
		var y = $('#canvas').data('mouseY');

		for (var i in objects) {
			var scaleX = objects[i].scaleX;
			var scaleY = objects[i].scaleY;
			var left = objects[i].left;
			var top = objects[i].top;

			var tempScaleX = scaleX * SCALE_FACTOR;
			var tempScaleY = scaleY * SCALE_FACTOR;
			var tempLeft = left * SCALE_FACTOR - x * .2;
			var tempTop = top * SCALE_FACTOR - y * .2;
			
			objects[i].scaleX = tempScaleX;
			objects[i].scaleY = tempScaleY;
			objects[i].left = tempLeft;
			objects[i].top = tempTop;
			
			objects[i].setCoords();
		}
			
		canvas.renderAll();
	}

	// Zoom Out
EeSchema.prototype.zoomOut = function() {
		// TODO limit max cavas zoom out
		
		//console.log(canvas.getZoom());
		//canvas.setZoom(canvas.getZoom() - SCALE_FACTOR);

		var objects = canvas.getObjects();		
		canvasScale = canvasScale / SCALE_FACTOR;
		var center = canvas.getCenter();

		for (var i in objects) {
			var scaleX = objects[i].scaleX;
			var scaleY = objects[i].scaleY;
			var left = objects[i].left;
			var top = objects[i].top;
		
			var tempScaleX = scaleX * (1 / SCALE_FACTOR);
			var tempScaleY = scaleY * (1 / SCALE_FACTOR);
			var tempLeft = left * (1 / SCALE_FACTOR) + center.left * (.2 / SCALE_FACTOR);
			var tempTop = top * (1 / SCALE_FACTOR) + center.top * (.2 / SCALE_FACTOR);
			
			objects[i].scaleX = tempScaleX;
			objects[i].scaleY = tempScaleY;
			objects[i].left = tempLeft;
			objects[i].top = tempTop;

			objects[i].setCoords();
		}
		
		canvas.renderAll();
	}
	
EeSchema.prototype.panHorizontal = function(steps) {
		var objects = canvas.getObjects();
		var step = PAN_STEP * steps;
	
		for (var i in objects) {
			objects[i].left += step;
			objects[i].setCoords();
		}
		
		canvas.renderAll();
	}
	
EeSchema.prototype.panVertical = function(steps) {
		var objects = canvas.getObjects();
		var step = PAN_STEP * steps;
	
		for (var i in objects) {
			objects[i].top += step;
			objects[i].setCoords();
		}
		
		canvas.renderAll();
	}
	
EeSchema.prototype.resetView = function() {
	var objects = canvas.getObjects();
		
	/*var left = 10000;
	var top = 10000;
	var right = -10000;
	var bottom = -10000;
	var objects = canvas.getObjects();
	
	for(var i in objects) {
		var oleft = objects[i].left;
		var otop = objects[i].top;
		var owidth = objects[i].width;
		var oheight = objects[i].height;
	
		if(oleft < left)
			left = oleft;
		
		if(owidth + oleft > right)
			right = owidth + oleft;
		
		if(otop < top)
			top = otop;
		
		if(otop + oheight > bottom)
			bottom = otop + oheight;
			
		objects[i].center();
	}
	
	var cwidth = $('#canvas').width();
	var cheight = $('#canvas').height();
	
	console.log(left, ', ', top, ', ', right, ', ', ', ', bottom);
	
	canvas.renderAll();
	return;
	//var height = (bottom - top)/2;
	
	console.log(shiftx);
	
	for (var i in objects) {
		objects[i].left += shiftx;
		objects[i].setCoords();
	}
	
	canvas.renderAll();*/
}
