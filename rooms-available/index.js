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
        var outputMessage = 'Hello! Welcome to Mister Booker T. I can help you book a room by asking, What\'s the next available room?';
        var repromptMessage = 'Simply ask me, What\'s the next available room?';
        this.emit(':ask', outputMessage, repromptMessage);
    },
    
    'AMAZON.HelpIntent': function () {
        var outputMessage = 'Simply ask me, What\'s the next available room?';
        this.emit(':ask', outputMessage);
    },
    'AMAZON.StopIntent': function () {
        var outputMessage = 'Goodbye.';
        this.emit(':tell', outputMessage );
    },
    'AMAZON.CancelIntent': function () {
        var outputMessage = 'Goodbye.';
        this.emit(':tell', outputMessage );
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
                    //We can wrap response in SSML to ensure everything is pronounced as expected
                    response = 'Ok, let me check what\'s the next available study room <break time="2s"/>. There is a room available in the' + campus +
                    ' campus in <say-as interpret-as="spell-out">' + building_name + '</say-as> for a group of <say-as interpret-as="cardinal">' + room_size + 
                    '</say-as> people. The room is available from <say-as interpret-as="time">' + stime_from + '</say-as> to <say-as interpret-as="time">' + stime_to + 
                    '</say-as>. Would you like to book the study room?';
                    that.emit(':ask', response);
                }
                // context.succeed(data.Payload);
            }
        });
    },
    'YesIntent' : function(){
        //If yes, we can trigger an intent here to create the URL that will save data to the database.
        //this.emitWithState("TargetIntent")
        this.emit(':ask', 'Ok I can get that set up for you. Please give me your student number', 'I don\'t think I got that. Please give me your student number');
    },
    'PrepareBookingIntent' : function(){
        //The followng if statement below confirms that the user enters the correct student number
        //and handles the verification using skill builder utterances
        if (this.event.request.dialogState == "STARTED" || this.event.request.dialogState == "IN_PROGRESS"){
            this.context.succeed({
                "response": {
                    "directives": [
                        {
                            "type": "Dialog.Delegate"
                        }
                    ],
                    "shouldEndSession": false
                },
                "sessionAttributes": {}
            });
        } else {
            this.emitWithState('ConfirmedBookingIntent');
        }
    },
    'ConfirmedBookingIntent': function(){
        //Intent creates the URL that will update the DB to confirm the booking
        //and sends the URL to the user via email. Yes, this can be a LAMBDA function of its own
        var response = 'Perfect, let me reserve the study room <break time="2s"/> Ok, your booking is all set up. I just sent you an' +
        ' email with a booking <say-as interpret-as="spell-out">URL</say-as>. Make sure to click on it to finalize your reservation. Goodbye';
        this.emit(':tell', response);
    },
    'NoIntent' : function(){
        this.emit(':tell', 'No worries, I may be able to help you next time. Goodbye');
        this.emit('AMAZON.StopIntent');
    },
    'Unhandled': function() {
        var outputMessage = 'Sorry, I didn\'t get that. Try asking again';
        this.emit(':ask', outputMessage);
    }
}
