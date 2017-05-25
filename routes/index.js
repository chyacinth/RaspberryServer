var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('raspdb.db');
var wifi = require('node-wifi');
var io = require('socket.io-client');
var socket = io('http://http://45.63.50.188/?sessionID=3RyZ4y3XjcsgHKxKCzymgCYMizMReSrO');

wifi.init({
    iface : 'en0' // network interface, choose a random wifi interface if set to null
});

function lookUpAndSend() {
    db.serialize(function() {
        db.each("SELECT * FROM humidity WHERE id = (SELECT MAX(id)  FROM humidity);", function (err, row) {
            //send data
            console.log(row.id + ": " + row.data);


        });
    });
    
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
