var mysql=require('mysql');
var os=require('os');
var async=require('async');
var term=require('terminal-kit').terminal;
var refreshRate=5000;
var drawTO;
var dataGrid;

if (process.argv[2] === undefined) {
	term("^wPlease provide DSN ex: ^Kmysql://user:pass@host/db\n");
	process.exit();
}

function createLabel(inString,width,textColor) { 
	width = width -1;
	var out = "";
	var pad = [0,0];
	if (inString === null) inString="";
	inString = String(inString);
	if (inString.length < width) {
		pad[0] = Math.floor((width - inString.length) / 2);
		pad[1] = width - (inString.length + pad[0]);	
	} else {
		pad[0]=0;
		pad[1]=0;
		inString = inString.substring(0,width-3)+'...';
	}
	if (textColor==null) {
		textColor = "^w";
	}
	out = out + (" ").repeat(pad[0]);
	out = out + textColor + inString;
	out = out + (" ").repeat(pad[1]);	
	return out+"^K|^W";
}

function timeDifference(elapsed) {
	var msPerMinute = 60 * 1000;
	var msPerHour = msPerMinute * 60;
	var msPerDay = msPerHour * 24;
	var msPerMonth = msPerDay * 30;
	var msPerYear = msPerDay * 365;

	if (elapsed < msPerMinute) {
		return Math.round(elapsed/1000) + ' secs';   
	}

	else if (elapsed < msPerHour) {
		return Math.round(elapsed/msPerMinute) + ' mins';   
	}

	else if (elapsed < msPerDay ) {
		return Math.round(elapsed/msPerHour ) + ' hrs';   
	}

	else if (elapsed < msPerMonth) {
		return Math.round(elapsed/msPerDay) + ' days';   
	}

	else if (elapsed < msPerYear) {
		return Math.round(elapsed/msPerMonth) + ' mnths';   
	}

	else {
		return Math.round(elapsed/msPerYear ) + ' yrs';   
	}
}

function gatherProclist(cb) {
	connection.query('SHOW STATUS', function(err, vars) {
		if (err) return cb(err);
		connection.query('SHOW FULL PROCESSLIST', function(err,rows) {
			if (err) {
				cb(err);
			} else {
				cb(null,rows,vars);
			}
		});
	});
}

function updateScreen() {
	var widthMap = {'Id':5,'User':10,'Host':15,'db':15,'Command':10,'State':10,'Time':5,'Info':30};
	gatherProclist(function(err,rows,vars) {
		var specs=[];
		for(i in vars) {
			specs[vars[i]['Variable_name']] = vars[i]['Value'];
		}
		if (err) {
			term("\n\n^RError: ^W"+err+"\n");
			process.exit();
		}
		var header=false;
		term.clear();
		var date = new Date();
		var timeStr = String("0"+date.getHours()).slice(-2)+":"+String("0"+date.getMinutes()).slice(-2)+":"+String("0"+date.getSeconds()).slice(-2);
		var headerStr = [];
		headerStr[0] = os.hostname()+" threads "+specs['Threads_running']+'/'+specs['Threads_connected'];
		headerStr[1] = "up "+timeDifference(specs['Uptime'])+" @ "+timeStr;
		var midSpace = term.width - ( headerStr[0].length + headerStr[1].length );

		term(headerStr[0]+(" ").repeat(midSpace)+headerStr[1]);
		
		for(i in rows) {
			if (! header) {
				for(j in rows[i]) {
					term(createLabel(j,Math.floor((widthMap[j]*term.width) / 100),"^W"));
				}
				header=true;
				term("\n");
			} 
			for(j in rows[i]) {
				var rowColor = "^G";
				if (j == "Time") {
					if (rows[i][j] > 0) rowColor = "^g";
					if (rows[i][j] > 5) rowColor = "^y";
					if (rows[i][j] > 120) rowColor = "^Y";
					if (rows[i][j] > 1800) rowColor = "^O";
					if (rows[i][j] > 3600) rowColor = "^R";
				}
				if (j == "Command") {
					if (rows[i][j] == "Query") rowColor = "^B";
				}
				if (rows[i]["Command"]=="Sleep") rowColor = "^K"; //Sleepers are muted

				term(createLabel(rows[i][j],Math.floor(widthMap[j]*term.width / 100),rowColor));
			}
			term("\n");
		}
	});
}

term.on('resize', updateScreen);
term.on('mouse', function(name,data) {
	console.log(name,data);
});

function command(key) {
	if (key == 'q') {
		term.clear();
		term("\n^WExit.\n");
		process.exit();
	}
	if (key == '+') {
		clearInterval(drawTO);
		refreshRate = refreshRate - 1000;
		if (refreshRate < 1000) refreshRate = 1000;
		drawTO = setInterval(updateScreen,refreshRate);
	}
	if (key == '-') {
		clearTimeout(drawTO);
		refreshRate = refreshRate + 1000;
		if (refreshRate > 10000) refreshRate = 1000;
		drawTO = setInterval(updateScreen,refreshRate);
	}
}



var connection = mysql.createConnection(process.argv[2]);
connection.connect(function(err) {
	if (err) {
		term("^r"+err+"\n");
		process.exit();
	}
	term.grabInput();
	term.on('key',function(name,matches,data) {
		command(name);
	});
	drawTO = setInterval(updateScreen,refreshRate);
});
