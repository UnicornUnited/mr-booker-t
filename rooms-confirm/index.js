var AWS = require("aws-sdk");
var lambda = new AWS.Lambda({
    region: process.env.LAMBDA_REGION
});
const uuidv5 = require('uuid/v5');
var docClient = new AWS.DynamoDB.DocumentClient();

const TABLENAME_RESERVATION = "AlexaProject_rooms_reservation";
const TABLENAME_ROOM = "BCIT_ROOMS";

/**
 * generate an uuid in the same manner as it's created in the reservationurl function
 */
var generateUniqueUniversalId = function(endpoint, room_id, uid, timestamp) {
    var url = `${endpoint}|${room_id}|${uid}|${timestamp}`;
    return uuidv5(url, uuidv5.URL);
};

var APIGatewayResponse = function(body, statusCode) {
    return {
        "statusCode": statusCode === undefined ? 200 : statusCode,
        "headers": {
            'Content-Type': 'application/json'
        },
        "body": JSON.stringify(body)
    };
};

/**
 * Verify the reservation link
 */
var verifyLink = function(param_chain) {
    return new Promise((resolve, reject) => {
        var d = generateUniqueUniversalId(process.env.RESERVATION_HANDLER_ENPOINT, param_chain.room_id, param_chain.uid, param_chain.timestamp);
        if (d === param_chain.uuid) {
            resolve(param_chain);
        }
        else {
            reject({ "error": "uuid validation failed." });
        }
    });
};

/**
 * verify the reservation
 */
var verifyReservation = function(param_chain) {
    console.log("verifyReservation: ", param_chain);
    return new Promise((resolve, reject) => {
        var params = {
            TableName: TABLENAME_RESERVATION,
            Key: {
                "uuid": param_chain.uuid
            }
        };
        docClient.get(params, function(err, data) {
            if (err) {
                console.log("error occurred on verifyReservation"); //Indicate where the error occurred
                reject(err);
            }
            else {
                //get the reserveration entry, do some checkings here
                if (data.Item === undefined) {
                    reject({ "message": "Reservation not found." });
                }
                //validate uid
                else if (data.Item.uid != param_chain.uid) {
                    reject({ "message": "Reservation not found for the given student id." });
                }
                //validate room_id
                else if (data.Item.room_id != param_chain.room_id) {
                    reject({ "message": "Reservation not found for the given room id." });
                }
                //validate reservation expiry (workflow not yet discussed)
                else if (data.Item.timestamp - Date.now() != 0 && false) {
                    reject({ "message": "Reservation has expired." + (data.Item.timestamp - Date.now()) });
                }
                else {
                    //pass this verifcation
                    console.log("verifyReservation: item status is "+data.Item.status);
                    resolve(param_chain);
                }
            }
        });
    });
};

/**
 * Update the reservation entry
 */
var updateReservation = function(param_chain) {
    return new Promise((resolve, reject) => {
        var params = {
            TableName: TABLENAME_RESERVATION,
            Key: {
                "uuid": param_chain.uuid
            },
            UpdateExpression: "set #s = :s",
            //define placeholder starting with # for attribute names
            ExpressionAttributeNames: {
                "#s": "status"
            },
            //definine placeholder starting with : for attribute values
            ExpressionAttributeValues: {
                ":s": "confirmed"
            },
            ReturnValues: "UPDATED_NEW"
        };
        docClient.update(params, function(err, data) {
            if (err) {
                console.log("error occurred on updateReservation"); //Indicate where the error occurred
                reject(err);
            }
            else {
                console.log("updateReservation done");
                resolve(param_chain);
            }
        });
    });
};
/**
 * Update the room record
 */
var updateRoom = function(param_chain) {
    return new Promise((resolve, reject) => {
        var params = {
            TableName: TABLENAME_ROOM,
            Key: {
                "room_id": param_chain.room_id
            },
            UpdateExpression: "set #a = :a",
            //define placeholder starting with # for attribute names
            ExpressionAttributeNames: {
                "#a": "booked_by"
            },
            //definine placeholder starting with : for attribute values
            ExpressionAttributeValues: {
                ":a": param_chain.uid
            },
            ReturnValues: "UPDATED_NEW"
        };
        docClient.update(params, function(err, data) {
            if (err) {
                console.log("error occurred on updateRoom"); //Indicate where the error occurred
                reject(err);
            }
            else {
                console.log("updateRoom done.");
                resolve(param_chain);
            }
        });
    });
};
exports.handler = (event, context, callback) => {
    // TODO implement
    var uuid;
    var room_id;
    var uid;
    var timestamp;
    //identify the function call
    //is it a http post request?
    var request_method = 'GET';
    var event_body;
    if (event && event.httpMethod) {
        request_method = 'POST';
    }
    //if it is a post request, look for parameters from event.body
    if (request_method == 'POST' && event.body) {
        event_body = JSON.parse(event.body);
        uuid = event_body.uuid;
        room_id = event_body.room_id;
        uid = event_body.booked_by;
        timestamp = event_body.t;
    }
    //else look for parameters from event.queryStringParameters
    else if (request_method == 'GET' && event.queryStringParameters) {
        uuid = event.queryStringParameters.uuid;
        room_id = event.queryStringParameters.room_id;
        uid = event.queryStringParameters.booked_by;
        timestamp = event.queryStringParameters.t;
    }
    //chain all functions here
    Promise.resolve({room_id, uid, uuid, timestamp})
    .then(verifyLink)
    .then(verifyReservation)
    .then(updateReservation)
    .then(updateRoom).then((result)=>{
        console.log(result);
        callback(null, APIGatewayResponse({"message":"reservation is confirmed."}));
    })
    .catch((err)=>{
        //error handler
        console.log("finally catch the error: ", err);
        callback(null, APIGatewayResponse(err, 502));
    });
};
