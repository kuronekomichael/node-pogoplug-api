/*
 ref:
	[SinonJS]
		http://sinonjs.org/docs/#stubs
	[Mocha]
		http://visionmedia.github.io/mocha/
	[chai/expect]
		http://chaijs.com/api/bdd/
		http://chaijs.com/plugins/chai-datetime
	[request]
		https://www.npmjs.org/package/request
	[SinonJS + Request Example]
		http://bulkan-evcimen.com/testing_with_mocha_sinon
*/
var request = require('request'),
	sinon = require('sinon'),
	Pogoplug = require('../lib/pogoplug');

describe('basic tests', function() {

	var isStubbed = false;

	function stubRequest(param) {
		isStubbed = true;
		sinon
			.stub(request, 'get')
			.yields(param.err, param.res, param.body);
	}

	beforeEach(function() {
		isStubbed = false;
		this.client = new Pogoplug();
	});

	afterEach(function() {
		if (isStubbed) {
			request.get.restore();
		}
	});

	it('get version', function(done) {
		stubRequest({
			err: null,
			res: {statusCode:200},
			body: JSON.stringify({ version: 'LINUX GENERIC - 4.8.0.1', builddate: 'Jan 31 2014 09:54:49' })
		});

		this.client.getVersion(function(err, ver) {
			expect(err).to.be.null;
			expect(ver).to.be.ok;
			expect(ver.version).to.match(/LINUX GENERIC - \d+\.\d+\.\d+\.\d+/);
			done();
		});
	});

	it('login', function(done) {
		var that = this;

		expect(this.client.isLogin).to.be.false;

		var body1 = '{"valtoken":"0rfGyBR6aWpWaAHQf40JYgpYnNqWNK16AAABRFMBk5rCX1N5ozvWODSijbV4rVUcGP-BBQ","user":{"userid":"147a696a566801d07f8d09620a589cda","screenname":"fadlkalkdsfjfalk+pogoplug@gmail.com","email":"fadlkalkdsfjfalk+pogoplug@gmail.com","flags":"lv,","emails":[{"address":"fadlkalkdsfjfalk+pogoplug@gmail.com","validated":"1","default":"0"}],"locale":"ja","options":[{"name":"files_def","value":"XCLDMCAPL2F4WD3PM955YKGEZW:_:XCLDMCAPL2F4WD3PM955YKGEZW"},{"name":"photos_def","value":"cesearch_image"},{"name":"welcome-overlay-shown","value":"1"}],"origin":"sharelp","purpose":"mcloud"},"home":"my.html"}';

		var body2 = '{"devices":[{"deviceid":"XCLDMCAPL2F4WD3PM955YKGEZW","type":"xce:cloud","name":"Pogoplug Cloud","version":"LINUX GENERIC - 4.6.3.2","flags":"0","ownerid":"147a696a566801d07f8d09620a589cda","sku":{"id":"36","oem":"Cloud Engines","name":"POGOCLOUD-MCLOUDFREE","username":"Pogoplug Cloud","terms":"0"},"provisionflags":"0","authorized":"1","plan":{"duration":"-1","limit":"0","name":"POGOCLOUD-MCLOUDFREE","startdate":"1387769475455","type":"POGOCLOUD"},"services":[{"deviceid":"XCLDMCAPL2F4WD3PM955YKGEZW","serviceid":"XCLDMCAPL2F4WD3PM955YKGEZW","sclass":"1","type":"xce:plugfs:cloud","name":"Pogoplug Cloud","version":"4.6.3.2","online":"1","msgpending":"0","apiurl":"https://cl2c1.pogoplug.com/svc/api/","space":"4886188356/5000000000","flags":"0","onlan":"0","metaver":"0"}]}]}';

		isStubbed = true;
		sinon
			.stub(request, 'get')
			.onCall(0)
			.yields(null, {statusCode:200}, body1)	// login
			.onCall(1)
			.yields(null, {statusCode:200}, body2);	// getCloudInfo

		this.client.login('faecasgfasef%2Bpogoplug%40gmail.com', 'sfdafefaefaa',  function(err, token) {
			expect(err).to.be.null;
			expect(token).to.match(/^[0-9A-Za-z-]+$/);

			expect(that.client.isLogin).to.be.true;
			done();
		});
	});

	it('get DeviceID and ServiceID', function(done) {

		var body = '{"devices":[{"deviceid":"XCLDMCAPL2F4WD3PM955YKGEZW","type":"xce:cloud","name":"Pogoplug Cloud","version":"LINUX GENERIC - 4.6.3.2","flags":"0","ownerid":"147a696a566801d07f8d09620a589cda","sku":{"id":"36","oem":"Cloud Engines","name":"POGOCLOUD-MCLOUDFREE","username":"Pogoplug Cloud","terms":"0"},"provisionflags":"0","authorized":"1","plan":{"duration":"-1","limit":"0","name":"POGOCLOUD-MCLOUDFREE","startdate":"1387769475455","type":"POGOCLOUD"},"services":[{"deviceid":"XCLDMCAPL2F4WD3PM955YKGEZW","serviceid":"XCLDMCAPL2F4WD3PM955YKGEZW","sclass":"1","type":"xce:plugfs:cloud","name":"Pogoplug Cloud","version":"4.6.3.2","online":"1","msgpending":"0","apiurl":"https://cl2c1.pogoplug.com/svc/api/","space":"4886188356/5000000000","flags":"0","onlan":"0","metaver":"0"}]}]}';

		stubRequest({
			err: null,
			res: {statusCode:200},
			body: body
		});

		this.client.getCloudInfo(function(err, info) {
			expect(err).to.be.null;
			expect(info).to.be.exist;

			expect(info).to.be.deep.equal({
				deviceid: 'XCLDMCAPL2F4WD3PM955YKGEZW',
				serviceid: 'XCLDMCAPL2F4WD3PM955YKGEZW',
				apiurl: 'https://cl2c1.pogoplug.com/svc/api/'
			});

			done();
		});
	});

	it('get service info', function(done) {

		var body = '{"services":[{"deviceid":"XCLDMCAPL2F4WD3PM955YKGEZW","serviceid":"XCLDMCAPL2F4WD3PM955YKGEZW","sclass":"1","type":"xce:plugfs:cloud","name":"Pogoplug Cloud","version":"4.6.3.2","online":"1","msgpending":"0","apiurl":"https://cl2c1.pogoplug.com/svc/api/","space":"4886188356/5000000000","flags":"0","onlan":"0","metaver":"0","device":{"deviceid":"XCLDMCAPL2F4WD3PM955YKGEZW","type":"xce:cloud","name":"Pogoplug Cloud","version":"LINUX GENERIC - 4.6.3.2","flags":"0","ownerid":"147a696a566801d07f8d09620a589cda","sku":{"id":"36","oem":"Cloud Engines","name":"POGOCLOUD-MCLOUDFREE","username":"Pogoplug Cloud","terms":"0"},"provisionflags":"0","authorized":"1","plan":{"duration":"-1","limit":"0","name":"POGOCLOUD-MCLOUDFREE","startdate":"1387769475455","type":"POGOCLOUD"}}}]}';
		stubRequest({
			err: null,
			res: {statusCode:200},
			body: body
		});

		this.client.listServices(function(err, info) {
			expect(err).to.be.null;
			expect(info).to.be.exist;
			done();
		});
	});

	it('list files', function(done) {

		var body = '{"files":[{"fileid":"b5THcjqkmuslBN1psagPMQ","type":"0","name":"Wanna. ～max creation～.mp4","parentid":"0","mimetype":"video/mp4","size":"41670598","ctime":"1380298934000","mtime":"1380298934000","origtime":"1380296684000","xcstamp":"1388931203031","tnstamp":"1388331821366","mdstamp":"1388331821366","streamtype":"full","thumbnail":"b5THcjqkmuslBN1psagPMQ/tn","preview":"b5THcjqkmuslBN1psagPMQ/pv","stream":"","livestream":"","flvstream":"","properties":{"origin":"","originid":"Wanna. ～max creation～.mp4"},"metaver":"0","filename":"Wanna. ～max creation～.mp4","mediatype":"video"},{"fileid":"0nPIBNiLgsAXjzuwMOkd0w","type":"1","name":"新規Folderディディ","parentid":"0","mimetype":"","size":"0","ctime":"1388331553563","mtime":"1388331758875","origtime":"1388331553563","xcstamp":"","tnstamp":"","mdstamp":"","streamtype":"full","thumbnail":"","preview":"","stream":"","livestream":"","flvstream":"","properties":{"origin":""},"metaver":"0","filename":"新規Folderディディ","mediatype":""}],"pageoffset":"0","count":"2","totalcount":"2"}';
		stubRequest({
			err: null,
			res: {statusCode:200},
			body: body
		});

		this.client.listFiles({
			deviceid: 'XCLDMCAPL2F4WD3PM955YKGEZW',
			serviceid: 'XCLDMCAPL2F4WD3PM955YKGEZW'
		}, function(err, info) {
			expect(err).to.be.null;
			//console.log(info);

			expect(info).to.be.exist;
			expect(parseInt(info.totalcount, 10)).to.be.equal(2);
			expect(parseInt(info.count, 10)).to.be.equal(2);
			done();
		});
	});

	it('list files(recursive)', function(done) {

		var that = this;

		//->>> parentid not specified
		var body1 = '{"files":[{"fileid":"b5THcjqkmuslBN1psagPMQ","type":"0","name":"Wanna. ～max creation～.mp4","parentid":"0","mimetype":"video/mp4","size":"41670598","ctime":"1380298934000","mtime":"1380298934000","origtime":"1380296684000","xcstamp":"1388931203031","tnstamp":"1388331821366","mdstamp":"1388331821366","streamtype":"full","thumbnail":"b5THcjqkmuslBN1psagPMQ/tn","preview":"b5THcjqkmuslBN1psagPMQ/pv","stream":"","livestream":"","flvstream":"","properties":{"origin":"","originid":"Wanna. ～max creation～.mp4"},"metaver":"0","filename":"Wanna. ～max creation～.mp4","mediatype":"video"},{"fileid":"0nPIBNiLgsAXjzuwMOkd0w","type":"1","name":"新規Folderディディ","parentid":"0","mimetype":"","size":"0","ctime":"1388331553563","mtime":"1388331758875","origtime":"1388331553563","xcstamp":"","tnstamp":"","mdstamp":"","streamtype":"full","thumbnail":"","preview":"","stream":"","livestream":"","flvstream":"","properties":{"origin":""},"metaver":"0","filename":"新規Folderディディ","mediatype":""}],"pageoffset":"0","count":"2","totalcount":"2"}';

		//->>> 0nPIBNiLgsAXjzuwMOkd0w
		var body2 = '{"files":[{"fileid":"tPfHDjHJ2hDr_p0EspwMfw","type":"1","name":"じょじょじょジョ","parentid":"0nPIBNiLgsAXjzuwMOkd0w","mimetype":"","size":"0","ctime":"1388331751700","mtime":"1388331775017","origtime":"1388331751700","xcstamp":"","tnstamp":"","mdstamp":"","streamtype":"full","thumbnail":"","preview":"","stream":"","livestream":"","flvstream":"","properties":{"origin":""},"metaver":"0","filename":"じょじょじょジョ","mediatype":""},{"fileid":"IQ5BPP4BMg15e25qNzOG3g","type":"1","name":"ジョジョｆだｓｋｊふぇいあ","parentid":"0nPIBNiLgsAXjzuwMOkd0w","mimetype":"","size":"0","ctime":"1388331758875","mtime":"1388331758875","origtime":"1388331758875","xcstamp":"","tnstamp":"","mdstamp":"","streamtype":"full","thumbnail":"","preview":"","stream":"","livestream":"","flvstream":"","properties":{"origin":""},"metaver":"0","filename":"ジョジョｆだｓｋｊふぇいあ","mediatype":""}],"pageoffset":"0","count":"2","totalcount":"2"}';

		//->>> tPfHDjHJ2hDr_p0EspwMfw
		var body3 = '{"files":[{"fileid":"vH5JmtwQRMMZ_L8GntU-aQ","type":"0","name":"IIVVSSS IV .avi","parentid":"tPfHDjHJ2hDr_p0EspwMfw","mimetype":"video/avi","size":"65687552","ctime":"1367478514000","mtime":"1367478514000","origtime":"1367478514000","xcstamp":"1388931633394","tnstamp":"1388331926651","mdstamp":"1388331926651","streamtype":"full","thumbnail":"vH5JmtwQRMMZ_L8GntU-aQ/tn","preview":"vH5JmtwQRMMZ_L8GntU-aQ/pv","stream":"vH5JmtwQRMMZ_L8GntU-aQ/st","livestream":"","flvstream":"","properties":{"origin":"","originid":"IIVVSSS IV .avi"},"metaver":"0","filename":"IIVVSSS IV .avi","mediatype":"video"},{"fileid":"ZM1fGDqOwRgdDswelVbVgA","type":"0","name":"[UNISON-----safksdjafekkke.mpg","parentid":"tPfHDjHJ2hDr_p0EspwMfw","mimetype":"video/mpeg","size":"6448138","ctime":"1357352415000","mtime":"1357352415000","origtime":"1357352415000","xcstamp":"1388931168167","tnstamp":"1388331784212","mdstamp":"1388331784212","streamtype":"full","thumbnail":"","preview":"","stream":"","livestream":"","flvstream":"","properties":{"origin":"","originid":"[UNISON-----safksdjafekkke.mpg"},"metaver":"0","filename":"[UNISON-----safksdjafekkke.mpg","mediatype":"video"}],"pageoffset":"0","count":"2","totalcount":"2"}';

		//->>> IQ5BPP4BMg15e25qNzOG3g
		var body4= '{"pageoffset":"0","count":"0","totalcount":"0"}';

		isStubbed = true;
		sinon
			.stub(request, 'get')
			.onCall(0)
			.yields(null, {statusCode:200}, body1)
			.onCall(1)
			.yields(null, {statusCode:200}, body2)
			.onCall(2)
			.yields(null, {statusCode:200}, body3)
			.onCall(3)
			.yields(null, {statusCode:200}, body4);


		that.client.listFiles({
			deviceid: 'XCLDMCAPL2F4WD3PM955YKGEZW',
			serviceid: 'XCLDMCAPL2F4WD3PM955YKGEZW',
			recursive: true
		}, function(err, files) {

			expect(err).to.be.empty;
			expect(files).to.be.exist;

			// 1st dimention
			expect(files[0].fileid).to.be.equal('b5THcjqkmuslBN1psagPMQ');
			expect(files[0].type).to.be.equal('0');
			expect(files[1].fileid).to.be.equal('0nPIBNiLgsAXjzuwMOkd0w');
			expect(files[1].type).to.be.equal('1');
			expect(files[1].files.length).to.be.equal(2);

			// 2nd dimention
			files = files[1].files;
			expect(files[0].fileid).to.be.equal('tPfHDjHJ2hDr_p0EspwMfw');
			expect(files[0].type).to.be.equal('1');
			expect(files[0].files.length).to.be.equal(2);
			expect(files[1].fileid).to.be.equal('IQ5BPP4BMg15e25qNzOG3g');
			expect(files[1].type).to.be.equal('1');
			expect(files[1].files.length).to.be.equal(0);

			// 3rd dimention
			files = files[0].files;
			expect(files[0].fileid).to.be.equal('vH5JmtwQRMMZ_L8GntU-aQ');
			expect(files[0].type).to.be.equal('0');
			expect(files[0].files).to.be.empty;
			expect(files[1].fileid).to.be.equal('ZM1fGDqOwRgdDswelVbVgA');
			expect(files[1].type).to.be.equal('0');
			expect(files[1].files).to.be.empty;

			done();
		});
	});
});
