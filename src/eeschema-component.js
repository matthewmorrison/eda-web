function ComponentDefinition(fabric_canvas) {
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
	this.widthFactor = 4;
	this.defaultThickness = 1;
}

ComponentDefinition.prototype.parse = function(def) {			
	var line = -1;
	try {
		var lines = def;
		
		if(!(def instanceof Array)) {
			lines = def.split('\n');
		}
		
		var section = '';
		
		for(var l_index = 0; l_index < lines.length; l_index++) {
			var line = lines[l_index];

			if(line[0] != '#') { //Skip comments
				var props = line.match(/(?:[^\s"]+|"[^"]*")+/g);

				if(props[0] == 'ENDDEF')
					return l_index;
				
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

ComponentDefinition.prototype.parseComponentDefinition = function(props) {
	this.name = props[1];
	this.reference = props[2];
	this.textOffset = props[4];
	this.drawPinNumber = props[5];
	this.drawPinName = props[6];
	this.unitCount = props[7];
	this.unitsLocked = props[8];
	this.powerFlag = props[9];
}

ComponentDefinition.prototype.parseComponentField = function(props) {
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

ComponentDefinition.prototype.parseDrawField = function(props) {
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
			'x0': parseInt(props[1]),
			'y0': parseInt(props[2]), 
			'x1': parseInt(props[3]), 
			'y1': parseInt(props[4]),
			'unit': props[5], 
			'convert': props[6],
			'thickness': parseInt(props[7]),
			'cc': props[8]
		});
	}
	else if(type == 'C') {
		this.elements.push({
			'type': type, 
			'x0': props[1],
			'y0': props[2], 
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
			'y0': props[2], 
			'radius': props[3], 
			'start': props[4],
			'end': props[5], 
			'part': props[6],
			'convert': props[7],
			'thickness': props[8],
			'cc': props[9].trim(),
			'sX': props[10],
			'sY': props[11],
			'eX': props[12],
			'eY': props[13]
		});
	}
	else if(type == 'T') {
		this.elements.push({
			'type': type, 
			'orientation': props[1],
			'x0': props[2], 
			'y0': props[3], 
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

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  var angleInRadians = (angleInDegrees-90) * Math.PI / 180.0;

  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

function describeArc(x, y, radius, startAngle, endAngle){
    var start = polarToCartesian(x, y, radius, endAngle);
    var end = polarToCartesian(x, y, radius, startAngle);

    var arcSweep = endAngle - startAngle <= 180 ? "0" : "1";

    var d = [
        "M", start.x, start.y, 
        "A", radius, radius, 0, arcSweep, 0, end.x, end.y
    ].join(" ");

    return d;       
}

ComponentDefinition.prototype.Create = function(x, y) {	
	var pinRadius = 16;
	var width = 4;
	var center = { left: 0, top: 0 };
	
	var group = new fabric.Group();
	group.set({ originX: 0, originY: 0, left: x, top: y });
	
	for(var i = 0; i < this.elements.length; i++) {
		var el = this.elements[i];
		
		if(el.type == 'P') {
			var path = 'M ' + el.points[0][0] + ' ' + el.points[0][1] + 
				' L ' + el.points[1][0] + ' ' + el.points[1][1];
			
			for(var j = 2; j < el.points.length; j++) {
				path += ' L ' + el.points[j][0] + ' ' + el.points[j][1];
			}
			
			path += ' Z';
			
			var path = new fabric.Path(path);
			path.set({ fill: 'transparent', stroke: 'black', strokeWidth: this.widthFactor, originX: 0, originY: 0 });
			path.hasBorders = path.hasControls = false;
			
			var poly = new fabric.Group([path], {
				originX: 0,
				originY: 0
			});
			
			group.add(poly);
		}
		else if(el.type == 'X') {
			var visible = true;
			
			if(typeof el.shape != 'undefined' && el.shape.length > 0)
				visible = el.shape[0] != 'N';
		
			var circle = new fabric.Circle({ 
				radius: pinRadius, 
				fill: 'white', 
				stroke: 'black', 
				strokeWidth: 2, 
				originX: center.left, 
				originY: center.top,
				left: el.x0,
				top: el.y0,
				visible: visible
			});
			
			var name = new fabric.Text(el.name, {
				originX: center.left,
				originY: center.top,
				left: el.x0,
				top: el.y0,
				visible: visible
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
				top: y0,
				visible: visible
			});				
			
			name.hasBorders = name.hasControls = false;
			line.hasBorders = line.hasControls = false;
			circle.hasBorders = circle.hasControls = false;
			
			var pin = new fabric.Group([name, line, circle], {
				originX: 0,
				originY: 0
			});
			
			group.add(pin);
		}
		else if(el.type == 'C') {
			var circle = new fabric.Circle({ 
				radius: el.radius, 
				fill: (el.cc == 'N' ? 'transparent' : 'white'), 
				stroke: 'black',
				strokeWidth: el.thickness * this.widthFactor, 
				originX: 0, 
				originY: 0,
				left: el.x0,
				top: el.y0 });
			
			circle.hasBorders = circle.hasControls = false;
			group.add(circle);
		}
		else if(el.type == 'S') {
		    var x0, x1, y0, y1;
			var thickness = el.thickness ? el.thickness : this.defaultThickness;
		    
		    if(el.x0 > el.x1) {
		        x0 = el.x1;
		        x1 = el.x0;
            }
            else {
                x0 = el.x0;
                x1 = el.x1;
            }
            
            if(el.y0 > el.y1) {
                y0 = el.y1;
                y1 = el.y0;
            }
            else {
                y0 = el.y0;
                y1 = el.y1;
            }
		    
            var line1 = new fabric.Line([ x0, y0, x1, y0 ], {
				stroke: 'black',
				strokeWidth: thickness * this.widthFactor
			});
			
			var line2 = new fabric.Line([ x1, y0, x1, y1 ], {
				stroke: 'black',
				strokeWidth: thickness * this.widthFactor
			});
			
            var line3 = new fabric.Line([ x0, y1, x1, y1 ], {
				stroke: 'black',
				strokeWidth: thickness * this.widthFactor
			});
			
            var line4 = new fabric.Line([ x0, y0, x0, y1 ], {
				stroke: 'black',
				strokeWidth: thickness * this.widthFactor
			});
			
			group.add(line1);
			group.add(line2);
			group.add(line3);
			group.add(line4);
		}
		else if(el.type == 'A') {			
			var def = 'M' + el.sX + ' ' + el.sY + ' A' + el.radius + ' ' + el.radius + ' 0 0 1 ' + el.eX + ' ' + el.eY;
			
			var path = new fabric.Path(def);
			path.hasBorders = path.hasControls = false;
			path.set({ 
			    stroke: 'black',
			    strokeWidth: this.widthFactor,
				left: el.x0,
				top: el.y0,
			    originX: center.left, 
			    originY: center.top,
                fill: el.cc == 'N' ? 'transparent' : 'black'
			});
			
			var arc = new fabric.Group([path], {
				originX: 0,
				originY: 0
			});
			
			group.add(arc);
		}
	}
	
	return group;
}
