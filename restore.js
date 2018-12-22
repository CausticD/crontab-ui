//load database
var Datastore = require('nedb');

var exec = require('child_process').exec;
var fs = require('fs');

var m_dir = '';
var m_extension = '';

exports.init = function(folder, prefix, extension){
	m_dir = __dirname + folder + prefix;
	m_extension = extension;
};

exports.crontabs = function(db_name, callback){
	var db = new Datastore({ filename: m_dir + db_name + m_extension });
	db.loadDatabase(function (err) {
	});
	db.find({}).sort({ created: -1 }).exec(function(err, docs){
		callback(docs);
	});
};

exports.delete = function(db_name){
	var file = m_dir + db_name + m_extension;
	console.log('restore.js: Delete: ' + file);
	fs.unlink(file, (err) => {
		if(err) throw err;
		console.log('restore.js: Delete success');
	});
};
