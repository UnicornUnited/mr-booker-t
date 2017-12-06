
var GmailSend = require("gmail-send")({
//var send = require('../index.js')({ 
  user: process.env.EMAIL_USER,
  // user: credentials.user,                  // Your GMail account used to send emails 
  pass: process.env.EMAIL_PASS,
  // pass: credentials.pass,                  // Application-specific password 
  to:   process.env.EMAIL_TO,
  // to:   credentials.user,                  // Send to yourself 
                                           // you also may set array of recipients: 
                                           // [ 'user1@gmail.com', 'user2@gmail.com' ] 
  // from:    credentials.user             // from: by default equals to user 
  // replyTo: credentials.user             // replyTo: by default undefined 

});

var AWS = require("aws-sdk");
var lambda = new AWS.Lambda({
  region: 'us-west-2' //change to your region
});

exports.handler = (event, context, callback) => {

		console.log(event);

		var testVars = {
			room_id : event.Payload.room_id,
			booked_by : event.Payload.booked_by
		};
		var params = {
			FunctionName: "AlexaProject-service-rooms-reservationurl",
			Payload: JSON.stringify(testVars)
		};
		lambda.invoke(params, function(err, data){
			if(err){
				console.log(err);
			} else {
				var dataJson = JSON.parse(data.Payload);
				console.log(dataJson);
				GmailSend({ // Overriding default parameters
					subject: 'Test Email',
					text:    'URL? :' + dataJson.reservationurl,         // Plain text 
					//html:    '<b>html text</b>'            // HTML 
				}, function (err, res) {
					if (err) callback(null, err);
					else callback(null, res);
				});
				var response = {
					"statusCode": 200,
					"headers": {
						'Content-Type': 'application/json'
					},
					"body": "good"
				};
				callback(null, response);
			}
		});

	//}
	// TODO implement
};