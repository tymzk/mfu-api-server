/*jshint esversion:6 */

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var Log4js = require('log4js');

Log4js.configure('log.config.json');

var systemLogger = Log4js.getLogger('system');
var accessLogger = Log4js.getLogger('access');
var errorLogger = Log4js.getLogger('error');

systemLogger.info('this is system log!!!');
accessLogger.info('this is access log!!!');
errorLogger.info('this is error log!!!');

// File upload.
var multer = require('multer');
var fs = require('fs');
var uploadDir = './uploads';


// mongo
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var connection = mongoose.connect('mongodb://localhost/mfu-database',
	function(err) {
		if (err) {
			errorLogger.error('failed to connect mongoDB');
		}else{
			systemLogger.info('connected to mongoDB');
		}
	});

var Schema = mongoose.Schema;

var SubjectModelName='Subject';
var AdminModelName='Admin';
var UserModelName='User';

var SubjectCollectionName='{ collection: "subjects" }';
var AdminCollectionName='{ collection: "admins"}';
var UserCollectionName='{ collection: "users"}';

var SubjectSchema = new Schema({
	name : {type: String, required: true},
	teachers : [ {type: String, unique: true} ],
	semester : { type: String, enum : [ 'spring', 'autumn' ] },
	assignments : [ {
		name: {type: String},
		deadline: {type: Date},
		description : {type: String},
		items: [ {
			name: {type: String},
			alias: {type: String},
			description: {type: String}
		} ]
	} ],
	students : [ {type: String} ]
}, { collection: "subjects" });

var AdminSchema  = new Schema({
	id : { type: String, required: true, unique: true},
	subjects : [ {type: Schema.Types.ObjectId, ref: SubjectModelName, unique: true} ]
}, { collection: "admins"});

var UserSchema  = new Schema({
	id : { type: String, required: true, unique: true},
	subjects : [ {type: Schema.Types.ObjectId, ref: SubjectModelName, unique: true} ]
}, { collection: "users"});

var Subject = connection.model(SubjectModelName, SubjectSchema);
var Admin = connection.model(AdminModelName, AdminSchema);
var User = connection.model(UserModelName, UserSchema);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// If the back-end is different from the front-end, must care CORS.
app.use(function(req, res, next) {
	res.setHeader("Access-Control-Allow-Methods", "POST, PUT, OPTIONS, DELETE, GET");
	res.header("Access-Control-Allow-Origin", "http://localhost.co.jp:4200");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	res.header("Access-Control-Allow-Credentials", true);
	next();
});

var ObjectId = mongoose.Types.ObjectId;
var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, uploadDir);
	},
});

//	dest: "./uploads/",
var upload = multer({ storage: storage }).array("uploads", 12);


app.post("/upload", upload, function(req, res) {
	console.log(req.body);
	console.log(req.files);

	var data = JSON.parse(req.body.data);

	var subjectDir = uploadDir + '/' + data.subjectObjectId;
	var assignmentDir = subjectDir + '/' + data.assignmentObjectId;
	var assignmentItemDir = assignmentDir + '/' + data.assignmentItemObjectId;
	var userDir = assignmentItemDir + '/' + data.userId;

	var tmpPath = req.files[0].path;
	var destPath = userDir;

	if(data.alias){
		destPath = destPath + '/' + data.alias;
	}else{
		destPath = destPath + '/' + req.files[0].filename;
	}

	if(!fs.existsSync(subjectDir)){
		systemLogger.warn('mkdir:'+ subjectDir);
		fs.mkdir(subjectDir);
	}

	if(!fs.existsSync(assignmentDir)){
		systemLogger.warn('mkdir:'+ assignmentDir);
		fs.mkdir(assignmentDir);
	}

	if(!fs.existsSync(assignmentItemDir)){
		systemLogger.warn('mkdir:'+ assignmentItemDir);
		fs.mkdir(assignmentItemDir);
	}

	if(!fs.existsSync(userDir)){
		systemLogger.warn('mkdir:'+ userDir);
		fs.mkdir(userDir);
	}

	console.log(tmpPath);
	console.log(destPath);

	move(tmpPath, destPath);

	res.send(req.files);
});

function move(tmpPath, newPath, callback){
	fs.rename(tmpPath, newPath, function(err){
		if(err){
			if(err.code === 'EXDEV'){
				console.log("aww");
			}else{
				//callback(err);
			}
			return;
		}
//			callback();
	});
	function copoy(){
		var readStream = fs.createReadStream(tmpPath);
		var writeStream = fs.createWriteStream(newPath);

		readStream.on('error', callback);
		writeStream.on('error', callback);

		readStream.on('close', function() {
			fs.unlink(tmpPath, callback);
		});
		readStream.pipe(writeStream);
	}
}


app.post("/upload", function(req, res) {
	accessLogger.info('url:'+ decodeURI(req.url));
	upload(req, res, function(err){
		console.log(req.body);
		console.log(req.files);
		if(err){
			res.json({error_code:1,err_desc:err});
			return;
		}
		res.json({error_code:0,err_desc:null});
	});
});

// GET /api
router.get('/', function(req, res) {
	accessLogger.info('url:'+ decodeURI(req.url));
	res.json({ message: 'a test message has been posted.' });
});

// GET /api/god
router.route('/god').get(function(req, res) {
	accessLogger.warn('url:'+ decodeURI(req.url));
	res.json({isAdmin: true});
});

// GET /api/admins
router.route('/admins')
	.get(function(req, res){
		accessLogger.warn('url:'+ decodeURI(req.url));
		Admin.find(function(err, admins){
			if (err)
				res.send(err);
			res.json(admins);
		});
	});

// GET /api/admins/ids
router.route('/admins/ids')
	.get(function(req, res){
		accessLogger.warn('url:'+ decodeURI(req.url));
		Admin.find( {}, { _id:0, subjects:0, __v:0 }, function(err, adminIds){
			if (err)
				res.send(err);
			res.json(adminIds);
		});
	});

// GET/POST /api/admins/:userId
router.route('/admins/:userId')
	.get(function(req, res){
		accessLogger.info('url:'+ decodeURI(req.url));
		Admin.find( { id: req.params.userId }, function(err, admin){
			if (err){
				errorLogger.error('failed to find admin account' + admin.id);
				res.send(err);
			}else{
				res.json(admin);
			}
		});
	})
	.post(function(req, res){
		accessLogger.info('url:'+ decodeURI(req.url));
		var admin = new Admin();
		admin.id = req.params.userId;
		admin.save(function(err) {
			if (err){
				errorLogger.error('failed to create admin account' + admin.id);
				res.send(err);
			}else{
				systemLogger.info('admin account has been created:' + admin.id);
				res.json({ message: 'The new admin has been created.' });
			}
		});
	});
/*.delete(function(req, res){*/

// GET /api/admins/:userId/subjects/
router.route('/admins/:userId/subjects')
	.get(function(req, res){
		accessLogger.info('url:'+ decodeURI(req.url));
		Admin.findOne( { id: req.params.userId } )
		.populate('subjects')
		.exec(function(err, admin){
			if (err){
				res.send(err);
				errorLogger.error("cannot find subjects");
			}
			res.json(admin.subjects);
		});
	});

// GET /api/users
router.route('/users')
	.get(function(req, res){
		accessLogger.warn('url:'+ decodeURI(req.url));
		User.find(function(err, users){
			if (err){
				errorLogger.error("faild to find account");
				res.send(err);
			}else{
				res.json(users);
			}
		});
	});

// GET/POST /api/users/:id
router.route('/users/:id')
	.get(function(req, res){
		accessLogger.info('url:'+ decodeURI(req.url));
		User.findOne( { id: req.params.id }, function(err, user){
			if (err){
				errorLogger.error("failed to find account: " + req.params.id);
				res.send(err);
			}else{
				res.json(user);
			}
		});
	})
	.post(function(req, res){
		accessLogger.info('url:'+ decodeURI(req.url));
		var user = new User();
		user.id = req.params.id;
		user.save(function(err) {
			if (err){
				errorLogger.error("failed to create account: " + user.id);
				res.send(err);
			}else{
				systemLogger.info("account has been created: " + user.id);
				res.json({ message: 'The new user has been created.' });
			}
		});
	});

// GET/POST /api/users/:id/subjects
router.route('/users/:id/subjects')
	.get(function(req, res){
		accessLogger.info('url:'+ decodeURI(req.url));
		systemLogger.debug('koko izure naosu');
		Subject.find( { students: req.params.id }, function(err, subjects){
			if (err){
				errorLogger.error("failed to find subjects: " + req.param.id);
				res.send(err);
			}else{
				res.json(subjects);
			}
		});
	});

// GET/POST /api/subjects
router.route('/subjects')
	.get(function(req, res) {
		accessLogger.warn('url:'+ decodeURI(req.url));
		Subject.find(function(err, subjects) {
			if (err){
				errorLogger.error("failed to find subjects");
				res.send(err);
			}else{
				res.json(subjects);
			}
		});
	})
	.post(function(req, res){
		accessLogger.warn('url:'+ decodeURI(req.url));

		var subject = new Subject();
		subject.name = req.body.name;
		subject.teachers = req.body.teachers;
		subject.semester = req.body.sememster;

		subject.save(function(err) {
			if (err){
				console.log("failed to create subject");
				res.send(err);
			}else{
				Admin.findOneAndUpdate(
					{id: subject.teachers[0]},
					{$addToSet: { subjects: subject._id }},
					{upsert: false, new: true},
					function(err, updatedAdmin) {
						if (err){
							errorLogger.error("failed to update account");
							res.send(err);
						}else{
							systemLogger.info("admin account has been updated: " + updatedAdmin);
						}
				});
				res.json({ message: 'new subject has been created.' });
			}
		});
	});

// GET/PUT /api/subjects/:subjectObjId
router.route('/subjects/:subjectObjId')
	.get(function(req, res) {
		accessLogger.info('url:'+ decodeURI(req.url));
		Subject.findById(req.params.subjectObjId, function(err, subject) {
			if (err){
				errorLogger.error('failed to find: ' + req.params.subjectObjId);
				res.send(err);
			}else {
				res.json(subject);
			}
		});
	})
	.put(function(req, res) {
		accessLogger.info('url:'+ decodeURI(req.url));
		Subject.findByIdAndUpdate(
			req.params.subjectObjId,
			{name: req.body.name, semester: req.body.semester },
			{upsert: false, new: true},
			function(err, updatedSubject) {
				if(err){
					errorLogger.error('failed to update subject: ' + req.params.subjectObjId);
					res.send(err);
				} else {
					res.json(updatedSubject);
				}
			}
		);
	});

// GET/PUT subjects/:subjectObjId/students
router.route('/subjects/:subjectObjId/students')
	// Get student list
	.get(function(req, res) {
		accessLogger.warn('url:'+ decodeURI(req.url));
		Subject.findById(req.params.subjectObjId, function(err, subject) {
			if (err){
				errorLogger.error('failed to find subject: ' + req.params.subjectObjId);
				res.send(err);
			}else{
				res.json(subject.students);
			}
		});
	})
	.put(function(req, res) {
		Subject.findById(req.params.subjectObjId, function(err, subject) {
			accessLogger.info('url:'+ decodeURI(req.url));
			if(err){
				errorLogger.error('failed to find subject: ' + req.params.subjectObjId);
				res.send(err);
			}else{
				console.log("undebugged ittan comment out" + req.body);
/*				subject.students = req.body;
				subject.save(function(err) {
					if (err){
						errorLogger('failed to save subject');
						res.send(err);
					}else{
						res.json({ message: 'Students have been updated.' });
					}
				});*/
			}
		});
	});

// GET/PUT api/subjects/:subjectObjId/assignments
router.route('/subjects/:subjectObjId/assignments')
	.get(function(req, res) {
		accessLogger.info('url:'+ decodeURI(req.url));
		Subject.findById(req.params.subjectObjId, function(err, subject){
			if (err){
				errorLogger('failed to find subject: ' + req.params.subjectObjId);
				res.send(err);
			}else{
				res.json(subject.assignments);
			}
		});
	})
	.post(function(req, res) {
		accessLogger.info('url:'+ decodeURI(req.url));
		console.log("debug mada attetara naosu");
		accessLogger.info('receive:'+ req.body);
		/*
		Subject.findByIdAndUpdate(
			req.params.subjectObjId,
			{$addToSet: { assignments: [req.body] }},
			{upsert: false, new: true},
			function(err, updatedSubject) {
				if (err){
					errorLogger.error('failed to update subject: ' + req.params.subjectObjId);
					res.send(err);
				}else{
					res.json(updatedSubject);
				}
			}
		);*/
	});

// GET/PUT api/subjects/:subjectObjId/assignments/:assignmentObjId
router.route('/subjects/:subjectObjId/assignments/:assignmentObjId')
	.get(function(req, res) {
		accessLogger.info('url:'+ decodeURI(req.url));
		Subject.findById(req.params.assignmentObjId, function(err, assignment){
			if (err){
				errorLogger.error('failed to find subject: ' + req.params.subjectObjId);
				res.send(err);
			}else{
				res.json(assignment);
			}
		});
	})
	.put(function(req, res) {
		accessLogger.info('url:'+ decodeURI(req.url));
		console.log("attetara comento hazusu→" + req.body);
/*		Subject.findByIdAndUpdate(
			req.params.assignmentObjId,
			req.body,
			{upsert: false, new: true},
			function(err, updatedAssignment) {
				if (err){
					errorLogger.error('failed to update assignment: ' + req.params.subjectObjId);
					res.send(err);
				}else{
					res.json({ message: 'The assignment has been updated' });
				}
			}
		);*/
	})
	.post(function(req, res) {
		accessLogger.info('url:'+ decodeURI(req.url));
		console.log("attetara comento hazusu→" + req.body);
/*
		Subject.findByIdAndUpdate(
			req.params.subjectObjId,
			{$addToSet: { assignmentItems: req.body }},
			{upsert: false, new: true},
			function(err, subject) {
				if (err){
					errorLogger.error('failed to find ');
					res.send(err);
				}else {
					subject.save(function(err) {
						if (err){
							errorLogger('failed to save subject: ' + req.params.subjectObjId);
							res.send(err);
						}else{
							res.json({ message: 'The assignment item has been updated' });
						}
					});
				}
			}
		);*/
	});

// GET/PUT api/subjects/:subjectObjId/assignments/:assignmentObjId/assignmentItem/:assignmentItemObjId
router.route('/subjects/:subjectObjId/assignments/:assignmentObjId/assignmentItem/:assignmentItemObjId')
	.get(function(req, res) {
		accessLogger.info('url:'+ decodeURI(req.url));
		Subject.findById(req.params.assignmentItemObjId, function(err, assignment){
			if (err){
				errorLogger.error('failed to find assignment item: ' + req.params.assignmentItemObjId);
				res.send(err);
			}else{
				res.json(assignment);
			}
		});
	})
	.put(function(req, res) {
		accessLogger.info('url:'+ decodeURI(req.url));
		console.log("attetara comento hazusu→" + req.body);
/*
		Subject.findByIdAndUpdate(
			req.params.assignmentItemObjId,
			req.body,
			{upsert: false, new: true},
			function(err, updatedAssignmentItem) {
				if (err){
					errorLogger.error('failed to update assignment: ' + req.params.subjectObjId);
					res.send(err);
				}else{
					res.json(updatedAssignmentItem);
				}
			}
		);*/
	});


app.use('/api', router);

app.listen('3001', function(){
		console.log('running on 3001...');
});