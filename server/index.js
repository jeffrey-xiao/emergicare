var express = require('express');
var app = express();
var http = require('http').Server(app);
var morgan = require('morgan');
var bodyParser = require('body-parser');
var sassMiddleware = require('node-sass-middleware');
var twilio = require('twilio');
var firebase = require('firebase');
var firebaseHelpers = require('./lib/firebaseHelpers.js');
var helpers = require('./lib/helpers.js');
var request = require('request');
var path = require('path');

var FIREBASE_CONFIG = require("./config/firebase_config.js");

firebase.initializeApp(FIREBASE_CONFIG);

var hostname = 'localhost';
var port = 8080;

app.set('port', port);

app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/', express.static(__dirname + '/../frontend/build/'));

app.post('/sms/receive', function (req, resp) {
  console.log("receieved text");
  var rawData = req.body.Body.split(" ");
  if (rawData.length >= 2) {
    if (rawData[0] == "name:set") {
      var settingsRef = firebase.database().ref("/settings/" + req.body.From);
      var name = rawData.slice(1).join(" ");
      firebaseHelpers.save(settingsRef, {
        name: name
      }).then(function () {
        resp.send("<Response><Message>Name succesfully set to: " + name + "!</Message></Response>");
      });
    } else if (rawData[0] == "number:add") {
      var settingsRef = firebase.database().ref("/settings/" + req.body.From + "/alerts");
      var number = rawData[1];
      var data = {};
      data[number] = true;
      firebaseHelpers.save(settingsRef, data).then(function () {
        resp.send("<Response><Message>Added: " + number + " to alert list!</Message></Response>");
      });
    } else if (rawData[0] == 'number:remove') {
      var number = rawData[1];
      var settingsRef = firebase.database().ref("/settings/" + req.body.From + "/alerts/" + number);
      firebaseHelpers.remove(settingsRef).then(function () {
        resp.send("<Response><Message>Removed: " + number + " from alert list!</Message></Response>")
      });
    }
  } else {
    rawData = req.body.Body.split(";");

    var latitude = Number(rawData[0]);
    var longitude = Number(rawData[1]);
    var jsonData = {
      phoneNumber: req.body.From,
      latitude: latitude,
      longitude: longitude,
      accuracy: Number(rawData[2]),
      address: ""
    };

    var callsRef = firebase.database().ref("/calls/" + req.body.From);
    firebaseHelpers.query(callsRef).then(function (res) {
      if (res == null) {
        res = {
          latitude: null,
          longitude: null
        };
      }

      var dist = helpers.getDist(latitude, longitude, res.latitude, res.longitude);

      if (dist < 1 && res.address != "") {
        console.log("cached");
        jsonData.address = res.address;
        firebaseHelpers.save(callsRef, jsonData).then(function () {
          resp.status(200);
          resp.send();
        });
      } else { 
        console.log("recomputing");
        request('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latitude + ',' + longitude + '&key=' + FIREBASE_CONFIG.googleMapsKey, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            var ret = JSON.parse(body);
            if (ret.results == null || ret.results[0] == null || ret.results[0].formatted_address == null)
              jsonData.address = "";
            else
              jsonData.address = ret.results[0].formatted_address
          } else {
            jsonData.address = "";
          }

          firebaseHelpers.save(callsRef, jsonData).then(function() {
            resp.status(200);
            resp.send();
          });
        })
      }
    }, function (error) {
      if (error)
        console.log(error);
      resp.status(500);
      resp.send();
    });
  }
});

// updating the services
setInterval(function () {
  console.log("in updating services");
  var servicesRef = firebase.database().ref("/services/");
  helpers.getVehicles().then(function (res) {
    firebaseHelpers.save(servicesRef, res).then(function () {
      console.log("Updated services");
    });
  });
}, 40000);

http.listen(app.get('port'), function () {
  console.log("Node app is running port", app.get('port')); 
});