'use strict'

var express = require('express');
var app = express();
var gpio = require('rpi-gpio');
var async = require('async');
var debug = require('debug')('main');

class MotorBot {

    constructor(leftPinA, leftPinB, rightPinA, rightPinB){
        this.leftPinA = leftPinA;
        this.leftPinB = leftPinB;
        this.rightPinA = rightPinA;
        this.rightPinB = rightPinB;
    }

    init(callback) {
        debug('bot is initializing.');
        gpio.setMode(gpio.MODE_BCM, function(err){
            if(err){
                debug('failed to set BCM Mode on : ', err);
                callback(err, null);
            }else {
                debug('bot mode is set to BCM');
            }
        });
        
        debug('setting up motors.');

        async.parallel([
            function(callback) {
                gpio.setup(rightPinA, gpio.DIR_OUT, callback);
            },
            function(callback) {
                gpio.setup(rightPinB, gpio.DIR_OUT, callback)
            },
            function(callback) {
                gpio.setup(leftPinA, gpio.DIR_OUT, callback)
            }, 
            function(callback) {
                gpio.setup(leftPinB, gpio.DIR_OUT, callback)
            },                                        
        ], function(err, results) {
            if(err){
                console.log(err);
                debug('error : %s', err);
                callback(err, null);
            } else {
                debug('motors setup complete.');
                //setAllOff(callback); // Not required to set all pins off 
                callback(null, true);
            }
        });
    }

    write(pin, value, callback) {
        gpio.write(pin, value, callback);
    }

    delayedWrite(pin, value, timeout, callback) {
        setTimeout(function() {
            debug('setting %s to ' + value, pin);
            gpio.write(pin, value, callback);
        }, timeout);
    }

    move(motorA, motorB, callback){
        async.parallel([
            function(callback) {
                MotorBot.prototype.write(motorA, true, callback);
            },
            function(callback) {
                MotorBot.prototype.write(motorB, true, callback);
            },
            ], function(err, results) {
                debug('write complete, both motors are running.');
                if(err) 
                    callback(err, null);
                else
                    callback(null, true);
        });   
    }    

    stop(motorA, motorB, callback){
        async.parallel([
            function(callback) {
                MotorBot.prototype.delayedWrite(motorA, false, 500, callback);
            },
            function(callback) {
                MotorBot.prototype.delayedWrite(motorB, false, 500, callback);
            },
            ], function(err, results) {
                debug('write complete, both motors are stopped.');
                if(err) 
                    callback(err, null);
                else
                    callback(null, true);
        });   
    }

    destroy(cb){
        gpio.destroy(function() {
            debug('Closed pins, now exit');
            cb();
        });
    }    

}


/*test setup code.*/

/*async.series([
    function(callback) {
    	bot.init(callback);
    },
    function(callback) { //foreward
    	bot.move(bot.motors.leftA, bot.motors.rightA, callback);
    },
    function(callback) { //stop
        bot.stop(bot.motors.leftA, bot.motors.rightA, callback);
    },
    function(callback) { //reverse
        bot.move(bot.motors.leftB, bot.motors.rightB, callback);
    },
    function(callback) { //stop
        bot.stop(bot.motors.leftB, bot.motors.rightB, callback);
    }, 
    function(callback) { //right
        bot.move(bot.motors.leftA, bot.motors.rightB, callback);
    },
    function(callback) { //stop
        bot.stop(bot.motors.leftA, bot.motors.rightB, callback);
    }, 
    function(callback) { //left
        bot.move(bot.motors.leftB, bot.motors.rightA, callback);
    },
    function(callback) { //stop
        bot.stop(bot.motors.leftB, bot.motors.rightA, callback);
    },           
    ], function(err, results) {
    	if(err){
    		debug('Error in main init code : %s', err);
    	}else {
        	debug('main:init done.');
        }
    }
);*/


app.get('/', function (req, res) {
    res.statusCode = 200;
    res.send('Welcome to the Bot Command Center.');
});

//parameter move=foreward, reverese, left and right
app.get('/bot/cmd', function (req, res) {
    //debug('received request : ', req);

    let cmd = req.param('move');
    let motorA, motorB;

    debug('command : ', cmd);

    if(cmd === undefined){
        res.statusCode = 200;
        res.send({status: "missing command in the request."});          
    }

    if(cmd === 'FOREWARD'){
        motorA = leftPinA;
        motorB = rightPinA;
    }else if(cmd === 'REVERSE'){
        motorA = leftPinB;
        motorB = rightPinB;        
    }else if(cmd === 'LEFT'){
        motorA = leftPinB;
        motorB = rightPinA;        
    }else if(cmd === 'RIGHT'){
        motorA = leftPinA;
        motorB = rightPinB;         
    }

    debug('executing command.');

    async.series([
        // function(callback) {
        //     bot.init(callback);
        // },
        function(callback) { //move
            bot.move(motorA, motorB, callback);
        },
        function(callback) { //stop
            bot.stop(motorA, motorB, callback);
        },      
        ], function(err, results) {
            if(err){
                debug('Error in executing command %s, Error : %s', cmd, err);
                res.statusCode = 500;
                res.send({status: "ERROR"});             
            }else {
                debug('finished executing command %s', cmd);
                res.statusCode = 200;
                res.send({status: "SUCCESS"});            
            }
        }
    );
});

var leftPinA=9, leftPinB=10, rightPinA=8, rightPinB=7;

const bot = new MotorBot(9, 10, 8, 7);
bot.init(function(err, results){
    if(err){
        debug('Error in bot init code : %s', err);             
    }else {
        debug('main:init done.');          
    }
});

var server = app.listen(3000, function () {
  debug('app listening on port 3000!');
});

process.on('exit', function() {
    debug('About to exit.');
    bot.destroy(function(){
        debug('Stopping the Server.');
        server.close()
    });
});

process.on('SIGINT', function () {
    debug('Got SIGINT.');
    bot.destroy(function(){
        debug('Stopping the Server.');
        server.close()
    });    
});

