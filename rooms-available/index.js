// Lambda Node.JS
'use strict';
var AWS = require("aws-sdk");
var Alexa = require("alexa-sdk");

var lambda = new AWS.Lambda({
  region: 'us-west-2' //change to your region
});

var dateFormatter = function (dateObj){
    var year = dateObj.getFullYear();
    var month = dateObj.getMonth();
    var date = dateObj.getDate();
    var hour24H = dateObj.getHours();
    var hours = 0;
    var ampm = '';
    //convert hour to am / pm
    if(hour24H <= 12){
        if(hours < 10) hours = `0${hours}`;
        else hours = `${hours}`;
        ampm = ' am';
    }
    else if(hour24H > 12){
        hours = (hour24H - 12).toString();
        ampm = ' pm';
    }
    var minutes = dateObj.getMinutes();
    if(minutes < 10) minutes = `0${minutes}`;
    var seconds = dateObj.getSeconds();
    if(seconds < 10) seconds = `0${seconds}`;
    return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}${ampm}`;
};

exports.handler = function (event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.registerHandlers(handlers);
    alexa.execute();

};

const handlers = {
    'LaunchRequest': function () {
        var welcomeMessage = 'Hello! When do you need a study room?';
        this.emit(':ask', welcomeMessage, 'Try again.');
    },

    'GetAvailableRooms': function() {
        //var time = this.event.request.intent.slots.listDate.value;
        var that = this;
        var response = 'Sorry, no study room available for today at this moment.';
        var event = {};
        event.queryStringParameters = {};
        event.queryStringParameters.format = 'json';
        lambda.invoke({
            FunctionName: 'AlexaProject-dataservice-rooms-available',
            Payload: JSON.stringify(event, null, 2) // pass params
        }, function(error, result) {
            if (error) {
                console.log("error:", error);
                that.emit(':ask', response);
                context.done('error', error);
            }
            //payload is everything retrieved by the invoked lambda function
            if(result.Payload){
                //parse necessary data from the payload.
                var data = JSON.parse(result.Payload);
                // console.log("data", data);
                var rows = data.body.data;
                var size = Object.keys(rows).length;
                
                console.log("data:", result);
                if(size == 0){
                    response = 'Sorry, no study room available for today at this moment.';
                    that.emit(':ask', response);
                }
                else{
                    var row = rows[1];
                    // console.log("row", row);
                    var building_name = row.buidling_name;
                    var room_name = row.room_name;
                    var room_size = row.size;
                    var campus = row.campus;
                    //convert date
                    var time = new Date(parseInt(row.time_from) * 1000);//convert it to millisecond
                    console.log("time", time);
                    var stime_from = dateFormatter(time);
                    time = new Date(parseInt(row.time_to) * 1000);//convert it to millisecond
                    var stime_to = dateFormatter(time);
                    response = `There is a room ${room_name} available on ${campus} campus in ${building_name} for a group of ${room_size} people,`;
                    response += ` It's available from ${stime_from} to ${stime_to}`;
                    response += ' Would you like to book this room?';

                    that.emit(':ask', response);
                }
                // context.succeed(data.Payload);
            }
        });
    },

    'Unhandled': function() {
        this.emit(':ask', 'Sorry, I didn\'t get that. Try saying available room for a date.', 'Try saying available room for a date.');
    },

    'AMAZON.HelpIntent': function () {
        this.emit(':ask', 'Tell me which date you are looking for study rooms. For example, any study room available today?', 'try again');
    },

    'AMAZON.StopIntent': function () {
        var say = 'Goodbye.';

        this.emit(':tell', say );
    }

}
