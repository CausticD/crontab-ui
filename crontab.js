/*jshint esversion: 6*/
//load database
var Datastore = require('nedb');
var path = require("path");

var base_path = __dirname + '/crontabs/';
var db_file = base_path + 'crontab.db';
var env_file = base_path + 'env.db';
var logrotate_path = __dirname + '/logrotate/';
var logrotate_configfile = logrotate_path + 'logrotate.conf';
var logrotate_logfile = logrotate_path + 'logrotate.log';
var logrotate_statefile = logrotate_path + 'logrotate.state';

var m_prefix = ''
var m_extension = ''

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

crontab = function(name, command, schedule, stopped, mailing, options){
	var data = {};
	data.name = name;
	data.command = command;
	data.schedule = schedule;
	if(stopped !== null) {
		data.stopped = stopped;
	}
	data.timestamp = (new Date()).toString();
	if (!mailing)
		mailing = {};
	data.mailing = mailing;
	data.options = options;
	return data;
};

exports.init = function(prefix, extension){
	m_prefix = prefix;
	m_extension = extension;
};

exports.create_new = function(name, command, schedule, mailing, options){
	var tab = crontab(name, command, schedule, false, mailing, options);
	tab.created = new Date().valueOf();
	db.insert(tab);
};

exports.update = function(data){
	db.update({_id: data._id}, crontab(data.name, data.command, data.schedule, null, data.mailing, data.options));
};

exports.status = function(_id, stopped){
	db.update({_id: _id},{$set: {stopped: stopped}});
};

exports.remove = function(_id){
	db.remove({_id: _id}, {});
};

exports.delete_log = function(_id){
	_file = exports.log_folder +"/"+_id+".log";
	console.log('Testing ' + _file);
	if (fs.existsSync(_file)) {
		fs.unlink(_file, function (err) {
			if (err) throw err;
			console.log(_file + ' deleted!');
		});
	}
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

exports.write_logrotate = function(callback){
	exports.crontabs( function(tabs){
		var logrotate_string = "";
		tabs.forEach(function(tab){
			if(!tab.stopped && tab.options && tab.options.rotate) {
				let log_file = path.join(exports.log_folder, tab._id + ".log");
				logrotate_string += log_file + ' {\n';
				logrotate_string += '  ' + tab.options.rotfreq + '\n';
				logrotate_string += '  rotate ' + tab.options.rotnumber + '\n';
				if(tab.options.compress)
					logrotate_string += '  compress\n';
				logrotate_string += '}\n';
			}
		});

		fs.writeFile(logrotate_configfile, logrotate_string, function(err) {
			if (err) return callback(err);
			callback();
		});
	});
};

// Set actual crontab file from the db
exports.set_crontab = function(env_vars, callback){
	exports.crontabs( function(tabs){
		var logrotate_used = false;
		var crontab_string = "";
		if (env_vars) {
			crontab_string = env_vars + "\n";
		}
		tabs.forEach(function(tab){
			if(!tab.stopped) {
				let log_file = path.join(exports.log_folder, tab._id + ".log");

				crontab_string += tab.schedule + " ";

				if (tab.options) {
					if (tab.options.stdout == "true" && tab.options.stderr == "true") {
						crontab_string += __dirname + "/cronhelper_both.sh " + tab.command + " >> " + log_file;
					} else if(tab.options.stdout == "true") {
						crontab_string += __dirname + "/cronhelper_stdout.sh " + tab.command + " >> " + log_file;
					} else if(tab.options.stderr == "true") {
						crontab_string += __dirname + "/cronhelper_stderr.sh " + tab.command + " >> " + log_file;
					} else {
						crontab_string += tab.command;
					}

					if (tab.options.rotate == 'true')
						logrotate_used = true;
				}

				//if (tab.mailing && JSON.stringify(tab.mailing) != "{}"){
				//	crontab_string += "; /usr/local/bin/node " + __dirname + "/bin/crontab-ui-mailer.js " + tab._id + " " + stdout + " " + stderr;
				//}

				crontab_string += "\n";
			}
		});

		if (logrotate_used)
			crontab_string += "@hourly logrotate -v --state " + logrotate_statefile + " " + logrotate_configfile + " > " + logrotate_logfile + " 2>&1\n";

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
		if(file.indexOf(m_prefix) === 0 && file.endsWith(m_extension)){
			backups.unshift(file.substring(m_prefix.length, file.length-m_extension.length));
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
	var filename = m_prefix + dateformat + m_extension;
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
