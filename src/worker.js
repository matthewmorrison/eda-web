if(typeof EeSchema === 'undefined') {
	self.isWorker = true;
	self.EeSchema = function() {}
}

importScripts('../libs/point.class.js');

EeSchema.prototype.parseSchematic = function(txt) {
	var lines = txt.split('\n');
	var section = '';
	var schematic = {
		components: [],
		wires: [],
		junctions: []
	};
	
	var wires = [];
	
	var obj = {};

	for(var l_index = 0; l_index < lines.length; l_index++) {
		var line = lines[l_index];
		
		if(line[0] != '#') { //Skip comments
			var props = line.match(/(?:[^\s"]+|"[^"]*")+/g);
			
			if(false && props[0].indexOf('LIBS:') == 0 && !this.localMode) { // disabled for now
			    var file = props[0].substring(5);
				
				var path = this.location.substring(0, this.location.lastIndexOf('/')) + '/' + file;
				
				console.log('fetch: ' + path);
				
				$.ajax(path)
				.done(function(response) {
				    this.parseLibrary(response);
				});
			}
			else if(props[0] == '$Descr') {
				var r = this.parseSchematicDescription(lines, l_index);
				var desc = r[1];
				
				l_index += r[0];
				
				this.handleMessage({ action: 'schematic-description', description: desc });
			}
			else if(props[0] == '$Comp') {
				var r = this.parseComponent(lines.slice(l_index));
				var comp = r[1];
				
				l_index += r[0];
				
				this.handleMessage({ action: 'schematic-component', component: comp });
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

				this.handleMessage({ action: 'schematic-wire', wire: wire });
			}
		}
	}
	
	console.log('Done parsing schematic: ', new Date());

	this.handleMessage({ action: 'schematic-complete' });
}

if(typeof EeSchema.prototype.handleMessage == 'undefined') {
	EeSchema.prototype.handleMessage = function(data) {
		self.postMessage(data);
	}
}

EeSchema.prototype.parseSchematicDescription = function(lines, i) {
	var desc = { // TODO: set defaults
		sheetSize: '',
		sheetWidth: 0,
		sheetHeight: 0
	}
	
	for(; i < lines.length; i++) {
		var line = lines[i];
		var props = line.match(/(?:[^\s"]+|"[^"]*")+/g);
		
		if(props[0] == '$Descr') {
			desc.sheetSize = props[1];
			desc.sheetWidth = props[2];
			desc.sheetHeight = props[3];
		}
		else if(props[0] == '$EndDescr') {
			break;
		}
	}
	
	return [i, desc];
}

EeSchema.prototype.parseComponent = function(lines) {
	var l_index = 0;
	//var center = this.fcanvas.getCenter();
	var comp = {
		library: null,
		fabric: null,
		definition: null,
		x: 0,
		y: 0
	};
	
	for(; l_index < lines.length; l_index++) {
		var line = lines[l_index];
		
		if(line[0] != '#') { //Skip comments
			var props = line.match(/(?:[^\s"]+|"[^"]*")+/g);
			
			if(props[0] == '$Comp') {
				
			}
			else if(props[0] == 'L') {
				comp.library = props[1];
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
	
	return [l_index, comp];
}

function parseLibrary(e) {

}

function setCoords(viewportTransform) {
  var strokeWidth = this.strokeWidth > 1 ? this.strokeWidth : 0,
	  theta = degreesToRadians(this.angle),
	  vpt = viewportTransform,
	  f = function (p) {
		return transformPoint(p, vpt);
	  },
	  w = this.width,
	  h = this.height,
	  capped = this.strokeLineCap === 'round' || this.strokeLineCap === 'square',
	  vLine = this.type === 'line' && this.width === 1,
	  hLine = this.type === 'line' && this.height === 1,
	  strokeW = (capped && hLine) || this.type !== 'line',
	  strokeH = (capped && vLine) || this.type !== 'line';

  if (vLine) {
	w = strokeWidth;
  }
  else if (hLine) {
	h = strokeWidth;
  }
  if (strokeW) {
	w += strokeWidth;
  }
  if (strokeH) {
	h += strokeWidth;
  }
  this.currentWidth = w * this.scaleX;
  this.currentHeight = h * this.scaleY;

  // If width is negative, make postive. Fixes path selection issue
  if (this.currentWidth < 0) {
	this.currentWidth = Math.abs(this.currentWidth);
  }

  var _hypotenuse = Math.sqrt(
		Math.pow(this.currentWidth / 2, 2) +
		Math.pow(this.currentHeight / 2, 2)),

	  _angle = Math.atan(isFinite(this.currentHeight / this.currentWidth) ? this.currentHeight / this.currentWidth : 0),

	  // offset added for rotate and scale actions
	  offsetX = Math.cos(_angle + theta) * _hypotenuse,
	  offsetY = Math.sin(_angle + theta) * _hypotenuse,
	  sinTh = Math.sin(theta),
	  cosTh = Math.cos(theta),
	  coords = getCenterPoint(),
	  wh = new fabric.Point(this.currentWidth, this.currentHeight),
	  _tl =   new fabric.Point(coords.x - offsetX, coords.y - offsetY),
	  _tr =   new fabric.Point(_tl.x + (wh.x * cosTh),   _tl.y + (wh.x * sinTh)),
	  _bl =   new fabric.Point(_tl.x - (wh.y * sinTh),   _tl.y + (wh.y * cosTh)),
	  _mt =   new fabric.Point(_tl.x + (wh.x/2 * cosTh), _tl.y + (wh.x/2 * sinTh)),
	  tl  = f(_tl),
	  tr  = f(_tr),
	  br  = f(new fabric.Point(_tr.x - (wh.y * sinTh),   _tr.y + (wh.y * cosTh))),
	  bl  = f(_bl),
	  ml  = f(new fabric.Point(_tl.x - (wh.y/2 * sinTh), _tl.y + (wh.y/2 * cosTh))),
	  mt  = f(_mt),
	  mr  = f(new fabric.Point(_tr.x - (wh.y/2 * sinTh), _tr.y + (wh.y/2 * cosTh))),
	  mb  = f(new fabric.Point(_bl.x + (wh.x/2 * cosTh), _bl.y + (wh.x/2 * sinTh))),
	  mtr = f(new fabric.Point(_mt.x, _mt.y)),

	  // padding
	  padX = Math.cos(_angle + theta) * this.padding * Math.sqrt(2),
	  padY = Math.sin(_angle + theta) * this.padding * Math.sqrt(2);

  tl = tl.add(new fabric.Point(-padX, -padY));
  tr = tr.add(new fabric.Point(padY, -padX));
  br = br.add(new fabric.Point(padX, padY));
  bl = bl.add(new fabric.Point(-padY, padX));
  ml = ml.add(new fabric.Point((-padX - padY) / 2, (-padY + padX) / 2));
  mt = mt.add(new fabric.Point((padY - padX) / 2, -(padY + padX) / 2));
  mr = mr.add(new fabric.Point((padY + padX) / 2, (padY - padX) / 2));
  mb = mb.add(new fabric.Point((padX - padY) / 2, (padX + padY) / 2));
  mtr = mtr.add(new fabric.Point((padY - padX) / 2, -(padY + padX) / 2));

  // debugging

  // setTimeout(function() {
  //   canvas.contextTop.fillStyle = 'green';
  //   canvas.contextTop.fillRect(mb.x, mb.y, 3, 3);
  //   canvas.contextTop.fillRect(bl.x, bl.y, 3, 3);
  //   canvas.contextTop.fillRect(br.x, br.y, 3, 3);
  //   canvas.contextTop.fillRect(tl.x, tl.y, 3, 3);
  //   canvas.contextTop.fillRect(tr.x, tr.y, 3, 3);
  //   canvas.contextTop.fillRect(ml.x, ml.y, 3, 3);
  //   canvas.contextTop.fillRect(mr.x, mr.y, 3, 3);
  //   canvas.contextTop.fillRect(mt.x, mt.y, 3, 3);
  // }, 50);

  this.oCoords = {
	// corners
	tl: tl, tr: tr, br: br, bl: bl,
	// middle
	ml: ml, mt: mt, mr: mr, mb: mb,
	// rotating point
	mtr: mtr
  };

  // set coordinates of the draggable boxes in the corners used to scale/rotate the image
  this._setCornerCoords && this._setCornerCoords();

  return this;
}

function degreesToRadians(degrees) {
  return degrees * PiBy180;
}

function transformPoint(p, t, ignoreOffset) {
  if (ignoreOffset) {
	return new fabric.Point(
	  t[0] * p.x + t[1] * p.y,
	  t[2] * p.x + t[3] * p.y
	);
  }
  return new fabric.Point(
	t[0] * p.x + t[1] * p.y + t[4],
	t[2] * p.x + t[3] * p.y + t[5]
  );
}

function _setCornerCoords(object) {
  var coords = this.oCoords,
	  theta = degreesToRadians(this.angle),
	  newTheta = degreesToRadians(45 - this.angle),
	  cornerHypotenuse = Math.sqrt(2 * Math.pow(this.cornerSize, 2)) / 2,
	  cosHalfOffset = cornerHypotenuse * Math.cos(newTheta),
	  sinHalfOffset = cornerHypotenuse * Math.sin(newTheta),
	  sinTh = Math.sin(theta),
	  cosTh = Math.cos(theta);

  coords.tl.corner = {
	tl: {
	  x: coords.tl.x - sinHalfOffset,
	  y: coords.tl.y - cosHalfOffset
	},
	tr: {
	  x: coords.tl.x + cosHalfOffset,
	  y: coords.tl.y - sinHalfOffset
	},
	bl: {
	  x: coords.tl.x - cosHalfOffset,
	  y: coords.tl.y + sinHalfOffset
	},
	br: {
	  x: coords.tl.x + sinHalfOffset,
	  y: coords.tl.y + cosHalfOffset
	}
  };

  coords.tr.corner = {
	tl: {
	  x: coords.tr.x - sinHalfOffset,
	  y: coords.tr.y - cosHalfOffset
	},
	tr: {
	  x: coords.tr.x + cosHalfOffset,
	  y: coords.tr.y - sinHalfOffset
	},
	br: {
	  x: coords.tr.x + sinHalfOffset,
	  y: coords.tr.y + cosHalfOffset
	},
	bl: {
	  x: coords.tr.x - cosHalfOffset,
	  y: coords.tr.y + sinHalfOffset
	}
  };

  coords.bl.corner = {
	tl: {
	  x: coords.bl.x - sinHalfOffset,
	  y: coords.bl.y - cosHalfOffset
	},
	bl: {
	  x: coords.bl.x - cosHalfOffset,
	  y: coords.bl.y + sinHalfOffset
	},
	br: {
	  x: coords.bl.x + sinHalfOffset,
	  y: coords.bl.y + cosHalfOffset
	},
	tr: {
	  x: coords.bl.x + cosHalfOffset,
	  y: coords.bl.y - sinHalfOffset
	}
  };

  coords.br.corner = {
	tr: {
	  x: coords.br.x + cosHalfOffset,
	  y: coords.br.y - sinHalfOffset
	},
	bl: {
	  x: coords.br.x - cosHalfOffset,
	  y: coords.br.y + sinHalfOffset
	},
	br: {
	  x: coords.br.x + sinHalfOffset,
	  y: coords.br.y + cosHalfOffset
	},
	tl: {
	  x: coords.br.x - sinHalfOffset,
	  y: coords.br.y - cosHalfOffset
	}
  };

  coords.ml.corner = {
	tl: {
	  x: coords.ml.x - sinHalfOffset,
	  y: coords.ml.y - cosHalfOffset
	},
	tr: {
	  x: coords.ml.x + cosHalfOffset,
	  y: coords.ml.y - sinHalfOffset
	},
	bl: {
	  x: coords.ml.x - cosHalfOffset,
	  y: coords.ml.y + sinHalfOffset
	},
	br: {
	  x: coords.ml.x + sinHalfOffset,
	  y: coords.ml.y + cosHalfOffset
	}
  };

  coords.mt.corner = {
	tl: {
	  x: coords.mt.x - sinHalfOffset,
	  y: coords.mt.y - cosHalfOffset
	},
	tr: {
	  x: coords.mt.x + cosHalfOffset,
	  y: coords.mt.y - sinHalfOffset
	},
	bl: {
	  x: coords.mt.x - cosHalfOffset,
	  y: coords.mt.y + sinHalfOffset
	},
	br: {
	  x: coords.mt.x + sinHalfOffset,
	  y: coords.mt.y + cosHalfOffset
	}
  };

  coords.mr.corner = {
	tl: {
	  x: coords.mr.x - sinHalfOffset,
	  y: coords.mr.y - cosHalfOffset
	},
	tr: {
	  x: coords.mr.x + cosHalfOffset,
	  y: coords.mr.y - sinHalfOffset
	},
	bl: {
	  x: coords.mr.x - cosHalfOffset,
	  y: coords.mr.y + sinHalfOffset
	},
	br: {
	  x: coords.mr.x + sinHalfOffset,
	  y: coords.mr.y + cosHalfOffset
	}
  };

  coords.mb.corner = {
	tl: {
	  x: coords.mb.x - sinHalfOffset,
	  y: coords.mb.y - cosHalfOffset
	},
	tr: {
	  x: coords.mb.x + cosHalfOffset,
	  y: coords.mb.y - sinHalfOffset
	},
	bl: {
	  x: coords.mb.x - cosHalfOffset,
	  y: coords.mb.y + sinHalfOffset
	},
	br: {
	  x: coords.mb.x + sinHalfOffset,
	  y: coords.mb.y + cosHalfOffset
	}
  };

  coords.mtr.corner = {
	tl: {
	  x: coords.mtr.x - sinHalfOffset + (sinTh * this.rotatingPointOffset),
	  y: coords.mtr.y - cosHalfOffset - (cosTh * this.rotatingPointOffset)
	},
	tr: {
	  x: coords.mtr.x + cosHalfOffset + (sinTh * this.rotatingPointOffset),
	  y: coords.mtr.y - sinHalfOffset - (cosTh * this.rotatingPointOffset)
	},
	bl: {
	  x: coords.mtr.x - cosHalfOffset + (sinTh * this.rotatingPointOffset),
	  y: coords.mtr.y + sinHalfOffset - (cosTh * this.rotatingPointOffset)
	},
	br: {
	  x: coords.mtr.x + sinHalfOffset + (sinTh * this.rotatingPointOffset),
	  y: coords.mtr.y + cosHalfOffset - (cosTh * this.rotatingPointOffset)
	}
  };
}

var sqrt = Math.sqrt,
      atan2 = Math.atan2,
      PiBy180 = Math.PI / 180;

fabric.Object = function() {

}
	  
function getCenterPoint(object) {
  var leftTop = new fabric.Point(this.left, this.top);
  return translateToCenterPoint(leftTop, this.originX, this.originY);
}

function rotatePoint(point, origin, radians) {
  var sin = Math.sin(radians),
	  cos = Math.cos(radians);

  point.subtractEquals(origin);

  var rx = point.x * cos - point.y * sin,
	  ry = point.x * sin + point.y * cos;

  return new fabric.Point(rx, ry).addEquals(origin);
}

function translateToCenterPoint(point, originX, originY) {
  var cx = point.x,
	  cy = point.y,
	  strokeWidth = this.stroke ? this.strokeWidth : 0;

  if (originX === 'left') {
	cx = point.x + (this.getWidth() + strokeWidth * this.scaleX) / 2;
  }
  else if (originX === 'right') {
	cx = point.x - (this.getWidth() + strokeWidth * this.scaleX) / 2;
  }

  if (originY === 'top') {
	cy = point.y + (this.getHeight() + strokeWidth * this.scaleY) / 2;
  }
  else if (originY === 'bottom') {
	cy = point.y - (this.getHeight() + strokeWidth * this.scaleY) / 2;
  }

  // Apply the reverse rotation to the point (it's already scaled properly)
  return rotatePoint(new fabric.Point(cx, cy), point, degreesToRadians(this.angle));
}



self.addEventListener('message', function(e) {
	if(e.data.action == 'parse-schematic') {
		var ees = new EeSchema();
		ees.parseSchematic(e.data.text);
	}
	else if(e.data.aciton == 'parse-library') {
		parseLibrary(e);
	}
	else if(e.data.action == 'set-coords') {
		setCoords.apply(e.data.fabric, [e.data.viewportTransform]);
		//e.data.fabric.setCoords = setCoords(e.data.viewportTransform)();
		self.postMessage({ action: 'coords-set', fabric: e.data.fabric });
		self.close();
	}
}, false);
