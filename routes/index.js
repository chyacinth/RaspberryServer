var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('raspdb.db');
var wifi = require('node-wifi');
var io = require('socket.io-client');
var cookies = '';
var request = require('superagent');
var setCookie = require('set-cookie-parser');
var real_sid;
var socket;
var piWifi = require("pi-wifi");


wifi.init({
    iface : 'wlan0' // network interface, choose a random wifi interface if set to null
});

function lookUpAndSend(req, res) {
    if (socket) {
        db.serialize(function () {
            db.each("SELECT * FROM humidity WHERE id = (SELECT MAX(id)  FROM humidity);", function (err, row) {
                //send data
                console.log(row.id + ": " + row.data);
                socket.emit('senddata',{data:row.data});
                console.log('Yes!');
            });
        });
    }
}

function sample (req, res) {
    var newtime = req.body.sampletime;
    console.log(newtime);
    //stop previous Sampling function
    if (newtime === undefined) newtime = 1;
    if (sample.previousSample === undefined)
    {
       sample.previousSample = 0;
    }
    else
    {
        clearInterval(sample.previousSample);
    }
    sample.previousSample = setInterval(lookUpAndSend, newtime*1000);
    //lookUpAndSend();

}

function userLogin(req, res)
{
    request
        .post('http://45.63.50.188/login/login')
        .send({ username: req.body.username, password: req.body.password }) // sends a JSON post body
        .set('Accept', 'application/json')
        .end(function(err, result){
            // Calling the end function will send the request
            if (err)
            {
                res.redirect('/');
            }
            if (result)
            {
                if (result.body.status === 0)
                {
                    res.redirect('/');
                }
                else
                {
                    cookies = setCookie.parse(result, {
                        decodeValues: true  // default: true
                    });
                    var signature = require( "cookie-signature" );

                    prefix = "s:";

                    real_sid = cookies[0].value.replace( prefix, "" );
                    real_sid = signature.unsign( real_sid, 'keyboard cat');
                    req.session.sid = real_sid;
                    socket = io('http://45.63.50.188/?sessionID=' + real_sid);

                    console.log(cookies);
                    console.log("成功登陆！");
                }
            }
        });
}

module.exports = function(app) {
    app.get('/',function (req, res) {
        if (req.session.sid) {
            piWifi.scan(function cb(err, result) {
                    console.log(err);
                    console.log(result);
                    if (result) {
                        res.render('index', {networks: result});
                    }
                }
            );
        }
        else res.redirect('/userLogin');
    });
    app.post('/changeWifi', function (req, res) {
	var ssid = req.body.wifi_ssid;
	var password = req.body.wifi_password;
	var status = 0;
	var message = '';
	var cb = function callback(err)
	{
		if (err) status = 0;
		else status = 1;
		console.log({status:status,msg:message});
	};
	if (password == '')
	{
		piWifi.openConnection(ssid,cb);
	}
	else
	{
		piWifi.check(ssid,function(err,result){
			if (err) console.log('err is '+err); 
			else console.log(result);
		});
		console.log(piWifi.connect(ssid,password,function(err)
		{
			console.log(ssid);
			console.log(password);
			console.log(err);
			if (err) status = 0;
			else status = 1;
			console.log({status:status,msg:message});
		}));
	}

    });
    app.post('/userLogin', userLogin);
};
