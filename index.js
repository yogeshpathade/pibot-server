'use strict'

var express = require('express');
var app = express();
var gpio = require('rpi-gpio');
var async = require('async');
var debug = require('debug')('main');

var bot = {

	motors: {
		leftA: 9,
		leftB: 10,
		rightA: 8,
		rightB: 7
	},

    init: function (callback) {
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
                gpio.setup(bot.motors.rightA, gpio.DIR_OUT, callback);
            },
            function(callback) {
                gpio.setup(bot.motors.rightB, gpio.DIR_OUT, callback)
            },
            function(callback) {
                gpio.setup(bot.motors.leftA, gpio.DIR_OUT, callback)
            }, 
            function(callback) {
                gpio.setup(bot.motors.leftB, gpio.DIR_OUT, callback)
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

        function setAllOff(callback) {
            async.series([
                function(callback) {
                    bot.write(bot.motors.rightA, false, callback);
                },
                function(callback) {
                    bot.write(bot.motors.rightB, false, callback);
                },
                function(callback) {
                    bot.write(bot.motors.leftA, false, callback);
                },
                function(callback) {
                    bot.write(bot.motors.leftB, false, callback);
                },
                ], function(err, results) {
                	debug('bot initialization complete.');
        			callback(null, results);
            });        
        }
    }, //end of init
    write : function (pin, value, callback) {
    	gpio.write(pin, value, callback);
	},
    delayedWrite: function (pin, value, timeout, callback) {
	    setTimeout(function() {
	        debug('setting %s to ' + value, pin);
	        gpio.write(pin, value, callback);
	    }, timeout);
   	},	
   	move : function(motorA, motorB, callback){
	    async.parallel([
	        function(callback) {
	            bot.write(motorA, true, callback);
	        },
	        function(callback) {
	            bot.write(motorB, true, callback);
	        },
	        ], function(err, results) {
	        	debug('write complete, both motors are running.');
	            if(err) 
	            	callback(err, null);
                else
                    callback(null, true);
	    });   
   	},
    stop : function(motorA, motorB, callback){
        async.parallel([
            function(callback) {
                bot.delayedWrite(motorA, false, 500, callback);
            },
            function(callback) {
                bot.delayedWrite(motorB, false, 500, callback);
            },
            ], function(err, results) {
                debug('write complete, both motors are stopped.');
                if(err) 
                    callback(err, null);
                else
                    callback(null, true);
        });   
    },               
};

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
        motorA = bot.motors.leftA;
        motorB = bot.motors.rightA;
    }else if(cmd === 'REVERSE'){
        motorA = bot.motors.leftB;
        motorB = bot.motors.rightB;        
    }else if(cmd === 'LEFT'){
        motorA = bot.motors.leftB;
        motorB = bot.motors.rightA;        
    }else if(cmd === 'RIGHT'){
        motorA = bot.motors.leftA;
        motorB = bot.motors.rightB;         
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
  console.log('About to exit.');
        gpio.destroy(function() {
        console.log('Closed pins, now stopping the server.');
        server.close();
    });
});

process.on('SIGINT', function () {
  console.log('Got SIGINT.');
    gpio.destroy(function() {
        console.log('Closed pins, now exit');
        server.close();
    });
});

