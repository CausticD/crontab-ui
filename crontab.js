/*jshint esversion: 6*/
//load database
var Datastore = require('nedb');
var path = require("path");

var base_path = __dirname + '/crontabs/';
var db_file = base_path + 'crontab.db';
var env_file = base_path + 'env.db';

var db = new Datastore({ filename: db_file });
var cronPath = "/tmp";

if(process.env.CRON_PATH !== undefined) {
	console.log(`Path to crond files set using env variables ${process.env.CRON_PATH}`);
	cronPath = process.env.CRON_PATH;
}

db.loadDatabase(function (err) {
	if (err) throw err; // no hope, just terminate
});

var exec = require('child_process').exec;
var fs = require('fs');
var cron_parser = require("cron-parser");

exports.log_folder = base_path + 'logs';

crontab = function(name, command, schedule, stopped, logging, mailing){
	var data = {};
	data.name = name;
	data.command = command;
	data.schedule = schedule;
	if(stopped !== null) {
		data.stopped = stopped;
	}
	data.timestamp = (new Date()).toString();
	data.logging = logging;
	if (!mailing)
		mailing = {};
	data.mailing = mailing;
	return data;
};

exports.create_new = function(name, command, schedule, logging, mailing){
	var tab = crontab(name, command, schedule, false, logging, mailing);
	tab.created = new Date().valueOf();
	db.insert(tab);
};

exports.update = function(data){
	db.update({_id: data._id}, crontab(data.name, data.command, data.schedule, null, data.logging, data.mailing));
};

exports.status = function(_id, stopped){
	db.update({_id: _id},{$set: {stopped: stopped}});
};

exports.remove = function(_id){
	db.remove({_id: _id}, {});
};

// Iterates through all the crontab entries in the db and calls the callback with the entries
exports.crontabs = function(callback){
	db.find({}).sort({ created: -1 }).exec(function(err, docs){
		for(var i=0; i<docs.length; i++){
			if(docs[i].schedule == "@reboot")
				docs[i].next = "Next Reboot";
			else
				docs[i].next = cron_parser.parseExpression(docs[i].schedule).next().toString();
		}
		callback(docs);
	});
};

exports.get_crontab = function(_id, callback) {
	db.find({_id: _id}).exec(function(err, docs){
		callback(docs[0]);
	});
};

exports.runjob = function(_id, callback) {
	db.find({_id: _id}).exec(function(err, docs){
		var res = docs[0];
		exec(res.command, function(error, stdout, stderr){
			console.log(stdout);
		});
	});
};

// Set actual crontab file from the db
exports.set_crontab = function(env_vars, callback){
	exports.crontabs( function(tabs){
		var crontab_string = "";
		if (env_vars) {
			crontab_string = env_vars + "\n";
		}
		tabs.forEach(function(tab){
			if(!tab.stopped) {
				//let stderr = path.join(cronPath, tab._id + ".stderr");
				//let stdout = path.join(cronPath, tab._id + ".stdout");
				let log_file = path.join(exports.log_folder, tab._id + ".log");

				//if(tab.command[tab.command.length-1] != ";") // add semicolon
				//	tab.command +=";";

				//crontab_string += tab.schedule + " ({ " + tab.command + " } | tee " + stdout + ") 3>&1 1>&2 2>&3 | tee " + stderr;

				//if (tab.logging && tab.logging == "true") {
				//	crontab_string += "; if test -f " + stderr +
				//	"; then date >> " + log_file +
				//	"; cat " + stderr + " >> " + log_file +
				//	"; fi";
				//}

				//if (tab.hook) {
				//	crontab_string += "; if test -f " + stdout +
				//	"; then " + tab.hook + " < " + stdout +
				//	"; fi";
				//}

				if (tab.logging && tab.logging == "true") {
					crontab_string += tab.schedule + " /usr/lib/node_modules/crontab-ui/cronhelper.sh " + tab.command + " >> " + log_file + "2>&1";
				} else {
					crontab_string += tab.schedule + " " + tab.command;
				}

				//if (tab.mailing && JSON.stringify(tab.mailing) != "{}"){
				//	crontab_string += "; /usr/local/bin/node " + __dirname + "/bin/crontab-ui-mailer.js " + tab._id + " " + stdout + " " + stderr;
				//}

				crontab_string += "\n";
			}
		});

		fs.writeFile(env_file, env_vars, function(err) {
			if (err) callback(err);
			// In docker we're running as the root user, so we need to write the file as root and not crontab
			var fileName = "crontab"
			if(process.env.CRON_IN_DOCKER !== undefined) {
				fileName = "root"
			}
			fs.writeFile(path.join(cronPath, fileName), crontab_string, function(err) {
				if (err) return callback(err);
				/// In docker we're running crond using busybox implementation of crond
				/// It is launched as part of the container startup process, so no need to run it again
				if(process.env.CRON_IN_DOCKER === undefined) {
					exec("crontab " + path.join(cronPath, "crontab"), function(err) {
						if (err) return callback(err);
						else callback();
					});
				} else {
					callback();
				}
			});
		});
	});
};

exports.get_backup_names = function(){
	var backups = [];
	fs.readdirSync(base_path).forEach(function(file){
		// file name begins with 'backup ' and ends with '.db'
		if(file.indexOf("backup ") === 0 && file.endsWith(".db")){
			backups.unshift(file.substring(7, file.length-3));
		}
	});

	// Sort by date. Newest on top
	//for(var i=0; i<backups.length; i++){
	//	var Ti = backups[i].split("backup")[1];
	//	Ti = new Date(Ti.substring(0, Ti.length-3)).valueOf();
	//	for(var j=0; j<i; j++){
	//		var Tj = backups[j].split("backup")[1];
	//		Tj = new Date(Tj.substring(0, Tj.length-3)).valueOf();
	//		if(Ti > Tj){
	//			var temp = backups[i];
	//			backups[i] = backups[j];
	//			backups[j] = temp;
	//		}
	//	}
	//}

	return backups;
};

exports.backup = function(){
	//TODO check if it failed
	var d = new Date();
	var dateformat = d.getFullYear() + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + ":" + ("0" + d.getSeconds()).slice(-2);
	var filename = 'backup ' + dateformat + '.db';
	fs.createReadStream(db_file).pipe(fs.createWriteStream(base_path + filename));
};

exports.restore = function(db_name){
	fs.createReadStream(base_path + db_name).pipe(fs.createWriteStream(db_file));
	db.loadDatabase(); // reload the database
};

exports.reload_db = function(){
	db.loadDatabase();
};

exports.get_env = function(){
	if (fs.existsSync(env_file)) {
		return fs.readFileSync(env_file , 'utf8').replace("\n", "\n");
	}
	return "";
};

exports.import_crontab = function(){
	exec("crontab -l", function(error, stdout, stderr){
		var lines = stdout.split("\n");
		var namePrefix = new Date().getTime();

		lines.forEach(function(line, index){
			line = line.replace(/\t+/g, ' ');
			var regex = /^((\@[a-zA-Z]+\s+)|(([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+))/;
			var command = line.replace(regex, '').trim();
			var schedule = line.replace(command, '').trim();

			var is_valid = false;
			try { is_valid = cron_parser.parseString(line).expressions.length > 0; } catch (e){}

			if(command && schedule && is_valid){
				var name = namePrefix + '_' + index;

				db.findOne({ command: command, schedule: schedule }, function(err, doc) {
					if(err) {
						throw err;
					}
					if(!doc){
						exports.create_new(name, command, schedule, null);
					}
					else{
						doc.command = command;
						doc.schedule = schedule;
						exports.update(doc);
					}
				});
			}
		});
	});
};

exports.autosave_crontab = function(callback) {
	let env_vars = exports.get_env();
	exports.set_crontab(env_vars, callback);
};
