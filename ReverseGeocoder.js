var map;
var geocoder;
var bounds;

var myModalDialogChanged = false;

var parseOngoing = false
var parseCounterStepped = 0
var parseCounterChunks = 0
var parseCounterRows = 0
var parseTimerStart
var parseTimerEnd;

var postingServiceTimerStarted = false;
var postingServiceTimerId = 0;
var postingServiceTimerIntervalShort = 300;
var postingServiceTimerIntervalLong = 1200;

var Counter_PostedRecords = 0;
var Counter_GeocodedRecords = 0;
var Counter_AmbiguousRecords = 0;

// ---------------------------------------------------------------------------------------------------------

var DB_CSVRecords = [];// data record list
var DB_CSVColumns = []; //data columns list
var markers = [];

var DC_Lat = { fieldSearch: 'latitude', isRequired: false };
var DC_Lng = { fieldSearch: 'longitude', isRequired: true };


function InitializeCSVColumns() {

    DB_CSVColumns.push(DC_Lat);
    DB_CSVColumns.push(DC_Lng);

}

function CSVPostedRecord(CSV_Row) {

    this.RowIndex = CSV_Row.RowIndex
    this.Latitude = CSV_Row.Lat;
    this.Longitude = CSV_Row.Lng;
    this.StatusText = '';
    this.HasErrors = false;

}

function parseBuildConfig() {
    // Limit the number or records viewed.
    // Record one should be table headers
    var Preview = 500;
    if (IsNumeric($('#preview').val())) {
        Preview = parseInt($('#preview').val()) + 1;
        if (Preview < 2) {
            Preview = 2;
        }
        if (Preview > 5000) {
            Preview = 5001;
        }
    }

    return {
        header: true
        , dynamicTyping: false // Can't be true because zipcodes are parsed as numeric// $('#dynamicTyping').prop('checked')
        , preview: Preview
        , step: parseStepFunction
        , worker: false //$('#worker').prop('checked')
        , complete: parseCompleteFunction
        , keepEmptyRows: false
        //, encoding: $('#encoding').val()
        //, delimiter: $('#delimiter').val()
        //, step: $('#stream').prop('checked') ? parseStepFunction : undefined
        //, comments: $('#comments').val()
        //, download: $('#download').prop('checked')
        //, keepEmptyRows: $('#keepEmptyRows').prop('checked')
        //, chunk: $('#chunk').prop('checked') ? parseChunkFunction : undefined
    };
}

function parseStart() {

    parseCounterStepped = 0;
    parseCounterChunks = 0;
    parseCounterRows = 0;

    Counter_PostedRecords = 0;
    Counter_GeocodedRecords = 0;
    Counter_AmbiguousRecords = 0;

    postingServiceTimerId = 0;

    postingServiceShowProgress();

    var files = $('#files')[0].files;
    var config = parseBuildConfig();

    if (files.length > 0) {

        $("#initial_form_fileGroup").removeClass("has-error");

        parseTimerStart = performance.now();

        parseOngoing = true;

        $('#files').parse({ config: config, before: function (file, inputElem) { console.log("Parsing file:", file); } });

        $("#initial_form").hide();
    }
    else {
        $("#initial_form_fileGroup").addClass("has-error");
    }
}

function parseStepFunction(results, parser) {

    var $table;

    // If this is the first run, or a re-run, clear the table
    if (!parseCounterStepped) {

        $table = $("#results_table");
        $table.html('');

        // Find column indices
        if (!parseIdentifyFields(results)) {
            parser.abort();
            return
        }

        $table.html('<tr>'
            + '<th>Row</th>'
            + '<th>Latitude</th>'
            + '<th>Longitude</th>'
            + '<th>Formatted</th>'
            + '<th>Street Number</th>'
            + '<th>Route</th>'
            + '<th>Political</th>'
            + '<th>Locality</th>'
            + '<th>State</th>'
            + '<th>Postal Code</th>'
            + '<th><i class="fa fa-exclamation-circle" aria-hidden="true"></i> Status</th>'
            + '</tr>');

    }

    // Create a new row and populate it
    var CSV_Row = {

        Latitude: results.data[0][DC_Lat.fieldName]
        , Longitude: results.data[0][DC_Lng.fieldName]
        , Formatted: 0
        , StreetNumber: 0
        , Route: "Street"
        , Political: ""
        , Locality: ""
        , State: ""
        , PostalCode: 0
        , RowIndex: parseCounterStepped

    }

    //Apply default values, if required

    //This is to avoid dealing with null/undefined values. Instead, look for empty strings
    if (!CSV_Row.Latitude) CSV_Row.Latitude = '';
    if (!CSV_Row.Longitude) CSV_Row.Longitude = '';

    CSV_Row.Latitude = CSV_Row.Latitude.trim();
    CSV_Row.Longitude = CSV_Row.Longitude.trim();

    // Default values

    // Create CSVPostedRecord object
    CSV_Row = new CSVPostedRecord(CSV_Row);

    //Validate supplied values
    parseValidateCSVRow(CSV_Row);

    // Append to the row list
    DB_CSVRecords.push(CSV_Row);

    // Create a new table row and append to the display table
    $table = $("#results_table");
    $table.append($("<tr id='CSVRow_" + parseCounterStepped + "'>"));

    var $tr = $("<tr id='CSVRowErrorsRow_" + parseCounterStepped + "'>");
    $tr.hide();

    var $td = $("<td id='CSVRowErrorsCell_" + parseCounterStepped + "' colspan='8'>");
    var $well = $("<div id='CSVRowErrorsWell_" + parseCounterStepped + "' class='alert alert-danger well-sm'/>");

    $well.appendTo($td);
    $td.appendTo($tr);
    $tr.appendTo($table);

    displayCSVRowInitialize(CSV_Row);

    postingServiceShowProgress();

    parseCounterStepped++;
    parseCounterRows += results.data.length;

    if (!postingServiceTimerStarted) {
        postingServiceTimerStarted = true;
        postingServiceServiceStart();
    }

}

function parseValidateCSVRow(CSV_Row) {

    CSV_Row.UserId = 0;
    CSV_Row.HasErrors = false;

    //CSV_Row.Longitude = CSV_Row.Longitude.trim()

    if (CSV_Row.Address.length == 0) {
        CSV_Row.HasErrors = true;
        CSV_Row.StatusText = 'Invalid Longitude';
    }

}

function parseChunkFunction(results, file) {
    if (!results)
        return;
    parseCounterChunks++;
    parseCounterRows += results.data.length;
}

function parseIdentifyFields(results) {

    var abort = false;

    // Make a copy of the array to run case-agnostic searches
    var fieldnames = results.meta.fields.slice(0);

    // Turn all field names to lower case
    for (i = 0; i < fieldnames.length; i++) {
        fieldnames[i] = fieldnames[i].toLowerCase();
    }

    // Look for column definitions and verify that the user has supplied all the required fields
    for (i = 0; i < DB_CSVColumns.length; i++) {

        DB_CSVColumns[i].fieldIndex = fieldnames.indexOf(DB_CSVColumns[i].fieldSearch);

        if (DB_CSVColumns[i].fieldIndex >= 0) {
            DB_CSVColumns[i].fieldName = results.meta.fields[DB_CSVColumns[i].fieldIndex];
        }
        else if (DB_CSVColumns[i].isRequired) {
            abort = true;
        }
    }

    if (abort) {

        $("#progress_counters").hide();
        var $container = $("#post_processing_form");
        var $p = $("<p>");
        $p.html("The following <strong>required</strong> fields were not supplied. <a href='#' onclick='location.reload();'>Reload</a> the page to try another upload");
        $p.appendTo($container);

        var $div = $("<div class='alert alert-danger'>");
        var $ul = $("<ul>");
        var $li;
        for (i = 0; i < DB_CSVColumns.length; i++) {

            if ((DB_CSVColumns[i].isRequired) && (DB_CSVColumns[i].fieldIndex < 0)) {
                $li = $("<li>");
                $li.html(DB_CSVColumns[i].fieldSearch);
                $ul.append($li);
            }
        }

        $div.append($ul);
        $div.appendTo($container);
    }

    return !abort;
}

function parseCompleteFunction() {

    parseOngoing = false;

    parseTimerEnd = performance.now();

    console.log("Finished input. Time:", parseTimerEnd - parseTimerStart);
    console.log("Rows:", parseCounterRows, "Stepped:", parseCounterStepped, "Chunks:", parseCounterChunks);
    //console.log('DB_CSVRecords', DB_CSVRecords);

    postingServiceServiceStart()

}

function displayCSVRowInitialize(CSV_Row) {

    var Row_Index = CSV_Row.RowIndex;
    var Temp = '';

    var $tr = $("#CSVRow_" + Row_Index);
    $tr.empty();

    var $TDRowCounter = $("<td id='RowCounter_" + Row_Index + "'>" + (parseCounterStepped + 1) + ".</td>");
    var $TDLatitude = $("<td id='Latitude_" + Row_Index + "'>" + CSV_Row.Latitude + "</td>");
    var $TDLongitude = $("<td id='Longitude_" + Row_Index + "'>" + CSV_Row.Longitude + "</td>");
    var $TDAddressFormatted = $("<td id='AddressFormatted_" + Row_Index + "' nowrap>&nbsp;</td>");
    var $TDStreetNumber = $("<td id='StreetNumber_" + Row_Index + "'>&nbsp;</td>");
    var $TDRoute = $("<td id='Route_" + Row_Index + "'>&nbsp;</td>");
    var $TDPolitical = $("<td id='Route_" + Row_Index + "'>&nbsp;</td>");
    var $TDLocality = $("<td id='Route_" + Row_Index + "'>&nbsp;</td>");
    var $TDState = $("<td id='Route_" + Row_Index + "'>&nbsp;</td>");
    var $TDPostalCode = $("<td id='Route_" + Row_Index + "'>&nbsp;</td>");

    var $TDPostStatus = $("<td id='PostStatus_" + Row_Index + "'>&nbsp;</td>");

    $TDRowCounter.appendTo($tr);
    $TDLatitude.appendTo($tr);
    $TDLongitude.appendTo($tr);
    $TDAddressFormatted.appendTo($tr);
    $TDStreetNumber.appendTo($tr);
    $TDRoute.appendTo($tr);
    $TDPolitical.appendTo($tr);
    $TDLocality.appendTo($tr);
    $TDState.appendTo($tr);
    $TDPostalCode.appendTo($tr);
    $TDPostStatus.appendTo($tr);

}

function displayCSVRowStatus(CSV_Row) {

    $("#PostStatus_" + CSV_Row.RowIndex).html(CSV_Row.StatusText);

    $("#CSVRow_" + CSV_Row.RowIndex).removeClass("info")
    $("#CSVRow_" + CSV_Row.RowIndex).removeClass("warning")
    $("#CSVRow_" + CSV_Row.RowIndex).removeClass("danger")
    $("#CSVRow_" + CSV_Row.RowIndex).removeClass("success")

    switch (CSV_Row.StatusText) {
        case 'OK':
            $("#CSVRow_" + CSV_Row.RowIndex).addClass("success")
            break;
        case 'AMBIGUOUS':
            $("#CSVRow_" + CSV_Row.RowIndex).addClass("warning")
            break;
        case 'OVER_QUERY_LIMIT':
            //$("#CSVRow_" + CSV_Row.RowIndex).addClass("warning")
            break;
        case 'UNKNOWN_ERROR':
            $("#CSVRow_" + CSV_Row.RowIndex).addClass("info")
            break;
        case 'ZERO_RESULTS':
        case 'REQUEST_DENIED':
        case 'INVALID_REQUEST':
            $("#CSVRow_" + CSV_Row.RowIndex).addClass("danger")
            break;
    }

}

function postingServiceShowProgress() {

    $("#progress_counters").show();

    $("#row_count_csv").html(parseCounterRows);
    $("#row_count_posted").html(Counter_PostedRecords);
    $("#row_count_geocoded").html(Counter_GeocodedRecords);
    $("#row_count_ambiguous").html(Counter_AmbiguousRecords);

}

function postingServiceServiceStart() {

    //If the timer is on, the system has already started. Don't re-start it
    if (postingServiceTimerId != 0) return;

    ajaxPostCSVRecord();
}

function geocodeManualAddress(geocoder, resultsMap) {
    var latitude = document.getElementById('latitude').value;
    var longitude = document.getElementById('longitude').value;
    geocoder.geocode({ 'latitude': latitude, 'longitude': longitude }, function (results, status) {
        if (status === 'OK') {
            console.log('results')
            console.log(results)
            resultsMap.setCenter(results[0].geometry.location);
            var marker = new google.maps.Marker({
                map: resultsMap,
                position: results[0].geometry.location
            });
        } else {
            alert('Geocode was not successful for the following reason: ' + status);
        }
    });
}
function ajaxPostCSVRecord() {

    $("#progressbar_container").show();

    if (DB_CSVRecords.length <= Counter_PostedRecords) {
        
        $("#progressbar_container").hide();
        $("#CopyToClipboard").show();
        return;
    }

    var CSV_Row = DB_CSVRecords[Counter_PostedRecords];

    geocodeSingleLocation(CSV_Row);

    Counter_PostedRecords++;

    var PCNT = 0;
    if (DB_CSVRecords.length) {
        PCNT = 100 * Counter_PostedRecords / DB_CSVRecords.length;
    }

    $("#progressbar").attr('aria-valuenow', PCNT);
    $("#progressbar").attr('style', 'width: ' + PCNT + '%;');

}
function geocodeSingleLocation(CSV_Row) {

    if (CSV_Row.latitude.length > 0) {
        geocoder.geocode({ 'latitude': CSV_Row.latitude }, function (results, status) {
            CSV_Row.StatusText = status;
            if (status == 'OK') {
                ajaxPostCSVRecord_Success(CSV_Row, results);
            } else {
                ajaxPostCSVRecord_Failure(CSV_Row);
            }
        });
    } else {
        CSV_Row.StatusText = 'EMPTY ADDRESS';
        ajaxPostCSVRecord_Failure(CSV_Row, 'EMPTY ADDRESS');
    }
}
function ajaxPostCSVRecord_Success(CSV_Row, results) {
    var largeInfowindow = new google.maps.InfoWindow();
    if (results.length == 1) {
        var results = results[0];
        var location = results.geometry.location;

        CSV_Row.AddressFormatted = results.formatted_address;
        //CSV_Row.StreetNumber = location.lat().toFixed(8);
        //CSV_Row.Route = location.lng().toFixed(8);
        CSV_Row.HasErrors = false;

        // https://maps.googleapis.com/maps/api/geocode/json?latlng=25.6491,-100.2667&key=AIzaSyBRWN14K9IE3k6rWoj3HXTBGZ1iFal2M84

        $("#AddressFormatted_" + CSV_Row.RowIndex).html(CSV_Row.AddressFormatted);
        $("#Latitude_" + CSV_Row.RowIndex).html("<a href='https://www.google.com/maps/place/" + CSV_Row.Latitude + "," + CSV_Row.Longitude + "' target=_blank>" + CSV_Row.Latitude);
        $("#Longitude_" + CSV_Row.RowIndex).html("<a href='https://www.google.com/maps/place/" + CSV_Row.Latitude + "," + CSV_Row.Longitude + "' target=_blank>" + CSV_Row.Longitude);

        var marker = new google.maps.Marker({
            map: map,
            animation: google.maps.Animation.DROP,
            position: results.geometry.location,
            //icon: 'https://maps.gstatic.com/intl/en_us/mapfiles/markers2/measle_blue.png' // null = default icon
        });

        bounds.extend(results.geometry.location);
        map.fitBounds(bounds);

        Counter_GeocodedRecords++;

    } else {
        var temp = '';
        $.each(results, function (index, value) {
            temp = temp + '<a href="https://www.google.com/maps/place/' + encodeURIComponent(value.formatted_address) + '" target=_blank>' + value.formatted_address + '</a><br/>';
            $("#AddressFormatted_" + CSV_Row.RowIndex).html(temp);
        });

        CSV_Row.StatusText = 'AMBIGUOUS';
    }

    displayCSVRowStatus(CSV_Row)

    postingServiceShowProgress();

    postingServiceTimerId = setTimeout(function () { ajaxPostCSVRecord() }, postingServiceTimerIntervalShort);

    marker.addListener('click', function() {
            populateInfoWindow(this, largeInfowindow);
          });

}

function populateInfoWindow(marker, infowindow) {
        // Check to make sure the infowindow is not already opened on this marker.
        if (infowindow.marker != marker) {
          infowindow.marker = marker;
          infowindow.setContent('<div>' + marker.position + '</div>');
          infowindow.open(map, marker);
          // Make sure the marker property is cleared if the infowindow is closed.
          infowindow.addListener('closeclick', function() {
            infowindow.marker = null;
          });
        }
      }

function ajaxPostCSVRecord_Failure(CSV_Row) {

    CSV_Row.HasErrors = true;
    displayCSVRowStatus(CSV_Row)

    switch (CSV_Row.StatusText) {
        case 'OVER_QUERY_LIMIT':
            Counter_PostedRecords--;//try again
            postingServiceTimerId = setTimeout(function () { ajaxPostCSVRecord() }, postingServiceTimerIntervalLong);
            return;
            break;
        case 'UNKNOWN_ERROR':
            Counter_PostedRecords--;//try again
            postingServiceTimerId = setTimeout(function () { ajaxPostCSVRecord() }, postingServiceTimerIntervalShort);
            return;
            break;
        case 'ZERO_RESULTS':
        case 'REQUEST_DENIED':
        case 'INVALID_REQUEST':
            break;
    }

    postingServiceTimerId = setTimeout(function () { ajaxPostCSVRecord() }, postingServiceTimerIntervalShort);
}

function InitializeDocument() {

    InitializeCSVColumns();

    $('body').on('click', '#ReadCSVFile', function () { parseStart() });
    $('body').on('click', '#CopyToClipboard', function () { CopyResultsToClipboard() });

    $("#post_processing_form").hide();

    $("#progressbar_container").hide();
    $("#progress_counters").hide();

    $("#CopyToClipboard").hide();

}

function CopyResultsToClipboard() {

    var successful = copyTextToClipboard('COPY TO CLIPBOARD NOT IMPLEMENTED YET. PLEASE COPY THE TABLE TO EXCEL MANUALLY');

    if (successful) {
        console.log('copied')
    } else {
        console.log('not copied')
    }
}

window.initMap = function() {
    map = new google.maps.Map(document.getElementById('map'), { zoom: 11, center: { lat: 25.686614, lng: -100.316113 }, });

    geocoder = new google.maps.Geocoder();
    bounds = new google.maps.LatLngBounds();

    //document.getElementById('submit').addEventListener('click', function () {
    //    geocodeManualAddress(geocoder, map);
    //});

    InitializeDocument()
}

