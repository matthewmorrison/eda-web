function Component(fabric_canvas) {
	this.group = null;
	this.name = null;
	this.reference = null;
	this.textOffset = null;
	this.drawPinNumber = null;
	this.drawPinName = null;
	this.unitCount = null;
	this.unitsLocked = null;
	this.powerFlag = null;
	this.aliases = [];
	this.fields = {};
	this.elements = [];
	this.fcanvas = fabric_canvas;
}

Component.prototype.parseComponent = function(def) {			
		var line = -1;
		try {
			var lines = def.split('\n');
			var section = '';
			
			for(var l_index = 0; l_index < lines.length; l_index++) {
				var line = lines[l_index];
				if(line[0] != '#') { //Skip comments
					var props = line.match(/(?:[^\s"]+|"[^"]*")+/g);

					if(props[0] == 'ENDDEF')
						return;
					
					if(section == 'draw') {
						if(props[0] == 'ENDDRAW') {
							section = '';
						}
						else {
							this.parseDrawField(props);
						}
					}
					else {
						if(this.name == null) {
							validatePropertyCount(props.length, 10, 10);
							
							if(props[0] == 'DEF') {
								this.parseComponentDefinition(props);
							}
							else 
								throw '"DEF" expected, but found "' + props[0] + '"';
						}
						else if(props[0] == 'ALIAS') {
							this.aliases = props.splice(1, props.length - 1);
						}
						else if(props[0][0] == 'F') {
							this.parseComponentField(props);
						}
						else if(props[0] == 'DRAW') {
							section = 'draw';
						}
					}
				}
			}	
		}
		catch(e) {
			throw '[Component Line ' + line + '] Error parsing component: ' + e;
		}
	}
	
	Component.prototype.parseComponentDefinition = function(props) {
		this.name = props[1];
		this.reference = props[2];
		this.textOffset = props[4];
		this.drawPinNumber = props[5];
		this.drawPinName = props[6];
		this.unitCount = props[7];
		this.unitsLocked = props[8];
		this.powerFlag = props[9];
	}
	
	Component.prototype.parseComponentField = function(props) {
		var field = {
			name: props[1],
			position: { x: props[2], y: props[3] },
			dimension: props[4],
			orientation: props[5],
			visible: props[6],
			hjustify: props[7],
			vjustifyItalicBold: props[8][0]
		};
		
		this.fields[props[0]] = field;
	}
	
	Component.prototype.parseDrawField = function(props) {
		var type = props[0];

		if(type == 'P') { // polygon
			var p = { 
				'type': type,
				'Nb': props[1], 
				'parts': props[2], 
				'convert': props[3],
				'thickness': props[4], 
				'points': [
					[ props[5], props[6] ],
					[ props[7], props[8] ]
				]
			};
			
			for(var i = 9; i < props.length -1; i+=2) {
				p.points.push([ props[i], props[i+1] ]);
			}
			
			this.elements.push(p);
		}
		else if(type == 'S'){ // rectangle (square)
			this.elements.push({
				'type': type, 
				'x0': props[1],
				//'y0': props[2], 
				'x1': props[3], 
				'y1': props[4],
				'unit': props[5], 
				'convert': props[6],
				'thickness': props[7],
				'cc': props[8]
			});
		}
		else if(type == 'C') {
			this.elements.push({
				'type': type, 
				'x0': props[1],
				//'y0': props[2], 
				'radius': props[3], 
				'unit': props[4],
				'convert': props[5], 
				'thickness': props[6],
				'cc': props[7]
			});
		}
		else if(type == 'A') {
			this.elements.push({
				'type': type, 
				'x0': props[1],
				//'y0': props[2], 
				'radius': props[3], 
				'start': props[4],
				'end': props[5], 
				'part': props[6],
				'convert': props[7],
				'thickness': props[8],
				'cc': props[9],
				'pX0': props[10],
				'pY0': props[11],
				'pX1': props[12],
				'pY1': props[13]
			});
		}
		else if(type == 'T') {
			this.elements.push({
				'type': type, 
				'orientation': props[1],
				'x0': props[2], 
				//'y0': props[3], 
				'dimension': props[4],
				'unit': props[5], 
				'convert': props[6],
				'text': props[7]
			});
		}
		else if(type == 'X') {				
			this.elements.push({
				'type': props[0],
				'name': props[1],
				'number': props[2],
				'x0': props[3],
				'y0': props[4],
				'length': props[5],
				'orientation': props[6],
				'snum': props[7],
				'snom': props[8],
				'unit': props[9],
				'convert': props[10],
				'etype': props[11],
				'shape': props[12] //optional
			});
		}
		else {
			throw 'Unexpected draw directive "' + type + '"';
		}
	}
	
	Component.prototype.draw = function() {	
		if(this.group != null) {
			return;
		}
		
		var pinRadius = 16;
		var width = 4;
		
		var center = this.fcanvas.getCenter();
		this.group = new fabric.Group();
		
		for(var i = 0; i < this.elements.length; i++) {
			var el = this.elements[i];
			
			if(el.type == 'P') {
				var path = 'M ' + el.points[0][0] + ' ' + el.points[0][1] + 
					' L ' + el.points[1][0] + ' ' + el.points[1][1] + ' z';
				
				for(var j = 2; j < el.points.length; j++) {
					path += ' L ' + el.points[j][0] + ' ' + el.points[j][1];
				}
				
				var path = new fabric.Path(path);
				path.set({ fill: 'red', stroke: 'black', strokeWidth: 5, originX: center.left, originY: center.top });
				this.group.addWithUpdate(path);
			}
			else if(el.type == 'X') {
				var pin = new fabric.Circle({ 
					radius: pinRadius, 
					fill: 'white', 
					stroke: 'black', 
					strokeWidth: 2, 
					originX: center.left, 
					originY: center.top,
					left: el.x0,
					top: el.y0
				});
				
				var name = new fabric.Text(el.name, {
					originX: center.left,
					originY: center.top,
					left: el.x0,
					top: el.y0
				});
				
				var x0 = parseInt(el.x0);
				var y0 = parseInt(el.y0);
				var x1 = x0;
				var y1 = y0;
				var length = parseInt(el.length);
				var half = width/2;
				
				if(el.orientation == 'D') {
					y0 -= length;
					x0 -= half;
					x1 -= half;
					name.angle -= 90;
					name.top = parseInt(name.getTop()) - (length + name.getWidth()/2 + pinRadius);
				}
				else if(el.orientation == 'R') {
					x1 += length;
					y0 -= half;
					y1 -= half;
					name.left = parseInt(name.getLeft()) + (length + name.getWidth()/2 + pinRadius);
				}
				else if(el.orientation == 'L') {
					x0 -= length;
					y0 -= half;
					y1 -= half;
					name.left = parseInt(name.getLeft()) - (length + name.getWidth()/2 +pinRadius);
				}
				else {
					y1 += length;
					x0 -= half;
					x1 -= half;
					name.angle -= 90;
					name.top = parseInt(name.getTop()) + (length + name.getWidth()/2 + pinRadius);
				}
				
				var line = new fabric.Line([ x0, y0, x1, y1 ], {
					stroke: 'black',
					strokeWidth: width,
					left: x0,
					top: y0
				});				
				
				this.group.addWithUpdate(name);
				this.group.addWithUpdate(line);
				this.group.addWithUpdate(pin);
			}
		}
		
		this.fcanvas.add(this.group);
	}
