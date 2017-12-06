/**
 * passing a test action on the url query string: test=<action> to return a test
 * result. Test action options:
 * test=failed (test a failed result)
 * test=error  (test an error result)
 * 
 * passing a format on the url query string: format=<type> to return a specific
 * format type. Format type options:
 * format=json (default when format not presented or any other case not listed)
 * format=string (return a string representation)
 */
var AWS = require("aws-sdk");

exports.handler = (event, context, callback) => {
    // // TODO implement
    // var format = 'json';
    // if(event.queryStringParameters.format=='string'){
    //     format = 'string';
    // }
    // var test_action = "";
    // var data  = {};
    // var body = {"api_version":"stable_test", "data": data};
    // if(event.queryStringParameters && event.queryStringParameters.test){
    //     test_action = event.queryStringParameters.test;
    // }
    // if(test_action === 'failed'){
    //     data = {};
    //     body['error'] = {code: 1, message: "unauthorized access."};
    // }
    // else if (test_action === 'error'){
    //     data = {};
    //     body['error'] = {code: 1, message: "This is a test error."};
    // }
    // else{
    //     data["1"] = {pk: 1, building_id: 1, buidling_name: "SW14", room_id: 1, room_name: "137", time_from: 1545325200, time_to: 1545332400, size: 12, campus: "Burnaby", status:"available", status_end: 0};
    //     data["2"] = {pk: 2, building_id: 1, buidling_name: "SW14", room_id: 2, room_name: "140", time_from: 1545328800, time_to: 1545332400, size: 6, campus: "Burnaby", status:"available", status_end: 0};
    // }
    // body['data'] = data;
    // var response = {
    //     "statusCode": 200,
    //     "headers": {
    //         'Content-Type': 'application/json'
    //     },
    //     "body": format == 'string' ? JSON.stringify(body) : body
    // };
    // callback(null, response);
    var dynamodb = new AWS.DynamoDB();
    
    //Grabbing UTC time and converting to PST
    var date = new Date(); //Returns today's full day in time format UTC time
    var dateMiliseconds = Date.parse(date); //Turns date in miliseconds
    var milisecondsOffset = 1000 * 60 * 480; //PST is -8 hours from UTC so this is number in miliseconds
    var pstDate = new Date (dateMiliseconds - milisecondsOffset); // create PST date and time
    
    var year = pstDate.getFullYear();
    var month = pstDate.getMonth() + 1;
    var day = pstDate.getDate();
    var dateFormatted = year + '-' + month + '-' + day;
    
    var hours = pstDate.getHours();
    var minutes = pstDate.getMinutes();
    
    var pstJson = {
        pstDate : pstDate,
        pstDateFormatted : dateFormatted
    }
    
    // var response = 'Today\'s date is <say-as interpret-as="date"> ' + dateFormatted + '</say-as> and the current time is' +
    // hours + ' ' + minutes;
    
    //This are the details of the query we will retrieve.
    var params = {
    ExpressionAttributeNames: {
        "#room_id": "room_id",
        "#booked_by": "booked_by",
        "#building_code":"building_code",
        "#building_num":"building_num",
        "#reserve_starts":"reserve_starts",
        "#room":"room"
    }, 
    ExpressionAttributeValues: {
        ":no_one": {
            S: "null"
        },
        ":hours" : {
             N: "19"
            //N: hours+""
        }
    }, 
    FilterExpression: "booked_by = :no_one AND reserve_starts > :hours",
    ProjectionExpression: "#room_id, #booked_by, #building_code, #building_num, #reserve_starts, #room", 
    TableName: "BCIT_ROOMS"
    };
    
    // console.log("Vancouver Date and Time: "+ pstDate);
    
    /**
     * FYI. Database has some useful scanned (returned) values
     *  [{Object and Values}, {etc}],
        Count: 2,
        ScannedCount: 17 }
     */
    dynamodb.scan(params, function(err, data) {
        // if (err) console.log(err, err.stack); // an error occurred
        // else     console.log(data); // successful response
        if (err) callback(err, err.stack); // an error occurred
        else     data.pstDetails = pstJson; callback(null, data); // successful response
    });
};