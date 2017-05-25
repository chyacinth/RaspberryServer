var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('raspdb.db');
var wifi = require('node-wifi');
var io = require('socket.io-client');
var cookies = '';
var request = require('superagent');
var setCookie = require('set-cookie-parser');
var real_sid;
var socket;


wifi.init({
    iface : 'en0' // network interface, choose a random wifi interface if set to null
});

function lookUpAndSend(req, res) {
    if (socket) {
        db.serialize(function () {
            db.each("SELECT * FROM humidity WHERE id = (SELECT MAX(id)  FROM humidity);", function (err, row) {
                //send data
                console.log(row.id + ": " + row.data);
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

    console.log('Yes!');
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

                    socket = io('http://45.63.50.188/?sessionID=' + real_sid);
                    socket.on('nosession', function() {
                        console.log('nosession!');
                        socket.close();
                    });
                    socket.on('hassession', function() {
                        console.log('hasSession!');
                        socket.close();
                    });

                    console.log(cookies);
                    console.log("成功登陆！");
                }
            }
        });
}

module.exports = function(app) {
    app.get('/',function (req, res) {
        wifi.scan(function(err, networks) {
            if (err) {
                console.log(err);
            } else {
                console.log(networks);
                res.render('index',{networks:networks});
            }
        });
    });
    app.post('/sample',sample);
    app.post('/changeWifi', function (req, res) {
        wifi.connect({ssid: req.body.wifi_ssid, password: req.body.wifi_password}, function (err) {
            if (err) {
                console.log(err);
            }
            console.log('Connected');
        });
    });
    app.post('/userLogin', userLogin);
};
