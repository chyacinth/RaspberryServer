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
var flag = true;
var lightThreshold = 100;


wifi.init({
    iface: 'wlan0' // network interface, choose a random wifi interface if set to null
});

function lookUpAndSend(req, res) {
    if (socket) {
        db.serialize(function() {
            db.each("SELECT * FROM humidity WHERE id = (SELECT MAX(id)  FROM humidity);", function(err, row) {
                var humiditydata = row.data;
                db.each("SELECT * FROM temporary WHERE id = (SELECT MAX(id)  FROM temporary);", function(err, row) {
                    var temporarydata = row.data;
                    db.each("SELECT * FROM pm WHERE id = (SELECT MAX(id)  FROM pm);", function(err, row) {
                        var pmdata = row.data;
                        db.each("SELECT * FROM light WHERE id = (SELECT MAX(id) FROM light);", function(err, row) {
                            var lightdata = row.data;
                            var timestamp = Date.parse(new Date());
                            db.each("SELECT * FROM location WHERE id = (SELECT MAX(id) FROM location);", function(err, row) {
                                //send data
                                var longtitude = row.longtitude;
                                var latitude = row.latitude;
                                console.log(row.id + ": " + humiditydata + ' ' + temporarydata + ' ' + pmdata + ' ' +
                                    lightdata + ' ' + timestamp + ' ' + row.longtitude + ' ' + row.latitude);
                                socket.emit('senddata', {
                                    humiditydata: humiditydata,
                                    temporarydata: temporarydata,
                                    pmdata: pmdata,
                                    lightdata: lightdata,
                                    timestamp: timestamp,
                                    longtitude: longtitude,
                                    latitude: latitude
                                });
                                if (lightdata >= lightThreshold && flag) {
                                    socket.emit("clock", {
                                        title: "闹钟",
                                        msg: `现在的光照强度为${lightdata}`
                                    })
                                    flag = false;
                                }
                                if (lightdata < lightThreshold && !flag) {
                                    flag = true;
                                }
                                console.log('Yes!');
                            });
                        });
                    });
                });
            });
        });
    }
}

function login(req, res) {
    res.render('login');
}

function userLogin(req, res) {
    var status = 0;
    var msg = '';
    request
        .post('http://45.63.50.188/login/login')
        .timeout(3000)
        .send({ username: req.body.username, password: req.body.password }) // sends a JSON post body
        .set('Accept', 'application/json')
        .end(function(err, result) {
            // Calling the end function will send the request
            if (err) {
                // res.redirect('/');
                status = 0;
                msg = 'send request fails';
                res.json({ status: status, msg: msg });
                return;
            } else if (result) {
                if (result.body.status === 0) {
                    status = 0;
                    msg = 'get cookies fails';
                    res.json({ status: status, msg: msg });
                    res.redirect('/');
                    return;
                } else {
                    cookies = setCookie.parse(result, {
                        decodeValues: true // default: true
                    });
                    var signature = require("cookie-signature");

                    prefix = "s:";

                    real_sid = cookies[0].value.replace(prefix, "");
                    real_sid = signature.unsign(real_sid, 'keyboard cat');
                    req.session.sid = real_sid;
                    req.session.save();
                    console.log('sid is ' + req.session.sid);
                    socket = io('http://45.63.50.188/?sessionID=' + real_sid);

                    socket.on('getpm', function() {
                        if (socket) {
                            db.serialize(function() {
                                db.each("SELECT * FROM humidity WHERE id = (SELECT MAX(id)  FROM humidity);", function(err, row) {
                                    var humiditydata = row.data;
                                    db.each("SELECT * FROM temporary WHERE id = (SELECT MAX(id)  FROM temporary);", function(err, row) {
                                        var temporarydata = row.data;
                                        db.each("SELECT * FROM pm WHERE id = (SELECT MAX(id)  FROM pm);", function(err, row) {
                                            var pmdata = row.data;
                                            db.each("SELECT * FROM light WHERE id = (SELECT MAX(id) FROM light);", function(err, row) {
                                                var lightdata = row.data;
                                                var timestamp = Date.parse(new Date());
                                                db.each("SELECT * FROM location WHERE id = (SELECT MAX(id) FROM location);", function(err, row) {
                                                    //send data
                                                    if (!isEmptyObject(row)) {
                                                        var longtitude = row.longtitude;
                                                        var latitude = row.latitude;
                                                    } else {
                                                        var longtitude = 30;
                                                        var latitude = 120;
                                                    }
                                                    console.log(row.id + ": " + humiditydata + ' ' + temporarydata + ' ' + pmdata + ' ' +
                                                        lightdata + ' ' + timestamp + ' ' + row.longtitude + ' ' + row.latitude);
                                                    socket.emit('setpm', {
                                                        humiditydata: humiditydata,
                                                        temporarydata: temporarydata,
                                                        pmdata: pmdata,
                                                        lightdata: lightdata,
                                                        timestamp: timestamp,
                                                        longtitude: longtitude,
                                                        latitude: latitude
                                                    });
                                                    console.log('Yes!');
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        }
                    });
                    socket.on('thres', function(data) {
                        if (data.threshold) {
                            lightThreshold = data.threshold;
                        }
                    });
                    console.log(cookies);
                    console.log("成功登陆！");
                    status = 1;
                    msg = '成功登陆!';
                    res.json({ status: status, msg: msg });
                    return;
                }
            }
        });
}

function sample(req, res) {
    var newtime = req.body.sampletime;
    console.log(newtime);
    //stop previous Sampling function
    if (newtime === undefined) newtime = 1;
    if (sample.previousSample === undefined) {
        sample.previousSample = 0;
    } else {
        clearInterval(sample.previousSample);
    }
    if (newtime == 0)
        delete sample.previousSample;
    else
        sample.previousSample = setInterval(lookUpAndSend, newtime * 1000);
    //lookUpAndSend();

    console.log('Yes!');
}

function isEmptyObject(obj) {
    for (var key in obj) {
        return false;
    }
    return true;
}

module.exports = function(app) {
    app.get('/', function(req, res) {
        request.get('http://45.63.50.188/login').timeout(500).end(function(err, result) {
            if (err) {
                console.log(err);
                res.redirect('/changeWifi');
                return;
            }
            if (req.session.sid) {
                res.render('index', {});
                return;
            } else res.redirect('/login');
        });
    });

    app.get('/changeWifi', function(req, res) {
        piWifi.scan(function cb(err, result) {
            console.log(err);
            console.log(result);
            if (result) {
                res.render('changeWifi', { networks: result });
            }
        });
    });

    app.post('/changeWifi', function(req, res) {
        var ssid = req.body.wifi_ssid;
        var password = req.body.wifi_password;
        var status = 0;
        var message = '';
        var cb = function callback(err) {
            if (err) status = 0;
            else status = 1;
            console.log({ status: status, msg: message });
        };
        if (password == '') {
            piWifi.openConnection(ssid, cb);
        } else {
            piWifi.check(ssid, function(err, result) {
                if (err) console.log('err is ' + err);
                else console.log(result);
            });
            console.log(piWifi.connect(ssid, password, function(err) {
                console.log(ssid);
                console.log(password);
                console.log(err);
                if (err) status = 0;
                else status = 1;
                console.log({ status: status, msg: message });
            }));
        }
    });

    app.get('/login', login);
    app.post('/userLogin', userLogin);
    app.post('/sample', sample);
};