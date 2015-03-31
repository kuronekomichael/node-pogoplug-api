var request = require('request');
var fs = require('fs');
var util = require('util');
var path = require('path');
var EventEmitter = require('events').EventEmitter;
'use strict';

var CONFIG = {
	BASE_URI: 'https://service.pogoplug.com/svc/api/',
	MAX_COUNT: 999999999999
};

function PogoplugAPI(jsonfile) {
	this.isLogin = false;
	this.token;
	this.deviceid;
	this.serviceid;
	this.apiurl;
	this.uploadurl;

	if (fs.existsSync(jsonfile)) {
		var data = fs.readFileSync(jsonfile).toString();
		var json = JSON.parse(data);
		for (var key in json) {
			this[key] = json[key];
		}
	}
}

//---- High Level API ----------------------------------------------------------

PogoplugAPI.prototype.login = function(email, pass, cb) {
	var that = this;

	email = encodeURIComponent(email);

	get(CONFIG.BASE_URI + 'json/loginUser?email=' + email + '&password=' + pass, function(err, res, body) {
		var ret = JSON.parse(body);

		that.token = ret.valtoken;
		that.isLogin = true;

		that.getCloudInfo(function(infoErr, info) {
			if (infoErr) {
				cb(infoErr)
				return;
			}

			that.deviceid = info.deviceid;
			that.serviceid = info.serviceid;
			that.apiurl = info.apiurl;
			that.uploadurl = info.apiurl.replace('/api/', '/files/');

			cb(null, that.token)
		});
	}, cb);
};

// path to fileid
PogoplugAPI.prototype.findFileByPath = function(targetPath, cb) {
	var that = this;

	var paths = targetPath.split(/\//).filter(function(p) { return !!p; });

	if (paths.length === 0) {
		process.nextTick(function() {
			cb(null, {fileid: null});
		});
		return;
	}

	that.findFileByPathRecursive(paths, null, function(err, file) {
		if (err) {
			cb(err)
			return;
		}
		cb(null, file);
	});
};

/*
 * isExists / Is there file in path
 * @param
 *		path [required]
 */
PogoplugAPI.prototype.isExists = function(targetPath, cb) {
	var that = this;
	that.findFileByPath(targetPath, function(err, file) {
		if (err) {
			if (/no such file or directory/.test(err.toString())) {
				cb(null, false)
			} else {
				cb(err);
			}
			return;
		}
		cb(null, !!(file && file.fileid));
	});
};

/*
 * mkdir / create directory by path
 * @param
 *		path [required]
 */
PogoplugAPI.prototype.mkdir = function(targetPath, cb) {
	var that = this;
	var paths = targetPath.split(/\//).filter(function(p) { return !!p; });

	var dirPath = paths.shift();
	if (!dirPath) {
		dirPath = '/';
	} else {
		dirPath = '/' + dirPath;
	}

	that.mkdirRecursive(paths, dirPath, function(err, dir) {
		cb(err, dir)
	});
};

/*
* upload = createFile + sendFile + events
* @param
*		fromPath [required]
*       toPath [required]
*/
PogoplugAPI.prototype.upload = function(fromPath, toPath) {
	var that = this;
	var ev = new EventEmitter;

	var throwError = function(err) {
		process.nextTick(function() {
			ev.emit('error', err);
		})
	};

	// もしfromPathにファイルがなかったらエラー
	if (!fs.existsSync(fromPath)) {
		throwError(new Error('File not found at ' + fromPath));
		return ev;
	}
	var stat = fs.statSync(fromPath);
	if (!stat.isFile()) {
		throwError(new Error('Not a file: ' + fromPath));
		return ev;
	}

	// もしtoPathがなければディレクトリを作成する
	that.mkdir(toPath, function(err, dir) {

		if (err) {
			throwError(err);
			return;
		}

		var uploadPath = path.join(toPath, path.parse(fromPath).base);
		that.findFileByPath(uploadPath, function(err, file) {
			if (err && !/no such file or directory/.test(err.toString())) {
				throwError(err);
				return;
			}

			if (file && parseInt(file.size, 10) === stat.size) {
				ev.emit('data', stat.size, file.size);
				ev.emit('end');
				return;
			}

			// アップロードの準備としてファイルIDを発番
			that.createFile({
				filename: path.basename(fromPath),
				parentid: dir.fileid
			}, function(err, file) {
				if (err) {
					throwError(err);
					return;
				}

				// ファイルを実際に送信
				that.sendFile({
					fileid: file.fileid,
					filename: file.name,
					filepath: fromPath,
					onError: function(err) {
						ev.emit('error', err);
					},
					onData: function(size, totalSize) {
						ev.emit('data', size, totalSize);
					},
					onEnd: function() {
						ev.emit('end');
					}
				});
			});
		});
	});

	return ev;
};

//---- Innter Methods ----------------------------------------------------------

PogoplugAPI.prototype.findFileByPathRecursive = function(paths, parentid, cb) {
	var that = this;
	var targetName = paths.shift();

	// 該当ディレクトリのすべてのファイルをリストアップ
	that.listFiles({ parentid: parentid }, function(err, data) {
		if (err) {
			cb(err);
			return;
		}
		if (!data.files) {
			//FIXME 実装が汚すぎる...orz
			// 空のディレクトリ
			var error = new Error('no such file or directory:(empty dir) ' + targetName + ' on parentid=' + parentid);
			error.targetName = targetName;
			error.parentid = parentid;
			cb(error);
			return;
		}
		var findFiles = data.files.filter(function(file) {
			return (targetName === file.filename);
		});
		if (findFiles.length === 0) {
			//FIXME 実装が汚すぎる...orz
			// 見つからなかった
			var error = new Error('no such file or directory: ' + targetName + ' on parentid=' + parentid);
			error.targetName = targetName;
			error.parentid = parentid;
			cb(error);
		} else if (2 <= findFiles.length) {
			// 同じファイル名で２つ以上みつかった
			cb(new Error('find duplicate filename: ' + targetName + ' on parentid=' + parentid));
		} else {
			if (paths.length === 0) {
				// ファイル発見
				cb(null, findFiles[0]);
			} else {
				// 更にディレクトリの深層を探索する
				that.findFileByPathRecursive(paths, findFiles[0].fileid, cb);
			}
		}
	});
	//parentid
}

PogoplugAPI.prototype.mkdirRecursive = function(paths, currentDir, cb) {
	var that = this;
	that.findFileByPath(currentDir, function(err, dir) {
		if (err) {
			if (/no such file or directory/.test(err.toString())) {
				// このディレクトリを作成する
				that.createDirectory({
					parentid: err.parentid,
					filename: err.targetName
				}, function(err, dir) {
					if (err) {
						cb(err);
						return;
					}
					if (paths.length === 0) {
						// 末端のディレクトリまで既に存在している
						cb(null, dir)
					} else {
						// 奥のディレクトリへ
						that.mkdirRecursive(paths, currentDir + '/' + paths.shift(), cb);
					}
				})
			} else {
				cb(err);
			}
			return;
		}
		if (dir) {
			if (paths.length === 0) {
				// 末端のディレクトリまで既に存在している
				cb(null, dir)
			} else {
				// 奥のディレクトリへ
				that.mkdirRecursive(paths, currentDir + '/' + paths.shift(), cb);
			}
		} else {
			throw new Error('invalid parameters at mkdirRecursive');
		}
	});
};

PogoplugAPI.prototype.findFileById = function(files, id) {
	var that = this;
	files.forEach(function(file) {
		if (file.fileid === id) {
			return file;
		}
		if (file.type === FILE_TYPE_DIR) {
			var ret = that.findFildById(file.files, id);
			if (ret) {
				return ret;
			}
		}
	});
	return null;
};

//---- Util --------------------------------------------------------------------
//TODO: Cut off to another file

var FILE_TYPE_FILE          = '0';
var FILE_TYPE_DIR           = '1';
var FILE_TYPE_EXTRA_STEAM   = '2';
var FILE_TYPE_SYMBOLIC_LINK = '3';

var taskman = {
	tasks: [],
	add: function(task) {
		this.tasks.push(task);
	},
	exec: function(err) {
		var that = this;
		if (err) {
			that.goal(err);
			return;
		}
		if (that.tasks.length === 0) {
			that.goal(that.err);
			return;
		}
		var task = that.tasks.shift();
		task.func(function(){
			setInterval(function(){
				that.exec();
			},1);
		}, task.param);
	}
};

//---- Low Level API -----------------------------------------------------------
//TODO: Cut off to another file

var get = function(url, onSuccess, onError) {
	request.get(url, function(err, res, body) {
		if (err) {
			if (onError) {
				onError(err);
			} else {
				onSuccess(err);
			}
			return;
		}
		if (res.statusCode !== 200) {
			var err = new Error('Invalid statusCode:' + res.statusCode + ' on ' + url);
			if (OnError) {
				onError(err);
			} else {
				onSuccess(err);
			}
			return;
		}
		onSuccess(null, res, body);
	});
}

PogoplugAPI.prototype.getVersion = function(cb) {
	get(CONFIG.BASE_URI + 'getVersion', function(err, res, body) {
		cb(null, JSON.parse(body));
	});
};

PogoplugAPI.prototype.getUser = function(cb) {
	get({
		url: CONFIG.BASE_URI + 'json/getUser',
		qs: {
			valtoken: this.token
		}
	}, function(err, res, body) {
		var ret = JSON.parse(body);
		cb(null, ret);
	}, cb);

};

PogoplugAPI.prototype.listDevices = function(cb) {
	get({
		url: CONFIG.BASE_URI + 'json/listDevices',
		qs: {
			valtoken: this.token
		}
	}, function(err, res, body) {
		cb(null, JSON.parse(body).devices);
	}, cb);
};

PogoplugAPI.prototype.listServices = function(cb) {
	get({
		url: CONFIG.BASE_URI + 'json/listServices',
		qs: {
			valtoken: this.token
		}
	}, function(err, res, body) {
		var json;
		try {
			json = JSON.parse(body).services;
		} catch(e) {
			cb('JSON parse error:' + body);
			return;
		}
		cb(null, json);
	}, cb);
};

PogoplugAPI.prototype.getCloudInfo = function(cb) {
	get({
		url: CONFIG.BASE_URI + 'json/listDevices',
		qs: {
			valtoken: this.token
		}
	}, function(err, res, body) {
		var devices = JSON.parse(body).devices;

		var info = {
			deviceid: null,
			serviceid: null,
			apiurl: null
		};

		devices.forEach(function(device) {
			if (device.type !== 'xce:cloud') return;
			if (info.deviceid && info.serviceid) return;

			info.deviceid = device.deviceid;

			device.services.forEach(function(service) {
				if (service.type !== 'xce:plugfs:cloud') return;
				info.serviceid = service.serviceid;
				info.apiurl = service.apiurl;
			});
		}, cb);

		cb(null, info);
	}, cb);
};

var entringFiles = function(done, param) {
	var client = param.client;
	if (!param.file.files) {
		param.file.files = [];
	}
	client.listFilesRecursive(param.file.fileid, param.deviceid, param.serviceid, function(err, files) {
		if (err) {
			taskman.exec(err);
			return;
		}
		if (!files) {
			taskman.exec();
			return;
		}
		files.forEach(function(file) {
			param.file.files.push(file);
			if (file.type === FILE_TYPE_DIR) {
				taskman.add({
					func:entringFiles,
					param: {
						client: client,
						file:file,
						deviceid: param.deviceid,
						serviceid: param.serviceid
					}
				});
			}
		});
		taskman.exec();
	});
}

/*
 * listFiles
 * @param
 *		parentid [optional]
 *		recursive [optional](default:false)
 */
PogoplugAPI.prototype.listFiles = function(param, cb) {
	var that = this;

	var queryString = {
		valtoken: that.token,
		deviceid: that.deviceid,
		serviceid: that.serviceid,
		maxcount: CONFIG.MAX_COUNT,
		sortcrit: '+name'
	};

	if (param.parentid) {
		queryString.parentid = param.parentid;
	}

	get({
		url: CONFIG.BASE_URI + 'json/listFiles',
		qs: queryString,
	}, function(err, res, body) {

		if (param.recursive !== true) {
			cb(null, JSON.parse(body));
			return;
		}

		taskman.goal = function(err){
			cb(err, that.files);
		};

		that.files = JSON.parse(body).files;
		that.files.forEach(function(file) {
			if (file.type === FILE_TYPE_DIR) {
				taskman.add({
					func: entringFiles,
					param: {
						client: that,
						file: file,
						deviceid: that.deviceid,
						serviceid: that.serviceid
					}
				});
			}
		});
		taskman.exec();
		return;
	});
};

PogoplugAPI.prototype.listFilesRecursive = function(parentid, deviceid, serviceid, cb) {
	process.stdout.write('.');
	get({
		url: CONFIG.BASE_URI + 'json/listFiles',
		qs: {
			valtoken: this.token,
			deviceid: deviceid,
			serviceid: serviceid,
			maxcount: CONFIG.MAX_COUNT,
			parentid: parentid,
			//searchcrit: 'true',
			sortcrit: '+name'
		}
	}, function(err, res, body) {
		cb(err, JSON.parse(body).files);
	});
};

/*
 * createFile / create file space
 * @param
 *		filename [required]
 *		parentid [optional]
 */
PogoplugAPI.prototype.createFile = function(param, cb) {
	var that = this;

	var queryString = {
		valtoken: that.token,
		deviceid: that.deviceid,
		serviceid: that.serviceid,
		filename: param.filename,
	};

	if (param.parentid) {
		queryString.parentid = param.parentid
	}

	get({
		url: CONFIG.BASE_URI + 'json/createFile',
		qs: queryString
	}, function(err, res, body) {
		cb(err, JSON.parse(body).file);
	}, cb);
};

/*
 * createDirectory / create directory space
 * @param
 *		filename [required]
 *		parentid [optional]
 */
PogoplugAPI.prototype.createDirectory = function(param, cb) {
	var that = this;

	if (!param.filename) {
		throw new Error('filename is not set at createDirectory()');
	}

	var queryString = {
		valtoken: that.token,
		deviceid: that.deviceid,
		serviceid: that.serviceid,
		filename: param.filename,
		type: 1
	};

	if (param.parentid) {
		queryString.parentid = param.parentid
	}

	get({
		url: CONFIG.BASE_URI + 'json/createFile',
		qs: queryString
	}, function(err, res, body) {
		cb(err, JSON.parse(body).file);
	}, function(err) {
		cb(err);
	});
};

/*
* sendFile / send data to file space
* @param
*		fileid [required]
*		filename [required]
*		filepath [required]
*		onData
*		onError
*		onEnd
*/
PogoplugAPI.prototype.sendFile = function(param, cb) {
	var that = this;

	var putUrl = that.uploadurl + that.token
					+ '/' + that.deviceid
					+ '/' + that.serviceid
					+ '/' + param.fileid
					+ '/' + encodeURI(param.filename);

	var totalSize = fs.statSync(param.filepath).size;

	var requestOptions = {
		method: 'PUT',
		url: putUrl,
		headers: {
			'UP-SIZE': totalSize,
			'X-CEVALTOKEN': that.token
		}
	};

	fs.createReadStream(param.filepath)
		.on('data', function(buffer) {
			if (param.onData) {
				param.onData(buffer.length, totalSize);
			} else if (that.silent !== true) {
				util.print(".");
			}
		})
		.on('end', function() {
			if (param.onEnd) {
				param.onEnd();
			} else if (that.silent !== true) {
				util.print('x\n')
			}
		})
		.pipe(request(requestOptions, function(err, res, body) {
			if (err) {
				if (param.onError) param.onError(err);
				if (cb) cb(err)
				return;
			}
			if (res.statusCode !== 200) {
				var err = new Error('sendFile - invalid statusCode=' + res.statusCode + ' on ' + putUrl);
				err.extra = {
					req: {
						method: res.req.method,
						path: res.req.path,
						headers: res.req._headers
					},
					res: {
						statusCode: res.statusCode,
						url: putUrl,
						body: body.toString(),
						headers: res.headers
					}
				};
				if (param.onError) param.onError(err);
				if (cb) cb(err);
				return;
			}
			if (cb) cb(null);
		}));
};

module.exports = PogoplugAPI;
