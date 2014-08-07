if(typeof EeSchema === 'undefined') {
	self.isWorker = true;
	self.EeSchema = function() {}
}

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

self.addEventListener('message', function(e) {
	if(e.data.action == 'parse-schematic') {
		var ees = new EeSchema();
		ees.parseSchematic(e.data.text);
	}
	else if(e.data.aciton == 'parse-library') {
		parseLibrary(e);
	}
}, false);
