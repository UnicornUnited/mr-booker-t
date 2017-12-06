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
    alexa.dynamoDBTableName = 'AlexaAttributes'; // That's it!
    alexa.registerHandlers(handlers);
    alexa.execute();

};

const handlers = {
    'LaunchRequest': function () {
        var outputMessage = 'Hello! Welcome to Mister Booker T. I can help you book a study room. Just ask, What\'s the next available room?';
        var repromptMessage = 'Simply ask me, What\'s the next available room?';
        // this.emit(':ask', outputMessage, repromptMessage);
        this.emitWithState('GetAvailableRooms'); //Used for testing purposes
    },
    'Unhandled': function() {
        var outputMessage = 'Sorry, I didn\'t get that. Try asking again';
        this.emit(':ask', outputMessage);
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
        var that = this;
        var event = {};
        var params = {
            FunctionName: "AlexaProject-dataservice-rooms-available",
        };
        lambda.invoke(params, function(err, data) {
            if (err) {
                console.log('err: ', err);
                that.emit(':tell', 'Something went wrong when retrieving available rooms. Goodbye');
            }// an error occurred
            else {
                // console.log(data); 
                var dataJson = JSON.parse(data.Payload);

                //If the counter returns 0 then there is nothing to book so we can close the skill
                if(dataJson.Count == 0){
                    var outputSpeech = "It appears that there aren't any rooms available today. Sorry about that. Goodbye!"
                    that.emit(':tell', outputSpeech); 
                }
                
                //Find next available room by iterating through Items
                var pstDate = new Date(dataJson.pstDetails); 
                var pstHour = pstDate.getHours();
                var min = parseInt(dataJson.Items[0].reserve_starts.N);
                var index = 0;
                var trackIndex = 0;
                for (trackIndex; trackIndex < parseInt(dataJson.Count); trackIndex++) {
                    //console.log(dataJson.Items[trackIndex].reserve_starts.N);
                   if (min > parseInt(dataJson.Items[trackIndex].reserve_starts.N)){
                       min = parseInt(dataJson.Items[trackIndex].reserve_starts.N);
                       index = trackIndex;
                       // console.log("index: " + index);
                   }
                   // console.log("min: " + min);
                }

            //We can wrap response in SSML to ensure everything is pronounced as expected
            // Persisting the room_id data
            // console.log("PRINT: " + dataJson.Items[index].room_id.S);
            // console.log('that.attributes:', that.attributes);
            //BELOW SAVES ATTRIBUTES TO SESSION ATTRIBUTES WHEN IT SHOULD IDEALLY SAVE IT IN ATTRIBUTES. 
            that.attributes['room_id'] = dataJson.Items[index].room_id.S;
            // console.log('that.attributes:', that.attributes['room_id']);
            var campus = 'Burnaby';
            var building_name = dataJson.Items[index].building_code.S + dataJson.Items[index].building_num.N;
            var room_size = 6;
            var stime_from = parseInt(dataJson.Items[index].reserve_starts.N);
            var stime_to = parseInt(dataJson.Items[index].reserve_starts.N) + 1;
            var amOrPm = stime_from > 11 ? 'PM' : 'AM'; 
            var response = 'Ok, let me check what\'s the next available study room today <say-as interpret-as="date">' + dataJson.pstDetails.pstDateFormatted + '</say-as><break time="2s"/> ' +
            ' There is a room available in the ' + campus +
            ' campus in the building <say-as interpret-as="spell-out">' + building_name + '</say-as> for a group of <say-as interpret-as="cardinal">' + room_size + 
            '</say-as> people. The room is available from ' +stime_from+ ' ' +amOrPm+ ' to ' +stime_to+ ' ' +amOrPm+
            '. Would you like to book the study room?';
            that.emit(':ask', response); 
            }// successful response 
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
            this.attributes['student_id'] = this.event.request.intent.slots.bcit_id.value;
            //WE NEED TO FIND A WAY TO SAVE THIS IN ALEXA VARIABLES TABLE. NOT WORKING RIGHT NOW
            //this.attributes['room_id'] = this.sessionAttributes.room_id;
            //this.emitWithState('ConfirmedBookingIntent');
            this.emit(':tell', "Check if database saved value");
        }
    },
    'ConfirmedBookingIntent': function(){
        //Intent creates the URL that will update the DB to confirm the booking
        //and sends the URL to the user via email. Yes, this can be a LAMBDA function of its own
        
        //Here you invoke LAMBDA to send email
        //If error, emit a message to say Sorry, couldn't send you an email... Please try again
        //If all good then response PErfect, let.....
        var that = this;
        console.log(this.attributes['room_id']);
        var values = {
            "room_id": this.attributes['room_id'],
            "booked_by": this.attributes['student_id']
        }
        var params = {
            FunctionName: "AlexaProject-send-email",
            Payload: values
        };
        lambda.invoke(params, function(err, data){
            if (err) {
                var response1 = 'Sorry, something went wrong with the booking. Please try again later.';
                that.emit(':tell', response1);
            } 
            else {
                var response = 'Perfect, let me reserve the study room <break time="2s"/> Ok, your booking is all set up. I just sent you an' +
                ' email with a booking <say-as interpret-as="spell-out">URL</say-as>. Make sure to click on it to finalize your reservation. Goodbye';
                that.emit(':tell', response);
            }
        });
        // var response = 'Perfect, let me reserve the study room <break time="2s"/> Ok, your booking is all set up. I just sent you an' +
        // ' email with a booking <say-as interpret-as="spell-out">URL</say-as>. Make sure to click on it to finalize your reservation. Goodbye';
        // this.emit(':tell', response);
    },
    'NoIntent' : function(){
        this.emit(':tell', 'No worries, I may be able to help you next time. Goodbye');
    },
    'DateTimeIntent': function(){
        this.emit(':tell', 'date time intent');
    }
}

/**
 Dynamo DB Rooms Mock Data Format
 {
  "booked_by": "null", (string)
  "building_code": "sw", (string)
  "building_num": 1, (number)
  "reserve_starts": 22, (number)
  "room": 210, (number)
  "room_id": "sw121022" (string)
}
 */
