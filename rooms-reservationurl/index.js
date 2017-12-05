const uuidv5 = require('uuid/v5');
var generateUniqueUniversalId = function(endpoint, room_id, uid, timestamp){
    var url =  `${endpoint}|${room_id}|${uid}|${timestamp}`;
    // console.log(endpoint, room_id, uid, timestamp, url);
    return uuidv5(url, uuidv5.URL);
};

/**
 * create a reservation record
 */
var create = function(room_id, uid, timestamp){
    return new Promise((resolve, reject) => {
        resolve(generateUniqueUniversalId(process.env.RESERVATION_HANDLER_ENPOINT, room_id, uid, timestamp));
    });
}

var APIGatewayResponse = function(body, statusCode) {
    return {
        "statusCode": statusCode === undefined ? 200 : statusCode,
        "headers": {
            'Content-Type': 'application/json'
        },
        "body": JSON.stringify(body)
    };
};
exports.handler = (event, context, callback) => {
    // TODO implement
    // console.log("event:", event.body);
    //room_id
    var room_id;
    var uid;
    var APIGatewayInvocation = false;
    var event_body;
    //for invocation by APIGateway
    
    if(event && event.body){
        APIGatewayInvocation = true;
        event_body = typeof event.body === 'object' ? event.body : JSON.parse(event.body);
        // console.log('event_body:', event_body);
        if(event_body.room_id){
            room_id = event_body.room_id;
        }
        if(event_body.booked_by){
            uid = event_body.booked_by;
        }
    }
    //for invocation by another lambda function
    else if(event){
        APIGatewayInvocation = false;
        if(event.room_id){
            room_id = event.room_id;
        }
        if(event.booked_by){
            uid = event.booked_by;
        }
    }
    //create a record in the reservation table for a given user
    var timestamp = Date.now();
    create(room_id, uid, timestamp).then(function(uuid){
        var url = process.env.RESERVATION_HANDLER_ENPOINT + '?uuid='+uuid+'&booked_by='+uid+'&room_id='+room_id+'&t='+timestamp;
        var body = {
            reservationurl: url,
            room_id: room_id,
            booked_by: uid
        };
        callback(null, APIGatewayInvocation ? APIGatewayResponse(body) : body);
    })
    .catch(function(e){
        
    });
};